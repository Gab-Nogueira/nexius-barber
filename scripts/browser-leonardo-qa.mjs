import assert from 'node:assert/strict';

const endpoint = process.env.CDP_ENDPOINT || 'http://127.0.0.1:9226';
const origin = process.env.QA_ORIGIN || 'http://127.0.0.1:3000';
const target = await (
  await fetch(`${endpoint}/json/new?about:blank`, { method: 'PUT' })
).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) =>
  socket.addEventListener('open', resolve, { once: true }),
);

let id = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data));
  if (message.id && pending.has(message.id)) {
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') {
    errors.push(
      message.params.exceptionDetails.exception?.description ||
        message.params.exceptionDetails.text,
    );
  }
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

async function wait(expression, timeout = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timeout: ${expression}`);
}

async function setViewport(width, height) {
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

try {
  await command('Page.enable');
  await command('Runtime.enable');
  await setViewport(390, 844);
  await command('Page.navigate', {
    url: `${origin}/agendar?profissional=pro-leonardo`,
  });
  await wait('document.readyState === "complete"');
  await wait('!!document.querySelector(".service-row")');

  const initial = await evaluate(`({
    text: document.body.innerText,
    progress: document.querySelector('.wizard-progress span')?.textContent,
    overflow: document.documentElement.scrollWidth - innerWidth
  })`);
  assert.match(initial.text, /serviços de Leonardo/i);
  assert.match(initial.text, /ETAPA 1 DE 4/i);
  assert.ok(initial.overflow <= 1, JSON.stringify(initial));

  await evaluate('document.querySelector(".service-row").click()');
  await wait('!document.querySelector(".summary-next").disabled');
  await evaluate('document.querySelector(".summary-next").click()');
  await wait(
    'document.querySelector("h1")?.textContent.includes("horário")',
  );

  const schedule = await evaluate(`({
    heading: document.querySelector('h1')?.textContent,
    text: document.body.innerText,
    overflow: document.documentElement.scrollWidth - innerWidth
  })`);
  assert.match(schedule.heading, /horário/i);
  assert.match(schedule.text, /ETAPA 2 DE 4/i);
  assert.doesNotMatch(schedule.text, /Com quem você prefere/i);
  assert.ok(schedule.overflow <= 1, JSON.stringify(schedule));

  await evaluate('document.querySelector(".step-back").click()');
  await wait('document.querySelector("h1")?.textContent.includes("agendar")');
  assert.match(await evaluate('document.body.innerText'), /serviços de Leonardo/i);

  for (const width of [360, 390, 768, 1024]) {
    await setViewport(width, 844);
    const overflow = await evaluate(
      'document.documentElement.scrollWidth - innerWidth',
    );
    assert.ok(overflow <= 1, `Overflow em ${width}px: ${overflow}`);
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      ok: true,
      flow: 'Leonardo: serviços -> data e horário',
      viewports: [360, 390, 768, 1024],
    }),
  );
} finally {
  socket.close();
  await fetch(`${endpoint}/json/close/${target.id}`).catch(() => undefined);
}
