import { PartyPopper } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Modal, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/ui/button';

const FIREWORK_COLORS = ['#f97316', '#facc15', '#22c55e', '#38bdf8', '#a78bfa', '#fb7185'];

export function CompletionCelebration({
  visible,
  color,
  onDone,
}: {
  visible: boolean;
  color: string;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const particles = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => {
        const burst = i % 3;
        const angle = ((i % 30) / 30) * Math.PI * 2;
        const distance = 130 + ((i * 19) % 120);
        return {
          id: i,
          x: width * ([0.26, 0.5, 0.74][burst] ?? 0.5),
          y: height * ([0.2, 0.13, 0.22][burst] ?? 0.2),
          dx: Math.cos(angle) * distance,
          dy: Math.sin(angle) * distance,
          delay: 1000 + burst * 420 + (i % 10) * 34,
          size: 8 + (i % 4),
          color: FIREWORK_COLORS[i % FIREWORK_COLORS.length] ?? color,
        };
      }),
    [color, height, width],
  );

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDone}>
      <View className="flex-1 items-center justify-center bg-black/50 px-5">
        {visible
          ? particles.map((particle) => <FireworkParticle key={particle.id} {...particle} />)
          : null}
        <View className="w-full gap-4 rounded-3xl bg-white p-6 dark:bg-neutral-900">
          <View className="items-center gap-3">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
              <PartyPopper size={30} color={color} />
            </View>
            <Text className="text-center text-2xl font-bold text-neutral-900 dark:text-neutral-50">
              온보딩 완료를 축하해요
            </Text>
            <Text className="text-center text-base text-neutral-500 dark:text-neutral-400">
              첫 루틴 준비가 끝났어요. 오늘은 딱 한 세트부터 가볍게 시작해요.
            </Text>
          </View>
          <Button label="좋아요, 시작할게요" onPress={onDone} />
        </View>
      </View>
    </Modal>
  );
}

function FireworkParticle({
  x,
  y,
  dx,
  dy,
  delay,
  size,
  color,
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  delay: number;
  size: number;
  color: string;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.cubic) }),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.12, 0.78, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: progress.value * dx },
      { translateY: progress.value * dy },
      { scale: interpolate(progress.value, [0, 0.2, 1], [0.2, 1, 0.6]) },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: x,
          top: y,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}
