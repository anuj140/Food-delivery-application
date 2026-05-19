ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'admin';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'assigned';--> statement-breakpoint
CREATE TYPE "public"."delivery_partner_vehicle_type" AS ENUM('bike', 'scooter', 'car');--> statement-breakpoint
CREATE TYPE "public"."delivery_assignment_status" AS ENUM('assigned', 'arrived_at_restaurant', 'picked_up', 'arrived_at_customer', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."tip_status" AS ENUM('pending', 'completed');--> statement-breakpoint
CREATE TABLE "delivery_partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"vehicle_type" "delivery_partner_vehicle_type" NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"current_lat" numeric(10, 8),
	"current_lng" numeric(11, 8),
	"last_location_update" timestamp,
	"rating" numeric(2, 1) DEFAULT '5.0' NOT NULL,
	"total_deliveries" numeric(10, 0) DEFAULT 0 NOT NULL,
	"documents" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "delivery_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"sequence" numeric(2, 0) DEFAULT 1 NOT NULL,
	"status" "delivery_assignment_status" DEFAULT 'assigned' NOT NULL,
	"otp_code" varchar(6),
	"otp_verified_at" timestamp,
	"proof_photo_url" text,
	"partner_earnings" numeric(10, 2) DEFAULT '0' NOT NULL,
	"picked_up_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "location_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_id" uuid NOT NULL,
	"lat" numeric(10, 8) NOT NULL,
	"lng" numeric(11, 8) NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "tips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"status" "tip_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"food_rating" numeric(1, 0) NOT NULL,
	"delivery_rating" numeric(1, 0) NOT NULL,
	"review_text" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "delivery_partners" ADD CONSTRAINT "delivery_partners_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_partner_id_delivery_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_history" ADD CONSTRAINT "location_history_assignment_id_delivery_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."delivery_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_partner_id_delivery_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "delivery_partners_user_id_idx" ON "delivery_partners" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "delivery_partners_geo_idx" ON "delivery_partners" USING btree ("current_lat", "current_lng");--> statement-breakpoint
CREATE INDEX "delivery_assignments_order_id_idx" ON "delivery_assignments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "delivery_assignments_partner_id_idx" ON "delivery_assignments" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "delivery_assignments_status_idx" ON "delivery_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "location_history_assignment_id_idx" ON "location_history" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "tips_order_id_idx" ON "tips" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "tips_partner_id_idx" ON "tips" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "ratings_order_id_idx" ON "ratings" USING btree ("order_id");--> statement-breakpoint
