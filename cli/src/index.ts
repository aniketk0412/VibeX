#!/usr/bin/env node
// vibex — Vibex from your terminal. `vibex login` with a token from Settings → CLI access,
// then `vibex build "an idea"` streams the Coder+Reviewer build and writes real files into a
// local folder. Thin client of the Vibex backend: plans, limits, and dashboard all apply.

import { createRequire } from "node:module";
import pc from "picocolors";
import { runLogin, runLogout, runWhoami } from "./login.js";
import { runBuild } from "./build.js";
import { fail } from "./ui.js";
import { ApiError } from "./api.js";

const require = createRequire(import.meta.url);
const VERSION: string = (require("../package.json") as { version: string }).version;

const HELP = `
${pc.bold("vibex")} — from idea to code, in your terminal

${pc.bold("Usage")}
  vibex login [--token vx_…] [--url https://…]   connect your account
  vibex build "<idea>" [options]                 build an app into a local folder
  vibex whoami                                   show the signed-in account
  vibex logout                                   forget the stored token

${pc.bold("Build options")}
  --dir <path>        target folder (default: ./<idea-slug>)
  --platform <p>      web | api | cli            (default: web)
  --project <id>      rebuild an existing project instead of creating one
  --steer "<note>"    fold a correction into the build
  --force             write into a non-empty folder

${pc.bold("Examples")}
  vibex build "a habit tracker with streaks"
  vibex build "a trading journal" --dir ./journal --force

Tokens are minted in ${pc.underline("Settings → CLI access")} on the web app.
`;

type Flags = { [k: string]: string | boolean };

function parseArgs(argv: string[]): { cmd: string; positional: string[]; flags: Flags } {
  const [cmd = "help", ...rest] = argv;
  const positional: string[] = [];
  const flags: Flags = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { cmd, positional, flags };
}

async function main() {
  const { cmd, positional, flags } = parseArgs(process.argv.slice(2));

  switch (cmd) {
    case "login":
      await runLogin({ token: typeof flags.token === "string" ? flags.token : undefined, url: typeof flags.url === "string" ? flags.url : undefined });
      break;
    case "logout":
      runLogout();
      break;
    case "whoami":
      await runWhoami();
      break;
    case "build":
      await runBuild(positional.join(" "), {
        dir: typeof flags.dir === "string" ? flags.dir : undefined,
        platform: typeof flags.platform === "string" ? flags.platform : undefined,
        project: typeof flags.project === "string" ? flags.project : undefined,
        steer: typeof flags.steer === "string" ? flags.steer : undefined,
        force: flags.force === true,
      });
      break;
    case "--version":
    case "-v":
    case "version":
      console.log(VERSION);
      break;
    default:
      console.log(HELP);
      break;
  }
}

main().catch((e: unknown) => {
  if (e instanceof ApiError) fail(e.message);
  else fail(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
