'use client';

import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { MediaPicker as PhotoSelect } from './media-picker';

type Category = {
  id: string;
  name: string;
  active: number;
  displayOrder: number;
};
type Service = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
  active: number;
  source: string;
  displayOrder: number;
  requiresServiceId: string | null;
  photoId: string | null;
  comboServiceIdsJson: string;
};
type Professional = {
  id: string;
  name: string;
  userId: string | null;
  active: number;
  photoId: string | null;
  displayOrder: number;
};
type Schedule = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
  professionalId?: string;
};
type Relation = {
  professionalId: string;
  serviceId: string;
  priceCents: number | null;
  durationMinutes: number | null;
};
type Media = { id: string; name: string; altText: string };
export type ManagementData = {
  timezone: string;
  services: Service[];
  categories: Category[];
  professionals: Professional[];
  relations: Relation[];
  schedules: Schedule[];
  unit: Schedule[];
  media: Media[];
  content: Record<string, string>;
};
export type Settings = {
  timezone: string;
  cancellationLimitHours: number;
  minimumNoticeMinutes: number;
  bookingHorizonDays: number;
  slotStepMinutes: number;
  defaultBufferMinutes: number;
  policyVersion: string;
};
export type Action = (
  body: Record<string, unknown>,
  success: string,
) => Promise<void>;
export type ManagedBooking = {
  id: string;
  reference: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string | null;
  professionalId: string;
  professionalName: string;
  startAt: string;
  endAt: string;
  status: string;
  totalCents: number;
  services: Array<{ id: string; name: string }>;
};
type Props = { data: ManagementData; action: Action; working: boolean };
export const statusLabels: Record<string, string> = {
  confirmed: 'Confirmado',
  pending: 'Pendente',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  no_show: 'Não compareceu',
};
const days = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];
const money = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const time = (value: number | null) =>
  value == null
    ? ''
    : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
const minute = (value: string) =>
  value ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5)) : null;
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

