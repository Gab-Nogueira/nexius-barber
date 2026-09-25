import type { Metadata } from 'next';
import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { currentUser, platformAuth } from '@/lib/session';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { ProfessionalAgenda } from '@/components/professional-agenda';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Minha agenda | Nexius Barber', robots: { index: false, follow: false } };
export default async function ProfessionalPage() {
  if(platformAuth()) await requireChatGPTUser('/profissional');
  else { const user=await currentUser(); if(!user || !['professional','admin'].includes(user.role)) redirect('/gestao/login'); }
  return <main className="app-surface"><AppHeader backHref="/" backLabel="Início" actionHref="/gestao" actionLabel="Gestão" /><ProfessionalAgenda /></main>;
}
