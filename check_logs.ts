import Database from 'better-sqlite3';
const db = new Database('ollama-webui.db');
try {
  const logs = db.prepare('SELECT * FROM chat_logs').all();
  console.log('LOGS:', logs);
} catch (e) {
  console.error('ERROR:', e);
}
