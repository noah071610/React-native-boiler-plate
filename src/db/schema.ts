import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';



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


/* ============================================================
 * Tabica — 앱 로컬 스키마 (expo-sqlite)
 *
 * 이 DB가 진실의 원본이다. 서버에는 여행/지출이 존재하지 않는다.
 *
 * 공통 규칙
 * ------------------------------------------------------------
 * 1) PK는 전부 UUID(text).
 *    동기화 머지가 id 기준 union이라 자동증가 정수를 쓰면 두 기기의 id가 충돌한다.
 *
 * 2) 금액은 전부 "정수 최소단위(minor unit)"로 저장한다.
 *    KRW / JPY / VND / THB / IDR = 소수 0자리  →  13,894원  = 13894
 *    USD / EUR = 소수 2자리  →  320.50달러  = 32050
 *    통화별 소수 자리수는 DB가 아니라 앱의 통화 상수에서 관리한다.
 *    돈을 실수(float)로 저장하면 합계와 정산에서 반드시 틀어진다.
 *
 * 3) 시각은 unix epoch millis(정수). 날짜만 필요한 곳은 'YYYY-MM-DD' 문자열.
 *
 * 4) deletedAt은 tombstone이다.
 *    물리 삭제를 하면, 아직 동기화하지 않은 상대 기기에서 그 행이 되살아난다.
 *    삭제는 항상 deletedAt을 채우는 것으로 처리하고, 조회 시 필터한다.
 *
 * 5) updatedAt은 모든 동기화 대상 테이블에 있어야 한다.
 *    expenses는 소유권 규칙으로 충돌이 없지만, trips/categories는 LWW로 해결한다.
 * ============================================================ */

/* ------------------------------------------------------------
 * trips — 여행
 * 모든 기록이 소속되는 단위. 온보딩에서 자동으로 1건 생성된다.
 * 편집 충돌은 updatedAt 기준 LWW로 해결한다 (예산 변경 등은 드물다).
 * ------------------------------------------------------------ */
export const trips = sqliteTable(
  'trips',
  {
    id: text('id').primaryKey(),

    /** 유저가 직접 지은 이름. 여행이 1개일 때는 null인 채로 둔다. */
    name: text('name'),

    /** 현지 통화 ISO 4217. 여행 중 변경 가능 (여러 나라를 연달아 다니는 경우). */
    destinationCurrency: text('destination_currency').notNull(),

    /** 기준 통화 ISO 4217. 온보딩에서 기기 지역으로 추론. */
    baseCurrency: text('base_currency').notNull(),

    /** 'YYYY-MM-DD'. 미설정 가능 — 설정되면 "남은 N일 / 하루 얼마 가능"이 활성화된다. */
    startDate: text('start_date'),
    endDate: text('end_date'),

    /** 추상 예산. 실제 보유 현금이 아니라 "이만큼 쓰겠다"는 선언. minor unit. */
    budgetAmount: integer('budget_amount'),
    budgetCurrency: text('budget_currency'),

    /** 초대 코드. 협업을 시작하지 않았으면 null. 이것이 로그인을 대신한다. */
    shareCode: text('share_code'),

    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (t) => ({
    shareCodeIdx: uniqueIndex('trips_share_code_idx').on(t.shareCode),
    deletedIdx: index('trips_deleted_idx').on(t.deletedAt),
  }),
);

/* ------------------------------------------------------------
 * participants — 참가자
 * v1은 여행당 최대 2명. 인원 제한은 스키마가 아니라 앱 로직에서 막는다
 * (스키마는 N명을 그대로 수용하므로 나중에 UI만 풀면 된다).
 *
 * isMe는 기기마다 다른 값이다. 동기화 payload에 포함시키지 말 것.
 * 상대 묶음을 임포트할 때 들어온 participant의 isMe는 항상 false로 강제한다.
 * ------------------------------------------------------------ */
export const participants = sqliteTable(
  'participants',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id),

    /** 표시용 이름. 상대가 코드로 참가할 때 본인이 입력한다. */
    name: text('name').notNull(),

    /** 기기 로컬 전용 플래그. 동기화 제외. */
    isMe: integer('is_me', { mode: 'boolean' }).notNull().default(false),

    joinedAt: integer('joined_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (t) => ({
    tripIdx: index('participants_trip_idx').on(t.tripId),
  }),
);

