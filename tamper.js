const { getAsset } = require('node:sea');
const crypto = require('crypto');

function verifySourceIntegrity() {
    try {
        // Load the JavaScript source code from SEA assets
        const jsSource = getAsset('phoenixBox.js');
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
        process.exit(1);
    }
}

verifySourceIntegrity();

module.exports = { verifySourceIntegrity };