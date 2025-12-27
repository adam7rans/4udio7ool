'use server';

import { listAudioFiles, processAudioFile, ProcessOptions } from '@/lib/audio';

export async function getAudioFiles() {
    try {
        const files = await listAudioFiles();
        return { success: true, files };
    } catch (error) {
        console.error('Error listing files:', error);
        return { success: false, error: 'Failed to list files' };
    }
}

export async function processAudio(options: ProcessOptions) {
    try {
        const result = await processAudioFile(options);
        return { success: true, message: result };
    } catch (error) {
        console.error('Error processing file:', error);
        return { success: false, error: 'Failed to process file' };
    }
}

export async function uploadFiles(formData: FormData) {
    const files = formData.getAll('files') as File[];

    if (!files.length) {
        return { success: false, error: 'No files received' };
    }

    // We need fs to write files, but we are in "use server" context only, so we can import fs inside, or use the lib functions if we export a helper.
    // Actually I can just import fs/path here or re-use logic.
    // Best to keep standard node imports at top? 
    // 'fs' import in 'use server' file works in Next.js.
    // But wait, I imported listAudioFiles from @/lib/audio, I should probably add saveFile there to keep it clean.

    // Let's implement saveFile in lib/audio.ts instead and call it here if possible.
    // But passing File object to lib might be tricky if lib is node-only.
    // File object in Server Action is standard Web API File.
    // I will convert it to Buffer and write it.

    try {
        const path = require('path');
        const fs = require('fs');
        // Re-define raw dir here or export it from lib?
        // I'll just re-define or import constant if I exported it. I didn't export it.
        const AUDIO_RAW_DIR = path.resolve('../audio_raw');

        if (!fs.existsSync(AUDIO_RAW_DIR)) {
            fs.mkdirSync(AUDIO_RAW_DIR, { recursive: true });
        }

        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const filePath = path.join(AUDIO_RAW_DIR, file.name);
            fs.writeFileSync(filePath, buffer);
        }

        return { success: true };
    } catch (error) {
        console.error('Upload error:', error);
    }
}

export async function generatePreview(fileName: string, bitrate?: string, targetSize?: number) {
    try {
        const { generateAudioPreview } = require('@/lib/audio');
        const previewFileName = await generateAudioPreview(fileName, bitrate, targetSize);
        return { success: true, previewFileName };
    } catch (error) {
        console.error('Preview generation error:', error);
        return { success: false, error: 'Failed to generate preview' };
    }
}

export async function downloadYouTubeAudio(url: string) {
    try {
        const { execFile } = require('child_process');
        const { promisify } = require('util');
        const path = require('path');
        const fs = require('fs');

        const execFileAsync = promisify(execFile);

        // Basic YouTube URL validation
        if (!url.includes('youtube.com/watch') && !url.includes('youtu.be/')) {
            return { success: false, error: 'Invalid YouTube URL' };
        }

        const AUDIO_RAW_DIR = path.resolve('../audio_raw');
        if (!fs.existsSync(AUDIO_RAW_DIR)) {
            fs.mkdirSync(AUDIO_RAW_DIR, { recursive: true });
        }

        // Try to find yt-dlp in common locations
        const ytdlpPaths = [
            '/Users/7racker/.pyenv/shims/yt-dlp',
            '/usr/local/bin/yt-dlp',
            '/opt/homebrew/bin/yt-dlp',
            'yt-dlp' // fallback to PATH
        ];

        let ytdlpPath = 'yt-dlp';
        for (const testPath of ytdlpPaths) {
            if (testPath === 'yt-dlp' || fs.existsSync(testPath)) {
                ytdlpPath = testPath;
                break;
            }
        }

        // Use yt-dlp to download audio
        // First, get the video title to generate filename
        const { stdout: titleOutput } = await execFileAsync(ytdlpPath, [
            '--get-title',
            '--no-playlist',
            url
        ]);

        const videoTitle = titleOutput.trim();
        console.log('Video title:', videoTitle);

        const outputTemplate = path.join(AUDIO_RAW_DIR, '%(title)s.%(ext)s');

        // Get list of files before download to compare after
        const existingFiles = new Set(fs.readdirSync(AUDIO_RAW_DIR));

        // Download audio - try with extraction first, fall back to direct download
        try {
            // Try downloading and extracting to mp3 (requires ffmpeg)
            await execFileAsync(ytdlpPath, [
                '--extract-audio',
                '--audio-format', 'mp3',
                '--audio-quality', '0',
                '--output', outputTemplate,
                '--no-playlist',
                url
            ]);
        } catch (extractError: any) {
            // If extraction fails (likely due to missing ffmpeg), download best audio directly
            if (extractError.message?.includes('ffprobe') || extractError.message?.includes('Postprocessing')) {
                console.log('ffmpeg not available, downloading audio directly in original format');
                await execFileAsync(ytdlpPath, [
                    '--format', 'bestaudio',
                    '--output', outputTemplate,
                    '--no-playlist',
                    url
                ]);
            } else {
                throw extractError;
            }
        }

        // Find the newly downloaded file by comparing with existing files
        const currentFiles = fs.readdirSync(AUDIO_RAW_DIR);
        const newFiles = currentFiles.filter((f: string) => !existingFiles.has(f));

        // Filter for audio files only
        const audioExtensions = ['.mp3', '.m4a', '.webm', '.opus', '.wav', '.flac', '.aac', '.ogg'];
        let downloadedFile = newFiles.find((f: string) =>
            audioExtensions.some(ext => f.toLowerCase().endsWith(ext))
        );

        // If no new file found, the file might already exist from a previous download
        // yt-dlp will skip downloading if the file already exists
        if (!downloadedFile) {
            console.log('No new file found, checking if file already exists...');
            // Look for an existing file that matches the video title
            downloadedFile = currentFiles.find((f: string) =>
                f.includes(videoTitle.substring(0, 50)) && // Match first 50 chars of title
                audioExtensions.some(ext => f.toLowerCase().endsWith(ext))
            );

            if (downloadedFile) {
                console.log('File already exists:', downloadedFile);
            }
        }

        if (!downloadedFile) {
            console.error('No audio file found. Video title:', videoTitle);
            console.error('New files:', newFiles);
            console.error('Existing files:', currentFiles.slice(0, 5)); // Show first 5 for debugging
            return { success: false, error: 'Download completed but file not found' };
        }

        console.log('Downloaded file:', downloadedFile);

        return { success: true, fileName: downloadedFile };
    } catch (error) {
        console.error('YouTube download error:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        if (errorMsg.includes('Private video')) {
            return { success: false, error: 'This video is private' };
        } else if (errorMsg.includes('age')) {
            return { success: false, error: 'This video is age-restricted' };
        } else if (errorMsg.includes('not available')) {
            return { success: false, error: 'Video not available in your region' };
        } else if (errorMsg.includes('ENOENT') || errorMsg.includes('yt-dlp')) {
            return { success: false, error: 'yt-dlp not found. Please install it first.' };
        } else {
            return { success: false, error: 'Failed to download audio from YouTube' };
        }
    }
}
