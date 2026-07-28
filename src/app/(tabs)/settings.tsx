import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import {
  ArrowRightLeft,
  CalendarRange,
  ChevronRight,
  Coins,
  Download,
  Globe2,
  Languages,
  Link2Off,
  Mail,
  MapPin,
  Moon,
  Pencil,
  Plane,
  Plus,
  RefreshCw,
  Tags,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountryList } from '@/components/domain/country-list';
import { BudgetSheet } from '@/components/domain/main/budget-sheet';
import { TripForm, TripSheet, type TripSheetResult } from '@/components/domain/main/trip-sheet';
import { CategorySheet } from '@/components/domain/settings/category-sheet';
import { JoinCodeSheet } from '@/components/domain/sync/join-code-sheet';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button, Option } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { PageHeader } from '@/components/ui/page-header';
import { SettingsRow, SettingsSection } from '@/components/ui/settings-section';
import { Toast } from '@/components/ui/toast';
import {
  countryNameOfCurrency,
  findCountryByCurrency,
  flagOfCurrency,
} from '@/constants/currencies';
import { db } from '@/db';
import { expenses, participants, trips, type Trip } from '@/db/schema';
import { localDateKey, useActiveTrip } from '@/hooks/use-active-trip';
import { useTheme } from '@/hooks/use-theme';
import { exportBackup } from '@/lib/backup';
import { createTrip } from '@/lib/create-trip';
import { haptics } from '@/lib/haptics';
import { formatMoney } from '@/lib/money';
import { formatRateDate, useRate } from '@/lib/rates';
import { clearLocalData } from '@/lib/storage';
import { findDuplicates, runSync, unlinkTrip } from '@/lib/sync';
import { sortTripsByRecent } from '@/lib/trip-dates';
import { syncErrorMessage } from '@/services/api/sync';
import { useAppStore } from '@/store/app';
import { useAuthStore } from '@/store/auth';
import { useSettingsStore, type LanguagePreference, type ThemePreference } from '@/store/settings';

/** 열려 있는 시트. 한 번에 하나만 뜬다. */
type Sheet =
  | 'trips'
  | 'newTrip'
  | 'editTrip'
  | 'local'
  | 'base'
  | 'budget'
  | 'language'
  | 'theme'
  | 'categories'
  | 'joinCode';

const SUPPORT_EMAIL = 'noah071610@gmail.com';

const THEMES: { value: ThemePreference; label: string; hint: string }[] = [
  { value: 'system', label: '기기 설정 따르기', hint: '기기가 다크 모드면 같이 어두워져요' },
  { value: 'light', label: '라이트', hint: '항상 밝게' },
  { value: 'dark', label: '다크', hint: '항상 어둡게' },
];

const themeLabel = (value: ThemePreference) =>
  THEMES.find((t) => t.value === value)?.label ?? value;

const LANGUAGES: { value: LanguagePreference; label: string }[] = [
  { value: 'system', label: '기기 설정 따르기' },
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
];

const languageLabel = (value: LanguagePreference) =>
  LANGUAGES.find((l) => l.value === value)?.label ?? value;

const periodLabel = (trip: Trip) => {
  if (!trip.startDate && !trip.endDate) return '미설정';
  const from = trip.startDate ? formatRateDate(trip.startDate) : '?';
  const to = trip.endDate ? formatRateDate(trip.endDate) : '?';
  return `${from} – ${to}`;
};

/**
 * 설정 탭 — 자주 오지 않는 화면이다. 화려할 필요 없이 찾기 쉬우면 된다.
 * 다만 여행 전환 / 새 여행과 백업은 눈에 잘 띄어야 한다 (계정이 없으므로 이 둘이 안전장치다).
 *
 * 만들지 않는 것: 계정 / 알림 / 클라우드 자동 백업.
 */
