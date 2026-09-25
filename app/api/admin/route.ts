import {
  createBooking,
  getCatalog,
  getSettings,
  listAllBookings,
  rescheduleBooking,
} from '@/lib/booking-engine';
import { requireAdmin } from '@/lib/authz';
import { ApiError, database, jsonError } from '@/lib/nexius';
import { managementAction, managementData, textValue } from '@/lib/management';
import {
  assertSameOrigin,
  audit,
  guardedBatch,
  requireChanged,
  revision,
} from '@/lib/transactions';
import { periodIndicators } from '@/lib/indicators';

export async function GET(request: Request) {
  try {
    const access = await requireAdmin();
    const db = database();
    const [bookings, catalog, management, settings, blocks, auditLog] =
      await Promise.all([
        listAllBookings(),
        getCatalog(),
        managementData(),
        getSettings(),
        db
          .prepare(
            `SELECT sb.id, sb.professional_id as professionalId, p.name as professionalName, sb.start_at as startAt, sb.end_at as endAt, sb.reason FROM schedule_blocks sb LEFT JOIN professionals p ON p.id=sb.professional_id ORDER BY sb.start_at DESC`,
          )
          .all(),
        db
          .prepare(
            `SELECT a.action, a.actor_user_id as actorId, u.name as actorName, a.entity_type as entityType, a.entity_id as entityId, a.detail_json as detailJson, a.created_at as createdAt FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.created_at DESC LIMIT 100`,
          )
          .all(),
      ]);
    const month =
      new URL(request.url).searchParams.get('month') ||
      new Date().toISOString().slice(0, 7);
    return Response.json(
      {
        access: { demonstration: access.demonstration },
        bookings,
        catalog,
        management,
        settings,
        blocks: blocks.results,
        audit: auditLog.results,
        indicators: await periodIndicators(month),
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
    const access = await requireAdmin();
    const body = (await request.json()) as Record<string, unknown>;
    if (!body || Array.isArray(body))
      throw new ApiError(400, 'Dados inválidos.', 'invalid_body');
    const action = textValue(body.action),
      db = database();
    if (action === 'booking.manual') {
      const booking = await createBooking(access.user, {
        serviceIds: Array.isArray(body.serviceIds)
          ? body.serviceIds.filter(
              (value): value is string => typeof value === 'string',
            )
          : [],
        professionalId: textValue(body.professionalId),
        startAt: textValue(body.startAt),
        name: textValue(body.name),
        phone: textValue(body.phone),
        idempotencyKey: textValue(body.idempotencyKey),
        quoteRevision:
          typeof body.quoteRevision === 'number' ? body.quoteRevision : -1,
        origin: 'admin',
      });
      return Response.json({ booking }, { status: 201 });
    }
    if (action === 'booking.reschedule')
      return Response.json({
        booking: await rescheduleBooking(
          access.user,
          textValue(body.bookingId),
          {
            professionalId: textValue(body.professionalId),
            startAt: textValue(body.startAt),
            quoteRevision:
              typeof body.quoteRevision === 'number' ? body.quoteRevision : -1,
          },
          true,
        ),
      });
    if (action === 'booking.status') {
      const expected = await revision(),
        bookingId = textValue(body.bookingId),
        status = textValue(body.status);
      if (!['completed', 'no_show', 'cancelled'].includes(status))
        throw new ApiError(400, 'Estado inválido.', 'invalid_status');
      await guardedBatch(expected, [
        db
          .prepare(
            "UPDATE bookings SET status=?,updated_at=? WHERE id=? AND status IN ('pending','confirmed')",
          )
          .bind(status, new Date().toISOString(), bookingId),
        ...requireChanged(),
        audit(access.user.userId, `booking.${status}`, 'booking', bookingId, {
          status,
          policyOverride: status === 'cancelled',
          permission: 'administrator',
        }),
      ]);
      return Response.json({ ok: true });
    }
    const result = await managementAction(access.user.userId, body);
    if (!result) throw new ApiError(400, 'Ação inválida.', 'invalid_action');
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
