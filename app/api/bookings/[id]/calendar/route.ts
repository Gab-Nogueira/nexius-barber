import { getBooking } from '@/lib/booking-engine';
import { requireApiUser } from '@/lib/authz';
import { ApiError, demoModeEnabled, jsonError } from '@/lib/nexius';
import { publicContent } from '@/lib/content';
import { calendarFile, googleCalendarUrl } from '@/lib/calendar';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const booking = await getBooking(id, user.userId);
    const { values } = await publicContent();
    if (new URL(request.url).searchParams.get('provider') === 'google') {
      if (!['pending', 'confirmed'].includes(booking.status)) throw new ApiError(400, 'Este agendamento não está ativo.', 'inactive_booking');
      return new Response(null, { status: 302, headers: {
        Location: googleCalendarUrl(booking, values.business_address, demoModeEnabled()),
        'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
      } });
    }
    const content = calendarFile(booking, values.business_address, demoModeEnabled());
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
