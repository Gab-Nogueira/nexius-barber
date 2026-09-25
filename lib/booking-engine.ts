import type { ChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDemoSeed } from '@/lib/demo-seed';
import {
  audit,
  guardedBatch,
  revision,
  requireChanged,
} from '@/lib/transactions';
import {
  ApiError,
  database,
  demoModeEnabled,
  localDateParts,
  sha256,
  zonedDateTimeToUtcIso,
  type BookingRecord,
  type CatalogProfessional,
  type CatalogService,
} from '@/lib/nexius';

type ServicePricing = {
  id: string;
  name: string;
  priceCents: number;
  durationMinutes: number;
  source: string;
  requiresServiceId: string | null;
  comboServiceIdsJson: string;
};

type AvailabilitySlot = {
  startAt: string;
  endAt: string;
  time: string;
  professionalId: string;
  professionalName: string;
  totalCents: number;
  durationMinutes: number;
  quoteRevision: number;
  cancellationLimitHours: number;
};

type Settings = {
  timezone: string;
  cancellationLimitHours: number;
  minimumNoticeMinutes: number;
  bookingHorizonDays: number;
  slotStepMinutes: number;
  defaultBufferMinutes: number;
  policyVersion: string;
  configRevision: number;
};

function placeholders(count: number) {
  return Array.from({ length: count }, () => '?').join(', ');
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

function weekdayFromDate(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

function minutesToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export async function getSettings(): Promise<Settings> {
  await ensureDemoSeed();
  const row = await database()
    .prepare(`SELECT
    timezone,
    cancellation_limit_hours as cancellationLimitHours,
    minimum_notice_minutes as minimumNoticeMinutes,
    booking_horizon_days as bookingHorizonDays,
    slot_step_minutes as slotStepMinutes,
    default_buffer_minutes as defaultBufferMinutes,
    policy_version as policyVersion, config_revision as configRevision
    FROM business_settings WHERE id = 'main'`)
    .first<Settings>();
  if (!row)
    throw new ApiError(
      503,
      'A agenda ainda não foi configurada.',
      'settings_missing',
    );
  return row;
}

export async function ensureUser(
  user: ChatGPTUser,
  name?: string,
  phone?: string,
) {
  const db = database();
  const now = new Date().toISOString();
  const displayName = (
    name?.trim() ||
    user.fullName ||
    user.displayName ||
    user.email
  ).slice(0, 100);
  await db
    .prepare(`INSERT INTO users (id, email, name, phone, role, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'customer', ?, ?)
    ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = CASE WHEN ? = 1 THEN excluded.name ELSE users.name END,
      phone = COALESCE(excluded.phone, users.phone), updated_at = excluded.updated_at`)
    .bind(
      user.userId,
      user.email.toLocaleLowerCase('pt-BR'),
      displayName,
      phone?.trim() || null,
      now,
      now,
      name ? 1 : 0,
    )
    .run();
  return db
    .prepare('SELECT id, email, name, phone, role FROM users WHERE id = ?')
    .bind(user.userId)
    .first<{
      id: string;
      email: string;
      name: string;
      phone: string | null;
      role: string;
    }>();
}

export async function getCatalog() {
  await ensureDemoSeed();
  const db = database();
  const [serviceResult, professionalResult, relationResult] = await Promise.all(
    [
      db
        .prepare(`SELECT s.id, s.category_id as categoryId, c.name as categoryName, s.name,
      s.description, s.price_cents as priceCents, s.duration_minutes as durationMinutes,
      s.source, s.requires_service_id as requiresServiceId, s.photo_id as photoId,
      s.combo_service_ids_json as comboServiceIdsJson
      FROM services s JOIN categories c ON c.id = s.category_id
      WHERE s.active = 1 AND c.active = 1 AND s.duration_minutes > 0 ${demoModeEnabled() ? '' : "AND s.source = 'validated'"}
      ORDER BY c.display_order, s.display_order`)
        .all<CatalogService>(),
      db
        .prepare(
          `SELECT p.id, p.name, p.photo_key as photoId, m.alt_text as photoAlt FROM professionals p LEFT JOIN media_files m ON m.id = p.photo_key WHERE active = 1 ORDER BY display_order`,
        )
        .all<{ id: string; name: string }>(),
      db
        .prepare(
          'SELECT professional_id as professionalId, service_id as serviceId, price_cents as priceCents, duration_minutes as durationMinutes FROM professional_services',
        )
        .all<{
          professionalId: string;
          serviceId: string;
          priceCents: number | null;
          durationMinutes: number | null;
        }>(),
    ],
  );
  const relations = relationResult.results;
  const professionals: CatalogProfessional[] = professionalResult.results.map(
    (professional) => ({
      ...professional,
      serviceIds: relations
        .filter((relation) => relation.professionalId === professional.id)
        .map((relation) => relation.serviceId),
      pricing: relations
        .filter((relation) => relation.professionalId === professional.id)
        .map(({ serviceId, priceCents, durationMinutes }) => ({
          serviceId,
          priceCents,
          durationMinutes,
        })),
    }),
  );
  return {
    services: serviceResult.results,
    professionals,
    timezone: (await getSettings()).timezone,
    settings: await getSettings(),
    disclaimer: 'Demonstração — os horários não são reservas reais.',
  };
}

export async function getEligibleProfessionals(serviceIds: string[]) {
  if (
    !serviceIds.length ||
    serviceIds.length > 5 ||
    !serviceIds.every((id) => typeof id === 'string')
  )
    return [];
  const db = database();
  const result = await db
    .prepare(`SELECT p.id, p.name
    FROM professionals p
    JOIN professional_services ps ON ps.professional_id = p.id
    JOIN services s ON s.id = ps.service_id JOIN categories c ON c.id = s.category_id
    WHERE p.active = 1 AND s.active = 1 AND c.active = 1 ${demoModeEnabled() ? '' : "AND s.source = 'validated'"} AND s.id IN (${placeholders(serviceIds.length)})
    GROUP BY p.id, p.name
    HAVING COUNT(DISTINCT s.id) = ?
    ORDER BY p.display_order`)
    .bind(...serviceIds, serviceIds.length)
    .all<{ id: string; name: string }>();
  return result.results;
}

export async function getOfficialPricing(
  professionalId: string,
  serviceIds: string[],
): Promise<ServicePricing[]> {
  if (!serviceIds.length || serviceIds.length > 5)
    throw new ApiError(
      400,
      'Selecione de um a cinco serviços.',
      'invalid_services',
    );
  const result = await database()
    .prepare(`SELECT s.id, s.name,
      COALESCE(ps.price_cents, s.price_cents) as priceCents,
      COALESCE(ps.duration_minutes, s.duration_minutes) as durationMinutes,
      s.source, s.requires_service_id as requiresServiceId, s.combo_service_ids_json as comboServiceIdsJson
    FROM services s
    JOIN professional_services ps ON ps.service_id = s.id AND ps.professional_id = ?
    JOIN professionals p ON p.id = ps.professional_id JOIN categories c ON c.id = s.category_id
    WHERE s.active = 1 AND p.active = 1 AND c.active = 1 ${demoModeEnabled() ? '' : "AND s.source = 'validated'"} AND s.id IN (${placeholders(serviceIds.length)})`)
    .bind(professionalId, ...serviceIds)
    .all<ServicePricing>();
  if (result.results.length !== new Set(serviceIds).size) {
    throw new ApiError(
      409,
      'O profissional não atende a combinação selecionada.',
      'professional_incompatible',
    );
  }
  if (
    result.results.some(
      (service) => service.priceCents < 0 || service.durationMinutes <= 0,
    )
  ) {
    throw new ApiError(
      409,
      'Um serviço selecionado ainda não está configurado para reserva.',
      'service_incomplete',
    );
  }
  const covered = new Set<string>();
  for (const service of result.results) {
    if (
      service.requiresServiceId &&
      !serviceIds.includes(service.requiresServiceId)
    )
      throw new ApiError(
        409,
        'Este adicional exige a seleção do serviço principal.',
        'missing_required_service',
      );
    const components = JSON.parse(service.comboServiceIdsJson) as string[];
    for (const component of components.length ? components : [service.id]) {
      if (
        covered.has(component) ||
        (components.length && serviceIds.includes(component))
      )
        throw new ApiError(
          409,
          'O combo já inclui um dos serviços selecionados. Remova a duplicidade.',
          'duplicate_combo_service',
        );
      covered.add(component);
    }
  }
  return result.results;
}

export async function getAvailability(input: {
  serviceIds: string[];
  date: string;
  professionalId?: string;
  excludeBookingId?: string;
}): Promise<AvailabilitySlot[]> {
  await ensureDemoSeed();
  const settings = await getSettings();
  const now = new Date();
  const today = localDateParts(now.toISOString(), settings.timezone).date;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    input.date < today ||
    input.date > addDays(today, settings.bookingHorizonDays)
  ) {
    throw new ApiError(
      400,
      'Escolha uma data dentro do período disponível.',
      'date_out_of_range',
    );
  }
  const professionals = input.professionalId
    ? (await getEligibleProfessionals(input.serviceIds)).filter(
        (item) => item.id === input.professionalId,
      )
    : await getEligibleProfessionals(input.serviceIds);
  if (!professionals.length) return [];

  const db = database();
  const weekday = weekdayFromDate(input.date);
  const dayStart = zonedDateTimeToUtcIso(input.date, 0, settings.timezone);
  const dayEnd = zonedDateTimeToUtcIso(
    addDays(input.date, 1),
    0,
    settings.timezone,
  );
  const slots: AvailabilitySlot[] = [];

  for (const professional of professionals) {
    const pricing = await getOfficialPricing(professional.id, input.serviceIds);
    const duration = pricing.reduce(
      (sum, service) => sum + service.durationMinutes,
      0,
    );
    const schedule = await db
      .prepare(`SELECT start_minute as startMinute, end_minute as endMinute,
      break_start_minute as breakStartMinute, break_end_minute as breakEndMinute
      FROM weekly_schedules WHERE professional_id = ? AND weekday = ? ORDER BY start_minute LIMIT 1`)
      .bind(professional.id, weekday)
      .first<{
        startMinute: number;
        endMinute: number;
        breakStartMinute: number | null;
        breakEndMinute: number | null;
      }>();
    if (!schedule) continue;
    const unit = await db
      .prepare(
        'SELECT start_minute as startMinute, end_minute as endMinute FROM unit_schedules WHERE weekday = ?',
      )
      .bind(weekday)
      .first<{ startMinute: number; endMinute: number }>();
    if (!unit) continue;
    schedule.startMinute = Math.max(schedule.startMinute, unit.startMinute);
    schedule.endMinute = Math.min(schedule.endMinute, unit.endMinute);

    const [bookingResult, blockResult] = await Promise.all([
      db
        .prepare(`SELECT id, start_at as startAt, strftime('%Y-%m-%dT%H:%M:%fZ', end_at, '+' || buffer_minutes || ' minutes') as endAt FROM bookings
        WHERE professional_id = ? AND status IN ('pending', 'confirmed')
          AND start_at < ? AND end_at > ? ${input.excludeBookingId ? 'AND id <> ?' : ''}`)
        .bind(
          professional.id,
          dayEnd,
          dayStart,
          ...(input.excludeBookingId ? [input.excludeBookingId] : []),
        )
        .all<{ id: string; startAt: string; endAt: string }>(),
      db
        .prepare(`SELECT start_at as startAt, end_at as endAt FROM schedule_blocks
        WHERE (professional_id = ? OR professional_id IS NULL) AND start_at < ? AND end_at > ?`)
        .bind(professional.id, dayEnd, dayStart)
        .all<{ startAt: string; endAt: string }>(),
    ]);
    const occupied = [...bookingResult.results, ...blockResult.results];

    for (
      let startMinute = schedule.startMinute;
      startMinute + duration <= schedule.endMinute;
      startMinute += settings.slotStepMinutes
    ) {
      const occupiedEndMinute =
        startMinute + duration + settings.defaultBufferMinutes;
      if (occupiedEndMinute > schedule.endMinute) continue;
      if (
        schedule.breakStartMinute !== null &&
        schedule.breakEndMinute !== null &&
        startMinute < schedule.breakEndMinute &&
        occupiedEndMinute > schedule.breakStartMinute
      )
        continue;
      const startAt = zonedDateTimeToUtcIso(
        input.date,
        startMinute,
        settings.timezone,
      );
      const endAt = new Date(
        new Date(startAt).getTime() + duration * 60_000,
      ).toISOString();
      const occupiedEndAt = new Date(
        new Date(endAt).getTime() + settings.defaultBufferMinutes * 60_000,
      ).toISOString();
      if (
        new Date(startAt).getTime() <
        now.getTime() + settings.minimumNoticeMinutes * 60_000
      )
        continue;
      if (
        occupied.some(
          (interval) =>
            startAt < interval.endAt && occupiedEndAt > interval.startAt,
        )
      )
        continue;
      slots.push({
        startAt,
        endAt,
        time: minutesToTime(startMinute),
        professionalId: professional.id,
        professionalName: professional.name,
        totalCents: pricing.reduce(
          (sum, service) => sum + service.priceCents,
          0,
        ),
        durationMinutes: duration,
        quoteRevision: settings.configRevision,
        cancellationLimitHours: settings.cancellationLimitHours,
      });
    }
  }

  return slots.sort(
    (a, b) =>
      a.startAt.localeCompare(b.startAt) ||
      a.professionalName.localeCompare(b.professionalName),
  );
}

export async function createBooking(
  user: ChatGPTUser,
  input: {
    serviceIds: string[];
    professionalId: string;
    startAt: string;
    name: string;
    phone: string;
    idempotencyKey: string;
    origin?: 'public' | 'admin';
    quoteRevision?: number;
  },
) {
  await ensureDemoSeed();
  const serviceIds = Array.from(new Set(input.serviceIds));
  if (input.name.trim().length < 2 || input.name.length > 100)
    throw new ApiError(
      400,
      'Informe um nome de 2 a 100 caracteres.',
      'invalid_name',
    );
  const phoneDigits = input.phone.replace(/\D/g, '');
  if (phoneDigits.length < 10 || phoneDigits.length > 13)
    throw new ApiError(400, 'Informe um telefone válido.', 'invalid_phone');
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(input.idempotencyKey))
    throw new ApiError(
      400,
      'Identificador da tentativa inválido.',
      'invalid_idempotency_key',
    );
  const startDate = new Date(input.startAt);
  if (Number.isNaN(startDate.getTime()))
    throw new ApiError(400, 'Horário inválido.', 'invalid_slot');
  const account = await ensureUser(
    user,
    input.origin === 'admin' ? undefined : input.name,
    input.origin === 'admin' ? undefined : input.phone,
  );
  if (!account)
    throw new ApiError(
      500,
      'Não foi possível preparar sua conta.',
      'user_missing',
    );
  const db = database();
  const scopedIdempotencyKey = `${user.userId}:${input.idempotencyKey}`;
  const requestHash = await sha256(
    JSON.stringify({
      serviceIds: [...serviceIds].sort(),
      professionalId: input.professionalId,
      startAt: startDate.toISOString(),
      name: input.name.trim(),
      phoneDigits,
    }),
  );
  const priorAttempt = await db
    .prepare(
      'SELECT id, request_hash as requestHash FROM bookings WHERE idempotency_key = ?',
    )
    .bind(scopedIdempotencyKey)
    .first<{ id: string; requestHash: string }>();
  if (priorAttempt) {
    if (priorAttempt.requestHash !== requestHash)
      throw new ApiError(
        409,
        'Essa tentativa já foi usada com dados diferentes.',
        'idempotency_mismatch',
      );
    return getBooking(priorAttempt.id, user.userId);
  }
  const settings = await getSettings();
  if (
    input.quoteRevision !== undefined &&
    input.quoteRevision !== settings.configRevision
  )
    throw new ApiError(
      409,
      'Preço, política ou disponibilidade foram atualizados. Revise o horário antes de confirmar.',
      'configuration_changed',
    );
  const local = localDateParts(input.startAt, settings.timezone);
  const available = await getAvailability({
    serviceIds,
    date: local.date,
    professionalId: input.professionalId,
  });
  const selectedSlot = available.find(
    (slot) => slot.startAt === startDate.toISOString(),
  );
  if (!selectedSlot)
    throw new ApiError(
      409,
      'Esse horário acabou de ser reservado ou ficou indisponível.',
      'slot_conflict',
    );
  const pricing = await getOfficialPricing(input.professionalId, serviceIds);
  const totalCents = pricing.reduce(
    (sum, service) => sum + service.priceCents,
    0,
  );
  const totalDuration = pricing.reduce(
    (sum, service) => sum + service.durationMinutes,
    0,
  );
  const endAt = new Date(
    startDate.getTime() + totalDuration * 60_000,
  ).toISOString();
  const id = crypto.randomUUID();
  const reference = `NXS-${Date.now().toString(36).slice(-5).toUpperCase()}${crypto.randomUUID().slice(0, 3).toUpperCase()}`;
  const now = new Date().toISOString();
  const insertBooking = db
    .prepare(`INSERT INTO bookings
    (id, reference, customer_user_id, client_name, client_phone, professional_id, start_at, end_at, status, origin,
      idempotency_key, request_hash, total_cents, timezone, policy_version, created_at, updated_at, buffer_minutes, cancellation_limit_hours)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (
      SELECT 1 FROM bookings WHERE professional_id = ? AND status IN ('pending', 'confirmed')
        AND start_at < ? AND strftime('%Y-%m-%dT%H:%M:%fZ', end_at, '+' || buffer_minutes || ' minutes') > ?
    ) AND NOT EXISTS (
      SELECT 1 FROM schedule_blocks WHERE (professional_id = ? OR professional_id IS NULL)
        AND start_at < ? AND end_at > ?
    ) RETURNING id`)
    .bind(
      id,
      reference,
      user.userId,
      input.name.trim(),
      input.phone.trim(),
      input.professionalId,
      startDate.toISOString(),
      endAt,
      input.origin ?? 'public',
      scopedIdempotencyKey,
      requestHash,
      totalCents,
      settings.timezone,
      settings.policyVersion,
      now,
      now,
      settings.defaultBufferMinutes,
      settings.cancellationLimitHours,
      input.professionalId,
      new Date(
        new Date(endAt).getTime() + settings.defaultBufferMinutes * 60_000,
      ).toISOString(),
      startDate.toISOString(),
      input.professionalId,
      new Date(
        new Date(endAt).getTime() + settings.defaultBufferMinutes * 60_000,
      ).toISOString(),
      startDate.toISOString(),
    );
  const statements: D1PreparedStatement[] = [insertBooking];
  for (const service of pricing) {
    statements.push(
      db
        .prepare(`INSERT INTO booking_items
      (id, booking_id, service_id, name_snapshot, price_cents_snapshot, duration_minutes_snapshot)
      SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM bookings WHERE id = ?)`)
        .bind(
          crypto.randomUUID(),
          id,
          service.id,
          service.name,
          service.priceCents,
          service.durationMinutes,
          id,
        ),
    );
  }
  statements.push(
    db
      .prepare(`INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, detail_json, created_at)
      SELECT ?, ?, 'booking.created', 'booking', ?, ?, ? WHERE EXISTS (SELECT 1 FROM bookings WHERE id = ?)`)
      .bind(
        crypto.randomUUID(),
        user.userId,
        id,
        JSON.stringify({
          origin: input.origin ?? 'public',
          status: 'confirmed',
        }),
        now,
        id,
      ),
    db
      .prepare(`INSERT INTO notifications (id, booking_id, channel, status, detail, created_at, updated_at)
      SELECT ?, ?, 'local-demo', 'test_logged', 'Mensagem registrada somente na caixa local de demonstração.', ?, ?
      WHERE EXISTS (SELECT 1 FROM bookings WHERE id = ?)`)
      .bind(crypto.randomUUID(), id, now, now, id),
  );

  try {
    const results = await guardedBatch(
      settings.configRevision,
      statements,
      'config',
    );
    const inserted = (
      results[0]?.results as Array<{ id: string }> | undefined
    )?.[0];
    if (!inserted)
      throw new ApiError(
        409,
        'Esse horário acabou de ser reservado.',
        'slot_conflict',
      );
  } catch (error) {
    const existing = await db
      .prepare(
        'SELECT id, request_hash as requestHash FROM bookings WHERE idempotency_key = ?',
      )
      .bind(scopedIdempotencyKey)
      .first<{ id: string; requestHash: string }>();
    if (existing) {
      if (existing.requestHash !== requestHash)
        throw new ApiError(
          409,
          'Essa tentativa já foi usada com dados diferentes.',
          'idempotency_mismatch',
        );
      return getBooking(existing.id, user.userId);
    }
    if (error instanceof ApiError) throw error;
    throw error;
  }
  return getBooking(id, user.userId);
}

