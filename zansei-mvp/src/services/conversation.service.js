import { randomUUID } from 'crypto';
import * as conversationModel from '../models/conversation.model.js';
import * as openaiService from './openai.service.js';
import { buildSystemPrompt, getAssistantConfig } from '../utils/promptBuilder.js';
import { checkComponentUnlocks, calculateProgress } from '../utils/dataExtractor.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeConversation(bubbleAnswers, funnelId) {
  // Load funnel config to get assistant info
  const funnelsConfig = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, '../../config/funnels.json'),
      'utf-8'
    )
  );

  const funnel = funnelsConfig.funnels.find(f => f.id === funnelId);
  if (!funnel) {
    throw new Error(`Funnel not found: ${funnelId}`);
  }

  // Get assistant config
  const assistantConfig = getAssistantConfig(funnelId);

  // Build system prompt with bubble answers (name will be added after first message is received)
  const systemPrompt = buildSystemPrompt(bubbleAnswers, assistantConfig, null);

  // Get assistant ID dynamically based on funnel
  const assistantId = openaiService.getAssistantId(funnelId);
  if (!assistantId) {
    throw new Error(`Assistant not initialized for funnel: ${funnelId}. Call initializeAssistants() first.`);
  }

  // Create OpenAI thread
  const threadId = await openaiService.createThread();

  // Create session
  const sessionId = randomUUID();
  const sessionData = {
    session_id: sessionId,
    bubble_answers: bubbleAnswers,
    selected_funnel: funnel,
    openai_thread_id: threadId,
    openai_assistant_id: assistantId,
    unlocked_components: [],
    progress: {
      questions_answered: 0,
      questions_total: assistantConfig.questions.filter(q => q.required).length,
      percentage: 0,
      is_complete: false
    }
  };

  await conversationModel.createSession(sessionData);

  // Send initial message with context - the assistant's system prompt includes instructions
  // to ask for name first, but we'll reinforce it in the first message
  const initialMessage = `You are starting a new conversation. Follow your instructions: greet them warmly and ask for their name first before asking any marketing questions.`;

  // Send initial message - the assistant will use its system prompt to greet and ask for name
  const firstMessage = await openaiService.sendMessage(
    threadId,
    assistantId,
    initialMessage,
    systemPrompt
  );

  // Save assistant's first message
  await conversationModel.addConversationMessage(sessionId, {
    role: 'assistant',
    content: firstMessage
  });

  // Build component definitions for frontend
  const componentDefinitions = assistantConfig.report_components.map(comp => ({
    id: comp.id,
    name: comp.name,
    desc: comp.description || ''
  }));

  return {
    session_id: sessionId,
    thread_id: threadId,
    first_message: firstMessage,
    progress: sessionData.progress,
    unlocked_components: [],
    component_definitions: componentDefinitions
  };
}

