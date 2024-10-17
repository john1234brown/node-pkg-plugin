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
export class RollupPkgPlugin {
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
    await this.importModules();
    this.__dirname = new URL('.', import.meta.url).pathname;
    const tamperFilePath = this.path.resolve(this.__dirname, 'tamperScripts', this.tamperFile);

    // Read the tamper.js file
    let tamperContent = await this.fs.promises.readFile(tamperFilePath, "utf8");
    this.originalTamperContent = tamperContent;
    this.tamperFilePath = tamperFilePath;
    // Replace references to the correct file names
    tamperContent = tamperContent.replace(
      /getAsset\('app\.js'\)/g,
      `getAsset('${this.fileName}')`
    );

    // Write the updated content back to the tamper.js file
    await this.fs.promises.writeFile(tamperFilePath, tamperContent, 'utf8');
  }

  async generateBundle(outputOptions, bundle) {
    await this.importModules();
    await this.fs.promises.writeFile(this.tamperFilePath, this.originalTamperContent, 'utf8');
    this.__dirname = new URL('.', import.meta.url).pathname;
    // Ensure outputOptions.dir is defined
    if (!outputOptions.file && !outputOptions.dir || (!outputOptions.dir && !outputOptions.entryFileNames)) {
      console.log('Test 1', !outputOptions.file, (!outputOptions.dir || !outputOptions.entryFileNames));
      throw new Error('outputOptions.dir or outputOptions.file is not defined');
    }

    var universalFile = outputOptions.file? outputOptions.file : outputOptions.dir + '/' + outputOptions.entryFileNames;

    // Write the output bundle
    console.log('Writing output bundle to:', outputOptions.file, bundle[this.fileName]);
    const JohnKnowsNot = JSON.parse(JSON.stringify(bundle));
    const outputPath = this.path.resolve(this.path.dirname(universalFile));
    // Convert the file name to .cjs regardless of the entryFileName extension
    const parsedPath = this.path.parse(universalFile);
    const outputFileName = `${parsedPath.name}.cjs`;
    const outputFile = this.path.resolve(outputPath, outputFileName);
    await this.fs.promises.mkdir(outputPath, { recursive: true });
    await this.fs.promises.writeFile(outputFile, JSON.stringify(JohnKnowsNot[this.fileName].code, null, 2), 'utf8');
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
          outputPath,
          "sea-config.json"
        );
        const seaPrepBlobPath = this.path.resolve(
          outputPath,
          "sea-prep.blob"
        );
        const nodeBinaryPath = this.path.resolve(
          outputPath,
          "node-" + target
        );
        const finalBinaryPath = this.path.resolve(
          outputPath,
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
          outputPath,
          this.path.basename(finalBinaryPath) + "-hash.txt"
        );
        this.fs.writeFileSync(binaryHashFilePath, hash);
      }
    } catch (error) {
      console.error("Node.js single executable creation failed!", error);
    }

    return;
  }
}