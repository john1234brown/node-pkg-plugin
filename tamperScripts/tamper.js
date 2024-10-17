const { getAsset } = require('node:sea');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

function verifySourceIntegrity() {
    try {
        // Check if the assets exist in nodeSea
        const jsSource = getAsset('pheonixBox.js');
        const hashAsset = getAsset('hash.txt');

        if (!jsSource || !hashAsset) {
            console.log("Assets not found in nodeSea. Skipping integrity check.");
            return;
        }

        // Load the JavaScript source code from SEA assets
        const jsSourceContent = Buffer.from(jsSource).toString('utf8');
        // Load the hash from SEA assets
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
        try {
        const currentFile = fs.readFileSync(path.resolve(__dirname, __filename), 'utf8');
        const hashFile = fs.readFileSync(path.resolve(__dirname, 'hash.txt'), 'utf8');
        if (crypto.createHash('sha256').update(currentFile).digest('hex') !== hashFile) {
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

module.exports = { verifySourceIntegrity };