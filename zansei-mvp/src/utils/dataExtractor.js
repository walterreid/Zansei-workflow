import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// normalizeAnswer function removed - AI extraction now handles all normalization intelligently
// The extractStructuredData function in openai.service.js returns pre-normalized values

export function assessAnswerQuality(collectedData) {
  // Calculate quality per answer, then average
  const answerScores = [];
  
  for (const [key, value] of Object.entries(collectedData)) {
    if (!value || !value.raw_answer) continue;
    
    let answerScore = 100; // Start each answer at 100
    const rawAnswer = String(value.raw_answer).trim();
    const wordCount = rawAnswer.split(/\s+/).filter(w => w.length > 0).length;

    // Penalty for overly short answers
    if (wordCount < 5) {
      answerScore -= 10;
    }

    // Penalty for vague answers (but be lenient - "maybe" in context is fine)
    const vagueIndicators = ['not sure', 'i guess', 'idk', 'dunno'];
    if (vagueIndicators.some(v => rawAnswer.toLowerCase().includes(v))) {
      answerScore -= 5;
    }

    // Penalty for single-word answers (unless it's a select question)
    if (wordCount === 1 && rawAnswer.length < 20) {
      answerScore -= 8;
    }

    // Bonus for detailed answers
    if (wordCount > 20) {
      answerScore += 5;
    }

    // Bonus for answers with specific examples or numbers
    if (/\d+/.test(rawAnswer) || rawAnswer.includes('like') || rawAnswer.includes('example')) {
      answerScore += 3;
    }
    
    // Bonus for high confidence scores from AI extraction
    if (value.confidence && value.confidence >= 0.75) {
      answerScore += 5;
    }
    
    // Clamp individual answer score
    answerScore = Math.max(Math.min(answerScore, 100), 50);
    answerScores.push(answerScore);
  }

  // Calculate average quality score
  if (answerScores.length === 0) {
    return 50; // Default to minimum if no answers
  }
  
  const averageScore = answerScores.reduce((sum, score) => sum + score, 0) / answerScores.length;
  return Math.round(Math.max(Math.min(averageScore, 100), 50)); // Clamp between 50 and 100
}

function loadComponentRequirements(funnelId) {
  try {
    const requirementsPath = path.join(__dirname, `../../config/component-requirements.json`);
    const requirements = JSON.parse(fs.readFileSync(requirementsPath, 'utf-8'));
    return requirements[funnelId]?.components || {};
  } catch (error) {
    console.warn('Could not load component requirements:', error.message);
    return {};
  }
}

