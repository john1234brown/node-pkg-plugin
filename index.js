/* Author: Johnathan Edward Brown
 * Date: 2024-10-16
 * Description: This is a webpack plugin that creates a single executable application from a Node.js application.
 * The plugin uses the SEA toolchain to create a single executable application for Linux, macOS, and Windows.
 * The plugin also generates a hash of the JavaScript source code and the binary for verification purposes.
 * The plugin also includes a tamper.js file that can be used to tamper with the JavaScript source code.
 * The plugin also includes a tamperBinary.js file that can be used to tamper with the binary.
 * The plugin uses the postject tool to inject the SEA blob into the binary.
 * The plugin uses the codesign tool to sign the binary on macOS.
 * The plugin uses the unlink tool to remove the signature of the binary on macOS.
 * License: X11
 */
class WebpackPkgPlugin {

  constructor(
    fileName = "app.js",
    outputFileName = "app",
    typescript = false
  ) {
    this.fileName = fileName;
    this.outputFilename = outputFileName + "-";
    this.typescript = typescript;

    if (this.typescript) {
      this.tamperFile = "tamperTs/tamper.ts";
      this.tamperBinaryFile = "tamperTs/tamperBinary.ts";
    } else {
      this.tamperFile = "tamperJs/tamper.js";
      this.tamperBinaryFile = "tamperJs/tamperBinary.js";
    }
    try {
    if (PluginType.esModules) {
      this.importModules();
    } else if (require !== undefined) {
      this.path = require("path");
      this.fs = require("fs");
      this.crypto = require("crypto");
      this.spawn = require("child_process").spawn;
    }}catch(e){this.importModules();}
  }

  async importModules() {
    this.path = await import("path");
    this.fs = await import("fs");
    this.crypto = await import("crypto");
    this.spawn = (await import("child_process")).spawn;
  }

