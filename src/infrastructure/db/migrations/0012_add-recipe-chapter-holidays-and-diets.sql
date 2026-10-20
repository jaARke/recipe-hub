ALTER TABLE "recipes" ADD COLUMN "chapter" text DEFAULT 'this-and-that' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "holidays" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "diets" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
CREATE INDEX "recipes_chapter_idx" ON "recipes" USING btree ("chapter");--> statement-breakpoint
CREATE INDEX "recipes_holidays_idx" ON "recipes" USING gin ("holidays");--> statement-breakpoint
CREATE INDEX "recipes_diets_idx" ON "recipes" USING gin ("diets");--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_chapter_check" CHECK ("recipes"."chapter" in ('breakfast-brunch', 'appetizers-beverages', 'soups-salads', 'vegetables-sides', 'main-dishes', 'breads-rolls', 'desserts', 'cookies-candy', 'this-and-that'));--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_holidays_check" CHECK ("recipes"."holidays" <@ array['new-years-day', 'st-patricks-day', 'easter', 'fourth-of-july', 'halloween', 'thanksgiving', 'christmas']);--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_diets_check" CHECK ("recipes"."diets" <@ array['vegetarian', 'vegan', 'gluten-free', 'dairy-free']);