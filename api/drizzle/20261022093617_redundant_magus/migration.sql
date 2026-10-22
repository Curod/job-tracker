ALTER TABLE "companies" ADD COLUMN "user_id" integer;--> statement-breakpoint
UPDATE "companies" SET "user_id" = (SELECT min("id") FROM "users");--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "companies_user_id_idx" ON "companies" ("user_id");--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;