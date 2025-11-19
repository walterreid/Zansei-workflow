import { randomUUID } from 'crypto';
import * as conversationModel from '../models/conversation.model.js';
import * as openaiService from './openai.service.js';
import { buildSystemPrompt, getAssistantConfig } from '../utils/promptBuilder.js';
import { normalizeAnswer, checkComponentUnlocks, calculateProgress } from '../utils/dataExtractor.js';
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

  // Build system prompt with bubble answers
  const systemPrompt = buildSystemPrompt(bubbleAnswers, assistantConfig);

  // Get assistant ID
  const assistantId = openaiService.getAssistantId('brand_awareness');
  if (!assistantId) {
    throw new Error('Assistant not initialized. Call initializeAssistants() first.');
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

  // Send initial message to start conversation
  const initialContext = `You are helping a ${bubbleAnswers.business_type?.value || bubbleAnswers.business_type} business in ${bubbleAnswers.geography?.value || bubbleAnswers.geography} with brand awareness.

Business Context:
- Business Type: ${bubbleAnswers.business_type?.value || bubbleAnswers.business_type}
- Geography: ${bubbleAnswers.geography?.value || bubbleAnswers.geography}
- Marketing Maturity: ${bubbleAnswers.marketing_maturity?.value || bubbleAnswers.marketing_maturity}

Start the conversation by greeting them warmly and asking your first question about their monthly marketing budget for building brand awareness. Be empathetic - they feel invisible, so be encouraging.`;

  // Update assistant with custom system prompt for this session
  // Note: In production, you might want to create a new assistant per session or use a different approach
  // For MVP, we'll include context in the initial message
  const firstMessage = await openaiService.sendMessage(
    threadId,
    assistantId,
    initialContext
  );

  // Save assistant's first message
  await conversationModel.addConversationMessage(sessionId, {
    role: 'assistant',
    content: firstMessage
  });

  return {
    session_id: sessionId,
    thread_id: threadId,
    first_message: firstMessage,
    progress: sessionData.progress,
    unlocked_components: []
  };
}

export async function sendMessage(sessionId, userMessage) {
  // Get session
  const session = await conversationModel.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (session.is_complete) {
    return {
      response: "I already have all the information I need to create your brand awareness strategy. Would you like me to generate your report now?",
      progress: session.progress,
      unlocked_components: session.unlocked_components,
      is_complete: true
    };
  }

  // Get assistant config
  const assistantConfig = getAssistantConfig(session.selected_funnel.id);

  // Get assistant ID
  const assistantId = openaiService.getAssistantId('brand_awareness');

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

  // Extract structured data from conversation
  const conversationHistory = await conversationModel.getConversationHistory(sessionId);
  const extractedData = await openaiService.extractStructuredData(
    conversationHistory,
    assistantConfig
  );

  // Save collected data
  for (const [questionId, data] of Object.entries(extractedData)) {
    if (data && data.normalized_value) {
      const questionConfig = assistantConfig.questions.find(q => q.id === questionId);
      if (questionConfig) {
        const normalized = normalizeAnswer(data.raw_answer, questionConfig);
        await conversationModel.saveCollectedData(
          sessionId,
          questionId,
          data.raw_answer,
          normalized || data.normalized_value
        );
      }
    }
  }

  // Get all collected data
  const allCollectedData = await conversationModel.getCollectedData(sessionId);

  // Check component unlocks
  const unlockedComponents = checkComponentUnlocks(allCollectedData, assistantConfig);

  // Calculate progress
  const progress = calculateProgress(allCollectedData, assistantConfig);

  // Update session
  await conversationModel.updateSession(sessionId, {
    unlocked_components: unlockedComponents,
    progress: progress,
    is_complete: progress.is_complete
  });

  return {
    response: assistantResponse,
    progress: progress,
    unlocked_components: unlockedComponents,
    is_complete: progress.is_complete,
    collected_data: allCollectedData
  };
}

export async function getConversationState(sessionId) {
  const session = await conversationModel.getSession(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const conversation = await conversationModel.getConversationHistory(sessionId);
  const collectedData = await conversationModel.getCollectedData(sessionId);

  return {
    session_id: sessionId,
    bubble_answers: session.bubble_answers,
    selected_funnel: session.selected_funnel,
    conversation: conversation,
    collected_data: collectedData,
    unlocked_components: session.unlocked_components,
    progress: session.progress,
    is_complete: session.is_complete
  };
}

