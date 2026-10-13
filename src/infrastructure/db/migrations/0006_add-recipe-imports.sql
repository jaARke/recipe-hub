CREATE TABLE "recipe_imports" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"member_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"source_url" text,
	"ai_model" text,
	"cost_usd" numeric,
	"failure" text,
	"draft" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "recipe_imports_mode_check" CHECK ("recipe_imports"."mode" in ('url', 'photo')),
	CONSTRAINT "recipe_imports_status_check" CHECK ("recipe_imports"."status" in ('running', 'succeeded', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "import_id" uuid;--> statement-breakpoint
ALTER TABLE "recipe_imports" ADD CONSTRAINT "recipe_imports_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recipe_imports_member_id_created_at_idx" ON "recipe_imports" USING btree ("member_id","created_at");--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_import_id_recipe_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."recipe_imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_import_id_unique" UNIQUE("import_id");