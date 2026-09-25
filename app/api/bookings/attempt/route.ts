import { requireApiUser } from '@/lib/authz';
import { getBooking } from '@/lib/booking-engine';
import { ApiError, database, jsonError } from '@/lib/nexius';
import { bookingWhatsApp } from '@/lib/booking-message';

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const key = new URL(request.url).searchParams.get('key') || '';
    if (!/^[a-zA-Z0-9_-]{12,100}$/.test(key)) throw new ApiError(400,'Tentativa inválida.','invalid_idempotency_key');
    const row = await database().prepare('SELECT id FROM bookings WHERE idempotency_key=? AND customer_user_id=?').bind(`${user.userId}:${key}`,user.userId).first<{id:string}>();
    if (!row) throw new ApiError(404,'Nenhuma reserva foi gravada para essa tentativa.','attempt_not_found');
    const booking = await getBooking(row.id,user.userId);
    return Response.json({booking,whatsappUrl:await bookingWhatsApp(booking)},{headers:{'Cache-Control':'no-store'}});
  } catch(error) { return jsonError(error); }
}
