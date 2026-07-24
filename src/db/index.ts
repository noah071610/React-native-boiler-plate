import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from '@/db/schema';

export const sqlite = openDatabaseSync('workout.db', {
  // useLiveQuery가 변경을 감지하려면 필수.
  enableChangeListener: true,
});

// SQLite는 기본이 OFF다. 켜지 않으면 onDelete: 'cascade'가 전부 무시되어
// 세션을 지워도 set_log가 남고, 같은 id로 세션이 다시 생기면 세트가 겹쳐 보인다.
sqlite.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
export { schema };
