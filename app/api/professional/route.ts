import { getBooking, listBookingRecords } from '@/lib/booking-engine';
import { requireProfessionalOrAdmin } from '@/lib/authz';
import { ApiError, database, jsonError } from '@/lib/nexius';
import { createBlock, textValue } from '@/lib/management';
import {
  assertSameOrigin,
  audit,
  guardedBatch,
  requireChanged,
  revision,
} from '@/lib/transactions';

async function resolveProfessional(userId: string, demonstration: boolean) {
  return database()
    .prepare(
      `SELECT id, name FROM professionals WHERE ${demonstration ? 'id' : 'user_id'} = ? AND active=1`,
    )
    .bind(demonstration ? 'pro-ismael' : userId)
    .first<{ id: string; name: string }>();
}
export async function GET() {
  try {
    const access = await requireProfessionalOrAdmin();
    const professional = await resolveProfessional(
      access.user.userId,
      access.demonstration,
    );
    if (!professional)
      throw new ApiError(
        403,
        'Seu acesso não está vinculado a um profissional ativo.',
        'professional_not_linked',
      );
    return Response.json(
      {
        professional,
        bookings: await listBookingRecords('professional', professional.id),
        demonstration: access.demonstration,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const access = await requireProfessionalOrAdmin();
    const professional = await resolveProfessional(
      access.user.userId,
      access.demonstration,
    );
    if (!professional)
      throw new ApiError(
        403,
        'Profissional não vinculado.',
        'professional_not_linked',
      );
    const body = (await request.json()) as Record<string, unknown>;
    if (body.action === 'block.create')
      return Response.json(
        await createBlock(access.user.userId, body, professional.id),
        { status: 201 },
      );
    if (body.action === 'booking.status') {
      const expected = await revision(),
        id = textValue(body.bookingId),
        status = textValue(body.status);
      if (!['completed', 'no_show'].includes(status))
        throw new ApiError(400, 'Ação não permitida.', 'invalid_status');
      const booking = await getBooking(id);
      if (booking.professionalId !== professional.id)
        throw new ApiError(404, 'Reserva não encontrada.', 'booking_not_found');
      await guardedBatch(expected, [
        database()
          .prepare(
            "UPDATE bookings SET status=?,updated_at=? WHERE id=? AND professional_id=? AND status IN ('pending','confirmed')",
          )
          .bind(status, new Date().toISOString(), id, professional.id),
        ...requireChanged(),
        audit(access.user.userId, `booking.${status}`, 'booking', id, {
          professionalId: professional.id,
        }),
      ]);
      return Response.json({ ok: true });
    }
    throw new ApiError(400, 'Ação inválida.', 'invalid_action');
  } catch (error) {
    return jsonError(error);
  }
}