function CategoryEditor({
  category,
  action,
  working,
}: {
  category?: Category;
  action: Action;
  working: boolean;
}) {
  const [value, setValue] = useState({
    name: category?.name || '',
    active: category ? !!category.active : true,
    displayOrder: category?.displayOrder || 0,
  });
  return (
    <form
      className="management-form"
      onSubmit={(event) => {
        event.preventDefault();
        void action(
          { action: 'category.save', id: category?.id, ...value },
          'Categoria salva.',
        );
      }}
    >
      <label>
        Nome
        <Input
          required
          minLength={2}
          value={value.name}
          onChange={(event) => setValue({ ...value, name: event.target.value })}
        />
      </label>
      <label>
        Ordem
        <Input
          type="number"
          min={0}
          value={value.displayOrder}
          onChange={(event) =>
            setValue({ ...value, displayOrder: Number(event.target.value) })
          }
        />
      </label>
      <label className="check-label">
        <input
          type="checkbox"
          checked={value.active}
          onChange={(event) =>
            setValue({ ...value, active: event.target.checked })
          }
        />
        Ativa
      </label>
      <Button disabled={working} type="submit">
        Salvar categoria
      </Button>
    </form>
  );
}
function ServiceForm({
  service,
  data,
  action,
  working,
}: Props & { service?: Service }) {
  const [uploading, setUploading] = useState(false);
  const [value, setValue] = useState({
    name: service?.name || '',
    description: service?.description || '',
    categoryId: service?.categoryId || data.categories[0]?.id || '',
    priceCents: service?.priceCents || 0,
    durationMinutes: service?.durationMinutes || 30,
    active: service ? !!service.active : false,
    source: service?.source || 'demo',
    displayOrder: service?.displayOrder || 0,
    requiresServiceId: service?.requiresServiceId || '',
    photoId: service?.photoId || '',
    comboServiceIds: JSON.parse(
      service?.comboServiceIdsJson || '[]',
    ) as string[],
  });
  return (
    <form
      className="management-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (uploading) return;
        void action(
          { action: 'service.save', id: service?.id, ...value },
          'Serviço salvo. Os preços de reservas anteriores foram preservados.',
        );
      }}
    >
      <label>
        Nome
        <Input
          required
          minLength={2}
          maxLength={160}
          value={value.name}
          onChange={(event) => setValue({ ...value, name: event.target.value })}
        />
      </label>
      <label>
        Categoria
        <select
          value={value.categoryId}
          onChange={(event) =>
            setValue({ ...value, categoryId: event.target.value })
          }
        >
          {data.categories.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.active ? '' : ' (inativa)'}
            </option>
          ))}
        </select>
      </label>
      <label className="form-wide">
        Descrição
        <textarea
          maxLength={1000}
          value={value.description}
          onChange={(event) =>
            setValue({ ...value, description: event.target.value })
          }
        />
      </label>
      <label>
        Preço (R$)
        <Input
          type="number"
          min="0"
          step="0.01"
          required
          value={value.priceCents / 100}
          onChange={(event) =>
            setValue({
              ...value,
              priceCents: Math.round(Number(event.target.value) * 100),
            })
          }
        />
      </label>
      <label>
        Duração (min)
        <Input
          type="number"
          min="1"
          max="720"
          required
          value={value.durationMinutes}
          onChange={(event) =>
            setValue({ ...value, durationMinutes: Number(event.target.value) })
          }
        />
      </label>
      <div className="form-wide"><PhotoSelect
        media={data.media}
        value={value.photoId}
        label={`Foto do serviço ${value.name}`}
        onBusyChange={setUploading}
        onChange={(photoId) => setValue(current => ({ ...current, photoId }))}
      /></div>
      <details className="form-wide management-advanced">
        <summary>Opções avançadas (combos e organização)</summary>
        <div className="management-form">
      <label>
        Origem
        <select
          value={value.source}
          onChange={(event) =>
            setValue({ ...value, source: event.target.value })
          }
        >
          <option value="demo">Sintético da demonstração</option>
          <option value="observed">
            Observado nos prints; ainda não validado
          </option>
          <option value="validated">
            Validado pelo proprietário para operação real
          </option>
        </select>
      </label>
      <label>
        Ordem
        <Input
          type="number"
          min={0}
          value={value.displayOrder}
          onChange={(event) =>
            setValue({ ...value, displayOrder: Number(event.target.value) })
          }
        />
      </label>
      <label>
        Adicional depende de
        <select
          value={value.requiresServiceId}
          onChange={(event) =>
            setValue({
              ...value,
              requiresServiceId: event.target.value,
              comboServiceIds: [],
            })
          }
        >
          <option value="">Não é adicional</option>
          {data.services
            .filter(
              (item) =>
                item.id !== service?.id &&
                !item.requiresServiceId &&
                item.comboServiceIdsJson === '[]',
            )
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </select>
      </label>
      <fieldset className="form-wide">
        <legend>
          Componentes do combo (o preço e tempo acima são o total do combo)
        </legend>
        {data.services
          .filter(
            (item) =>
              item.id !== service?.id &&
              !item.requiresServiceId &&
              item.comboServiceIdsJson === '[]',
          )
          .map((item) => (
            <label className="check-label" key={item.id}>
              <input
                type="checkbox"
                disabled={!!value.requiresServiceId}
                checked={value.comboServiceIds.includes(item.id)}
                onChange={(event) =>
                  setValue({
                    ...value,
                    comboServiceIds: event.target.checked
                      ? [...value.comboServiceIds, item.id]
                      : value.comboServiceIds.filter((id) => id !== item.id),
                  })
                }
              />
              {item.name}
            </label>
          ))}
      </fieldset>
        </div>
      </details>
      <label className="check-label">
        <input
          type="checkbox"
          checked={value.active}
          onChange={(event) =>
            setValue({ ...value, active: event.target.checked })
          }
        />
        Ativo no catálogo
      </label>
      <Button disabled={working || uploading} type="submit">
        {uploading ? 'Aguarde a foto…' : 'Salvar serviço'}
      </Button>
    </form>
  );
}
export function CatalogManager(props: Props) {
  const [search, setSearch] = useState('');
  const visible = props.data.services.filter((item) =>
    normalize(`${item.name} ${item.categoryName}`).includes(normalize(search)),
  );
  return (
    <div className="management-stack">
      <div className="admin-heading">
        <h1>Catálogo</h1>
        <Input
          aria-label="Buscar serviço no catálogo"
          placeholder="Buscar por nome ou categoria"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <details className="admin-panel">
        <summary>Novo serviço</summary>
        <ServiceForm {...props} />
      </details>
      {visible.map((service) => (
        <details className="admin-panel" key={service.id} data-service-id={service.id}>
          <summary>
            {service.name}{' '}
            <small>
              {money(service.priceCents)} · {service.durationMinutes} min ·{' '}
              {service.active ? 'Ativo' : 'Inativo'}
            </small>
          </summary>
          <ServiceForm {...props} service={service} />
        </details>
      ))}
      {!visible.length && <p>Nenhum serviço encontrado.</p>}
      <details className="admin-panel">
        <summary>Categorias ({props.data.categories.length})</summary>
        {props.data.categories.map((category) => (
          <details key={category.id}>
            <summary>{category.name}</summary>
            <CategoryEditor
              category={category}
              action={props.action}
              working={props.working}
            />
          </details>
        ))}
        <h3>Nova categoria</h3>
        <CategoryEditor action={props.action} working={props.working} />
      </details>
    </div>
  );
}

