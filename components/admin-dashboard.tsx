'use client';
import '@/app/management.css';
import { DayAgenda } from './day-agenda';
import { SignOutButton } from './staff-login';
import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CalendarDays,
  FileImage,
  LayoutDashboard,
  Menu,
  Scissors,
  UsersRound,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from './ui/sidebar';
import {
  AgendaManager,
  CatalogManager,
  ContentManager,
  SettingsManager,
  TeamManager,
  type ManagedBooking,
  type ManagementData,
  type Settings,
} from './management-forms';

type Section = 'today' | 'overview' | 'agenda' | 'catalog' | 'team' | 'content';
type DashboardData = {
  bookings: ManagedBooking[];
  management: ManagementData;
  settings: Settings;
  blocks: Array<{
    id: string;
    professionalName: string | null;
    startAt: string;
    endAt: string;
    reason: string;
  }>;
  audit: Array<{
    actorName: string;
    action: string;
    entityId: string;
    createdAt: string;
    detailJson: string;
  }>;
  indicators: {
    availableMinutes: number;
    occupiedMinutes: number;
    upcoming: number;
    cancelled: number;
    noShows: number;
    completed: number;
    occupancyPercent: number;
    expectedValueCents: number;
    completedServiceValueCents: number;
  };
};
const navigation = [
  { id: 'today', label: 'Agenda do dia', icon: CalendarDays },
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'catalog', label: 'Catálogo', icon: Scissors },
  { id: 'team', label: 'Equipe e horários', icon: UsersRound },
  { id: 'content', label: 'Fotos e conteúdo', icon: FileImage },
] as const;
const money = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function AdminDashboard() {
  const [section, setSection] = useState<Section>('today'),
    [data, setData] = useState<DashboardData | null>(null),
    [loading, setLoading] = useState(true),
    [working, setWorking] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [block, setBlock] = useState({
    professionalId: '',
    startAt: '',
    endAt: '',
    reason: '',
  });
  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/admin?month=${month}`, {
        cache: 'no-store',
      });
      const payload = await response.json() as DashboardData & { error?: string };
      if (!response.ok)
        throw new Error(payload.error || 'Não foi possível carregar o painel.');
      setData(payload);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha ao carregar.');
    } finally {
      setLoading(false);
    }
  }, [month]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !working)
        void refresh(true);
    }, 60000);
    return () => clearInterval(timer);
  }, [refresh, working]);
  async function action(body: Record<string, unknown>, success: string) {
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as { error?: string; conflicts?: Array<{ reference?: string }> };
      if (!response.ok)
        throw new Error(
          `${payload.error || 'Não foi possível salvar.'}${payload.conflicts?.length ? ' Referências: ' + payload.conflicts.map((item: { reference?: string }) => item.reference || 'reserva').join(', ') : ''}`,
        );
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
  const dateTime = (iso: string) =>
    new Intl.DateTimeFormat('pt-BR', {
      timeZone: data?.settings.timezone || 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  return (
    <SidebarProvider className="admin-shell">
      <Sidebar collapsible="offcanvas" className="admin-sidebar">
        <SidebarHeader>
          <a className="admin-brand" href="/">
            <span className="admin-brand-word">
              NE<em>X</em>IUS
            </span>
            <small>GESTÃO</small>
          </a>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={section === item.id}
                      onClick={() => setSection(item.id)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <div className="admin-demo-note">
            <Activity />
            Demonstração — não são reservas reais
          </div>
          <a className="admin-site-link" href="/">
            Ver portal público
          </a>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="admin-inset">
        <header className="admin-topbar">
          <div>
            <SidebarTrigger>
              <Menu />
            </SidebarTrigger>
            <span>{navigation.find((item) => item.id === section)?.label}</span>
          </div>
          <div><a href="/profissional">Área profissional</a><SignOutButton /></div>
        </header>
        <main className="admin-content">
          {error && (
            <div className="admin-alert error" role="alert">
              {error}
              <Button variant="outline" onClick={() => void refresh()}>
                Atualizar
              </Button>
            </div>
          )}
          {notice && (
            <div className="admin-alert success" role="status">
              {notice}
            </div>
          )}
          {loading ? (
            <div className="loading-state">Carregando operação…</div>
          ) : !data ? (
            <div className="empty-state">
              <p>Painel indisponível.</p>
              <Button onClick={() => void refresh()}>Tentar novamente</Button>
            </div>
          ) : (
            <>
              {section === 'today' && <DayAgenda bookings={data.bookings} data={data.management} working={working} action={action} refresh={() => void refresh(true)} openAgenda={() => setSection('agenda')} />}
              {section === 'overview' && (
                <section>
                  <div className="admin-heading">
                    <div>
                      <p>OPERAÇÃO DA DEMONSTRAÇÃO</p>
                      <h1>Visão geral</h1>
                    </div>
                    <label>
                      Período dos indicadores
                      <Input
                        type="month"
                        value={month}
                        onChange={(event) => setMonth(event.target.value)}
                      />
                    </label>
                    <Button onClick={() => setSection('agenda')}>
                      Abrir agenda
                    </Button>
                  </div>
                  <div className="indicator-grid">
                    <article>
                      <span>Reservas futuras no período</span>
                      <strong>{data.indicators.upcoming}</strong>
                      <small>Confirmadas ou pendentes</small>
                    </article>
                    <article>
                      <span>Ocupação da grade</span>
                      <strong>{data.indicators.occupancyPercent}%</strong>
                      <small>
                        {Math.round(data.indicators.occupiedMinutes)} /{' '}
                        {Math.round(data.indicators.availableMinutes)} min
                        disponíveis
                      </small>
                    </article>
                    <article>
                      <span>Valor previsto</span>
                      <strong>
                        {money(data.indicators.expectedValueCents)}
                      </strong>
                      <small>Não é receita recebida</small>
                    </article>
                    <article>
                      <span>Serviços concluídos</span>
                      <strong>
                        {money(data.indicators.completedServiceValueCents)}
                      </strong>
                      <small>Sem confirmação de pagamento</small>
                    </article>
                  </div>
                  <div className="admin-split">
                    <article className="admin-panel">
                      <h2>Próximos atendimentos</h2>
                      <div className="compact-agenda">
                        {data.bookings
                          .filter(
                            (booking) =>
                              ['pending', 'confirmed'].includes(
                                booking.status,
                              ) && new Date(booking.startAt) > new Date(),
                          )
                          .sort((a, b) => a.startAt.localeCompare(b.startAt))
                          .slice(0, 5)
                          .map((booking) => (
                            <div key={booking.id}>
                              <time>{dateTime(booking.startAt)}</time>
                              <span>
                                <strong>{booking.clientName}</strong>
                                <small>
                                  {booking.services
                                    .map((item) => item.name)
                                    .join(' + ')}{' '}
                                  · {booking.professionalName}
                                </small>
                              </span>
                              <em>{money(booking.totalCents)}</em>
                            </div>
                          ))}
                      </div>
                      {!data.bookings.length && <p>Nenhuma reserva ainda.</p>}
                    </article>
                    <article className="admin-panel">
                      <h2>Estados no período</h2>
                      <div className="status-overview">
                        <span>
                          Concluídos<strong>{data.indicators.completed}</strong>
                        </span>
                        <span>
                          Cancelados<strong>{data.indicators.cancelled}</strong>
                        </span>
                        <span>
                          Não compareceu
                          <strong>{data.indicators.noShows}</strong>
                        </span>
                      </div>
                      <p className="admin-footnote">
                        Ocupação usa a grade atual, desconta pausas/bloqueios e
                        mede minutos com atendimentos. Não é um histórico
                        imutável das escalas passadas.
                      </p>
                    </article>
                  </div>
                </section>
              )}
              {section === 'agenda' && (
                <AgendaManager
                  data={data.management}
                  bookings={data.bookings}
                  timezone={data.settings.timezone}
                  action={action}
                  working={working}
                />
              )}
              {section === 'catalog' && (
                <CatalogManager
                  data={data.management}
                  action={action}
                  working={working}
                />
              )}
              {section === 'team' && (
                <section className="management-stack">
                  <h1>Equipe e disponibilidade</h1>
                  <TeamManager
                    data={data.management}
                    action={action}
                    working={working}
                  />
                  <SettingsManager
                    settings={data.settings}
                    action={action}
                    working={working}
                  />
                  <article className="admin-panel">
                    <h2>Bloquear período / fechamento excepcional</h2>
                    <form
                      className="management-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void action(
                          { action: 'block.create', ...block },
                          'Bloqueio criado.',
                        );
                      }}
                    >
                      <label>
                        Profissional
                        <select
                          value={block.professionalId}
                          onChange={(event) =>
                            setBlock({
                              ...block,
                              professionalId: event.target.value,
                            })
                          }
                        >
                          <option value="">Unidade inteira</option>
                          {data.management.professionals.map((pro) => (
                            <option key={pro.id} value={pro.id}>
                              {pro.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Início ({data.settings.timezone})
                        <Input
                          type="datetime-local"
                          required
                          value={block.startAt}
                          onChange={(event) =>
                            setBlock({ ...block, startAt: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Fim
                        <Input
                          type="datetime-local"
                          required
                          value={block.endAt}
                          onChange={(event) =>
                            setBlock({ ...block, endAt: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        Motivo
                        <Input
                          required
                          minLength={3}
                          value={block.reason}
                          onChange={(event) =>
                            setBlock({ ...block, reason: event.target.value })
                          }
                        />
                      </label>
                      <Button disabled={working} type="submit">
                        Criar bloqueio
                      </Button>
                    </form>
                  </article>
                  <article className="admin-panel">
                    <h2>Bloqueios registrados</h2>
                    {data.blocks.map((item) => (
                      <div className="block-item" key={item.id}>
                        <strong>
                          {item.professionalName || 'Unidade inteira'}
                        </strong>
                        <p>
                          {dateTime(item.startAt)} até {dateTime(item.endAt)} ·{' '}
                          {item.reason}
                        </p>
                        <Button
                          variant="outline"
                          disabled={working}
                          onClick={() => {
                            if (
                              window.confirm(
                                'Remover este bloqueio e liberar a capacidade?',
                              )
                            )
                              void action(
                                { action: 'block.remove', id: item.id },
                                'Bloqueio removido.',
                              );
                          }}
                        >
                          Remover bloqueio
                        </Button>
                      </div>
                    ))}
                    {!data.blocks.length && <p>Nenhum bloqueio.</p>}
                  </article>
                </section>
              )}
              {section === 'content' && (
                <section className="management-stack">
                  <h1>Conteúdo e imagens</h1>
                  <p>Escolha a foto no lugar onde ela deve aparecer, confira a prévia e salve. Fotos dos cortes ficam em Catálogo; retratos, em Equipe e horários.</p>
                  <ContentManager data={data.management} action={action} working={working} />
                </section>
              )}
            </>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
