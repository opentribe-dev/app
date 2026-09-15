import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { OpenCrewClient } from '@opencrew/sdk';
const require = createRequire(import.meta.url);
const WebSocket = require('../../sdk/node_modules/ws');
const baseUrl = 'http://127.0.0.1:5173';
const client = new OpenCrewClient({ baseUrl });
assert.equal((await client.auth.status()).initialized, false);
const setup = await client.auth.setup({ email: 'p0@example.test', displayName: 'P0 test', password: 'p0-test-password' });
client.setToken(setup.token);
await client.providers.create({ id: 'smoke', kind: 'openai-compatible', apiKey: 'local-test-key', baseUrl: 'http://127.0.0.1:5151/v1' });
const agent = await client.agents.create({ name: 'Echo', personality: 'Reply concisely.', modelPolicy: { defaultProviderId: 'smoke', defaultModel: 'test-model' } });
const dm = await client.conversations.createDm({ participantId: agent.id, participantType: 'agent' });
const ws = client.ws(WebSocket);
const opened = new Promise((resolve) => ws.onOpen(resolve));
const received = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('timed out waiting for WebSocket agent message')), 5000);
  ws.onEvent((event) => {
    if (event.type === 'message.created' && event.payload.authorType === 'agent') {
      clearTimeout(timeout); resolve(event.payload);
    }
  });
});
ws.connect({ token: setup.token });
await opened;
await client.messages.send(dm.id, { body: 'Hello' });
const reply = await received;
assert.equal(reply.body, 'Mock provider received: Hello');
ws.close();
const refreshed = new OpenCrewClient({ baseUrl });
refreshed.setToken(setup.token);
assert.ok((await refreshed.conversations.list()).some((conversation) => conversation.id === dm.id));
assert.ok((await refreshed.messages.list(dm.id)).some((message) => message.id === reply.id));
assert.equal((await refreshed.auth.login({ email: 'p0@example.test', password: 'p0-test-password' })).user.id, setup.user.id);
const appResponse = await fetch(baseUrl);
assert.equal(appResponse.status, 200);
assert.match(await appResponse.text(), /\/src\/main.tsx/);
console.log('PASS: app origin proxy → SDK → server → provider HTTP → SQLite → WS → new client history');
