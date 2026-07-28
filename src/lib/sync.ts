import { and, eq, isNull, max, ne } from 'drizzle-orm';

import { db } from '@/db';
import {
  categories,
  expenses,
  participants,
  trips,
  type Category,
  type Expense,
  type Participant,
  type Trip,
} from '@/db/schema';
import {
  createRoom,
  deleteRoom,
  fetchBundles,
  joinRoom,
  putBundle,
  removeParticipant,
  type SyncRoom,
} from '@/services/api/sync';
import { seedDefaultCategories } from '@/lib/seed-categories';
import { incomingWins, looksDuplicate } from '@/lib/sync-rules';
import { newId } from '@/lib/utils';
import { useAppStore } from '@/store/app';

/**
 * 동기화 — 각자 오프라인으로 기록한 것을 나중에 합친다 (layout-sync).
 *
 * 합치기는 전부 여기, 기기에서 일어난다. 서버는 어느 쪽이 옳은지 판단하지 않는다.
 * 이 파일의 규칙을 어기면 전체가 무너진다:
 *
 *   1) 소유권 — 각 지출은 기록한 사람의 것이다. 상대 것은 절대 덮어쓰지 않고,
 *      내 것이라고 주장하는 들어온 행도 절대 받지 않는다. 이 규칙 하나로 편집 충돌이 사라진다.
 *   2) tombstone — 삭제는 deletedAt으로만 한다. 물리 삭제하면 상대의 다음 묶음에서 되살아난다.
 *   3) 실패해도 로컬 기록은 손상되지 않는다. 병합은 더하기만 하며 몇 번을 돌려도 결과가 같다.
 */

export const BUNDLE_VERSION = 2;

/** 기기 로컬 값은 묶음에 담지 않는다 (isMe는 기기마다 다르고, 사진은 용량이다). */
export type WireParticipant = Omit<Participant, 'isMe'>;
export type WireExpense = Omit<Expense, 'photoUri'>;

export type SyncBundle = {
  version: number;
  /** 초대 코드가 걸린 여행. 어느 방의 묶음인지 서버가 확인하는 값이다. */
  tripId: string;
  /** 이 묶음을 만든 사람. 서버가 "상대 묶음만" 골라주는 기준이다. */
  participantId: string;
  createdAt: number;
  /**
   * 내 여행 **전부**. 초대 코드가 걸린 여행 하나만 담으면 따라오는 쪽 화면이 반쪽이 된다 —
   * 지난 여행도 다음 여행도 보이지 않고 타임라인이 비어 있다. 여행은 몇 건 수준이라 통째로 보낸다.
   */
  trips: Trip[];
  participants: WireParticipant[];
  categories: Category[];
  /** 내가 기록한 지출 전부(모든 여행). 상대 것은 담지 않는다 — 소유권 규칙. */
  expenses: WireExpense[];
};

export type SyncResult = { sent: number; received: number };

/** 유사 항목 후보 한 쌍. 먼저 기록된 쪽이 keep이다. */
export type DuplicatePair = { keep: Expense; drop: Expense };

/* ------------------------------------------------------------
 * 묶음 만들기
 * ------------------------------------------------------------ */

/**
 * 내 기록 묶음 — 이 기기의 여행 전부 + 내가 기록한 지출 전부.
 *
 * 지출은 **내가 기록한 것만** 담는다. 상대 것까지 되돌려 보내면 두 기기가 서로의
 * 옛 데이터를 되먹여 tombstone이 뒤집힌다.
 * tombstone 행은 그대로 담는다 — 이것이 삭제가 상대에게 전달되는 유일한 경로다.
 */
export async function buildBundle(tripId: string, myParticipantId: string): Promise<SyncBundle> {
  const [tripRows, participantRows, categoryRows, expenseRows] = await Promise.all([
    db.select().from(trips),
    db.select().from(participants),
    db.select().from(categories).where(eq(categories.isCustom, true)),
    db.select().from(expenses).where(eq(expenses.authorId, myParticipantId)),
  ]);

  return {
    version: BUNDLE_VERSION,
    tripId,
    participantId: myParticipantId,
    createdAt: Date.now(),
    trips: tripRows,
    participants: participantRows.map(({ isMe: _isMe, ...rest }) => rest),
    categories: categoryRows,
    expenses: expenseRows.map(({ photoUri: _photoUri, ...rest }) => rest),
  };
}

