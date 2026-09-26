import { BellRing, CalendarPlus, ArrowUpRight } from 'lucide-react';

export function CalendarActions({ bookingId }: { bookingId: string }) {
  return <section className="calendar-actions" aria-label="Salvar na sua agenda">
    <div className="calendar-actions-heading"><BellRing aria-hidden="true" /><div><strong>Seu horário, na sua agenda.</strong><p>Um lembrete para você não esquecer.</p></div></div>
    <div className="calendar-buttons">
      <a className="button button-primary" href={`/api/bookings/${bookingId}/calendar?provider=google`} target="_blank" rel="noopener noreferrer"><CalendarPlus aria-hidden="true" />Google Agenda<ArrowUpRight aria-hidden="true" /></a>
      <a className="button button-ghost" href={`/api/bookings/${bookingId}/calendar`}><CalendarPlus aria-hidden="true" />iPhone / arquivo de agenda</a>
    </div>
    <p>Google: escolha a notificação <strong>1 hora antes</strong> e toque em Salvar. No iPhone, abra o arquivo na Agenda e confira o alerta de 1 hora, já incluído.</p>
    <small>As notificações dependem das permissões da sua agenda. Se remarcar ou cancelar, atualize ou exclua o evento também. Não enviamos convite automático por e-mail.</small>
  </section>;
}
