import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Check, ChevronLeft, Plus } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryManager } from '@/components/domain/settings/category-manager';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { categoryLabel } from '@/constants/categories';
import { db } from '@/db';
import { participants, type Category, type Expense, type PaymentMethod } from '@/db/schema';
import { useCategoryGrid } from '@/hooks/use-category-grid';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { useAppStore } from '@/store/app';
import { useSettingsStore } from '@/store/settings';

export type QuickRecordInput = {
  categoryId: string;
  /** 토스트 표시용 — 저장한 쪽에서 카테고리를 다시 조회하지 않으려고 같이 넘긴다 */
  categoryIcon: string;
  categoryName: string;
  paymentMethod: PaymentMethod;
  occurredAt: number;
  isPersonal: boolean;
  /** 누가 썼는가. null = 공용(기본값). 연동(참가자 2명)이 아니면 항상 null */
  usedBy: string | null;
};

type Props = {
  tripId: string;
  expenses: Expense[];
  /** 맨 위 안내 한 줄. 어느 여행에 붙는지가 화면만 봐서는 애매할 때만 준다 */
  notice?: string | null;
  /** 수정 모드에서 기존 값을 채워둔다. occurredAt이 있으면 "지금" 토글은 꺼진 채로 연다. */
  initial?: Partial<QuickRecordInput>;
  saveLabel?: string;
  /** 키패드로 되돌아간다. 금액은 계산기 쪽 state라 그대로 남는다. */
  onBack: () => void;
  onSave: (input: QuickRecordInput) => void;
};

export const PAYMENTS: { id: PaymentMethod; icon: string; label: string }[] = [
  { id: 'card', icon: '💳', label: '카드' },
  { id: 'cash', icon: '💵', label: '현금' },
  { id: 'qr', icon: '📲', label: 'QR' },
  { id: 'other', icon: '🧾', label: '기타' },
];

/** 4열 × 3줄. 그리드는 세로로 늘어나지 않고 이 단위로 좌우 페이지가 넘어간다. */
const PAGE_SIZE = 12;

/** 언어 설정 → BCP-47. 'system'이면 undefined를 넘겨 기기 로케일을 그대로 쓴다. */
const LOCALES: Record<string, string | undefined> = { system: undefined, ko: 'ko-KR', en: 'en-US', ja: 'ja-JP' };

/**
 * "2026년 7월 26일 오후 3:04" / "July 26, 2026 at 3:04 PM" / "2026年7月26日 15:04".
 * ponytail: dayjs 대신 Intl. 로케일 3개(ko/en/ja) 모두 런타임에 내장돼 있어서 의존성이 필요 없다.
 */
