import Database from 'better-sqlite3';
const db = new Database('ollama-webui.db');
try {
  const users = db.prepare('SELECT * FROM users').all();
  console.log('USERS:', users);
} catch (e) {
  console.error('ERROR:', e);
}
