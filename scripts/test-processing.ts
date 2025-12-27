
import { processAudioFile } from '../lib/audio';
import path from 'path';

async function main() {
    console.log('Testing audio processing...');

    try {
        const fileName = 'test_sine.wav';
        console.log(`Processing ${fileName} (Convert only)...`);

        // Test 1: Basic Convert
        await processAudioFile({
            fileName,
            convert: true,
            segment: false,
        });
        console.log('Test 1 Passed: Convert');

        // Test 2: Target Size (1MB for 5 sec is huge bitrate, so it should cap or be high)
        // Actually 5 sec is tiny. 1MB = 8Mb = 1.6Mbps. MP3 max is 320k.
        // So it should result in max bitrate.
        // Let's try 0.1MB = 100KB = 800Kb = 160kbps approximately.
        console.log(`Processing ${fileName} (Target Size 0.1MB)...`);
        await processAudioFile({
            fileName,
            convert: false,
            segment: false,
            targetSize: 0.1
        });
        console.log('Test 2 Passed: Target Size');

    } catch (error) {
        console.error('Test Failed:', error);
        process.exit(1);
    }
}

main();
