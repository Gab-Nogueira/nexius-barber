import { ApiError, database } from './nexius';

export function hostedStaffCredential() {
  const username = (process.env.HOSTED_ADMIN_USERNAME || '')
    .trim()
    .toLowerCase();
  const passwordHash = process.env.HOSTED_ADMIN_PASSWORD_HASH || '';
  if (
    !/^[a-z0-9._-]{3,40}$/.test(username) ||
    !/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(passwordHash)
  )
    return null;
  return { username, passwordHash };
}

// Optional managed password verification for hosts with a small CPU allowance.
// Public customers do not use Supabase Auth and never need an account.
export function managedAuthConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.ADMIN_EMAILS);
}
export async function managedStaffLogin(email: string, password: string) {
  const base=process.env.SUPABASE_URL || '', key=process.env.SUPABASE_PUBLISHABLE_KEY || '';
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(base)||!key)throw new ApiError(503,'O acesso da equipe ainda não foi configurado.','auth_not_configured');
  const response=await fetch(`${base.replace(/\/$/,'')}/auth/v1/token?grant_type=password`,{
    method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(12000),
  });
  if(!response.ok)throw new ApiError(response.status===429?429:401,'Não foi possível entrar. Confira os dados ou tente novamente mais tarde.','invalid_credentials');
  const data=await response.json() as { user?:{id?:string;email?:string;email_confirmed_at?:string} };
  const user=data.user;
  if(!user?.id||!user.email_confirmed_at||user.email?.toLowerCase()!==email)throw new ApiError(401,'Confirme o e-mail da equipe antes de entrar.','unconfirmed_staff');
  const id=`supabase_${user.id}`;
  const admins=(process.env.ADMIN_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
  const existing=await database().prepare('SELECT role FROM users WHERE id=?').bind(id).first<{role:string}>();
  const role=admins.includes(email)?'admin':existing?.role==='professional'?'professional':null;
  if(!role)throw new ApiError(403,'Esta conta não possui acesso à equipe.','forbidden');
  const now=new Date().toISOString();
  await database().prepare(`INSERT INTO users(id,email,name,role,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,role=excluded.role,updated_at=excluded.updated_at`)
    .bind(id,email,email.split('@')[0],role,now,now).run();
  // Provider tokens are deliberately not persisted or returned to the browser.
  return id;
}
