import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useRouter } from 'expo-router';
import { Share2, UserPlus, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DuplicateSheet } from '@/components/domain/sync/duplicate-sheet';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FullScreenLoader } from '@/components/ui/full-screen-loader';
import { SectionHeader } from '@/components/ui/section-header';
import { SettingsRow, SettingsSection } from '@/components/ui/settings-section';
import { SheetLayout } from '@/components/ui/sheet-layout';
import { Toast } from '@/components/ui/toast';
import { db } from '@/db';
import { participants } from '@/db/schema';
import { localDateKey, useActiveTrip } from '@/hooks/use-active-trip';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { formatRateDate } from '@/lib/rates';
import {
  findDuplicates,
  mergeDuplicate,
  renameMe,
  resetShareCode,
  runSync,
  startSharing,
  type DuplicatePair,
} from '@/lib/sync';
import { syncErrorMessage } from '@/services/api/sync';
import { useAppStore } from '@/store/app';

/** 한 번에 하나만 뜨는 시트. */
type Sheet = 'create' | 'rename';

const DEFAULT_NAME = '나';

/**
 * 함께 기록하기 — 이 앱에서 유일하게 네트워크가 반드시 필요한 화면이다 (layout-sync).
 * 실시간 동기화가 아니다. 유저가 버튼을 눌렀을 때만 일어난다.
 *
 * 여기는 **초대하는 쪽**만 다룬다: 내 코드를 발급해 상대를 부르고, 내 기록이 기준이 된다.
 * 남의 코드를 입력해 따라가는 쪽은 설정 → 데이터 → "초대 코드 입력"에 있다.
 * 두 방향을 한 화면에 두면 "내 기록이 사라지는 쪽"을 실수로 누르게 된다.
 *
 * 만들지 않는 것: 로그인 / 접속 상태 표시 / 채팅 / 3인 이상 / 자동 병합 / 푸시.
 */
