import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo', // ← 이거 빠지면 마이그레이션이 Expo용으로 안 나옴
});
