import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';

// Use environment variables for directory paths, with fallback for development
const AUDIO_RAW_DIR = process.env.AUDIO_RAW_DIR || path.join(process.cwd(), '4udio7ool_audio', 'downloads');
const AUDIO_PROCESSED_DIR = process.env.AUDIO_PROCESSED_DIR || path.join(process.cwd(), '4udio7ool_audio', 'processed');

export interface AudioFile {
  name: string;
  size: number;
  duration: number; // in seconds
  // ctime: Date;
}

export interface ProcessOptions {
  fileName: string;
  convert: boolean;
  segment: boolean;
  segmentDuration?: number; // in minutes
  targetSize?: number; // in MB
  bitrate?: string; // e.g. "192" for 192k
  format?: string; // 'mp3', 'wav', 'aiff', 'aac'
}

export async function listAudioFiles(): Promise<AudioFile[]> {
  if (!fs.existsSync(AUDIO_RAW_DIR)) {
    fs.mkdirSync(AUDIO_RAW_DIR, { recursive: true });
  }

  const files = fs.readdirSync(AUDIO_RAW_DIR);

  // Use Promise.all to fetch durations in parallel
  const audioFiles = await Promise.all(
    files
      .filter(file => !file.startsWith('.') && /\.(mp3|wav|flac|m4a|aac|ogg|wma|mp4)$/i.test(file))
      .map(async (file) => {
        const filePath = path.join(AUDIO_RAW_DIR, file);
        const stats = fs.statSync(filePath);
        let duration = 0;
        try {
          duration = await getDuration(filePath);
        } catch (e) {
          console.error(`Failed to get duration for ${file}`, e);
        }

        return {
          name: file,
          size: stats.size,
          duration,
        };
      })
  );

  return audioFiles;
}

