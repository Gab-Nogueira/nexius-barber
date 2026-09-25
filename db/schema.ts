import { sql } from 'drizzle-orm';
import { check, index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const mutationChecks = sqliteTable('mutation_checks', {
  id: text('id').primaryKey(),
  ok: integer('ok').notNull(),
}, (table) => [check('mutation_revision_current', sql`${table.ok} = 1`)]);

export const businessSettings = sqliteTable('business_settings', {
  id: text('id').primaryKey(),
  timezone: text('timezone').notNull().default('America/Sao_Paulo'),
  cancellationLimitHours: integer('cancellation_limit_hours').notNull().default(4),
  minimumNoticeMinutes: integer('minimum_notice_minutes').notNull().default(60),
  bookingHorizonDays: integer('booking_horizon_days').notNull().default(30),
  slotStepMinutes: integer('slot_step_minutes').notNull().default(30),
  defaultBufferMinutes: integer('default_buffer_minutes').notNull().default(0),
  policyVersion: text('policy_version').notNull().default('demo-v1'),
  configRevision: integer('config_revision').notNull().default(0),
  operationRevision: integer('operation_revision').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  role: text('role', { enum: ['customer', 'professional', 'admin'] }).notNull().default('customer'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [uniqueIndex('ux_users_email').on(table.email), index('idx_users_role').on(table.role)]);

export const professionals = sqliteTable('professionals', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  name: text('name').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  photoKey: text('photo_key'),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [uniqueIndex('ux_professionals_user_id').on(table.userId), index('idx_professionals_active_order').on(table.active, table.displayOrder)]);

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  displayOrder: integer('display_order').notNull().default(0),
}, (table) => [uniqueIndex('ux_categories_slug').on(table.slug)]);

export const services = sqliteTable('services', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').notNull().references(() => categories.id),
  name: text('name').notNull(),
  description: text('description'),
  priceCents: integer('price_cents').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  source: text('source', { enum: ['observed', 'demo', 'validated'] }).notNull().default('demo'),
  requiresServiceId: text('requires_service_id'),
  photoId: text('photo_id'),
  comboServiceIdsJson: text('combo_service_ids_json').notNull().default('[]'),
  displayOrder: integer('display_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_services_category_active').on(table.categoryId, table.active), index('idx_services_name').on(table.name)]);

export const professionalServices = sqliteTable('professional_services', {
  professionalId: text('professional_id').notNull().references(() => professionals.id),
  serviceId: text('service_id').notNull().references(() => services.id),
  priceCents: integer('price_cents'),
  durationMinutes: integer('duration_minutes'),
}, (table) => [primaryKey({ columns: [table.professionalId, table.serviceId] }), index('idx_prof_services_service').on(table.serviceId)]);

export const weeklySchedules = sqliteTable('weekly_schedules', {
  id: text('id').primaryKey(),
  professionalId: text('professional_id').notNull().references(() => professionals.id),
  weekday: integer('weekday').notNull(),
  startMinute: integer('start_minute').notNull(),
  endMinute: integer('end_minute').notNull(),
  breakStartMinute: integer('break_start_minute'),
  breakEndMinute: integer('break_end_minute'),
}, (table) => [index('idx_schedules_prof_weekday').on(table.professionalId, table.weekday)]);

export const unitSchedules = sqliteTable('unit_schedules', {
  weekday: integer('weekday').primaryKey(),
  startMinute: integer('start_minute').notNull(),
  endMinute: integer('end_minute').notNull(),
});

export const scheduleBlocks = sqliteTable('schedule_blocks', {
  id: text('id').primaryKey(),
  professionalId: text('professional_id').references(() => professionals.id),
  startAt: text('start_at').notNull(),
  endAt: text('end_at').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_blocks_prof_interval').on(table.professionalId, table.startAt, table.endAt)]);

export const bookings = sqliteTable('bookings', {
  id: text('id').primaryKey(),
  reference: text('reference').notNull(),
  customerUserId: text('customer_user_id').notNull().references(() => users.id),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone').notNull(),
  professionalId: text('professional_id').notNull().references(() => professionals.id),
  startAt: text('start_at').notNull(),
  endAt: text('end_at').notNull(),
  status: text('status', { enum: ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'] }).notNull().default('confirmed'),
  origin: text('origin', { enum: ['public', 'admin', 'migration'] }).notNull().default('public'),
  idempotencyKey: text('idempotency_key').notNull(),
  requestHash: text('request_hash').notNull(),
  totalCents: integer('total_cents').notNull(),
  timezone: text('timezone').notNull(),
  policyVersion: text('policy_version').notNull(),
  bufferMinutes: integer('buffer_minutes').notNull().default(0),
  cancellationLimitHours: integer('cancellation_limit_hours').notNull().default(4),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  uniqueIndex('ux_bookings_reference').on(table.reference),
  uniqueIndex('ux_bookings_idempotency').on(table.idempotencyKey),
  index('idx_bookings_prof_interval').on(table.professionalId, table.startAt, table.endAt),
  index('idx_bookings_customer_start').on(table.customerUserId, table.startAt),
  index('idx_bookings_status_start').on(table.status, table.startAt),
]);

export const bookingItems = sqliteTable('booking_items', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  serviceId: text('service_id').notNull().references(() => services.id),
  nameSnapshot: text('name_snapshot').notNull(),
  priceCentsSnapshot: integer('price_cents_snapshot').notNull(),
  durationMinutesSnapshot: integer('duration_minutes_snapshot').notNull(),
}, (table) => [index('idx_booking_items_booking').on(table.bookingId)]);

export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey(),
  actorUserId: text('actor_user_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  detailJson: text('detail_json').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_audit_entity').on(table.entityType, table.entityId), index('idx_audit_created').on(table.createdAt)]);

export const contentEntries = sqliteTable('content_entries', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedBy: text('updated_by').references(() => users.id),
  updatedAt: text('updated_at').notNull(),
});

export const mediaFiles = sqliteTable('media_files', {
  id: text('id').primaryKey(),
  objectKey: text('object_key').notNull(),
  originalName: text('original_name').notNull(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  altText: text('alt_text').notNull(),
  uploadedBy: text('uploaded_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
}, (table) => [uniqueIndex('ux_media_object_key').on(table.objectKey)]);

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  bookingId: text('booking_id').notNull().references(() => bookings.id),
  channel: text('channel').notNull(),
  status: text('status', { enum: ['queued', 'sent', 'failed', 'test_logged'] }).notNull().default('test_logged'),
  detail: text('detail'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_notifications_booking').on(table.bookingId)]);

export const credentials = sqliteTable('credentials', {
  userId: text('user_id').primaryKey().references(() => users.id),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [uniqueIndex('ux_credentials_username').on(table.username)]);

export const sessions = sqliteTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  kind: text('kind').notNull(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [index('idx_sessions_expiry').on(table.expiresAt), index('idx_sessions_user').on(table.userId)]);

export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: integer('reset_at').notNull(),
}, (table) => [index('idx_rate_limits_reset').on(table.resetAt)]);
