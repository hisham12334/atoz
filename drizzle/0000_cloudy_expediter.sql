CREATE TABLE `members` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `parties` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`image_key` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rental_items` (
	`id` text PRIMARY KEY NOT NULL,
	`rental_id` text NOT NULL,
	`variant_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`usable_returned` integer DEFAULT 0 NOT NULL,
	`damaged_returned` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`rental_id`) REFERENCES `rentals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rental_items_rental_idx` ON `rental_items` (`rental_id`);--> statement-breakpoint
CREATE INDEX `rental_items_variant_idx` ON `rental_items` (`variant_id`);--> statement-breakpoint
CREATE TABLE `rentals` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_no` text NOT NULL,
	`party_id` text NOT NULL,
	`start_date` text NOT NULL,
	`due_date` text NOT NULL,
	`days` integer NOT NULL,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rentals_invoice_no_unique` ON `rentals` (`invoice_no`);--> statement-breakpoint
CREATE INDEX `rentals_dates_idx` ON `rentals` (`start_date`,`due_date`);--> statement-breakpoint
CREATE TABLE `return_events` (
	`id` text PRIMARY KEY NOT NULL,
	`rental_item_id` text NOT NULL,
	`usable` integer NOT NULL,
	`damaged` integer NOT NULL,
	`note` text,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`rental_item_id`) REFERENCES `rental_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`kind` text NOT NULL,
	`delta_total` integer NOT NULL,
	`delta_damaged` integer NOT NULL,
	`note` text,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`label` text NOT NULL,
	`color` text,
	`price_cents` integer NOT NULL,
	`total_stock` integer NOT NULL,
	`damaged_stock` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `variants_product_idx` ON `variants` (`product_id`);--> statement-breakpoint
CREATE TRIGGER `booking_capacity` BEFORE INSERT ON `rental_items` BEGIN
  SELECT RAISE(ABORT, 'Insufficient stock for selected dates')
  WHERE NEW.quantity <= 0 OR EXISTS (
    WITH RECURSIVE dates(day) AS (
      SELECT (SELECT start_date FROM rentals WHERE id = NEW.rental_id)
      UNION ALL
      SELECT date(day, '+1 day') FROM dates
      WHERE day < date((SELECT due_date FROM rentals WHERE id = NEW.rental_id), '-1 day')
    )
    SELECT 1 FROM dates WHERE NEW.quantity + COALESCE((
      SELECT SUM(i.quantity - i.usable_returned - i.damaged_returned)
      FROM rental_items i JOIN rentals r ON r.id = i.rental_id
      WHERE i.variant_id = NEW.variant_id
        AND r.start_date <= dates.day
        AND (dates.day < r.due_date OR (r.due_date <= date('now', '+5 hours', '+30 minutes') AND i.quantity > i.usable_returned + i.damaged_returned))
    ), 0) > (SELECT total_stock - damaged_stock FROM variants WHERE id = NEW.variant_id)
  );
END;--> statement-breakpoint
CREATE TRIGGER `return_quantity_guard` BEFORE UPDATE OF usable_returned, damaged_returned ON `rental_items` BEGIN
  SELECT RAISE(ABORT, 'Return exceeds outstanding quantity')
  WHERE NEW.usable_returned < OLD.usable_returned OR NEW.damaged_returned < OLD.damaged_returned
     OR NEW.usable_returned + NEW.damaged_returned > NEW.quantity;
END;
