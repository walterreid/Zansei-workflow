import { getDatabase } from './database.js';
import { promisify } from 'util';
import { randomUUID } from 'crypto';

function getRun() {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized. Call initializeDatabase() first.');
  return promisify(db.run.bind(db));
}

function getGet() {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized. Call initializeDatabase() first.');
  return promisify(db.get.bind(db));
}

export async function createReport(sessionId, reportData, status = 'generating') {
  const run = getRun();
  const reportId = randomUUID();

  await run(
    `INSERT INTO reports (report_id, session_id, report_data, status)
     VALUES (?, ?, ?, ?)`,
    [reportId, sessionId, JSON.stringify(reportData), status]
  );

  return reportId;
}

export async function getReport(reportId) {
  const get = getGet();
  const report = await get('SELECT * FROM reports WHERE report_id = ?', [reportId]);

  if (!report) return null;

  return {
    ...report,
    report_data: JSON.parse(report.report_data),
    status: report.status
  };
}

export async function getReportBySessionId(sessionId) {
  const get = getGet();
  const report = await get(
    'SELECT * FROM reports WHERE session_id = ? ORDER BY created_at DESC LIMIT 1',
    [sessionId]
  );

  if (!report) return null;

  return {
    ...report,
    report_data: JSON.parse(report.report_data),
    status: report.status
  };
}

export async function updateReportStatus(reportId, status, reportData = null) {
  const run = getRun();
  
  if (reportData) {
    await run(
      `UPDATE reports 
       SET status = ?, report_data = ?, updated_at = CURRENT_TIMESTAMP
       WHERE report_id = ?`,
      [status, JSON.stringify(reportData), reportId]
    );
  } else {
    await run(
      `UPDATE reports 
       SET status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE report_id = ?`,
      [status, reportId]
    );
  }
}

