import { cancelBooking, getBooking, rescheduleBooking } from '@/lib/booking-engine';
import { requireApiUser } from '@/lib/authz';
import { ApiError, jsonError } from '@/lib/nexius';
import { assertSameOrigin } from '@/lib/transactions';

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    return Response.json({ booking: await getBooking(id, user.userId) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await context.params;
    const body = await request.json() as { action?: string; professionalId?: string; startAt?: string; quoteRevision?: number };
    if (body.action === 'cancel') return Response.json({ booking: await cancelBooking(user, id) });
    if (body.action === 'reschedule') {
      if (typeof body.professionalId !== 'string' || typeof body.startAt !== 'string') throw new ApiError(400, 'Escolha o novo profissional e horário.', 'missing_reschedule_data');
      return Response.json({ booking: await rescheduleBooking(user, id, { professionalId: body.professionalId, startAt: body.startAt, quoteRevision: typeof body.quoteRevision === 'number' ? body.quoteRevision : -1 }) });
    }
    throw new ApiError(400, 'Ação inválida.', 'invalid_action');
  } catch (error) {
    return jsonError(error);
  }
}
