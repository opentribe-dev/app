# P0 API contract implemented

The SDK is the app's canonical client. Server resources use `/api/v1` only; WebSocket events are at `/api/v1/ws?token=...&sinceSeq=...`.

| Flow | Resource |
| --- | --- |
| Initial state | `GET /api/v1/auth/status` |
| First admin / login / logout / current user | `POST /api/v1/auth/setup`, `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me` |
| Remote provider config | `GET/POST /api/v1/providers` |
| Agent list / create / edit | `GET/POST /api/v1/agents`, `PATCH /api/v1/agents/{id}` |
| DM list / create | `GET/POST /api/v1/conversations` |
| History / send | `GET/POST /api/v1/conversations/{id}/messages` |
| Agent memory facts | `GET/POST /api/v1/agents/{id}/memory-facts` |
| Realtime | `message.created` with persistent sequence replay; `agent.run.failed` on provider invocation error |

A DM user message automatically invokes the DM agent's `modelPolicy.defaultProviderId` and `defaultModel`. Agent personality, provider ID, and model ID are persisted on the server. Runtime binding and runtime sessions remain separate resources; the P0 chat agent editor does not assign them.

The previous request list included device/workspace selectors, streaming deltas, runtime activity, and approvals that the server does not yet offer in the requested shape. These remain P1 and are not presented as working P0 data.
