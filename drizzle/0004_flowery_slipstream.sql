CREATE TYPE "public"."compliance_type" AS ENUM('selfie', 'thermal_bag', 'helmet');--> statement-breakpoint
CREATE TYPE "public"."dispute_raised_by" AS ENUM('customer', 'partner');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'resolved_customer_wins', 'resolved_partner_wins');--> statement-breakpoint
CREATE TABLE "combos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"combo_price" numeric(10, 2) NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"raised_by" "dispute_raised_by" NOT NULL,
	"reason" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"admin_notes" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"balance" numeric(10, 0) DEFAULT '0' NOT NULL,
	"total_earned" numeric(10, 0) DEFAULT '0' NOT NULL,
	"total_redeemed" numeric(10, 0) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"order_id" uuid,
	"points" numeric(10, 0) NOT NULL,
	"reason" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_compliance_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"type" "compliance_type" NOT NULL,
	"photo_url" text NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_coupons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"discount_type" "coupon_discount_type" NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"min_order_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"max_discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"valid_to" timestamp NOT NULL,
	"time_slots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"usage_limit" numeric(10, 0) DEFAULT '0' NOT NULL,
	"used_count" numeric(10, 0) DEFAULT '0' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "restaurant_coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "restaurant_id" uuid;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "photos" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "restaurant_reply" text;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "replied_at" timestamp;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "is_flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ratings" ADD COLUMN "flag_reason" text;--> statement-breakpoint
ALTER TABLE "combos" ADD CONSTRAINT "combos_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_compliance_logs" ADD CONSTRAINT "partner_compliance_logs_partner_id_delivery_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."delivery_partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restaurant_coupons" ADD CONSTRAINT "restaurant_coupons_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "combos_restaurant_id_idx" ON "combos" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "disputes_order_id_idx" ON "disputes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_points_customer_id_idx" ON "loyalty_points" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "loyalty_transactions_customer_id_idx" ON "loyalty_transactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "partner_compliance_logs_partner_id_idx" ON "partner_compliance_logs" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "partner_compliance_logs_type_idx" ON "partner_compliance_logs" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_coupons_code_idx" ON "restaurant_coupons" USING btree ("code");--> statement-breakpoint
CREATE INDEX "restaurant_coupons_restaurant_id_idx" ON "restaurant_coupons" USING btree ("restaurant_id");--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ratings_restaurant_id_idx" ON "ratings" USING btree ("restaurant_id");--> statement-breakpoint
CREATE INDEX "ratings_customer_id_idx" ON "ratings" USING btree ("customer_id");