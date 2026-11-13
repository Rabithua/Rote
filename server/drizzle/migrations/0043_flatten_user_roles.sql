-- Flatten the role hierarchy to user + super_admin. The moderator and admin
-- roles were removed from the product (single super admin deployment model);
-- any legacy accounts holding them are downgraded to regular users so they
-- keep their login and data while losing elevated access.
UPDATE "users" SET "role" = 'user' WHERE "role" IN ('admin', 'moderator');--> statement-breakpoint
-- Drop capability policies for the removed roles (dead rows after the enum shrink).
DELETE FROM "role_permission_policies" WHERE "role" IN ('admin', 'moderator');--> statement-breakpoint
-- Normalize the registration default role so a stale 'admin'/'moderator' value
-- in the saved ui config cannot resurrect the removed roles on new signups.
UPDATE "settings" SET "config" = jsonb_set("config", '{defaultUserRole}', '"user"'::jsonb)
WHERE "group" = 'ui' AND "config"->>'defaultUserRole' IN ('admin', 'moderator');
