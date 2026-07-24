import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';

const SPRING = { damping: 18, stiffness: 220, mass: 0.7 };
const selectionHaptic = () => haptics.selection();
const noop = () => {};

type Positions = Record<string, number>;

const clampIndex = (index: number, count: number) => {
  'worklet';
  return Math.max(0, Math.min(count - 1, index));
};

// 한 요소를 from→to로 옮길 때 나머지 위치를 한 칸씩 당기고/미는 순수 함수.
const movePosition = (positions: Positions, from: number, to: number) => {
  'worklet';
  const next: Positions = {};
  for (const id in positions) {
    const index = positions[id];
    if (index === undefined) continue;
    if (index === from) next[id] = to;
    else if (from < to && index > from && index <= to) next[id] = index - 1;
    else if (from > to && index >= to && index < from) next[id] = index + 1;
    else next[id] = index;
  }
  return next;
};

/**
 * 길게 눌러 순서 변경 + (선택) 스와이프 액션 리스트. 도메인 없음.
 * 절대배치 + 스프링 재정렬 방식이라 행이 겹치지 않게 rowHeight를 고정으로 준다.
 * 배열(items)이 진실의 원천 — 추가/삭제/이동은 소비자가 items를 바꿔 반영한다.
 *
 * renderRow: 행 내용(보통 onPress를 가진 Pressable). 높이는 rowHeight에 맞춘다.
 * renderRightActions: 왼쪽으로 밀면 나오는 우측 액션. close()로 시트를 닫는다.
 * bleed: 좌우 화면 패딩을 상쇄해 리스트를 끝까지 채우는 음수 마진 값.
 */
export function ReorderableList<T>({
  items,
  keyExtractor,
  rowHeight,
  renderRow,
  renderRightActions,
  onMove,
  onDragChange,
  longPressMs = 500,
  bleed = 20,
  swipeFriction = 1.6,
  rightThreshold = 40,
}: {
  items: T[];
  keyExtractor: (item: T, index: number) => string;
  rowHeight: number;
  renderRow: (item: T, index: number) => ReactNode;
  renderRightActions?: (item: T, index: number, close: () => void) => ReactNode;
  onMove: (from: number, to: number) => void;
  onDragChange?: (dragging: boolean) => void;
  longPressMs?: number;
  bleed?: number;
  swipeFriction?: number;
  rightThreshold?: number;
}) {
  const positions = useSharedValue<Positions>(
    Object.fromEntries(items.map((item, i) => [keyExtractor(item, i), i])),
  );

  // 배열이 바뀌면 위치 맵을 배열 순서에 맞춘다(배열이 진실의 원천).
  useEffect(() => {
    positions.value = Object.fromEntries(items.map((item, i) => [keyExtractor(item, i), i]));
  }, [items, keyExtractor, positions]);

  return (
    <View style={{ height: items.length * rowHeight, marginHorizontal: -bleed }}>
      {items.map((item, index) => {
        const key = keyExtractor(item, index);
        return (
          <Row
            key={key}
            id={key}
            index={index}
            count={items.length}
            rowHeight={rowHeight}
            positions={positions}
            longPressMs={longPressMs}
            swipeFriction={swipeFriction}
            rightThreshold={rightThreshold}
            renderRightActions={
              renderRightActions
                ? (close) => renderRightActions(item, index, close)
                : undefined
            }
            onMove={onMove}
            onDragChange={onDragChange}
          >
            {renderRow(item, index)}
          </Row>
        );
      })}
    </View>
  );
}

function Row({
  id,
  index,
  count,
  rowHeight,
  positions,
  longPressMs,
  swipeFriction,
  rightThreshold,
  renderRightActions,
  onMove,
  onDragChange,
  children,
}: {
  id: string;
  index: number;
  count: number;
  rowHeight: number;
  positions: SharedValue<Positions>;
  longPressMs: number;
  swipeFriction: number;
  rightThreshold: number;
  renderRightActions?: (close: () => void) => ReactNode;
  onMove: (from: number, to: number) => void;
  onDragChange?: (dragging: boolean) => void;
  children: ReactNode;
}) {
  const swipeable = useRef<SwipeableMethods>(null);
  // ponytail: state 대신 shared value — 스와이프 열/닫 때 행 리렌더가 없어야 메뉴가 안 닫힌다
  const swipeOpen = useSharedValue(false);
  const top = useSharedValue(index * rowHeight);
  const startTop = useSharedValue(index * rowHeight);
  const currentIndex = useSharedValue(index);
  const active = useSharedValue(false);
  const changed = onDragChange ?? noop;

  useAnimatedReaction(
    () => positions.value[id] ?? index,
    (position) => {
      if (active.value) return;
      top.value = withSpring(position * rowHeight, SPRING);
    },
  );

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: 0,
    right: 0,
    top: top.value,
    zIndex: active.value ? 10 : 0,
    // ponytail: scale 없음 — 확대하면 스와이프 액션이 화면 밖으로 삐져나온다. 깊이감은 드래그 그림자로만
    shadowColor: '#000',
    shadowOpacity: active.value ? 0.18 : 0,
    shadowRadius: active.value ? 14 : 0,
    shadowOffset: { width: 0, height: 8 },
    elevation: active.value ? 8 : 0,
  }));

  const pan = Gesture.Pan()
    // 요소가 하나면 순서 변경이 무의미 — pan을 꺼서 스와이프를 막지 않게 한다
    .enabled(count > 1)
    .activateAfterLongPress(longPressMs)
    .onStart(() => {
      // 스와이프 메뉴가 열려 있으면 순서 변경 드래그를 막는다
      if (swipeOpen.value) return;
      const position = positions.value[id] ?? index;
      currentIndex.value = position;
      startTop.value = position * rowHeight;
      active.value = true;
      runOnJS(changed)(true);
    })
    .onUpdate((event) => {
      if (!active.value) return;
      top.value = Math.max(0, Math.min((count - 1) * rowHeight, startTop.value + event.translationY));
      const to = clampIndex(Math.round(top.value / rowHeight), count);
      if (to === currentIndex.value) return;
      positions.value = movePosition(positions.value, currentIndex.value, to);
      currentIndex.value = to;
      runOnJS(selectionHaptic)();
    })
    .onFinalize(() => {
      // ponytail: 제스처가 활성화 없이 끝날 수 있다(탭/스크롤) — 그럴 땐 재정렬 skip
      if (!active.value) return;
      top.value = withSpring(currentIndex.value * rowHeight, SPRING);
      active.value = false;
      runOnJS(onMove)(index, currentIndex.value);
      runOnJS(changed)(false);
    });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animatedStyle}>
        {renderRightActions ? (
          <ReanimatedSwipeable
            ref={swipeable}
            friction={swipeFriction}
            rightThreshold={rightThreshold}
            overshootRight={false}
            onSwipeableWillOpen={() => {
              swipeOpen.value = true;
            }}
            onSwipeableWillClose={() => {
              swipeOpen.value = false;
            }}
            renderRightActions={() => renderRightActions(() => swipeable.current?.close())}
          >
            {children}
          </ReanimatedSwipeable>
        ) : (
          children
        )}
      </Animated.View>
    </GestureDetector>
  );
}
