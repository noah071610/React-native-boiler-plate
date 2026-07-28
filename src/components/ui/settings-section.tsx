import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { colors } from '@/theme/colors';

type Tone = 'default' | 'danger';

/**
 * 설정 화면 카드 섹션 — 대문자 라벨 + 둥근 카드 컨테이너.
 * children으로 SettingsRow(또는 임의 내용)를 담는다. tone="danger"는 위험 액션용 붉은 카드.
 */
export function SettingsSection({
  label,
  tone = 'default',
  children,
}: {
  label: string;
  tone?: Tone;
  children: ReactNode;
}) {
  const danger = tone === 'danger';

  return (
    <View className="gap-2.5">
      <Text
        className={`px-1 text-xs font-extrabold uppercase tracking-wider ${
          danger ? 'text-rose-400 dark:text-rose-500' : 'text-neutral-400 dark:text-neutral-500'
        }`}
      >
        {label}
      </Text>
      <View
        className={
          danger
            ? 'rounded-3xl border border-rose-200/70 bg-rose-50/60 p-4 dark:border-rose-900/50 dark:bg-rose-950/20'
            : 'rounded-3xl border border-neutral-200/80 bg-white p-4 shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900'
        }
      >
        {children}
      </View>
    </View>
  );
}

/**
 * 설정 카드 안의 한 줄 — 아이콘 박스 + 제목/설명 + 우측 슬롯(스위치·버튼 등).
 * active=false면 아이콘 박스를 회색으로 죽인다(비활성 상태 표현).
 */
export function SettingsRow({
  icon,
  title,
  description,
  right,
  active = true,
  tone = 'default',
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  right?: ReactNode;
  active?: boolean;
  /** danger면 아이콘 박스가 붉어진다 (위험 액션) */
  tone?: Tone;
}) {
  const { effectiveScheme } = useTheme();
  const scheme = colors[effectiveScheme];
  const iconBackground = !active
    ? scheme.secondary
    : tone === 'danger'
      ? effectiveScheme === 'dark'
        ? '#4C1D24'
        : '#FEE2E2'
      : scheme.primarySoft;

  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="flex-1 flex-row items-center gap-3">
        {icon ? (
          <View
            style={{ backgroundColor: iconBackground }}
            className="h-10 w-10 items-center justify-center rounded-xl"
          >
            {icon}
          </View>
        ) : null}
        <View className="flex-1">
          <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">{title}</Text>
          {description ? (
            <Text className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
              {description}
            </Text>
          ) : null}
        </View>
      </View>
      {right}
    </View>
  );
}
