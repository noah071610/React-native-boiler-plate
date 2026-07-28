import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalculatorSheet, type CalcResult } from '@/components/domain/main/calculator-sheet';
import {
  PAYMENTS,
  formatDateTime,
  type QuickRecordInput,
} from '@/components/domain/main/quick-record';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SectionHeader } from '@/components/ui/section-header';
import { categoryLabel } from '@/constants/categories';
import { db } from '@/db';
import { categories, expenses, participants } from '@/db/schema';
import { useActiveTrip } from '@/hooks/use-active-trip';
import { useTheme } from '@/hooks/use-theme';
import { formatMoney } from '@/lib/money';
import { formatRateDate } from '@/lib/rates';
import { useSettingsStore } from '@/store/settings';

/**
 * 지출 상세 — 타임라인/메인에서 기록 하나를 탭하면 여기로 온다.
 *
 * id가 있으면 저장된 지출의 상세(+ 수정/삭제),
 * id 없이 금액 파라미터만 오면 최근 계산 칩의 스냅샷 보기다.
 *
 * 수정은 계산기 시트를 그대로 재사용한다 — 금액은 키패드, 카테고리·결제수단·시각은
 * 빠른 기록 패널. 기록할 때와 고칠 때의 화면이 같아야 헷갈리지 않는다.
 * 환율은 기록 시점 값을 그대로 쓴다 (스냅샷은 지출의 일부지 지금 시세가 아니다).
 */
