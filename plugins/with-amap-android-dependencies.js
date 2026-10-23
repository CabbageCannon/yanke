const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

module.exports = function withAmapAndroidDependencies(config) {
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('The AMap dependency plugin expects the Expo Groovy template.');
    }
    if (!config.modResults.contents.includes('net.jafama:jafama:2.3.2')) {
      config.modResults.contents += '\n// AMap 11.2 calls FastMath but omits it from its POM.\ndependencies {\n    implementation("net.jafama:jafama:2.3.2")\n}\n';
    }
    return config;
  });

  return withDangerousMod(config, ['android', async (config) => {
    const rulesPath = path.join(config.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
    const rules = await fs.readFile(rulesPath, 'utf8');
    const optionalClassRule = '-dontwarn com.amap.ams.gnss.GnssSoftLocator';
    if (!rules.includes(optionalClassRule)) {
      // AMap's public adapter sets mini=true; product 12 skips this non-mini soft RTK branch.
      await fs.writeFile(rulesPath, `${rules}\n# AMap 11.2 non-mini soft RTK (see T09 build evidence).\n${optionalClassRule}\n`);
    }
    const noticesDir = path.join(config.modRequest.platformProjectRoot, 'app', 'src', 'main', 'assets', 'third-party');
    await fs.mkdir(noticesDir, { recursive: true });
    await fs.copyFile(path.join(__dirname, '..', 'licenses', 'jafama-2.3.2.txt'), path.join(noticesDir, 'jafama-2.3.2.txt'));
    return config;
  }]);
};