export function checkComponentUnlocks(collectedData, assistantConfig, progress = null) {
  const unlocked = new Set();
  const partial = new Set();
  const componentRequirements = loadComponentRequirements(assistantConfig.funnel_id);

  // Get current progress if not provided
  if (!progress) {
    progress = calculateProgress(collectedData, assistantConfig);
  }

  for (const component of assistantConfig.report_components) {
    const componentId = component.id;
    const requirements = componentRequirements[componentId];
    
    // If no requirements defined, fall back to simple check
    if (!requirements) {
      const unlockConditions = component.unlock_conditions || [];
      const allConditionsMet = unlockConditions.every(questionId => {
        return collectedData[questionId] && collectedData[questionId].normalized_value;
      });
      if (allConditionsMet) {
        unlocked.add(componentId);
      }
      continue;
    }

    // Check minimum progress threshold (but log for debugging)
    const minProgressThreshold = requirements.min_unlock_at_progress || 0;
    if (progress.percentage < minProgressThreshold) {
      console.log(`[DEBUG] Component ${componentId}: Skipped - progress ${progress.percentage}% < ${minProgressThreshold}%`);
      continue; // Component cannot unlock yet
    }

    // Check dependencies
    if (requirements.dependencies && requirements.dependencies.length > 0) {
      const allDependenciesMet = requirements.dependencies.every(depId => {
        return unlocked.has(depId);
      });
      if (!allDependenciesMet) {
        continue; // Dependencies not met
      }
    }

    // Check required fields
    const requiredFields = requirements.required_fields || [];
    const fieldsPresent = requiredFields.filter(fieldId => {
      return collectedData[fieldId] && collectedData[fieldId].normalized_value;
    });

    // Check unlock_after_question_ids
    const unlockAfterQuestions = requirements.unlock_after_question_ids || [];
    const questionsAnswered = unlockAfterQuestions.filter(qId => {
      return collectedData[qId] && collectedData[qId].normalized_value;
    });

    // Check minimum questions required
    const minQuestionsRequired = requirements.min_questions_required || 1;
    // Use the higher of: required fields present OR questions from unlock_after list
    // But also check if we have at least minQuestionsRequired from either list
    const questionsMet = Math.max(
      fieldsPresent.length, 
      questionsAnswered.length,
      Math.min(fieldsPresent.length + questionsAnswered.length, minQuestionsRequired)
    );

    // Quality checks
    let qualityPassed = true;
    if (requirements.quality_checks) {
      for (const [fieldId, checkType] of Object.entries(requirements.quality_checks)) {
        const fieldData = collectedData[fieldId];
        if (!fieldData || !fieldData.raw_answer) {
          qualityPassed = false;
          break;
        }

        const answer = String(fieldData.raw_answer).toLowerCase();
        const wordCount = answer.split(/\s+/).filter(w => w.length > 0).length;

        switch (checkType) {
          case 'must_be_detailed':
            if (wordCount < 10) qualityPassed = false;
            break;
          case 'must_be_specific_range':
          case 'must_be_specific_number_or_range':
            // More flexible: check for numbers, dollar signs, or budget-related words
            if (!/(\$?\d+|budget|thousand|k\b|scale|spend|invest)/i.test(fieldData.raw_answer)) {
              qualityPassed = false;
            }
            break;
          case 'must_be_specific_location':
            if (wordCount < 3) qualityPassed = false;
            break;
          case 'must_be_measurable':
            if (wordCount < 5) qualityPassed = false;
            break;
          case 'must_be_specific_date_or_timeframe':
            // Check for date-related words or timeframes
            const dateWords = /(december|january|february|march|april|may|june|july|august|september|october|november|month|week|day|start|launch|timeline|by|in|when)/i;
            if (!dateWords.test(fieldData.raw_answer)) {
              qualityPassed = false;
            }
            break;
          case 'must_be_urgent_for_quick_wins':
            // Check for urgent words OR specific timeframes (december, january, next month, etc.)
            const urgentWords = /(urgent|immediate|asap|soon|quick|now|this month|this week|next month|december|january|february|march|april|may|june|july|august|september|october|november|start|launch|by|within|in \d+ (week|month|day))/i;
            if (!urgentWords.test(fieldData.raw_answer)) {
              qualityPassed = false;
            }
            break;
          case 'must_explain_frequency_and_platforms':
            if (!/(daily|weekly|monthly|sometimes|often|never|facebook|instagram|google|website)/i.test(answer)) {
              qualityPassed = false;
            }
            break;
          case 'must_explain_results':
            if (!/(work|result|help|customer|traffic|sale|lead)/i.test(answer)) {
              qualityPassed = false;
            }
            break;
          case 'must_inventory_content':
            if (wordCount < 5) qualityPassed = false;
            break;
          case 'must_assess_baseline':
            if (wordCount < 5) qualityPassed = false;
            break;
        }
      }
    }

    // Determine component status
    // For unlocking, we need:
    // 1. Progress threshold met (already checked above)
    // 2. At least minQuestionsRequired questions answered (from either required_fields OR unlock_after_question_ids)
    // 3. Quality checks passed
    
    // Count how many questions we have from the unlock list
    const questionsFromUnlockList = questionsAnswered.length;
    // Count how many required fields we have
    const requiredFieldsCount = fieldsPresent.length;
    // Use the better of the two, but need at least minQuestionsRequired
    const totalQuestionsMet = Math.max(questionsFromUnlockList, requiredFieldsCount);
    
    // Get progress threshold
    const minProgress = requirements.min_unlock_at_progress || 0;
    
    // Check if progress threshold is met
    const progressMet = progress.percentage >= minProgress;
    
    // Debug logging
    console.log(`[DEBUG] Component ${componentId}: questionsFromUnlockList=${questionsFromUnlockList}, requiredFieldsCount=${requiredFieldsCount}, totalQuestionsMet=${totalQuestionsMet}/${minQuestionsRequired}, qualityPassed=${qualityPassed}, progressMet=${progressMet} (${progress.percentage}% >= ${minProgress}%)`);
    
    if (totalQuestionsMet >= minQuestionsRequired && qualityPassed && progressMet) {
      unlocked.add(componentId);
      console.log(`[DEBUG] ✅ UNLOCKED: ${componentId}`);
    } else if (totalQuestionsMet >= Math.floor(minQuestionsRequired * 0.6) && progressMet) {
      // Partial unlock (60% of required questions)
      partial.add(componentId);
      console.log(`[DEBUG] ⚠️  PARTIAL: ${componentId} (${totalQuestionsMet}/${minQuestionsRequired} questions, quality: ${qualityPassed})`);
    } else {
      const reason = [];
      if (totalQuestionsMet < minQuestionsRequired) reason.push(`questions: ${totalQuestionsMet}/${minQuestionsRequired}`);
      if (!qualityPassed) reason.push('quality failed');
      if (!progressMet) reason.push(`progress: ${progress.percentage}% < ${minProgress}%`);
      console.log(`[DEBUG] 🔒 LOCKED: ${componentId} (${reason.join(', ')})`);
    }
  }

  return {
    unlocked: Array.from(unlocked),
    partial: Array.from(partial),
    locked: assistantConfig.report_components
      .map(c => c.id)
      .filter(id => !unlocked.has(id) && !partial.has(id))
  };
}

