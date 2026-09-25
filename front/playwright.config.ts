import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  use: { baseURL: "http://127.0.0.1:4179" },
  webServer: {
    command: "npx vite --config tests/vite.config.ts",
    url: "http://127.0.0.1:4179/tests/browser.html",
    reuseExistingServer: !process.env.CI,
  },
});
