/*
Copyright (C) 2024 Johnathan Edward Brown.

Permission is hereby granted, free of charge, 
to any person obtaining a copy of this software
and associated documentation files (the "Software"),
to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE X CONSORTIUM BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Except as contained in this notice, the name of Johnathan Edward Brown shall not be used in advertising or otherwise to promote the sale,
use or other dealings in this Software without prior written authorization from Johnathan Edward Brown.
*/
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/**
 * NodePkgPlugin is a Webpack plugin that generates single executable applications for multiple platforms
 * (Linux, macOS, Windows) by leveraging Node.js SEA (Single Executable Applications) feature.
 * 
 * @class NodePkgPlugin
 */
class NodePkgPlugin {
    fileName;
    outputFilename;

    constructor(fileName = 'app.js', outputFileName = 'app-'){
        this.fileName = fileName;
        this.outputFilename = this.outputFilename;
    }


    apply(compiler) {
        compiler.hooks.afterEmit.tapPromise('NodePkgPlugin', async (compilation) => {
            const outputPath = path.resolve(compiler.options.output.path, this.fileName);

            // Define the target platforms
            const targets = [
                "linux",
                "macos",
                "win"
            ];

            try {
                for (const target of targets) {
                    const outputFilePath = path.resolve(compiler.options.output.path, this.outputFilename + target);
                    const seaConfigPath = path.resolve(compiler.options.output.path, 'sea-config.json');
                    const seaPrepBlobPath = path.resolve(compiler.options.output.path, 'sea-prep.blob');
                    const nodeBinaryPath = path.resolve(compiler.options.output.path, 'node-' + target);
                    const finalBinaryPath = path.resolve(compiler.options.output.path, this.outputFilename + target);

                    // Create SEA configuration
                    const seaConfig = {
                        main: outputPath,
                        output: seaPrepBlobPath,
                        files: [
                            outputPath,
                        ]
                    };
                    fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig));

                    // Generate the blob to be injected
                    await new Promise((resolve, reject) => {
                        const seaProcess = spawn('node', ['--experimental-sea-config', seaConfigPath]);

                        seaProcess.stdout.on('data', (data) => {
                            console.log('SEA blob generation successful for target ' + target + '! ' + data);
                        });

                        seaProcess.stderr.on('data', (data) => {
                            console.error('SEA blob generation error for target ' + target + ': ' + data);
                        });

                        seaProcess.on('close', (code) => {
                            if (code !== 0) {
                                reject('SEA blob generation failed for target ' + target + ' with code ' + code);
                            } else {
                                resolve();
                            }
                        });
                    });

                    // Create a copy of the node executable
                    await new Promise((resolve, reject) => {
                        const copyCommand = process.platform === 'win32'
                            ? 'node -e "require(\'fs\').copyFileSync(process.execPath, \'' + nodeBinaryPath + '.exe\')"'
                            : 'cp $(command -v node) ' + nodeBinaryPath;

                        const copyProcess = spawn(copyCommand, { shell: true });

                        copyProcess.stdout.on('data', (data) => {
                            console.log('Node.js binary copy successful for target ' + target + '! ' + data);
                        });

                        copyProcess.stderr.on('data', (data) => {
                            console.error('Node.js binary copy error for target ' + target + ': ' + data);
                        });

                        copyProcess.on('close', (code) => {
                            if (code !== 0) {
                                reject('Node.js binary copy failed for target ' + target + ' with code ' + code);
                            } else {
                                resolve();
                            }
                        });
                    });

                    // Remove the signature of the binary (macOS only)
                    if (process.platform === 'darwin') {
                        await new Promise((resolve, reject) => {
                            const removeSignatureProcess = spawn('codesign', ['--remove-signature', nodeBinaryPath]);

                            removeSignatureProcess.stdout.on('data', (data) => {
                                console.log('Removing signature successful for target ' + target + '! ' + data);
                            });

                            removeSignatureProcess.stderr.on('data', (data) => {
                                console.error('Removing signature error for target ' + target + ': ' + data);
                            });

                            removeSignatureProcess.on('close', (code) => {
                                if (code !== 0) {
                                    reject('Removing signature failed for target ' + target + ' with code ' + code);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    }

                    // Inject the blob into the copied binary
                    await new Promise((resolve, reject) => {
                        let postjectCommand = 'npx postject ' + nodeBinaryPath;
                        if (process.platform === 'win32') {
                            postjectCommand += '.exe';
                        }
                        postjectCommand += ' NODE_SEA_BLOB ' + seaPrepBlobPath + ' --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

                        if (process.platform === 'darwin') {
                            postjectCommand += ' --macho-segment-name NODE_SEA';
                        }

                        const postjectProcess = spawn(postjectCommand, { shell: true });

                        postjectProcess.stdout.on('data', (data) => {
                            console.log('Blob injection successful for target ' + target + '! ' + data);
                        });

                        postjectProcess.stderr.on('data', (data) => {
                            console.error('Blob injection error for target ' + target + ': ' + data);
                        });

                        postjectProcess.on('close', (code) => {
                            if (code !== 0) {
                                reject('Blob injection failed for target ' + target + ' with code ' + code);
                            } else {
                                resolve();
                            }
                        });
                    });

                    // Sign the binary (macOS only)
                    if (process.platform === 'darwin') {
                        await new Promise((resolve, reject) => {
                            const signProcess = spawn('codesign', ['--sign', '-', nodeBinaryPath]);

                            signProcess.stdout.on('data', (data) => {
                                console.log('Signing binary successful for target ' + target + '! ' + data);
                            });

                            signProcess.stderr.on('data', (data) => {
                                console.error('Signing binary error for target ' + target + ': ' + data);
                            });

                            signProcess.on('close', (code) => {
                                if (code !== 0) {
                                    reject('Signing binary failed for target ' + target + ' with code ' + code);
                                } else {
                                    resolve();
                                }
                            });
                        });
                    }

                    // Rename the final binary
                    fs.renameSync(nodeBinaryPath, finalBinaryPath);

                    // Generate hash of the binary
                    const binaryContent = fs.readFileSync(finalBinaryPath);
                    const hash = crypto.createHash('sha256').update(binaryContent).digest('hex');

                    // Write the hash to a file in the libs folder
                    const hashFilePath = path.resolve(compiler.options.output.path, 'libs', path.basename(finalBinaryPath) + '-hash.txt');
                    fs.writeFileSync(hashFilePath, hash);
                }
            } catch (error) {
                console.error('Node.js single executable creation failed!', error);
            }
        });
    }
}

module.exports = NodePkgPlugin;
