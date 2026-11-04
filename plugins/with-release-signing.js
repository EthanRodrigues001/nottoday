const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Signs release builds with the app's own key instead of the debug key. An update only installs over an older
 * version when both are signed with the same key, so this key must never change or be lost.
 *
 * The key is not in the repository: its path and passwords come from the user-level ~/.gradle/gradle.properties
 * (NOTTODAY_STORE_FILE, NOTTODAY_STORE_PASSWORD, NOTTODAY_KEY_ALIAS, NOTTODAY_KEY_PASSWORD). Without them the
 * build falls back to the debug key, so a fresh clone still builds.
 */
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (c) => {
    let gradle = c.modResults.contents;
    if (gradle.includes('nottodayRelease')) return c;
    gradle = gradle.replace(
      /signingConfigs \{/,
      `signingConfigs {
        nottodayRelease {
            if (project.hasProperty('NOTTODAY_STORE_FILE')) {
                storeFile file(NOTTODAY_STORE_FILE)
                storePassword NOTTODAY_STORE_PASSWORD
                keyAlias NOTTODAY_KEY_ALIAS
                keyPassword NOTTODAY_KEY_PASSWORD
            }
        }`,
    );
    gradle = gradle.replace(
      /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig project.hasProperty('NOTTODAY_STORE_FILE') ? signingConfigs.nottodayRelease : signingConfigs.debug",
    );
    c.modResults.contents = gradle;
    return c;
  });
};
