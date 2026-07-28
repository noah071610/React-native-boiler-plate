import { Text, View } from 'react-native';

import { SheetLayout } from '@/components/ui/sheet-layout';
import type { Expense } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { formatMoneyI18n, useI18n } from '@/i18n';
import type { DuplicatePair } from '@/lib/sync';

const timeLabel = (ms: number, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ms));

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
  const { locale, resolvedLanguage, t } = useI18n();
  if (!pair) return null;

  const row = (expense: Expense, first: boolean) => (
    <View
      key={expense.id}
      style={{ borderTopWidth: first ? 0 : 1, borderColor: scheme.border }}
      className="gap-1 py-3"
    >
      <Text className="text-xs font-semibold text-neutral-400">
        {timeLabel(expense.occurredAt, locale)}
      </Text>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-base font-black text-neutral-900 dark:text-neutral-50">
          {formatMoneyI18n(expense.amount, expense.currency, t, resolvedLanguage)}
        </Text>
        <Text className="text-xs font-bold text-neutral-400">
          {expense.authorId === myParticipantId
            ? t('sync.recordedByMe', '내가 기록')
            : t('sync.recordedByName', '{{name}}가 기록', { name: authorName })}
        </Text>
      </View>
    </View>
  );

  return (
    <SheetLayout
      visible
      onClose={onKeepBoth}
      title={t('sync.similarRecordsTitle', '비슷한 기록이 있어요')}
      subtitle={t('sync.similarRecordsSubtitle', '같은 결제를 둘이 각각 기록했을 수 있어요')}
      primaryLabel={t('sync.keepBoth', '둘 다 맞아요')}
      onPrimary={onKeepBoth}
      secondaryLabel={t('sync.mergeOne', '하나로 합치기')}
      onSecondary={onMerge}
    >
      <View style={{ borderColor: scheme.border }} className="rounded-2xl border px-4 py-1">
        {row(pair.keep, true)}
        {row(pair.drop, false)}
      </View>
      {total > 1 ? (
        <Text className="mt-3 text-center text-xs font-bold text-neutral-400">
          {index + 1} / {total}
        </Text>
      ) : null}
      <Text className="mt-2 text-center text-xs font-semibold text-neutral-400">
        {t('sync.mergeKeepsEarlier', '합치면 먼저 기록된 쪽이 남아요')}
      </Text>
    </SheetLayout>
  );
}
