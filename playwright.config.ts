import { defineConfig, devices } from "@playwright/test";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
export default defineConfig({ testDir: "tests/e2e", use: { baseURL, trace: "retain-on-failure" }, webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { command: "corepack pnpm dev", url: "http://127.0.0.1:3000/api/health", reuseExistingServer: true }, projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }, { name: "mobile", use: { ...devices["iPhone 13"] } }] });