export async function sendMessage(sessionId, userMessage) {
  // Get session
  const session = await conversationModel.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  // Check if in upgrade mode
  let upgradeMode = null;
  try {
    upgradeMode = session.upgrade_mode ? JSON.parse(session.upgrade_mode) : null;
  } catch (e) {
    // Not in upgrade mode
  }

  if (session.is_complete && !upgradeMode) {
    const funnelName = session.selected_funnel.label || 'marketing strategy';
    return {
      response: `I already have all the information I need to create your ${funnelName.toLowerCase()} report. Would you like me to generate it now?`,
      progress: session.progress,
      unlocked_components: session.unlocked_components,
      is_complete: true
    };
  }

  // Get assistant config
  const assistantConfig = getAssistantConfig(session.selected_funnel.id);

  // Get assistant ID
  const assistantId = openaiService.getAssistantId(session.selected_funnel.id);
  if (!assistantId) {
    throw new Error(`Assistant not initialized for funnel: ${session.selected_funnel.id}`);
  }

  // Send message to OpenAI
  const assistantResponse = await openaiService.sendMessage(
    session.openai_thread_id,
    assistantId,
    userMessage
  );

  // Save both messages
  await conversationModel.addConversationMessage(sessionId, {
    role: 'user',
    content: userMessage
  });

  await conversationModel.addConversationMessage(sessionId, {
    role: 'assistant',
    content: assistantResponse
  });

  // Name extraction is now handled by AI extraction (included in extraction schema)
  // No regex needed - AI intelligently extracts name from conversation

  // Get conversation history for extraction
  const conversationHistory = await conversationModel.getConversationHistory(sessionId);

  // Extract structured data from conversation
  const extractedData = await openaiService.extractStructuredData(
    conversationHistory,
    assistantConfig
  );

  // Debug logging
  console.log(`[DEBUG] Extracted data for session ${sessionId}:`, JSON.stringify(extractedData, null, 2));
  console.log(`[DEBUG] Extracted ${Object.keys(extractedData).length} fields`);

  // Save collected data - AI extraction now provides pre-normalized values
  let savedCount = 0;
  for (const [questionId, data] of Object.entries(extractedData)) {
    if (data && data.normalized_value !== null && data.normalized_value !== undefined) {
      try {
        // Use the AI-extracted normalized_value directly (no regex normalization needed)
        await conversationModel.saveCollectedData(
          sessionId,
          questionId,
          data.raw_answer || '',
          data.normalized_value,
          data.confidence || null // Store confidence for quality checks
        );
        savedCount++;
        console.log(`[DEBUG] ✅ Saved data for ${questionId}: "${data.normalized_value}" (confidence: ${data.confidence || 'N/A'})`);
      } catch (error) {
        console.error(`[DEBUG] ❌ Failed to save ${questionId}:`, error.message);
      }
    } else {
      console.log(`[DEBUG] ⏭️  Skipped saving ${questionId}: normalized_value is ${data?.normalized_value}`);
    }
    
    // Handle user_name extraction separately
    if (questionId === 'user_name' && data && data.normalized_value) {
      try {
        await conversationModel.updateSession(sessionId, { user_name: data.normalized_value });
        session.user_name = data.normalized_value;
        console.log(`[DEBUG] ✅ Updated user_name in session: ${data.normalized_value}`);
      } catch (error) {
        console.error(`[DEBUG] ❌ Failed to update user_name:`, error.message);
      }
    }
  }
  console.log(`[DEBUG] 💾 Total saved: ${savedCount} fields out of ${Object.keys(extractedData).length} extracted`);

  // Get all collected data
  const allCollectedData = await conversationModel.getCollectedData(sessionId);

  // Calculate progress first (needed for unlock checks)
  const progress = calculateProgress(allCollectedData, assistantConfig);

  // Check component unlocks with enhanced logic
  const componentStatus = checkComponentUnlocks(allCollectedData, assistantConfig, progress);

  // Handle upgrade mode
  if (upgradeMode && upgradeMode.active) {
    const targetComponent = upgradeMode.target_component;
    const questionsNeeded = upgradeMode.questions_needed || [];
    
    // Check if all required questions are now answered
    const allAnswered = questionsNeeded.every(qId => {
      const data = allCollectedData[qId];
      return data && data.normalized_value;
    });

    // Check if component is now unlocked
    const isUnlocked = componentStatus.unlocked.includes(targetComponent);

    if (isUnlocked || allAnswered) {
      // Upgrade complete!
      await conversationModel.updateSession(sessionId, {
        upgrade_mode: JSON.stringify({ active: false }),
        unlocked_components: componentStatus.unlocked
      });

      // Send congratulatory message
      const componentConfig = assistantConfig.report_components.find(c => c.id === targetComponent);
      const congratsMessage = `Perfect! I now have everything I need to create your ${componentConfig?.name || targetComponent} report. You can generate it now!`;
      
      await conversationModel.addConversationMessage(sessionId, {
        role: 'assistant',
        content: congratsMessage
      });

      // Build component definitions for frontend
      const componentDefinitions = assistantConfig.report_components.map(comp => ({
        id: comp.id,
        name: comp.name,
        desc: comp.description || ''
      }));

      return {
        response: assistantResponse,
        progress: progress,
        unlocked_components: componentStatus.unlocked,
        partial_components: componentStatus.partial,
        locked_components: componentStatus.locked,
        is_complete: progress.is_complete,
        upgrade_complete: true,
        upgrade_message: congratsMessage,
        collected_data: allCollectedData,
        component_definitions: componentDefinitions
      };
    } else {
      // Still in upgrade mode, track progress
      const answeredCount = questionsNeeded.filter(qId => {
        const data = allCollectedData[qId];
        return data && data.normalized_value;
      }).length;

      await conversationModel.updateSession(sessionId, {
        upgrade_mode: JSON.stringify({
          ...upgradeMode,
          questions_answered: questionsNeeded.filter(qId => {
            const data = allCollectedData[qId];
            return data && data.normalized_value;
          })
        }),
        unlocked_components: componentStatus.unlocked
      });

      // Build component definitions for frontend
      const componentDefinitions = assistantConfig.report_components.map(comp => ({
        id: comp.id,
        name: comp.name,
        desc: comp.description || ''
      }));

      return {
        response: assistantResponse,
        progress: progress,
        unlocked_components: componentStatus.unlocked,
        partial_components: componentStatus.partial,
        locked_components: componentStatus.locked,
        is_complete: progress.is_complete,
        upgrade_mode: true,
        upgrade_progress: {
          answered: answeredCount,
          total: questionsNeeded.length
        },
        collected_data: allCollectedData,
        component_definitions: componentDefinitions
      };
    }
  }

  // Update session
  await conversationModel.updateSession(sessionId, {
    unlocked_components: componentStatus.unlocked,
    progress: progress,
    is_complete: progress.is_complete
  });

  // Build component definitions for frontend
  const componentDefinitions = assistantConfig.report_components.map(comp => ({
    id: comp.id,
    name: comp.name,
    desc: comp.description || ''
  }));

  return {
    response: assistantResponse,
    progress: progress,
    unlocked_components: componentStatus.unlocked,
    partial_components: componentStatus.partial,
    locked_components: componentStatus.locked,
    is_complete: progress.is_complete,
    collected_data: allCollectedData,
    component_definitions: componentDefinitions
  };
}