/**
 * 로컬 데이터의 "버전" = 동기화 대상 테이블 전체의 max(updatedAt).
 *
 * 이 값이 마지막 업로드 때보다 크면 우편함에 올려둔 묶음이 오래된 것이다.
 * ponytail: 해시나 변경 로그를 만들지 않는다. 모든 동기화 대상 테이블이 updatedAt을
 * 들고 있고(스키마 공통 규칙 5), 삭제도 updatedAt을 올리므로 이 하나로 충분하다.
 */
export async function localVersion(): Promise<number> {
  const [t, p, e, c] = await Promise.all([
    db.select({ v: max(trips.updatedAt) }).from(trips),
    db.select({ v: max(participants.updatedAt) }).from(participants),
    db.select({ v: max(expenses.updatedAt) }).from(expenses),
    db.select({ v: max(categories.updatedAt) }).from(categories),
  ]);
  return Math.max(0, t[0]?.v ?? 0, p[0]?.v ?? 0, e[0]?.v ?? 0, c[0]?.v ?? 0);
}

/**
 * 내 묶음을 우편함에 올려둔다. 로컬은 건드리지 않는다 — 실패해도 잃을 것이 없다.
 * 올린 시점의 로컬 버전을 남겨야 다음에 "올릴 게 있는지"를 판단할 수 있다.
 */
export async function uploadMyBundle(
  code: string,
  tripId: string,
  myParticipantId: string,
): Promise<void> {
  const version = await localVersion();
  await putBundle(code, await buildBundle(tripId, myParticipantId));
  useAppStore.getState().markUploaded(version);
}

/**
 * 서버에서 방이 사라졌다 (만료 / 삭제). 로컬 코드를 지워 이 여행을 혼자 쓰는 상태로 되돌린다.
 * 이것이 자동 업로드가 영원히 도는 것을 막는 유일한 정지 조건이다.
 */
export async function dropShareCode(tripId: string): Promise<void> {
  await db
    .update(trips)
    .set({ shareCode: null, updatedAt: Date.now() })
    .where(eq(trips.id, tripId));
}

/* ------------------------------------------------------------
 * 합치기
 * ------------------------------------------------------------ */

/**
 * 상대 묶음 하나를 로컬에 합친다. 새로 들어온 지출 건수를 돌려준다.
 * 몇 번을 다시 돌려도 결과가 같다 — 업로드가 실패해 재시도해도 안전하다.
 */
export async function mergeBundle(bundle: SyncBundle, myParticipantId: string): Promise<number> {
  /*
   * 기본 카테고리부터 깔아둔다. 묶음에는 커스텀만 담기므로, 빠른 기록 화면을 한 번도
   * 열지 않은 기기(= 참가 직후)에는 'food' 같은 행이 아예 없다. 그 상태로 지출을 넣으면
   * FK 위반으로 **묶음 전체가 실패**한다 — 여행만 오고 가계부가 통째로 비던 원인이다.
   */
  await seedDefaultCategories();

  /* 여행 — LWW. 예산·기간 변경은 드물어서 이걸로 충분하다. */
  for (const trip of bundle.trips) {
    const localTrip = (await db.select().from(trips).where(eq(trips.id, trip.id)))[0];
    if (!localTrip) {
      await db.insert(trips).values(trip);
    } else if (incomingWins(localTrip, trip)) {
      const { id: _id, ...rest } = trip;
      await db.update(trips).set(rest).where(eq(trips.id, trip.id));
    }
  }

  /* 참가자 — isMe는 기기 로컬 값이다. 들어온 행은 항상 false로 굳힌다. */
  for (const person of bundle.participants) {
    if (person.id === myParticipantId) continue;
    const local = (await db.select().from(participants).where(eq(participants.id, person.id)))[0];
    if (!local) {
      await db.insert(participants).values({ ...person, isMe: false });
    } else if (incomingWins(local, person)) {
      const { id: _id, ...rest } = person;
      await db
        .update(participants)
        .set({ ...rest, isMe: false })
        .where(eq(participants.id, person.id));
    }
  }

  /* 커스텀 카테고리 — 상대 기기에서도 지출이 제대로 렌더되어야 한다. */
  for (const category of bundle.categories) {
    const local = (await db.select().from(categories).where(eq(categories.id, category.id)))[0];
    if (!local) {
      await db.insert(categories).values(category);
    } else if (incomingWins(local, category)) {
      const { id: _id, ...rest } = category;
      await db.update(categories).set(rest).where(eq(categories.id, category.id));
    }
  }

  /* 지출 — id 기준 union. 소유권 규칙이 여기서 충돌을 원천 차단한다. */

  // FK가 켜져 있어서(db/index.ts) 참조가 하나만 비어도 그 insert가 던진다.
  // 한 건 때문에 나머지 기록까지 잃지 않도록, 넣기 전에 참조를 확인한다.
  const [localCategories, localParticipants, localTrips] = await Promise.all([
    db.select({ id: categories.id }).from(categories),
    db.select({ id: participants.id }).from(participants),
    db.select({ id: trips.id }).from(trips),
  ]);
  const categoryIds = new Set(localCategories.map((c) => c.id));
  const participantIds = new Set(localParticipants.map((p) => p.id));
  const tripIds = new Set(localTrips.map((t) => t.id));

  let received = 0;
  for (const row of bundle.expenses) {
    // 내 것이라고 주장하는 행은 받지 않는다. 내 기기가 내 지출의 유일한 원본이다.
    if (row.authorId === myParticipantId) continue;
    // 기록자나 여행을 모르면 화면에 그릴 수도, 정산에 넣을 수도 없다 — 건너뛴다
    if (!participantIds.has(row.authorId) || !tripIds.has(row.tripId)) continue;

    // 모르는 카테고리는 '기타'로 떨어뜨린다. 카테고리 하나 때문에 금액을 잃지 않는다.
    const expense = {
      ...row,
      categoryId: row.categoryId && categoryIds.has(row.categoryId) ? row.categoryId : null,
      usedBy: row.usedBy && participantIds.has(row.usedBy) ? row.usedBy : null,
    };

    const local = (await db.select().from(expenses).where(eq(expenses.id, expense.id)))[0];
    if (!local) {
      await db.insert(expenses).values(expense);
      if (!expense.deletedAt) received += 1;
      continue;
    }
    // 로컬 tombstone은 유지된다 — 중복 합치기로 지운 상대 기록이 되살아나지 않게.
    if (incomingWins(local, expense)) {
      const { id: _id, ...rest } = expense;
      await db.update(expenses).set(rest).where(eq(expenses.id, expense.id));
    }
  }

  return received;
}

