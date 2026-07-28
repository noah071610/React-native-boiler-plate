import { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Action = { label: string; onPress: () => void };

/**
 * 가벼운 안내 배너. message가 있으면 떠 있다가 duration 뒤 onHide를 부른다.
 * actions가 있으면 되돌리기 배너가 된다 (그때만 터치를 받는다).
 */
export function Toast({
  message,
  duration = 1800,
  actions,
  onHide,
}: {
  message: string | null;
  duration?: number;
  actions?: Action[];
  onHide: () => void;
}) {
  // onHide가 매 렌더 새 함수여도 타이머가 리셋되지 않도록 ref로 고정한다
  const hide = useRef(onHide);
  hide.current = onHide;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => hide.current(), duration);
    return () => clearTimeout(id);
  }, [message, duration]);

  if (!message) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(180)}
      exiting={FadeOutUp.duration(140)}
      pointerEvents={actions?.length ? 'auto' : 'none'}
      style={{ top: insets.top + 8 }}
      className={`absolute inset-x-5 z-50 rounded-2xl bg-neutral-900/95 px-4 py-3 dark:bg-neutral-100/95 ${
        actions?.length ? 'flex-row items-center gap-3' : 'items-center'
      }`}
    >
      <Text
        className={`text-sm font-semibold text-white dark:text-neutral-900 ${
          actions?.length ? 'flex-1' : 'text-center'
        }`}
      >
        {message}
      </Text>

      {actions?.length ? (
        <View className="flex-row gap-4">
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              hitSlop={8}
              onPress={action.onPress}
              className="active:opacity-60"
            >
              <Text className="text-sm font-black text-white dark:text-neutral-900">
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}
