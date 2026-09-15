import { createServer } from 'node:http';
createServer(async (req, res) => {
  if (req.url !== '/v1/chat/completions') { res.writeHead(404).end(); return; }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const data = JSON.parse(Buffer.concat(chunks).toString());
  const last = data.messages.at(-1)?.content ?? '';
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ choices: [{ message: { content: `Mock provider received: ${last}` }, finish_reason: 'stop' }] }));
}).listen(5151, '127.0.0.1');
