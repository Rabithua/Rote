import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./drizzle/schema.ts', './drizzle/oauthMcpSchema.ts', './drizzle/accountMergeSchema.ts'],
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.POSTGRESQL_URL || '',
  },
});
