import express from 'express';
import * as reportService from '../services/report.service.js';

const router = express.Router();

// POST /api/report/generate
router.post('/generate', async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({
        error: 'Missing required field: session_id'
      });
    }

    const result = await reportService.generateReport(session_id);

    res.json(result);
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/report/:reportId
router.get('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await reportService.getReport(reportId);

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error getting report:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/report/session/:sessionId
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const report = await reportService.getReportBySession(sessionId);

    if (!report) {
      return res.status(404).json({ error: 'Report not found for this session' });
    }

    res.json(report);
  } catch (error) {
    console.error('Error getting report by session:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

