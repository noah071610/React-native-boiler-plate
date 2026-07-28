import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Fragment, useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SheetLayout } from '@/components/ui/sheet-layout';
import { db } from '@/db';
import { expenses } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { joinSharedTrip, runSync } from '@/lib/sync';
import { MAX_PARTICIPANTS, getRoom, syncErrorMessage, type SyncRoom } from '@/services/api/sync';
import { useAppStore } from '@/store/app';

/** 서버가 발급하는 코드는 `THB-7F2A` — 통화 3자 + 난수 4자다. 대시는 화면이 그린다. */
const PREFIX_LENGTH = 3;
const CODE_LENGTH = 7;

/**
 * 영숫자만 남긴다(대시·공백은 버린다). 난수 4자리는 서버가 헷갈리는 글자(I·O·0·1)를 빼고
 * 뽑지만, 여기서 그 글자들을 막으면 안 된다 — 앞 3자는 통화 코드라 IDR·COP처럼 I와 O가 온다.
 */
const CODE_CHARS = /[^A-Z0-9]/g;

const sanitizeCode = (text: string) =>
  text.toUpperCase().replace(CODE_CHARS, '').slice(0, CODE_LENGTH);

/** 화면이 들고 있는 값은 대시 없는 7자다. 서버에 보낼 때만 대시를 끼운다. */
const formatCode = (raw: string) => `${raw.slice(0, PREFIX_LENGTH)}-${raw.slice(PREFIX_LENGTH)}`;

/**
 * 초대 코드 입력 — 남에게 받은 코드로 그 사람의 여행을 **따라간다**.
 *
 * 방향이 둘이라 화면도 둘이다:
 *   - 초대 코드 만들기 (함께 기록하기 화면) — 내 코드를 발급해 상대를 부른다. 내 기록이 기준이 된다.
 *   - 초대 코드 입력   (여기)             — 남의 코드를 넣어 그쪽으로 넘어간다. 내 기록은 사라진다.
 *
 * 그래서 참가 직전에 반드시 되돌릴 수 없다는 것을 알린다. 기록이 있으면 경고를 더 세게 한다.
 */
