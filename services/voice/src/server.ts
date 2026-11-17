// Munim's voice relay (D-100), on Fly.io in Singapore (the nearest region Fly still provisions). Browsers connect over a WebSocket with a short-lived ticket from the
// Munim site; the relay holds the Sarvam connections, whose key must never reach a browser. No storage, no logs beyond counts.
import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { Session, type Lang } from './session.js';
import { ticketKey, verifyTicket } from './ticket.js';

import type { Upstream } from './session.js';

export interface RelayOpts { port: number; origins: string[]; up: Upstream; maxConn?: number; perIp?: number; maxSessionMs?: number; idleMs?: number }

export function startRelay(o: RelayOpts): Promise<{ port: number; close: () => Promise<void> }> {
const KEY = o.up.key, ORIGINS = o.origins, up = o.up;
const MAX_CONN = o.maxConn ?? 40, PER_IP = o.perIp ?? 3, MAX_SESSION_MS = o.maxSessionMs ?? 15 * 60_000, IDLE_MS = o.idleMs ?? 90_000;
const tkey = ticketKey(KEY);
const perIp = new Map<string, number>(), used = new Map<string, number>();
let open = 0, served = 0;

const http = createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(KEY ? 200 : 503, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: !!KEY })); return; } // no counts to strangers
  res.writeHead(404); res.end();
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

http.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const ip = String(req.headers['fly-client-ip'] ?? req.socket.remoteAddress ?? '');
  const deny = (code: number) => { socket.write(`HTTP/1.1 ${code} No\r\n\r\n`); socket.destroy(); };
  if (url.pathname !== '/v1' || !KEY) return deny(404);
  if (!ORIGINS.includes(String(req.headers.origin ?? ''))) return deny(403);
  const t = url.searchParams.get('t') ?? '';
  if (!verifyTicket(tkey, t) || used.has(t)) return deny(401); // each ticket opens one session (one machine, so memory is enough)
  used.set(t, Date.now()); for (const [k, at] of used) if (Date.now() - at > 120_000) used.delete(k);
  if (open >= MAX_CONN || (perIp.get(ip) ?? 0) >= PER_IP) return deny(429);
  wss.handleUpgrade(req, socket, head, (ws) => run(ws, ip));
});

function run(ws: WebSocket, ip: string) {
  open++; served++; perIp.set(ip, (perIp.get(ip) ?? 0) + 1);
  const send = (m: object | Buffer) => { if (ws.readyState === ws.OPEN) ws.send(Buffer.isBuffer(m) ? m : JSON.stringify(m)); };
  const s = new Session(up, send);
  ws.on('error', () => ws.terminate()); // an oversized or malformed frame ends this session only, never the relay
  // caps, so a scripted client can't use the relay as free speech services: audio no faster than real time (+20%, plus a
  // 2 s burst), and at most 20,000 characters voiced per session (a long conversation is ~5,000)
  const t0 = Date.now(); let audioBytes = 0, chars = 0;
  let idle = setTimeout(() => ws.close(1000, 'idle'), IDLE_MS);
  const life = setTimeout(() => ws.close(1000, 'session limit'), MAX_SESSION_MS);
  ws.on('message', (data, isBinary) => {
    clearTimeout(idle); idle = setTimeout(() => ws.close(1000, 'idle'), IDLE_MS);
    if (isBinary) { const b = data as Buffer; audioBytes += b.length; if (audioBytes > ((Date.now() - t0) / 1000 * 1.2 + 2) * 32000) return; return s.audio(b); } // 16 kHz × 2 bytes = 32,000 a second
    let m: { t?: string; lang?: string; id?: string; text?: string };
    try { m = JSON.parse(String(data)); } catch { return; }
    if (m.t === 'listen') s.listen((['hi', 'en', 'auto'].includes(String(m.lang)) ? m.lang : 'auto') as Lang);
    else if (m.t === 'unlisten') s.unlisten();
    else if (m.t === 'say' && m.id && m.text) { chars += String(m.text).length; if (chars > 20000) { send({ t: 'error', where: 'tts', message: 'session voice limit' }); return; } s.say(String(m.id).slice(0, 40), String(m.text), m.lang === 'en' ? 'en' : 'hi'); }
    else if (m.t === 'stop') s.stop();
    else if (m.t === 'ping') send({ t: 'pong' });
  });
  ws.on('close', () => { clearTimeout(idle); clearTimeout(life); s.close(); open--; const n = (perIp.get(ip) ?? 1) - 1; if (n > 0) perIp.set(ip, n); else perIp.delete(ip); });
  send({ t: 'ready' });
}

return new Promise((resolve) => http.listen(o.port, () => {
  const a = http.address(); const port = typeof a === 'object' && a ? a.port : o.port;
  resolve({ port, close: () => new Promise<void>((r) => { for (const c of wss.clients) c.terminate(); wss.close(); http.close(() => r()); }) });
}));
}
