import { defineConfig } from "@playwright/test";

const PORT = 3100;
const RPC_PORT = 8899;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { args: ["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }
  },
  webServer: [
    {
      command: `npx tsx e2e/mock-rpc.ts`,
      port: RPC_PORT,
      reuseExistingServer: false,
      env: { MOCK_RPC_PORT: String(RPC_PORT) }
    },
    {
      command: `npx next dev -p ${PORT}`,
      port: PORT,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        SOLANA_RPC_URL: `http://localhost:${RPC_PORT}`,
        LLM_MOCK: "1",
        NEXT_PUBLIC_SOLANA_NETWORK: "devnet",
        NEXT_PUBLIC_ENABLE_MAINNET: "false"
      }
    }
  ]
});
