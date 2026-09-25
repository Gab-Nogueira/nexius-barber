'use client';
import { SignOutButton } from './staff-login';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CalendarPlus,
  Check,
  Clock3,
  MapPin,
  RefreshCw,
  Scissors,
  X,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { AccountContact } from '@/components/account-contact';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Booking = {
  id: string;
  reference: string;
  professionalId: string;
  professionalName: string;
  startAt: string;
  endAt: string;
  status: string;
  totalCents: number;
  services: Array<{
    id: string;
    name: string;
    priceCents: number;
    durationMinutes: number;
  }>;
  cancellationLimitHours: number;
  timezone: string;
};
type Catalog = {
  professionals: Array<{ id: string; name: string; serviceIds: string[] }>;
};
type Slot = {
  startAt: string;
  endAt: string;
  time: string;
  professionalId: string;
  professionalName: string;
  totalCents: number;
  durationMinutes: number;
  quoteRevision: number;
};

const statusLabels: Record<string, string> = {
  confirmed: 'Confirmado',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  no_show: 'Não compareceu',
};

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}
function dateTime(iso: string, timeZone = 'America/Sao_Paulo') {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(iso));
}
function localIsoDate(offset: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() + offset * 86_400_000));
}

export function ClientBookings({
  displayName,
}: {
  displayName: string;
}) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [catalog, setCatalog] = useState<Catalog>({ professionals: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [date, setDate] = useState(localIsoDate(1));
  const [professionalId, setProfessionalId] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [working, setWorking] = useState(false);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [bookingResponse, catalogResponse] = await Promise.all([
        fetch('/api/bookings', { cache: 'no-store' }),
        fetch('/api/catalog', { cache: 'no-store' }),
      ]);
      const bookingData = (await bookingResponse.json()) as {
        error?: string;
        bookings: Booking[];
      };
      const catalogData = (await catalogResponse.json()) as Catalog;
      if (!bookingResponse.ok)
        throw new Error(
          bookingData.error || 'Não foi possível carregar seus agendamentos.',
        );
      setBookings(bookingData.bookings);
      setCatalog(catalogData);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível carregar seus agendamentos.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const upcoming = useMemo(
    () =>
      bookings
        .filter(
          (booking) =>
            ['pending', 'confirmed'].includes(booking.status) &&
            new Date(booking.startAt).getTime() > Date.now(),
        )
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [bookings],
  );
  const history = useMemo(
    () =>
      bookings.filter(
        (booking) => !upcoming.some((item) => item.id === booking.id),
      ),
    [bookings, upcoming],
  );
  const rescheduling = bookings.find(
    (booking) => booking.id === reschedulingId,
  );

  async function loadSlots(
    booking: Booking,
    nextProfessionalId = professionalId || booking.professionalId,
    nextDate = date,
  ) {
    setWorking(true);
    setError('');
    setSelectedSlot(null);
    setProfessionalId(nextProfessionalId);
    try {
      const params = new URLSearchParams({
        date: nextDate,
        professional: nextProfessionalId,
        exclude: booking.id,
      });
      booking.services.forEach((service) =>
        params.append('service', service.id),
      );
      const response = await fetch(`/api/availability?${params}`, {
        cache: 'no-store',
      });
      const data = (await response.json()) as { error?: string; slots: Slot[] };
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível consultar a agenda.');
      setSlots(data.slots);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível consultar a agenda.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function cancel(id: string) {
    setWorking(true);
    setError('');
    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível cancelar.');
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível cancelar.',
      );
    } finally {
      setWorking(false);
    }
  }

  async function reschedule() {
    if (!rescheduling || !selectedSlot) return;
    setWorking(true);
    setError('');
    try {
      const response = await fetch(`/api/bookings/${rescheduling.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reschedule',
          professionalId: selectedSlot.professionalId,
          startAt: selectedSlot.startAt,
          quoteRevision: selectedSlot.quoteRevision,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(data.error || 'Não foi possível remarcar.');
      setReschedulingId(null);
      setSelectedSlot(null);
      setSlots([]);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível remarcar.',
      );
    } finally {
      setWorking(false);
    }
  }

  function bookingCard(booking: Booking, featured = false) {
    const active = ['pending', 'confirmed'].includes(booking.status);
    const eligible = catalog.professionals.filter((professional) =>
      booking.services.every((service) =>
        professional.serviceIds.includes(service.id),
      ),
    );
    return (
      <article
        className={`client-booking-card ${featured ? 'featured' : ''}`}
        key={booking.id}
      >
        <div className="client-booking-top">
          <span className={`status status-${booking.status}`}>
            {statusLabels[booking.status] ?? booking.status}
          </span>
          <small>{booking.reference}</small>
        </div>
        <h3>{dateTime(booking.startAt, booking.timezone)}</h3>
        <div className="booking-facts">
          <span>
            <Scissors /> {booking.services.map((item) => item.name).join(' + ')}
          </span>
          <span>
            <Clock3 /> {booking.professionalName}
          </span>
          <span>
            <MapPin /> Avenida das Rosas, 341
          </span>
        </div>
        <div className="booking-price">
          Valor registrado <strong>{money(booking.totalCents)}</strong>
        </div>
        <div className="booking-card-actions">
          {active && (
            <Button
              variant="outline"
              onClick={() => {
                setReschedulingId(booking.id);
                setProfessionalId(booking.professionalId);
                void loadSlots(booking, booking.professionalId, date);
              }}
            >
              <RefreshCw /> Remarcar
            </Button>
          )}
          {active && (
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive" />}>
                <X /> Cancelar
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancelar este horário?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O horário será liberado. O cancelamento online é permitido
                    até {booking.cancellationLimitHours} horas antes, conforme a
                    política registrada nesta reserva.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Manter reserva</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={() => void cancel(booking.id)}
                  >
                    Confirmar cancelamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <a
            className="button-link"
            href={`/agendar?servico=${encodeURIComponent(booking.services.map((item) => item.id).join(','))}&profissional=${encodeURIComponent(booking.professionalId)}`}
          >
            <CalendarPlus /> Agendar novamente
          </a>
        </div>
        {reschedulingId === booking.id && (
          <div className="reschedule-panel">
            <div className="reschedule-heading">
              <div>
                <strong>Novo horário</strong>
                <span>
                  Sua reserva original será mantida se a mudança falhar.
                </span>
              </div>
              <button
                onClick={() => setReschedulingId(null)}
                aria-label="Fechar remarcação"
              >
                ×
              </button>
            </div>
            <div className="reschedule-controls">
              <label>
                Profissional
                <select
                  value={professionalId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setProfessionalId(value);
                    void loadSlots(booking, value, date);
                  }}
                >
                  {eligible.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data
                <input
                  type="date"
                  min={localIsoDate(1)}
                  value={date}
                  onChange={(event) => {
                    setDate(event.target.value);
                    void loadSlots(booking, professionalId, event.target.value);
                  }}
                />
              </label>
            </div>
            {working ? (
              <p>Consultando…</p>
            ) : (
              <div className="reschedule-slots">
                {slots.map((slot) => (
                  <button
                    key={slot.startAt}
                    className={
                      selectedSlot?.startAt === slot.startAt ? 'selected' : ''
                    }
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            )}
            {!working && !slots.length && (
              <p className="muted">Sem horários nessa data.</p>
            )}
            {selectedSlot && (
              <p>
                Revisão: {dateTime(selectedSlot.startAt)} ·{' '}
                {selectedSlot.professionalName} · {selectedSlot.durationMinutes}{' '}
                min · {money(selectedSlot.totalCents)}.
              </p>
            )}
            <Button
              disabled={!selectedSlot || working}
              onClick={() => void reschedule()}
            >
              <Check /> Confirmar novo horário
            </Button>
          </div>
        )}
      </article>
    );
  }

  return (
    <div className="client-area">
      <header className="client-welcome">
        <div>
          <p>ÁREA DO CLIENTE</p>
          <h1>Olá, {displayName.split(' ')[0]}.</h1>
          <span>Consulte e gerencie seus horários com segurança.</span>
        </div>
        <SignOutButton guest />
      </header>
      <AccountContact />
      {error && (
        <div className="booking-error" role="alert">
          <AlertCircle /> {error}
          <button onClick={() => setError('')} aria-label="Fechar">
            ×
          </button>
        </div>
      )}
      {loading ? (
        <div className="loading-state">Carregando seus agendamentos…</div>
      ) : (
        <Tabs defaultValue="upcoming" className="client-tabs">
          <TabsList variant="line">
            <TabsTrigger value="upcoming">
              Próximos ({upcoming.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              Histórico ({history.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming">
            <div className="client-booking-list">
              {upcoming.length ? (
                upcoming.map((item, index) => bookingCard(item, index === 0))
              ) : (
                <div className="empty-state">
                  <CalendarClock />
                  <p>Você não tem horários futuros.</p>
                  <a className="button button-primary" href="/agendar">
                    Agendar meu horário
                  </a>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="history">
            <div className="client-booking-list">
              {history.length ? (
                history.map((item) => bookingCard(item))
              ) : (
                <div className="empty-state">
                  <p>Seu histórico ainda está vazio.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
