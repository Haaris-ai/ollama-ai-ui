import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import google from 'googlethis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || 'ollama-webui.db';
const db = new Database(dbPath);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    is_blocked INTEGER DEFAULT 0,
    block_reason TEXT,
    block_expires_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

try {
  db.exec("ALTER TABLE users ADD COLUMN is_blocked INTEGER DEFAULT 0");
} catch (e) {
  // Column might already exist
}
try {
  db.exec("ALTER TABLE users ADD COLUMN block_reason TEXT");
  db.exec("ALTER TABLE users ADD COLUMN block_expires_at INTEGER");
} catch (e) {
  // Columns might already exist
}

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

app.use(express.json());
app.use(cookieParser());

// Middleware to verify JWT
const authenticateToken = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return res.status(403).json({ error: 'Forbidden' });
    
    const stmt = db.prepare('SELECT id, username, role, is_blocked, block_reason, block_expires_at FROM users WHERE id = ?');
    const user = stmt.get(decoded.id) as any;
    
    if (!user) return res.status(401).json({ error: 'User not found' });
    
    if (user.is_blocked) {
      if (user.block_expires_at && Date.now() > user.block_expires_at) {
        // Auto-unblock if time expired
        db.prepare('UPDATE users SET is_blocked = 0, block_reason = NULL, block_expires_at = NULL WHERE id = ?').run(user.id);
        user.is_blocked = 0;
      } else {
        return res.status(403).json({ error: 'Account is blocked by admin' });
      }
    }
    
    req.user = user;
    next();
  });
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// Auth Routes
app.post('/api/auth/register', async (req: any, res: any) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const countStmt = db.prepare('SELECT COUNT(*) as count FROM users');
    const { count } = countStmt.get() as any;
    const role = count === 0 ? 'admin' : 'user';

    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
    const info = stmt.run(username, hashedPassword, role);
    
    const token = jwt.sign({ id: info.lastInsertRowid, username, role }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
    res.json({ message: 'Registered successfully', user: { id: info.lastInsertRowid, username, role } });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req: any, res: any) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const user = stmt.get(username) as any;

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (user.is_blocked) {
    if (user.block_expires_at && Date.now() > user.block_expires_at) {
      // Auto-unblock if time expired
      db.prepare('UPDATE users SET is_blocked = 0, block_reason = NULL, block_expires_at = NULL WHERE id = ?').run(user.id);
      user.is_blocked = 0;
    } else {
      let errorMsg = 'Your account has been blocked by an admin.';
      if (user.block_reason) errorMsg += `\nReason: ${user.block_reason}`;
      if (user.block_expires_at) {
        const expiresDate = new Date(user.block_expires_at).toLocaleString();
        errorMsg += `\nExpires: ${expiresDate}`;
      }
      return res.status(403).json({ error: errorMsg });
    }
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
  res.json({ message: 'Logged in successfully', user: { id: user.id, username: user.username, role: user.role } });
});

app.post('/api/auth/logout', (req: any, res: any) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

app.get('/api/auth/me', authenticateToken, (req: any, res: any) => {
  res.json({ user: req.user });
});

// Admin Routes
app.get('/api/admin/users', authenticateToken, requireAdmin, (req: any, res: any) => {
  const stmt = db.prepare('SELECT id, username, role, is_blocked, block_reason, block_expires_at FROM users ORDER BY id ASC');
  const users = stmt.all();
  res.json(users);
});

app.get('/api/admin/logs', authenticateToken, requireAdmin, (req: any, res: any) => {
  const stmt = db.prepare(`
    SELECT chat_logs.id, chat_logs.message, chat_logs.created_at, users.username 
    FROM chat_logs 
    JOIN users ON chat_logs.user_id = users.id 
    ORDER BY chat_logs.created_at DESC 
    LIMIT 200
  `);
  const logs = stmt.all();
  res.json(logs);
});

app.get('/api/admin/users/:id/logs', authenticateToken, requireAdmin, (req: any, res: any) => {
  const userId = req.params.id;
  const stmt = db.prepare('SELECT id, message, created_at FROM chat_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 100');
  const logs = stmt.all(userId);
  res.json(logs);
});

app.patch('/api/admin/users/:id/toggle-block', authenticateToken, requireAdmin, (req: any, res: any) => {
  const userId = req.params.id;
  const { is_blocked, reason, durationMinutes } = req.body;
  
  if (parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: 'Cannot block yourself' });
  }
  
  if (is_blocked) {
    const expiresAt = durationMinutes ? Date.now() + durationMinutes * 60000 : null;
    const stmt = db.prepare('UPDATE users SET is_blocked = 1, block_reason = ?, block_expires_at = ? WHERE id = ? AND role != \'admin\'');
    stmt.run(reason || null, expiresAt, userId);
  } else {
    const stmt = db.prepare('UPDATE users SET is_blocked = 0, block_reason = NULL, block_expires_at = NULL WHERE id = ? AND role != \'admin\'');
    stmt.run(userId);
  }
  
  res.json({ message: 'User block status updated' });
});

