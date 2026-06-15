/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  env: {
    OPERATOR_STATE_DIR: process.env.OPERATOR_STATE_DIR,
  },
}

module.exports = nextConfig
