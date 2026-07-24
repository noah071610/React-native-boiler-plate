import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const DURATION = 240;

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 시트 높이를 고정할 때 (예: 'h-[75%]') */
  sheetClassName?: string;
};

/**
 * 하단 시트 공통 레이아웃.
 * RN Modal의 animationType="slide"는 배경(dim)까지 같이 밀어올려서
 * overlay가 아래에서 올라오는 것처럼 보인다. 여기선 배경은 opacity만,
 * 시트만 translateY로 올린다.
 */
export function BottomSheet({ visible, onClose, children, sheetClassName }: Props) {
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) });
      return;
    }
    progress.value = withTiming(
      0,
      { duration: DURATION, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setMounted)(false);
      },
    );
  }, [progress, visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 320 }],
  }));

  return (
    <Modal transparent animationType="none" visible={mounted} onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Animated.View style={backdropStyle} className="absolute inset-0 bg-black/40">
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" className="flex-1" onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={sheetStyle}
          className={sheetClassName ?? ''}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
