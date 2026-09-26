export type ExportBooking = {
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
  services: Array<{ name: string }>;
};
export const bookingStatusLabels: Record<string, string> = {
  confirmed: 'Confirmado',
  pending: 'Pendente',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
};
export const agendaDate = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(
    new Date(iso),
  );
export const agendaTime = (iso: string, timezone: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function filterAgenda<T extends ExportBooking>(
  bookings: T[],
  filters: {
    date: string;
    professional?: string;
    status?: string;
    search?: string;
  },
  timezone: string,
) {
  return bookings
    .filter(
      (b) =>
        agendaDate(b.startAt, timezone) === filters.date &&
        (!filters.professional || b.professionalId === filters.professional) &&
        (!filters.status || b.status === filters.status) &&
        normalize(`${b.clientName} ${b.clientPhone} ${b.reference}`).includes(
          normalize(filters.search || ''),
        ),
    )
    .sort(
      (a, b) =>
        a.startAt.localeCompare(b.startAt) ||
        a.professionalName.localeCompare(b.professionalName),
    );
}
function cell(value: string | number) {
  let text = String(value).replace(/[\r\n\t]/g, ' ');
  if (/^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
export function agendaCsv(bookings: ExportBooking[], timezone: string) {
  const rows: Array<Array<string | number>> = [
    [
      'Data',
      'Início',
      'Fim',
      'Cliente',
      'Telefone',
      'E-mail',
      'Profissional',
      'Serviços',
      'Situação',
      'Valor (R$)',
      'Referência',
      'Fuso',
    ],
  ];
  for (const b of bookings)
    rows.push([
      agendaDate(b.startAt, timezone).split('-').reverse().join('/'),
      agendaTime(b.startAt, timezone),
      agendaTime(b.endAt, timezone),
      b.clientName,
      b.clientPhone,
      b.clientEmail || '',
      b.professionalName,
      b.services.map((s) => s.name).join(' + '),
      bookingStatusLabels[b.status] || b.status,
      (b.totalCents / 100).toFixed(2).replace('.', ','),
      b.reference,
      timezone,
    ]);
  return (
    '\uFEFF' + rows.map((row) => row.map(cell).join(';')).join('\r\n') + '\r\n'
  );
}