export default function SyncScreen() {
  const router = useRouter();
  const { scheme } = useTheme();
  const { locale, t } = useI18n();
  const insets = useSafeAreaInsets();

  const { trip, expenses: rows, myParticipantId, loading } = useActiveTrip();
  const lastSyncAt = useAppStore((s) => s.lastSyncAt);
  const markSynced = useAppStore((s) => s.markSynced);

  const tripId = trip?.id ?? '';
  // deps를 넘겨야 여행이 정해진 뒤에 구독이 다시 걸린다. 첫 렌더의 tripId는 ''이라
  // deps가 없으면 명단이 영원히 비고, me가 null이라 코드 만들기 버튼이 조용히 죽는다.
  const participantQuery = useLiveQuery(
    db
      .select()
      .from(participants)
      .where(and(eq(participants.tripId, tripId), isNull(participants.deletedAt))),
    [tripId],
  );
  const participantRows = useMemo(() => participantQuery.data ?? [], [participantQuery.data]);
  const me = participantRows.find((p) => p.id === myParticipantId) ?? null;
  const others = participantRows.filter((p) => p.id !== myParticipantId);
  /** 상대가 실제로 들어왔다. 이 뒤로는 초대에 관한 것들(공유·재발급)이 전부 의미를 잃는다 */
  const linked = others.length > 0;

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /** 코드 재발급 확인 중. 이미 참가한 상대가 있으면 연결이 끊기므로 반드시 묻는다 */
  const [confirmReset, setConfirmReset] = useState(false);
  const [result, setResult] = useState<{ sent: number; received: number } | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [dupIndex, setDupIndex] = useState(0);

  const myExpenseCount = rows.filter((e) => e.authorId === myParticipantId).length;
  const shareCode = trip?.shareCode ?? null;

  if (loading) return <FullScreenLoader title={t('sync.loading', '불러오는 중')} />;

  // 함께 기록할 여행 자체가 없으면 초대 코드도 의미가 없다
  if (!trip) {
    return (
      <View className="flex-1" style={{ backgroundColor: scheme.background }}>
        <SectionHeader
          title={t('settings.recordTogether', '함께 기록하기')}
          onBack={() => router.back()}
        />
        <View className="flex-1 items-center justify-center gap-2 px-10">
          <Text className="text-lg font-black text-neutral-900 dark:text-neutral-50">
            {t('sync.needTripTitle', '먼저 여행을 만들어주세요')}
          </Text>
          <Text
            className="text-center text-sm font-semibold"
            style={{ color: scheme.mutedForeground }}
          >
            {t(
              'sync.needTripDescription',
              '메인의 여행지 추가하기에서 나라와 기간을 정하면 초대할 수 있어요',
            )}
          </Text>
        </View>
      </View>
    );
  }

  const close = () => setSheet(null);
  const fail = (error: unknown) => setToast(syncErrorMessage(error));

  const openSheet = (next: Sheet) => {
    setNameDraft(me && me.name !== DEFAULT_NAME ? me.name : '');
    setSheet(next);
  };

  const name = () => nameDraft.trim() || DEFAULT_NAME;

  /* ---------- 초대하는 쪽 ---------- */

  const create = async () => {
    // 조용히 아무 일도 안 일어나는 것이 제일 나쁘다 — 이유를 말하고 끝낸다
    if (!me) {
      setToast(t('sync.noMe', '내 참가자 정보를 찾지 못했어요. 앱을 다시 열어주세요.'));
      return;
    }
    setBusy(true);
    try {
      const room = await startSharing(trip, me, name());
      close();
      haptics.notification();
      setToast(t('sync.createdCode', '초대 코드 {{code}}를 만들었어요', { code: room.code }));
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  /**
   * 코드 전달은 시스템 공유 시트로 한다 — 실제 경로는 메신저다.
   * ponytail: "복사" 버튼은 두지 않았다. RN에 클립보드가 없어 expo-clipboard(네이티브)를
   * 새로 붙여야 하고, 그러면 prebuild가 필요하다. 공유 시트만으로 목적은 달성된다.
   */
  const shareInvite = () => {
    if (!shareCode) return;
    haptics.selection();
    void Share.share({
      message: t(
        'sync.shareMessage',
        'Tabica 초대 코드: {{code}}\n앱 설정 → 데이터 → 초대 코드 입력에 이 코드를 넣으면 같은 여행을 함께 기록할 수 있어요.',
        { code: shareCode },
      ),
    });
  };

  /** 코드 재발급 — 옛 코드는 죽고, 상대는 다시 참가해야 한다. */
  const reissue = async () => {
    setConfirmReset(false);
    if (!me) return;
    setBusy(true);
    try {
      const room = await resetShareCode(trip, me);
      haptics.notification();
      setToast(t('sync.reissuedCode', '새 초대 코드 {{code}}를 만들었어요', { code: room.code }));
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- 동기화 ---------- */

  const sync = async () => {
    if (!shareCode || !myParticipantId) return;
    setBusy(true);
    try {
      const counts = await runSync(shareCode, trip.id, myParticipantId);
      markSynced();
      // 합친 직후, 유사한 기록을 찾아 유저에게 묻는다 (자동 병합은 하지 않는다)
      setDuplicates(await findDuplicates(trip.id, myParticipantId));
      setDupIndex(0);
      setResult(counts);
      haptics.notification();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const nextDuplicate = () => setDupIndex((i) => i + 1);

  const applyMerge = async () => {
    const pair = duplicates[dupIndex];
    if (!pair) return;
    await mergeDuplicate(pair);
    nextDuplicate();
  };

  const lastSyncText = lastSyncAt
    ? t('settings.lastSync', '마지막 동기화 {{date}}', {
        date: formatRateDate(localDateKey(lastSyncAt), locale),
      })
    : t('settings.notSyncedYet', '아직 동기화한 적이 없어요');

  /** 결과 다이얼로그를 닫은 뒤에 중복 확인을 띄운다 — 한 번에 하나만 묻는다. */
  const showDuplicates = result == null && dupIndex < duplicates.length;

  return (
    <View className="flex-1" style={{ backgroundColor: scheme.background }}>
      <SectionHeader
        title={t('settings.recordTogether', '함께 기록하기')}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
          gap: 24,
        }}
      >
        {shareCode ? (
          <>
            {/* 연동이 끝나면 이 코드는 더 부를 사람이 없다 — 공유·재발급을 전부 내린다.
                끊고 싶으면 설정의 "연동 끊기"가 답이다 (그쪽이 기록을 지키면서 끊는 유일한 길). */}
            <SettingsSection label={t('sync.inviteCode', '초대 코드')}>
              <View className="items-center gap-3">
                <Text className="text-sm font-semibold text-neutral-400">
                  {linked
                    ? t('sync.linkedCodeHint', '이 코드로 함께 기록하고 있어요')
                    : t('sync.sendCodeHint', '아래 코드를 상대에게 보내세요')}
                </Text>
                <View
                  style={{ backgroundColor: scheme.primarySoft }}
                  className="rounded-2xl px-6 py-3"
                >
                  <Text
                    style={{ color: scheme.primary }}
                    className="text-3xl font-black tracking-widest"
                  >
                    {shareCode}
                  </Text>
                </View>
                {linked ? null : (
                  <>
                    <View className="w-full">
                      <Button
                        label={t('sync.share', '공유')}
                        size="md"
                        icon={<Share2 size={16} color={scheme.primaryForeground} />}
                        onPress={shareInvite}
                      />
                    </View>
                    <Text className="text-center text-xs font-semibold text-neutral-400">
                      {t(
                        'sync.codeHelp',
                        '상대가 이 코드를 입력하면\n같은 여행을 함께 기록할 수 있어요',
                      )}
                    </Text>
                  </>
                )}
              </View>
            </SettingsSection>

            <SettingsSection label={t('sync.participants', '참가자')}>
              <View className="gap-4">
                <SettingsRow
                  icon={<Users size={18} color={scheme.primary} />}
                  title={me?.name ?? t('sync.defaultName', DEFAULT_NAME)}
                  description={t('sync.meRecordCount', '나 · 기록 {{count}}건', {
                    count: myExpenseCount,
                  })}
                  right={
                    <Text
                      onPress={() => openSheet('rename')}
                      className="px-1 text-sm font-bold"
                      style={{ color: scheme.primary }}
                    >
                      {t('sync.rename', '이름 바꾸기')}
                    </Text>
                  }
                />
                {/* 강퇴는 만들지 않는다 — 끊고 싶으면 설정의 "연동 끊기"가 같은 일을 하고,
                    그쪽은 서로의 기록을 지우지 않는다는 것을 문구가 보장한다. */}
                {others.map((person) => (
                  <SettingsRow
                    key={person.id}
                    icon={<Users size={18} color={scheme.mutedForeground} />}
                    title={person.name}
                    description={t('sync.recordCount', '기록 {{count}}건', {
                      count: rows.filter((e) => e.authorId === person.id).length,
                    })}
                    active={false}
                  />
                ))}
                {others.length === 0 ? (
                  <Text className="text-xs font-semibold text-neutral-400">
                    {t('sync.waitingParticipant', '상대가 코드를 입력하면 여기에 나타나요')}
                  </Text>
                ) : null}
              </View>
            </SettingsSection>

            <SettingsSection label={t('sync.sync', '동기화')}>
              <View className="gap-4">
                <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                  {lastSyncText}
                </Text>
                <Button
                  label={
                    busy
                      ? t('settings.syncingTitle', '동기화 중…')
                      : t('settings.syncNow', '동기화하기')
                  }
                  disabled={busy}
                  onPress={() => void sync()}
                />
                <Text className="text-center text-xs font-semibold text-neutral-400">
                  {t(
                    'sync.internetHelp',
                    '인터넷 연결이 필요해요. 기록은 연결이 없어도 계속 쌓여요.',
                  )}
                </Text>
              </View>
            </SettingsSection>

            {/* 코드가 새어나갔거나 만료됐을 때. 아직 아무도 안 들어왔을 때만 의미가 있다. */}
            {linked ? null : (
              <View className="items-center">
                <Button
                  label={t('sync.reissueCode', '초대 코드 재발급')}
                  size="md"
                  variant="ghost"
                  disabled={busy}
                  onPress={() => setConfirmReset(true)}
                />
              </View>
            )}
          </>
        ) : (
          <>
            <SettingsSection label={t('settings.recordTogether', '함께 기록하기')}>
              <View className="gap-3">
                <Text className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                  {t(
                    'sync.intro',
                    '초대 코드를 상대방이 받아 입력하면 현재 여행지와 가계부를 공유해요. 그 다음 각자 지출을 기록하고, 동기화하면 서로의 기록을 하나로 합칠 수 있어요.',
                  )}
                </Text>
                <Button
                  label={t('sync.createInviteCode', '초대 코드 만들기')}
                  icon={<UserPlus size={18} color={scheme.primaryForeground} />}
                  onPress={() => openSheet('create')}
                />
              </View>
            </SettingsSection>
            <Text className="px-1 text-xs font-semibold text-neutral-400">
              {t(
                'sync.noAccountHelp',
                '계정을 만들 필요는 없어요. 코드를 가진 사람이 그 여행의 참가자예요.\n반대로 상대에게 코드를 받았다면 설정 → 데이터 → 초대 코드 입력에서 넣으세요.',
              )}
            </Text>
          </>
        )}
      </ScrollView>

      <Toast message={toast} onHide={() => setToast(null)} />

      {/* 이름 — 상대 화면에 이대로 보인다 */}
      <SheetLayout
        visible={sheet === 'create' || sheet === 'rename'}
        onClose={close}
        title={
          sheet === 'rename'
            ? t('sync.myName', '내 이름')
            : t('sync.createInviteCode', '초대 코드 만들기')
        }
        subtitle={t('sync.nameSubtitle', '우선 내 별명을 입력해주세요.')}
        primaryLabel={
          sheet === 'rename' ? t('common.save', '저장') : t('sync.createCode', '코드 만들기')
        }
        primaryDisabled={busy}
        onPrimary={() => {
          if (sheet === 'rename') {
            if (myParticipantId) void renameMe(myParticipantId, name());
            close();
            return;
          }
          void create();
        }}
        secondaryLabel={t('common.cancel', '취소')}
      >
        <NameInput value={nameDraft} onChange={setNameDraft} />
      </SheetLayout>

      {/* 동기화 완료 */}
      <ConfirmDialog
        visible={result != null}
        title={t('sync.doneTitle', '동기화 완료')}
        message={
          result?.received
            ? t(
                'sync.doneReceived',
                '상대 기록 {{received}}건을 가져왔어요\n내 기록 {{sent}}건을 보냈어요',
                { received: result.received, sent: result.sent },
              )
            : t(
                'sync.doneSentOnly',
                '내 기록 {{sent}}건을 보냈어요\n아직 상대의 기록이 없어요. 상대도 동기화하면 서로 반영돼요.',
                { sent: result?.sent ?? 0 },
              )
        }
        actions={[
          {
            label: t('sync.viewTimeline', '타임라인 보기'),
            onPress: () => {
              setResult(null);
              router.push('/timeline');
            },
          },
          { label: t('common.close', '닫기'), variant: 'ghost' },
        ]}
        onDismiss={() => setResult(null)}
      />

      {showDuplicates ? (
        <DuplicateSheet
          pair={duplicates[dupIndex]}
          index={dupIndex}
          total={duplicates.length}
          authorName={others[0]?.name ?? t('timeline.companion', '동행자')}
          myParticipantId={myParticipantId}
          onMerge={() => void applyMerge()}
          onKeepBoth={nextDuplicate}
        />
      ) : null}

      {/* 재발급 = 옛 코드 폐기. 아직 아무도 안 들어온 상태에서만 열린다. */}
      <ConfirmDialog
        visible={confirmReset}
        title={t('sync.reissueTitle', '새 코드를 만들까요?')}
        message={t(
          'sync.reissueMessage',
          '지금 코드는 더 이상 쓸 수 없게 돼요. 코드를 잘못 보냈거나 시간이 오래 지났을 때 쓰세요.',
        )}
        actions={[
          { label: t('sync.createNewCode', '새 코드 만들기'), onPress: () => void reissue() },
          {
            label: t('common.cancel', '취소'),
            variant: 'ghost',
            onPress: () => setConfirmReset(false),
          },
        ]}
        onDismiss={() => setConfirmReset(false)}
      />
    </View>
  );
}

function NameInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      maxLength={12}
      placeholder={t('sync.namePlaceholder', '내 별명 입력')}
      placeholderTextColor={scheme.mutedForeground}
      // 높이는 고정한다. tailwind 크기(text-base)는 lineHeight까지 붙는데, 한 줄짜리
      // TextInput은 값이 있고 없고에 따라 그 줄 상자를 다시 재서 높이가 들쭉날쭉해진다.
      // 카테고리 이름 입력·예산 입력과 같은 처방이다 (fontSize만 직접, 높이는 고정).
      style={{
        color: scheme.foreground,
        borderColor: scheme.border,
        fontSize: 16,
        includeFontPadding: false,
      }}
      className="h-14 rounded-2xl border px-4 font-bold"
    />
  );
}
