import { useEffect } from 'react';
import { Image, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { Screen } from '@/components/ui/screen';
import { useTheme } from '@/hooks/use-theme';

const LOGO = require('../../../assets/images/temp.png');

export function FullScreenLoader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { effectiveScheme, scheme } = useTheme();
  const isDark = effectiveScheme === 'dark';

  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.cubic) }),
      ),
      -1,
      true,
    );
  }, [pulse]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.96, 1.04]) }],
  }));

  const glowRingAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.3, 0.75]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.95, 1.25]) }],
  }));

  return (
    <Screen scroll={false}>
      {/* Background Pastel Radial Gradient */}
      <View className="pointer-events-none absolute inset-0 items-center justify-center">
        <Svg height="100%" width="100%" viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="loaderBgGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <Stop offset="0%" stopColor={scheme.primary} stopOpacity={isDark ? '0.35' : '0.18'} />
              <Stop
                offset="55%"
                stopColor={scheme.primarySoft}
                stopOpacity={isDark ? '0.15' : '0.25'}
              />
              <Stop offset="100%" stopColor={scheme.background} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="200" cy="200" r="200" fill="url(#loaderBgGradient)" />
        </Svg>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        <View className="relative items-center justify-center">
          {/* Animated Glow Ring */}
          <Animated.View
            style={[
              glowRingAnimatedStyle,
              {
                backgroundColor: scheme.primarySoft,
                borderColor: isDark ? scheme.primary + '40' : scheme.primary + '30',
              },
            ]}
            className="absolute h-32 w-32 rounded-full border-2"
          />

          {/* Logo Box Container */}
          <Animated.View style={logoAnimatedStyle} className="relative items-center justify-center">
            <View
              style={{
                backgroundColor: isDark ? scheme.card : '#FFFFFF',
                borderColor: isDark ? scheme.border : scheme.primarySoft,
                shadowColor: scheme.primary,
                shadowOpacity: isDark ? 0.3 : 0.15,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 8 },
                elevation: 10,
              }}
              className="h-24 w-24 items-center justify-center rounded-3xl border p-3"
            >
              <Image source={LOGO} style={{ width: 60, height: 60 }} resizeMode="contain" />
            </View>
          </Animated.View>
        </View>

        {/* Text Details */}
        <View className="mt-8 items-center gap-2">
          <Text
            style={{ color: scheme.foreground }}
            className="text-center text-2xl font-black tracking-tight"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              style={{ color: scheme.mutedForeground }}
              className="text-center text-xs font-semibold leading-relaxed"
            >
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Pulsing Dots Indicator */}
        <View className="mt-6 flex-row items-center gap-2">
          <LoadingDot delay={0} color={scheme.primary} />
          <LoadingDot delay={200} color={scheme.primary} />
          <LoadingDot delay={400} color={scheme.primary} />
        </View>
      </View>
    </Screen>
  );
}

function LoadingDot({ delay, color }: { delay: number; color: string }) {
  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    const timer = setTimeout(() => {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 400, easing: Easing.ease }),
          withTiming(0.6, { duration: 400, easing: Easing.ease }),
        ),
        -1,
        true,
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.ease }),
          withTiming(0.4, { duration: 400, easing: Easing.ease }),
        ),
        -1,
        true,
      );
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[{ backgroundColor: color }, style]}
      className="h-2.5 w-2.5 rounded-full"
    />
  );
}

