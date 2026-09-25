import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { testAdmin } from '../tests/local-auth.mjs';

const endpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9226';
const origin = 'http://[::1]:3000';
const output = join(tmpdir(), 'nexius-qa-final');
await mkdir(output, { recursive: true });
const target = await (
  await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' })
).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) =>
  socket.addEventListener('open', resolve, { once: true }),
);
let id = 0;
const pending = new Map(),
  errors = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id && pending.has(message.id)) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown')
    errors.push(
      message.params.exceptionDetails.text +
        ': ' +
        message.params.exceptionDetails.exception?.description,
    );
});
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const key = ++id;
    pending.set(key, { resolve, reject });
    socket.send(JSON.stringify({ id: key, method, params }));
  });
}
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function wait(expression, ms = 20000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timeout: ${expression}`);
}
async function navigate(path) {
  await command('Page.navigate', { url: origin + path });
  await wait('document.readyState === "complete"');
  await new Promise((resolve) => setTimeout(resolve, 700));
}
async function click(selector) {
  await wait(`!!document.querySelector(${JSON.stringify(selector)})`);
  await tabTo(selector);
  await key('Enter',13,'\r');
}
async function key(name,code,text='') {
  await command('Input.dispatchKeyEvent',{type:'keyDown',key:name,code:name,windowsVirtualKeyCode:code,nativeVirtualKeyCode:code,...(text?{text,unmodifiedText:text}:{})});
  await command('Input.dispatchKeyEvent',{type:'keyUp',key:name,code:name,windowsVirtualKeyCode:code,nativeVirtualKeyCode:code});
}
async function tabTo(selector) {
  for(let i=0;i<120;i++){
    if(await evaluate(`document.activeElement === document.querySelector(${JSON.stringify(selector)})`))return;
    await key('Tab',9);
  }
  throw new Error(`Controle inacessível pela sequência Tab: ${selector}`);
}
async function fill(selector, value) {
  await tabTo(selector);
  await evaluate(
    `(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.focus();el.select();})()`,
  );
  await command('Input.insertText', { text: value });
}
async function size(width, height) {
  await command('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
  await command(
    'Emulation.setTouchEmulationEnabled',
    width < 700 ? { enabled: true, maxTouchPoints: 5 } : { enabled: false },
  );
}
async function screenshot(name) {
  const result = await command('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(join(output, name), Buffer.from(result.data, 'base64'));
}
await command('Page.enable');
await command('Runtime.enable');
await command('Network.enable');
const report = {
  widths: [],
  journey: false,
  catalog40: false,
  keyboard: false,
  errors,
};
let cookie = '',
  category = '',
  serviceIds = [],
  bookingId = '';
const staff=await testAdmin('http://localhost:3000');
cookie=staff.cookie;
async function admin(body) {
  const response = await fetch('http://localhost:3000/api/admin', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  assert.ok(response.ok, JSON.stringify(payload));
  return payload;
}
try {
  await navigate('/agendar');
  await wait('!!document.querySelector(".service-row")');
  for (const width of [360, 390, 768, 1024, 1440]) {
    await size(width, 844);
    await evaluate('scrollTo(0,0)');
    const layout = await evaluate(
      '({inner:innerWidth,scroll:document.documentElement.scrollWidth})',
    );
    assert.ok(layout.scroll <= width + 1, JSON.stringify(layout));
    report.widths.push(layout);
  }
  await size(390, 844);
  await click('.service-row');
  await wait('!document.querySelector(".summary-next").disabled');
  // Focus a real button and activate it using the keyboard, rather than a synthetic click.
  await evaluate('document.querySelector(".summary-next").focus()');
  await command('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    text: '\r',
    unmodifiedText: '\r',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
  await command('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    nativeVirtualKeyCode: 13,
  });
  await wait('document.querySelector("h1")?.textContent.includes("quem")');
  assert.equal(
    await evaluate('document.activeElement === document.querySelector("h1")'),
    true,
  );
  report.keyboard = true;
  await click('.summary-next');
  await wait('document.querySelector("h1")?.textContent.includes("horário")');
  await wait('!document.querySelector(".loading-state")');
  if (!(await evaluate('!!document.querySelector(".slot-grid button")'))) {
    await evaluate(
      '[...document.querySelectorAll("button")].find(el=>el.textContent.includes("Buscar próxima")).click()',
    );
    await wait('!!document.querySelector(".slot-grid button")', 45000);
  }
  await click('.slot-grid button');
  await click('.summary-next');
  await wait('!!document.querySelector("#name")');
  await fill('#name', 'Cliente demonstrativo QA');
  await fill('#phone', '12999999999');
  await evaluate('document.querySelector(".whatsapp-opt input")?.click()');
  await screenshot('revisao-mobile.png');
  await click('.summary-next');
  await wait('!!document.querySelector(".success-panel")');
  const link = await evaluate(
    '[...document.querySelectorAll("a")].find(el=>el.textContent.includes("calendário")).getAttribute("href")',
  );
  bookingId = link.split('/')[3];
  assert.ok(bookingId);
  report.journey = true;
  await screenshot('confirmacao-mobile.png');
  await navigate('/cliente');
  await wait('!!document.querySelector(".client-booking-card")');
  assert.ok(
    await evaluate(
      `document.body.innerText.includes('Cliente') || !!document.querySelector('.client-booking-card')`,
    ),
  );
  await screenshot('cliente-mobile.png');
  category = (
    await admin({
      action: 'category.save',
      name: 'Carga sintética QA — não oficial',
      active: true,
      displayOrder: 9999,
    })
  ).id;
  for (let index = 1; index <= 40; index++) {
    const service = await admin({
      action: 'service.save',
      name: `Serviço sintético QA ${index}`,
      description: 'Carga temporária de teste, não é oferta real.',
      categoryId: category,
      priceCents: 1000,
      durationMinutes: 20,
      active: true,
      source: 'demo',
      displayOrder: 9999,
    });
    serviceIds.push(service.id);
  }
  await navigate('/agendar');
  await wait('document.querySelectorAll(".service-row").length>=40');
  await fill('.search-box input', 'sintetico qa 37');
  await wait('document.querySelectorAll(".service-row").length===1');
  await click('.service-row');
  assert.ok(
    await evaluate(
      'document.querySelector(".service-row")?.getAttribute("aria-pressed")==="true"',
    ),
  );
  report.catalog40 = true;
  await screenshot('catalogo-40-mobile.png');
  await navigate('/gestao');
  await wait('!!document.querySelector("input[autocomplete=username]")');
  await fill('input[autocomplete=username]',staff.username);
  await fill('input[autocomplete=current-password]',staff.password);
  await click('.login-card button[type=submit]');
  await wait('!!document.querySelector(".day-agenda")');
  await screenshot('gestao-mobile.png');
  await size(1440, 1000);
  await screenshot('gestao-desktop.png');
  for (const text of ['Catálogo', 'Equipe e horários', 'Fotos e conteúdo', 'Agenda']) {
    await evaluate(
      `[...document.querySelectorAll('[data-sidebar="menu-button"]')].find(el=>el.textContent.trim()===${JSON.stringify(text)}).click()`,
    );
    await wait('!!document.querySelector(".management-stack")');
    await screenshot(
      `gestao-${text === 'Catálogo' ? 'catalogo' : text === 'Equipe e horários' ? 'equipe' : text === 'Fotos e conteúdo' ? 'conteudo' : 'agenda'}.png`,
    );
  }
  await size(390, 844);
  await screenshot('agenda-mobile.png');
  await navigate('/');
  await wait('!!document.querySelector(".hero")');
  for (const width of [360, 390, 768, 1024, 1440]) {
    await size(width, 1000);
    const layout = await evaluate(
      '({inner:innerWidth,scroll:document.documentElement.scrollWidth})',
    );
    assert.ok(layout.scroll <= width + 1, JSON.stringify(layout));
  }
  await screenshot('home-desktop.png');
  await size(390, 844);
  await screenshot('home-mobile.png');
  report.performance = await evaluate(`(()=>{const p=performance.getEntriesByType('navigation')[0];return {environment:'Chrome local / Vite dev, sem throttling, cache aquecido',domContentLoadedMs:Math.round(p.domContentLoadedEventEnd),loadMs:Math.round(p.loadEventEnd),transferBytes:p.transferSize};})()`);
  await size(844,390);
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  report.landscape=true;
  await size(390,844);
  await evaluate("document.documentElement.style.zoom='2'");
  assert.ok(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  report.zoom200Reflow=true;
  await evaluate("document.documentElement.style.zoom='1'");
  assert.equal(errors.length, 0, errors.join('\n'));
} catch (error) {
  await screenshot('failure.png');
  report.failure = String(error);
  throw error;
} finally {
  if (bookingId)
    await admin({
      action: 'booking.status',
      bookingId,
      status: 'cancelled',
    }).catch(() => undefined);
  for (const serviceId of serviceIds)
    await admin({
      action: 'service.update',
      serviceId,
      priceCents: 1000,
      durationMinutes: 20,
      active: false,
    });
  if (category)
    await admin({
      action: 'category.save',
      id: category,
      name: 'Carga sintética QA — não oficial',
      active: false,
      displayOrder: 9999,
    });
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  socket.close();
  await fetch(`${endpoint}/json/close/${target.id}`);
  await staff.dispose();
}
console.log(JSON.stringify({ output, report }));