export function JoinCodeSheet({
  visible,
  onClose,
  onJoinStart,
  onJoined,
  onError,
}: {
  visible: boolean;
  onClose: () => void;
  /**
   * 참가를 시작했다. 시트는 이미 닫혔고, 로딩 화면은 호출부가 띄운다 —
   * 시트(Modal) 안에서 전체 화면 로더를 띄우면 모달이 모달을 덮는 꼴이 되어 안 보인다.
   */
  onJoinStart: () => void;
  /** 참가 + 첫 동기화까지 끝났다. 화면 전환은 호출부가 정한다 */
  onJoined: () => void;
  onError: (message: string) => void;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  const markSynced = useAppStore((state) => state.markSynced);

  const expenseQuery = useLiveQuery(db.select().from(expenses).where(isNull(expenses.deletedAt)));
  const myExpenseCount = expenseQuery.data?.length ?? 0;

  const [codeDraft, setCodeDraft] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [busy, setBusy] = useState(false);
  /** 확인한 방. 경고에 답할 때까지 여기 들고 있는다 */
  const [pending, setPending] = useState<SyncRoom | null>(null);

  const name = () => nameDraft.trim() || t('sync.defaultName', '나');

  const close = () => {
    setCodeDraft('');
    setNameDraft('');
    setPending(null);
    onClose();
  };

  /** 코드가 실제로 있는 방인지 먼저 확인한다 — 경고를 띄우기 전에 확정되어야 한다. */
  const lookup = async () => {
    if (codeDraft.length < CODE_LENGTH) return;
    const code = formatCode(codeDraft);
    setBusy(true);
    try {
      const room = await getRoom(code);
      if (room.participants.length >= MAX_PARTICIPANTS) {
        onError(t('sync.roomFull', '이미 두 명이 함께 기록하고 있는 여행이에요'));
        return;
      }
      setPending(room);
    } catch (error) {
      onError(syncErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  /**
   * 참가 = 상대를 따라가기. 시트를 먼저 닫고 로딩을 띄운 뒤에 돈다 —
   * 이 사이에 로컬 DB가 통째로 갈리므로 화면이 중간 상태를 보여주면 안 된다.
   */
  const join = async () => {
    const room = pending;
    if (!room) return;
    const myName = name();
    setPending(null);
    close();
    onJoinStart();

    try {
      const me = await joinSharedTrip(room, myName);
      // 이어서 바로 한 번 합친다 — 참가만으로는 상대의 지출이 오지 않는다
      try {
        await runSync(room.code, me.tripId, me.participantId);
        markSynced();
      } catch (error) {
        // 참가를 되돌릴 이유는 아니다 (여행은 이미 따라갔다). 다만 조용히 넘기면
        // "여행은 왔는데 가계부만 비어 있는" 화면을 유저가 이유도 모른 채 본다.
        onError(
          t('sync.retrySyncAfterJoin', '{{message}} 함께 기록하기에서 동기화를 다시 눌러주세요.', {
            message: syncErrorMessage(error),
          }),
        );
        return;
      }
      haptics.notification();
      onJoined();
    } catch (error) {
      onError(syncErrorMessage(error));
    }
  };

  return (
    <SheetLayout
      visible={visible}
      onClose={close}
      title={t('settings.joinCode', '초대 코드 입력')}
      subtitle={t(
        'sync.joinCodeSubtitle',
        '상대에게 받은 코드를 넣으면 그 사람의 여행으로 넘어가요',
      )}
      primaryLabel={busy ? t('sync.checking', '확인 중…') : t('sync.join', '참가하기')}
      primaryDisabled={busy || codeDraft.length < CODE_LENGTH || nameDraft.trim().length === 0}
      onPrimary={() => void lookup()}
      secondaryLabel={t('common.cancel', '취소')}
    >
      <View className="gap-3">
        <CodeInput value={codeDraft} onChange={setCodeDraft} autoFocus={visible} />
        <TextInput
          value={nameDraft}
          onChangeText={setNameDraft}
          maxLength={12}
          placeholder={t('sync.namePlaceholder', '내 별명 입력')}
          placeholderTextColor={scheme.mutedForeground}
          accessibilityLabel={t('sync.myName', '내 이름')}
          style={{
            color: scheme.foreground,
            borderColor: scheme.border,
            fontSize: 16,
            includeFontPadding: false,
          }}
          className="h-14 rounded-2xl border px-4 font-bold"
        />
      </View>

      {/*
        되돌릴 수 없는 지점. 참가는 "상대를 따라간다"는 뜻이고 이 기기의 기록은 사라진다.
        내 기록을 지키려면 방향을 뒤집어야 한다는 것까지 여기서 말해준다.
      */}
      <ConfirmDialog
        visible={pending != null}
        title={
          myExpenseCount > 0
            ? t('sync.deviceRecordsWillDisappear', '이 기기의 기록이 전부 사라져요')
            : t('sync.followUserTitle', '이 사용자를 따라갈까요?')
        }
        message={
          myExpenseCount > 0
            ? t(
                'sync.joinWarningWithRecords',
                '참가하면 이 기기의 여행과 지출 {{count}}건이 모두 삭제되고, 코드를 보낸 사람의 여행을 따라가요. 되돌릴 수 없어요.\n\n내 기록을 그대로 두고 싶다면 반대로 하세요 — 내가 초대 코드를 만들어 상대에게 보내면 상대가 나를 따라와요.',
                { count: myExpenseCount },
              )
            : t(
                'sync.joinWarningEmpty',
                '코드를 보낸 사람의 데이터로 동기화됩니다. 되돌릴 수 없어요.',
              )
        }
        actions={[
          {
            label:
              myExpenseCount > 0
                ? t('sync.deleteAndJoin', '지우고 참가하기')
                : t('sync.join', '참가하기'),
            variant: myExpenseCount > 0 ? 'destructive' : 'primary',
            onPress: () => void join(),
          },
          { label: t('common.cancel', '취소'), variant: 'ghost', onPress: () => setPending(null) },
        ]}
        onDismiss={() => setPending(null)}
      />
    </SheetLayout>
  );
}

/**
 * 코드 한 글자씩 칸에 들어가는 입력 (shadcn input-otp와 같은 모양).
 *
 * 칸이 여러 개로 보이지만 입력은 **투명한 TextInput 하나**다. 칸마다 입력을 두면
 * 지우기·붙여넣기·자동완성이 전부 손으로 짠 포커스 이동에 걸린다. 하나면 붙여넣기가
 * 그냥 되고(`THB-7F2A`를 통째로 넣어도 대시가 걸러진다), 백스페이스도 공짜다.
 */
function CodeInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
}) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);

  // 시트가 열릴 때 키보드를 바로 올린다. 코드를 넣으러 들어온 화면이라 그게 유일한 다음 동작이다.
  useEffect(() => {
    if (!autoFocus) return;
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  const slots = Array.from({ length: CODE_LENGTH }, (_, i) => i);
  // 다 채우면 커서를 마지막 칸에 붙여둔다 — 빈 칸이 없는데 커서만 허공에 뜨면 어색하다
  const caretAt = Math.min(value.length, CODE_LENGTH - 1);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('settings.joinCode', '초대 코드 입력')}
      onPress={() => inputRef.current?.focus()}
      // 칸 너비를 고정하지 않는다 — 7칸 + 대시는 작은 화면(SE)에서 가로를 넘긴다
      className="w-full flex-row items-center gap-1.5"
    >
      {slots.map((index) => (
        <Fragment key={index}>
          {index === PREFIX_LENGTH ? (
            <Text className="text-lg font-black" style={{ color: scheme.mutedForeground }}>
              -
            </Text>
          ) : null}
          <Slot
            char={value[index] ?? ''}
            active={focused && index === caretAt}
            showCaret={focused && index === value.length}
          />
        </Fragment>
      ))}

      {/*
        진짜 입력. 칸 위에 겹쳐 깔고 투명하게 만든다 — 보이지 않아도 터치와 키보드는 받는다.
        `caretHidden`이 아니면 iOS에서 시스템 커서가 칸 밖에 얹혀 보인다.
      */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(sanitizeCode(text))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={CODE_LENGTH}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        caretHidden
        keyboardType="visible-password"
        className="absolute inset-0 opacity-0"
      />
    </Pressable>
  );
}

/** 칸 하나. 값이 있으면 글자, 커서 자리면 깜빡이는 막대. */
function Slot({ char, active, showCaret }: { char: string; active: boolean; showCaret: boolean }) {
  const { scheme } = useTheme();

  return (
    <View
      style={{
        borderColor: active ? scheme.primary : scheme.border,
        backgroundColor: scheme.muted,
        borderWidth: active ? 2 : 1,
      }}
      className="h-14 flex-1 items-center justify-center rounded-xl"
    >
      {showCaret ? (
        <Caret color={scheme.primary} />
      ) : (
        <Text style={{ color: scheme.foreground, fontSize: 20 }} className="font-black">
          {char}
        </Text>
      )}
    </View>
  );
}

/** 깜빡이는 커서. 텍스트 커서처럼 보여야 해서 1초 주기로 켜고 끈다. */
function Caret({ color }: { color: string }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0, { duration: 500 }), -1, true);
  }, [opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[{ backgroundColor: color }, style]} className="h-6 w-0.5" />;
}
