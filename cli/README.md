# vibex CLI

Vibex from your terminal — describe an app, a Coder + Reviewer AI pair builds it, and the
files land in a local folder. Same account, plans, and dashboard as the web app.

```sh
npm i -g vibex-app

vibex login                       # paste a token from Settings → CLI access
vibex build "a habit tracker with streaks"
vibex build "a trading journal" --dir ./journal
```

> npm package is `vibex-app` (the bare `vibex` name is squatted and `vibex-cli` belongs to an
> unrelated project) — the installed command is still `vibex`.

## Commands

| Command | What it does |
| --- | --- |
| `vibex login [--token vx_…] [--url …]` | Verify + store your access token in `~/.vibex` |
| `vibex build "<idea>"` | Create a project, stream the build, write files locally |
| `vibex build --project <id>` | Rebuild / resume an existing project |
| `vibex whoami` | Show the connected account + plan |
| `vibex logout` | Forget the stored token |

Build flags: `--dir <path>` · `--platform web|api|cli` · `--steer "<correction>"` · `--force`

## Notes

- Tokens are minted (and revoked) in the web app under **Settings → CLI access**; only a hash
  is stored server-side.
- Builds stream over the same API the web workspace uses — usage counts against your plan and
  every run appears on your dashboard.
- `VIBEX_API_URL` / `VIBEX_TOKEN` env vars override the stored config (useful in CI).

## Develop

```sh
cd cli
npm install
npm run build       # tsc → dist/
node dist/index.js --help
```
