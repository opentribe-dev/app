# OpenCrew App

The official OpenCrew web client. Its authenticated gateway uses the sibling `@opencrew/sdk` and real server resources.

Install the independent sibling repositories in this order: `protocol`, `server`, `sdk`, `app`. From each repository, run `npm install`, then build protocol, server, and SDK. Start the server (`npm start` from `repos/server`) and app (`npm run dev` from `repos/app`). The development app proxies `/api/v1` and `/api/v1/ws` to `localhost:4000`.

On a clean SQLite database, the app offers first-admin setup, remote provider configuration, agent creation, a DM, and provider-backed chat. Use an actual model ID for the chosen provider. Refresh to load conversations and messages from the server.

`npm run build` verifies the app bundle; `npm test` exercises the setup-to-reply DOM flow and refresh. The cross-repo smoke test is `cd ../sdk && npx vitest run test/p0-flow.test.ts`. `./scripts/p0-local-smoke.sh` also exercises Vite's HTTP and WebSocket proxy with a clean SQLite database and local deterministic provider endpoint.
