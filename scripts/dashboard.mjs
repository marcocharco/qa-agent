// Usage: npm run dashboard
// Checks the environment, starts the dashboard on port 3100 and opens it in the browser.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const PORT = 3100;
if (!existsSync(".env.local")) {
  console.error("Missing .env.local. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}
process.loadEnvFile(".env.local");
const missing = ["DATABASE_URL", "ENTIRE_PROJECT", "TARGET_REPO_DIR", "TARGET_URL"].filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(", ")}. See .env.example.`);
  process.exit(1);
}

const server = spawn("npx", ["next", "dev", "-p", String(PORT)], { stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => server.kill("SIGINT"));

// Open the browser once the server answers.
const url = `http://localhost:${PORT}`;
for (let i = 0; i < 60; i++) {
  try {
    await fetch(url, { redirect: "manual" });
    spawn("open", [url], { stdio: "ignore" }).unref();
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
