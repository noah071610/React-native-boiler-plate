import assert from 'node:assert/strict';

import type { Expense } from '@/db/schema';
import { DUPLICATE_WINDOW_MS, incomingWins, looksDuplicate } from './sync-rules.ts';

/**
 * 동기화 규칙 자체 점검. `node src/lib/sync-rules.check.ts`로 그냥 돈다 (러너 없음).
 * 여기가 깨지면 남의 기록을 덮어쓰거나 지운 기록이 되살아난다.
 */

const T0 = Date.parse('2026-07-23T19:40:00');

const expense = (over: Partial<Expense>): Expense =>
  ({
    id: 'e1',
    tripId: 't1',
    authorId: 'me',
    categoryId: 'food',
    amount: 80000,
    currency: 'THB',
    baseAmount: 3200,
    baseCurrency: 'KRW',
    rate: 0.04,
    rateDate: '2026-07-23',
    occurredAt: T0,
    paymentMethod: 'cash',
    isPersonal: false,
    memo: null,
    place: null,
    photoUri: null,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    ...over,
  }) as Expense;

/* 삭제는 되살아나지 않는다 — updatedAt이 더 최신이어도 로컬 tombstone이 이긴다 */
assert.equal(incomingWins({ updatedAt: 10, deletedAt: 5 }, { updatedAt: 99, deletedAt: null }), false);
/* 상대의 삭제는 항상 전달된다 */
assert.equal(incomingWins({ updatedAt: 99, deletedAt: null }, { updatedAt: 10, deletedAt: 5 }), true);
/* 그 외에는 LWW */
assert.equal(incomingWins({ updatedAt: 10, deletedAt: null }, { updatedAt: 11, deletedAt: null }), true);
assert.equal(incomingWins({ updatedAt: 11, deletedAt: null }, { updatedAt: 11, deletedAt: null }), false);

const mine = expense({ id: 'a', authorId: 'me' });
const theirs = expense({ id: 'b', authorId: 'you', occurredAt: T0 + 5 * 60_000 });

assert.equal(looksDuplicate(mine, theirs), true);
/* 같은 사람이 두 번 기록한 것은 중복 후보가 아니다 (본인이 나눠 낸 것일 수 있다) */
assert.equal(looksDuplicate(mine, expense({ id: 'c', authorId: 'me' })), false);
/* 15분을 넘기면 다른 결제로 본다 */
assert.equal(
  looksDuplicate(mine, expense({ id: 'd', authorId: 'you', occurredAt: T0 + DUPLICATE_WINDOW_MS + 1 })),
  false,
);
/* 금액 / 통화 / 카테고리 중 하나라도 다르면 아니다 */
assert.equal(looksDuplicate(mine, expense({ id: 'e', authorId: 'you', amount: 80001 })), false);
assert.equal(looksDuplicate(mine, expense({ id: 'f', authorId: 'you', currency: 'KRW' })), false);
assert.equal(looksDuplicate(mine, expense({ id: 'g', authorId: 'you', categoryId: 'cafe' })), false);
/* 여행이 다르면 아니다 */
assert.equal(looksDuplicate(mine, expense({ id: 'h', authorId: 'you', tripId: 't2' })), false);

console.log('sync-rules ok');
