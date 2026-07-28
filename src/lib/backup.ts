import { File, Paths } from 'expo-file-system';

import { db } from '@/db';
import { categories, expenses, participants, trips } from '@/db/schema';
import { localDateKey } from '@/hooks/use-active-trip';

/**
 * 백업 — 계정이 없는 앱이므로 이것이 유일한 안전장치다 (설정 문서 §데이터).
 *
 * rate_history는 담지 않는다. 서버에서 다시 받으면 되는 캐시다 (스키마 주석의 동기화 규칙과 같다).
 * 사진(photoUri)은 기기 로컬 경로라 다른 기기에서 못 읽지만, 같은 기기 복원에서는 살아나므로 그대로 담는다.
 */
export const BACKUP_VERSION = 1;

export type BackupPayload = {
  version: number;
  exportedAt: number;
  trips: (typeof trips.$inferSelect)[];
  participants: (typeof participants.$inferSelect)[];
  categories: (typeof categories.$inferSelect)[];
  expenses: (typeof expenses.$inferSelect)[];
};

export type BackupFile = { uri: string; name: string; expenseCount: number };

/**
 * 모든 여행과 지출을 파일 하나로 내보낸다.
 * tombstone(deletedAt)까지 그대로 담는다 — 지우면 복원 후 동기화에서 되살아난다.
 */
export async function exportBackup(): Promise<BackupFile> {
  const [tripRows, participantRows, categoryRows, expenseRows] = await Promise.all([
    db.select().from(trips),
    db.select().from(participants),
    db.select().from(categories),
    db.select().from(expenses),
  ]);

  const payload: BackupPayload = {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    trips: tripRows,
    participants: participantRows,
    categories: categoryRows,
    expenses: expenseRows,
  };

  const name = `tabica-backup-${localDateKey(Date.now())}.json`;
  const file = new File(Paths.document, name);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload));

  return { uri: file.uri, name, expenseCount: expenseRows.length };
}
