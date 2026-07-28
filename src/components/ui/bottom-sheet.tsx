import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import Animated, {
  Easing,
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
  /**
   * 입력창이 없는 시트는 꺼야 한다.
   * KeyboardAvoidingView는 자기 프레임을 창 기준으로 재는데, 시트 위에 겹쳐 뜨는
   * 시트(Modal 안의 Modal)에서는 그 측정이 한 박자 늦게 들어온다. 그래서 열린 직후엔
   * 사라진 키보드 높이만큼 아래 여백이 남아 있다가, 아무 곳이나 건드려 레이아웃이
   * 다시 돌면 그제서야 제자리로 올라간다.
   */
  avoidKeyboard?: boolean;
};

/**
 * 하단 시트 공통 레이아웃.
 * RN Modal의 animationType="slide"는 배경(dim)까지 같이 밀어올려서
 * overlay가 아래에서 올라오는 것처럼 보인다. 여기선 배경은 opacity만,
 * 시트만 translateY로 올린다.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  sheetClassName,
  avoidKeyboard = true,
}: Props) {
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) });
      return;
    }
    progress.value = withTiming(0, { duration: DURATION, easing: Easing.in(Easing.cubic) });
    // 언마운트는 JS 타이머가 한다. withTiming 콜백 + runOnJS로 넘기면
    // 애니메이션이 끝나기 전에 시트가 사라진 경우 worklets가 이미 놓아준 함수를
    // UI 스레드에서 다시 부르다 네이티브 assert로 앱이 죽는다 (SIGABRT).
    const timer = setTimeout(() => setMounted(false), DURATION);
    return () => clearTimeout(timer);
  }, [progress, visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 320 }],
  }));

  return (
    <Modal transparent animationType="none" visible={mounted} onRequestClose={onClose}>
      {/* 시트 안의 TextInput이 키보드에 가리지 않게 시트째로 밀어 올린다 */}
      <Frame avoidKeyboard={avoidKeyboard}>
        <Animated.View style={backdropStyle} className="absolute inset-0 bg-black/40">
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" className="flex-1" onPress={onClose} />
        </Animated.View>
        <Animated.View
          style={sheetStyle}
          className={sheetClassName ?? ''}
        >
          {children}
        </Animated.View>
      </Frame>
    </Modal>
  );
}

/** 시트를 바닥에 붙이는 틀. 입력창이 있는 시트에서만 키보드를 피한다. */
function Frame({ avoidKeyboard, children }: { avoidKeyboard: boolean; children: ReactNode }) {
  if (!avoidKeyboard) return <View className="flex-1 justify-end">{children}</View>;
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 justify-end"
    >
      {children}
    </KeyboardAvoidingView>
  );
}