/* ------------------------------------------------------------
 * categories — 카테고리
 *
 * 기본 카테고리: key만 채우고 name은 null → 앱에서 i18n으로 번역해 렌더한다.
 *   (한/영/일 3개 언어를 지원하므로 이름을 DB에 박으면 언어 전환 시 안 바뀐다)
 * 커스텀 카테고리: key는 null, name에 유저가 입력한 문자열.
 *
 * 이미 사용된 카테고리는 삭제하지 않고 hiddenAt으로 숨긴다.
 * (지출이 참조하고 있으므로 지우면 과거 기록이 깨진다)
 *
 * 커스텀 카테고리는 동기화 대상이다. 상대 기기에서도 렌더되어야 한다.
 * ------------------------------------------------------------ */
export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),

    /** 기본 카테고리 i18n 키. 예: 'food', 'transport'. 커스텀이면 null */
    key: text('key'),

    /** 커스텀 카테고리 이름. 기본이면 null */
    name: text('name'),

    /** 아이콘 식별자 (이모지 또는 아이콘 이름) */
    icon: text('icon').notNull(),

    sortOrder: integer('sort_order').notNull().default(0),
    isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),

    /** 숨김 처리 시각. null이면 노출 */
    hiddenAt: integer('hidden_at'),

    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (t) => ({
    keyIdx: uniqueIndex('categories_key_idx').on(t.key),
    sortIdx: index('categories_sort_idx').on(t.sortOrder),
  }),
);

/* ------------------------------------------------------------
 * expenses — 지출 (이 앱의 심장)
 *
 * 소유권 규칙: authorId가 곧 소유자이자 결제자다.
 *   - 자기가 기록한 것만 수정/삭제 가능. 상대 것은 읽기 전용.
 *   - 이 규칙 하나로 동기화 편집 충돌이 구조적으로 발생하지 않는다.
 *   - 정산에서 "누가 냈는가"를 별도 입력 없이 확정해준다.
 *
 * 스냅샷 환율: amount / currency / baseAmount / baseCurrency / rate / rateDate 를
 *   기록 시점에 전부 박제한다. 나중에 환율이 바뀌어도 과거 지출은 변하지 않는다.
 *   baseAmount를 미리 계산해 저장하므로 조회할 때마다 환산하지 않는다.
 * ------------------------------------------------------------ */
