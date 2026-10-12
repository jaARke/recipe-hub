ALTER TABLE "invites" DROP CONSTRAINT "invites_request_id_access_requests_id_fk";
--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_request_id_access_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."access_requests"("id") ON DELETE set null ON UPDATE no action;