export async function getConversationState(sessionId) {
  const session = await conversationModel.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const conversation = await conversationModel.getConversationHistory(sessionId);
  const collectedData = await conversationModel.getCollectedData(sessionId);
  const assistantConfig = getAssistantConfig(session.selected_funnel.id);
  const progress = calculateProgress(collectedData, assistantConfig);
  const componentStatus = checkComponentUnlocks(collectedData, assistantConfig, progress);

  // Build component definitions for frontend
  const componentDefinitions = assistantConfig.report_components.map(comp => ({
    id: comp.id,
    name: comp.name,
    desc: comp.description || ''
  }));

  let upgradeMode = null;
  try {
    upgradeMode = session.upgrade_mode ? JSON.parse(session.upgrade_mode) : null;
  } catch (e) {
    // Not in upgrade mode
  }

  return {
    session_id: sessionId,
    bubble_answers: session.bubble_answers,
    selected_funnel: session.selected_funnel,
    conversation: conversation,
    collected_data: collectedData,
    unlocked_components: componentStatus.unlocked,
    partial_components: componentStatus.partial,
    locked_components: componentStatus.locked,
    progress: progress,
    is_complete: session.is_complete,
    upgrade_mode: upgradeMode,
    component_definitions: componentDefinitions
  };
}

export async function getDebugInfo(sessionId) {
  const session = await conversationModel.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const collectedData = await conversationModel.getCollectedData(sessionId);
  console.log(`[DEBUG] getDebugInfo: Retrieved ${Object.keys(collectedData).length} fields from database`);
  console.log(`[DEBUG] getDebugInfo: Field IDs:`, Object.keys(collectedData));
  
  const assistantConfig = getAssistantConfig(session.selected_funnel.id);
  console.log(`[DEBUG] getDebugInfo: Funnel: ${session.selected_funnel.id}, Total questions: ${assistantConfig.questions.length}`);
  
  const progress = calculateProgress(collectedData, assistantConfig);
  console.log(`[DEBUG] getDebugInfo: Progress: ${progress.percentage}% (${progress.questions_answered}/${progress.questions_total} answered, ${progress.required_answered || 0}/${progress.required_total || 0} required)`);
  
  const componentStatus = checkComponentUnlocks(collectedData, assistantConfig, progress);
  console.log(`[DEBUG] getDebugInfo: Unlocked: ${componentStatus.unlocked.length}, Partial: ${componentStatus.partial.length}, Locked: ${componentStatus.locked.length}`);

  // Load component requirements
  const componentRequirementsPath = path.join(
    __dirname,
    '../../config/component-requirements.json'
  );
  const componentRequirements = JSON.parse(fs.readFileSync(componentRequirementsPath, 'utf-8'));
  const funnelRequirements = componentRequirements[session.selected_funnel.id]?.components || {};

  // Build detailed component analysis
  const componentAnalysis = assistantConfig.report_components.map(component => {
    const requirements = funnelRequirements[component.id] || {};
    const requiredFields = requirements.required_fields || [];
    const unlockAfterQuestions = requirements.unlock_after_question_ids || [];
    
    // Check which required fields are present
    const fieldsStatus = requiredFields.map(fieldId => {
      const data = collectedData[fieldId];
      return {
        field_id: fieldId,
        present: !!(data && data.normalized_value),
        confidence: data?.confidence || 0,
        raw_answer: data?.raw_answer || null,
        normalized_value: data?.normalized_value || null
      };
    });

    // Check which unlock questions are answered
    const questionsStatus = unlockAfterQuestions.map(qId => {
      const data = collectedData[qId];
      return {
        question_id: qId,
        present: !!(data && data.normalized_value),
        confidence: data?.confidence || 0,
        raw_answer: data?.raw_answer || null,
        normalized_value: data?.normalized_value || null
      };
    });

    const fieldsPresent = fieldsStatus.filter(f => f.present).length;
    const questionsAnswered = questionsStatus.filter(q => q.present).length;
    const minQuestionsRequired = requirements.min_questions_required || 1;
    const minProgress = requirements.min_unlock_at_progress || 0;

    // Check quality requirements
    const qualityChecks = requirements.quality_checks || {};
    const qualityStatus = Object.entries(qualityChecks).map(([fieldId, checkType]) => {
      const data = collectedData[fieldId];
      // Use stored confidence if available, otherwise infer from data presence
      const confidence = data?.confidence !== null && data?.confidence !== undefined 
        ? data.confidence 
        : (data && data.normalized_value ? 0.75 : 0);
      const rawAnswer = data?.raw_answer || '';
      const normalized = String(data?.normalized_value || '');
      const wordCount = rawAnswer ? String(rawAnswer).split(/\s+/).filter(w => w.length > 0).length : 0;
      
      let passed = false;
      if (data && data.normalized_value !== null && data.normalized_value !== undefined) {
        switch (checkType) {
          case 'must_be_detailed':
            passed = wordCount >= 10; // Don't require confidence, just word count
            break;
          case 'must_be_specific_range':
          case 'must_be_specific_number_or_range':
            // Check for numbers, dollar signs, or budget-related words in either normalized or raw
            passed = /\d/.test(normalized) || /(\$|budget|thousand|k\b|scale|spend|invest|\d+)/i.test(rawAnswer);
            break;
          case 'must_be_specific_location':
            passed = wordCount >= 3;
            break;
          case 'must_be_specific_date_or_timeframe':
            // Check for date-related words or timeframes
            const dateWords = /(december|january|february|march|april|may|june|july|august|september|october|november|month|week|day|start|launch|timeline)/i;
            passed = dateWords.test(rawAnswer) || dateWords.test(normalized);
            break;
          case 'must_be_measurable':
            passed = wordCount >= 5;
            break;
          case 'must_be_urgent_for_quick_wins':
            const urgentWords = /(urgent|immediate|asap|soon|quick|now|this month|this week)/i;
            passed = urgentWords.test(rawAnswer) || urgentWords.test(normalized);
            break;
          default:
            // If we have normalized_value, assume it passed (confidence > 0 was required for extraction)
            passed = true;
        }
      }
      
      return {
        field_id: fieldId,
        check_type: checkType,
        passed: passed,
        confidence: confidence,
        word_count: wordCount
      };
    });

    const allQualityPassed = qualityStatus.length === 0 || qualityStatus.every(q => q.passed);
    const progressMet = progress.percentage >= minProgress;
    const questionsMet = Math.max(fieldsPresent, questionsAnswered) >= minQuestionsRequired;
    const isUnlocked = componentStatus.unlocked.includes(component.id);
    const isPartial = componentStatus.partial.includes(component.id);

    return {
      component_id: component.id,
      component_name: component.name,
      status: isUnlocked ? 'unlocked' : (isPartial ? 'partial' : 'locked'),
      requirements: {
        min_questions_required: minQuestionsRequired,
        min_unlock_at_progress: minProgress,
        required_fields: requiredFields,
        unlock_after_question_ids: unlockAfterQuestions,
        quality_checks: qualityChecks
      },
      current_status: {
        fields_present: fieldsPresent,
        fields_total: requiredFields.length,
        questions_answered: questionsAnswered,
        questions_total: unlockAfterQuestions.length,
        questions_met: Math.max(fieldsPresent, questionsAnswered),
        progress_met: progressMet,
        quality_passed: allQualityPassed,
        can_unlock: progressMet && questionsMet && allQualityPassed
      },
      fields_status: fieldsStatus,
      questions_status: questionsStatus,
      quality_status: qualityStatus
    };
  });

  // Build question status
  const questionStatus = assistantConfig.questions.map(question => {
    const data = collectedData[question.id];
    // Note: confidence is not stored in DB, so we check if data exists (meaning it was extracted with confidence > 0)
    const hasAnswer = !!(data && data.normalized_value);
    return {
      question_id: question.id,
      question_template: question.question_template,
      type: question.type,
      required: question.required || false,
      answered: hasAnswer,
      confidence: data?.confidence || (hasAnswer ? 0.75 : 0), // Default to 0.75 if we have data (it was extracted)
      raw_answer: data?.raw_answer || null,
      normalized_value: data?.normalized_value || null,
      extracted_context: data?.extracted_context || null
    };
  });
  
  console.log(`[DEBUG] getDebugInfo: Found ${questionStatus.filter(q => q.answered).length} answered questions out of ${questionStatus.length} total`);
  console.log(`[DEBUG] getDebugInfo: Collected data keys:`, Object.keys(collectedData));

  return {
    session_id: sessionId,
    funnel_id: session.selected_funnel.id,
    progress: progress,
    total_questions: assistantConfig.questions.length,
    required_questions: assistantConfig.questions.filter(q => q.required).length,
    questions_answered: questionStatus.filter(q => q.answered).length,
    question_status: questionStatus,
    component_analysis: componentAnalysis,
    collected_data_summary: {
      total_fields: Object.keys(collectedData).length,
      fields_with_answers: Object.keys(collectedData).filter(k => collectedData[k]?.normalized_value).length,
      average_confidence: Object.values(collectedData)
        .filter(d => d && d.confidence !== undefined)
        .reduce((sum, d) => sum + d.confidence, 0) / Object.values(collectedData).filter(d => d && d.confidence !== undefined).length || 0
    }
  };
}

