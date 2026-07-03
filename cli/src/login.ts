// login / logout / whoami — token paste flow. The token is minted once in the web app
// (Settings → CLI access) and stored in ~/.vibex/config.json (0600).

import { createInterface } from "node:readline/promises";
import pc from "picocolors";
import { apiMe } from "./api.js";
import { loadConfig, saveConfig, clearConfig, DEFAULT_BASE_URL } from "./config.js";
import { banner, info, done, fail } from "./ui.js";

export async function runLogin(opts: { token?: string; url?: string }) {
  const baseUrl = opts.url || loadConfig().baseUrl || DEFAULT_BASE_URL;
  banner("Connect your Vibex account");
  info(`server: ${baseUrl}`);
  info(`mint a token at ${baseUrl}/settings (CLI access), then paste it below`);

  let token = opts.token?.trim();
  if (!token) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    token = (await rl.question(`\n  ${pc.bold("token")} ${pc.dim("(vx_…)")}: `)).trim();
    rl.close();
  }
  if (!/^vx_[a-f0-9]{48}$/.test(token)) {
    fail("That doesn't look like a Vibex token (expected vx_ + 48 hex characters).");
    process.exit(1);
  }

  const me = await apiMe(baseUrl, token);
  saveConfig({ baseUrl, token });
  done(`Signed in as ${me.user.email ?? me.user.name ?? "your account"} (${me.plan} plan)`);
  info("try: vibex build \"a habit tracker with streaks\"");
}

export function runLogout() {
  clearConfig();
  done("Token forgotten. `vibex login` to reconnect.");
}

export async function runWhoami() {
  const cfg = loadConfig();
  if (!cfg.token) {
    fail("Not signed in — run `vibex login` first.");
    process.exit(1);
  }
  const me = await apiMe(cfg.baseUrl!, cfg.token);
  console.log(`${me.user.email ?? me.user.name ?? "unknown"} ${pc.dim(`· ${me.plan} plan · ${cfg.baseUrl}`)}`);
}