export const expenses = sqliteTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id),

    /** 기록자 = 소유자 = 결제자 */
    authorId: text('author_id')
      .notNull()
      .references(() => participants.id),

    categoryId: text('category_id').references(() => categories.id),

    /* --- 금액 (전부 minor unit 정수) --- */

    /** 현지 통화 금액 */
    amount: integer('amount').notNull(),
    currency: text('currency').notNull(),

    /** 기준 통화로 환산한 금액. 기록 시점에 계산해 박제한다. */
    baseAmount: integer('base_amount').notNull(),
    baseCurrency: text('base_currency').notNull(),

    /** 적용된 환율 (1 currency = rate baseCurrency). 표시용. */
    rate: real('rate').notNull(),

    /** 그 환율의 기준 날짜 'YYYY-MM-DD'. 오프라인이면 과거 날짜일 수 있다. */
    rateDate: text('rate_date').notNull(),

    /* --- 메타 --- */

    /** 지출이 발생한 시각. 기본값은 기록 시점이지만 유저가 바꿀 수 있다. */
    occurredAt: integer('occurred_at').notNull(),

    /** 계산에 쓰이지 않는 메타데이터. 귀국 후 카드 명세서 대조용. */
    paymentMethod: text('payment_method', {
      enum: ['cash', 'card', 'qr', 'other'],
    }),

    /** 정산에서 제외. 참가자 2명일 때만 UI에 노출된다. */
    isPersonal: integer('is_personal', { mode: 'boolean' })
      .notNull()
      .default(false),

    /**
     * 누가 썼는가 (결제자 authorId와 별개다 — 내가 냈지만 상대가 쓴 경우가 있다).
     * null = 공용(기본값). 값이 있으면 participants.id.
     * 참가자 2명일 때만 UI에 노출되고, 애널리틱스의 개인별 소비 비교가 이걸 읽는다.
     */
    usedBy: text('used_by').references(() => participants.id),

    memo: text('memo'),

    /** 가게 이름 등 자유 텍스트. 지도/GPS는 쓰지 않는다. 타임라인 검색 대상. */
    place: text('place'),

    /** 기기 로컬 파일 경로. 동기화 payload에 포함하지 않는다 (용량). */
    photoUri: text('photo_uri'),

    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (t) => ({
    /** 타임라인: 여행별 날짜 역순 */
    timelineIdx: index('expenses_timeline_idx').on(t.tripId, t.occurredAt),
    /** 애널리틱스: 카테고리 분포 */
    categoryIdx: index('expenses_category_idx').on(t.tripId, t.categoryId),
    /** 정산: 참가자별 합계 */
    authorIdx: index('expenses_author_idx').on(t.tripId, t.authorId),
    /** 조회 시 tombstone 필터 */
    deletedIdx: index('expenses_deleted_idx').on(t.tripId, t.deletedAt),
    /** 중복 감지 후보 탐색 (금액 + 시각 근사) */
    dedupeIdx: index('expenses_dedupe_idx').on(t.tripId, t.amount, t.occurredAt),
  }),
);

/* ------------------------------------------------------------
 * rate_history — 환율 캐시
 *
 * 서버 D1의 daily_rates를 그대로 복사해온 로컬 사본이다.
 * 앱은 "항상 여기를 먼저 읽고", 비어 있는 구간만 서버에 요청한다.
 * 그래서 비행기모드에서도 계산과 1년 그래프가 동작한다.
 *
 * 통화 하나당 365행 수준이므로 용량은 무시해도 된다.
 * ------------------------------------------------------------ */
export const rateHistory = sqliteTable(
  'rate_history',
  {
    /** 기준 통화 (예: 'KRW') */
    base: text('base').notNull(),
    /** 대상 통화 (예: 'THB') */
    quote: text('quote').notNull(),
    /** 'YYYY-MM-DD' */
    date: text('date').notNull(),
    /** 1 quote = rate base */
    rate: real('rate').notNull(),
    /** 이 행을 내려받은 시각 */
    fetchedAt: integer('fetched_at').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.base, t.quote, t.date] }),
    lookupIdx: index('rate_history_lookup_idx').on(t.base, t.quote, t.date),
  }),
);

/* ============================================================
 * 동기화 payload에 포함되는 것 / 제외되는 것
 *
 * 포함: trips, participants, categories(커스텀), expenses
 * 제외: rate_history          → 각자 서버에서 받으면 된다
 *       participants.isMe     → 기기 로컬 값. 임포트 시 항상 false로 강제
 *       expenses.photoUri     → 용량. 사진은 동기화하지 않는다
 *
 * 머지 규칙
 *   expenses  : id 기준 union. authorId가 내 것이 아닌 행은 절대 덮어쓰지 않는다.
 *   trips     : updatedAt 큰 쪽 승 (LWW)
 *   categories: updatedAt 큰 쪽 승 (LWW)
 *   deletedAt : 값이 있는 쪽이 이긴다
 * ============================================================ */

export type Trip = typeof trips.$inferSelect;
export type NewTrip = typeof trips.$inferInsert;

export type Participant = typeof participants.$inferSelect;
export type NewParticipant = typeof participants.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;

export type RateHistory = typeof rateHistory.$inferSelect;
export type NewRateHistory = typeof rateHistory.$inferInsert;

export type PaymentMethod = NonNullable<Expense['paymentMethod']>;