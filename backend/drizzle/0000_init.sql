CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`user_id` text NOT NULL,
	`room_id` text NOT NULL,
	`check_in` integer NOT NULL,
	`check_out` integer NOT NULL,
	`guests` integer NOT NULL,
	`nights` integer NOT NULL,
	`total_amount` numeric NOT NULL,
	`tax_amount` numeric DEFAULT '0' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`special_requests` text,
	`cancellation_fee` numeric DEFAULT '0' NOT NULL,
	`cancelled_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_reference_key` ON `bookings` (`reference`);--> statement-breakpoint
CREATE INDEX `bookings_room_stay_idx` ON `bookings` (`room_id`,`check_in`,`check_out`);--> statement-breakpoint
CREATE INDEX `bookings_check_in_idx` ON `bookings` (`check_in`);--> statement-breakpoint
CREATE INDEX `bookings_check_out_idx` ON `bookings` (`check_out`);--> statement-breakpoint
CREATE INDEX `bookings_status_idx` ON `bookings` (`status`);--> statement-breakpoint
CREATE INDEX `bookings_user_created_idx` ON `bookings` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `hotels` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text NOT NULL,
	`address_line` text NOT NULL,
	`city` text NOT NULL,
	`country` text NOT NULL,
	`star_rating` integer DEFAULT 3 NOT NULL,
	`amenities` text DEFAULT '[]' NOT NULL,
	`check_in_time` text DEFAULT '15:00' NOT NULL,
	`check_out_time` text DEFAULT '11:00' NOT NULL,
	`image_url` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hotels_slug_key` ON `hotels` (`slug`);--> statement-breakpoint
CREATE INDEX `hotels_city_idx` ON `hotels` (`city`);--> statement-breakpoint
CREATE INDEX `hotels_country_city_idx` ON `hotels` (`country`,`city`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`amount` numeric NOT NULL,
	`method` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`transaction_ref` text NOT NULL,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_booking_id_key` ON `payments` (`booking_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payments_transaction_ref_key` ON `payments` (`transaction_ref`);--> statement-breakpoint
CREATE INDEX `payments_status_idx` ON `payments` (`status`);--> statement-breakpoint
CREATE TABLE `rate_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`room_type_id` text NOT NULL,
	`name` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`price_multiplier` real DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`room_type_id`) REFERENCES `room_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rate_plans_room_type_window_idx` ON `rate_plans` (`room_type_id`,`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `rate_plans_start_date_idx` ON `rate_plans` (`start_date`);--> statement-breakpoint
CREATE INDEX `rate_plans_end_date_idx` ON `rate_plans` (`end_date`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`hotel_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rating` integer NOT NULL,
	`title` text NOT NULL,
	`comment` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_booking_id_key` ON `reviews` (`booking_id`);--> statement-breakpoint
CREATE INDEX `reviews_hotel_created_idx` ON `reviews` (`hotel_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `reviews_user_id_idx` ON `reviews` (`user_id`);--> statement-breakpoint
CREATE TABLE `room_types` (
	`id` text PRIMARY KEY NOT NULL,
	`hotel_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`base_price_per_night` numeric NOT NULL,
	`max_occupancy` integer NOT NULL,
	`bed_configuration` text NOT NULL,
	`size_sqm` integer NOT NULL,
	`amenities` text DEFAULT '[]' NOT NULL,
	`image_url` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_types_hotel_id_name_key` ON `room_types` (`hotel_id`,`name`);--> statement-breakpoint
CREATE INDEX `room_types_hotel_id_idx` ON `room_types` (`hotel_id`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`hotel_id` text NOT NULL,
	`room_type_id` text NOT NULL,
	`room_number` text NOT NULL,
	`floor` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'AVAILABLE' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`hotel_id`) REFERENCES `hotels`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`room_type_id`) REFERENCES `room_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rooms_hotel_id_room_number_key` ON `rooms` (`hotel_id`,`room_number`);--> statement-breakpoint
CREATE INDEX `rooms_room_type_id_idx` ON `rooms` (`room_type_id`);--> statement-breakpoint
CREATE INDEX `rooms_status_idx` ON `rooms` (`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`full_name` text NOT NULL,
	`phone` text,
	`role` text DEFAULT 'GUEST' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_key` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);