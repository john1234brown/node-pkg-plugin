import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

function verifyBinaryIntegrity(): void {
    const binaryPath: string = process.execPath;
    const binaryContent: Buffer = fs.readFileSync(binaryPath);
    const currentHash: string = crypto.createHash('sha256').update(binaryContent).digest('hex');

    const hashFilePath: string = path.resolve(__dirname, path.basename(binaryPath) + '-hash.txt');
    const storedHash: string = fs.readFileSync(hashFilePath, 'utf8').trim();

    if (currentHash !== storedHash) {
        throw new Error('Binary integrity check failed!');
    }
}

verifyBinaryIntegrity();