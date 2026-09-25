import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const endpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9226';
const origin = process.env.QA_ORIGIN || 'http://[::1]:3000';
const target = await (await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
let id = 0;
const pending = new Map();
const exceptions = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id && pending.has(message.id)) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
});
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, { resolve, reject });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function wait(expression, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timeout ${expression}: ${JSON.stringify(await evaluate('({url:location.href,text:document.body?.innerText?.slice(0,200)})'))}; exceptions=${JSON.stringify(exceptions)}`);
}
async function size(width) {
  await command('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 700 });
  await command('Emulation.setTouchEmulationEnabled', { enabled: width < 700, maxTouchPoints: width < 700 ? 5 : 1 });
}
async function screenshot(name) {
  const folder = join(tmpdir(), 'nexius-experience-qa');
  await mkdir(folder, { recursive: true });
  const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(join(folder, name), Buffer.from(result.data, 'base64'));
  return join(folder, name);
}
try {
  await command('Page.enable');
  await command('Runtime.enable');
  await size(390);
  await command('Page.navigate', { url: origin + '/' });
  await wait('document.readyState === "complete" && !!document.querySelector(".system-showcase")');
  await wait('document.querySelector(".availability-pulse") && !document.querySelector(".availability-pulse").textContent.includes("Consultando")');
  await new Promise((resolve) => setTimeout(resolve, 1800)); // first-visit intro
  const widths = [];
  for (const width of [360, 390, 768, 1024, 1440]) {
    await size(width);
    await evaluate('scrollTo(0,0)');
    const layout = await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,cta:!!document.querySelector(".hero-actions .button-primary"),demo:document.querySelector(".demo-bar")?.innerText})');
    assert.ok(layout.scroll <= width + 1, JSON.stringify(layout));
    assert.ok(layout.cta && /demonstração/i.test(layout.demo), JSON.stringify(layout));
    widths.push(layout);
  }
  await size(390);
  const image = await evaluate('({demo:document.querySelector(".public-photo-gallery img")?.naturalWidth,comparison:getComputedStyle(document.querySelector(".comparison-before")).backgroundImage})');
  assert.ok(image.demo > 0 && image.comparison.includes('demo-before-after.webp'), JSON.stringify(image));
  const beforeTheme = await evaluate('document.querySelector(".public-portal").dataset.theme');
  await evaluate('document.querySelector(".portal-controls button").click()');
  await wait(`document.querySelector('.public-portal').dataset.theme !== ${JSON.stringify(beforeTheme)}`);
  const theme = await evaluate('document.querySelector(".public-portal").dataset.theme');
  await evaluate('document.querySelector(".portal-controls button").click()');
  await evaluate('document.querySelector(".portal-controls button:nth-child(2)").click()');
  await wait('!!document.querySelector(".tour-card")');
  await evaluate('document.querySelector(".tour-actions button:last-child").click()');
  assert.equal(await evaluate('document.querySelector(".tour-card-top span")?.textContent?.includes("2 DE 4")'), true);
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await wait('!document.querySelector(".tour-card")');
  await evaluate('document.querySelector(".portal-controls button:nth-child(3)").click()');
  await wait('!!document.querySelector(".install-help")');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await wait('!document.querySelector(".install-help")');
  await evaluate('document.querySelector(".before-after-frame input").focus()');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await wait('document.querySelector(".before-after-frame").style.getPropertyValue("--reveal") !== "50%"');
  await evaluate('document.querySelector(".public-photo-gallery button").click()');
  await wait('document.querySelector(".public-photo-gallery dialog")?.open');
  await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await wait('!document.querySelector(".public-photo-gallery dialog")?.open');
  const manifest = await evaluate('fetch("/manifest.webmanifest").then(r=>r.json()).then(m=>({name:m.name,icons:m.icons.length}))');
  assert.equal(manifest.icons, 3);
  const worker = await evaluate('Promise.race([navigator.serviceWorker.ready.then(r=>r.active?.state),new Promise(resolve=>setTimeout(()=>resolve("timeout"),5000))])');
  assert.equal(worker, 'activated');
  await evaluate('scrollTo(0,0)');
  await new Promise((resolve) => setTimeout(resolve, 350));
  const mobileShot = await screenshot('home-390.png');
  await evaluate('document.querySelector(".before-after-frame").scrollIntoView({behavior:"instant",block:"center"})');
  await new Promise((resolve) => setTimeout(resolve, 350));
  const compareShot = await screenshot('compare-390.png');
  await evaluate('document.querySelector(".management-mock-window").scrollIntoView({behavior:"instant",block:"center"})');
  await new Promise((resolve) => setTimeout(resolve, 350));
  const systemShot = await screenshot('system-390.png');
  await size(1440);
  await evaluate('scrollTo(0,0)');
  await new Promise((resolve) => setTimeout(resolve, 350));
  const desktopShot = await screenshot('home-1440.png');
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const reduced = await evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches && getComputedStyle(document.querySelector(".hero h1")).animationName === "none"');
  assert.equal(reduced, true);
  assert.deepEqual(exceptions, []);
  console.log(JSON.stringify({ ok: true, widths, theme, manifest, worker, reduced, screenshots: [mobileShot, compareShot, systemShot, desktopShot] }));
} finally {
  socket.close();
  await fetch(`${endpoint}/json/close/${target.id}`).catch(() => undefined);
}
