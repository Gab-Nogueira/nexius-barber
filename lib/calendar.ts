// No client contact data goes into calendar URLs. Email is a booking contact,
// never an authentication identifier or an automatic calendar permission.
type CalendarBooking = {
  id: string; reference: string; professionalName: string; startAt: string; endAt: string;
  createdAt: string; updatedAt: string; status: string; services: Array<{ name: string }>;
};
const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
// RFC 5545: fold at 75 UTF-8 octets, without splitting a multibyte character.
function fold(line: string) {
  const encoder = new TextEncoder();
  let result = '', bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) { result += '\r\n '; bytes = 1; }
    result += character; bytes += length;
  }
  return result;
}
export function calendarFile(booking: CalendarBooking, address: string, demo: boolean) {
  const active = ['pending', 'confirmed'].includes(booking.status);
  const description = `${demo ? 'DEMONSTRAÇÃO — não é um atendimento real.\n' : ''}${booking.services.map(item => item.name).join(' + ')}. Referência: ${booking.reference}. Após remarcar ou cancelar, atualize também este evento na sua agenda. Contato com a barbearia pelo site.`;
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nexius Barber//Agendamento//PT-BR', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${booking.id}@nexius-barber-demo`, `DTSTAMP:${stamp(booking.updatedAt)}`,
    `CREATED:${stamp(booking.createdAt)}`, `LAST-MODIFIED:${stamp(booking.updatedAt)}`,
    `DTSTART:${stamp(booking.startAt)}`, `DTEND:${stamp(booking.endAt)}`,
    `STATUS:${booking.status === 'cancelled' ? 'CANCELLED' : booking.status === 'pending' ? 'TENTATIVE' : 'CONFIRMED'}`,
    `SUMMARY:${escapeText(`${demo ? '[Demo] ' : ''}Nexius Barber — ${booking.professionalName}`)}`,
    `DESCRIPTION:${escapeText(description)}`, `LOCATION:${escapeText(address)}`,
    ...(active ? ['BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:Seu horário na Nexius Barber é em 1 hora.', 'END:VALARM'] : []),
    'END:VEVENT', 'END:VCALENDAR', '',
  ].map(fold).join('\r\n');
}
export function googleCalendarUrl(booking: Pick<CalendarBooking, 'reference' | 'professionalName' | 'startAt' | 'endAt' | 'services'>, address: string, demo: boolean) {
  const params = new URLSearchParams({ action: 'TEMPLATE',
    text: `${demo ? '[Demo] ' : ''}Nexius Barber — ${booking.professionalName}`,
    dates: `${stamp(booking.startAt)}/${stamp(booking.endAt)}`, location: address,
    details: `${demo ? 'DEMONSTRAÇÃO. ' : ''}${booking.services.map(item => item.name).join(' + ')}. Referência: ${booking.reference}. Configure a notificação para 1 hora antes e salve. Alterações no site não atualizam este evento automaticamente.`,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