/**
 * 들어온 여행마다 "나" 참가자 행을 만든다.
 *
 * 참가자는 여행 단위다(`participants.tripId`). 상대에게서 여행 세 건을 받아왔는데
 * 내 행이 그중 하나에만 있으면, 나머지 여행에서는 `myParticipantId`가 null이 되어
 * 지출을 기록할 수도 동기화할 수도 없다. 몇 번을 돌려도 결과가 같다.
 */
async function ensureMeInEveryTrip(): Promise<void> {
  const [tripRows, participantRows] = await Promise.all([
    db.select().from(trips).where(isNull(trips.deletedAt)),
    db.select().from(participants).where(isNull(participants.deletedAt)),
  ]);

  const myName = participantRows.find((p) => p.isMe)?.name ?? '나';
  const now = Date.now();

  for (const trip of tripRows) {
    if (participantRows.some((p) => p.tripId === trip.id && p.isMe)) continue;
    await db.insert(participants).values({
      id: newId(),
      tripId: trip.id,
      name: myName,
      isMe: true,
      joinedAt: now,
      updatedAt: now,
    });
  }
}

/**
 * 동기화 한 번 = 올리고(1) 내려받아 합치기(2). 유저에게는 하나의 동작으로 보인다.
 * 업로드가 실패하면 여기서 그대로 던진다 — 로컬 데이터는 아직 아무것도 건드리지 않았다.
 */
export async function runSync(
  code: string,
  tripId: string,
  myParticipantId: string,
): Promise<SyncResult> {
  const version = await localVersion();
  const bundle = await buildBundle(tripId, myParticipantId);
  await putBundle(code, bundle);
  useAppStore.getState().markUploaded(version);

  const others = await fetchBundles(code, myParticipantId);
  let received = 0;
  for (const other of others) received += await mergeBundle(other, myParticipantId);

  // 새로 들어온 여행에도 내 자리를 만들어 둔다 — 없으면 그 여행에서는 기록을 못 한다
  await ensureMeInEveryTrip();

  return { sent: bundle.expenses.filter((e) => !e.deletedAt).length, received };
}

/* ------------------------------------------------------------
 * 중복 감지
 * ------------------------------------------------------------ */

/**
 * 같은 결제를 둘이 각자 기록했을 수 있는 쌍을 찾는다.
 * 금액·통화·카테고리가 같고, 15분 이내이고, 기록자가 서로 다를 것.
 * 한 지출은 한 쌍에만 들어간다 — 세 건이 얽히면 유저가 두 번 답하는 것보다 낫다.
 */