  async apply(compiler) {
    await this.importModules();
    // Update the entry to include the tamper.js file
    compiler.hooks.beforeCompile.tapPromise("WebpackPkgPlugin", async () => {
      const tamperFilePath = this.path.resolve(__dirname, this.tamperFile);

      // Read the tamper.js file
      let tamperContent = await this.fs.promises.readFile(
        tamperFilePath,
        "utf8"
      );

      // Replace references to the correct file names
      tamperContent = tamperContent.replace(
        /getAsset\('app\.js'\)/g,
        `getAsset('${this.fileName}')`
      );

      // Write the updated content back to the tamper.js file
      await this.fs.promises.writeFile(tamperFilePath, tamperContent, "utf8");

      async function updateEntries(t) {
        console.log("Original Entry:", compiler.options.entry); // Debug statement

        console.log("Additional Entries:", t.tamperFile); // Debug statement
        const tamperFilePath = t.path.resolve(__dirname, t.tamperFile);
        const tamperBinaryFilePath = t.path.resolve(
          __dirname,
          t.tamperBinaryFile
        );

        const entry = compiler.options.entry;

        if (typeof entry === "string") {
          compiler.options.entry = [
            tamperFilePath,
            tamperBinaryFilePath,
            entry,
          ];
        } else if (Array.isArray(entry)) {
          compiler.options.entry = [
            tamperFilePath,
            tamperBinaryFilePath,
            ...entry,
          ];
        } else if (typeof entry === "object") {
          for (const key in entry) {
            if (Array.isArray(entry[key].import)) {
              entry[key].import = [
                tamperFilePath,
                tamperBinaryFilePath,
                ...entry[key].import,
              ];
            } else {
              entry[key].import = [
                tamperFilePath,
                tamperBinaryFilePath,
                entry[key].import,
              ];
            }
          }
          compiler.options.entry = entry;
        }

        console.log("Modified Entry:", compiler.options.entry); // Debug statement
      }

      // Update the entry to include the tamper.js file
      await updateEntries(this);
    });

    compiler.hooks.afterEmit.tapPromise("WebpackPkgPlugin", async () => {
      const outputPath = this.path.resolve(
        compiler.options.output.path,
        this.fileName
      );

      // Generate hash of the JavaScript source code
      const sourceCode = await this.fs.promises.readFile(outputPath, "utf8");
      const sourceHash = this.crypto
        .createHash("sha256")
        .update(sourceCode)
        .digest("hex");

      // Write the hash to a file
      const hashFilePath = this.path.resolve(
        compiler.options.output.path,
        "hash.txt"
      );
      await this.fs.promises.writeFile(hashFilePath, sourceHash, "utf8");

      // Define the target platforms
      const targets = ["linux", "macos", "win"];

      try {
        for (const target of targets) {
          const seaConfigPath = this.path.resolve(
            compiler.options.output.path,
            "sea-config.json"
          );
          const seaPrepBlobPath = this.path.resolve(
            compiler.options.output.path,
            "sea-prep.blob"
          );
          const nodeBinaryPath = this.path.resolve(
            compiler.options.output.path,
            "node-" + target
          );
          const finalBinaryPath = this.path.resolve(
            compiler.options.output.path,
            this.outputFilename + target
          );

          // Create SEA configuration
          const seaConfig = {
            main: outputPath,
            output: seaPrepBlobPath,
            assets: {
              "app.js": outputPath,
              "hash.txt": hashFilePath,
            },
          };
          await this.fs.promises.writeFile(
            seaConfigPath,
            JSON.stringify(seaConfig)
          );

          // Generate the blob to be injected
          await new Promise((resolve, reject) => {
            const seaProcess = this.spawn("node", [
              "--experimental-sea-config",
              seaConfigPath,
            ]);

            seaProcess.stdout.on("data", (data) => {
              console.log(
                "SEA blob generation successful for target " +
                  target +
                  "! " +
                  data
              );
            });

            seaProcess.stderr.on("data", (data) => {
              console.error(
                "SEA blob generation error for target " + target + ": " + data
              );
            });

            seaProcess.on("close", (code) => {
              if (code !== 0) {
                reject(
                  "SEA blob generation failed for target " +
                    target +
                    " with code " +
                    code
                );
              } else {
                resolve();
              }
            });
          });

          // Create a copy of the node executable
          await new Promise((resolve, reject) => {
            const copyCommand =
              process.platform === "win32"
                ? "node -e \"require('fs').copyFileSync(process.execPath, '" +
                  nodeBinaryPath +
                  ".exe')\""
                : "cp $(command -v node) " + nodeBinaryPath;

            const copyProcess = this.spawn(copyCommand, {
              shell: true,
            });

            copyProcess.stdout.on("data", (data) => {
              console.log(
                "Node.js binary copy successful for target " +
                  target +
                  "! " +
                  data
              );
            });

            copyProcess.stderr.on("data", (data) => {
              console.error(
                "Node.js binary copy error for target " + target + ": " + data
              );
            });

            copyProcess.on("close", (code) => {
              if (code !== 0) {
                reject(
                  "Node.js binary copy failed for target " +
                    target +
                    " with code " +
                    code
                );
              } else {
                resolve();
              }
            });
          });

          // Remove the signature of the binary (macOS only)
          if (process.platform === "darwin") {
            await new Promise((resolve, reject) => {
              const removeSignatureProcess = this.spawn("codesign", [
                "--remove-signature",
                nodeBinaryPath,
              ]);

              removeSignatureProcess.stdout.on("data", (data) => {
                console.log(
                  "Removing signature successful for target " +
                    target +
                    "! " +
                    data
                );
              });

              removeSignatureProcess.stderr.on("data", (data) => {
                console.error(
                  "Removing signature error for target " + target + ": " + data
                );
              });

              removeSignatureProcess.on("close", (code) => {
                if (code !== 0) {
                  reject(
                    "Removing signature failed for target " +
                      target +
                      " with code " +
                      code
                  );
                } else {
                  resolve();
                }
              });
            });
          }

          // Inject the blob into the copied binary
          await new Promise((resolve, reject) => {
            let postjectCommand = "npx postject " + nodeBinaryPath;
            if (process.platform === "win32") {
              postjectCommand += ".exe";
            }
            postjectCommand +=
              " NODE_SEA_BLOB " +
              seaPrepBlobPath +
              " --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

            if (process.platform === "darwin") {
              postjectCommand += " --macho-segment-name NODE_SEA";
            }

            const postjectProcess = this.spawn(postjectCommand, {
              shell: true,
            });

            postjectProcess.stdout.on("data", (data) => {
              console.log(
                "Blob injection successful for target " + target + "! " + data
              );
            });

            postjectProcess.stderr.on("data", (data) => {
              console.error(
                "Blob injection error for target " + target + ": " + data
              );
            });

            postjectProcess.on("close", (code) => {
              if (code !== 0) {
                reject(
                  "Blob injection failed for target " +
                    target +
                    " with code " +
                    code
                );
              } else {
                resolve();
              }
            });
          });

          // Sign the binary (macOS only)
          if (process.platform === "darwin") {
            await new Promise((resolve, reject) => {
              const signProcess = this.spawn("codesign", [
                "--sign",
                "-",
                nodeBinaryPath,
              ]);

              signProcess.stdout.on("data", (data) => {
                console.log(
                  "Signing binary successful for target " + target + "! " + data
                );
              });

              signProcess.stderr.on("data", (data) => {
                console.error(
                  "Signing binary error for target " + target + ": " + data
                );
              });

              signProcess.on("close", (code) => {
                if (code !== 0) {
                  reject(
                    "Signing binary failed for target " +
                      target +
                      " with code " +
                      code
                  );
                } else {
                  resolve();
                }
              });
            });
          }

          // Rename the final binary
          this.fs.renameSync(nodeBinaryPath, finalBinaryPath);

          // Generate hash of the binary
          const binaryContent = this.fs.readFileSync(finalBinaryPath);
          const hash = this.crypto
            .createHash("sha256")
            .update(binaryContent)
            .digest("hex");

          // Write the hash to a file in the libs folder
          const binaryHashFilePath = this.path.resolve(
            compiler.options.output.path,
            this.path.basename(finalBinaryPath) + "-hash.txt"
          );
          this.fs.writeFileSync(binaryHashFilePath, hash);
        }
      } catch (error) {
        console.error("Node.js single executable creation failed!", error);
      }
    });
  }
}

