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

export default router;

