module.exports = {
  apps: [
    {
      name: 'ollama-ai-ui',
      script: './dist-server/server.js',
      env: {
        NODE_ENV: 'production',
      },
      // This ensures PM2 restarts the app if it crashes
      exp_backoff_restart_delay: 100,
    },
  ],
};