class RollupPkgPlugin {
  constructor(    
    fileName = "app.js",
    outputFileName = "app",
    typescript = false,
    outputDir,
  ) {
    this.fileName = fileName;
    this.outputFileName = outputFileName;
    this.typescript = typescript;
    this.tamperFile = typescript ? "tamper.ts" : "tamper.js";
    this.tamperBinaryFile = typescript ? "tamperBinary.ts" : "tamperBinary.js";
    this.outputDir = outputDir ? outputDir : undefined;
  }

  async importModules() {
    this.path = await import("path");
    this.fs = await import("fs");
    this.crypto = await import("crypto");
    this.spawn = (await import("child_process")).spawn;
  }

  async buildStart(i) {
    console.log(i);
    console.log('I,', i.input);
    await this.importModules();
    this.__dirname = new URL('.', import.meta.url).pathname;
    const tamperFilePath = this.path.resolve(this.__dirname, this.typescript?'tamperTs':'tamperJs', this.tamperFile);

    // Read the tamper.js file
    let tamperContent = await this.fs.promises.readFile(tamperFilePath, "utf8");

    // Replace references to the correct file names
    tamperContent = tamperContent.replace(
      /getAsset\('app\.js'\)/g,
      `getAsset('${this.fileName}')`
    );

    // Write the updated content back to the tamper.js file
    await this.fs.promises.writeFile(tamperFilePath, tamperContent, 'utf8');
    const directoryToBundle = this.path.join(this.__dirname, this.typescript ? 'tamperTs' : 'tamperJs');
    const files = await this.fs.promises.readdir(directoryToBundle);
    files.forEach((file) => {
      const filePath = ('./npm_modules/node-pkg-plugin/' + (this.typescript ? 'tamperTs/' : 'tamperJs/')+ file);
      const filePath2 = this.path.join(directoryToBundle, file);
      // Check if the file is a script (e.g., has a .js extension)
      if (this.path.extname(filePath) === '.js' || this.path.extname(filePath) === '.ts') {
        console.log('Adding file to input:', filePath);
        i.input.push(filePath2);
      }
    });
    console.log('Input:', i.input);
  }

