import { ArrowUpDown, ChevronDown } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { flagOfDestination } from '@/constants/currencies';
import { useTheme } from '@/hooks/use-theme';
import { currencyUnit, destinationLabel, useI18n } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { formatAmount } from '@/lib/money';
import { formatRateDate } from '@/lib/rates';

export type PairSide = 'local' | 'base';

type RowProps = {
  currency: string;
  countryCode?: string | null;
  minor: number;
  onPressAmount: () => void;
  onPressCurrency: () => void;
};

function PairRow({ currency, countryCode, minor, onPressAmount, onPressCurrency }: RowProps) {
  const { scheme } = useTheme();
  const { t } = useI18n();
  const unit = currencyUnit(currency, t);
  const countryName = destinationLabel(countryCode, currency, t);

  return (
    <View className="flex-row items-center px-4 py-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('main.changeCurrencyA11y', '{{country}} 통화 변경', {
          country: countryName,
        })}
        onPress={onPressCurrency}
        className="w-36 flex-row items-center gap-2 active:opacity-60"
      >
        <Text className="text-2xl">{flagOfDestination(countryCode, currency)}</Text>
        <View className="flex-1">
          <Text
            numberOfLines={1}
            className="text-sm font-semibold text-neutral-500 dark:text-neutral-400"
          >
            {countryName}
          </Text>
          <View className="flex-row items-center gap-1">
            <Text className="text-base font-bold text-neutral-900 dark:text-neutral-50">
              {currency}
            </Text>
            <ChevronDown size={14} color={scheme.mutedForeground} />
          </View>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('main.openCalculatorA11y', '계산기 열기')}
        onPress={onPressAmount}
        className="flex-1 items-end active:opacity-60"
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          className="text-3xl font-black tracking-tight text-neutral-900 dark:text-neutral-50"
        >
          {formatAmount(minor, currency)}
        </Text>
        <Text className="mt-0.5 text-xs font-semibold text-neutral-400">
          {formatAmount(minor, currency)}
          {unit}
        </Text>
      </Pressable>
    </View>
  );
}

type Props = {
  localCurrency: string;
  localCountryCode?: string | null;
  baseCurrency: string;
  localMinor: number;
  baseMinor: number;
  swapped: boolean;
  rateDate: string | null;
  onSwap: () => void;
  onPressAmount: (side: PairSide) => void;
  onPressCurrency: (side: PairSide) => void;
};

/**
 * §① 통화 페어 카드 — 화면 최상단 고정. 이 앱의 얼굴이다.
 * 배치는 의도적으로 기존 환율 앱들과 동일하다 (원칙 5: 검증된 관용구).
 */
export function CurrencyPairCard({
  localCurrency,
  localCountryCode,
  baseCurrency,
  localMinor,
  baseMinor,
  swapped,
  rateDate,
  onSwap,
  onPressAmount,
  onPressCurrency,
}: Props) {
  const { scheme } = useTheme();
  const { locale, t } = useI18n();
  const top: PairSide = swapped ? 'base' : 'local';
  const bottom: PairSide = swapped ? 'local' : 'base';
  const currencyOf = (side: PairSide) => (side === 'local' ? localCurrency : baseCurrency);
  const countryCodeOf = (side: PairSide) => (side === 'local' ? localCountryCode : null);
  const minorOf = (side: PairSide) => (side === 'local' ? localMinor : baseMinor);

  return (
    <View>
      <View
        style={{ backgroundColor: scheme.card, borderColor: scheme.border }}
        className="overflow-hidden rounded-3xl border"
      >
        <PairRow
          currency={currencyOf(top)}
          countryCode={countryCodeOf(top)}
          minor={minorOf(top)}
          onPressAmount={() => onPressAmount(top)}
          onPressCurrency={() => onPressCurrency(top)}
        />

        <View style={{ backgroundColor: scheme.border }} className="h-px" />

        <PairRow
          currency={currencyOf(bottom)}
          countryCode={countryCodeOf(bottom)}
          minor={minorOf(bottom)}
          onPressAmount={() => onPressAmount(bottom)}
          onPressCurrency={() => onPressCurrency(bottom)}
        />

        {/* 구분선 위에 겹쳐 놓는 스와퍼 — 표준 배치 */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('main.swapCurrencyA11y', '통화 뒤집기')}
          onPress={() => {
            haptics.selection();
            onSwap();
          }}
          style={{ backgroundColor: scheme.primary }}
          className="absolute left-1/2 top-1/2 -ml-5 -mt-5 h-10 w-10 items-center justify-center rounded-full active:opacity-80"
        >
          <ArrowUpDown size={18} color={scheme.primaryForeground} />
        </Pressable>
      </View>

      <Text className="mt-2 pl-1 text-xs font-semibold text-neutral-400">
        {rateDate
          ? t('main.rateDate', '기준: {{date}} 환율', { date: formatRateDate(rateDate, locale) })
          : t('settings.exchangeFallback', '환율을 아직 받지 못했어요')}
      </Text>
    </View>
  );
}
