import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useTheme } from '@/hooks/use-theme';

import { CategoryManager } from './category-manager';

/**
 * 설정 탭에서 여는 카테고리 관리 — 내용은 CategoryManager가 전부 갖고 있고
 * 여기는 시트로 감싸기만 한다. 빠른 기록에서는 시트 없이 같은 패널을 그대로 쓴다.
 */
export function CategorySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <BottomSheet visible={visible} onClose={onClose} sheetClassName="h-[85%]">
      <View
        style={{ backgroundColor: scheme.card, paddingBottom: insets.bottom + 16 }}
        className="flex-1 rounded-t-3xl px-5 pt-6"
      >
        <CategoryManager onBack={onClose} />
      </View>
    </BottomSheet>
  );
}
