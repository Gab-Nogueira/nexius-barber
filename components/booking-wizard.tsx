'use client';
import '@/app/booking-enhancements.css';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Search,
  ShieldCheck,
  UserRound,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';

type Service = {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMinutes: number;
  source: 'observed' | 'demo' | 'validated';
  requiresServiceId: string | null;
  comboServiceIdsJson: string;
};
type Professional = {
  id: string;
  name: string;
  serviceIds: string[];
  pricing: Array<{
    serviceId: string;
    priceCents: number | null;
    durationMinutes: number | null;
  }>;
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
  cancellationLimitHours: number;
};
type Booking = {
  id: string;
  reference: string;
  status: string;
  timezone: string;
  professionalName: string;
  startAt: string;
  endAt: string;
  totalCents: number;
  services: Array<{
    id: string;
    name: string;
    priceCents: number;
    durationMinutes: number;
  }>;
};

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function localIsoDate(offset: number, timeZone = 'America/Sao_Paulo') {
  const date = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
    .format(new Date(`${date}T12:00:00Z`))
    .replace('.', '');
}

function formatDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function makeIdempotencyKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `nexius-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

declare global {
  interface Document {
    modelContext?: {
      registerTool(
        tool: {
          name: string;
          title?: string;
          description: string;
          inputSchema: object;
          annotations?: {
            readOnlyHint?: boolean;
            untrustedContentHint?: boolean;
          };
          execute(input: unknown): unknown;
        },
        options?: { signal?: AbortSignal },
      ): void | Promise<void>;
    };
  }
}

export function BookingWizard({
  initialServiceId,
  initialProfessionalId,
  initialAttemptKey,
  accountName,
}: {
  initialServiceId?: string;
  initialProfessionalId?: string;
  initialAttemptKey?: string;
  accountName?: string;
}) {
  const [step, setStep] = useState(1);
  const [signedIn, setSignedIn] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [openWhatsApp, setOpenWhatsApp] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialServiceId ? initialServiceId.split(',') : [],
  );
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [professionalChoice, setProfessionalChoice] = useState(
    initialProfessionalId ?? 'first',
  );
  const [date, setDate] = useState(localIsoDate(1));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [name, setName] = useState(accountName ?? '');
  const [phone, setPhone] = useState('');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => initialAttemptKey && /^[a-zA-Z0-9_-]{12,100}$/.test(initialAttemptKey) ? initialAttemptKey : makeIdempotencyKey());
  const [settings, setSettings] = useState({
    bookingHorizonDays: 30,
    cancellationLimitHours: 4,
    timezone: 'America/Sao_Paulo',
  });
  const fullDateTime = (iso: string) => formatDateTime(iso, booking?.timezone || settings.timezone);
  const [catalogReady, setCatalogReady] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    void fetch('/api/session', { method: 'POST' }).then(r => { if (r.ok) setSignedIn(true); }).catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch('/api/catalog', { cache: 'no-store' })
      .then(async (response) => {
        const data = (await response.json()) as {
          error?: string;
          services: Service[];
          professionals: Professional[];
          settings: typeof settings;
        };
        if (!response.ok)
          throw new Error(
            data.error || 'Não foi possível carregar os serviços.',
          );
        setServices(data.services);
        setProfessionals(data.professionals);
        setSettings(data.settings);
        // Older builds silently restored an unfinished flow here. That made
        // identical "Agendar" links appear to open different schedulers.
        // Every new entry now starts at step one; only a confirmed reservation
        // identified by `reserva` can be recovered.
        try {
          sessionStorage.removeItem('nexius-booking-draft');
        } catch {
          /* An unavailable storage never blocks booking. */
        }
        setCatalogReady(true);
        if (initialServiceId)
          setSelectedIds(
            initialServiceId
              .split(',')
              .filter((id) => data.services.some((item) => item.id === id)),
          );
      })
      .catch((caught) => setError(caught.message))
      .finally(() => setLoading(false));
  }, [initialServiceId, initialProfessionalId]);

  useEffect(() => {
    if (!catalogReady || !signedIn || !initialAttemptKey) return;
    void fetch(
      `/api/bookings/attempt?key=${encodeURIComponent(idempotencyKey)}`,
    )
      .then(async (response) => {
        if (response.ok) {
          const payload = (await response.json()) as { booking: Booking; whatsappUrl?: string | null };
          setBooking(payload.booking);
          setWhatsappUrl(payload.whatsappUrl || null);
          setStep(5);
        }
      })
      .catch(() => undefined);
  }, [catalogReady, signedIn, idempotencyKey, initialAttemptKey]);

  useEffect(() => {
    if (step !== 3 || !selectedIds.length) return;
    const controller = new AbortController();
    setSlotsLoading(true);
    setSelectedSlot(null);
    setError('');
    const params = new URLSearchParams({ date });
    selectedIds.forEach((id) => params.append('service', id));
    if (professionalChoice !== 'first')
      params.set('professional', professionalChoice);
    fetch(`/api/availability?${params}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          error?: string;
          slots: Slot[];
        };
        if (!response.ok)
          throw new Error(
            data.error || 'Não foi possível consultar os horários.',
          );
        setSlots(data.slots);
      })
      .catch((caught) => {
        if (caught.name !== 'AbortError') setError(caught.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setSlotsLoading(false);
      });
    return () => controller.abort();
  }, [step, date, professionalChoice, selectedIds]);

  useEffect(() => {
    if (step > 1) titleRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'stage_nexius_booking',
          title: 'Preparar agendamento Nexius',
          description:
            'Seleciona serviços disponíveis e abre a próxima etapa do agendamento visível, sem confirmar uma reserva.',
          inputSchema: {
            type: 'object',
            properties: {
              serviceIds: {
                type: 'array',
                items: { type: 'string' },
                minItems: 1,
                maxItems: 5,
              },
            },
            required: ['serviceIds'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input) {
            const ids = (input as { serviceIds?: unknown }).serviceIds;
            if (
              !Array.isArray(ids) ||
              !ids.every(
                (id) =>
                  typeof id === 'string' &&
                  services.some((service) => service.id === id),
              )
            ) {
              throw new Error('Informe de um a cinco IDs de serviços válidos.');
            }
            const unique = Array.from(new Set(ids));
            setSelectedIds(unique);
            setProfessionalChoice('first');
            setSelectedSlot(null);
            setStep(2);
            return {
              staged: true,
              serviceIds: unique,
              nextStep: 'professional',
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [services]);

  const selectedServices = useMemo(
    () =>
      services
        .filter((service) => selectedIds.includes(service.id))
        .map((service) => {
          const pricing = professionals
            .find(
              (pro) =>
                pro.id === (selectedSlot?.professionalId || professionalChoice),
            )
            ?.pricing?.find((item) => item.serviceId === service.id);
          return {
            ...service,
            priceCents: pricing?.priceCents ?? service.priceCents,
            durationMinutes:
              pricing?.durationMinutes ?? service.durationMinutes,
          };
        }),
    [services, selectedIds, professionalChoice, professionals, selectedSlot],
  );
  const totalCents =
    booking?.totalCents ??
    selectedSlot?.totalCents ??
    selectedServices.reduce((sum, service) => sum + service.priceCents, 0);
  const totalMinutes =
    selectedSlot?.durationMinutes ??
    selectedServices.reduce((sum, service) => sum + service.durationMinutes, 0);
  const validSelection =
    selectedIds.length > 0 &&
    selectedServices.every(
      (service) =>
        !service.requiresServiceId ||
        selectedIds.includes(service.requiresServiceId),
    );
  const eligibleProfessionals = professionals.filter((professional) =>
    selectedIds.every((id) => professional.serviceIds.includes(id)),
  );
  const categories = Array.from(
    new Set(services.map((service) => service.categoryName)),
  );
  const normalizedSearch = search
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const entryProfessional = initialProfessionalId
    ? professionals.find((item) => item.id === initialProfessionalId)
    : undefined;
  const entryProfessionalSelected = Boolean(
    entryProfessional &&
      professionalChoice === entryProfessional.id &&
      eligibleProfessionals.some((item) => item.id === entryProfessional.id),
  );
  const displayedStep = entryProfessionalSelected
    ? step === 1
      ? 1
      : step === 3
        ? 2
        : step === 4
          ? 3
          : step === 5
            ? 4
            : step
    : Math.min(step, 5);
  const displayedStepTotal = entryProfessionalSelected ? 4 : 5;
  const displayedProgress = (displayedStep / displayedStepTotal) * 100;
  const visibleServices = services.filter((service) => {
    const categoryMatches =
      category === 'all' || service.categoryName === category;
    const haystack = `${service.name} ${service.description ?? ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return (
      categoryMatches &&
      haystack.includes(normalizedSearch) &&
      (!entryProfessionalSelected ||
        entryProfessional?.serviceIds.includes(service.id))
    );
  });

  function toggleService(service: Service) {
    setError('');
    setSelectedSlot(null);
    setProfessionalChoice((current) =>
      current === 'first' ||
      professionals.some(
        (professional) =>
          professional.id === current &&
          professional.serviceIds.includes(service.id),
      )
        ? current
        : 'first',
    );
    setSelectedIds((current) => {
      if (current.includes(service.id))
        return current.filter(
          (id) =>
            id !== service.id &&
            services.find((item) => item.id === id)?.requiresServiceId !==
              service.id,
        );
      if (current.length >= 5) {
        setError('Escolha no máximo cinco serviços por reserva.');
        return current;
      }
      if (
        service.requiresServiceId &&
        !current.includes(service.requiresServiceId)
      ) {
        setError('Selecione primeiro o serviço principal deste adicional.');
        return current;
      }
      return [...current, service.id];
    });
  }

  async function confirmBooking() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError('');
    try {
      const session = await fetch('/api/session', { method: 'POST' });
      if (!session.ok) throw new Error('Não foi possível proteger sua sessão. Tente novamente.');
      setSignedIn(true);
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceIds: selectedIds,
          professionalId: selectedSlot.professionalId,
          startAt: selectedSlot.startAt,
          name,
          phone,
          idempotencyKey,
          quoteRevision: selectedSlot.quoteRevision,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        code?: string;
        booking: Booking;
        whatsappUrl?: string | null;
      };
      if (!response.ok) {
        if (
          data.code === 'slot_conflict' ||
          data.code === 'configuration_changed'
        ) {
          setStep(3);
          setSelectedSlot(null);
          setIdempotencyKey(makeIdempotencyKey());
        }
        throw new Error(
          data.error || 'Não foi possível confirmar o agendamento.',
        );
      }
      setBooking(data.booking);
      setWhatsappUrl(data.whatsappUrl || null);
      setStep(5);
      window.history.replaceState(null, '', `/agendar?reserva=${encodeURIComponent(idempotencyKey)}`);
      // Same-tab navigation works on mobile without opening an unrequested blank popup.
      // The booking is already persisted; returning never creates another booking.
      if (openWhatsApp && data.whatsappUrl) window.location.assign(data.whatsappUrl);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Não foi possível confirmar o agendamento.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function nextAvailable() {
    setSlotsLoading(true);
    setError('');
    try {
      const last = localIsoDate(settings.bookingHorizonDays, settings.timezone);
      for (let offset = 1; offset <= settings.bookingHorizonDays; offset++) {
        const candidate = new Date(`${date}T12:00:00Z`);
        candidate.setUTCDate(candidate.getUTCDate() + offset);
        const next = candidate.toISOString().slice(0, 10);
        if (next > last) break;
        const params = new URLSearchParams({ date: next });
        selectedIds.forEach((id) => params.append('service', id));
        if (professionalChoice !== 'first')
          params.set('professional', professionalChoice);
        const response = await fetch(`/api/availability?${params}`);
        const payload = (await response.json()) as {
          slots?: Slot[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error);
        if (payload.slots?.length) {
          setDate(next);
          return;
        }
      }
      setError(
        'Não há horário disponível até o fim do período de reservas. Edite serviços ou profissional.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha na consulta.');
    } finally {
      setSlotsLoading(false);
    }
  }
  const dates = Array.from({ length: 7 }, (_, index) =>
    localIsoDate(index, settings.timezone),
  );
  const periodGroups = [
    {
      label: 'Manhã',
      slots: slots.filter((slot) => Number(slot.time.slice(0, 2)) < 12),
    },
    {
      label: 'Tarde',
      slots: slots.filter(
        (slot) =>
          Number(slot.time.slice(0, 2)) >= 12 &&
          Number(slot.time.slice(0, 2)) < 18,
      ),
    },
    {
      label: 'Noite',
      slots: slots.filter((slot) => Number(slot.time.slice(0, 2)) >= 18),
    },
  ].filter((group) => group.slots.length);

  return (
    <div className="booking-layout">
      <section className="booking-main" aria-labelledby="booking-title">
        <div className="booking-progress-copy">
          <span>Etapa {displayedStep} de {displayedStepTotal}</span>
          <span>{Math.round(displayedProgress)}%</span>
        </div>
        <Progress
          value={displayedProgress}
          className="booking-progress"
          aria-label={`Etapa ${displayedStep} de ${displayedStepTotal}`}
        />

        {error && (
          <div className="booking-error" role="alert">
            {error}
            <button
              type="button"
              onClick={() => setError('')}
              aria-label="Fechar mensagem"
            >
              ×
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="wizard-panel">
            <p className="wizard-kicker">01 / SERVIÇOS</p>
            <h1 id="booking-title" ref={titleRef} tabIndex={-1}>
              O que você quer agendar?
            </h1>
            <p className="wizard-lead">
              Encontre rapidamente pelo nome ou categoria. Você pode combinar
              serviços compatíveis.
            </p>
            {!loading &&
              (selectedServices.length > 0 || entryProfessionalSelected) && (
              <div className="booking-entry-note" role="status">
                <Check aria-hidden="true" size={17} />
                <span>
                  {selectedServices.length > 0 && (
                    <>
                      <strong>{selectedServices.map((service) => service.name).join(' + ')}</strong>{' '}
                      já está {selectedServices.length === 1 ? 'marcado' : 'marcados'}.
                    </>
                  )}
                  {selectedServices.length > 0 && entryProfessionalSelected
                    ? ' '
                    : null}
                  {entryProfessionalSelected && entryProfessional && (
                    <>
                      Você está vendo os serviços de{' '}
                      <strong>{entryProfessional.name}</strong>.
                    </>
                  )}{' '}
                  Você pode trocar qualquer opção antes de continuar.
                </span>
                {entryProfessionalSelected && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfessionalChoice('first');
                      setSelectedSlot(null);
                    }}
                  >
                    Ver todos
                  </button>
                )}
              </div>
            )}
            <div className="service-controls">
              <Label className="search-box">
                <Search aria-hidden="true" size={18} />
                <span className="sr-only">Buscar serviço</span>
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar serviço"
                />
              </Label>
              <div className="category-row" aria-label="Filtrar por categoria">
                <button
                  className={category === 'all' ? 'active' : ''}
                  onClick={() => setCategory('all')}
                >
                  Todos
                </button>
                {categories.map((item) => (
                  <button
                    key={item}
                    className={category === item ? 'active' : ''}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <p className="result-count">
              {visibleServices.length}{' '}
              {visibleServices.length === 1 ? 'resultado' : 'resultados'}
            </p>
            {loading ? (
              <div className="loading-state" role="status">
                Carregando catálogo…
              </div>
            ) : visibleServices.length ? (
              <div className="service-list">
                {visibleServices.map((service) => {
                  const selected = selectedIds.includes(service.id);
                  return (
                    <button
                      key={service.id}
                      type="button"
                      className={`service-row ${selected ? 'selected' : ''}`}
                      onClick={() => toggleService(service)}
                      aria-pressed={selected}
                    >
                      <span className="service-check" aria-hidden="true">
                        {selected ? <Check size={16} /> : '+'}
                      </span>
                      <span className="service-copy">
                        <strong>{service.name}</strong>
                        <small>{service.description}</small>
                        {service.source === 'demo' && (
                          <em>Exemplo da demonstração</em>
                        )}
                      </span>
                      <span className="service-meta">
                        <strong>{money(service.priceCents)}</strong>
                        <small>{service.durationMinutes} min*</small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <p>Nenhum serviço encontrado.</p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setCategory('all');
                  }}
                >
                  Limpar filtros
                </Button>
              </div>
            )}
            <p className="data-note">
              * Durações e grade são sintéticas na demonstração e precisam de
              validação antes do uso real.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="wizard-panel">
            <button className="step-back" onClick={() => setStep(1)}>
              <ArrowLeft size={17} /> Serviços
            </button>
            <p className="wizard-kicker">02 / PROFISSIONAL</p>
            <h1 id="booking-title" ref={titleRef} tabIndex={-1}>
              Com quem você prefere?
            </h1>
            <p className="wizard-lead">
              Mostramos apenas profissionais habilitados para todos os serviços
              escolhidos.
            </p>
            <div className="professional-grid">
              <button
                className={`professional-card ${professionalChoice === 'first' ? 'selected' : ''}`}
                onClick={() => setProfessionalChoice('first')}
                aria-pressed={professionalChoice === 'first'}
              >
                <div className="professional-avatar">
                  <Clock3 aria-hidden="true" />
                </div>
                <div>
                  <strong>Primeiro horário disponível</strong>
                  <span>
                    O sistema mostra quem atenderá antes da confirmação.
                  </span>
                </div>
                {professionalChoice === 'first' && <Check aria-hidden="true" />}
              </button>
              {eligibleProfessionals.map((professional) => (
                <button
                  key={professional.id}
                  className={`professional-card ${professionalChoice === professional.id ? 'selected' : ''}`}
                  onClick={() => setProfessionalChoice(professional.id)}
                  aria-pressed={professionalChoice === professional.id}
                >
                  <div className="professional-avatar">
                    <UserRound aria-hidden="true" />
                  </div>
                  <div>
                    <strong>{professional.name}</strong>
                    <span>
                      Nome observado na agenda atual. Perfil em validação.
                    </span>
                  </div>
                  {professionalChoice === professional.id && (
                    <Check aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
            {!eligibleProfessionals.length && (
              <div className="empty-state">
                <p>
                  Ninguém atende esta combinação. Edite os serviços para
                  continuar.
                </p>
                <Button variant="outline" onClick={() => setStep(1)}>
                  Editar serviços
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="wizard-panel">
            <button
              className="step-back"
              onClick={() => setStep(entryProfessionalSelected ? 1 : 2)}
            >
              <ArrowLeft size={17} />
              {entryProfessionalSelected ? 'Serviços' : 'Profissional'}
            </button>
            <p className="wizard-kicker">03 / DATA E HORÁRIO</p>
            <h1 id="booking-title" ref={titleRef} tabIndex={-1}>
              Escolha seu horário.
            </h1>
            <p className="wizard-lead">
              O horário é indicativo até a confirmação. A agenda será verificada
              novamente no servidor.
            </p>
            <div className="date-strip" aria-label="Escolher data">
              {dates.map((item) => (
                <button
                  key={item}
                  className={date === item ? 'active' : ''}
                  onClick={() => setDate(item)}
                >
                  <span>{dateLabel(item).split(' ')[0]}</span>
                  {dateLabel(item).split(' ').slice(1).join(' ')}
                </button>
              ))}
            </div>
            <Label>
              Outra data ({settings.timezone})
              <Input
                type="date"
                min={localIsoDate(0, settings.timezone)}
                max={localIsoDate(
                  settings.bookingHorizonDays,
                  settings.timezone,
                )}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </Label>
            {slotsLoading ? (
              <div className="loading-state" role="status">
                Consultando agenda…
              </div>
            ) : periodGroups.length ? (
              <div className="slot-groups">
                {periodGroups.map((group) => (
                  <section key={group.label}>
                    <h2>{group.label}</h2>
                    <div className="slot-grid">
                      {group.slots.map((slot) => {
                        const selected =
                          selectedSlot?.startAt === slot.startAt &&
                          selectedSlot?.professionalId === slot.professionalId;
                        return (
                          <button
                            key={`${slot.professionalId}-${slot.startAt}`}
                            className={selected ? 'selected' : ''}
                            onClick={() => setSelectedSlot(slot)}
                            aria-pressed={selected}
                          >
                            <strong>{slot.time}</strong>
                            {professionalChoice === 'first' && (
                              <small>{slot.professionalName}</small>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>Não há horários para esta data.</p>
                <Button variant="outline" onClick={() => void nextAvailable()}>
                  Buscar próxima data disponível
                </Button>
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="wizard-panel">
            <button className="step-back" onClick={() => setStep(3)}>
              <ArrowLeft size={17} /> Horário
            </button>
            <p className="wizard-kicker">04 / REVISÃO</p>
            <h1 id="booking-title" ref={titleRef} tabIndex={-1}>
              Revise e confirme.
            </h1>
            {selectedSlot && (
              <div className="review-box">
                <h2>Resumo antes de confirmar</h2>
                <p>
                  {selectedServices.map((service) => service.name).join(' + ')}
                </p>
                <dl>
                  <div>
                    <dt>Profissional</dt>
                    <dd>{selectedSlot.professionalName}</dd>
                  </div>
                  <div>
                    <dt>Início</dt>
                    <dd>{fullDateTime(selectedSlot.startAt)}</dd>
                  </div>
                  <div>
                    <dt>Fim estimado</dt>
                    <dd>{fullDateTime(selectedSlot.endAt)}</dd>
                  </div>
                  <div>
                    <dt>Total oficial</dt>
                    <dd>
                      {money(selectedSlot.totalCents)} ·{' '}
                      {selectedSlot.durationMinutes} min
                    </dd>
                  </div>
                </dl>
                <p>
                  Cancelar ou remarcar online até{' '}
                  {selectedSlot.cancellationLimitHours} horas antes. Política
                  demonstrativa; sem cobrança.
                </p>
                <Button variant="outline" onClick={() => setStep(1)}>
                  Editar serviços
                </Button>
              </div>
            )}
              <div className="identity-form">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone de contato</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(12) 98888-8888"
                  />
                </div>
                <p>
                  <ShieldCheck aria-hidden="true" size={18} /> Seus dados são
                  usados para o agendamento. Sem senha ou criação de conta.
                </p>
                <label className="whatsapp-opt"><input type="checkbox" checked={openWhatsApp} onChange={e => setOpenWhatsApp(e.target.checked)} />Abrir WhatsApp com a mensagem pronta após confirmar (quando configurado).</label>
                <p>Você revisa a mensagem e toca em Enviar. A reserva já fica salva na agenda mesmo se não enviar.</p>
              </div>
          </div>
        )}

        {step === 5 && booking && (
          <div className="wizard-panel success-panel">
            <div className="success-check">
              <Check aria-hidden="true" />
            </div>
            <p className="wizard-kicker">RESERVA CRIADA</p>
            <h1 id="booking-title" ref={titleRef} tabIndex={-1}>
              {booking.status === 'cancelled' ? 'Este agendamento foi cancelado.' : booking.status === 'completed' ? 'Atendimento concluído.' : booking.status === 'pending' ? 'Aguardando confirmação.' : booking.status === 'no_show' ? 'Não comparecimento registrado.' : 'Horário confirmado na demonstração.'}
            </h1>
            <p className="wizard-lead">
              Referência <strong>{booking.reference}</strong>. Nenhuma mensagem
              externa foi enviada.
            </p>
            <div className="review-box">
              <p>
                {booking.services.map((service) => service.name).join(' + ')}
              </p>
              <p>{booking.professionalName}</p>
              <p>{fullDateTime(booking.startAt)}</p>
              <p>Fim estimado: {fullDateTime(booking.endAt)}</p>
              <strong>{money(booking.totalCents)}</strong>
            </div>
            <div className="success-actions">
              {whatsappUrl && <a className="button button-whatsapp" href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle />Enviar resumo no WhatsApp</a>}
              <a className="button button-primary" href="/cliente">
                Meus agendamentos
              </a>
              <a
                className="button button-ghost"
                href={`/api/bookings/${booking.id}/calendar`}
              >
                Adicionar ao calendário
              </a>
            </div>
            <p className="wizard-lead">Para cancelar ou remarcar, use “Meus agendamentos” neste aparelho, dentro do prazo, ou fale com a barbearia. Guarde sua referência. Nome e telefone não dão acesso ao histórico em outro aparelho.</p>
            {!whatsappUrl && <p className="muted">O WhatsApp da barbearia ainda precisa ser confirmado na gestão.</p>}
          </div>
        )}
      </section>

      <aside
        className="booking-summary"
        aria-label="Resumo do agendamento"
        aria-live="polite"
      >
        <div className="mobile-summary-total">
          <span>
            {selectedServices.length}{' '}
            {selectedServices.length === 1 ? 'serviço' : 'serviços'} ·{' '}
            {totalMinutes} min
          </span>
          <strong>{money(totalCents)}</strong>
        </div>
        <p className="summary-label">Seu agendamento</p>
        <h2>
          {selectedServices.length
            ? `${selectedServices.length} ${selectedServices.length === 1 ? 'serviço' : 'serviços'}`
            : 'Comece pelos serviços'}
        </h2>
        <div className="summary-services">
          {selectedServices.map((service) => (
            <div key={service.id}>
              <span>{service.name}</span>
              <strong>{money(service.priceCents)}</strong>
            </div>
          ))}
        </div>
        {selectedServices.length > 0 && (
          <>
            <dl>
              <div>
                <dt>Tempo estimado</dt>
                <dd>{totalMinutes} min*</dd>
              </div>
              <div>
                <dt>
                  {selectedSlot ? 'Total oficial' : 'Total de referência'}
                </dt>
                <dd>{money(totalCents)}</dd>
              </div>
              {selectedSlot && (
                <>
                  <div>
                    <dt>Profissional</dt>
                    <dd>{selectedSlot.professionalName}</dd>
                  </div>
                  <div>
                    <dt>Quando</dt>
                    <dd>{fullDateTime(selectedSlot.startAt)}</dd>
                  </div>
                  <div>
                    <dt>Fim estimado</dt>
                    <dd>{fullDateTime(selectedSlot.endAt)}</dd>
                  </div>
                </>
              )}
            </dl>
            <p className="summary-policy">
              Cancelar/remarcar online até{' '}
              {selectedSlot?.cancellationLimitHours ??
                settings.cancellationLimitHours}{' '}
              horas antes. Valores podem variar por profissional; confira o
              total oficial antes de confirmar.
            </p>
            {step === 4 && (
              <Button variant="outline" onClick={() => setStep(1)}>
                Editar serviços
              </Button>
            )}
          </>
        )}
        {step < 4 && (
          <Button
            size="lg"
            className="summary-next"
            disabled={
              (step === 1 && !validSelection) ||
              (step === 2 &&
                (!eligibleProfessionals.length ||
                  (professionalChoice !== 'first' &&
                    !eligibleProfessionals.some(
                      (pro) => pro.id === professionalChoice,
                    )))) ||
              (step === 3 && !selectedSlot)
            }
            onClick={() =>
              setStep((current) =>
                current === 1 && entryProfessionalSelected ? 3 : current + 1,
              )
            }
          >
            Continuar <ArrowRight aria-hidden="true" />
          </Button>
        )}
        {step === 4 && (
          <Button
            size="lg"
            className="summary-next"
            disabled={
              submitting ||
              !name.trim() ||
              phone.replace(/\D/g, '').length < 10 ||
              !selectedSlot
            }
            onClick={confirmBooking}
          >
            {submitting ? 'Confirmando…' : 'Confirmar agendamento'}{' '}
            <Check aria-hidden="true" />
          </Button>
        )}
        {step === 5 && (
          <p className="summary-confirmed">
            <Check aria-hidden="true" /> Persistido no banco da demonstração
          </p>
        )}
      </aside>
    </div>
  );
}
