# Developer A contract requests

Repository: protocol / server / sdk

## Client resources

Required:

```text
GET/POST/PATCH /api/v1/agents
GET/POST       /api/v1/conversations
GET/POST       /api/v1/conversations/{id}/messages
GET/PATCH      /api/v1/agents/{id}/memory
GET            /api/v1/providers
GET            /api/v1/runtimes
GET            /api/v1/devices
GET            /api/v1/workspaces
GET            /api/v1/approvals
POST           /api/v1/approvals/{id}/decisions
```

Agent create/update needs distinct `model`, `providerId`, `runtimeId`, and optional `workspaceId` fields. Messages need `replyToMessageId` and structured mentions (`entityType`, `entityId`, offsets) rather than relying only on parsed display text.

Reason: the client implements agent creation, DMs, groups, memory, provider/runtime/workspace selectors, device status, and approval decisions.

## Realtime stream

Required events:

```text
message.created
message.delta
message.completed
agent.status.changed
runtime.activity.started
runtime.activity.updated
runtime.activity.completed
runtime.approval.requested
runtime.approval.resolved
device.status.changed
```

Every event needs a stable event ID, entity ID, monotonic sequence within a stream, and timestamp so the PWA can reconnect and deduplicate safely.

Reason: the conversation UI renders token streaming, agent presence, runtime progress, device health, and inline approvals.

Current integration seam: `src/lib/gateway.ts`.