export async function startUpgradeMode(sessionId, componentId) {
  const session = await conversationModel.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const assistantConfig = getAssistantConfig(session.selected_funnel.id);
  const collectedData = await conversationModel.getCollectedData(sessionId);

  // Load component requirements
  const componentRequirementsPath = path.join(
    __dirname,
    '../../config/component-requirements.json'
  );
  const componentRequirements = JSON.parse(fs.readFileSync(componentRequirementsPath, 'utf-8'));
  const requirements = componentRequirements[session.selected_funnel.id]?.components[componentId];

  if (!requirements) {
    throw new Error(`Component requirements not found: ${componentId}`);
  }

  // Find missing questions
  const requiredFields = requirements.required_fields || [];
  const unlockAfterQuestions = requirements.unlock_after_question_ids || [];
  const allRequiredQuestions = [...new Set([...requiredFields, ...unlockAfterQuestions])];

  const missingQuestions = allRequiredQuestions.filter(qId => {
    const data = collectedData[qId];
    return !data || !data.normalized_value;
  });

  if (missingQuestions.length === 0) {
    // All questions answered, check quality
    const progress = calculateProgress(collectedData, assistantConfig);
    const componentStatus = checkComponentUnlocks(collectedData, assistantConfig, progress);
    
    if (componentStatus.unlocked.includes(componentId)) {
      return {
        success: true,
        message: 'Component is already unlocked!',
        component_id: componentId,
        questions_needed: 0
      };
    }
    
    // Quality issue - need better answers
    // Check which quality checks are failing
    const qualityChecks = requirements.quality_checks || {};
    const failingChecks = [];
    
    for (const [fieldId, checkType] of Object.entries(qualityChecks)) {
      const fieldData = collectedData[fieldId];
      if (!fieldData || !fieldData.raw_answer) {
        failingChecks.push({ field: fieldId, check: checkType, reason: 'Missing answer' });
        continue;
      }
      
      // Re-run the quality check to see why it failed
      const answer = String(fieldData.raw_answer).toLowerCase();
      const wordCount = answer.split(/\s+/).filter(w => w.length > 0).length;
      
      let passed = false;
      switch (checkType) {
        case 'must_be_detailed':
          passed = wordCount >= 10;
          if (!passed) failingChecks.push({ field: fieldId, check: checkType, reason: `Answer too short (${wordCount} words, need 10+)` });
          break;
        case 'must_be_urgent_for_quick_wins':
          const urgentWords = /(urgent|immediate|asap|soon|quick|now|this month|this week|next month|december|january|february|march|april|may|june|july|august|september|october|november|start|launch|by|within|in \d+ (week|month|day))/i;
          passed = urgentWords.test(fieldData.raw_answer);
          if (!passed) failingChecks.push({ field: fieldId, check: checkType, reason: 'Answer does not indicate urgency or specific timeframe' });
          break;
        case 'must_be_specific_range':
        case 'must_be_specific_number_or_range':
          passed = /(\$?\d+|budget|thousand|k\b|scale|spend|invest)/i.test(fieldData.raw_answer);
          if (!passed) failingChecks.push({ field: fieldId, check: checkType, reason: 'Answer does not include specific numbers or budget range' });
          break;
        default:
          passed = true;
      }
    }
    
    // Create a helpful message for Zansei to ask follow-up questions
    const componentConfig = assistantConfig.report_components.find(c => c.id === componentId);
    const componentName = componentConfig?.name || componentId;
    
    let qualityMessage = `The user wants to unlock the "${componentName}" report component. All required questions are answered, but the answers need more detail to generate a quality report.\n\n`;
    qualityMessage += `Quality issues found:\n${failingChecks.map(fc => `- ${fc.field}: ${fc.reason}`).join('\n')}\n\n`;
    qualityMessage += `I should ask follow-up questions to get more detailed answers. For example:\n`;
    failingChecks.forEach(fc => {
      const questionConfig = assistantConfig.questions.find(q => q.id === fc.field);
      if (questionConfig) {
        qualityMessage += `- For "${questionConfig.question_template}": Ask for more specific details\n`;
      }
    });
    qualityMessage += `\nBe warm and helpful - explain that I need a bit more detail to create their personalized report.`;
    
    // Update session with upgrade mode for quality improvement
    await conversationModel.updateSession(sessionId, {
      upgrade_mode: JSON.stringify({
        active: true,
        target_component: componentId,
        questions_needed: [], // No new questions, just need better quality
        quality_issues: failingChecks,
        questions_answered: []
      })
    });
    
    // Send upgrade context message to assistant
    const assistantId = openaiService.getAssistantId(session.selected_funnel.id);
    const upgradeResponse = await openaiService.sendMessage(
      session.openai_thread_id,
      assistantId,
      qualityMessage
    );
    
    // Save assistant's response
    await conversationModel.addConversationMessage(sessionId, {
      role: 'assistant',
      content: upgradeResponse
    });
    
    return {
      success: true,
      message: upgradeResponse, // Return Zansei's helpful response
      component_id: componentId,
      questions_needed: 0,
      quality_issues: failingChecks
    };
  }

  // Get question configs for missing questions
  const missingQuestionConfigs = missingQuestions
    .map(qId => {
      const question = assistantConfig.questions.find(q => q.id === qId);
      if (!question) {
        console.warn(`[WARN] Question ${qId} not found in assistant config for funnel ${session.selected_funnel.id}`);
      }
      return question;
    })
    .filter(q => q);

  // Check if we found any question configs
  if (missingQuestionConfigs.length === 0 && missingQuestions.length > 0) {
    console.error(`[ERROR] No question configs found for missing questions: ${missingQuestions.join(', ')}`);
    throw new Error(`Cannot find question configurations for: ${missingQuestions.join(', ')}. The assistant may not have these questions defined.`);
  }

  console.log(`[DEBUG] startUpgradeMode: component=${componentId}, missingQuestions=${missingQuestions.length}, foundConfigs=${missingQuestionConfigs.length}`);

  // Update session with upgrade mode
  await conversationModel.updateSession(sessionId, {
    upgrade_mode: JSON.stringify({
      active: true,
      target_component: componentId,
      questions_needed: missingQuestions,
      questions_answered: []
    })
  });

  // Get component name
  const componentConfig = assistantConfig.report_components.find(c => c.id === componentId);
  const componentName = componentConfig?.name || componentId;

  if (!componentConfig) {
    console.warn(`[WARN] Component ${componentId} not found in report_components, using ID as name`);
  }

  // Create upgrade context message
  const firstQuestion = missingQuestionConfigs[0];
  if (!firstQuestion) {
    throw new Error(`No valid question configs found for missing questions: ${missingQuestions.join(', ')}`);
  }

  const upgradeContext = `The user wants to unlock the "${componentName}" report component. To do this, I need to ask ${missingQuestions.length} more question(s).

Missing questions: ${missingQuestionConfigs.map(q => q.question_template || q.id).join(', ')}

I should:
1. Acknowledge their request: "Great! To create your ${componentName}, I need ${missingQuestions.length} more quick question(s)."
2. Ask the first missing question: "${firstQuestion.question_template || firstQuestion.id}"
3. Keep it brief and focused - don't re-ask things I already know
4. Reference their previous answers when relevant

Start by acknowledging and asking the first missing question.`;

  const assistantId = openaiService.getAssistantId(session.selected_funnel.id);
  if (!assistantId) {
    throw new Error(`Assistant not initialized for funnel: ${session.selected_funnel.id}`);
  }

  console.log(`[DEBUG] Sending upgrade context to assistant: ${upgradeContext.substring(0, 200)}...`);
  
  const upgradeMessage = await openaiService.sendMessage(
    session.openai_thread_id,
    assistantId,
    upgradeContext
  );

  await conversationModel.addConversationMessage(sessionId, {
    role: 'assistant',
    content: upgradeMessage
  });

  return {
    success: true,
    message: upgradeMessage,
    component_id: componentId,
    component_name: componentName,
    questions_needed: missingQuestions.length,
    questions_list: missingQuestionConfigs.map(q => ({
      id: q.id,
      question: q.question_template || q.id
    }))
  };
}