export function formatDateTime(date: Date, language: string): string {
  // dateStyle/timeStyle은 Hermes(Android) Intl에서 빠져 있는 버전이 있어 필드로 지정한다
  return new Intl.DateTimeFormat(LOCALES[language], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/** 날짜는 a에서, 시각은 b에서 (네이티브 피커가 두 단계로 나뉘어 있어 합쳐야 한다) */
const merge = (a: Date, b: Date) =>
  new Date(a.getFullYear(), a.getMonth(), a.getDate(), b.getHours(), b.getMinutes());

/**
 * 빠른 기록 — 계산기의 "기록하기" 뒤에 키패드 자리를 그대로 넘겨받는 패널이다.
 * 화면을 전환하지 않는다. 시트도 상단 금액도 그 자리에 그대로 있다.
 *
 * 카테고리 탭은 선택이고, 저장은 맨 아래 저장 버튼이 한다.
 * 잘못 누른 것은 저장 뒤의 되돌리기 토스트가 받는다.
 */
export function QuickRecord({
  tripId,
  expenses,
  notice,
  initial,
  saveLabel,
  onBack,
  onSave,
}: Props) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const grid = useCategoryGrid(expenses);
  const { lastPaymentMethod, setLastPaymentMethod } = useAppStore();

  const language = useSettingsStore((s) => s.language);

  const [payment, setPayment] = useState<PaymentMethod>(initial?.paymentMethod ?? lastPaymentMethod);
  /** 켜져 있으면 저장 버튼을 누른 그 순간이 지출 시각이다 (기본값) */
  const [now, setNow] = useState(initial?.occurredAt == null);
  const [occurredAt, setOccurredAt] = useState(() => new Date(initial?.occurredAt ?? Date.now()));
  const [isPersonal, setIsPersonal] = useState(initial?.isPersonal ?? false);
  /** null = 공용. 참가자 2명(연동)일 때만 UI에 나온다 */
  const [usedBy, setUsedBy] = useState<string | null>(initial?.usedBy ?? null);
  const [selected, setSelected] = useState<string | null>(initial?.categoryId ?? null);
  /** 날짜 → 시각 순서로 두 단계. null이면 닫힘 */
  const [step, setStep] = useState<'date' | 'time' | null>(null);
  /** 두 단계를 다 마쳐야 occurredAt에 반영한다 (중간에 닫으면 원래 값 유지) */
  const [draft, setDraft] = useState(() => new Date());
  /** 카테고리 관리 패널. 이 자리를 통째로 넘겨받는다 (설정 탭과 같은 화면) */
  const [managing, setManaging] = useState(false);
  /** 페이지 폭 = 그리드 폭. 측정 전에는 0이라 그리지 않는다 */
  const [gridWidth, setGridWidth] = useState(0);
  const [page, setPage] = useState(0);

  // 정산이 존재할 때만 "나만 쓴 돈"·"누가 사용했나요"가 의미를 가진다 (참가자 2명)
  const memberQuery = useLiveQuery(
    db
      .select()
      .from(participants)
      .where(and(eq(participants.tripId, tripId), isNull(participants.deletedAt))),
  );
  const members = useMemo(() => memberQuery.data ?? [], [memberQuery.data]);
  /** 연동 판정 = 이 여행의 살아있는 참가자가 2명 이상. 이것 말고 식별 수단이 없다 */
  const shared = members.length >= 2;
  const me = members.find((p) => p.isMe) ?? null;
  const other = members.find((p) => !p.isMe) ?? null;

  const selectedCategory = grid.find((c) => c.id === selected);

  /**
   * 12칸씩 잘라 페이지로 만든다. 추가 버튼(null)은 마지막 칸을 차지하므로 같이 자른다.
   * 12,24,36…에서 딱 떨어지면 추가 버튼만 있는 페이지가 하나 생기는데, 그래야
   * 칸 위치가 밀리지 않는다 (근육 기억이 이 그리드의 전부다).
   */
  const pages = useMemo(() => {
    const cells: (Category | null)[] = [...grid, null];
    return Array.from({ length: Math.ceil(cells.length / PAGE_SIZE) }, (_, i) =>
      cells.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE),
    );
  }, [grid]);

  const save = () => {
    const category = selectedCategory;
    if (!category) return;
    setLastPaymentMethod(payment);
    onSave({
      categoryId: category.id,
      categoryIcon: category.icon,
      categoryName: categoryLabel(category),
      paymentMethod: payment,
      occurredAt: now ? Date.now() : occurredAt.getTime(),
      isPersonal: shared && isPersonal,
      usedBy: shared ? usedBy : null,
    });
  };

  // 시트를 겹쳐 띄우지 않는다 — 계산기 시트 위에 또 Modal을 올리면 금액이 가려진다
  if (managing) return <CategoryManager onBack={() => setManaging(false)} />;

  return (
    // 섹션만 스크롤하고 저장 CTA는 하단에 고정한다
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ gap: 16, paddingBottom: 16 }}
      >
        {/* 어느 여행에 붙는지 — 출발 전 기록이면 화면에 그 여행이 떠 있어도 한 번 더 말해준다 */}
        {notice ? (
          <View
            style={{ backgroundColor: scheme.primarySoft }}
            className="rounded-2xl px-3.5 py-3"
          >
            <Text style={{ color: scheme.primary }} className="text-xs font-bold leading-relaxed">
              {notice}
            </Text>
          </View>
        ) : null}

        <Section title="어디에 썼나요">
        <View onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
          {gridWidth > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              // 세로 스크롤 부모에게 터치를 뺏기지 않게 가로 제스처를 먼저 잡는다
              directionalLockEnabled
              onMomentumScrollEnd={(e) =>
                setPage(Math.round(e.nativeEvent.contentOffset.x / gridWidth))
              }
            >
              {pages.map((cells, index) => (
                <View key={index} style={{ width: gridWidth }} className="flex-row flex-wrap">
                  {cells.map((category) =>
                    category ? (
                      <Cell
                        key={category.id}
                        selected={selected === category.id}
                        label={categoryLabel(category)}
                        icon={<Text className="text-2xl">{category.icon}</Text>}
                        onPress={() => {
                          haptics.selection();
                          setSelected(category.id);
                        }}
                      />
                    ) : (
                      // 항상 맨 마지막. 여기서 만든 카테고리는 이 버튼 앞자리에 붙는다
                      <Cell
                        key="add"
                        dashed
                        label="추가"
                        icon={<Plus size={24} color={scheme.primary} />}
                        onPress={() => {
                          haptics.selection();
                          setManaging(true);
                        }}
                      />
                    ),
                  )}
                </View>
              ))}
            </ScrollView>
          ) : null}

          {pages.length > 1 ? (
            <View className="mt-1 flex-row justify-center gap-1.5">
              {pages.map((_, index) => (
                <View
                  key={index}
                  style={{
                    backgroundColor: index === page ? scheme.primary : scheme.mutedForeground,
                    opacity: index === page ? 1 : 0.35,
                  }}
                  className="h-1.5 w-1.5 rounded-full"
                />
              ))}
            </View>
          ) : null}
        </View>
      </Section>

      <Section title="결제수단">
        <View className="flex-row gap-2">
          {PAYMENTS.map((item) => (
            <Chip
              key={item.id}
              label={`${item.icon} ${item.label}`}
              selected={payment === item.id}
              onPress={() => {
                haptics.selection();
                setPayment(item.id);
              }}
            />
          ))}
        </View>
      </Section>

      {/* 연동(참가자 2명)일 때만. 혼자 쓰는 여행에서는 물을 이유가 없다 */}
      {shared ? (
        <Section title="누가 사용했나요">
          <View className="flex-row gap-2">
            <Chip
              label="공용"
              selected={usedBy === null}
              onPress={() => {
                haptics.selection();
                setUsedBy(null);
              }}
            />
            {[me, other].map((member) =>
              member ? (
                <Chip
                  key={member.id}
                  label={member.name}
                  selected={usedBy === member.id}
                  onPress={() => {
                    haptics.selection();
                    setUsedBy(member.id);
                  }}
                />
              ) : null,
            )}
          </View>
        </Section>
      ) : null}

      {/* ponytail: 과거 날짜의 환율 재계산은 rate_history가 붙은 뒤에 묻는다.
          지금은 환율 소스가 시드 하나뿐이라 물어볼 다른 값이 없다. */}
      <Section title="언제">
        <View className="gap-2">
          {/* 높이를 고정하지 않는다 — 네이티브 Switch 높이가 플랫폼마다 달라
              h-12를 넘기면 세로 정렬이 위로 밀린다 */}
          <View
            style={{ backgroundColor: scheme.muted, minHeight: 52 }}
            className="flex-row items-center justify-between rounded-2xl px-4 py-2"
          >
            <Text className="text-sm font-bold text-neutral-700 dark:text-neutral-200">
              지금 (저장하는 시각)
            </Text>
            <Switch
              value={now}
              trackColor={{ true: scheme.primary, false: scheme.mutedForeground }}
              // iOS 스위치는 51x31이라 컨테이너 정렬과 별개로 자기 박스를 벗어나지 않게 잡아준다
              style={{ alignSelf: 'center' }}
              onValueChange={(value) => {
                haptics.selection();
                setNow(value);
                if (!value) setOccurredAt(new Date());
              }}
            />
          </View>

          {!now ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="지출 시각 고르기"
              onPress={() => {
                haptics.selection();
                setDraft(occurredAt);
                setStep('date');
              }}
              style={{ backgroundColor: scheme.muted }}
              className="h-12 justify-center rounded-2xl px-4 active:opacity-70"
            >
              <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50">
                🗓 {formatDateTime(occurredAt, language)}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Section>

      {shared ? (
        <Section title="추가 정보 (선택)">
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isPersonal }}
            onPress={() => {
              haptics.selection();
              setIsPersonal((v) => !v);
            }}
            className="flex-row items-center gap-2 py-1 active:opacity-70"
          >
            <View
              style={{
                borderColor: isPersonal ? scheme.primary : scheme.mutedForeground,
                backgroundColor: isPersonal ? scheme.primary : 'transparent',
              }}
              className="h-5 w-5 items-center justify-center rounded-md border-2"
            >
              {isPersonal ? (
                <Check size={12} color={scheme.primaryForeground} strokeWidth={3} />
              ) : null}
            </View>
            <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
              나만 쓴 돈 (정산 제외)
            </Text>
          </Pressable>
        </Section>
      ) : null}
      </ScrollView>

      <View className="flex-row gap-2 pt-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="계산기로 돌아가기"
          onPress={() => {
            haptics.selection();
            onBack();
          }}
          style={{ backgroundColor: scheme.secondary }}
          className="h-14 w-14 items-center justify-center rounded-2xl active:opacity-70"
        >
          <ChevronLeft size={22} color={scheme.foreground} />
        </Pressable>
        <View className="flex-1">
          <Button
            label={selectedCategory ? (saveLabel ?? '저장하기') : '카테고리를 골라주세요'}
            disabled={!selectedCategory}
            onPress={save}
          />
        </View>
      </View>

      {/* 날짜 → 시각. 피커 자체는 네이티브(iOS 캘린더/휠, Android 다이얼)를 쓰고
          감싸는 시트만 우리가 그린다. iOS는 presentation을 무시하고 항상 인라인이라
          이 방법이어야 디자인을 잡을 수 있다. */}
      {Platform.OS === 'ios' ? (
        <BottomSheet visible={step !== null} onClose={() => setStep(null)} avoidKeyboard={false}>
          <View
            style={{ backgroundColor: scheme.card, paddingBottom: insets.bottom + 16 }}
            className="gap-4 rounded-t-3xl px-5 pt-6"
          >
            <Text className="text-xl font-black text-neutral-900 dark:text-neutral-50">
              {step === 'time' ? '몇 시에 썼나요' : '언제 썼나요'}
            </Text>
            {/*
              높이는 이 껍데기가 고정으로 들고 피커에는 주지 않는다. 네이티브 Host가
              matchContents로 자기 측정 높이를 shadow node에 덮어써서, 우리가 준 높이로
              한 번 그려진 뒤 시트가 그만큼 커지기 때문이다 (열자마자 아래가 잘렸다가
              아무 데나 누르면 올라오던 버그).
              ponytail: 460/216은 각각 graphical·wheel 피커 상한. 잘리면 이 값만 올린다.
            */}
            <View style={{ height: step === 'time' ? 216 : 460, justifyContent: 'center' }}>
              {step ? (
                <DateTimePicker
                  // 단계가 바뀌면 네이티브 뷰를 새로 만든다 (mode 변경은 반영되지 않는다)
                  key={step}
                  value={draft}
                  mode={step === 'date' ? 'date' : 'time'}
                  display={step === 'date' ? 'inline' : 'spinner'}
                  accentColor={scheme.primary}
                  // SwiftUI Host는 폭을 안 주면 0이라 보이지도 눌리지도 않는다
                  style={{ width: '100%' }}
                  onValueChange={(_, date) =>
                    setDraft((d) => (step === 'date' ? merge(date, d) : merge(d, date)))
                  }
                />
              ) : null}
            </View>
            <Button
              label={step === 'date' ? '다음' : '완료'}
              onPress={() => {
                if (step === 'date') return setStep('time');
                setOccurredAt(draft);
                setStep(null);
              }}
            />
          </View>
        </BottomSheet>
      ) : step ? (
        <DateTimePicker
          key={step}
          value={draft}
          mode={step === 'date' ? 'date' : 'time'}
          presentation="dialog"
          accentColor={scheme.primary}
          onValueChange={(_, date) => {
            if (step === 'date') {
              setDraft((d) => merge(date, d));
              setStep('time');
              return;
            }
            setOccurredAt(merge(draft, date));
            setStep(null);
          }}
          onDismiss={() => setStep(null)}
        />
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="pl-1 text-xs font-bold text-neutral-500 dark:text-neutral-400">{title}</Text>
      {children}
    </View>
  );
}

