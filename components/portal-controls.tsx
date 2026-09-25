'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarClock, ChevronLeft, ChevronRight, Download, MessageCircle, Moon, Play, Sun, X } from 'lucide-react';

type InstallPrompt = Event & { prompt: () => Promise<void> };
function readPreference(key: string) { try { return localStorage.getItem(key); } catch { return null; } }
function savePreference(key: string, value: string) { try { localStorage.setItem(key, value); } catch { /* Storage may be unavailable in private mode. */ } }

const tourSteps = [
  { id: 'inicio', title: 'Primeiro, encontre seu horário', text: 'O agendamento começa aqui e continua em poucos passos.' },
  { id: 'servicos', title: 'Serviços com preço visível', text: 'Veja o catálogo antes de escolher. Os dados de demonstração estão identificados.' },
  { id: 'equipe', title: 'Escolha o profissional', text: 'O cliente pode partir daqui direto para a agenda do profissional.' },
  { id: 'sistema', title: 'A operação por trás do site', text: 'A gestão reúne agenda do dia, indicadores e exportação, com acesso separado.' },
];

export function PortalControls({ whatsappNumber }: { whatsappNumber?: string }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [intro, setIntro] = useState(false);
  const [tour, setTour] = useState(-1);
  const [spotlight, setSpotlight] = useState<DOMRect | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installHelp, setInstallHelp] = useState(false);
  const tourRef = useRef<HTMLDivElement>(null);
  const installRef = useRef<HTMLDivElement>(null);
  const tourTriggerRef = useRef<HTMLButtonElement>(null);
  const installTriggerRef = useRef<HTMLButtonElement>(null);
  const wasTourOpen = useRef(false);
  const wasInstallOpen = useRef(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    const media = matchMedia('(prefers-color-scheme: light)');
    const saved = readPreference('nexius-public-theme');
    const initial = saved === 'light' || saved === 'dark' ? saved : media.matches ? 'light' : 'dark';
    setTheme(initial);
    const followSystem = () => {
      if (!readPreference('nexius-public-theme')) setTheme(media.matches ? 'light' : 'dark');
    };
    media.addEventListener('change', followSystem);
    const hasVisited = readPreference('nexius-intro-seen');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!hasVisited && !reduce) {
      setIntro(true);
      timer = setTimeout(() => {
        setIntro(false);
        savePreference('nexius-intro-seen', '1');
      }, 1450);
    }
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => {
      media.removeEventListener('change', followSystem);
      window.removeEventListener('beforeinstallprompt', onInstall);
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const portal = document.querySelector('.public-portal');
    portal?.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (tour < 0 && wasTourOpen.current) tourTriggerRef.current?.focus();
    wasTourOpen.current = tour >= 0;
  }, [tour]);

  useEffect(() => {
    if (!installHelp && wasInstallOpen.current) installTriggerRef.current?.focus();
    wasInstallOpen.current = installHelp;
  }, [installHelp]);

  useEffect(() => {
    if (tour < 0) return;
    const target = document.getElementById(tourSteps[tour].id);
    if (!target) return;
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
    const update = () => setSpotlight(target.getBoundingClientRect());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setTour(-1);
      if (event.key !== 'Tab' || !tourRef.current) return;
      const buttons = Array.from(tourRef.current.querySelectorAll('button'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
      if (!event.shiftKey && index === buttons.length - 1) { event.preventDefault(); buttons[0].focus(); }
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    window.addEventListener('keydown', onKey);
    const frame = requestAnimationFrame(() => tourRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('keydown', onKey);
    };
  }, [tour]);

  useEffect(() => {
    if (!installHelp) return;
    installRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInstallHelp(false);
      if (event.key === 'Tab') { event.preventDefault(); installRef.current?.querySelector('button')?.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [installHelp]);

  function closeIntro() {
    setIntro(false);
    savePreference('nexius-intro-seen', '1');
  }

  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      setInstallPrompt(null);
    } else setInstallHelp(true);
  }

  return (
    <>
      <div className="portal-controls" aria-label="Preferências e apresentação">
        <button type="button" onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); savePreference('nexius-public-theme', next); }} aria-label={`Ativar tema ${theme === 'dark' ? 'claro' : 'escuro'}`} title="Alternar tema">
          {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </button>
        <button type="button" ref={tourTriggerRef} onClick={() => setTour(0)} aria-label="Ver como funciona" title="Ver como funciona"><Play aria-hidden="true" /><span>Ver como funciona</span></button>
        <button type="button" ref={installTriggerRef} onClick={() => void install()} aria-label="Instalar aplicativo" title="Instalar aplicativo"><Download aria-hidden="true" /></button>
      </div>
      {whatsappNumber && <a className="floating-whatsapp" href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá! Gostaria de falar com a Nexius Barber.')}`} target="_blank" rel="noopener noreferrer" aria-label="Abrir conversa no WhatsApp para revisar e enviar"><MessageCircle aria-hidden="true" /><span>WhatsApp</span></a>}
      {intro && <div className="nexius-intro" role="status" aria-label="Apresentação Nexius Barber"><div className="intro-x" aria-hidden="true">X</div><strong>NE<span>X</span>IUS</strong><small>BARBER</small><button type="button" onClick={closeIntro}>Entrar agora</button></div>}
      {tour >= 0 && <>
        {spotlight && <div className="tour-spotlight" aria-hidden="true" style={{ top: spotlight.top - 8, left: spotlight.left - 8, width: spotlight.width + 16, height: spotlight.height + 16 }} />}
        <div className="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title" ref={tourRef} tabIndex={-1}>
          <div className="tour-card-top"><span>VISÃO GERAL / {tour + 1} DE {tourSteps.length}</span><button type="button" onClick={() => setTour(-1)} aria-label="Fechar apresentação"><X /></button></div>
          <h2 id="tour-title">{tourSteps[tour].title}</h2><p>{tourSteps[tour].text}</p>
          <div className="tour-actions"><button type="button" onClick={() => setTour((current) => Math.max(0, current - 1))} disabled={tour === 0}><ChevronLeft /> Voltar</button><button type="button" onClick={() => setTour(tour === tourSteps.length - 1 ? -1 : tour + 1)}>{tour === tourSteps.length - 1 ? 'Concluir' : 'Próximo'} <ChevronRight /></button></div>
        </div>
      </>}
      {installHelp && <div className="install-help" role="dialog" aria-modal="true" aria-labelledby="install-title" ref={installRef} tabIndex={-1}><div><button type="button" onClick={() => setInstallHelp(false)} aria-label="Fechar"><X /></button><CalendarClock aria-hidden="true" /><h2 id="install-title">Instale no seu aparelho</h2><p>No navegador do celular, abra o menu e escolha “Adicionar à tela inicial” ou “Instalar aplicativo”, quando disponível.</p></div></div>}
    </>
  );
}

export function AvailabilityPulse({ serviceId, serviceName }: { serviceId?: string; serviceName?: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!serviceId) { setState('error'); return; }
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const controller = new AbortController();
    fetch(`/api/availability?${new URLSearchParams({ date, service: serviceId })}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error('availability'); const data = await response.json() as { slots: unknown[] }; setCount(data.slots.length); setState(data.slots.length ? 'ready' : 'empty'); })
      .catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [serviceId]);
  return <p className={`availability-pulse ${state === 'loading' ? 'is-loading' : ''}`} aria-live="polite"><span className="availability-dot" aria-hidden="true" />{state === 'loading' ? 'Consultando horários de hoje…' : state === 'ready' ? `${count} ${count === 1 ? 'opção de horário' : 'opções de horário'} hoje para ${serviceName}` : state === 'empty' ? `Sem horários livres hoje para ${serviceName}` : 'Confira os horários atualizados na agenda'}<small>Disponibilidade indicativa; confirmada ao reservar.</small></p>;
}
