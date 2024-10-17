try {
const fs = require('fs');
const path = require('path');

console.log('Hello we are commmonJS!');
const packageJsonPath = path.resolve(__dirname, 'package.json');
const packageJson = require(packageJsonPath);

if (packageJson.type !== 'commonjs') {
    packageJson.type = 'commonjs';
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('Updated package.json to use commonjs');
}
const { WebpackPkgPlugin } = require('./webpack.cjs');
module.exports = {
  WebpackPkgPlugin
};
}catch(e){
    console.log('Error this is normal the node-pkg-plugin has been converted to commonJS please ignore this error and try again. Enjoy!');
}