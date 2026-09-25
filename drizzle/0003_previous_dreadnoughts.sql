CREATE TABLE `unit_schedules` (
	`weekday` integer PRIMARY KEY NOT NULL,
	`start_minute` integer NOT NULL,
	`end_minute` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO unit_schedules (weekday, start_minute, end_minute) SELECT weekday, MIN(start_minute), MAX(end_minute) FROM weekly_schedules GROUP BY weekday;
--> statement-breakpoint
CREATE TRIGGER unit_schedules_insert_revision AFTER INSERT ON unit_schedules
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER unit_schedules_update_revision AFTER UPDATE ON unit_schedules
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
--> statement-breakpoint
CREATE TRIGGER unit_schedules_delete_revision AFTER DELETE ON unit_schedules
BEGIN UPDATE business_settings SET config_revision = config_revision + 1, operation_revision = operation_revision + 1 WHERE id = 'main'; END;
