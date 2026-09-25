import { getBooking } from '@/lib/booking-engine';
import { requireApiUser } from '@/lib/authz';
import { jsonError } from '@/lib/nexius';
import { publicContent } from '@/lib/content';

function icsDate(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace('.000', '');
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const booking = await getBooking(id, user.userId);
    const { values } = await publicContent();
    const description = escapeIcs(booking.services.map((item) => item.name).join(', '));
    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Nexius Barber//Agenda Demo//PT-BR',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${booking.id}@nexius-barber-demo`,
      `DTSTAMP:${icsDate(booking.createdAt)}`,
      `DTSTART:${icsDate(booking.startAt)}`,
      `DTEND:${icsDate(booking.endAt)}`,
      `SUMMARY:${escapeIcs(`Nexius Barber — ${booking.professionalName}`)}`,
      `DESCRIPTION:${description}`,
      `LOCATION:${escapeIcs(values.business_address)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    return new Response(content, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="nexius-${booking.reference}.ics"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