// Ollama Proxy Routes
app.post('/api/ollama/generate', authenticateToken, async (req: any, res: any) => {
  const { prompt, model, stream, options, ollamaUrl, webSearch } = req.body;
  const targetUrl = ollamaUrl || 'http://host.docker.internal:11434'; // Default for Docker

  if (prompt) {
    db.prepare('INSERT INTO chat_logs (user_id, message) VALUES (?, ?)').run(req.user.id, prompt);
  }

  let finalPrompt = prompt;
  if (webSearch && prompt) {
    try {
      const search = await google.search(prompt, { page: 0, safe: false, parse_ads: false });
      if (search.results && search.results.length > 0) {
        const resultsText = search.results.slice(0, 3).map((r: any) => `Title: ${r.title}\nSnippet: ${r.description}`).join('\n\n');
        finalPrompt = `Using the following web search results, answer the user's query.\n\nSearch Results:\n${resultsText}\n\nUser Query: ${prompt}`;
      }
    } catch (e) {
      console.error('Google Search Error:', e);
    }
  }

  try {
    const response = await fetch(`${targetUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: finalPrompt, model, stream, options }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Pipe the response body directly to the client
      // Note: In newer Node versions, response.body is a ReadableStream
      // We need to handle it appropriately.
      // For simplicity in this environment, let's assume standard fetch behavior
      // but we might need to adapt if using node-fetch vs global fetch.
      // The global fetch in Node 18+ returns a web stream.
      
      const reader = (response.body as any).getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
      res.end();
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error) {
    console.error('Ollama Proxy Error:', error);
    res.status(500).json({ error: 'Failed to communicate with Ollama' });
  }
});

app.post('/api/ollama/chat', authenticateToken, async (req: any, res: any) => {
  const { messages, model, stream, options, ollamaUrl, webSearch } = req.body;
  const targetUrl = ollamaUrl || 'http://host.docker.internal:11434';

  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.role === 'user') {
    db.prepare('INSERT INTO chat_logs (user_id, message) VALUES (?, ?)').run(req.user.id, lastMessage.content);
  }

  let finalMessages = [...messages];
  if (webSearch && lastMessage && lastMessage.role === 'user') {
    try {
      const search = await google.search(lastMessage.content, { page: 0, safe: false, parse_ads: false });
      if (search.results && search.results.length > 0) {
        const resultsText = search.results.slice(0, 3).map((r: any) => `Title: ${r.title}\nSnippet: ${r.description}`).join('\n\n');
        finalMessages[finalMessages.length - 1] = {
          ...lastMessage,
          content: `Using the following web search results, answer the user's query.\n\nSearch Results:\n${resultsText}\n\nUser Query: ${lastMessage.content}`
        };
      }
    } catch (e) {
      console.error('Google Search Error:', e);
    }
  }

  try {
    const response = await fetch(`${targetUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: finalMessages, model, stream, options }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = (response.body as any).getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
      res.end();
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (error: any) {
    console.error('Ollama Proxy Error:', error);
    res.status(500).json({ error: error.message || 'Failed to communicate with Ollama' });
  }
});

app.get('/api/ollama/tags', authenticateToken, async (req: any, res: any) => {
  const ollamaUrl = req.query.url || 'http://host.docker.internal:11434';
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    if (!response.ok) throw new Error('Failed to fetch tags');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});


// Vite Middleware
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  // Serve static files in production
  const distPath = path.resolve(__dirname, __dirname.endsWith('dist-server') ? '../dist' : 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
