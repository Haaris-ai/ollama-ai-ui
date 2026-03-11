# Ollama AI UI

A modern web interface for Ollama with user management, chat history, and web search capabilities.

## Option 1: Standard Installation (NPM - Recommended)
This method allows you to use the **in-app update button** to keep your deployment up to date.

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Ollama](https://ollama.com/) installed and running

### Setup
1. **Download and Extract** the latest release.
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Build the Application**:
   ```bash
   npm run build
   ```
4. **Run with PM2** (Recommended for auto-restart after updates):
   ```bash
   # Install PM2 globally if you haven't
   npm install -g pm2
   
   # Start the app using the config file (Works on all OS)
   pm2 start ecosystem.config.cjs
   ```

The app will be available at `http://localhost:3000`.

---

## Option 2: Docker Installation
*Note: The in-app update button does not work with Docker. You must pull the latest image manually to update.*

### Prerequisites
- [Docker](https://www.docker.com/)
- [Ollama](https://ollama.com/) installed and running

### Setup
1. **Using Docker Compose**:
   ```bash
   docker compose up -d
   ```
2. **Using Docker Run**:
   ```bash
   docker run -d -p 3000:3000 --name ollama-ai-ui -v ./data:/app/data haaris-ai/ollama-ai-ui:latest
   ```

The app will be available at `http://localhost:3000`.

---

## Configuration
You can configure the application using environment variables or a `.env` file:
- `PORT`: Port to run the server on (default: 3000)
- `OLLAMA_URL`: URL of your Ollama instance (default: http://host.docker.internal:11434)
- `JWT_SECRET`: Secret key for user authentication
- `DB_PATH`: Path to the SQLite database file (default: ollama-webui.db)
