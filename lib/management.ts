import {
  ApiError,
  database,
  localDateParts,
  zonedDateTimeToUtcIso,
} from './nexius';
import { audit, guardedBatch, requireChanged, revision } from './transactions';
import { getSettings } from './booking-engine';
import { CONTENT_DEFAULTS } from './content';

export function textValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}
function integer(value: unknown, min: number, max: number, label: string) {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  )
    throw new ApiError(
      400,
      `${label}: informe um número inteiro entre ${min} e ${max}.`,
      'invalid_field',
    );
  return value;
}
function name(value: unknown) {
  const result = textValue(value);
  if (result.length < 2 || result.length > 160)
    throw new ApiError(
      400,
      'O nome deve ter entre 2 e 160 caracteres.',
      'invalid_name',
    );
  return result;
}
async function mediaId(value: unknown) {
  const id = textValue(value);
  if (
    id &&
    !(await database()
      .prepare('SELECT id FROM media_files WHERE id = ?')
      .bind(id)
      .first())
  )
    throw new ApiError(
      400,
      'Selecione uma imagem da biblioteca.',
      'invalid_media',
    );
  return id || null;
}
export type Schedule = {
  weekday: number;
  startMinute: number;
  endMinute: number;
  breakStartMinute: number | null;
  breakEndMinute: number | null;
};
function schedules(value: unknown): Schedule[] {
  if (!Array.isArray(value) || value.length > 7)
    throw new ApiError(
      400,
      'Informe uma grade de até sete dias.',
      'invalid_schedule',
    );
  const weekdays = new Set<number>();
  return value.map((entry: Record<string, unknown>) => {
    const weekday = integer(entry.weekday, 0, 6, 'Dia');
    const startMinute = integer(entry.startMinute, 0, 1439, 'Início');
    const endMinute = integer(entry.endMinute, startMinute + 1, 1440, 'Fim');
    if (weekdays.has(weekday))
      throw new ApiError(
        400,
        'Cada dia deve aparecer uma única vez.',
        'duplicate_weekday',
      );
    weekdays.add(weekday);
    const breakStartMinute =
      entry.breakStartMinute == null
        ? null
        : integer(
            entry.breakStartMinute,
            startMinute,
            endMinute - 1,
            'Início da pausa',
          );
    const breakEndMinute =
      breakStartMinute === null
        ? null
        : integer(
            entry.breakEndMinute,
            breakStartMinute + 1,
            endMinute,
            'Fim da pausa',
          );
    return {
      weekday,
      startMinute,
      endMinute,
      breakStartMinute,
      breakEndMinute,
    };
  });
}
export class ConflictsError extends ApiError {
  constructor(
    message: string,
    code: string,
    public conflicts: unknown[],
  ) {
    super(409, message, code);
  }
}
async function futureBookings(professionalId?: string) {
  return (
    await database()
      .prepare(`SELECT id, reference, professional_id as professionalId, start_at as startAt,
    strftime('%Y-%m-%dT%H:%M:%fZ', end_at, '+' || buffer_minutes || ' minutes') as endAt
    FROM bookings WHERE status IN ('pending','confirmed') AND end_at > ? ${professionalId ? 'AND professional_id = ?' : ''}`)
      .bind(
        new Date().toISOString(),
        ...(professionalId ? [professionalId] : []),
      )
      .all<{
        id: string;
        reference: string;
        professionalId: string;
        startAt: string;
        endAt: string;
      }>()
  ).results;
}
async function scheduleConflicts(rows: Schedule[], professionalId?: string) {
  const { timezone } = await getSettings();
  return (await futureBookings(professionalId)).filter((booking) => {
    const start = localDateParts(booking.startAt, timezone);
    const end = localDateParts(booking.endAt, timezone);
    const weekday = new Date(`${start.date}T12:00:00Z`).getUTCDay();
    const row = rows.find((item) => item.weekday === weekday);
    const minute = (time: string) =>
      Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    return (
      !row ||
      start.date !== end.date ||
      minute(start.time) < row.startMinute ||
      minute(end.time) > row.endMinute ||
      (row.breakStartMinute !== null &&
        row.breakEndMinute !== null &&
        minute(start.time) < row.breakEndMinute &&
        minute(end.time) > row.breakStartMinute)
    );
  });
}

