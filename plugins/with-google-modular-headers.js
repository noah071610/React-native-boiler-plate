const { withPodfile } = require('@expo/config-plugins');

const pods = [
  "  pod 'GoogleUtilities', :modular_headers => true",
  "  pod 'RecaptchaInterop', :modular_headers => true",
];

function addPods(contents) {
  if (pods.every((pod) => contents.includes(pod))) return contents;

  const next = contents.replace(
    /(target ['"].+?['"] do\s*\n\s*use_expo_modules!\s*\n)/,
    `$1${pods.join('\n')}\n`,
  );

  if (next === contents) {
    throw new Error('Could not add modular Google pods: Podfile target layout changed.');
  }

  return next;
}

module.exports = (config) =>
  withPodfile(config, (config) => {
    config.modResults.contents = addPods(config.modResults.contents);
    return config;
  });
