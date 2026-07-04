module.exports = {
  apps: [
    {
      name: 'cockpit-dashboard',
      script: 'node_modules/.bin/next',
      args: 'start',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        OPERATOR_STATE_DIR: `${process.env.HOME ?? process.env.USERPROFILE}/.operator-state`,
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
    {
      name: 'cockpit-bridge',
      script: 'npx',
      args: 'tsx src/bridge/server.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        BRIDGE_PORT: 3002,
        OPERATOR_STATE_DIR: `${process.env.HOME ?? process.env.USERPROFILE}/.operator-state`,
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
