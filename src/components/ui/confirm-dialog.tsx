import { Modal, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { colors } from '@/theme/colors';

type ConfirmDialogAction = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  actions: ConfirmDialogAction[];
  onDismiss: () => void;
};

export function ConfirmDialog({ visible, title, message, actions, onDismiss }: Props) {
  const { effectiveScheme } = useTheme();
  const scheme = colors[effectiveScheme];

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDismiss}>
      <View className="flex-1 items-center justify-center bg-black/45 px-6">
        <Pressable className="absolute inset-0" onPress={onDismiss} />
        <View
          className="w-full max-w-sm rounded-3xl p-5"
          style={{ backgroundColor: scheme.popover }}
        >
          <Text
            className="text-center text-xl font-bold"
            style={{ color: scheme.popoverForeground }}
          >
            {title}
          </Text>
          {message ? (
            <Text className="mt-2 text-center text-base" style={{ color: scheme.mutedForeground }}>
              {message}
            </Text>
          ) : null}

          <View className="mt-5 gap-2">
            {actions.map((action) => {
              const variant = action.variant ?? 'primary';
              const backgroundColor =
                variant === 'destructive'
                  ? scheme.destructive
                  : variant === 'primary'
                    ? scheme.primary
                    : variant === 'secondary'
                      ? scheme.secondary
                      : 'transparent';
              const color =
                variant === 'destructive'
                  ? scheme.destructiveForeground
                  : variant === 'primary'
                    ? scheme.primaryForeground
                    : variant === 'secondary'
                      ? scheme.secondaryForeground
                      : scheme.mutedForeground;

              return (
                <Pressable
                  key={action.label}
                  accessibilityRole="button"
                  className="items-center rounded-2xl px-4 py-3 active:opacity-80"
                  style={{ backgroundColor }}
                  onPress={() => {
                    haptics.selection();
                    onDismiss();
                    action.onPress?.();
                  }}
                >
                  <Text className="text-base font-bold" style={{ color }}>
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}
