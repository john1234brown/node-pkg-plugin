const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function verifyBinaryIntegrity() {
    const binaryPath = process.execPath;
    const binaryContent = fs.readFileSync(binaryPath);
    const currentHash = crypto.createHash('sha256').update(binaryContent).digest('hex');

    const hashFilePath = path.resolve(__dirname, path.basename(binaryPath) + '-hash.txt');
    const storedHash = fs.readFileSync(hashFilePath, 'utf8').trim();

    if (currentHash !== storedHash) {
        throw new Error('Binary integrity check failed!');
    }
}

verifyBinaryIntegrity();