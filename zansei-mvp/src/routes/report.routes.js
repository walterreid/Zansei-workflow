import express from 'express';
import * as reportService from '../services/report.service.js';
import * as componentReportService from '../services/component-report.service.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// POST /api/report/generate-html/:componentId
router.post('/generate-html/:componentId', async (req, res) => {
  try {
    const { componentId } = req.params;
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({
        error: 'Missing required field: session_id'
      });
    }

    const result = await componentReportService.generateComponentReport(session_id, componentId);

    res.json({
      success: true,
      filename: result.filename,
      component_id: result.component_id,
      component_name: result.component_name,
      view_url: `/api/report/view/${result.filename}`,
      download_url: `/api/report/download/${result.filename}`
    });
  } catch (error) {
    console.error('Error generating HTML report:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/report/view/:filename
router.get('/view/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const reportsDir = path.join(__dirname, '../../generated_reports');
    const filepath = path.join(reportsDir, filename);

    console.log(`[DEBUG] View report request: filename=${filename}`);
    console.log(`[DEBUG] Looking for file at: ${filepath}`);

    // Security: prevent directory traversal - allow alphanumeric, dots, dashes, underscores, and .html extension
    // Match: report-component_id-sessionid-timestamp.html
    if (!filename.match(/^[a-zA-Z0-9._-]+\.html$/)) {
      console.error(`[ERROR] Invalid filename format: ${filename}`);
      return res.status(400).json({ error: 'Invalid filename format' });
    }
    
    // Additional security: ensure filename doesn't contain path separators
    if (filename.includes('/') || filename.includes('\\')) {
      console.error(`[ERROR] Filename contains path separators: ${filename}`);
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filepath)) {
      console.error(`[ERROR] Report file not found: ${filepath}`);
      return res.status(404).send(`Report not found: ${filename}`);
    }

    console.log(`[DEBUG] Sending report file: ${filepath}`);
    res.setHeader('Content-Type', 'text/html');
    res.sendFile(filepath);
  } catch (error) {
    console.error('[ERROR] Error viewing report:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/report/download/:filename
router.get('/download/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const reportsDir = path.join(__dirname, '../../generated_reports');
    const filepath = path.join(reportsDir, filename);

    // Security: prevent directory traversal
    if (!filename.match(/^[a-zA-Z0-9._-]+$/)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).send('Report not found');
    }

    res.download(filepath, filename);
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

