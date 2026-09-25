'use client';

import { useEffect, useState } from 'react';
import { Ban, Check, Clock3, RefreshCw, UserRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Booking = {
  id: string;
  reference: string;
  clientName: string;
  clientPhone: string;
  startAt: string;
  status: string;
  timezone: string;
  services: Array<{ name: string }>;
};
type Data = {
  professional: { id: string; name: string };
  bookings: Booking[];
  demonstration: boolean;
};
function dateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(iso));
}
function localInput(offsetMinutes: number) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date(Date.now() + offsetMinutes * 60_000))
    .replace(' ', 'T');
}

export function ProfessionalAgenda() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [block, setBlock] = useState({
    startAt: localInput(60),
    endAt: localInput(120),
    reason: '',
  });
  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/professional', { cache: 'no-store' });
      const payload = (await response.json()) as Data & { error?: string };
      if (!response.ok) throw new Error(payload.error);
      setData(payload);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Falha ao carregar a agenda.',
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function action(body: Record<string, unknown>, success: string) {
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/professional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error);
      setNotice(success);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Não foi possível salvar.',
      );
    } finally {
      setWorking(false);
    }
  }
  const upcoming =
    data?.bookings
      .filter(
        (booking) =>
          ['pending', 'confirmed'].includes(booking.status),
      )
      .sort((a, b) => a.startAt.localeCompare(b.startAt)) ?? [];
  return (
    <div className="professional-area">
      <header>
        <div className="professional-profile">
          <span>
            <UserRound />
          </span>
          <div>
            <p>MINHA AGENDA</p>
            <h1>{data?.professional.name ?? 'Profissional'}</h1>
            <small>Acesso limitado aos próprios atendimentos</small>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw /> Atualizar
        </Button>
      </header>
      {error && (
        <div className="admin-alert error">
          <Ban />
          {error}
          <button onClick={() => setError('')}>
            <X />
          </button>
        </div>
      )}
      {notice && (
        <div className="admin-alert success">
          <Check />
          {notice}
          <button onClick={() => setNotice('')}>
            <X />
          </button>
        </div>
      )}
      {loading ? (
        <div className="loading-state">Carregando agenda…</div>
      ) : (
        <div className="professional-grid-layout">
          <section className="professional-schedule">
            <h2>Próximos atendimentos</h2>
            {upcoming.length ? (
              upcoming.map((booking) => (
                <article key={booking.id}>
                  <time>
                    <Clock3 />
                    {dateTime(booking.startAt,booking.timezone)}
                  </time>
                  <h3>{booking.clientName}</h3>
                  <p>{booking.services.map((item) => item.name).join(' + ')}</p>
                  <span>{booking.clientPhone}</span>
                  <div>
                    <Button
                      disabled={working}
                      onClick={() =>
                        void action(
                          {
                            action: 'booking.status',
                            bookingId: booking.id,
                            status: 'completed',
                          },
                          'Atendimento concluído.',
                        )
                      }
                    >
                      <Check /> Concluir
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={working}
                      onClick={() =>
                        void action(
                          {
                            action: 'booking.status',
                            bookingId: booking.id,
                            status: 'no_show',
                          },
                          'Não comparecimento registrado.',
                        )
                      }
                    >
                      Não compareceu
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-state">
                Nenhum atendimento futuro nesta agenda.
              </div>
            )}
          </section>
          <aside className="professional-block">
            <h2>Bloquear meu período</h2>
            <p>Bloqueios com conflito não são criados.</p>
            <Label>
              Início
              <Input
                type="datetime-local"
                value={block.startAt}
                onChange={(event) =>
                  setBlock({ ...block, startAt: event.target.value })
                }
              />
            </Label>
            <Label>
              Fim
              <Input
                type="datetime-local"
                value={block.endAt}
                onChange={(event) =>
                  setBlock({ ...block, endAt: event.target.value })
                }
              />
            </Label>
            <Label>
              Motivo
              <Input
                value={block.reason}
                onChange={(event) =>
                  setBlock({ ...block, reason: event.target.value })
                }
                placeholder="Ex.: compromisso"
              />
            </Label>
            <Button
              disabled={working || block.reason.length < 3}
              onClick={() =>
                void action(
                  {
                    action: 'block.create',
                    startAt: block.startAt,
                    endAt: block.endAt,
                    reason: block.reason,
                  },
                  'Período bloqueado.',
                )
              }
            >
              <Ban /> Bloquear período
            </Button>
          </aside>
        </div>
      )}
    </div>
  );
}