/** 그리드 한 칸. 4열이라 폭은 1/4 고정, 높이는 아이콘 줄을 h-8로 잡아 페이지마다 같다. */
function Cell({
  label,
  icon,
  selected,
  dashed,
  onPress,
}: {
  label: string;
  icon: ReactNode;
  selected?: boolean;
  dashed?: boolean;
  onPress: () => void;
}) {
  const { scheme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      // active:는 반드시 Pressable 자신에 둔다. 자식 View에 두면 NativeWind가
      // 그 View에 press 핸들러를 붙여 터치를 가로채고 onPress가 죽는다.
      className="w-1/4 p-1 active:opacity-70"
    >
      <View
        style={{
          backgroundColor: dashed ? 'transparent' : selected ? scheme.primarySoft : scheme.muted,
          borderColor: dashed || selected ? scheme.primary : 'transparent',
        }}
        className={`items-center gap-1 rounded-2xl border-2 py-3 ${dashed ? 'border-dashed' : ''}`}
      >
        <View className="h-8 justify-center">{icon}</View>
        <Text
          numberOfLines={1}
          style={dashed ? { color: scheme.primary } : undefined}
          className="text-xs font-bold text-neutral-700 dark:text-neutral-200"
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function Chip({
  label,
  selected,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  selected?: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const { scheme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={{
        backgroundColor: selected ? scheme.primarySoft : scheme.secondary,
        borderColor: selected ? scheme.primary : 'transparent',
      }}
      className="rounded-full border-2 px-3.5 py-1.5 active:opacity-70"
    >
      <Text className="text-sm font-bold text-neutral-700 dark:text-neutral-200">{label}</Text>
    </Pressable>
  );
}
