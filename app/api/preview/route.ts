import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const fileName = searchParams.get('file');

        if (!fileName) {
            return new NextResponse('File name required', { status: 400 });
        }

        const AUDIO_RAW_DIR = process.env.AUDIO_RAW_DIR || path.resolve('../audio_raw');
        const PREVIEW_DIR = path.join(AUDIO_RAW_DIR, '.preview');
        const filePath = path.join(PREVIEW_DIR, fileName);

        // Security: prevent directory traversal
        if (!filePath.startsWith(PREVIEW_DIR)) {
            return new NextResponse('Invalid file path', { status: 400 });
        }

        const fileBuffer = await readFile(filePath);

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'audio/mpeg',
                'Content-Length': fileBuffer.length.toString(),
            },
        });
    } catch (error) {
        console.error('Error serving preview:', error);
        return new NextResponse('File not found', { status: 404 });
    }
}