  async generateBundle(outputOptions, bundle) {
    await this.importModules();
    this.__dirname = new URL('.', import.meta.url).pathname;
    console.log('outputOptions:', outputOptions);
    // Ensure outputOptions.dir is defined
    if (!outputOptions.file && !outputOptions.dir || (!outputOptions.dir && !outputOptions.entryFileNames)) {
      console.log('Test 1', !outputOptions.file, (!outputOptions.dir || !outputOptions.entryFileNames));
      throw new Error('outputOptions.dir or outputOptions.file is not defined');
    }

    var universalFile = outputOptions.file? outputOptions.file : outputOptions.dir + outputOptions.entryFileNames;

    // Write the output bundle
//    console.log('Writing output bundle to:', outputOptions.file, bundle[this.fileName]);
    const JohnKnowsNot = JSON.parse(JSON.stringify(bundle));
    const outputOriginalFileContent = JohnKnowsNot[this.fileName].code;
    let outputFileContent = outputOriginalFileContent;
//    console.log('outputFileContent:', outputFileContent);
    const outputPath = this.path.resolve(this.path.dirname(universalFile));
    const outputFile = this.path.resolve('.cjs');
    const outputDir = this.outputDir ? this.outputDir : this.path.resolve(this.path.dirname(universalFile));
//    await this.fs.promises.mkdir(this.path.resolve(process.cwd(), 'tmp'), {recursive: true})
    await this.fs.promises.mkdir(outputPath, { recursive: true });
    await this.fs.promises.writeFile(outputFile, JSON.stringify(outputFileContent, null, 2), 'utf8');
    console.log('Merr we made it here');
    // Generate hash of the JavaScript source code
    const sourceCode = await this.fs.promises.readFile(outputFile, "utf8");
    const sourceHash = this.crypto
      .createHash("sha256")
      .update(sourceCode)
      .digest("hex");
  
    // Write the hash to a file
    const hashFilePath = this.path.resolve(outputPath, "hash.txt");
    await this.fs.promises.writeFile(hashFilePath, sourceHash, "utf8");
  
    // Define the target platforms
    const targets = ["linux", "macos", "win"];
  
    try {
      for (const target of targets) {
        const seaConfigPath = this.path.resolve(
          outputDir,
          "sea-config.json"
        );
        const seaPrepBlobPath = this.path.resolve(
          outputDir,
          "sea-prep.blob"
        );
        const nodeBinaryPath = this.path.resolve(
          outputDir,
          "node-" + target
        );
        const finalBinaryPath = this.path.resolve(
          outputDir,
          this.outputFileName + target
        );
  
        // Create SEA configuration
        const seaConfig = {
          main: outputFile,
          output: seaPrepBlobPath,
          assets: {
            "app.js": outputFile,
            "hash.txt": hashFilePath,
          },
        };
        // Ensure the directory exists before writing the file
        await this.fs.promises.mkdir(this.path.dirname(seaConfigPath), { recursive: true });
        await this.fs.promises.writeFile(
          seaConfigPath,
          JSON.stringify(seaConfig)
        );
  
        // Generate the blob to be injected
        await new Promise((resolve, reject) => {
          const seaProcess = this.spawn("node", [
            "--experimental-sea-config",
            seaConfigPath,
          ]);
  
          seaProcess.stdout.on("data", (data) => {
            console.log(
              "SEA blob generation successful for target " +
                target +
                "! " +
                data
            );
          });
  
          seaProcess.stderr.on("data", (data) => {
            console.error(
              "SEA blob generation error for target " + target + ": " + data
            );
          });
  
          seaProcess.on("close", (code) => {
            if (code !== 0) {
              reject(
                "SEA blob generation failed for target " +
                  target +
                  " with code " +
                  code
              );
            } else {
              resolve();
            }
          });
        });
  
        // Create a copy of the node executable
        await new Promise((resolve, reject) => {
          const copyCommand =
            process.platform === "win32"
              ? "node -e \"require('fs').copyFileSync(process.execPath, '" +
                nodeBinaryPath +
                ".exe')\""
              : "cp $(command -v node) " + nodeBinaryPath;
  
          const copyProcess = this.spawn(copyCommand, { shell: true });
  
          copyProcess.stdout.on("data", (data) => {
            console.log(
              "Node.js binary copy successful for target " +
                target +
                "! " +
                data
            );
          });
  
          copyProcess.stderr.on("data", (data) => {
            console.error(
              "Node.js binary copy error for target " + target + ": " + data
            );
          });
  
          copyProcess.on("close", (code) => {
            if (code !== 0) {
              reject(
                "Node.js binary copy failed for target " +
                  target +
                  " with code " +
                  code
              );
            } else {
              resolve();
            }
          });
        });
  
        // Remove the signature of the binary (macOS only)
        if (process.platform === "darwin") {
          await new Promise((resolve, reject) => {
            const removeSignatureProcess = this.spawn("codesign", [
              "--remove-signature",
              nodeBinaryPath,
            ]);
  
            removeSignatureProcess.stdout.on("data", (data) => {
              console.log(
                "Removing signature successful for target " +
                  target +
                  "! " +
                  data
              );
            });
  
            removeSignatureProcess.stderr.on("data", (data) => {
              console.error(
                "Removing signature error for target " + target + ": " + data
              );
            });
  
            removeSignatureProcess.on("close", (code) => {
              if (code !== 0) {
                reject(
                  "Removing signature failed for target " +
                    target +
                    " with code " +
                    code
                );
              } else {
                resolve();
              }
            });
          });
        }
  
        // Inject the blob into the copied binary
        await new Promise((resolve, reject) => {
          let postjectCommand = "npx postject " + nodeBinaryPath;
          if (process.platform === "win32") {
            postjectCommand += ".exe";
          }
          postjectCommand +=
            " NODE_SEA_BLOB " +
            seaPrepBlobPath +
            " --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";
  
          if (process.platform === "darwin") {
            postjectCommand += " --macho-segment-name NODE_SEA";
          }
  
          const postjectProcess = this.spawn(postjectCommand, {
            shell: true,
          });
  
          postjectProcess.stdout.on("data", (data) => {
            console.log(
              "Blob injection successful for target " + target + "! " + data
            );
          });
  
          postjectProcess.stderr.on("data", (data) => {
            console.error(
              "Blob injection error for target " + target + ": " + data
            );
          });
  
          postjectProcess.on("close", (code) => {
            if (code !== 0) {
              reject(
                "Blob injection failed for target " +
                  target +
                  " with code " +
                  code
              );
            } else {
              resolve();
            }
          });
        });
  
        // Sign the binary (macOS only)
        if (process.platform === "darwin") {
          await new Promise((resolve, reject) => {
            const signProcess = this.spawn("codesign", [
              "--sign",
              "-",
              nodeBinaryPath,
            ]);
  
            signProcess.stdout.on("data", (data) => {
              console.log(
                "Signing binary successful for target " + target + "! " + data
              );
            });
  
            signProcess.stderr.on("data", (data) => {
              console.error(
                "Signing binary error for target " + target + ": " + data
              );
            });
  
            signProcess.on("close", (code) => {
              if (code !== 0) {
                reject(
                  "Signing binary failed for target " +
                    target +
                    " with code " +
                    code
                );
              } else {
                resolve();
              }
            });
          });
        }
  
        // Rename the final binary
        await this.fs.promises.rename(nodeBinaryPath, finalBinaryPath);
  
        // Generate hash of the binary
        const binaryContent = await this.fs.promises.readFile(finalBinaryPath);
        const hash = this.crypto
          .createHash("sha256")
          .update(binaryContent)
          .digest("hex");
  
        // Write the hash to a file in the libs folder
        const binaryHashFilePath = this.path.resolve(
          outputDir,
          this.path.basename(finalBinaryPath) + "-hash.txt"
        );
        this.fs.writeFileSync(binaryHashFilePath, hash);
      }
    } catch (error) {
      console.error("Node.js single executable creation failed!", error);
    }
    
    await this.fs.promises.rmdir(this.path.resolve(this.path.dirname(this.tempPath)), { force: true, recursive: true })
    return;
  }
}

//Using Precise code executions inlines we can properly create a dual plugin that works for both Webpack and Rollup.
//By detecting the environment we can properly export the correct plugin.
//But we properly have to import both plugins to make sure they are properly exported.
//Most developers always use requires at the top of the file to make sure the plugin is properly imported.
//I only use them as needed this allows for better code execution and less memory usage.
//This is a good way to properly export a plugin for both Webpack and Rollup.
//Please look at my godbox and blackbox npm package source code for verifications of this tips and tricks.
if (typeof exports === "object" && typeof module !== "undefined") {
  // CommonJS export for WebpackPkgPlugin
  module.exports = { RollupPkgPlugin, WebpackPkgPlugin };
} else if (typeof define === "function" && define.amd) {
  // AMD export for WebpackPkgPlugin
  define([], function () {
    return { RollupPkgPlugin, WebpackPkgPlugin };
  });
}
// ES Module export for WebpackPkgPlugin
export { WebpackPkgPlugin };
//Must export default for rollup to properly work.
export default RollupPkgPlugin;