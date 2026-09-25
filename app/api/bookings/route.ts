import { createBooking, listCustomerBookings } from '@/lib/booking-engine';
import { requireApiUser } from '@/lib/authz';
import { ApiError, jsonError } from '@/lib/nexius';
import { assertSameOrigin } from '@/lib/transactions';
import { textValue } from '@/lib/management';
import { bookingWhatsApp } from '@/lib/booking-message';
import { currentUser, limitRequests } from '@/lib/session';

export async function GET() {
  try {
    const user = await requireApiUser();
    return Response.json({ bookings: await listCustomerBookings(user.userId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const body = await request.json() as Record<string, unknown>;
    await limitRequests('booking', user.userId, (await currentUser())?.role === 'admin' ? 200 : 20, 3600000);
    if (!body || Array.isArray(body)) throw new ApiError(400, 'Dados inválidos.', 'invalid_body');
    const booking = await createBooking(user, {
      serviceIds: Array.isArray(body.serviceIds) ? body.serviceIds.filter((value): value is string => typeof value === 'string') : [],
      professionalId: textValue(body.professionalId), startAt: textValue(body.startAt),
      name: textValue(body.name), phone: textValue(body.phone), idempotencyKey: textValue(body.idempotencyKey),
      quoteRevision: typeof body.quoteRevision === 'number' ? body.quoteRevision : -1,
    });
    return Response.json({ booking, whatsappUrl: await bookingWhatsApp(booking), notification: { status: 'test_logged', message: 'Reserva criada. Nenhuma mensagem externa foi enviada.' } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