export default function SettingsScreen() {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const {
    trip,
    trips: aliveTrips,
    baseCurrency,
    localCurrency,
    myParticipantId,
    loading,
  } = useActiveTrip();
  const setHomeCurrency = useAppStore((s) => s.setHomeCurrency);
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const markSynced = useAppStore((s) => s.markSynced);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const resetToOnboarding = useAppStore((s) => s.resetToOnboarding);

  const tripRows = useMemo(() => sortTripsByRecent(aliveTrips), [aliveTrips]);

  const tripId = trip?.id ?? '';
  const participantQuery = useLiveQuery(
    db
      .select()
      .from(participants)
      .where(and(eq(participants.tripId, tripId), isNull(participants.deletedAt))),
    [tripId],
  );
  const participantCount = participantQuery.data?.length ?? 1;
  /** 연동 = 이 여행의 살아있는 참가자가 2명 이상. 상대가 실제로 들어왔다는 뜻이다. */
  const linked = participantCount >= 2;
  /** 코드만 발급한 상태(A)에서도 동기화는 필요하다 — 상대가 언제 들어올지 모른다 */
  const hasShareCode = trip?.shareCode != null;

  const [sheet, setSheet] = useState<Sheet | null>(null);
  /** 삭제 확인 중인 여행. null이면 다이얼로그를 닫는다 */
  const [confirmDelete, setConfirmDelete] = useState<Trip | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  /** 연동 끊기 확인 중 */
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  /** 동기화 진행 중 — 버튼을 두 번 누르지 못하게 막는다 */
  const [syncing, setSyncing] = useState(false);
  /** 초대 코드로 상대를 따라가는 중. 이 사이 로컬 DB가 통째로 갈려서 화면을 덮어둔다 */
  const [joining, setJoining] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  /** 시트에서 고친 여행. 새 여행이면 null */
  const [editing, setEditing] = useState<Trip | null>(null);
  /** 여행 목록 시트 안에서 고치고 있는 여행. 목록 자리에 폼이 그려진다 */
  const [listEditing, setListEditing] = useState<Trip | null>(null);

  const quote = useRate(localCurrency, baseCurrency);

  if (loading) return <FullScreenLoader title="여행을 불러오는 중" />;
  // 로더는 시트 밖(모달 밖)에 있어야 보인다 — 모달 위에 모달을 얹으면 가려진다
  if (joining) {
    return <FullScreenLoader title="동기화 중" subtitle="상대의 여행을 따라가고 있어요" />;
  }

  const closeSheet = () => {
    setSheet(null);
    setListEditing(null);
  };
  const close = closeSheet;
  const soon = (what: string) => {
    haptics.selection();
    setToast(`${what}은 준비 중이에요`);
  };

  /** 여행 추가/수정 시트 열기. trip이 null이면 새로 만드는 것이다. */
  const openTripSheet = (target: Trip | null) => {
    haptics.selection();
    setEditing(target);
    setSheet(target ? 'editTrip' : 'newTrip');
  };

  /**
   * 여행 추가/수정 — 기간 겹침 검사는 폼이 이미 했다 (findOverlap).
   * 수정은 활성 여행이 아니라 목록에서 고른 여행에 적용된다.
   */
  const saveTrip = async (target: Trip | null, result: TripSheetResult) => {
    closeSheet();
    if (target) {
      await db
        .update(trips)
        // 예산은 여기서 안 바꾼다 — 예산 조정 시트(추가/삭감)에서만 바뀐다
        .set({
          destinationCurrency: result.destinationCurrency,
          startDate: result.startDate,
          endDate: result.endDate,
          updatedAt: Date.now(),
        })
        .where(eq(trips.id, target.id));
      setToast('여행을 수정했어요');
      return;
    }

    const country = findCountryByCurrency(result.destinationCurrency);
    if (!country) return;
    await createTrip({
      country,
      baseCurrency,
      startDate: result.startDate,
      endDate: result.endDate,
      budgetAmount: result.budgetMinor,
      budgetCurrency: result.budgetCurrency,
    });
    haptics.notification();
    setToast(`${country.nameKo} 여행을 만들었어요`);
  };

  /** 목적지 통화를 바꿔도 기존 지출의 통화와 스냅샷 환율은 건드리지 않는다 (설정 문서 §여행 설정). */
  const changeCurrency = async (
    field: 'destinationCurrency' | 'baseCurrency',
    currency: string,
  ) => {
    close();
    // 기준 통화는 유저 본인 통화다 — 여행이 없어도 저장된다
    if (field === 'baseCurrency') setHomeCurrency(currency);
    if (trip) {
      await db
        .update(trips)
        .set({ [field]: currency, updatedAt: Date.now() })
        .where(eq(trips.id, trip.id));
    }
    setToast(
      field === 'baseCurrency'
        ? `기준 통화를 ${currency}로 바꿨어요`
        : `목적지를 ${countryNameOfCurrency(currency)}로 바꿨어요`,
    );
  };

  /** 예산만 바꾼다. 기간은 여행 시트에서만 바뀐다 (기간이 활성 여행을 결정하기 때문이다). */
  const saveBudget = async ({
    budgetMinor,
    budgetCurrency,
  }: {
    budgetMinor: number | null;
    budgetCurrency: string;
  }) => {
    close();
    if (!trip) return;
    await db
      .update(trips)
      .set({
        budgetAmount: budgetMinor,
        budgetCurrency: budgetMinor != null ? budgetCurrency : null,
        updatedAt: Date.now(),
      })
      .where(eq(trips.id, trip.id));
  };

  /**
   * 현재 여행 삭제 — tombstone으로만 지운다. 물리 삭제하면 아직 동기화하지 않은
   * 상대 기기에서 그 행이 되살아난다. 상대의 기록은 상대 기기에 그대로 남는다.
   *
   * 다음 여행으로 옮겨줄 필요는 없다 — 활성 여행은 오늘 날짜가 다시 고른다.
   */
  const deleteTrip = async (target: Trip) => {
    const now = Date.now();
    await db
      .update(expenses)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(expenses.tripId, target.id));
    await db
      .update(participants)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(participants.tripId, target.id));
    await db.update(trips).set({ deletedAt: now, updatedAt: now }).where(eq(trips.id, target.id));
    setToast('여행을 삭제했어요');
  };

  /**
   * 초기화 — SQLite 전 테이블 + MMKV + 키체인 토큰을 지운다.
   * 여기서는 tombstone이 아니라 물리 삭제다 (되살릴 상대 기기 기록 자체가 사라진다).
   * onboarded를 마지막에 내려야 한다 — 내리는 순간 라우터가 온보딩으로 튀어 이 화면이 사라진다.
   */
  const resetApp = async () => {
    await clearLocalData();
    useSettingsStore.setState({ theme: 'system', fontScale: 1, language: 'system', haptics: true });
    useAuthStore.setState({ user: null, status: 'unauthenticated' });
    resetToOnboarding();
  };

  const runBackup = async () => {
    haptics.selection();
    try {
      const file = await exportBackup();
      // ponytail: 시스템 공유 시트는 iOS의 RN Share만으로 파일을 넘길 수 있다.
      // 안드로이드도 공유 시트로 보내려면 expo-sharing 추가 + prebuild가 필요하다.
      if (Platform.OS === 'ios') {
        await Share.share({ url: file.uri, title: file.name });
        return;
      }
      setToast(`저장했어요 · ${file.name}`);
    } catch {
      setToast('백업을 만들지 못했어요');
    }
  };

  /**
   * 동기화 — 함께 기록하기 화면까지 들어가지 않고 여기서 바로 돈다 (가장 자주 쓰는 동작).
   * 중복 확인 시트는 여기 두지 않는다. 후보가 있으면 그 사실만 알리고 그 화면으로 보낸다.
   */
  const runSyncNow = async () => {
    if (!trip?.shareCode || !myParticipantId || syncing) return;
    haptics.selection();
    setSyncing(true);
    try {
      const counts = await runSync(trip.shareCode, trip.id, myParticipantId);
      markSynced();
      const pairs = await findDuplicates(trip.id, myParticipantId);
      haptics.notification();
      setToast(
        pairs.length > 0
          ? `${counts.received}건을 가져왔어요 · 비슷한 기록 ${pairs.length}건은 함께 기록하기에서 확인해요`
          : counts.received > 0
            ? `상대 기록 ${counts.received}건을 가져왔어요`
            : '내 기록을 보냈어요. 아직 상대의 새 기록은 없어요.',
      );
    } catch (error) {
      setToast(syncErrorMessage(error));
    } finally {
      setSyncing(false);
    }
  };

  /** 연동 끊기 — 기록은 그대로 두고 오고 감만 멈춘다. */
  const unlink = async () => {
    setConfirmUnlink(false);
    if (!trip || !myParticipantId) return;
    await unlinkTrip(trip, myParticipantId);
    setToast('연동을 끊었어요. 기록은 그대로 남아 있어요.');
  };

  const contact = () => {
    haptics.selection();
    void Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Tabica 문의')}`);
  };

  const budgetText =
    trip?.budgetAmount != null ? formatMoney(trip.budgetAmount, trip.baseCurrency) : '미설정';

  return (
    <View className="flex-1" style={{ backgroundColor: scheme.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
          gap: 24,
        }}
      >
        <PageHeader title="설정" subtitle="여행 관리와 백업" />

        {/* 여행 — 활성 여행은 오늘 날짜가 고른다. 여기서는 만들고 고치기만 한다. */}
        <SettingsSection label={trip ? '지금 여행' : '여행'}>
          <View className="gap-4">
            {trip ? (
              <View className="flex-row items-center gap-3">
                <Text className="text-3xl">{flagOfCurrency(trip.destinationCurrency)}</Text>
                <View className="flex-1">
                  <Text className="text-lg font-black text-neutral-900 dark:text-neutral-50">
                    {trip.name ?? countryNameOfCurrency(trip.destinationCurrency)} ·{' '}
                    {trip.destinationCurrency}
                  </Text>
                  <Text className="mt-0.5 text-xs font-semibold text-neutral-400">
                    {periodLabel(trip)} · 예산 {budgetText} · 참가자 {participantCount}명
                  </Text>
                </View>
              </View>
            ) : (
              <View
                className="flex-row items-center gap-3.5 rounded-2xl border border-dashed p-4"
                style={{
                  borderColor: scheme.border,
                  backgroundColor: `${scheme.primary}0D`,
                }}
              >
                <View
                  className="h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${scheme.primary}1A` }}
                >
                  <Plane size={22} color={scheme.primary} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-bold text-neutral-900 dark:text-neutral-50">
                    아직 등록된 여행이 없어요
                  </Text>
                  <Text className="text-xs font-medium leading-snug text-neutral-400">
                    나라와 기간을 지정하면 그 기간에 맞춰 앱이 바뀌어요
                  </Text>
                </View>
              </View>
            )}
            <View className="flex-row gap-2">
              <View className="flex-1">
                <Button
                  label="여행 목록"
                  size="md"
                  variant="ghost"
                  onPress={() => setSheet('trips')}
                />
              </View>
              <View className="flex-1">
                <Button
                  label="새 여행"
                  size="md"
                  icon={<Plus size={16} color={scheme.primaryForeground} />}
                  onPress={() => openTripSheet(null)}
                />
              </View>
            </View>
          </View>
        </SettingsSection>

        {trip ? (
          <SettingsSection label="여행 설정">
            <View className="gap-4">
              <LinkRow
                icon={<MapPin size={18} color={scheme.primary} />}
                title="목적지 / 통화"
                description="바꿔도 이미 기록한 지출의 환율은 그대로예요"
                value={trip.destinationCurrency}
                onPress={() => setSheet('local')}
              />
              <LinkRow
                icon={<CalendarRange size={18} color={scheme.primary} />}
                title="기간"
                description="다른 여행과 겹치는 기간으로는 바꿀 수 없어요"
                value={periodLabel(trip)}
                onPress={() => openTripSheet(trip)}
              />
              <LinkRow
                icon={<Wallet size={18} color={scheme.primary} />}
                title="예산"
                description="추가하거나 삭감해서 조정해요"
                value={budgetText}
                onPress={() => setSheet('budget')}
              />
            </View>
          </SettingsSection>
        ) : null}

        <SettingsSection label="일반">
          <View className="gap-4">
            <LinkRow
              icon={<Coins size={18} color={scheme.primary} />}
              title="기준 통화"
              description="내 통화예요. 환산 표시만 다시 계산돼요"
              value={baseCurrency}
              onPress={() => setSheet('base')}
            />
            <LinkRow
              icon={<Moon size={18} color={scheme.primary} />}
              title="화면 테마"
              description="기기 설정을 따르거나 항상 밝게/어둡게 고정해요"
              value={themeLabel(theme)}
              onPress={() => setSheet('theme')}
            />
            <LinkRow
              icon={<Languages size={18} color={scheme.primary} />}
              title="언어"
              value={languageLabel(language)}
              onPress={() => setSheet('language')}
            />
            <LinkRow
              icon={<Tags size={18} color={scheme.primary} />}
              title="카테고리 관리"
              onPress={() => setSheet('categories')}
            />
          </View>
        </SettingsSection>

        <SettingsSection label="연결">
          <View className="gap-4">
            {/*
              가장 자주 누를 줄이라 맨 위에 두고 초록으로 띄운다.
              코드를 발급했거나(A) 상대가 들어왔을 때(A↔B)만 존재한다 — 혼자 쓰면 누를 대상이 없다.
            */}
            {hasShareCode || linked ? (
              <LinkRow
                icon={<RefreshCw size={18} color={scheme.success} />}
                title={syncing ? '동기화 중…' : '동기화하기'}
                description={
                  lastSyncAt
                    ? `마지막 동기화 ${formatRateDate(localDateKey(lastSyncAt))}`
                    : '아직 동기화한 적이 없어요'
                }
                emphasis
                onPress={() => void runSyncNow()}
              />
            ) : null}

            <LinkRow
              icon={<Users size={18} color={scheme.primary} />}
              title="함께 기록하기"
              description={
                linked ? '참가자와 초대 코드를 관리해요' : '초대 코드로 둘이 함께 기록해요'
              }
              value={trip ? `${participantCount}명` : undefined}
              onPress={() => router.push('/sync')}
            />

            {/* 이미 연동됐으면 들어갈 방이 없다 — 다른 코드를 넣으면 내 기록이 날아간다 */}
            {linked ? null : (
              <LinkRow
                icon={<UserPlus size={18} color={scheme.primary} />}
                title="초대 코드 입력"
                description="상대에게 받은 코드로 동기화하기"
                onPress={() => {
                  haptics.selection();
                  setSheet('joinCode');
                }}
              />
            )}

            {/* 맨 아래. 기록은 그대로 두고 오고 감만 멈춘다 */}
            {linked ? (
              <LinkRow
                icon={<Link2Off size={18} color={scheme.destructive} />}
                tone="danger"
                title="연동 끊기"
                description="기록은 그대로 남고, 서로의 새 기록만 오가지 않아요"
                onPress={() => {
                  haptics.selection();
                  setConfirmUnlink(true);
                }}
              />
            ) : null}
          </View>
        </SettingsSection>

        <SettingsSection label="데이터">
          <View className="gap-4">
            <LinkRow
              icon={<Download size={18} color={scheme.primary} />}
              title="백업 만들기"
              description="모든 여행과 지출을 파일 하나로 내보내요"
              onPress={() => void runBackup()}
            />
            <LinkRow
              icon={<Upload size={18} color={scheme.primary} />}
              title="백업 불러오기"
              onPress={() => soon('백업 불러오기')}
            />
          </View>
        </SettingsSection>

        <SettingsSection label="위험" tone="danger">
          <View className="gap-4">
            <LinkRow
              icon={<Trash2 size={18} color={scheme.destructive} />}
              tone="danger"
              title="초기화"
              description="모든 여행 · 지출 · 설정이 사라지고 처음 화면으로 돌아가요"
              onPress={() => {
                haptics.selection();
                setConfirmReset(true);
              }}
            />
          </View>
        </SettingsSection>

        <SettingsSection label="정보">
          <View className="gap-4">
            {/* 읽기 전용이다 — 환율은 앱이 알아서 받아온다 (수동 갱신 버튼을 두지 않는다) */}
            <SettingsRow
              icon={<ArrowRightLeft size={18} color={scheme.primary} />}
              title="환율 정보"
              description={
                quote
                  ? `${formatRateDate(quote.date)} 기준 환율을 쓰고 있어요`
                  : '환율을 아직 받지 못했어요'
              }
              right={
                <Text className="text-sm font-bold text-neutral-400">
                  {quote?.fromServer ? '자동 갱신' : '기본값'}
                </Text>
              }
            />
            <SettingsRow
              icon={<Globe2 size={18} color={scheme.primary} />}
              title="버전"
              right={
                <Text className="text-sm font-bold text-neutral-400">
                  {Constants.expoConfig?.version ?? '-'}
                </Text>
              }
            />
            <LinkRow
              icon={<Mail size={18} color={scheme.primary} />}
              title="문의"
              value={SUPPORT_EMAIL}
              onPress={contact}
            />
          </View>
        </SettingsSection>
      </ScrollView>

      <Toast message={toast} onHide={() => setToast(null)} />

      {/* 여행 목록 — 전환 버튼은 없다. 활성 여행은 오늘 날짜가 고른다. */}
      <BottomSheet visible={sheet === 'trips'} onClose={close} sheetClassName="h-[70%]">
        <View
          style={{ backgroundColor: scheme.card, paddingBottom: insets.bottom + 16 }}
          className="flex-1 rounded-t-3xl px-5 pt-6"
        >
          {/* 수정도 이 시트 안에서 한다 — 시트를 겹쳐 띄우면 모달이 화면을 먹는다 */}
          {/*
            목록은 숨기기만 하고 언마운트하지 않는다.
            스와이프 행(worklets)이 애니메이션 도중에 사라지면 runOnJS 콜백이 이미
            풀려난 객체를 건드려 네이티브에서 앱이 죽는다 (reanimated #9776).
          */}
          <View className="flex-1" style={{ display: listEditing ? 'none' : 'flex' }}>
            <Text className="text-xl font-black text-neutral-900 dark:text-neutral-50">
              여행 목록
            </Text>
            <Text className="mb-4 mt-1 text-sm font-semibold text-neutral-400">
              왼쪽으로 밀면 수정하거나 지울 수 있어요. 기간이 오면 그 여행으로 자동으로 바뀌어요.
            </Text>
            {/* 스와이프 액션이 붙는 줄이라 모서리를 굴리지 않는다 — 액션과 줄이 딱 붙어야 한다 */}
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }} className="-mx-5">
              {tripRows.map((item) => (
                <SwipeRow
                  key={item.id}
                  onEdit={() => setListEditing(item)}
                  onDelete={() => {
                    haptics.selection();
                    setConfirmDelete(item);
                  }}
                >
                  <TripRow
                    trip={item}
                    active={item.id === trip?.id}
                    onPress={() => setListEditing(item)}
                  />
                </SwipeRow>
              ))}
            </ScrollView>
          </View>

          {listEditing ? (
            <TripForm
              key={listEditing.id}
              baseCurrency={baseCurrency}
              trips={aliveTrips}
              trip={listEditing}
              onBack={() => setListEditing(null)}
              onSubmit={(result) => void saveTrip(listEditing, result)}
            />
          ) : null}

          {/* 확인 다이얼로그는 이 시트 안에 있어야 시트 위로 뜬다 (카테고리 관리와 같다) */}
          <ConfirmDialog
            visible={confirmDelete != null}
            title={
              confirmDelete
                ? `${countryNameOfCurrency(confirmDelete.destinationCurrency)} 여행을 삭제할까요?`
                : '여행을 삭제할까요?'
            }
            message={
              confirmDelete?.id === trip?.id && participantCount > 1
                ? '이 기기의 기록만 지워져요. 함께 여행한 사람의 기록에는 영향이 없어요.'
                : '이 여행의 지출이 모두 사라져요. 되돌릴 수 없어요.'
            }
            actions={[
              {
                label: '삭제',
                variant: 'destructive',
                onPress: () => confirmDelete && void deleteTrip(confirmDelete),
              },
              { label: '그대로 둘게요', variant: 'ghost' },
            ]}
            onDismiss={() => setConfirmDelete(null)}
          />
        </View>
      </BottomSheet>

      {/* 여행 추가 / 수정 — 나라 · 기간 · 예산을 한 시트에서 받는다 */}
      <TripSheet
        visible={sheet === 'newTrip' || sheet === 'editTrip'}
        baseCurrency={baseCurrency}
        trips={aliveTrips}
        trip={editing}
        onClose={close}
        onSubmit={(result) => void saveTrip(editing, result)}
      />

      {/* 목적지 / 기준 통화 */}
      <BottomSheet
        visible={sheet === 'local' || sheet === 'base'}
        onClose={close}
        sheetClassName="h-[75%]"
      >
        <View
          style={{ backgroundColor: scheme.card, paddingBottom: insets.bottom + 16 }}
          className="flex-1 rounded-t-3xl px-5 pt-6"
        >
          <Text className="mb-4 text-xl font-black text-neutral-900 dark:text-neutral-50">
            {sheet === 'base' ? '기준 통화' : '목적지 / 통화'}
          </Text>
          <CountryList
            selectedCurrency={sheet === 'base' ? baseCurrency : localCurrency}
            onSelect={(country) =>
              void changeCurrency(
                sheet === 'base' ? 'baseCurrency' : 'destinationCurrency',
                country.currency,
              )
            }
          />
        </View>
      </BottomSheet>

      {/* 화면 테마 */}
      <BottomSheet visible={sheet === 'theme'} onClose={close}>
        <View
          style={{ backgroundColor: scheme.card, paddingBottom: insets.bottom + 16 }}
          className="gap-2 rounded-t-3xl px-5 pt-6"
        >
          <Text className="text-xl font-black text-neutral-900 dark:text-neutral-50">
            화면 테마
          </Text>
          <Text className="mb-2 text-sm font-semibold text-neutral-400">바꾸면 바로 적용돼요</Text>
          {THEMES.map((item) => (
            <Option
              key={item.value}
              label={item.label}
              hint={item.hint}
              selected={theme === item.value}
              onPress={() => {
                haptics.selection();
                setTheme(item.value);
                close();
              }}
            />
          ))}
        </View>
      </BottomSheet>

      {/* 언어 */}
      <BottomSheet visible={sheet === 'language'} onClose={close}>
        <View
          style={{ backgroundColor: scheme.card, paddingBottom: insets.bottom + 16 }}
          className="gap-2 rounded-t-3xl px-5 pt-6"
        >
          <Text className="text-xl font-black text-neutral-900 dark:text-neutral-50">언어</Text>
          <Text className="mb-2 text-sm font-semibold text-neutral-400">
            화면 번역은 아직 준비 중이에요. 선택은 저장돼요.
          </Text>
          {LANGUAGES.map((item) => (
            <Option
              key={item.value}
              label={item.label}
              selected={language === item.value}
              onPress={() => {
                setLanguage(item.value);
                close();
              }}
            />
          ))}
        </View>
      </BottomSheet>

      {/* 예산 — 메인의 예산 카드와 같은 입력 화면 (기간은 여행 시트에서 바꾼다) */}
      {trip ? (
        <BudgetSheet
          visible={sheet === 'budget'}
          baseCurrency={trip.baseCurrency}
          localCurrency={trip.destinationCurrency}
          rate={quote?.rate ?? 0}
          budgetAmount={trip.budgetAmount}
          budgetCurrency={trip.budgetCurrency}
          onClose={close}
          onSubmit={saveBudget}
        />
      ) : null}

      <CategorySheet visible={sheet === 'categories'} onClose={close} />

      <JoinCodeSheet
        visible={sheet === 'joinCode'}
        onClose={close}
        onJoinStart={() => setJoining(true)}
        onJoined={() => {
          setJoining(false);
          setToast('상대방과 동기화했습니다.');
        }}
        onError={(message) => {
          setJoining(false);
          setToast(message);
        }}
      />

      {/* 연동 끊기 — 지우는 것이 아니라는 점을 문구가 먼저 말한다 */}
      <ConfirmDialog
        visible={confirmUnlink}
        title="연동을 끊을까요?"
        message="지금까지 쌓인 기록은 전부 그대로 남아요. 앞으로 서로의 새 기록만 오가지 않아요. 다시 함께 기록하려면 초대 코드를 새로 주고받으면 돼요."
        actions={[
          { label: '연동 끊기', variant: 'destructive', onPress: () => void unlink() },
          { label: '그대로 둘게요', variant: 'ghost', onPress: () => setConfirmUnlink(false) },
        ]}
        onDismiss={() => setConfirmUnlink(false)}
      />

      <ConfirmDialog
        visible={confirmReset}
        title="앱을 초기화할까요?"
        message="모든 여행 · 지출 · 참가자 · 설정이 이 기기에서 완전히 사라져요. 되돌릴 수 없으니 먼저 백업을 만들어 두세요."
        actions={[
          { label: '초기화', variant: 'destructive', onPress: () => void resetApp() },
          { label: '그대로 둘게요', variant: 'ghost' },
        ]}
        onDismiss={() => setConfirmReset(false)}
      />
    </View>
  );
}