export async function findDuplicates(
  tripId: string,
  myParticipantId: string,
): Promise<DuplicatePair[]> {
  const rows = await db
    .select()
    .from(expenses)
    .where(and(eq(expenses.tripId, tripId), isNull(expenses.deletedAt)));

  const mine = rows.filter((e) => e.authorId === myParticipantId);
  const theirs = rows.filter((e) => e.authorId !== myParticipantId);
  const used = new Set<string>();
  const pairs: DuplicatePair[] = [];

  for (const a of mine) {
    const b = theirs.find((other) => !used.has(other.id) && looksDuplicate(a, other));
    if (!b) continue;
    used.add(b.id);
    // 먼저 기록된 쪽을 남긴다. 결제자가 확정되어야 정산이 성립한다.
    pairs.push(a.occurredAt <= b.occurredAt ? { keep: a, drop: b } : { keep: b, drop: a });
  }

  return pairs;
}

/**
 * "하나로 합치기" — 나중 것을 tombstone으로 지운다.
 *
 * ponytail: 상대 기록을 지우는 경우, 이 tombstone은 내 기기에만 남는다 (내 묶음에는
 * 내 지출만 담기므로). 상대 기기에는 그 기록이 그대로 있고, 다시 받아도 로컬 tombstone이
 * 이기므로 되살아나지는 않는다. 양쪽을 맞추려면 서버에 "합침" 신호를 따로 실어야 한다.
 */
export async function mergeDuplicate(pair: DuplicatePair): Promise<void> {
  const now = Date.now();
  await db
    .update(expenses)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(expenses.id, pair.drop.id));
}

/* ------------------------------------------------------------
 * 초대 / 참가
 * ------------------------------------------------------------ */

/** 표시용 이름을 바꾼다. 상대 화면에 이 이름이 보인다. */
export async function renameMe(participantId: string, name: string): Promise<void> {
  await db
    .update(participants)
    .set({ name, updatedAt: Date.now() })
    .where(eq(participants.id, participantId));
}

/**
 * 초대하는 쪽 — 코드를 발급받아 여행에 박아둔다. 지출은 아직 오가지 않는다.
 */
export async function startSharing(trip: Trip, me: Participant, myName: string): Promise<SyncRoom> {
  const room = await createRoom({
    tripId: trip.id,
    destinationCurrency: trip.destinationCurrency,
    destinationCountryCode: trip.destinationCountryCode,
    baseCurrency: trip.baseCurrency,
    startDate: trip.startDate,
    endDate: trip.endDate,
    // 참가하는 쪽은 이 여행을 그대로 따라간다 — 예산까지 넘겨야 참가 즉시 같은 화면이 된다
    name: trip.name,
    budgetAmount: trip.budgetAmount,
    budgetCurrency: trip.budgetCurrency,
    participant: { id: me.id, name: myName },
  });

  await renameMe(me.id, myName);
  await db
    .update(trips)
    .set({ shareCode: room.code, updatedAt: Date.now() })
    .where(eq(trips.id, trip.id));

  /*
   * 코드를 만든 그 자리에서 묶음을 한 번 올려둔다.
   * 이게 없으면 상대가 참가한 직후 우편함이 비어 있어 화면이 텅 빈 채로 남는다
   * (내가 나중에 동기화 버튼을 눌러야 그제서야 상대에게 기록이 간다).
   */
  await uploadMyBundle(room.code, trip.id, me.id);

  return room;
}

/**
 * 코드 재발급 — 옛 방을 버리고 새 코드를 받는다.
 *
 * 코드가 새어나갔거나 만료됐을 때 쓴다. 옛 방 삭제는 best-effort다 — 실패해도 방에는
 * TTL이 걸려 있어 결국 사라지고, 그 사이 내 새 기록은 이미 새 방에만 올라간다.
 *
 * 이미 참가한 상대는 **연결이 끊긴다** (상대 기기는 옛 코드를 들고 있다).
 * 그래서 화면이 먼저 그 사실을 확인받아야 한다.
 */
export async function resetShareCode(trip: Trip, me: Participant): Promise<SyncRoom> {
  const previous = trip.shareCode;
  const room = await startSharing(trip, me, me.name);
  if (previous && previous !== room.code) {
    try {
      await deleteRoom(previous);
    } catch {
      // 옛 방이 남아도 새 묶음은 그쪽으로 가지 않는다. TTL이 정리한다.
    }
  }
  return room;
}

