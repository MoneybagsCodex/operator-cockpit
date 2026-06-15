module.exports = {
  apps: [
    {
      name: 'ai-operator-cockpit',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        OPERATOR_STATE_DIR: `${process.env.HOME}/.operator-state`,
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
