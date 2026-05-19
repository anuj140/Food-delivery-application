DO $$ BEGIN
 CREATE TYPE "user_role" AS ENUM('customer', 'restaurant', 'partner');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"category" varchar(100) NOT NULL,
	"image_url" text,
	"is_veg" boolean DEFAULT true NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restaurants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text NOT NULL,
	"lat" numeric(10, 8) NOT NULL,
	"lng" numeric(11, 8) NOT NULL,
	"cuisine_type" text[] DEFAULT  NOT NULL,
	"is_open" boolean DEFAULT true NOT NULL,
	"avg_rating" numeric(3, 1) DEFAULT '0' NOT NULL,
	"commission_rate" numeric(5, 2) DEFAULT '18.00' NOT NULL,
	"bank_account_details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"hashed_password" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_items_restaurant_id_idx" ON "menu_items" ("restaurant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_items_category_idx" ON "menu_items" ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "menu_items_availability_idx" ON "menu_items" ("is_available");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurants_user_id_idx" ON "restaurants" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurants_name_idx" ON "restaurants" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restaurants_geo_idx" ON "restaurants" ("lat","lng");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users" ("role");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "restaurants" ADD CONSTRAINT "restaurants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
