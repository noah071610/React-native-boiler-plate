import { MessagesSquare } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** 여행 중 가장 자주 쓰는 세 마디. 번역은 아직 비어 있다. */
const PHRASES = ['얼마예요?', '깎아 주세요', '카드 되나요?'];

/**
 * §⑥ 기본 회화.
 * ponytail: 현지어 데이터가 없어 한국어 문구만 렌더한다.
 * 번역 소스가 정해지면 PHRASES를 통화별 맵으로 바꾸면 된다.
 */
export function PhraseCard() {
  const { scheme } = useTheme();

  return (
    <View
      style={{ backgroundColor: scheme.card, borderColor: scheme.border }}
      className="gap-3 rounded-3xl border p-5"
    >
      <View className="flex-row items-center gap-2">
        <MessagesSquare size={16} color={scheme.mutedForeground} />
        <Text className="text-sm font-bold text-neutral-500 dark:text-neutral-400">기본 회화</Text>
      </View>

      <View className="gap-2">
        {PHRASES.map((phrase) => (
          <View
            key={phrase}
            style={{ backgroundColor: scheme.muted }}
            className="flex-row items-center justify-between rounded-2xl px-4 py-3"
          >
            <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">
              {phrase}
            </Text>
            <Text className="text-base font-semibold text-neutral-400">준비 중</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
