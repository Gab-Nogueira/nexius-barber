import assert from 'node:assert/strict';
import test from 'node:test';
import { testAdmin } from './local-auth.mjs';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const base = process.env.TEST_BASE_URL || 'http://localhost:3000';
const {cookie,dispose} = await testAdmin(base);
const account = await (
  await fetch(`${base}/api/account`, { headers: { Cookie: cookie } })
).json();
function sql(command) {
  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        'node_modules/wrangler/bin/wrangler.js',
        'd1',
        'execute',
        'DB',
        '--local',
        '--config',
        'wrangler.local.jsonc',
        '--command',
        command,
        '--json',
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
        windowsHide: true,
      },
    ),
  );
}
async function signed(path, body, method = 'POST') {
  const response = await fetch(`${base}${path}`, {
    method: body ? method : 'GET',
    headers: {
      Cookie: cookie,
      Connection: 'close',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() };
}
let bookingId, ownerId;
test('isolamento de recurso e persistência de mídia', async (t) => {
  let chosen;
  for (let offset = 12; offset < 26; offset++) {
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(Date.now() + offset * 86400000));
    const result = await signed(
      `/api/availability?service=srv-barba-demo&professional=pro-leonardo&date=${date}`,
    );
    if (result.data.slots?.length) {
      chosen = result.data.slots[0];
      break;
    }
  }
  assert.ok(chosen);
  const key = crypto.randomUUID(),
    created = await signed('/api/bookings', {
      serviceIds: ['srv-barba-demo'],
      professionalId: 'pro-leonardo',
      startAt: chosen.startAt,
      name: 'QA propriedade demonstrativa',
      phone: '12999999999',
      idempotencyKey: key,
      quoteRevision: chosen.quoteRevision,
    });
  assert.equal(created.status, 201);
  bookingId = created.data.booking.id;
  await t.test('cabeçalhos forjados sem sessão não autenticam', async () => {
    const response = await fetch(`${base}/api/bookings/${bookingId}`, {
      headers: {
        'oai-authenticated-user-id': account.account.id,
        'oai-authenticated-user-email': account.account.email,
      },
    });
    assert.equal(response.status, 401);
  });
  await t.test(
    'cliente autenticado não lê nem cancela reserva de outro por ID',
    async () => {
      ownerId = crypto.randomUUID();
      sql(
        `INSERT INTO users (id,email,name,role,created_at,updated_at) VALUES ('${ownerId}','${ownerId}@example.invalid','QA outra conta','customer',datetime('now'),datetime('now')); UPDATE bookings SET customer_user_id='${ownerId}' WHERE id='${bookingId}';`,
      );
      assert.equal((await signed(`/api/bookings/${bookingId}`)).status, 404);
      assert.equal(
        (
          await signed(
            `/api/bookings/${bookingId}`,
            { action: 'cancel' },
            'PATCH',
          )
        ).status,
        404,
      );
      assert.equal(
        (await signed(`/api/bookings/attempt?key=${key}`)).status,
        404,
      );
      sql(
        `UPDATE bookings SET customer_user_id='${account.account.id}' WHERE id='${bookingId}';`,
      );
    },
  );
  await t.test(
    'falha de notificação não remove reserva nem altera idempotência',
    async () => {
      sql(
        `UPDATE notifications SET status='failed',detail='Falha simulada de adaptador local' WHERE booking_id='${bookingId}';`,
      );
      const result = await signed('/api/bookings', {
        serviceIds: ['srv-barba-demo'],
        professionalId: 'pro-leonardo',
        startAt: chosen.startAt,
        name: 'QA propriedade demonstrativa',
        phone: '12999999999',
        idempotencyKey: key,
        quoteRevision: chosen.quoteRevision,
      });
      assert.equal(result.status, 201);
      assert.equal(result.data.booking.id, bookingId);
      assert.equal(result.data.booking.status, 'confirmed');
    },
  );
  await t.test(
    'upload R2 é recuperado byte a byte com tipo correto',
    async () => {
      const bytes = await readFile('public/nexius-concrete-x.png'),
        form = new FormData();
      form.set(
        'file',
        new Blob([bytes], { type: 'image/png' }),
        'apoio-abstrato-demo.png',
      );
      form.set(
        'altText',
        'Apoio abstrato de demonstração; não é foto da barbearia',
      );
      const response = await fetch(`${base}/api/admin/upload`, {
        method: 'POST',
        headers: { Cookie: cookie },
        body: form,
      });
      assert.equal(response.status, 201);
      const media = await response.json();
      const read = await fetch(`${base}${media.url}`);
      assert.equal(read.status, 200);
      assert.match(read.headers.get('content-type'), /image\/png/);
      const hash = (value) => createHash('sha256').update(value).digest('hex');
      assert.equal(hash(Buffer.from(await read.arrayBuffer())), hash(bytes));
    },
  );
});
test.after(async () => {
  if (bookingId)
    await signed('/api/admin', {
      action: 'booking.status',
      bookingId,
      status: 'cancelled',
    });
  await dispose();
});
