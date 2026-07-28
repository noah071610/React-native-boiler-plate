import { Text, View } from 'react-native';

import { SheetLayout } from '@/components/ui/sheet-layout';
import type { Expense } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import type { DuplicatePair } from '@/lib/sync';
import { formatMoney } from '@/lib/money';

const timeLabel = (ms: number) => {
  const d = new Date(ms);
  const hh = `${d.getHours()}`.padStart(2, '0');
  const mm = `${d.getMinutes()}`.padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hh}:${mm}`;
};

/**
 * 유사 기록 확인 — 동기화 직후 한 쌍씩 넘기며 묻는다 (layout-sync §중복 감지).
 *
 * "둘 다 맞아요"가 기본값(primary)이다. 잘못 합치는 것이 잘못 남기는 것보다 나쁘다 —
 * 중복은 나중에 지울 수 있지만 합쳐진 것은 되돌리기 어렵다.
 */
export function DuplicateSheet({
  pair,
  index,
  total,
  authorName,
  myParticipantId,
  onMerge,
  onKeepBoth,
}: {
  pair: DuplicatePair | null;
  index: number;
  total: number;
  /** 상대 이름. 없으면 '동행자' */
  authorName: string;
  myParticipantId: string | null;
  onMerge: () => void;
  onKeepBoth: () => void;
}) {
  const { scheme } = useTheme();
  if (!pair) return null;

  const row = (expense: Expense, first: boolean) => (
    <View
      key={expense.id}
      style={{ borderTopWidth: first ? 0 : 1, borderColor: scheme.border }}
      className="gap-1 py-3"
    >
      <Text className="text-xs font-semibold text-neutral-400">
        {timeLabel(expense.occurredAt)}
      </Text>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
          {formatMoney(expense.amount, expense.currency)}
        </Text>
        <Text className="text-xs font-bold text-neutral-400">
          {expense.authorId === myParticipantId ? '내가 기록' : `${authorName}가 기록`}
        </Text>
      </View>
    </View>
  );

  return (
    <SheetLayout
      visible
      onClose={onKeepBoth}
      title="비슷한 기록이 있어요"
      subtitle="같은 결제를 둘이 각각 기록했을 수 있어요"
      primaryLabel="둘 다 맞아요"
      onPrimary={onKeepBoth}
      secondaryLabel="하나로 합치기"
      onSecondary={onMerge}
    >
      <View
        style={{ borderColor: scheme.border }}
        className="rounded-2xl border px-4 py-1"
      >
        {row(pair.keep, true)}
        {row(pair.drop, false)}
      </View>
      {total > 1 ? (
        <Text className="mt-3 text-center text-xs font-bold text-neutral-400">
          {index + 1} / {total}
        </Text>
      ) : null}
      <Text className="mt-2 text-center text-xs font-semibold text-neutral-400">
        합치면 먼저 기록된 쪽이 남아요
      </Text>
    </SheetLayout>
  );
}
