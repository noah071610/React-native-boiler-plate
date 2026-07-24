import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';

/**
 * Generic local + remote notification helpers. No app domain here.
 *
 * - Local scheduling: one-shot (`scheduleAfter`) and weekly (`scheduleWeekly`).
 * - Remote push: `getPushToken` (Expo push token under EAS).
 * - Permission + OS settings helpers.
 *
 * Android channels: create one per notification category with `ensureAndroidChannel`
 * and pass its id when scheduling so importance/vibration apply.
 */

const DEFAULT_CHANNEL_ID = 'default';

// Show banners/sound by default. Pass `data.silent = true` on a notification to
// suppress its banner (e.g. a background timer whose UI is handled in-app).
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const silent = notification.request.content.data?.silent === true;
    return {
      shouldShowBanner: !silent,
      shouldShowList: !silent,
      shouldPlaySound: !silent,
      shouldSetBadge: false,
    };
  },
});

/** Ensure an Android channel exists (no-op on iOS). Call before scheduling on it. */
export async function ensureAndroidChannel(
  channelId: string,
  config: Notifications.NotificationChannelInput,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(channelId, config);
}

/** Prompt for permission if not already granted. Returns whether it's granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  await ensureAndroidChannel(DEFAULT_CHANNEL_ID, {
    name: 'Default',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Current permission status without prompting. */
export async function getPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

async function canShowNotifications(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/** Opens the OS settings page for this app (use when permission is denied). */
export function openSystemSettings(): Promise<void> {
  return Linking.openSettings();
}

type Content = {
  title: string;
  body?: string;
  sound?: boolean;
  /** Arbitrary payload read back on tap / in the handler. */
  data?: Record<string, unknown>;
};

const toContent = (content: Content): Notifications.NotificationContentInput => ({
  title: content.title,
  body: content.body,
  sound: content.sound === false ? undefined : 'default',
  data: content.data ?? {},
});

/**
 * Schedule a one-shot notification `seconds` from now.
 * Returns its id (null if permission denied) — keep it to cancel later.
 */
export async function scheduleAfter(
  seconds: number,
  content: Content,
  channelId?: string,
): Promise<string | null> {
  if (!(await canShowNotifications())) return null;
  return Notifications.scheduleNotificationAsync({
    content: toContent(content),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.ceil(seconds)),
      channelId,
    },
  });
}

/**
 * Schedule a repeating weekly notification.
 * weekday: 1 = Sunday … 7 = Saturday (Expo convention).
 */
export async function scheduleWeekly(
  when: { weekday: number; hour: number; minute: number },
  content: Content,
  channelId?: string,
): Promise<string | null> {
  if (!(await canShowNotifications())) return null;
  return Notifications.scheduleNotificationAsync({
    content: toContent(content),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: when.weekday,
      hour: when.hour,
      minute: when.minute,
      channelId,
    },
  });
}

/** Cancel scheduled notifications by id. Ignores unknown / empty ids. */
export async function cancelNotifications(...ids: (string | null | undefined)[]): Promise<void> {
  await Promise.all(
    ids
      .filter((id): id is string => !!id)
      .map((id) => Notifications.cancelScheduledNotificationAsync(id)),
  );
}

/** Cancel every scheduled local notification. */
export function cancelAllScheduled(): Promise<void> {
  return Notifications.cancelAllScheduledNotificationsAsync();
}

/** Returns the Expo push token, or null if unavailable / denied. */
export async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (!(await requestNotificationPermission())) return null;

  if (Platform.OS === 'android') {
    await ensureAndroidChannel(DEFAULT_CHANNEL_ID, {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // projectId is read from app config (expo.extra.eas.projectId) under EAS.
  const { data } = await Notifications.getExpoPushTokenAsync();
  return data;
}
