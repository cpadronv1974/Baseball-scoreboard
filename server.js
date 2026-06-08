/**
 * BASEBALL SCOREBOARD SERVER
 * Compatible: Node.js en Windows, Linux, macOS y Termux (Android)
 *
 * Uso:
 *   node server.js               → red local, puerto 3000
 *   node server.js --port 8080   → puerto personalizado
 *   node server.js --ngrok-url https://abc.ngrok-free.app
 *                                → muestra URLs ngrok en consola (ngrok corre aparte)
 */

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const { WebSocketServer } = require('ws');
const os     = require('os');

// ── Argumentos ──────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const idx      = (v) => args.indexOf(v);
const PORT     = parseInt(args[idx('--port') + 1] || 3000);
const NGROK_URL = idx('--ngrok-url') >= 0 ? args[idx('--ngrok-url') + 1] : null;

// ── Estado del juego ─────────────────────────────────────────────────────────
let state = {
  away:    { name:'VISITANTE', r:0, h:0, e:0, innings:['-','-','-','-','-','-','-','-','-'] },
  home:    { name:'LOCAL',     r:0, h:0, e:0, innings:['-','-','-','-','-','-','-','-','-'] },
  inning:  1, half:'top',
  balls:   0, strikes:0, outs:0,
  bases:   [false,false,false],
  title:   'BÉISBOL EN VIVO',
  status:  'EN JUEGO'
};

// ── HTTP: sirve overlay.html y control.html ──────────────────────────────────
const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const routes  = {
    '/':              'overlay.html',
    '/overlay':       'overlay.html',
    '/overlay.html':  'overlay.html',
    '/control':       'control.html',
    '/control.html':  'control.html',
  };
  const file = routes[urlPath];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }

  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404); res.end('Archivo no encontrado: ' + file); return;
  }
  res.writeHead(200, {
    'Content-Type':  'text/html; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(fs.readFileSync(filePath));
});

// ── WebSocket ────────────────────────────────────────────────────────────────
const wss     = new WebSocketServer({ server });
const clients = new Set();

wss.on('connection', (ws, req) => {
  clients.add(ws);
  console.log(`[WS] +1 cliente | Total: ${clients.size} | IP: ${req.socket.remoteAddress}`);
  ws.send(JSON.stringify({ type: 'state', data: state }));

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'update') {
      state = { ...state, ...msg.data };
      broadcast(JSON.stringify({ type: 'state', data: state }), ws);
    }
  });
  ws.on('close',  () => { clients.delete(ws); console.log(`[WS] -1 cliente | Total: ${clients.size}`); });
  ws.on('error',  () =>   clients.delete(ws));
});

function broadcast(msg, exclude) {
  for (const c of clients)
    if (c !== exclude && c.readyState === 1) c.send(msg);
}

// ── IP local ─────────────────────────────────────────────────────────────────
function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces()))
    for (const i of ifaces)
      if (i.family === 'IPv4' && !i.internal) return i.address;
  return 'localhost';
}

// ── Arrancar ─────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  const line = '═'.repeat(54);

  console.log(`\n╔${line}╗`);
  console.log(`║   ⚾  BASEBALL SCOREBOARD  —  puerto ${PORT}              ║`);
  console.log(`╠${line}╣`);
  console.log(`║  Red local / WiFi:                                   ║`);
  console.log(`║    Overlay  →  http://${ip}:${PORT}/overlay`);
  console.log(`║    Control  →  http://${ip}:${PORT}/control`);
  console.log(`╠${line}╣`);
  console.log(`║  Este dispositivo (localhost):                       ║`);
  console.log(`║    Overlay  →  http://localhost:${PORT}/overlay`);
  console.log(`║    Control  →  http://localhost:${PORT}/control`);

  if (NGROK_URL) {
    console.log(`╠${line}╣`);
    console.log(`║  🌐 NGROK  —  internet / red móvil:                  ║`);
    console.log(`║    Overlay  →  ${NGROK_URL}/overlay`);
    console.log(`║    Control  →  ${NGROK_URL}/control`);
  }

  console.log(`╚${line}╝`);
  console.log('\nServidor listo. Ctrl+C para detener.\n');
});
