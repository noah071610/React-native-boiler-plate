import { useEffect, useRef } from 'react';
import { View, type StyleProp, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  /** 이미 포맷이 끝난 문자열 (예: "13,894원") */
  text: string;
  /** 1이면 위에서 아래로, -1이면 아래에서 위로 굴러온다 */
  direction?: number;
  className?: string;
  style?: StyleProp<TextStyle>;
};

/**
 * 값이 바뀐 자리만 굴러 올라가는 카운트 애니메이션.
 * ponytail: 실제 숫자를 보간하지 않고 바뀐 글자만 움직인다 —
 * 자리수가 큰 금액에서 보간은 매 프레임 포맷팅이라 비싸고, 눈에는 똑같이 보인다.
 */
export function AnimatedNumberText({ text, direction = 1, className, style }: Props) {
  return (
    <View className="flex-row items-baseline">
      {text.split('').map((char, index, all) => (
        <AnimatedChar
          key={`${all.length}-${index}`}
          char={char}
          direction={direction}
          className={className}
          style={style}
        />
      ))}
    </View>
  );
}

function AnimatedChar({
  char,
  direction,
  className,
  style,
}: {
  char: string;
  direction: number;
  className?: string;
  style?: StyleProp<TextStyle>;
}) {
  const previous = useRef(char);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (char === previous.current) return;
    previous.current = char;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [char, progress]);

  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.25, 1]),
    transform: [{ translateY: direction * interpolate(progress.value, [0, 1], [14, 0]) }],
  }));

  return (
    <Animated.Text style={[style, animated]} className={className}>
      {char}
    </Animated.Text>
  );
}
