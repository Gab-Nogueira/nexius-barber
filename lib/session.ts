import { cookies, headers } from 'next/headers';
import { getChatGPTUser, type ChatGPTUser } from '@/app/chatgpt-auth';
import { ApiError, database, sha256 } from './nexius';

export const SESSION_COOKIE = 'nexius_session';
export const platformAuth = () => process.env.AUTH_MODE === 'platform';
export type SessionUser = ChatGPTUser & { role: string; kind: string };

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const row = await database()
      .prepare(
        `SELECT u.id,u.email,u.name,u.role,s.kind FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`,
      )
      .bind(await sha256(token), Date.now())
      .first<{
        id: string;
        email: string;
        name: string;
        role: string;
        kind: string;
      }>();
    if (row)
      return {
        userId: row.id,
        email: row.email,
        fullName: row.name,
        displayName: row.name,
        role: row.role,
        kind: row.kind,
      };
  }
  if (platformAuth()) {
    const user = await getChatGPTUser();
    if (user) {
      const row = await database()
        .prepare('SELECT role FROM users WHERE id=?')
        .bind(user.userId)
        .first<{ role: string }>();
      return { ...user, role: row?.role || 'customer', kind: 'platform' };
    }
  }
  return null;
}

export async function newSession(
  userId: string,
  kind: 'guest' | 'staff',
  request: Request,
) {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
  const seconds = kind === 'staff' ? 8 * 3600 : 30 * 86400;
  await database()
    .prepare(
      'INSERT INTO sessions (token_hash,user_id,kind,expires_at,created_at) VALUES (?,?,?,?,?)',
    )
    .bind(
      await sha256(token),
      userId,
      kind,
      Date.now() + seconds * 1000,
      new Date().toISOString(),
    )
    .run();
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
}

export async function limitRequests(
  scope: string,
  identity: string,
  maximum: number,
  windowMs: number,
) {
  const now = Date.now();
  const key = `${scope}:${await sha256(identity)}`;
  const row = await database()
    .prepare(`INSERT INTO rate_limits (key,count,reset_at) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END, reset_at=CASE WHEN reset_at<=? THEN excluded.reset_at ELSE reset_at END RETURNING count`)
    .bind(key, now + windowMs, now, now)
    .first<{ count: number }>();
  if (!row || row.count > maximum)
    throw new ApiError(
      429,
      'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
      'rate_limited',
    );
}

export async function requestIdentity() {
  // Only trust CF's address at the actual Cloudflare ingress. No forwarded-for fallback.
  return (await headers()).get('cf-connecting-ip') || 'local';
}
