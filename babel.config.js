module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
    // reanimated/worklets babel plugin is auto-added by babel-preset-expo (SDK 57).
  };
};