export async function processAudioFile(options: ProcessOptions): Promise<string> {
  const inputPath = path.join(AUDIO_RAW_DIR, options.fileName);
  console.log('--------------------------------------------------');
  console.log(`[AudioProcessor] Starting job: ${options.fileName}`);
  console.log(`[AudioProcessor] Input path: ${inputPath}`);

  // Ensure output dir exists
  if (!fs.existsSync(AUDIO_PROCESSED_DIR)) {
    console.log(`[AudioProcessor] Creating output dir: ${AUDIO_PROCESSED_DIR}`);
    fs.mkdirSync(AUDIO_PROCESSED_DIR, { recursive: true });
  }

  // Determine base output name
  const nameWithoutExt = path.parse(options.fileName).name;

  // Determine output extension based on format
  const format = options.format || 'mp3';
  let ext = 'mp3';
  if (format === 'wav') ext = 'wav';
  else if (format === 'aiff') ext = 'aiff'; // or aif
  else if (format === 'aac') ext = 'm4a'; // aac is usually in m4a container for wide support

  let outputPath = path.join(AUDIO_PROCESSED_DIR, `${nameWithoutExt}.${ext}`);

  // 1. Basic Conversion & Compression Logic
  // If targetSize is set, we need to calculate bitrate.
  // Otherwise default to 192k.

  let audioBitrate = options.bitrate ? `${options.bitrate}k` : '192k';

  // Only calculate bitrate for compressed formats
  const isCompressed = ['mp3', 'aac', 'm4a'].includes(format);

  if (isCompressed && options.targetSize) {
    console.log(`[AudioProcessor] Target Size enabled: ${options.targetSize} MB`);
    // We need to know duration to calculate bitrate
    const durationSec = await getDuration(inputPath);
    console.log(`[AudioProcessor] File duration: ${durationSec} seconds`);

    if (durationSec > 0) {
      // Size (bits) = Bitrate (bps) * Duration (s)
      // Bitrate (bps) = Size (bits) / Duration (s)
      // Size (MB) * 8 * 1024 * 1024 = Size (bits)
      const targetBits = options.targetSize * 8 * 1024 * 1024;
      const calculatedBitrate = Math.floor(targetBits / durationSec);
      // Clamp bitrate reasonably (e.g. 32k - 320k)
      // But user wants specific size, so we should try to honor it.
      audioBitrate = `${Math.floor(calculatedBitrate / 1000)}k`;
      console.log(`[AudioProcessor] Calculated optimal bitrate: ${audioBitrate} for ${options.targetSize}MB target`);
    } else {
      console.warn(`[AudioProcessor] Could not determine duration, defaulting to 192k`);
    }
  } else if (isCompressed) {
    // If bitrate is provided explicitly, it is already set in audioBitrate variable above.
    console.log(`[AudioProcessor] Using bitrate: ${audioBitrate}`);
  }

  return new Promise((resolve, reject) => {
    let command = ffmpeg(inputPath);

    console.log(`[AudioProcessor] Configuring FFmpeg...`);

    // Set format
    console.log(`[AudioProcessor] Target Format: ${format}`);

    if (format === 'mp3') {
      command.format('mp3');
      command.audioBitrate(audioBitrate);
    } else if (format === 'wav') {
      command.format('wav');
      // Wav is lossless, no bitrate needed strictly, usually pcm_s16le
    } else if (format === 'aiff') {
      command.format('aiff');
    } else if (format === 'aac') {
      command.format('adts'); // or just let ffmpeg detect from extension if outputting to file
      // For m4a container usually ipod or just set codec
      // simpler to specify output extension and let ffmpeg handle container, but we can enforce codec
      // command.audioCodec('aac');
      command.audioBitrate(audioBitrate);
    }

    if (options.segment && options.segmentDuration) {
      console.log(`[AudioProcessor] Segmentation enabled: ${options.segmentDuration} mins`);

      command.outputOptions([
        '-f segment',
        `-segment_time ${options.segmentDuration * 60}`,
        '-reset_timestamps 1'
      ]);
      // Output pattern
      outputPath = path.join(AUDIO_PROCESSED_DIR, `${nameWithoutExt}_%03d.${ext}`);
      console.log(`[AudioProcessor] Output pattern: ${outputPath}`);
    } else {
      console.log(`[AudioProcessor] Output file: ${outputPath}`);
    }

    command
      .on('start', (cmdLine) => {
        console.log(`[AudioProcessor] Spawned FFmpeg with command: ${cmdLine}`);
      })
      .on('progress', (progress) => {
        // Log less frequently or just percent
        // console.log(`[AudioProcessor] Processing: ${progress.percent}% done`);
      })
      .on('end', () => {
        console.log(`[AudioProcessor] Job finished successfully.`);
        resolve('Processing finished');
      })
      .on('error', (err) => {
        console.error(`[AudioProcessor] Job failed:`, err);
        reject(err);
      })
      .save(outputPath);
  });
}

function getDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

const PREVIEW_DIR = path.join(AUDIO_RAW_DIR, '.preview');

export async function generateAudioPreview(
  fileName: string,
  bitrate?: string,
  targetSize?: number
): Promise<string> {
  const inputPath = path.join(AUDIO_RAW_DIR, fileName);

  // Ensure preview directory exists
  if (!fs.existsSync(PREVIEW_DIR)) {
    fs.mkdirSync(PREVIEW_DIR, { recursive: true });
  }

  // Generate preview filename based on settings
  const settingsHash = `${bitrate || targetSize || 'default'}`;
  const nameWithoutExt = path.parse(fileName).name;
  const previewFileName = `${nameWithoutExt}_preview_${settingsHash}.mp3`;
  const outputPath = path.join(PREVIEW_DIR, previewFileName);

  // Return existing preview if it exists
  if (fs.existsSync(outputPath)) {
    return previewFileName;
  }

  // Calculate bitrate (same logic as processAudioFile)
  let audioBitrate = bitrate ? `${bitrate}k` : '192k';

  if (targetSize) {
    const durationSec = await getDuration(inputPath);
    if (durationSec > 0) {
      const targetBits = targetSize * 8 * 1024 * 1024;
      const calculatedBitrate = Math.floor(targetBits / durationSec);
      audioBitrate = `${Math.floor(calculatedBitrate / 1000)}k`;
    }
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      // Extract first 15 seconds
      .setStartTime(0)
      .setDuration(15)
      .format('mp3')
      .audioBitrate(audioBitrate)
      .on('end', () => {
        resolve(previewFileName);
      })
      .on('error', (err) => {
        reject(err);
      })
      .save(outputPath);
  });
}
