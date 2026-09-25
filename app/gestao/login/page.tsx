import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/session';
import { database } from '@/lib/nexius';
import { StaffLogin } from '@/components/staff-login';
import {
  hostedStaffCredential,
  managedAuthConfigured,
} from '@/lib/staff-provider';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Acesso da equipe | Nexius Barber', robots: { index: false, follow: false } };
export default async function LoginPage() {
  const user = await currentUser();
  if (user?.role === 'admin') redirect('/gestao');
  const managed = process.env.AUTH_MODE === 'supabase';
  const configured = managed
    ? managedAuthConfigured()
    : hostedStaffCredential() ||
      (await database().prepare('SELECT user_id FROM credentials LIMIT 1').first());
  return <StaffLogin configured={Boolean(configured)} managed={managed} />;
}
