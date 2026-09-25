'use client';
import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  MessageCircle,
  Phone,
  Check,
  Clock3,
} from 'lucide-react';
import {
  agendaDate,
  agendaTime,
  filterAgenda,
  bookingStatusLabels,
} from '@/lib/agenda-export';
import { Button } from './ui/button';
import { Input } from './ui/input';
import type {
  Action,
  ManagedBooking,
  ManagementData,
} from './management-forms';

export function DayAgenda({
  bookings,
  data,
  working,
  action,
  refresh,
  openAgenda,
}: {
  bookings: ManagedBooking[];
  data: ManagementData;
  working: boolean;
  action: Action;
  refresh: () => void;
  openAgenda: () => void;
}) {
  const zone = data.timezone || 'America/Sao_Paulo';
  const [date, setDate] = useState(agendaDate(new Date().toISOString(), zone)),
    [professional, setProfessional] = useState(''),
    [status, setStatus] = useState(''),
    [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false),
    [error, setError] = useState('');
  const visible = filterAgenda(
    bookings,
    { date, professional, status, search },
    zone,
  );
  const active = visible.filter((b) =>
    ['confirmed', 'pending'].includes(b.status),
  );
  const completed = visible.filter((b) => b.status === 'completed');
  function move(days: number) {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }
  async function exportDay() {
    setExporting(true);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/export?${new URLSearchParams({ date, professional, status, search })}`,
      );
      if (!response.ok)
        throw new Error(
          'Não foi possível exportar. Confira sua sessão e tente novamente.',
        );
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexius-agenda-${date}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha ao exportar.');
    } finally {
      setExporting(false);
    }
  }
  return (
    <section className="day-agenda">
      <header className="day-heading">
        <div>
          <p className="eyebrow">NEXIUS / OPERAÇÃO</p>
          <h1>
            Agenda do dia<span>.</span>
          </h1>
          <p>Todos os horários, sem perder o ritmo.</p>
        </div>
        <div className="day-tools">
          <Button variant="outline" onClick={refresh} disabled={working}>
            <RefreshCw size={17} />
            Atualizar
          </Button>
          <Button onClick={() => void exportDay()} disabled={exporting}>
            <Download size={17} />
            {exporting ? 'Gerando…' : 'Baixar planilha'}
          </Button>
        </div>
      </header>
      {error && (
        <p role="alert" className="admin-alert error">
          {error}
        </p>
      )}
      <div className="day-toolbar">
        <div className="day-navigation">
          <Button
            aria-label="Dia anterior"
            variant="outline"
            onClick={() => move(-1)}
          >
            <ChevronLeft />
          </Button>
          <label>
            <span className="sr-only">Dia da agenda</span>
            <Input
              type="date"
              required
              value={date}
              onChange={(e) => {
                if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value))
                  setDate(e.target.value);
              }}
            />
          </label>
          <Button
            aria-label="Próximo dia"
            variant="outline"
            onClick={() => move(1)}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            onClick={() => setDate(agendaDate(new Date().toISOString(), zone))}
          >
            Hoje
          </Button>
        </div>
        <Button variant="outline" onClick={openAgenda}>
          <CalendarDays size={18} />
          Nova reserva / semana
        </Button>
      </div>
      <div className="day-stats">
        <article>
          <Clock3 />
          <span>
            A atender<strong>{active.length}</strong>
          </span>
        </article>
        <article>
          <Check />
          <span>
            Concluídos<strong>{completed.length}</strong>
          </span>
        </article>
        <article>
          <CalendarDays />
          <span>
            Total no filtro<strong>{visible.length}</strong>
          </span>
        </article>
      </div>
      <div className="day-filters">
        <label>
          Profissional
          <select
            value={professional}
            onChange={(e) => setProfessional(e.target.value)}
          >
            <option value="">Toda a equipe</option>
            {data.professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Situação
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(bookingStatusLabels).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Buscar cliente ou telefone
          <Input
            placeholder="Nome, telefone ou referência"
            value={search}
            maxLength={100}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="day-list" aria-label="Atendimentos do dia">
        <div className="day-table-head" aria-hidden="true">
          <span>Horário</span>
          <span>Cliente / serviço</span>
          <span>Profissional</span>
          <span>Situação</span>
          <span>Ações</span>
        </div>
        {visible.map((b) => {
          const digits = b.clientPhone.replace(/\D/g, '');
          const phone = digits.length <= 11 ? `55${digits}` : digits;
          const message = `Olá, ${b.clientName}! Aqui é da Nexius Barber. Sobre seu agendamento ${b.reference}, dia ${date.split('-').reverse().join('/')} às ${agendaTime(b.startAt, zone)}, com ${b.professionalName}:`;
          return (
            <article className={`day-booking day-${b.status}`} key={b.id}>
              <time dateTime={b.startAt}>
                <strong>{agendaTime(b.startAt, zone)}</strong>
                <small>até {agendaTime(b.endAt, zone)}</small>
              </time>
              <div className="day-client">
                <h2>{b.clientName}</h2>
                <p>{b.services.map((s) => s.name).join(' + ')}</p>
                <small>
                  {(b.totalCents / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })}{' '}
                  · {b.reference}
                </small>
              </div>
              <span className="day-professional">{b.professionalName}</span>
              <span className={`status status-${b.status}`}>
                {bookingStatusLabels[b.status]}
              </span>
              <div className="day-actions">
                <a
                  title="Conversar com o cliente"
                  aria-label={`WhatsApp de ${b.clientName}`}
                  href={`https://wa.me/${phone}?text=${encodeURIComponent(message)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={19} />
                </a>
                <a
                  title={b.clientPhone}
                  aria-label={`Ligar para ${b.clientName}`}
                  href={`tel:+${phone}`}
                >
                  <Phone size={18} />
                </a>
                {['confirmed', 'pending'].includes(b.status) && (
                  <Button
                    variant="outline"
                    disabled={working}
                    onClick={() => {
                      if (
                        confirm(
                          `Marcar ${b.clientName}, ${agendaTime(b.startAt, zone)}, como concluído?`,
                        )
                      )
                        void action(
                          {
                            action: 'booking.status',
                            bookingId: b.id,
                            status: 'completed',
                          },
                          'Atendimento concluído.',
                        );
                    }}
                  >
                    <Check size={17} />
                    Concluir
                  </Button>
                )}
              </div>
            </article>
          );
        })}
        {!visible.length && (
          <div className="day-empty">
            <CalendarDays />
            <h2>Nenhum atendimento neste filtro</h2>
            <p>Escolha outro dia ou crie uma reserva manual.</p>
            <Button onClick={openAgenda}>Abrir agenda completa</Button>
          </div>
        )}
      </div>
      <p className="day-footnote">
        Atualização automática a cada minuto. Horários em {zone}. A planilha CSV
        abre no Excel e respeita os filtros acima; contém dados de clientes,
        guarde em local seguro.
      </p>
    </section>
  );
}
