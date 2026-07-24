import { sql } from 'drizzle-orm';
import { integer, text } from 'drizzle-orm/sqlite-core';

/**
 * 온디바이스 SQLite 스키마 (expo-sqlite + Drizzle)
 *
 * 설계 원칙
 * 1. userId 컬럼 없음 — 기기당 1인, 백업은 전체 스냅샷 blob 방식이므로 행 단위 소유권 불필요
 * 2. exercise / equipment 마스터는 DB 테이블이 아니라 TS 상수 (exercises.ts) — 정적 데이터
 * 3. id는 UUID text — 나중에 서버 동기화 붙여도 충돌 없음
 * 4. e1rm은 setLog에 비정규화 저장 — 그래프/기준선 쿼리를 단순하게
 */

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
};

const randomId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const uuid = () => text('id').primaryKey().$defaultFn(randomId);