export async function getBooking(
  id: string,
  customerUserId?: string,
): Promise<BookingRecord> {
  const db = database();
  const booking = await db
    .prepare(`SELECT b.id, b.reference, b.client_name as clientName, b.client_phone as clientPhone,
      b.professional_id as professionalId, p.name as professionalName, b.start_at as startAt, b.end_at as endAt,
      b.status, b.total_cents as totalCents, b.created_at as createdAt, b.customer_user_id as customerUserId,
      b.cancellation_limit_hours as cancellationLimitHours, b.timezone, b.policy_version as policyVersion
    FROM bookings b JOIN professionals p ON p.id = b.professional_id
    WHERE b.id = ?`)
    .bind(id)
    .first<BookingRecord & { customerUserId: string }>();
  if (
    !booking ||
    (customerUserId && booking.customerUserId !== customerUserId)
  ) {
    throw new ApiError(404, 'Agendamento não encontrado.', 'booking_not_found');
  }
  const items = await db
    .prepare(`SELECT service_id as id, name_snapshot as name,
    price_cents_snapshot as priceCents, duration_minutes_snapshot as durationMinutes
    FROM booking_items WHERE booking_id = ? ORDER BY rowid`)
    .bind(id)
    .all<{
      id: string;
      name: string;
      priceCents: number;
      durationMinutes: number;
    }>();
  const { customerUserId: _owner, ...result } = booking;
  return { ...result, services: items.results };
}

