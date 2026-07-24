import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/store/settings';

/**
 * Haptics wrapper — no-ops when the user disabled haptics in settings.
 * ALL haptic calls must go through here (see AGENTS.md), never expo-haptics directly.
 */
const enabled = () => useSettingsStore.getState().haptics;

export const haptics = {
  impact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) {
    if (enabled()) void Haptics.impactAsync(style);
  },
  notification(type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success) {
    if (enabled()) void Haptics.notificationAsync(type);
  },
  selection() {
    if (enabled()) void Haptics.selectionAsync();
  },
};

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';
