try {
console.log('Hello we are ESM!');
const packageJsonPath = path.resolve(__dirname, 'package.json');
console.log('packageJsonPath', packageJsonPath);
    if (packageJson.type !== 'commonjs') {
        packageJson.type = 'module';
        await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log('Updated package.json to use commonjs');
    }
} catch (e) {
    console.log('Error this is normal the node-pkg-plugin has been converted to ESM please ignore this error and try again. Enjoy!');
}
import { RollupPkgPlugin } from './rollup.mjs';
import { WebpackPkgPlugin as WebpackPkgPluginESM } from './webpack.mjs';

export { WebpackPkgPluginESM };
export default RollupPkgPlugin;