export default function ExpenseScreen() {
  const router = useRouter();
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const language = useSettingsStore((s) => s.language);
  const { expenses: tripExpenses, myParticipantId } = useActiveTrip();

  const params = useLocalSearchParams<{
    id?: string;
    amount?: string;
    currency?: string;
    baseAmount?: string;
    baseCurrency?: string;
    rate?: string;
    rateDate?: string;
  }>();

  const detailQuery = useLiveQuery(
    db
      .select()
      .from(expenses)
      .where(eq(expenses.id, params.id ?? '')),
  );
  const categoryQuery = useLiveQuery(db.select().from(categories));
  const participantQuery = useLiveQuery(db.select().from(participants));

  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const expense = params.id ? (detailQuery.data?.[0] ?? null) : null;
  const category = categoryQuery.data?.find((c) => c.id === expense?.categoryId) ?? null;
  const author = participantQuery.data?.find((p) => p.id === expense?.authorId) ?? null;
  const payment = PAYMENTS.find((p) => p.id === expense?.paymentMethod) ?? null;
  /** 연동 판정 = 이 여행의 살아있는 참가자가 2명 이상 */
  const members =
    participantQuery.data?.filter((p) => p.tripId === expense?.tripId && p.deletedAt == null) ?? [];
  const shared = members.length >= 2;
  const usedByName = expense?.usedBy
    ? (members.find((p) => p.id === expense.usedBy)?.name ?? '동행자')
    : '공용';
  /** 자기가 기록한 것만 고치고 지울 수 있다 (Master §11 소유권 규칙) */
  const mine = expense != null && expense.authorId === myParticipantId;

  const saveEdit = async (result: CalcResult, input: QuickRecordInput) => {
    if (!expense) return;
    setEditing(false);
    await db
      .update(expenses)
      .set({
        amount: result.localMinor,
        baseAmount: result.baseMinor,
        categoryId: input.categoryId,
        paymentMethod: input.paymentMethod,
        occurredAt: input.occurredAt,
        isPersonal: input.isPersonal,
        usedBy: input.usedBy,
        updatedAt: Date.now(),
      })
      .where(eq(expenses.id, expense.id));
  };

  /** 물리 삭제하면 아직 동기화하지 않은 상대 기기에서 되살아난다 — tombstone으로 지운다. */
  const confirmDelete = async () => {
    if (!expense) return;
    const now = Date.now();
    await db
      .update(expenses)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(expenses.id, expense.id));
    setConfirming(false);
    router.back();
  };

  // 최근 계산 칩 스냅샷 — 저장된 지출이 아니라 금액만 넘어온 경우
  if (!params.id) {
    const amount = Number(params.amount ?? 0);
    const baseAmount = Number(params.baseAmount ?? 0);
    return (
      <View className="flex-1" style={{ backgroundColor: scheme.background }}>
        <SectionHeader title="지출 기록" onBack={() => router.back()} />
        <View className="gap-2 p-5">
          <Text className="text-3xl font-black text-neutral-900 dark:text-neutral-50">
            {formatMoney(amount, params.currency ?? 'THB')}
          </Text>
          <Text className="text-base font-bold text-neutral-500 dark:text-neutral-400">
            {formatMoney(baseAmount, params.baseCurrency ?? 'KRW')}
          </Text>
          {params.rateDate ? (
            <Text className="text-xs font-semibold text-neutral-400">
              {formatRateDate(params.rateDate)} 환율 기준 · 1 {params.currency} ={' '}
              {Number(params.rate ?? 0).toFixed(4)} {params.baseCurrency}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

  if (!expense) {
    return (
      <View className="flex-1" style={{ backgroundColor: scheme.background }}>
        <SectionHeader title="지출 기록" onBack={() => router.back()} />
        <View className="flex-1 items-center justify-center px-10">
          <Text className="text-sm font-semibold" style={{ color: scheme.mutedForeground }}>
            {detailQuery.data === undefined ? '불러오는 중' : '없는 기록이에요'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: scheme.background }}>
      <SectionHeader title="지출 기록" onBack={() => router.back()} />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 20 }}>
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Text className="text-2xl">{category?.icon ?? '💸'}</Text>
            <Text className="text-base font-bold" style={{ color: scheme.mutedForeground }}>
              {category ? categoryLabel(category) : '지출'}
            </Text>
          </View>
          <Text className="text-4xl font-black text-neutral-900 dark:text-neutral-50">
            {formatMoney(expense.amount, expense.currency)}
          </Text>
          <Text className="text-base font-bold text-neutral-500 dark:text-neutral-400">
            {formatMoney(expense.baseAmount, expense.baseCurrency)}
          </Text>
          <Text className="text-xs font-semibold text-neutral-400">
            {formatRateDate(expense.rateDate)} 환율 기준 · 1 {expense.currency} ={' '}
            {expense.rate.toFixed(4)} {expense.baseCurrency}
          </Text>
        </View>

        <View className="gap-px overflow-hidden rounded-2xl" style={{ backgroundColor: scheme.muted }}>
          <Row label="언제" value={formatDateTime(new Date(expense.occurredAt), language)} />
          {payment ? <Row label="결제수단" value={`${payment.icon} ${payment.label}`} /> : null}
          <Row label="기록한 사람" value={mine ? '나' : (author?.name ?? '동행자')} />
          {shared ? <Row label="누가 사용" value={usedByName} /> : null}
          {expense.isPersonal ? <Row label="정산" value="나만 쓴 돈 (제외)" /> : null}
          {expense.place ? <Row label="장소" value={expense.place} /> : null}
          {expense.memo ? <Row label="메모" value={expense.memo} /> : null}
        </View>
      </ScrollView>

      {mine ? (
        <View
          className="flex-row gap-2 px-5 pt-2"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <View className="flex-1">
            <Button
              label="수정"
              variant="ghost"
              icon={<Pencil size={18} color={scheme.secondaryForeground} />}
              onPress={() => setEditing(true)}
            />
          </View>
          <View className="flex-1">
            <Button
              label="삭제"
              variant="ghost"
              icon={<Trash2 size={18} color={scheme.destructive} />}
              onPress={() => setConfirming(true)}
            />
          </View>
        </View>
      ) : (
        <Text
          className="px-5 pb-8 pt-2 text-center text-xs font-semibold"
          style={{ color: scheme.mutedForeground }}
        >
          동행자가 기록한 지출은 고칠 수 없어요
        </Text>
      )}

      <CalculatorSheet
        visible={editing}
        side="local"
        localCurrency={expense.currency}
        baseCurrency={expense.baseCurrency}
        // 기록 시점 환율을 그대로 쓴다 — 금액만 고쳐도 스냅샷은 유지된다
        rate={expense.rate}
        initialMinor={expense.amount}
        tripId={expense.tripId}
        expenses={tripExpenses}
        initialInput={{
          categoryId: expense.categoryId ?? undefined,
          paymentMethod: expense.paymentMethod ?? undefined,
          occurredAt: expense.occurredAt,
          isPersonal: expense.isPersonal,
          usedBy: expense.usedBy,
        }}
        saveLabel="수정 완료"
        onClose={() => setEditing(false)}
        onSave={saveEdit}
      />

      <ConfirmDialog
        visible={confirming}
        title="이 기록을 지울까요?"
        message="지운 기록은 되돌릴 수 없어요."
        actions={[
          { label: '삭제', variant: 'destructive', onPress: () => void confirmDelete() },
          { label: '취소', variant: 'ghost', onPress: () => setConfirming(false) },
        ]}
        onDismiss={() => setConfirming(false)}
      />
    </View>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  const { scheme } = useTheme();
  return (
    <View
      className="flex-row items-center justify-between px-4 py-3.5"
      style={{ backgroundColor: scheme.card }}
    >
      <Text className="text-sm font-bold" style={{ color: scheme.mutedForeground }}>
        {label}
      </Text>
      <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50">{value}</Text>
    </View>
  );
}