export async function createBlock(
  actor: string,
  input: Record<string, unknown>,
  restrictedProfessionalId?: string,
) {
  const expected = await revision();
  const db = database();
  const professionalId =
    restrictedProfessionalId || textValue(input.professionalId) || null;
  const { timezone } = await getSettings();
  function instant(value: unknown) {
    const raw = textValue(value);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw))
      return zonedDateTimeToUtcIso(
        raw.slice(0, 10),
        Number(raw.slice(11, 13)) * 60 + Number(raw.slice(14, 16)),
        timezone,
      );
    if (!Number.isFinite(new Date(raw).getTime()))
      throw new ApiError(400, 'Informe uma data válida.', 'invalid_block');
    return new Date(raw).toISOString();
  }
  const startAt = instant(input.startAt),
    endAt = instant(input.endAt),
    reason = name(input.reason);
  if (startAt >= endAt)
    throw new ApiError(
      400,
      'O fim deve ser posterior ao início.',
      'invalid_block',
    );
  if (
    professionalId &&
    !(await db
      .prepare('SELECT id FROM professionals WHERE id = ?')
      .bind(professionalId)
      .first())
  )
    throw new ApiError(400, 'Profissional inválido.', 'invalid_professional');
  const conflicts = (await futureBookings(professionalId || undefined)).filter(
    (item) => item.startAt < endAt && item.endAt > startAt,
  );
  if (conflicts.length)
    throw new ConflictsError(
      'Resolva as reservas conflitantes antes de bloquear o período.',
      'block_has_conflicts',
      conflicts,
    );
  const id = crypto.randomUUID();
  await guardedBatch(expected, [
    db
      .prepare(
        'INSERT INTO schedule_blocks (id, professional_id, start_at, end_at, reason, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        id,
        professionalId,
        startAt,
        endAt,
        reason,
        actor,
        new Date().toISOString(),
      ),
    audit(actor, 'schedule.blocked', 'schedule_block', id, {
      professionalId,
      startAt,
      endAt,
    }),
  ]);
  return { ok: true, id };
}

