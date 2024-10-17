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
export class WebpackPkgPlugin {

  constructor(
    fileName = "app.js",
    outputFileName = "app",
    typescript = false
  ) {
    this.fileName = fileName;
    this.outputFilename = outputFileName + "-";
    this.typescript = typescript;

    if (this.typescript) {
      this.tamperFile = "tamperScripts/tamper.ts";
      this.tamperBinaryFile = "tamperScripts/tamperBinary.ts";
    } else {
      this.tamperFile = "tamperScripts/tamper.js";
      this.tamperBinaryFile = "tamperScripts/tamperBinary.js";
    }
  }

  async importModules() {
    this.path = await import("path");
    this.fs = await import("fs");
    this.crypto = await import("crypto");
    this.spawn = (await import("child_process")).spawn;
  }

  async apply(compiler) {
    // Update the entry to include the tamper.js file
    compiler.hooks.beforeCompile.tapPromise("WebpackPkgPlugin", async () => {
      await this.importModules();
      const tamperFilePath = this.path.resolve('./node_modules', 'node-pkg-plugin', this.tamperFile);

      // Read the tamper.js file
      let tamperContent = await this.fs.promises.readFile(
        tamperFilePath,
        "utf8"
      );

      this.originalTamperContent = tamperContent;
      this.tamperFilePath = tamperFilePath;

      // Replace references to the correct file names
      tamperContent = tamperContent.replace(
        /getAsset\('app\.js'\)/g,
        `getAsset('${this.fileName}')`
      );

      // Write the updated content back to the tamper.js file
      await this.fs.promises.writeFile(tamperFilePath, tamperContent, "utf8");
    });

    compiler.hooks.afterEmit.tapPromise("WebpackPkgPlugin", async () => {
      await this.importModules();

      await this.fs.promises.writeFile(this.tamperFilePath, this.originalTamperContent, "utf8");
      // Get the output path of the JavaScript source code
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