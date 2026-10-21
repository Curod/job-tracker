import { defineConfig } from "vitest/config";

process.loadEnvFile("../.env");

export default defineConfig({
  test: {
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL! },
    globalSetup: "./test/global-setup.ts",
    fileParallelism: false,
  },
});