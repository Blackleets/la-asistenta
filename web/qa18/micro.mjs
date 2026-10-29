import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn('/usr/bin/chromium', ['--headless=new', '--no-sandbox', '--disable-gpu',
  '--remote-debugging-port=9367', '--remote-debugging-address=127.0.0.1',
  '--window-size=412,915', '--user-data-dir=/tmp/qa18-perfil-micro', 'about:blank'], { stdio: 'ignore' });
let url = null;
for (let i = 0; i < 30 && !url; i++) {
  try { const r = await fetch('http://127.0.0.1:9367/json/version'); url = (await r.json()).webSocketDebuggerUrl; } catch {}
  if (!url) await sleep(500);
}
const ws = new WebSocket(url);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 0; const pend = new Map();
ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
const send = (method, params = {}, sessionId) => { const id = ++seq; return new Promise(res => { pend.set(id, res); ws.send(JSON.stringify({ id, method, params, sessionId })); }); };
const { result: { targetId } } = await send('Target.createTarget', { url: 'about:blank' });
const { result: { sessionId } } = await send('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);
await S('Page.enable'); await S('Runtime.enable');
await S('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
await S('Page.navigate', { url: 'http://127.0.0.1:8090/' });
await sleep(5000);
const r1 = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
writeFileSync('/data/la-asistenta/web/icons/vista-barrido-inicio.png', Buffer.from(r1.result.data, 'base64'));
const sw = await S('Runtime.evaluate', { expression: 'document.documentElement.scrollWidth', returnByValue: true });
console.log('inicio capturado · scrollW =', sw.result?.result?.value);
try { ws.close(); } catch {}
chrome.kill(); process.exit(0);
