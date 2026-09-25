import {
  currentUser,
  limitRequests,
  newSession,
  requestIdentity,
  SESSION_COOKIE,
} from '@/lib/session';
import { assertSameOrigin } from '@/lib/transactions';
import { database, jsonError, sha256 } from '@/lib/nexius';
import { cookies } from 'next/headers';
import { ensureUser } from '@/lib/booking-engine';

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await currentUser();
    if (user)
      return Response.json(
        { ok: true },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    await limitRequests('guest', await requestIdentity(), 30, 3600000);
    const id = `guest_${crypto.randomUUID()}`;
    await ensureUser({
      userId: id,
      email: `${id}@guest.invalid`,
      displayName: 'Cliente',
      fullName: null,
    });
    const cookie = await newSession(id, 'guest', request);
    return Response.json(
      { ok: true },
      { headers: { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token)
      await database()
        .prepare('DELETE FROM sessions WHERE token_hash=?')
        .bind(await sha256(token))
        .run();
    return Response.json(
      { ok: true },
      {
        headers: {
          'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
