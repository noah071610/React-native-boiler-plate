import type { CalcResult } from '@/components/domain/main/calculator-sheet';
import type { QuickRecordInput } from '@/components/domain/main/quick-record';
import { db } from '@/db';
import { expenses } from '@/db/schema';
import type { RateQuote } from '@/lib/rates';
import { newId } from '@/lib/utils';

type Args = {
  tripId: string;
  authorId: string;
  localCurrency: string;
  baseCurrency: string;
  quote: RateQuote;
  result: CalcResult;
  input: QuickRecordInput;
};

/**
 * 계산기 → 지출 1건. 메인과 타임라인이 같은 시트를 쓰므로 삽입도 한 곳에 둔다.
 * 환율은 여기서 박제된다 — 이 뒤로 환율이 바뀌어도 이 지출은 변하지 않는다.
 */
export async function insertExpense({
  tripId,
  authorId,
  localCurrency,
  baseCurrency,
  quote,
  result,
  input,
}: Args): Promise<string> {
  const now = Date.now();
  const id = newId();
  await db.insert(expenses).values({
    id,
    tripId,
    authorId,
    categoryId: input.categoryId,
    amount: result.localMinor,
    currency: localCurrency,
    baseAmount: result.baseMinor,
    baseCurrency,
    rate: quote.rate,
    rateDate: quote.date,
    occurredAt: input.occurredAt,
    paymentMethod: input.paymentMethod,
    isPersonal: input.isPersonal,
    usedBy: input.usedBy,
    // ponytail: memo/place는 v1 범위 밖 — 컬럼은 nullable이라 그냥 비워둔다
    createdAt: now,
    updatedAt: now,
  });
  return id;
}
