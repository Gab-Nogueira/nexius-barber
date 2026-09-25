import { ApiError, database, jsonError } from '@/lib/nexius';
import { assertSameOrigin } from '@/lib/transactions';
import {
  limitRequests,
  newSession,
  requestIdentity,
  SESSION_COOKIE,
} from '@/lib/session';
import {
  hostedStaffCredential,
  managedStaffLogin,
} from '@/lib/staff-provider';
import { cookies } from 'next/headers';
import { sha256 } from '@/lib/nexius';

const DUMMY = 'scrypt-v1$00000000000000000000000000000000$' + '0'.repeat(64);
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = (await request.json()) as {
      username?: unknown;
      password?: unknown;
    };
    const username =
      typeof body?.username === 'string'
        ? body.username.trim().toLowerCase()
        : '';
    const password = typeof body?.password === 'string' ? body.password : '';
    if (username.length > 80 || password.length > 256 || !username || !password)
      throw new ApiError(400, 'Informe usuário e senha.', 'invalid_login');
    await limitRequests('login-ip', await requestIdentity(), 60, 900000);
    await limitRequests('login-user', username, 8, 900000);
    let userId: string;
    if (process.env.AUTH_MODE === 'supabase') userId = await managedStaffLogin(username,password);
    else {
    const db = database();
    const row = await db
      .prepare(
        `SELECT c.user_id AS userId,c.password_hash AS hash FROM credentials c JOIN users u ON u.id=c.user_id WHERE c.username=? AND u.role IN ('admin','professional')`,
      )
      .bind(username)
      .first<{ userId: string; hash: string }>();
    const hosted = hostedStaffCredential();
    const hostedMatch = hosted?.username === username;
    const { verifyPassword } = await import('@/lib/password');
    const valid = await verifyPassword(
      password,
      hostedMatch ? hosted.passwordHash : row?.hash || DUMMY,
    );
    if (!valid || (!row && !hostedMatch))
      throw new ApiError(
        401,
        'Usuário ou senha incorretos.',
        'invalid_credentials',
      );
    if (!hostedMatch) userId = row!.userId;
    else {
      userId = row?.userId || `staff_${username}`;
      const now = new Date().toISOString();
      await db.batch([
        db.prepare(
          `INSERT INTO users(id,email,name,role,created_at,updated_at) VALUES(?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name,role='admin',updated_at=excluded.updated_at`,
        ).bind(
          userId,
          `${userId}@staff.invalid`,
          username,
          'admin',
          now,
          now,
        ),
        db.prepare(
          `INSERT INTO credentials(user_id,username,password_hash,updated_at) VALUES(?,?,?,?)
           ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,password_hash=excluded.password_hash,updated_at=excluded.updated_at`,
        ).bind(userId, username, hosted!.passwordHash, now),
      ]);
    }
    }
    // Rotate on login. Existing guest reservations stay attached to their guest identity.
    const old = (await cookies()).get(SESSION_COOKIE)?.value;
    if (old)
      await database()
        .prepare('DELETE FROM sessions WHERE token_hash=?')
        .bind(await sha256(old))
        .run();
    const cookie = await newSession(userId, 'staff', request);
    return Response.json(
      { ok: true },
      { headers: { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
