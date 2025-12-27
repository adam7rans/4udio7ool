# 4udio7ool - Audio Processing Web Application

A Next.js web application for processing audio files with support for conversion, compression, segmentation, and preview generation. Built with FFmpeg for powerful audio manipulation capabilities.

## Features

- 📁 **File Management**: Upload and manage audio files through a web interface
- 🎵 **Audio Processing**: Convert audio files to MP3 format with customizable bitrate
- ✂️ **Segmentation**: Split long audio files into smaller segments
- 📊 **Target Size Compression**: Automatically calculate optimal bitrate to achieve desired file size
- 🎧 **Preview Generation**: Generate 15-second previews with different compression settings
- 📥 **YouTube Audio Download**: Download audio from YouTube videos (experimental)
- 🔄 **Real-time Processing**: View processing status and preview results before saving

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v20 or higher)
- **npm** or **yarn**
- **FFmpeg** (required for audio processing)

### Installing FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) or use [Chocolatey](https://chocolatey.org/):
```bash
choco install ffmpeg
```

## Installation

1. **Clone the repository:**
```bash
git clone https://github.com/adam7rans/4udio7ool.git
cd 4udio7ool
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment variables:**

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and configure your directory paths:
```env
AUDIO_RAW_DIR=/absolute/path/to/your/audio_raw
AUDIO_PROCESSED_DIR=/absolute/path/to/your/audio_processed
```

> **Note**: Use absolute paths. The application will create these directories if they don't exist.

4. **Create the required directories** (optional, will be auto-created):
```bash
mkdir -p /path/to/your/audio_raw
mkdir -p /path/to/your/audio_processed
```

## Usage

### Development Mode

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

Build the application for production:
```bash
npm run build
npm start
```

## Directory Structure

```
4udio7ool/
├── app/
│   ├── actions.ts          # Server actions for file processing
│   ├── api/
│   │   └── preview/        # API route for audio preview streaming
│   ├── page.tsx            # Main application page
│   └── layout.tsx          # Root layout
├── components/
│   └── Dashboard.tsx       # Main dashboard component
├── lib/
│   └── audio.ts            # Audio processing utilities
├── public/                 # Static assets
├── .env.example            # Environment configuration template
└── package.json

External directories (configured via .env):
├── audio_raw/              # Raw audio files (input)
│   └── .preview/          # Generated preview files
└── audio_processed/        # Processed audio files (output)
```

## How It Works

1. **Upload**: Place audio files in your `AUDIO_RAW_DIR` or upload through the web interface
2. **Select**: Choose files from the dashboard
3. **Configure**: Set processing options:
   - Convert to MP3
   - Set custom bitrate (e.g., 192k, 128k)
   - Specify target file size (MB)
   - Enable segmentation (split into chunks)
4. **Preview**: Generate a 15-second preview to test settings
5. **Process**: Apply settings to the full audio file
6. **Download**: Retrieve processed files from `AUDIO_PROCESSED_DIR`

## API Routes

### Preview Generation
```
GET /api/preview?file={filename}
```
Streams preview audio files for in-browser playback.

## Server Actions

- `getAudioFiles()`: List all audio files in the raw directory
- `processAudio(options)`: Process an audio file with specified options
- `uploadFiles(formData)`: Handle file uploads
- `generatePreview(fileName, bitrate?, targetSize?)`: Create preview clips
- `downloadYouTubeAudio(url)`: Download audio from YouTube (experimental)

## Configuration Options

### Processing Options

| Option | Type | Description |
|--------|------|-------------|
| `fileName` | string | Name of the file to process |
| `convert` | boolean | Convert to MP3 format |
| `bitrate` | string | Audio bitrate (e.g., "192", "128") |
| `targetSize` | number | Target file size in MB (auto-calculates bitrate) |
| `segment` | boolean | Enable file segmentation |
| `segmentDuration` | number | Segment length in minutes |

## Troubleshooting

### FFmpeg not found
Ensure FFmpeg is installed and available in your system PATH:
```bash
ffmpeg -version
```

### Permission errors
Make sure the application has read/write permissions for the configured directories:
```bash
chmod 755 /path/to/audio_raw
chmod 755 /path/to/audio_processed
```

### File not processing
Check the console logs for detailed FFmpeg output. The application logs all processing steps.

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Technologies Used

- **[Next.js 16](https://nextjs.org/)** - React framework with App Router
- **[React 19](https://react.dev/)** - UI library
- **[FFmpeg](https://ffmpeg.org/)** - Audio/video processing
- **[fluent-ffmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)** - Node.js FFmpeg wrapper
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling
- **[Lucide React](https://lucide.dev/)** - Icons
- **TypeScript** - Type safety

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Built with Next.js and FFmpeg
- Icons by Lucide

## Support

For issues, questions, or suggestions, please [open an issue](https://github.com/adam7rans/4udio7ool/issues) on GitHub.
