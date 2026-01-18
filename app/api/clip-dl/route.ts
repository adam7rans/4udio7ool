
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { getDownloadDirectory } from '@/lib/storage-config';

// Dynamic download directory
// const AUDIO_RAW_DIR = process.env.AUDIO_RAW_DIR || path.join(process.cwd(), '4udio7ool_audio', 'downloads'); 
// We use the helper now, but we need to call it inside the handler or usually it's fine to call it at top level if it reads file synchronously, 
// BUT for config updates to apply instantly, it's safer to call it inside the request or make it a getter.
// getDownloadDirectory() reads config every time it's called.

// Helper to parse time
function parseTime(input: string): number {
    if (!input) return 0;
    const parts = input.split(':').map(Number);
    if (parts.some(isNaN)) return 0;

    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 1) return parts[0];
    if (parts.length === 4) return parts[0] * 3600 + parts[1] * 60 + parts[2] + (parts[3] / 1000);

    return 0;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { url, clips } = body; // clips: { start, end, sourceUrl? }[]

        if (!url || !Array.isArray(clips) || clips.length === 0) {
            return NextResponse.json({ error: 'Missing URL or valid clips array' }, { status: 400 });
        }

        const AUDIO_RAW_DIR = getDownloadDirectory();

        if (!fs.existsSync(AUDIO_RAW_DIR)) {
            fs.mkdirSync(AUDIO_RAW_DIR, { recursive: true });
        }

        // Try to find yt-dlp
        const ytdlpPaths = [
            '/Users/7racker/.pyenv/shims/yt-dlp', // From actions.ts in 4udio7ool known paths
            '/usr/local/bin/yt-dlp',
            '/opt/homebrew/bin/yt-dlp',
            'yt-dlp'
        ];
        let ytdlpPath = 'yt-dlp';
        for (const testPath of ytdlpPaths) {
            if (testPath === 'yt-dlp' || fs.existsSync(testPath)) {
                ytdlpPath = testPath;
                break;
            }
        }

        const stats = {
            processed: 0,
            failed: 0,
            createdFiles: [] as string[]
        };

        for (const clip of clips) {
            try {
                // Use the clip's specific URL if available, otherwise the main URL
                const clipUrl = clip.sourceUrl || url;

                const startSeconds = parseTime(clip.start);
                const endSeconds = parseTime(clip.end);

                if (endSeconds <= startSeconds) continue;

                // Get video title for filename
                let videoTitle = 'clip';
                try {
                    const { stdout } = await new Promise<{ stdout: string }>((resolve, reject) => {
                        const p = spawn(ytdlpPath, ['--get-title', '--no-playlist', clipUrl]);
                        let out = '';
                        p.stdout.on('data', d => out += d);
                        p.on('close', code => code === 0 ? resolve({ stdout: out }) : reject());
                    });
                    videoTitle = stdout.trim().replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
                } catch (e) {
                    console.warn('Failed to get title, using default');
                }

                const filename = `${videoTitle}_${startSeconds}-${endSeconds}_${uuidv4().substring(0, 8)}.mp4`;
                // Note: The user might want audio only since 4udio7ool seems audio focused?
                // But the request said "video-editor recording tab functionality" which downloads VIDEO.
                // 4udio7ool is an AUDIO tool. 
                // However, the user said "since its video we are dealing with. name the tab 'Clip DL'".
                // This implies they might want video.
                // But typical usage in 4udio7ool is audio.
                // I'll stick to 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best' as in source, 
                // BUT I should check if 4udio7ool can handle video files.
                // actions.ts filters extensions: /\.(mp3|wav|flac|m4a|aac|ogg|wma)$/i
                // If I download mp4, it WON'T show up in the list!
                // So I should download AUDIO or convert to supported format.
                // The prompt says: "Import this UI and ux functionality ... since its video we are dealing with"
                // This is ambiguous. "Name the tab Clip DL since its video we are dealing with" suggests they WANT video.
                // If I download MP4, it won't appear in the main "Audio Tool" list.
                // But maybe that's fine?
                // OR, I should add mp4 to safe extensions in lib/audio.ts?
                // Re-reading: "lets import all the... functionality from our CONTENT CONTENT /video-editor 'recording' tab to the 4udio-tool project... we need that functionality. Please import this UI and ux functionality as a new tab in the 4udio 7ool app since its video we are dealing with."
                // I will download as MP4 (Video) as requested ("since its video").
                // I might need to update `lib/audio.ts` to show MP4 files if they want to manage them there.
                // Or maybe this tab is just for downloading clips and they do something else with them?
                // I'll download as MP4. Check if I should add mp4 to listAudioFiles later.

                const finalPath = path.join(AUDIO_RAW_DIR, filename);

                const args = [
                    '--download-sections', `*${startSeconds}-${endSeconds}`,
                    '--force-keyframes-at-cuts',
                    '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
                    '-o', finalPath,
                    clipUrl
                ];

                await new Promise<void>((resolve, reject) => {
                    const process = spawn(ytdlpPath, args);
                    process.stderr.on('data', (d) => { if (d.toString().includes('ERROR')) console.error(d.toString()); });
                    process.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(`yt-dlp code ${code}`));
                    });
                });

                if (fs.existsSync(finalPath)) {
                    stats.createdFiles.push(filename);
                    stats.processed++;
                }

            } catch (err) {
                console.error(`Clip failed:`, err);
                stats.failed++;
            }
        }

        return NextResponse.json({
            success: true,
            processed: stats.processed,
            failed: stats.failed,
            files: stats.createdFiles
        });

    } catch (error) {
        console.error('Batch Request Failed:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
