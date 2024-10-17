import { getAsset } from 'node:sea';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

function verifySourceIntegrity(): void {
    try {
        // Load the JavaScript source code from SEA assets
        const jsSource = getAsset('pheonixBox.js');
        const jsSourceContent = Buffer.from(jsSource).toString('utf8');
//        console.log('JavaScript source code:', jsSourceContent);
        
        // Load the hash from SEA assets
        const hashAsset = getAsset('hash.txt');
        const storedHash = Buffer.from(hashAsset).toString('utf8');
        
        // Compute the hash of the loaded JavaScript source code
        const currentHash = crypto.createHash('sha256').update(jsSourceContent).digest('hex');

        // Compare the computed hash with the stored hash
        if (currentHash !== storedHash) {
            console.error("Source integrity check failed!");
            process.exit(1);
        } else {
            console.log("Source integrity check passed.");
        }
    } catch (error) {
        console.error("Error during source integrity check:", error);
        try {
        const currentFile = fs.readFileSync(path.resolve(__dirname, __filename), 'utf8');
        console.log('Current file:', path.resolve(__dirname, __filename));
        const Hash = crypto.createHash('sha256').update(currentFile).digest('hex');
        console.log('Current File Hash:', crypto.createHash('sha256').update(currentFile).digest('hex'));
        const hashFile = fs.readFileSync(path.resolve(__dirname, 'hash.txt'), 'utf8');
        console.log('Hash file:', hashFile);
        if ( Hash !== hashFile) {
            console.error('Source integrity check failed!');
            process.exit(1);
        }
        }catch(e){
            console.error('Error during source integrity check:', e);
            process.exit(1);
        }
    }
}

verifySourceIntegrity();

export { verifySourceIntegrity };