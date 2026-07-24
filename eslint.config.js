// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'android/*', 'ios/*', 'expo-env.d.ts'],
  },
  {
    // React Compiler preview rules (expo 57) fire on working RN idioms we
    // don't rewrite: reanimated `sharedValue.value =` is reanimated's own API;
    // setState-in-effect covers our async-init / timer / mount-sync patterns;
    // refs covers the latest-callback + animation-direction patterns; purity
    // covers date-derived render values. rules-of-hooks stays on — it catches real bugs.
    rules: {
      'react-hooks/immutability': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/purity': 'off',
    },
  },
]);
