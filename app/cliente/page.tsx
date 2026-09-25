import type { Metadata } from 'next';
import { AppHeader } from '@/components/app-header';
import { ClientBookings } from '@/components/client-bookings';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Meus agendamentos | Nexius Barber', robots: { index: false, follow: false } };

export default async function ClientPage() {
  const user = await currentUser();
  return <main className="app-surface"><AppHeader backHref="/" backLabel="Início" actionHref="/agendar" actionLabel="Novo horário" />{user ? <ClientBookings displayName={user.fullName ?? user.displayName} /> : <section className="client-area"><h1>Seus agendamentos</h1><p>As reservas ficam protegidas neste navegador. Se você agendou em outro aparelho ou apagou os cookies, fale com a barbearia informando a referência da reserva. O telefone sozinho não libera o histórico.</p><a className="button button-primary" href="/agendar">Agendar um horário</a><a className="button button-ghost" href="/#contato">Falar com a barbearia</a></section>}</main>;
}
