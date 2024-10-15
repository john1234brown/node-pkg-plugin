# NodePkgPlugin
**NodePkgPlugin is a Webpack plugin that generates single executable applications for multiple platforms (Linux, macOS, Windows) by leveraging Node.js SEA (Single Executable Applications) feature.**
- ***Warning: The Final output binaries will include -hash.txt files if you plan to rename them you must rename the -hash.txt files if not the binaries won't work!***
- ***Which the final output binary name is configurable see further below for more information on this!***

## Installation

To install the plugin, you need to add it to your project dependencies:

```bash
npm install --save-dev node-pkg-plugin
```

## Usage

To use the NodePkgPlugin in your Webpack configuration, follow these steps:

1. **Create a Webpack Configuration File**

  Create a `webpack.config.js` file in the root of your project if you don't already have one.

  ```javascript
  const path = require('path');
  const NodePkgPlugin = require('node-pkg-plugin');

  module.exports = {
     entry: './src/index.js',
     output: {
        filename: 'app.js',
        path: path.resolve(__dirname, 'dist')
     },
     plugins: [
        new NodePkgPlugin('app.js', 'app-', true)//true if using typescript else don't add last parameter defaults to false for CommonJS javascript!
     ]
  };
  ```

2. **Set Up Your Project Structure**

  Ensure your project has the following structure:

  ```
  your-project/
  ├── src/
  │   └── index.js
  ├── dist/
  ├── webpack.config.js
  └── package.json
  ```

3. **Build Your Project**

  Run the Webpack build command to generate the single executable applications:

  ```bash
  npx webpack --config webpack.config.js
  ```

  This will create the executables for Linux, macOS, and Windows in the `dist` directory.

## Configuration

The plugin allows you to specify the input filename and the output filename prefix through its constructor. By default, it uses `app.js` as the input filename and `app-` as the output filename prefix. You can customize these values as shown in the example above.

## External Node Modules

If your project uses external Node modules, ensure your Webpack configuration properly caches all modules. Failing to do so may result in a non-functional binary. For more details, refer to the [Node.js Single Executable Applications documentation](https://nodejs.org/en/docs/guides/single-executable-applications/), also you can refer to the [Webpack documentation on caching](https://webpack.js.org/guides/caching/).

For caching node modules, you can use the `cache` option in your Webpack configuration file like this:

```javascript
module.exports = {
  // other configurations...
  cache: {
  type: 'filesystem', // Enables filesystem caching
  buildDependencies: {
    config: [__filename], // Add your config as a build dependency
  },
  },
};
```

This will cache the node modules and other build dependencies to speed up subsequent builds. For more detailed information, refer to the Webpack caching guide linked above.

## New Features

### TypeScript Support

The plugin now supports TypeScript projects. You can enable TypeScript support by passing `true` as the third parameter to the `NodePkgPlugin` constructor.

### Integrity Checks

The plugin includes built-in integrity checks for both the source code and the binary. This ensures that the generated executables have not been tampered with.

- **Source Integrity Check**: Verifies the integrity of the JavaScript source code.
- **Binary Integrity Check**: Verifies the integrity of the binary executable.

### Example

Here is an example of a simple Webpack project setup:

1. **Initialize a New Node.js Project**

  ```bash
  mkdir my-webpack-project
  cd my-webpack-project
  npm init -y
  ```

2. **Install Webpack and the Plugin**

  ```bash
  npm install --save-dev webpack webpack-cli node-pkg-plugin
  ```

3. **Create the Project Files**

  Create the following files and directories:

  - `src/index.js`:

    ```javascript
    console.log('Hello, World!');
    ```

  - `webpack.config.js`:

    ```javascript
    const path = require('path');
    const NodePkgPlugin = require('node-pkg-plugin');

    module.exports = {
      entry: './src/index.js',
      output: {
         filename: 'app.js',
         path: path.resolve(__dirname, 'dist')
      },
      plugins: [
         new NodePkgPlugin('app.js', 'app-', true)//true if using typescript else don't add last parameter defaults to false for CommonJS javascript!
      ]
    };
    ```

4. **Build the Project**

  ```bash
  npx webpack --config webpack.config.js
  ```

  The `dist` directory will contain the executables for Linux, macOS, and Windows.

## License

This project is licensed under the X11 License. See the LICENSE file for details.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## Contact

For any questions or inquiries, please contact Johnathan Edward Brown at sierrajohn1234brown@gmail.com.

## References

- [Webpack](https://webpack.js.org/)
- [Node.js Single Executable Applications](https://nodejs.org/en/docs/guides/single-executable-applications/)

## Credits
- Githubs Copilot for generated code snippets for webpack examples and project setup included in this README.md
- Author: Johnathan Edward Brown
