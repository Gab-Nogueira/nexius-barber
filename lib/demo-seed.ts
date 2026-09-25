import { database, demoModeEnabled, ApiError } from '@/lib/nexius';

const SEEDED_AT = '2026-09-22T00:00:00.000Z';

export async function ensureDemoSeed() {
  const db = database();
  const current = await db.prepare('SELECT id FROM business_settings WHERE id = ?').bind('main').first();
  if (current) return;
  if (!demoModeEnabled()) throw new ApiError(503, 'Configure a unidade e o catálogo validado antes de abrir a agenda.', 'settings_missing');

  const statements: D1PreparedStatement[] = [
    db.prepare(`INSERT OR IGNORE INTO business_settings
      (id, timezone, cancellation_limit_hours, minimum_notice_minutes, booking_horizon_days, slot_step_minutes, default_buffer_minutes, policy_version, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind('main', 'America/Sao_Paulo', 4, 60, 30, 30, 0, 'demo-v1', SEEDED_AT),
    db.prepare('INSERT OR IGNORE INTO categories (id, name, slug, active, display_order) VALUES (?, ?, ?, 1, ?)').bind('cat-cortes', 'Cortes', 'cortes', 1),
    db.prepare('INSERT OR IGNORE INTO categories (id, name, slug, active, display_order) VALUES (?, ?, ?, 1, ?)').bind('cat-infantil', 'Infantil', 'infantil', 2),
    db.prepare('INSERT OR IGNORE INTO categories (id, name, slug, active, display_order) VALUES (?, ?, ?, 1, ?)').bind('cat-demo', 'Demonstração', 'demonstracao', 3),
    db.prepare(`INSERT OR IGNORE INTO professionals
      (id, user_id, name, active, photo_key, display_order, created_at, updated_at)
      VALUES (?, NULL, ?, 1, NULL, ?, ?, ?)`)
      .bind('pro-ismael', 'Ismael', 1, SEEDED_AT, SEEDED_AT),
    db.prepare(`INSERT OR IGNORE INTO professionals
      (id, user_id, name, active, photo_key, display_order, created_at, updated_at)
      VALUES (?, NULL, ?, 1, NULL, ?, ?, ?)`)
      .bind('pro-leonardo', 'Leonardo', 2, SEEDED_AT, SEEDED_AT),
    db.prepare(`INSERT OR IGNORE INTO services
      (id, category_id, name, description, price_cents, duration_minutes, active, source, requires_service_id, display_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, NULL, ?, ?, ?)`)
      .bind('srv-corte', 'cat-cortes', 'Corte', 'Corte masculino. Duração demonstrativa até validação.', 4000, 45, 'observed', 1, SEEDED_AT, SEEDED_AT),
    db.prepare(`INSERT OR IGNORE INTO services
      (id, category_id, name, description, price_cents, duration_minutes, active, source, requires_service_id, display_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, NULL, ?, ?, ?)`)
      .bind('srv-corte-infantil', 'cat-infantil', 'Corte infantil (3 a 8 anos)', 'Atendimento infantil. Duração demonstrativa até validação.', 4000, 40, 'observed', 2, SEEDED_AT, SEEDED_AT),
    db.prepare(`INSERT OR IGNORE INTO services
      (id, category_id, name, description, price_cents, duration_minutes, active, source, requires_service_id, display_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, NULL, ?, ?, ?)`)
      .bind('srv-barba-demo', 'cat-demo', 'Barba — exemplo da demonstração', 'Serviço sintético para testar a agenda; não é oferta oficial.', 3500, 30, 'demo', 3, SEEDED_AT, SEEDED_AT),
    db.prepare(`INSERT OR IGNORE INTO services
      (id, category_id, name, description, price_cents, duration_minutes, active, source, requires_service_id, display_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, NULL, ?, ?, ?)`)
      .bind('srv-acabamento-demo', 'cat-demo', 'Acabamento — exemplo da demonstração', 'Serviço sintético para testar combinações; não é oferta oficial.', 2000, 20, 'demo', 4, SEEDED_AT, SEEDED_AT),
    db.prepare('INSERT OR IGNORE INTO professional_services (professional_id, service_id, price_cents, duration_minutes) VALUES (?, ?, NULL, NULL)').bind('pro-ismael', 'srv-corte'),
    db.prepare('INSERT OR IGNORE INTO professional_services (professional_id, service_id, price_cents, duration_minutes) VALUES (?, ?, NULL, NULL)').bind('pro-ismael', 'srv-corte-infantil'),
    db.prepare('INSERT OR IGNORE INTO professional_services (professional_id, service_id, price_cents, duration_minutes) VALUES (?, ?, NULL, NULL)').bind('pro-ismael', 'srv-barba-demo'),
    db.prepare('INSERT OR IGNORE INTO professional_services (professional_id, service_id, price_cents, duration_minutes) VALUES (?, ?, NULL, NULL)').bind('pro-ismael', 'srv-acabamento-demo'),
    db.prepare('INSERT OR IGNORE INTO professional_services (professional_id, service_id, price_cents, duration_minutes) VALUES (?, ?, NULL, NULL)').bind('pro-leonardo', 'srv-barba-demo'),
    db.prepare('INSERT OR IGNORE INTO professional_services (professional_id, service_id, price_cents, duration_minutes) VALUES (?, ?, NULL, NULL)').bind('pro-leonardo', 'srv-acabamento-demo'),
    db.prepare('INSERT OR IGNORE INTO content_entries (key, value, updated_by, updated_at) VALUES (?, ?, NULL, ?)').bind('business_address', 'Avenida das Rosas, 341, Jardim Motorama, São José dos Campos — SP', SEEDED_AT),
    db.prepare('INSERT OR IGNORE INTO content_entries (key, value, updated_by, updated_at) VALUES (?, ?, NULL, ?)').bind('business_phone', '(12) 98814-9114', SEEDED_AT),
  ];

  for (const professionalId of ['pro-ismael', 'pro-leonardo']) {
    for (let weekday = 1; weekday <= 6; weekday += 1) {
      statements.push(
        db.prepare(`INSERT OR IGNORE INTO weekly_schedules
          (id, professional_id, weekday, start_minute, end_minute, break_start_minute, break_end_minute)
          VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(`sch-${professionalId}-${weekday}`, professionalId, weekday, 540, 1080, 720, 780),
      );
    }
  }
  for (let weekday = 1; weekday <= 6; weekday++) statements.push(db.prepare('INSERT OR IGNORE INTO unit_schedules (weekday, start_minute, end_minute) VALUES (?, 540, 1080)').bind(weekday));
  await db.batch(statements);
}

export const DEMO_ASSUMPTIONS = {
  schedules: 'Segunda a sábado, das 9h às 18h, com pausa das 12h às 13h.',
  durations: 'As durações exibidas são dados sintéticos da demonstração.',
  confirmation: 'Confirmação automática apenas no ambiente demonstrativo.',
};