/**
 * 여행 목록 한 줄. 스와이프 액션과 맞물려야 해서 모서리를 굴리지 않는다.
 * 진행 중인 여행은 테두리 대신 연한 초록 배경으로 표시한다.
 */
function TripRow({ trip, active, onPress }: { trip: Trip; active: boolean; onPress: () => void }) {
  const { scheme, effectiveScheme } = useTheme();
  // 반투명이면 밀었을 때 아래 액션 버튼이 비친다 — 불투명 초록으로 깐다
  const activeBackground = effectiveScheme === 'dark' ? '#14352B' : '#E3F7EE';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${trip.name ?? countryNameOfCurrency(trip.destinationCurrency)} 수정`}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      // 스와이프로 밀었을 때 아래 액션이 비치지 않게 배경을 깐다
      style={{
        backgroundColor: active ? activeBackground : scheme.card,
        borderBottomColor: scheme.border,
      }}
      className="flex-row items-center gap-3 border-b px-5 py-4 active:opacity-70"
    >
      <Text className="text-2xl">{flagOfCurrency(trip.destinationCurrency)}</Text>
      <View className="flex-1">
        <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">
          {trip.name ?? countryNameOfCurrency(trip.destinationCurrency)}
        </Text>
        <Text className="mt-0.5 text-xs font-semibold text-neutral-400">
          {trip.destinationCurrency} · {periodLabel(trip)}
        </Text>
      </View>
      {active ? (
        <Text style={{ color: scheme.success }} className="text-xs font-black">
          진행 중
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * 왼쪽으로 밀면 수정 / 삭제가 나오는 한 줄.
 * 카테고리 목록과 같은 동작이지만 여기는 순서 변경이 없어 ReanimatedSwipeable만 쓴다.
 */
function SwipeRow({
  children,
  onEdit,
  onDelete,
}: {
  children: ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { scheme } = useTheme();

  return (
    <View className="overflow-hidden">
      <ReanimatedSwipeable
        friction={1.6}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={() => (
          <View className="flex-row items-stretch">
            {/*
              close()를 부르지 않는다 — 닫힘 스프링이 도는 동안 화면이 바뀌면
              worklets가 이미 풀려난 콜백을 불러 앱이 죽는다 (reanimated #9776).
              메뉴는 화면이 바뀌거나 다른 줄을 밀 때 알아서 닫힌다.
            */}
            <SwipeAction
              label="수정"
              color={scheme.primary}
              foreground={scheme.primaryForeground}
              Icon={Pencil}
              onPress={onEdit}
            />
            <SwipeAction
              label="삭제"
              color={scheme.destructive}
              foreground={scheme.destructiveForeground}
              Icon={Trash2}
              onPress={onDelete}
            />
          </View>
        )}
      >
        {children}
      </ReanimatedSwipeable>
    </View>
  );
}

function SwipeAction({
  label,
  color,
  foreground,
  Icon,
  onPress,
}: {
  label: string;
  color: string;
  foreground: string;
  Icon: LucideIcon;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ backgroundColor: color }}
      className="w-20 items-center justify-center gap-0.5 active:opacity-70"
    >
      <Icon size={16} color={foreground} />
      <Text style={{ color: foreground }} className="text-xs font-bold">
        {label}
      </Text>
    </Pressable>
  );
}

/** 우측에 값 + 화살표가 붙는 눌리는 설정 한 줄. */
function LinkRow({
  icon,
  title,
  description,
  value,
  tone,
  emphasis,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  value?: string;
  /** 위험 액션이면 'danger' — 아이콘 박스가 붉어진다 */
  tone?: 'default' | 'danger';
  /** 이 섹션에서 가장 자주 누를 줄. 화살표를 초록으로 띄운다 */
  emphasis?: boolean;
  onPress: () => void;
}) {
  const { scheme } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      className="active:opacity-60"
    >
      <SettingsRow
        icon={icon}
        title={title}
        description={description}
        tone={tone}
        right={
          <View className="flex-row items-center gap-1">
            {value ? (
              <Text
                style={emphasis ? { color: scheme.success } : undefined}
                className="text-sm font-bold text-neutral-400"
              >
                {value}
              </Text>
            ) : null}
            <ChevronRight size={18} color={emphasis ? scheme.success : scheme.mutedForeground} />
          </View>
        }
      />
    </Pressable>
  );
}
