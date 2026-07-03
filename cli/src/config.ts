// ~/.vibex/config.json — base URL + access token. Env vars override for CI:
// VIBEX_API_URL, VIBEX_TOKEN.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CliConfig } from "./types.js";

export const DEFAULT_BASE_URL = "https://vibe-x-liart.vercel.app";

const DIR = join(homedir(), ".vibex");
const FILE = join(DIR, "config.json");

export function loadConfig(): Partial<CliConfig> {
  let file: Partial<CliConfig> = {};
  try {
    file = JSON.parse(readFileSync(FILE, "utf8")) as Partial<CliConfig>;
  } catch {
    /* first run */
  }
  return {
    baseUrl: process.env.VIBEX_API_URL || file.baseUrl || DEFAULT_BASE_URL,
    token: process.env.VIBEX_TOKEN || file.token,
  };
}

export function saveConfig(cfg: CliConfig) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(cfg, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
}

export function clearConfig() {
  try {
    writeFileSync(FILE, "{}\n", "utf8");
  } catch {
    /* nothing to clear */
  }
}
