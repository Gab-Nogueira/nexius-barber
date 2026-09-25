ALTER TABLE `bookings` ADD `buffer_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `cancellation_limit_hours` integer DEFAULT 4 NOT NULL;--> statement-breakpoint
ALTER TABLE `business_settings` ADD `config_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `business_settings` ADD `operation_revision` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `services` ADD `photo_id` text;--> statement-breakpoint
ALTER TABLE `services` ADD `combo_service_ids_json` text DEFAULT '[]' NOT NULL;