export async function managementData() {
  const db = database();
  const [
    services,
    categories,
    professionals,
    relations,
    schedules,
    unit,
    media,
    content,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT s.id, s.name, s.description, s.category_id as categoryId, c.name as categoryName, s.price_cents as priceCents, s.duration_minutes as durationMinutes, s.active, s.source, s.display_order as displayOrder, s.requires_service_id as requiresServiceId, s.photo_id as photoId, s.combo_service_ids_json as comboServiceIdsJson FROM services s JOIN categories c ON c.id = s.category_id ORDER BY s.display_order, s.name`,
      )
      .all(),
    db
      .prepare(
        'SELECT id, name, slug, active, display_order as displayOrder FROM categories ORDER BY display_order',
      )
      .all(),
    db
      .prepare(
        'SELECT id, name, user_id as userId, active, photo_key as photoId, display_order as displayOrder FROM professionals ORDER BY display_order',
      )
      .all(),
    db
      .prepare(
        'SELECT professional_id as professionalId, service_id as serviceId, price_cents as priceCents, duration_minutes as durationMinutes FROM professional_services',
      )
      .all(),
    db
      .prepare(
        'SELECT professional_id as professionalId, weekday, start_minute as startMinute, end_minute as endMinute, break_start_minute as breakStartMinute, break_end_minute as breakEndMinute FROM weekly_schedules ORDER BY weekday',
      )
      .all(),
    db
      .prepare(
        'SELECT weekday, start_minute as startMinute, end_minute as endMinute FROM unit_schedules ORDER BY weekday',
      )
      .all(),
    db
      .prepare(
        'SELECT id, original_name as name, alt_text as altText FROM media_files ORDER BY created_at DESC',
      )
      .all(),
    db
      .prepare('SELECT key, value FROM content_entries')
      .all<{ key: string; value: string }>(),
  ]);
  return {
    services: services.results,
    timezone: (await getSettings()).timezone,
    categories: categories.results,
    professionals: professionals.results,
    relations: relations.results,
    schedules: schedules.results,
    unit: unit.results,
    media: media.results,
    content: {
      ...CONTENT_DEFAULTS,
      ...Object.fromEntries(
        content.results.map((item) => [item.key, item.value]),
      ),
    },
  };
}

export async function managementAction(
  actor: string,
  body: Record<string, unknown>,
) {
  const action = textValue(body.action),
    db = database(),
    now = new Date().toISOString();
  if (action === 'block.create') return createBlock(actor, body);
  const expected = await revision();
  const statements: D1PreparedStatement[] = [];
  let id = textValue(body.id) || crypto.randomUUID();
  if (action === 'category.save') {
    const active = body.active === true;
    if (!active) {
      const conflicts = await db
        .prepare(
          `SELECT DISTINCT b.reference FROM bookings b JOIN booking_items bi ON bi.booking_id = b.id JOIN services s ON s.id = bi.service_id WHERE s.category_id = ? AND b.status IN ('pending','confirmed') AND b.start_at > ?`,
        )
        .bind(id, now)
        .all();
      if (conflicts.results.length)
        throw new ConflictsError(
          'A categoria possui reservas futuras.',
          'category_has_future_bookings',
          conflicts.results,
        );
    }
    statements.push(
      db
        .prepare(
          `INSERT INTO categories (id, name, slug, active, display_order) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, active=excluded.active, display_order=excluded.display_order`,
        )
        .bind(
          id,
          name(body.name),
          id,
          active ? 1 : 0,
          integer(body.displayOrder ?? 0, 0, 9999, 'Ordem'),
        ),
    );
  } else if (action === 'service.save' || action === 'service.update') {
    id = textValue(body.serviceId) || id;
    const existing = await db
      .prepare('SELECT * FROM services WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();
    if (action === 'service.update' && !existing)
      throw new ApiError(404, 'Serviço não encontrado.', 'service_not_found');
    const active = body.active === true;
    if (!active) {
      const conflicts = await db
        .prepare(
          `SELECT b.reference FROM bookings b JOIN booking_items bi ON bi.booking_id = b.id WHERE bi.service_id = ? AND b.status IN ('pending','confirmed') AND b.start_at > ?`,
        )
        .bind(id, now)
        .all();
      if (conflicts.results.length)
        throw new ConflictsError(
          'O serviço possui reservas futuras. Resolva-as antes de desativar.',
          'service_has_future_bookings',
          conflicts.results,
        );
    }
    const categoryId = textValue(
      body.categoryId,
      textValue(existing?.category_id),
    );
    if (
      !(await db
        .prepare('SELECT id FROM categories WHERE id = ?')
        .bind(categoryId)
        .first())
    )
      throw new ApiError(400, 'Categoria inválida.', 'invalid_category');
    const requires =
      textValue(
        body.requiresServiceId,
        textValue(existing?.requires_service_id),
      ) || null;
    const combo =
      body.comboServiceIds ??
      JSON.parse(textValue(existing?.combo_service_ids_json, '[]'));
    if (
      !Array.isArray(combo) ||
      combo.length > 5 ||
      !combo.every((item) => typeof item === 'string' && item !== id) ||
      (requires && (requires === id || combo.length))
    )
      throw new ApiError(
        400,
        'Revise as regras do adicional ou combo.',
        'invalid_combination',
      );
    for (const component of [...combo, ...(requires ? [requires] : [])]) {
      const target = await db
        .prepare(
          'SELECT requires_service_id, combo_service_ids_json FROM services WHERE id = ?',
        )
        .bind(component)
        .first<{
          requires_service_id: string | null;
          combo_service_ids_json: string;
        }>();
      if (
        !target ||
        target.requires_service_id ||
        target.combo_service_ids_json !== '[]'
      )
        throw new ApiError(
          400,
          'Adicionais e combos devem referenciar serviços simples.',
          'invalid_combination',
        );
    }
    const source = textValue(body.source, textValue(existing?.source, 'demo'));
    if (!['observed', 'demo', 'validated'].includes(source))
      throw new ApiError(400, 'Origem inválida.', 'invalid_source');
    const photo = await mediaId(body.photoId ?? existing?.photo_id);
    statements.push(
      db
        .prepare(`INSERT INTO services (id, category_id, name, description, price_cents, duration_minutes, active, source, requires_service_id, display_order, created_at, updated_at, photo_id, combo_service_ids_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET category_id=excluded.category_id,name=excluded.name,description=excluded.description,price_cents=excluded.price_cents,duration_minutes=excluded.duration_minutes,active=excluded.active,source=excluded.source,requires_service_id=excluded.requires_service_id,display_order=excluded.display_order,updated_at=excluded.updated_at,photo_id=excluded.photo_id,combo_service_ids_json=excluded.combo_service_ids_json`)
        .bind(
          id,
          categoryId,
          name(body.name ?? existing?.name),
          textValue(body.description, textValue(existing?.description)).slice(
            0,
            1000,
          ),
          integer(body.priceCents, 0, 1000000, 'Preço'),
          integer(body.durationMinutes, 1, 720, 'Duração'),
          active ? 1 : 0,
          source,
          requires,
          integer(
            body.displayOrder ?? existing?.display_order ?? 0,
            0,
            9999,
            'Ordem',
          ),
          now,
          now,
          photo,
          JSON.stringify([...new Set(combo)]),
        ),
    );
  } else if (action === 'professional.save') {
    const active = body.active === true;
    const relations = body.relations;
    if (!Array.isArray(relations) || relations.length > 200)
      throw new ApiError(
        400,
        'Selecione os serviços habilitados.',
        'invalid_relations',
      );
    const ids = relations.map((row: Record<string, unknown>) =>
      textValue(row.serviceId),
    );
    if (new Set(ids).size !== ids.length)
      throw new ApiError(400, 'Serviço duplicado.', 'invalid_relations');
    const upcoming = await futureBookings(id);
    const bookedItems = await db
      .prepare(
        `SELECT b.reference, bi.service_id as serviceId FROM bookings b JOIN booking_items bi ON bi.booking_id=b.id WHERE b.professional_id=? AND b.status IN ('pending','confirmed') AND b.start_at > ?`,
      )
      .bind(id, now)
      .all<{ reference: string; serviceId: string }>();
    const conflicts = !active
      ? upcoming
      : bookedItems.results.filter((row) => !ids.includes(row.serviceId));
    if (conflicts.length)
      throw new ConflictsError(
        'Resolva as reservas afetadas antes de desativar ou remover habilitações.',
        'professional_has_future_bookings',
        conflicts,
      );
    const userId = textValue(body.userId) || null;
    if (
      userId &&
      !(await db
        .prepare('SELECT id FROM users WHERE id = ?')
        .bind(userId)
        .first())
    )
      throw new ApiError(
        400,
        'A conta precisa entrar no portal antes de ser vinculada.',
        'user_not_found',
      );
    statements.push(
      db
        .prepare(
          `INSERT INTO professionals (id, user_id, name, active, photo_key, display_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,name=excluded.name,active=excluded.active,photo_key=excluded.photo_key,display_order=excluded.display_order,updated_at=excluded.updated_at`,
        )
        .bind(
          id,
          userId,
          name(body.name),
          active ? 1 : 0,
          await mediaId(body.photoId),
          integer(body.displayOrder ?? 0, 0, 9999, 'Ordem'),
          now,
          now,
        ),
    );
    statements.push(
      db
        .prepare('DELETE FROM professional_services WHERE professional_id = ?')
        .bind(id),
    );
    for (const relation of relations) {
      if (
        !(await db
          .prepare('SELECT id FROM services WHERE id = ?')
          .bind(textValue(relation.serviceId))
          .first())
      )
        throw new ApiError(400, 'Serviço inexistente.', 'invalid_relations');
      statements.push(
        db
          .prepare(
            'INSERT INTO professional_services (professional_id, service_id, price_cents, duration_minutes) VALUES (?, ?, ?, ?)',
          )
          .bind(
            id,
            relation.serviceId,
            relation.priceCents == null
              ? null
              : integer(relation.priceCents, 0, 1000000, 'Preço específico'),
            relation.durationMinutes == null
              ? null
              : integer(relation.durationMinutes, 1, 720, 'Duração específica'),
          ),
      );
    }
    if (userId)
      statements.push(
        db
          .prepare(
            "UPDATE users SET role='professional', updated_at=? WHERE id=? AND role='customer'",
          )
          .bind(now, userId),
      );
  } else if (action === 'schedule.save' || action === 'unit.save') {
    const rows = schedules(body.schedules);
    const professionalId =
      action === 'schedule.save' ? textValue(body.professionalId) : undefined;
    if (
      action === 'schedule.save' &&
      (!professionalId ||
        !(await db
          .prepare('SELECT id FROM professionals WHERE id=?')
          .bind(professionalId)
          .first()))
    )
      throw new ApiError(
        400,
        'Selecione o profissional.',
        'invalid_professional',
      );
    const conflicts = await scheduleConflicts(rows, professionalId);
    if (conflicts.length)
      throw new ConflictsError(
        'A nova grade conflita com reservas futuras. A grade original foi mantida.',
        'schedule_has_conflicts',
        conflicts,
      );
    if (professionalId) {
      statements.push(
        db
          .prepare('DELETE FROM weekly_schedules WHERE professional_id=?')
          .bind(professionalId),
      );
      for (const row of rows)
        statements.push(
          db
            .prepare(
              'INSERT INTO weekly_schedules (id,professional_id,weekday,start_minute,end_minute,break_start_minute,break_end_minute) VALUES (?,?,?,?,?,?,?)',
            )
            .bind(
              crypto.randomUUID(),
              professionalId,
              row.weekday,
              row.startMinute,
              row.endMinute,
              row.breakStartMinute,
              row.breakEndMinute,
            ),
        );
    } else {
      statements.push(db.prepare('DELETE FROM unit_schedules'));
      for (const row of rows)
        statements.push(
          db
            .prepare(
              'INSERT INTO unit_schedules (weekday,start_minute,end_minute) VALUES (?,?,?)',
            )
            .bind(row.weekday, row.startMinute, row.endMinute),
        );
    }
    id = professionalId || 'unit';
  } else if (action === 'settings.save') {
    const timezone = textValue(body.timezone);
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: timezone }).format();
    } catch {
      throw new ApiError(400, 'Fuso IANA inválido.', 'invalid_timezone');
    }
    const current = await getSettings();
    if (timezone !== current.timezone && (await futureBookings()).length)
      throw new ApiError(
        409,
        'Não altere o fuso com reservas futuras. Resolva a transição primeiro.',
        'timezone_has_bookings',
      );
    statements.push(
      db
        .prepare(
          `UPDATE business_settings SET timezone=?,cancellation_limit_hours=?,minimum_notice_minutes=?,booking_horizon_days=?,slot_step_minutes=?,default_buffer_minutes=?,policy_version=?,updated_at=? WHERE id='main'`,
        )
        .bind(
          timezone,
          integer(body.cancellationLimitHours, 0, 168, 'Prazo'),
          integer(body.minimumNoticeMinutes, 0, 10080, 'Antecedência'),
          integer(body.bookingHorizonDays, 1, 180, 'Horizonte'),
          integer(body.slotStepMinutes, 5, 120, 'Passo'),
          integer(body.defaultBufferMinutes, 0, 120, 'Intervalo'),
          `policy-${now}`,
          now,
        ),
    );
    id = 'main';
  } else if (action === 'block.remove') {
    statements.push(
      db.prepare('DELETE FROM schedule_blocks WHERE id=?').bind(id),
      ...requireChanged(),
    );
  } else if (action === 'content.save') {
    const values = body.values as Record<string, unknown>;
    if (!values || typeof values !== 'object')
      throw new ApiError(400, 'Conteúdo inválido.', 'invalid_content');
    const allowed = [
      'business_address',
      'business_phone',
      'instagram_url',
      'whatsapp_number',
      'about_text',
      'hero_text',
      'slogan',
      'hero_image',
      'logo_image',
      'gallery_images',
      'environment_images',
      'developer_url',
    ];
    for (const [key, raw] of Object.entries(values)) {
      if (
        !allowed.includes(key) ||
        typeof raw !== 'string' ||
        raw.length > 4000
      )
        throw new ApiError(
          400,
          'Campo de conteúdo inválido.',
          'invalid_content',
        );
      if (key.endsWith('_url') && raw && !raw.startsWith('https://'))
        throw new ApiError(400, 'Use links HTTPS completos.', 'invalid_link');
      if (key === 'whatsapp_number' && raw && !/^\d{12,15}$/.test(raw))
        throw new ApiError(
          400,
          'WhatsApp deve conter país, DDD e número, somente dígitos.',
          'invalid_phone',
        );
      if (key.endsWith('_image') && raw) await mediaId(raw);
      if (key.endsWith('_images'))
        for (const item of raw.split(',').filter(Boolean))
          await mediaId(item.trim());
      statements.push(
        db
          .prepare(
            'INSERT INTO content_entries (key,value,updated_by,updated_at) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at',
          )
          .bind(key, raw.trim(), actor, now),
      );
    }
    id = 'public';
  } else return null;
  statements.push(
    audit(actor, action, 'management', id, {
      fields: Object.keys(body).filter((key) => key !== 'action'),
    }),
  );
  await guardedBatch(expected, statements);
  return { ok: true, id };
}
