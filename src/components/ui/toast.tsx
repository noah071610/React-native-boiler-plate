import { useEffect, useRef } from 'react';
import { Text } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

/** 가벼운 안내 배너. message가 있으면 떠 있다가 duration 뒤 onHide를 부른다. */
export function Toast({
  message,
  duration = 1800,
  onHide,
}: {
  message: string | null;
  duration?: number;
  onHide: () => void;
}) {
  // onHide가 매 렌더 새 함수여도 타이머가 리셋되지 않도록 ref로 고정한다
  const hide = useRef(onHide);
  hide.current = onHide;

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => hide.current(), duration);
    return () => clearTimeout(id);
  }, [message, duration]);

  if (!message) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(140)}
      pointerEvents="none"
      className="absolute inset-x-5 bottom-10 items-center rounded-2xl bg-neutral-900/95 px-4 py-3 dark:bg-neutral-100/95"
    >
      <Text className="text-center text-sm font-semibold text-white dark:text-neutral-900">
        {message}
      </Text>
    </Animated.View>
  );
}
