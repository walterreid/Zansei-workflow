import express from 'express';
import * as conversationService from '../services/conversation.service.js';

const router = express.Router();

// POST /api/conversation/start
router.post('/start', async (req, res) => {
  try {
    const { bubble_answers, selected_funnel_id } = req.body;

    if (!bubble_answers || !selected_funnel_id) {
      return res.status(400).json({
        error: 'Missing required fields: bubble_answers and selected_funnel_id'
      });
    }

    const result = await conversationService.initializeConversation(
      bubble_answers,
      selected_funnel_id
    );

    res.json(result);
  } catch (error) {
    console.error('Error starting conversation:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/conversation/message
router.post('/message', async (req, res) => {
  try {
    const { session_id, message } = req.body;

    if (!session_id || !message) {
      return res.status(400).json({
        error: 'Missing required fields: session_id and message'
      });
    }

    const result = await conversationService.sendMessage(session_id, message);

    res.json(result);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/conversation/:sessionId/debug (must come before /:sessionId)
router.get('/:sessionId/debug', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const debugInfo = await conversationService.getDebugInfo(sessionId);

    res.json(debugInfo);
  } catch (error) {
    console.error('Error getting debug info:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/conversation/:sessionId
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const state = await conversationService.getConversationState(sessionId);

    res.json(state);
  } catch (error) {
    console.error('Error getting conversation state:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/conversation/upgrade-component
router.post('/upgrade-component', async (req, res) => {
  try {
    const { session_id, component_id } = req.body;

    console.log(`[DEBUG] Upgrade component request: session_id=${session_id}, component_id=${component_id}`);

    if (!session_id || !component_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: session_id and component_id'
      });
    }

    const result = await conversationService.startUpgradeMode(session_id, component_id);
    console.log(`[DEBUG] Upgrade mode started successfully: component=${component_id}, questions_needed=${result.questions_needed || 0}`);

    res.json(result);
  } catch (error) {
    console.error('[ERROR] Error starting upgrade mode:', error);
    console.error('[ERROR] Stack:', error.stack);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router;

