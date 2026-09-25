import type { Metadata } from 'next';
import { AppHeader } from '@/components/app-header';
import { BookingWizard } from '@/components/booking-wizard';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Agendar | Nexius Barber',
  description: 'Escolha serviços, profissional, data e horário na demonstração da agenda Nexius Barber.',
  robots: { index: false, follow: false },
};

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ servico?: string; profissional?: string; reserva?: string }> }) {
  const [params, user] = await Promise.all([searchParams, currentUser()]);
  return (
    <main className="app-surface">
      <AppHeader backLabel="Início" actionHref="/cliente" actionLabel="Minhas reservas" />
      <BookingWizard
        initialServiceId={params.servico}
        initialProfessionalId={params.profissional}
        initialAttemptKey={params.reserva}
        accountName={user?.fullName ?? undefined}
      />
    </main>
  );
}