function ScheduleEditor({
  rows,
  professionalId,
  action,
  working,
}: {
  rows: Schedule[];
  professionalId?: string;
  action: Action;
  working: boolean;
}) {
  const [value, setValue] = useState(
    days.map((_, weekday) => {
      const row = rows.find((item) => item.weekday === weekday);
      return {
        weekday,
        enabled: !!row,
        start: time(row?.startMinute ?? 540),
        end: time(row?.endMinute ?? 1080),
        pauseStart: time(row?.breakStartMinute ?? null),
        pauseEnd: time(row?.breakEndMinute ?? null),
      };
    }),
  );
  return (
    <form
      className="management-form"
      onSubmit={(event) => {
        event.preventDefault();
        void action(
          {
            action: professionalId ? 'schedule.save' : 'unit.save',
            professionalId,
            schedules: value
              .filter((row) => row.enabled)
              .map((row) => ({
                weekday: row.weekday,
                startMinute: minute(row.start),
                endMinute: minute(row.end),
                breakStartMinute: professionalId
                  ? minute(row.pauseStart)
                  : null,
                breakEndMinute: professionalId ? minute(row.pauseEnd) : null,
              })),
          },
          'Grade salva; nenhuma reserva conflitante foi ocultada.',
        );
      }}
    >
      <p className="form-wide muted">
        Horários no fuso da unidade. Dia desmarcado é folga/fechado. Reservas
        afetadas precisam ser resolvidas antes de salvar.
      </p>
      {value.map((row, index) => (
        <fieldset key={row.weekday} className="schedule-row form-wide">
          <legend>
            <label className="check-label">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(event) =>
                  setValue(
                    value.map((item, i) =>
                      i === index
                        ? { ...item, enabled: event.target.checked }
                        : item,
                    ),
                  )
                }
              />
              {days[row.weekday]}
            </label>
          </legend>
          {(
            [
              'start',
              'end',
              ...(professionalId ? ['pauseStart', 'pauseEnd'] : []),
            ] as Array<'start' | 'end' | 'pauseStart' | 'pauseEnd'>
          ).map((key) => (
            <label key={key}>
              {
                {
                  start: 'Início',
                  end: 'Fim',
                  pauseStart: 'Pausa início',
                  pauseEnd: 'Pausa fim',
                }[key]
              }
              <input
                type="time"
                disabled={!row.enabled}
                required={row.enabled && (key === 'start' || key === 'end')}
                value={row[key]}
                onChange={(event) =>
                  setValue(
                    value.map((item, i) =>
                      i === index
                        ? { ...item, [key]: event.target.value }
                        : item,
                    ),
                  )
                }
              />
            </label>
          ))}
        </fieldset>
      ))}
      <Button type="submit" disabled={working}>
        Salvar grade
      </Button>
    </form>
  );
}
function ProfessionalForm({
  professional,
  ...props
}: Props & { professional?: Professional }) {
  const [uploading, setUploading] = useState(false);
  const [value, setValue] = useState({
    name: professional?.name || '',
    active: professional ? !!professional.active : false,
    userId: professional?.userId || '',
    photoId: professional?.photoId || '',
    displayOrder: professional?.displayOrder || 0,
  });
  const [relations, setRelations] = useState(
    props.data.relations.filter(
      (item) => item.professionalId === professional?.id,
    ),
  );
  return (
    <form
      className="management-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (uploading) return;
        void props.action(
          {
            action: 'professional.save',
            id: professional?.id,
            ...value,
            relations,
          },
          'Profissional e habilitações salvos.',
        );
      }}
    >
      <label>
        Nome
        <Input
          required
          minLength={2}
          value={value.name}
          onChange={(event) => setValue({ ...value, name: event.target.value })}
        />
      </label>
      <details className="management-advanced">
        <summary>Acesso da equipe (opcional)</summary>
      <label>
        Vincular conta existente (ID)
        <Input
          value={value.userId}
          onChange={(event) =>
            setValue({ ...value, userId: event.target.value })
          }
        />
      </label>
      </details>
      <PhotoSelect
        media={props.data.media}
        value={value.photoId}
        label={`Foto de ${value.name || 'profissional'}`}
        onBusyChange={setUploading}
        onChange={(photoId) => setValue(current => ({ ...current, photoId }))}
      />
      <label>
        Ordem
        <Input
          type="number"
          min={0}
          value={value.displayOrder}
          onChange={(event) =>
            setValue({ ...value, displayOrder: Number(event.target.value) })
          }
        />
      </label>
      <fieldset className="form-wide">
        <legend>
          Serviços habilitados e valores específicos (vazio usa o catálogo)
        </legend>
        {props.data.services.map((service) => {
          const relation = relations.find(
            (item) => item.serviceId === service.id,
          );
          return (
            <div className="relation-row" key={service.id}>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={!!relation}
                  onChange={(event) =>
                    setRelations(
                      event.target.checked
                        ? [
                            ...relations,
                            {
                              professionalId: professional?.id || '',
                              serviceId: service.id,
                              priceCents: null,
                              durationMinutes: null,
                            },
                          ]
                        : relations.filter(
                            (item) => item.serviceId !== service.id,
                          ),
                    )
                  }
                />
                {service.name}
              </label>
              {relation && (
                <>
                  <label>
                    Preço R$
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={(service.priceCents / 100).toFixed(2)}
                      value={
                        relation.priceCents == null
                          ? ''
                          : relation.priceCents / 100
                      }
                      onChange={(event) =>
                        setRelations(
                          relations.map((item) =>
                            item.serviceId === service.id
                              ? {
                                  ...item,
                                  priceCents:
                                    event.target.value === ''
                                      ? null
                                      : Math.round(
                                          Number(event.target.value) * 100,
                                        ),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Duração min
                    <Input
                      type="number"
                      min={1}
                      placeholder={String(service.durationMinutes)}
                      value={relation.durationMinutes ?? ''}
                      onChange={(event) =>
                        setRelations(
                          relations.map((item) =>
                            item.serviceId === service.id
                              ? {
                                  ...item,
                                  durationMinutes:
                                    event.target.value === ''
                                      ? null
                                      : Number(event.target.value),
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                </>
              )}
            </div>
          );
        })}
      </fieldset>
      <label className="check-label">
        <input
          type="checkbox"
          checked={value.active}
          onChange={(event) =>
            setValue({ ...value, active: event.target.checked })
          }
        />
        Profissional ativo
      </label>
      <Button disabled={props.working || uploading} type="submit">
        {uploading ? 'Aguarde a foto…' : 'Salvar profissional'}
      </Button>
    </form>
  );
}
export function TeamManager(props: Props) {
  return (
    <div className="management-stack">
      <details className="admin-panel">
        <summary>Novo profissional</summary>
        <ProfessionalForm {...props} />
      </details>
      {props.data.professionals.map((professional) => (
        <details className="admin-panel" key={professional.id}>
          <summary>
            {professional.name}{' '}
            <small>{professional.active ? 'Ativo' : 'Inativo'}</small>
          </summary>
          <ProfessionalForm {...props} professional={professional} />
          <h3>Grade semanal e pausas</h3>
          <ScheduleEditor
            rows={props.data.schedules.filter(
              (row) => row.professionalId === professional.id,
            )}
            professionalId={professional.id}
            action={props.action}
            working={props.working}
          />
        </details>
      ))}
      <details className="admin-panel">
        <summary>Funcionamento da unidade</summary>
        <ScheduleEditor
          rows={props.data.unit}
          action={props.action}
          working={props.working}
        />
      </details>
    </div>
  );
}
export function SettingsManager({
  settings,
  action,
  working,
}: {
  settings: Settings;
  action: Action;
  working: boolean;
}) {
  const [value, setValue] = useState(settings);
  const labels = {
    cancellationLimitHours: 'Prazo para cancelar/remarcar (horas)',
    minimumNoticeMinutes: 'Antecedência mínima (min)',
    bookingHorizonDays: 'Limite de dias para reservar',
    slotStepMinutes: 'Passo entre horários (min)',
    defaultBufferMinutes: 'Preparação após atendimento (min)',
  };
  return (
    <details className="admin-panel">
      <summary>Políticas e fuso</summary>
      <form
        className="management-form"
        onSubmit={(event) => {
          event.preventDefault();
          void action(
            { action: 'settings.save', ...value },
            'Nova versão da política salva. Reservas anteriores mantêm o prazo registrado.',
          );
        }}
      >
        <label>
          Fuso IANA
          <Input
            required
            value={value.timezone}
            onChange={(event) =>
              setValue({ ...value, timezone: event.target.value })
            }
          />
        </label>
        {(Object.keys(labels) as Array<keyof typeof labels>).map((key) => (
          <label key={key}>
            {labels[key]}
            <Input
              type="number"
              min={
                key === 'slotStepMinutes'
                  ? 5
                  : key === 'bookingHorizonDays'
                    ? 1
                    : 0
              }
              required
              value={value[key]}
              onChange={(event) =>
                setValue({ ...value, [key]: Number(event.target.value) })
              }
            />
          </label>
        ))}
        <p className="form-wide muted">
          Confirmação automática. Alterações são versionadas. Administradores
          podem cancelar/remarcar fora do prazo, com auditoria; nunca podem
          sobrepor reservas.
        </p>
        <Button disabled={working} type="submit">
          Salvar políticas
        </Button>
      </form>
    </details>
  );
}

type Slot = {
  startAt: string;
  endAt: string;
  professionalId: string;
  professionalName: string;
  time: string;
  totalCents: number;
  durationMinutes: number;
  quoteRevision: number;
};
export function ReservationEditor({
  booking,
  ...props
}: Props & { booking?: ManagedBooking }) {
  const [serviceIds, setServiceIds] = useState(
    booking?.services.map((item) => item.id) || [],
  );
  const [professionalId, setProfessionalId] = useState(
    booking?.professionalId || '',
  );
  const [date, setDate] = useState(
    new Intl.DateTimeFormat('en-CA', { timeZone: props.data.timezone }).format(
      new Date(Date.now() + 86400000),
    ),
  );
  const [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [slots, setSlots] = useState<Slot[]>([]),
    [slot, setSlot] = useState<Slot | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const eligible = props.data.professionals.filter(
    (pro) =>
      pro.active &&
      serviceIds.length > 0 &&
      serviceIds.every((id) =>
        props.data.relations.some(
          (relation) =>
            relation.professionalId === pro.id && relation.serviceId === id,
        ),
      ),
  );
  useEffect(() => {
    setSlot(null);
    setSlots([]);
  }, [date, professionalId, serviceIds]);
  async function search() {
    setLoading(true);
    setError('');
    setSlot(null);
    try {
      const params = new URLSearchParams({
        date,
        professional: professionalId,
      });
      serviceIds.forEach((id) => params.append('service', id));
      if (booking) params.set('exclude', booking.id);
      const response = await fetch(`/api/availability?${params}`);
      const payload = await response.json() as { error?: string; slots: Slot[] };
      if (!response.ok) throw new Error(payload.error);
      setSlots(payload.slots);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha na consulta.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="management-form">
      {!booking && (
        <fieldset className="form-wide">
          <legend>Serviços</legend>
          {props.data.services
            .filter((service) => service.active)
            .map((service) => (
              <label className="check-label" key={service.id}>
                <input
                  type="checkbox"
                  checked={serviceIds.includes(service.id)}
                  onChange={(event) =>
                    setServiceIds(
                      event.target.checked
                        ? [...serviceIds, service.id]
                        : serviceIds.filter((id) => id !== service.id),
                    )
                  }
                />
                {service.name}
              </label>
            ))}
        </fieldset>
      )}
      <label>
        Profissional
        <select
          value={professionalId}
          onChange={(event) => setProfessionalId(event.target.value)}
        >
          <option value="">Escolha</option>
          {eligible.map((pro) => (
            <option key={pro.id} value={pro.id}>
              {pro.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Data
        <Input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>
      <Button
        variant="outline"
        disabled={
          loading ||
          !professionalId ||
          !eligible.some((item) => item.id === professionalId)
        }
        onClick={() => void search()}
      >
        {loading ? 'Consultando…' : 'Consultar horários'}
      </Button>
      {error && (
        <p role="alert" className="form-wide">
          {error}
        </p>
      )}
      <div className="reschedule-slots form-wide">
        {slots.map((item) => (
          <button
            key={item.startAt}
            className={slot?.startAt === item.startAt ? 'selected' : ''}
            onClick={() => setSlot(item)}
          >
            {item.time}
          </button>
        ))}
      </div>
      {!loading && !slots.length && (
        <p className="muted form-wide">
          Consulte uma data. Se não houver horários, tente outro dia.
        </p>
      )}
      {!booking && (
        <>
          <label>
            Nome do cliente
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label>
            Telefone de contato
            <Input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          <p className="muted form-wide">
            Reserva manual fica sob gestão da equipe. Um telefone não vincula
            automaticamente a conta de um cliente.
          </p>
        </>
      )}
      {slot && (
        <p className="form-wide">
          Revisão: {slot.professionalName} · {date} às {slot.time} ·{' '}
          {slot.durationMinutes} min · {money(slot.totalCents)}.{' '}
          {booking &&
            'A alteração será auditada; a reserva original permanece se houver conflito.'}
        </p>
      )}
      <Button
        disabled={
          props.working ||
          !slot ||
          (!booking &&
            (name.trim().length < 2 || phone.replace(/\D/g, '').length < 10))
        }
        onClick={() =>
          slot &&
          void props.action(
            {
              action: booking ? 'booking.reschedule' : 'booking.manual',
              bookingId: booking?.id,
              serviceIds,
              professionalId: slot.professionalId,
              startAt: slot.startAt,
              quoteRevision: slot.quoteRevision,
              name,
              phone,
              idempotencyKey: key,
            },
            booking ? 'Reserva remarcada.' : 'Reserva manual criada.',
          )
        }
      >
        {booking ? 'Confirmar remarcação' : 'Confirmar reserva manual'}
      </Button>
    </div>
  );
}

export function AgendaManager({
  bookings,
  timezone,
  ...props
}: Props & { bookings: ManagedBooking[]; timezone: string }) {
  const [search, setSearch] = useState(''),
    [status, setStatus] = useState(''),
    [pro, setPro] = useState(''),
    [view, setView] = useState('day'),
    [date, setDate] = useState(
      new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(
        new Date(),
      ),
    );
  const last = new Date(`${date}T12:00:00Z`);
  last.setUTCDate(last.getUTCDate() + (view === 'week' ? 6 : 0));
  const end = last.toISOString().slice(0, 10);
  const local = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(
      new Date(iso),
    );
  const visible = bookings
    .filter(
      (item) =>
        (!status || item.status === status) &&
        (!pro || item.professionalId === pro) &&
        normalize(`${item.clientName} ${item.reference}`).includes(
          normalize(search),
        ) &&
        (view === 'all' ||
          (local(item.startAt) >= date && local(item.startAt) <= end)),
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  return (
    <div className="management-stack">
      <h1>Agenda</h1>
      <details className="admin-panel">
        <summary>Criar reserva manual</summary>
        <ReservationEditor {...props} />
      </details>
      <div className="admin-panel management-form">
        <label>
          Visão
          <select
            value={view}
            onChange={(event) => setView(event.target.value)}
          >
            <option value="day">Diária</option>
            <option value="week">Semanal (7 dias)</option>
            <option value="all">Todas carregadas</option>
          </select>
        </label>
        <label>
          Data inicial
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          Profissional
          <select value={pro} onChange={(event) => setPro(event.target.value)}>
            <option value="">Todos</option>
            {props.data.professionals.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cliente ou referência
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <p>
          {visible.length} reservas · fuso {timezone}
        </p>
      </div>
      {visible.map((booking) => (
        <details className="admin-panel" key={booking.id}>
          <summary>
            {new Intl.DateTimeFormat('pt-BR', {
              timeZone: timezone,
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(new Date(booking.startAt))}{' '}
            · {booking.clientName}
            <small>
              {booking.professionalName} · {statusLabels[booking.status]} ·{' '}
              {booking.reference}
            </small>
          </summary>
          <p>
            {booking.services.map((item) => item.name).join(' + ')} ·{' '}
            {money(booking.totalCents)} · Contato: {booking.clientPhone}
          </p>
          {booking.clientEmail && <p>E-mail: {booking.clientEmail}</p>}
          {['confirmed', 'pending'].includes(booking.status) && (
            <>
              <div className="table-actions">
                {(['completed', 'no_show', 'cancelled'] as const).map(
                  (value) => (
                    <Button
                      variant={
                        value === 'cancelled' ? 'destructive' : 'outline'
                      }
                      disabled={props.working}
                      key={value}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Confirmar: ${statusLabels[value]} para ${booking.reference}? Esta ação será auditada.`,
                          )
                        )
                          void props.action(
                            {
                              action: 'booking.status',
                              bookingId: booking.id,
                              status: value,
                            },
                            'Estado atualizado.',
                          );
                      }}
                    >
                      {statusLabels[value]}
                    </Button>
                  ),
                )}
              </div>
              <details>
                <summary>Remarcar por formulário</summary>
                <ReservationEditor {...props} booking={booking} />
              </details>
            </>
          )}
        </details>
      ))}
      {!visible.length && (
        <p className="admin-panel">Nenhuma reserva para esses filtros.</p>
      )}
    </div>
  );
}

export function ContentManager({ data, action, working }: Props) {
  const [value, setValue] = useState(data.content);
  const [extraMedia, setExtraMedia] = useState<Media[]>([]);
  const [uploadCount, setUploadCount] = useState(0);
  const mediaLibrary = [...data.media, ...extraMedia.filter(item => !data.media.some(existing => existing.id === item.id))];
  const onBusyChange = (busy: boolean) => setUploadCount(count => Math.max(0, count + (busy ? 1 : -1)));
  const onUploaded = (item: Media) => setExtraMedia(current => [...current, item]);
  const fields: Record<string, string> = {
    slogan: 'Slogan',
    hero_text: 'Texto da abertura',
    about_text: 'Quem somos',
    business_address: 'Endereço completo',
    business_phone: 'Telefone comercial',
    instagram_url: 'Link do Instagram',
    whatsapp_number:
      'WhatsApp confirmado (país + DDD + número; deixe vazio enquanto não validado)',
    developer_url: 'Link do desenvolvedor (opcional)',
  };
  return (
    <form
      className="admin-panel management-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (uploadCount) return;
        void action(
          {
            action: 'content.save',
            values: Object.fromEntries(
              [
                ...Object.keys(fields),
                'hero_image',
                'logo_image',
                'gallery_images',
                'environment_images',
              ].map((key) => [key, value[key] || '']),
            ),
          },
          'Conteúdo salvo no portal.',
        );
      }}
    >
      {Object.entries(fields).map(([key, label]) => (
        <label className={key.endsWith('_text') ? 'form-wide' : ''} key={key}>
          {label}
          <textarea
            value={value[key] || ''}
            maxLength={4000}
            onChange={(event) =>
              setValue({ ...value, [key]: event.target.value })
            }
          />
        </label>
      ))}
      <fieldset>
        <legend>Logo oficial</legend>
        <PhotoSelect
          media={mediaLibrary}
          label="Logo oficial"
          onBusyChange={onBusyChange}
          onUploaded={onUploaded}
          value={value.logo_image || ''}
          onChange={(id) => setValue(current => ({ ...current, logo_image: id }))}
        />
      </fieldset>
      <fieldset>
        <legend>Foto da abertura</legend>
        <PhotoSelect
          media={mediaLibrary}
          label="Foto da abertura"
          onBusyChange={onBusyChange}
          onUploaded={onUploaded}
          value={value.hero_image || ''}
          onChange={(id) => setValue(current => ({ ...current, hero_image: id }))}
        />
      </fieldset>
      {['gallery_images', 'environment_images'].map((key) => (
        <fieldset className="form-wide" key={key}>
          <legend>
            {key === 'gallery_images' ? 'Trabalhos' : 'Ambiente'} — selecione
            fotos autorizadas
          </legend>
          <PhotoSelect media={mediaLibrary} value="" library={false}
            label={key === 'gallery_images' ? 'Foto de um trabalho' : 'Foto do ambiente'}
            onBusyChange={onBusyChange} onUploaded={onUploaded}
            onChange={id => setValue(current => ({ ...current, [key]: [...new Set([...(current[key] || '').split(',').filter(Boolean), id])].join(',') }))} />
          <div className="media-library">
            {mediaLibrary.map((media) => {
              const ids = (value[key] || '').split(',').filter(Boolean);
              return (
                <label key={media.id}>
                  <img
                    src={`/api/media/${media.id}`}
                    alt={media.altText}
                    loading="lazy"
                  />
                  <span>
                    <input
                      type="checkbox"
                      checked={ids.includes(media.id)}
                      onChange={(event) =>
                        setValue({
                          ...value,
                          [key]: (event.target.checked
                            ? [...ids, media.id]
                            : ids.filter((id) => id !== media.id)
                          ).join(','),
                        })
                      }
                    />
                    {media.altText}
                  </span>
                </label>
              );
            })}
          </div>
          {!mediaLibrary.length && (
            <p>Escolha uma foto acima. Ela já ficará selecionada para esta seção.</p>
          )}
        </fieldset>
      ))}
      <Button disabled={working || uploadCount > 0} type="submit">
        Salvar conteúdo público
      </Button>
    </form>
  );
}
