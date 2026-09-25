import { writeFile } from 'node:fs/promises';

const [endpoint, url, output, widthArg, heightArg] = process.argv.slice(2);

if (!endpoint || !url || !output || !widthArg || !heightArg) {
  throw new Error('Uso: node scripts/capture-cdp.mjs <endpoint> <url> <saida> <largura> <altura>');
}

const width = Number(widthArg);
const height = Number(heightArg);
const targetResponse = await fetch(`${endpoint}/json/new?${encodeURIComponent('about:blank')}`, {
  method: 'PUT',
});

if (!targetResponse.ok) {
  throw new Error(`Não foi possível criar a aba de captura: ${targetResponse.status}`);
}

const target = await targetResponse.json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
const listeners = new Map();
let nextId = 1;

const opened = new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result ?? {});
    return;
  }

  if (message.method && listeners.has(message.method)) {
    for (const listener of listeners.get(message.method)) listener(message.params ?? {});
  }
});

await opened;

function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

function once(method, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const handlers = listeners.get(method) ?? new Set();
    const timer = setTimeout(() => {
      handlers.delete(handler);
      reject(new Error(`Tempo esgotado aguardando ${method}`));
    }, timeoutMs);
    const handler = (params) => {
      clearTimeout(timer);
      handlers.delete(handler);
      resolve(params);
    };
    handlers.add(handler);
    listeners.set(method, handlers);
  });
}

await command('Page.enable');
await command('Network.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width,
  height,
  deviceScaleFactor: 1,
  mobile: width <= 640,
  screenWidth: width,
  screenHeight: height,
});
await command(
  'Emulation.setTouchEmulationEnabled',
  width <= 640 ? { enabled: true, maxTouchPoints: 5 } : { enabled: false },
);

const loaded = once('Page.loadEventFired');
await command('Page.navigate', { url });
await loaded;

// Aguarda redirecionamentos de autenticação, hidratação e consultas ao D1.
await new Promise((resolve) => setTimeout(resolve, 8000));
for (let attempt=0; attempt<30; attempt++) {
  const status=await command('Runtime.evaluate',{expression:'!!document.querySelector(".loading-state")',returnByValue:true});
  if(!status.result.value)break;
  await new Promise((resolve)=>setTimeout(resolve,500));
}
await command('Runtime.evaluate', { expression: 'scrollTo(0, 0)' });
await new Promise((resolve) => setTimeout(resolve, 150));

const viewport = await command('Runtime.evaluate', {
  expression: '({ width: innerWidth, height: innerHeight, path: location.pathname, title: document.title })',
  returnByValue: true,
});
const capture = await command('Page.captureScreenshot', {
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false,
});

await writeFile(output, Buffer.from(capture.data, 'base64'));
process.stdout.write(`${JSON.stringify(viewport.result.value)}\n`);
socket.close();
await fetch(`${endpoint}/json/close/${target.id}`);
