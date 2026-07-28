import assert from 'node:assert/strict';

import type { Trip } from '@/db/schema';
import { findOverlap, pickActiveTrip } from './trip-dates.ts';

/**
 * 여행 기간 규칙 자체 점검. `node src/lib/trip-dates.check.ts`로 그냥 돈다 (러너 없음).
 * 여기가 깨지면 기간이 겹치는 여행이 만들어지거나, 히어로가 엉뚱한 여행을 가리킨다.
 */

const trip = (id: string, startDate: string | null, endDate: string | null): Trip =>
  ({
    id,
    name: null,
    destinationCurrency: 'THB',
    baseCurrency: 'KRW',
    startDate,
    endDate,
    budgetAmount: null,
    budgetCurrency: null,
    shareCode: null,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  }) as Trip;

const idn = trip('idn', '2026-07-03', '2026-07-06');
const tha = trip('tha', '2026-08-11', '2026-08-30');

/* 겹침 — 하루라도 물리면 만들 수 없다 */
assert.equal(findOverlap([idn], '2026-07-06', '2026-07-12')?.id, 'idn');
assert.equal(findOverlap([idn], '2026-07-03', '2026-07-12')?.id, 'idn');
assert.equal(findOverlap([idn], '2026-06-01', '2026-07-03')?.id, 'idn');
assert.equal(findOverlap([idn], '2026-07-07', '2026-07-14'), null);
assert.equal(findOverlap([idn], '2026-07-03', '2026-07-06', 'idn'), null); // 자기 자신은 제외

/* 활성 여행 선택 */
assert.deepEqual(pickActiveTrip([idn, tha], '2026-07-04'), { trip: idn, phase: 'during' });
assert.deepEqual(pickActiveTrip([idn, tha], '2026-07-16'), { trip: tha, phase: 'before' });
assert.deepEqual(pickActiveTrip([idn], '2026-07-16'), { trip: idn, phase: 'after' });
assert.deepEqual(pickActiveTrip([], '2026-07-16'), { trip: null, phase: 'none' });
assert.equal(pickActiveTrip([trip('old', null, null)], '2026-07-16').phase, 'during');

console.log('trip-dates ok');
