import { ArrowLeft, CalendarClock } from 'lucide-react';

export function AppHeader({ backHref = '/', backLabel = 'Voltar', actionHref, actionLabel }: {
  backHref?: string; backLabel?: string; actionHref?: string; actionLabel?: string;
}) {
  return (
    <>
      <div className="demo-bar" role="status"><span>Demonstração</span>Os horários não são reservas reais</div>
      <header className="app-header">
        <a className="app-back" href={backHref} aria-label={backLabel}><ArrowLeft aria-hidden="true" size={19} /> <span>{backLabel}</span></a>
        <a className="wordmark" href="/" aria-label="Nexius Barber — início">NE<span>X</span>IUS <small>BARBER</small></a>
        {actionHref && actionLabel ? <a className="app-action" href={actionHref} aria-label={actionLabel}><span>{actionLabel}</span><CalendarClock aria-hidden="true" size={18} /></a> : <span />}
      </header>
    </>
  );
}