export function calculateProgress(collectedData, assistantConfig) {
  // Count ALL questions (not just required) for progress calculation
  const allQuestions = assistantConfig.questions || [];
  const total = allQuestions.length;
  const answered = allQuestions.filter(q => {
    const data = collectedData[q.id];
    return data && data.normalized_value;
  }).length;

  // Base progress on questions answered
  let progress = total > 0 ? (answered / total) * 100 : 0;

  // Apply quality assessment (but don't penalize progress harshly)
  const qualityScore = assessAnswerQuality(collectedData);
  console.log(`[DEBUG] calculateProgress: qualityScore=${qualityScore}%, answered=${answered}/${total}`);
  
  // Only apply quality penalty if quality is very low (< 50)
  // For quality >= 50, don't penalize - the answers are good enough
  if (qualityScore < 50) {
    progress = progress * (qualityScore / 100);
  } else if (qualityScore >= 80) {
    // For high quality, add a small bonus
    progress = Math.min(progress * 1.05, 100);
  }
  // For quality 50-79, use progress as-is (no penalty, no bonus)

  // Enforce minimum question requirement (8 questions minimum for completion)
  const minQuestionsRequired = 8;
  const requiredQuestions = assistantConfig.questions.filter(q => q.required);
  const requiredAnswered = requiredQuestions.filter(q => {
    const data = collectedData[q.id];
    return data && data.normalized_value;
  }).length;

  // Don't cap progress too harshly - allow progress to reflect actual answers
  // Only cap if we have very few answers
  if (answered < 3) {
    progress = Math.min(progress, 30); // Cap at 30% if less than 3 answers
  }

  const percentage = Math.round(Math.min(progress, 100));
  const isComplete = answered >= minQuestionsRequired && requiredAnswered >= requiredQuestions.length && percentage >= 80;

  return {
    questions_answered: answered,
    questions_total: total,
    required_answered: requiredAnswered,
    required_total: requiredQuestions.length,
    percentage,
    is_complete: isComplete,
    quality_score: Math.round(qualityScore)
  };
}

