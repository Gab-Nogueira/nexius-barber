import type { Metadata } from 'next';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { currentUser, platformAuth } from '@/lib/session';
import { redirect } from 'next/navigation';
import { AdminDashboard } from '@/components/admin-dashboard';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Gestão | Nexius Barber', robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (platformAuth()) await requireChatGPTUser('/gestao');
  else {
    const user = await currentUser();
    if (user?.role === 'professional') redirect('/profissional');
    if (user?.role !== 'admin') redirect('/gestao/login');
  }
  return <AdminDashboard />;
}
