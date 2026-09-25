import { ensureUser, getAvailability, getBooking } from '@/lib/booking-engine';
import { demoModeEnabled, jsonError } from '@/lib/nexius';
import { platformAuth } from '@/lib/session';
import { requireApiUser } from '@/lib/authz';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const serviceIds = url.searchParams.getAll('service');
    const date = url.searchParams.get('date') ?? '';
    const professionalId = url.searchParams.get('professional') || undefined;
    const excludeBookingId = url.searchParams.get('exclude') || undefined;
    if (excludeBookingId) {
      const user = await requireApiUser();
      const account = await ensureUser(user);
      await getBooking(excludeBookingId, (platformAuth() && demoModeEnabled()) || account?.role === 'admin' ? undefined : user.userId);
    }
    const slots = await getAvailability({ serviceIds, date, professionalId, excludeBookingId });
    return Response.json({ slots, indicative: true, message: 'A disponibilidade é revalidada ao confirmar.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