/**
 * 연동 끊기 — 이 여행을 다시 혼자 쓰는 상태로 되돌린다.
 *
 * **기록은 하나도 지우지 않는다.** 내가 쓴 것도, 상대에게서 받아온 것도 그대로 남는다.
 * 끊는 것은 앞으로의 오고 감뿐이다.
 *
 * 하는 일은 셋:
 *   1) 서버 방에서 나를 뺀다 (best-effort — 실패해도 아래는 그대로 진행한다)
 *   2) 상대 참가자 행을 tombstone 처리한다 → 살아있는 참가자가 1명이 되어 연동 UI가 사라진다.
 *      행 자체는 남으므로 그 사람이 기록한 지출의 참조도, 이름 표시도 깨지지 않는다.
 *   3) shareCode를 지운다 → 우편함 자동 업로드가 멈추고 동기화 버튼도 사라진다.
 */
export async function unlinkTrip(trip: Trip, myParticipantId: string): Promise<void> {
  if (trip.shareCode) {
    try {
      await removeParticipant(trip.shareCode, myParticipantId);
    } catch {
      // 서버에 못 알려도 로컬은 끊는다. 내 묶음이 더는 올라가지 않으므로 실질적으로 끊긴다.
    }
  }

  const now = Date.now();
  await db
    .update(participants)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(participants.tripId, trip.id),
        ne(participants.id, myParticipantId),
        isNull(participants.deletedAt),
      ),
    );
  await dropShareCode(trip.id);
}

/**
 * 참가하는 쪽 — 상대의 여행에 들어간다. **이 기기의 기존 기록은 전부 버린다.**
 *
 * 두 기기의 지출이 같은 tripId에 속해야 합계도 정산도 성립하므로, 참가하는 쪽이
 * 상대의 여행 id를 그대로 받아 쓴다. 즉 참가는 "상대를 따라간다"는 뜻이고,
 * 내 여행과 지출을 옮겨 붙이지 않는다 — 옮기면 상대가 만들지 않은 여행의 지출이
 * 상대 기기로 흘러가고, 기간이 겹치는 여행이 둘이 되어 활성 여행 판정이 흔들린다.
 *
 * 내 기록을 지켜야 하면 방향을 뒤집으면 된다: 내가 초대 코드를 만들어 상대를 부른다.
 * 그래서 화면은 참가 직전에 이 사실을 강하게 경고해야 한다 (join-code-sheet).
 *
 * 여기서는 tombstone이 아니라 물리 삭제다. 버려지는 여행은 이 기기에만 있던 것이고,
 * tombstone으로 남기면 그 삭제 표시가 다음 동기화 때 상대에게까지 흘러간다.
 */
export async function joinSharedTrip(
  room: SyncRoom,
  myName: string,
): Promise<{ tripId: string; participantId: string }> {
  const now = Date.now();
  const myId = newId();

  // 서버 참가가 먼저다 — 실패하면(코드 만료·정원 초과) 로컬은 아직 그대로다
  await joinRoom(room.code, { id: myId, name: myName });

  /* 이 기기의 여행·지출·참가자를 비운다. 커스텀 카테고리는 남긴다(내 취향이지 남의 기록이 아니다). */
  await db.delete(expenses);
  await db.delete(participants);
  await db.delete(trips);

  /* 상대의 여행을 로컬에 만든다. 통화와 기간만 맞춘다 — 지출은 동기화가 가져온다. */
  // `?? null` — drizzle에 undefined를 넘기면 컬럼이 바인딩에서 빠져 엉뚱한 값이 박힌다
  // (여행 이름이 "name"으로, 예산이 NaN으로 보이던 원인).
  await db.insert(trips).values({
    id: room.tripId,
    name: room.name ?? null,
    destinationCurrency: room.destinationCurrency,
    destinationCountryCode: room.destinationCountryCode ?? null,
    baseCurrency: room.baseCurrency,
    startDate: room.startDate ?? null,
    endDate: room.endDate ?? null,
    budgetAmount: room.budgetAmount ?? null,
    budgetCurrency: room.budgetCurrency ?? null,
    shareCode: room.code,
    createdAt: now,
    updatedAt: now,
  });

  /* 참가자 명단 — 상대는 아직 묶음을 올리지 않았어도 이름은 보여야 한다. */
  for (const person of room.participants) {
    if (person.id === myId) continue;
    await db.insert(participants).values({
      id: person.id,
      tripId: room.tripId,
      name: person.name,
      isMe: false,
      joinedAt: now,
      updatedAt: now,
    });
  }

  await db.insert(participants).values({
    id: myId,
    tripId: room.tripId,
    name: myName,
    isMe: true,
    joinedAt: now,
    updatedAt: now,
  });

  return { tripId: room.tripId, participantId: myId };
}