export async function listCustomerBookings(customerUserId: string) {
  return listBookingRecords('customer', customerUserId);
}

export async function cancelBooking(user: ChatGPTUser, bookingId: string) {
  const expected = await revision();
  const booking = await getBooking(bookingId, user.userId);
  if (!['pending', 'confirmed'].includes(booking.status))
    throw new ApiError(
      409,
      'Este agendamento não pode mais ser cancelado.',
      'invalid_status',
    );
  if (
    new Date(booking.startAt).getTime() - Date.now() <
    booking.cancellationLimitHours * 3_600_000
  ) {
    throw new ApiError(
      409,
      `O cancelamento online encerra ${booking.cancellationLimitHours} horas antes do atendimento. Entre em contato com a barbearia.`,
      'cancellation_deadline',
    );
  }
  const now = new Date().toISOString();
  const db = database();
  const results = await guardedBatch(expected, [
    db
      .prepare(`UPDATE bookings SET status = 'cancelled', updated_at = ?
      WHERE id = ? AND customer_user_id = ? AND status IN ('pending', 'confirmed') RETURNING id`)
      .bind(now, bookingId, user.userId),
    ...requireChanged(),
    db
      .prepare(`INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, 'booking.cancelled', 'booking', ?, ?, ?)`)
      .bind(
        crypto.randomUUID(),
        user.userId,
        bookingId,
        JSON.stringify({ previousStatus: booking.status }),
        now,
      ),
  ]);
  if (!(results[0].results as unknown[]).length)
    throw new ApiError(
      409,
      'O estado do agendamento mudou. Atualize a página.',
      'stale_booking',
    );
  return getBooking(bookingId, user.userId);
}

