# Ollama AI UI

A modern web interface for Ollama with user management, chat history, and web search capabilities.

## Option 1: Docker Installation (Recommended)
This is the easiest way to get started and includes **automatic updates** using Watchtower.

### Prerequisites
- [Docker](https://www.docker.com/)
- [Ollama](https://ollama.com/) installed and running

### Setup
1. **Using Docker Compose**:
   This will start the Web UI and a **Watchtower** container that automatically checks for and applies updates every 5 minutes.
   ```bash
   docker compose up -d
   ```

2. **Using Docker Run**:
   ```bash
   docker run -d -p 3000:3000 --name ollama-ai-ui -v ./data:/app/data ghcr.io/haaris-ai/ollama-ai-ui:latest
   ```

### Automated Updates
This project is configured to automatically build and push Docker images to the **GitHub Container Registry (GHCR)** whenever a new release is published.

The included `docker-compose.yml` uses **Watchtower** to monitor the GHCR image and automatically update your running container within 5 minutes of a new release.

The app will be available at `http://localhost:3000`.

---

## Option 2: Standard Installation (NPM)
Use this method if you prefer to run directly on your host machine.

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
4. **Run with PM2** (Recommended for auto-restart):
   ```bash
   # Install PM2 globally if you haven't
   npm install -g pm2
   
   # Start the app using the config file
   pm2 start ecosystem.config.cjs
   ```

The app will be available at `http://localhost:3000`.

---

## Configuration
You can configure the application using environment variables or a `.env` file:
- `PORT`: Port to run the server on (default: 3000)
- `OLLAMA_URL`: URL of your Ollama instance (default: http://host.docker.internal:11434)
- `JWT_SECRET`: Secret key for user authentication
- `DB_PATH`: Path to the SQLite database file (default: ollama-webui.db)
