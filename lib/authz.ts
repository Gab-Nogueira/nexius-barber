import { type ChatGPTUser } from '@/app/chatgpt-auth';
import { currentUser, platformAuth } from '@/lib/session';
import { ensureUser } from '@/lib/booking-engine';
import { ApiError, demoModeEnabled } from '@/lib/nexius';

export async function requireApiUser(): Promise<ChatGPTUser> {
  const user = await currentUser();
  if (!user) throw new ApiError(401, 'Entre com sua conta para continuar.', 'authentication_required');
  await ensureUser(user);
  return user;
}

export async function requireAdmin() {
  const user = await requireApiUser();
  const account = await ensureUser(user);
  if (platformAuth() && demoModeEnabled()) return { user, role: 'admin' as const, demonstration: true };
  if (account?.role !== 'admin') throw new ApiError(403, 'Acesso restrito à gestão.', 'forbidden');
  return { user, role: 'admin' as const, demonstration: demoModeEnabled() };
}

export async function requireProfessionalOrAdmin() {
  const user = await requireApiUser();
  const account = await ensureUser(user);
  if (platformAuth() && demoModeEnabled()) return { user, role: 'professional' as const, demonstration: true };
  if (!account || !['professional', 'admin'].includes(account.role)) {
    throw new ApiError(403, 'Acesso restrito à equipe.', 'forbidden');
  }
  return { user, role: account.role, demonstration: false };
}
