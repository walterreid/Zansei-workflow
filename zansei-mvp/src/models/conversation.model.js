import { getDatabase } from './database.js';
import { promisify } from 'util';

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

function getAll() {
  const db = getDatabase();
  if (!db) throw new Error('Database not initialized. Call initializeDatabase() first.');
  return promisify(db.all.bind(db));
}

export async function createSession(sessionData) {
  const run = getRun();
  const {
    session_id,
    user_id,
    bubble_answers,
    selected_funnel,
    openai_thread_id,
    openai_assistant_id,
    unlocked_components = [],
    progress = { questions_answered: 0, questions_total: 0, percentage: 0, is_complete: false }
  } = sessionData;

  await run(
    `INSERT INTO sessions (
      session_id, user_id, bubble_answers, selected_funnel, 
      openai_thread_id, openai_assistant_id, unlocked_components, progress
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      session_id,
      user_id || null,
      JSON.stringify(bubble_answers),
      JSON.stringify(selected_funnel),
      openai_thread_id,
      openai_assistant_id,
      JSON.stringify(unlocked_components),
      JSON.stringify(progress)
    ]
  );

  return sessionData;
}

export async function getSession(sessionId) {
  const get = getGet();
  const session = await get('SELECT * FROM sessions WHERE session_id = ?', [sessionId]);
  
  if (!session) return null;

  return {
    ...session,
    bubble_answers: JSON.parse(session.bubble_answers),
    selected_funnel: JSON.parse(session.selected_funnel),
    unlocked_components: JSON.parse(session.unlocked_components || '[]'),
    progress: JSON.parse(session.progress || '{}'),
    is_complete: Boolean(session.is_complete)
  };
}

export async function updateSession(sessionId, updates) {
  const run = getRun();
  const fields = [];
  const values = [];

  if (updates.openai_thread_id !== undefined) {
    fields.push('openai_thread_id = ?');
    values.push(updates.openai_thread_id);
  }
  if (updates.unlocked_components !== undefined) {
    fields.push('unlocked_components = ?');
    values.push(JSON.stringify(updates.unlocked_components));
  }
  if (updates.progress !== undefined) {
    fields.push('progress = ?');
    values.push(JSON.stringify(updates.progress));
  }
  if (updates.is_complete !== undefined) {
    fields.push('is_complete = ?');
    values.push(updates.is_complete ? 1 : 0);
  }

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(sessionId);

  if (fields.length > 1) {
    await run(
      `UPDATE sessions SET ${fields.join(', ')} WHERE session_id = ?`,
      values
    );
  }
}

export async function addConversationMessage(sessionId, message) {
  const run = getRun();
  const { role, content, question_id } = message;

  await run(
    `INSERT INTO conversations (session_id, role, content, question_id)
     VALUES (?, ?, ?, ?)`,
    [sessionId, role, content, question_id || null]
  );
}

export async function getConversationHistory(sessionId) {
  const all = getAll();
  const messages = await all(
    'SELECT * FROM conversations WHERE session_id = ? ORDER BY timestamp ASC',
    [sessionId]
  );

  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
    question_id: msg.question_id,
    timestamp: msg.timestamp
  }));
}

export async function saveCollectedData(sessionId, questionId, rawAnswer, normalizedValue) {
  const run = getRun();
  
  // Check if data already exists for this question
  const get = getGet();
  const existing = await get(
    'SELECT id FROM collected_data WHERE session_id = ? AND question_id = ?',
    [sessionId, questionId]
  );

  if (existing) {
    await run(
      `UPDATE collected_data 
       SET raw_answer = ?, normalized_value = ?, timestamp = CURRENT_TIMESTAMP
       WHERE session_id = ? AND question_id = ?`,
      [rawAnswer, normalizedValue, sessionId, questionId]
    );
  } else {
    await run(
      `INSERT INTO collected_data (session_id, question_id, raw_answer, normalized_value)
       VALUES (?, ?, ?, ?)`,
      [sessionId, questionId, rawAnswer, normalizedValue]
    );
  }
}

export async function getCollectedData(sessionId) {
  const all = getAll();
  const data = await all(
    'SELECT * FROM collected_data WHERE session_id = ?',
    [sessionId]
  );

  const result = {};
  for (const row of data) {
    result[row.question_id] = {
      raw_answer: row.raw_answer,
      normalized_value: row.normalized_value,
      question_id: row.question_id
    };
  }

  return result;
}

