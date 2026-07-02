// Brand Splats — real MCP server (stdio, zero dependencies)
// Lets Claude (or any MCP client) query the Brand Splat Library directly.
//
// Claude Desktop config:
// {
//   "mcpServers": {
//     "brand-splats": { "command": "node", "args": ["/ABSOLUTE/PATH/TO/brand-splats-platform/mcp-server.js"] }
//   }
// }
'use strict';
const store = require('./lib/store');

const SERVER_INFO = { name: 'brand-splats-library', version: '0.1.0' };

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function handle(msg) {
  const { id, method, params } = msg;
  if (id === undefined || id === null) return; // notification — no reply

  if (method === 'initialize') {
    return send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: (params && params.protocolVersion) || '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
        instructions: 'Brand Splat Library: verified, rig-measured 3D product assets for advertising and agentic commerce. Search products, read signed Truth Manifests, fetch renditions at the right rung for your capability, verify provenance, check brand rules before placement, and request licence grants.'
      }
    });
  }
  if (method === 'tools/list') {
    return send({ jsonrpc: '2.0', id, result: { tools: store.TOOL_DEFS } });
  }
  if (method === 'tools/call') {
    const name = params && params.name;
    const args = (params && params.arguments) || {};
    Promise.resolve(store.callTool(name, args)).then(result => {
      send({
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: !!(result && result.error)
        }
      });
    }).catch(e => {
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: 'error: ' + e.message }], isError: true } });
    });
    return;
  }
  if (method === 'ping') return send({ jsonrpc: '2.0', id, result: {} });
  send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'method not found: ' + method } });
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try { handle(JSON.parse(line)); } catch (e) { /* ignore malformed lines */ }
  }
});
process.stdin.on('end', () => process.exit(0));
