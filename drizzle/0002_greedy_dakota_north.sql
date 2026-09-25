CREATE TABLE `mutation_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`ok` integer NOT NULL,
	CONSTRAINT "mutation_revision_current" CHECK("mutation_checks"."ok" = 1)
);

--> statement-breakpoint
CREATE TRIGGER services_insert_revision AFTER INSERT ON services
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER services_update_revision AFTER UPDATE ON services
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER services_delete_revision AFTER DELETE ON services
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER categories_insert_revision AFTER INSERT ON categories
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER categories_update_revision AFTER UPDATE ON categories
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER categories_delete_revision AFTER DELETE ON categories
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER professional_services_insert_revision AFTER INSERT ON professional_services
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER professional_services_update_revision AFTER UPDATE ON professional_services
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER professional_services_delete_revision AFTER DELETE ON professional_services
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER professionals_insert_revision AFTER INSERT ON professionals
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER professionals_update_revision AFTER UPDATE ON professionals
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER professionals_delete_revision AFTER DELETE ON professionals
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER weekly_schedules_insert_revision AFTER INSERT ON weekly_schedules
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER weekly_schedules_update_revision AFTER UPDATE ON weekly_schedules
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER weekly_schedules_delete_revision AFTER DELETE ON weekly_schedules
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER schedule_blocks_insert_revision AFTER INSERT ON schedule_blocks
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER schedule_blocks_update_revision AFTER UPDATE ON schedule_blocks
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER schedule_blocks_delete_revision AFTER DELETE ON schedule_blocks
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER bookings_insert_revision AFTER INSERT ON bookings
BEGIN UPDATE business_settings SET operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER bookings_update_revision AFTER UPDATE ON bookings
BEGIN UPDATE business_settings SET operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER bookings_delete_revision AFTER DELETE ON bookings
BEGIN UPDATE business_settings SET operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER settings_revision AFTER UPDATE OF timezone, cancellation_limit_hours, minimum_notice_minutes, booking_horizon_days, slot_step_minutes, default_buffer_minutes, policy_version ON business_settings
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