export async function rescheduleBooking(
  user: ChatGPTUser,
  bookingId: string,
  input: { professionalId: string; startAt: string; quoteRevision?: number },
  admin = false,
) {
  const operationRevision = await revision();
  const current = await getBooking(bookingId, admin ? undefined : user.userId);
  if (!['pending', 'confirmed'].includes(current.status))
    throw new ApiError(
      409,
      'Este agendamento não pode ser remarcado.',
      'invalid_status',
    );
  if (
    !admin &&
    new Date(current.startAt).getTime() - Date.now() <
      current.cancellationLimitHours * 3_600_000
  )
    throw new ApiError(
      409,
      `A remarcação online encerra ${current.cancellationLimitHours} horas antes. Entre em contato com a barbearia.`,
      'reschedule_deadline',
    );
  if (!Number.isFinite(new Date(input.startAt).getTime()))
    throw new ApiError(400, 'Data inválida.', 'invalid_datetime');
  const serviceIds = current.services.map((service) => service.id);
  const settings = await getSettings();
  if (
    input.quoteRevision !== undefined &&
    input.quoteRevision !== settings.configRevision
  )
    throw new ApiError(
      409,
      'A configuração mudou. Revise preço e horário.',
      'configuration_changed',
    );
  const local = localDateParts(input.startAt, settings.timezone);
  const availability = await getAvailability({
    serviceIds,
    date: local.date,
    professionalId: input.professionalId,
    excludeBookingId: bookingId,
  });
  const slot = availability.find(
    (candidate) => candidate.startAt === new Date(input.startAt).toISOString(),
  );
  if (!slot)
    throw new ApiError(
      409,
      'O novo horário não está mais disponível. Sua reserva original foi mantida.',
      'slot_conflict_original_preserved',
    );
  const pricing = await getOfficialPricing(input.professionalId, serviceIds);
  const totalCents = pricing.reduce(
    (sum, service) => sum + service.priceCents,
    0,
  );
  const duration = pricing.reduce(
    (sum, service) => sum + service.durationMinutes,
    0,
  );
  const endAt = new Date(
    new Date(slot.startAt).getTime() + duration * 60_000,
  ).toISOString();
  const now = new Date().toISOString();
  const db = database();
  const occupiedEnd = new Date(
    new Date(endAt).getTime() + settings.defaultBufferMinutes * 60_000,
  ).toISOString();
  const update = db
    .prepare(`UPDATE bookings SET professional_id = ?, start_at = ?, end_at = ?, total_cents = ?, updated_at = ?, buffer_minutes = ?, policy_version = ?, cancellation_limit_hours = ?
    WHERE id = ? AND status IN ('pending', 'confirmed')
      AND NOT EXISTS (SELECT 1 FROM bookings other WHERE other.professional_id = ? AND other.id <> ?
        AND other.status IN ('pending', 'confirmed') AND other.start_at < ? AND strftime('%Y-%m-%dT%H:%M:%fZ', other.end_at, '+' || other.buffer_minutes || ' minutes') > ?)
      AND NOT EXISTS (SELECT 1 FROM schedule_blocks block WHERE (block.professional_id = ? OR block.professional_id IS NULL)
        AND block.start_at < ? AND block.end_at > ?)
    RETURNING id`)
    .bind(
      input.professionalId,
      slot.startAt,
      endAt,
      totalCents,
      now,
      settings.defaultBufferMinutes,
      settings.policyVersion,
      settings.cancellationLimitHours,
      bookingId,
      input.professionalId,
      bookingId,
      occupiedEnd,
      slot.startAt,
      input.professionalId,
      occupiedEnd,
      slot.startAt,
    );
  await guardedBatch(operationRevision, [
    update,
    ...requireChanged(),
    db
      .prepare('DELETE FROM booking_items WHERE booking_id = ?')
      .bind(bookingId),
    ...pricing.map((service) =>
      db
        .prepare(
          `INSERT INTO booking_items (id, booking_id, service_id, name_snapshot, price_cents_snapshot, duration_minutes_snapshot) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          bookingId,
          service.id,
          service.name,
          service.priceCents,
          service.durationMinutes,
        ),
    ),
    audit(user.userId, 'booking.rescheduled', 'booking', bookingId, {
      from: current.startAt,
      to: slot.startAt,
      professionalId: input.professionalId,
      policyOverride: admin,
    }),
  ]);
  return getBooking(bookingId, admin ? undefined : user.userId);
}

export async function listAllBookings() {
  return listBookingRecords('all');
}

// One indexed query, not two queries per reservation. Keeps day views within
// D1's per-request query budget even when the history grows.
export async function listBookingRecords(scope: 'all' | 'customer' | 'professional', owner = ''): Promise<BookingRecord[]> {
  const where = scope === 'customer' ? 'WHERE b.customer_user_id = ?' : scope === 'professional' ? 'WHERE b.professional_id = ?' : '';
  const statement = database().prepare(`SELECT b.id,b.reference,b.client_name AS clientName,b.client_phone AS clientPhone,
    b.professional_id AS professionalId,p.name AS professionalName,b.start_at AS startAt,b.end_at AS endAt,b.status,
    b.total_cents AS totalCents,b.created_at AS createdAt,b.cancellation_limit_hours AS cancellationLimitHours,b.timezone,b.policy_version AS policyVersion,
    (SELECT json_group_array(json_object('id',service_id,'name',name_snapshot,'priceCents',price_cents_snapshot,'durationMinutes',duration_minutes_snapshot))
      FROM (SELECT service_id,name_snapshot,price_cents_snapshot,duration_minutes_snapshot FROM booking_items WHERE booking_id=b.id ORDER BY rowid)) AS servicesJson
    FROM bookings b JOIN professionals p ON p.id=b.professional_id ${where} ORDER BY b.start_at DESC`);
  const rows = await (scope === 'all' ? statement : statement.bind(owner)).all<Omit<BookingRecord,'services'> & {servicesJson:string}>();
  return rows.results.map(({servicesJson,...row})=>({...row,services:JSON.parse(servicesJson || '[]') as BookingRecord['services']}));
}
