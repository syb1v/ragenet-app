module.exports = {
  dependencies: {
    // The Android particle renderer uses react-native-svg. Keeping the Skia
    // JSI/CMake build out of the APK avoids a ~20 minute native compile and
    // keeps the GitHub-hosted runner below its resource limits.
    '@shopify/react-native-skia': {
      platforms: {
        android: null,
      },
    },
  },
};
