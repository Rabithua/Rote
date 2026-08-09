UPDATE "settings"
SET
  "config" = jsonb_set("config", '{jwtAccessExpiry}', to_jsonb('7d'::text), true),
  "updatedAt" = NOW()
WHERE
  "group" = 'security'
  AND COALESCE("config" ->> 'jwtAccessExpiry', '15m') = '15m';
--> statement-breakpoint
UPDATE "settings"
SET
  "config" = jsonb_set("config", '{jwtRefreshExpiry}', to_jsonb('30d'::text), true),
  "updatedAt" = NOW()
WHERE
  "group" = 'security'
  AND COALESCE("config" ->> 'jwtRefreshExpiry', '7d') = '7d';
