'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Upload, FileAudio, Check, Settings, Scissors, HardDrive, Trash2, Download, Play, Pause } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getAudioFiles, processAudio, uploadFiles, downloadYouTubeAudio, generatePreview } from '@/app/actions';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface AudioFile {
    name: string;
    size: number;
    duration?: number; // duration in seconds
}

export default function Dashboard() {
    const [files, setFiles] = useState<AudioFile[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [settings, setSettings] = useState({
        convert: true,
        segment: false,
        segmentDuration: 10,
        targetSizeEnabled: false,
        targetSize: 5,
        bitrate: "192", // Default bitrate
        compressionMode: 'bitrate', // 'bitrate' or 'size'
    });
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [downloading, setDownloading] = useState(false);
    const [downloadStatus, setDownloadStatus] = useState<string>('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const audioRef = React.useRef<HTMLAudioElement>(null);

    // Helper to just get files without setting state, or we can use it to set state
    const fetchFiles = useCallback(async () => {
        const res = await getAudioFiles();
        if (res.success && res.files) {
            setFiles(res.files);
        }
        return res.success ? res.files : [];
    }, []);


    // useEffect(() => {
    //   fetchFiles();
    // }, [fetchFiles]);


    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(e.dataTransfer.files);
            const formData = new FormData();
            droppedFiles.forEach((file) => {
                formData.append('files', file);
            });

            setUploading(true);
            const res = await uploadFiles(formData);
            setUploading(false);

            if (res.success) {
                // Get updated list from server to get durations
                const res = await getAudioFiles();
                if (res.success && res.files) {
                    // Filter to only the files we just dropped
                    const droppedNames = new Set(droppedFiles.map(f => f.name));
                    const filteredFiles = res.files.filter(f => droppedNames.has(f.name));

                    setFiles(filteredFiles);
                    const newFileNames = filteredFiles.map(f => f.name);
                    setSelectedFiles(new Set(newFileNames));
                } else {
                    // Fallback if server list fails (unlikely)
                    const newFiles = droppedFiles.map(f => ({ name: f.name, size: f.size }));
                    setFiles(newFiles);
                    setSelectedFiles(new Set(newFiles.map(f => f.name)));
                }
            } else {
                alert('Upload failed');
            }
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFilesList = Array.from(e.target.files);
            const formData = new FormData();
            selectedFilesList.forEach((file) => {
                formData.append('files', file);
            });

            setUploading(true);
            const res = await uploadFiles(formData);
            setUploading(false);

            if (res.success) {
                // Get updated list from server to get durations
                const res = await getAudioFiles();
                if (res.success && res.files) {
                    // Filter to only the files we just selected
                    const selectedNames = new Set(selectedFilesList.map(f => f.name));
                    const filteredFiles = res.files.filter(f => selectedNames.has(f.name));

                    setFiles(filteredFiles);
                    const newFileNames = filteredFiles.map(f => f.name);
                    setSelectedFiles(new Set(newFileNames));
                } else {
                    // Fallback
                    const newFiles = selectedFilesList.map(f => ({ name: f.name, size: f.size }));
                    setFiles(newFiles);
                    setSelectedFiles(new Set(newFiles.map(f => f.name)));
                }
            } else {
                alert('Upload failed');
            }
        }
        // Reset input so same file selection works again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const toggleFile = (name: string) => {
        const next = new Set(selectedFiles);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        setSelectedFiles(next);
    };

    const selectAll = () => {
        if (selectedFiles.size === files.length) setSelectedFiles(new Set());
        else setSelectedFiles(new Set(files.map(f => f.name)));
    };

    const clearList = () => {
        setFiles([]);
        setSelectedFiles(new Set());
        setLogs([]);
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const runProcessing = async () => {
        if (selectedFiles.size === 0) return;
        setIsProcessing(true);
        setLogs(prev => [...prev, 'Starting processing...']);

        for (const fileName of Array.from(selectedFiles)) {
            setLogs(prev => [...prev, `Processing ${fileName}...`]);
            const res = await processAudio({
                fileName,
                convert: settings.convert,
                segment: settings.segment,
                segmentDuration: settings.segment ? settings.segmentDuration : undefined,
                targetSize: settings.compressionMode === 'size' ? settings.targetSize : undefined,
                bitrate: settings.compressionMode === 'bitrate' ? settings.bitrate : undefined,
            });

            if (res.success) {
                setLogs(prev => [...prev, `✅ ${fileName} done`]);
            } else {
                setLogs(prev => [...prev, `❌ ${fileName} failed: ${res.error}`]);
            }
        }

        setIsProcessing(false);
        setLogs(prev => [...prev, 'All tasks finished.']);
    };

    const handleYouTubeDownload = async () => {
        if (!youtubeUrl.trim()) return;

        setDownloading(true);
        setDownloadStatus('Downloading audio from YouTube...');

        const result = await downloadYouTubeAudio(youtubeUrl) as { success: boolean; fileName?: string; error?: string };

        if (result.success && result.fileName) {
            setDownloadStatus('Download complete! Refreshing file list...');

            // Refresh file list and show only the downloaded file
            const filesRes = await getAudioFiles();
            if (filesRes.success && filesRes.files) {
                // Filter to only show the newly downloaded file
                const downloadedFileData = filesRes.files.find(f => f.name === result.fileName);
                if (downloadedFileData) {
                    setFiles([downloadedFileData]);
                    // Auto-select the newly downloaded file
                    setSelectedFiles(new Set([result.fileName]));
                    setDownloadStatus(`✅ ${result.fileName} ready to process`);
                }
            }

            // Clear URL and status after a delay
            setTimeout(() => {
                setYoutubeUrl('');
                setDownloadStatus('');
            }, 3000);
        } else {
            setDownloadStatus(`❌ ${result.error || 'Download failed'}`);
            setTimeout(() => {
                setDownloadStatus('');
            }, 5000);
        }

        setDownloading(false);
    };

    const handleGeneratePreview = async () => {
        if (selectedFiles.size !== 1) return; // Only works with one file selected

        const fileName = Array.from(selectedFiles)[0];
        setIsGeneratingPreview(true);

        const result = await generatePreview(
            fileName,
            settings.compressionMode === 'bitrate' ? settings.bitrate : undefined,
            settings.compressionMode === 'size' ? settings.targetSize : undefined
        ) as { success: boolean; previewFileName?: string; error?: string };

        if (result.success && result.previewFileName) {
            // Create a preview URL that can be served from the public folder or via API route
            const previewPath = `/api/preview?file=${encodeURIComponent(result.previewFileName)}`;
            setPreviewUrl(previewPath);
        }

        setIsGeneratingPreview(false);
    };

    const togglePreviewPlayback = () => {
        if (!audioRef.current) return;

        if (isPlayingPreview) {
            audioRef.current.pause();
            setIsPlayingPreview(false);
        } else {
            audioRef.current.play();
            setIsPlayingPreview(true);
        }
    };

    // Clear preview when settings change
    React.useEffect(() => {
        setPreviewUrl(null);
        setIsPlayingPreview(false);
        if (audioRef.current) {
            audioRef.current.pause();
        }
    }, [settings.bitrate, settings.targetSize, settings.compressionMode]);


    return (
        <div className="max-w-4xl mx-auto p-6 space-y-8">
            <header className="text-center space-y-2">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                    Audio Processor
                </h1>
                <p className="text-zinc-400">Convert, Segment, Compress. Simple & Fast.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Files */}
                <div className="space-y-4">
                    {/* YouTube Download Section */}
                    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Download className="w-5 h-5 text-red-500" />
                            <h3 className="font-semibold text-zinc-200">Download from YouTube</h3>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={youtubeUrl}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !downloading) {
                                        handleYouTubeDownload();
                                    }
                                }}
                                placeholder="Paste YouTube URL here..."
                                disabled={downloading}
                                className={cn(
                                    "flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200",
                                    "placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors",
                                    downloading && "opacity-50 cursor-not-allowed"
                                )}
                            />
                            <button
                                onClick={handleYouTubeDownload}
                                disabled={downloading || !youtubeUrl.trim()}
                                className={cn(
                                    "px-6 py-2.5 rounded-lg font-medium text-sm transition-all",
                                    downloading || !youtubeUrl.trim()
                                        ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                        : "bg-red-600 text-white hover:bg-red-700"
                                )}
                            >
                                {downloading ? 'Downloading...' : 'Download'}
                            </button>
                        </div>

                        {downloadStatus && (
                            <div className={cn(
                                "text-sm p-3 rounded-lg border animate-in fade-in slide-in-from-top-2",
                                downloadStatus.startsWith('✅')
                                    ? "bg-green-500/10 border-green-500/20 text-green-400"
                                    : downloadStatus.startsWith('❌')
                                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                                        : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                            )}>
                                {downloadStatus}
                            </div>
                        )}
                    </div>

                    <div
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={cn(
                            "border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center transition-colors cursor-pointer",
                            "hover:border-blue-500 hover:bg-zinc-800/50",
                            uploading && "animate-pulse border-blue-500 bg-zinc-800/50"
                        )}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            multiple
                            className="hidden"
                            accept="audio/*, .mp3, .wav, .flac, .m4a, .aac, .ogg, .wma"
                        />
                        <Upload className="w-10 h-10 mx-auto mb-3 text-zinc-500" />
                        <p className="text-zinc-300 font-medium">Drop audio files here</p>
                        <p className="text-sm text-zinc-500 mt-1">{uploading ? 'Uploading...' : 'or click to browse'}</p>
                    </div>

                    {files.length > 0 && (
                        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex flex-col h-[400px]">
                            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                                <h3 className="font-semibold text-zinc-200">Files ({files.length})</h3>
                                <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300">
                                    {selectedFiles.size === files.length ? 'Deselect All' : 'Select All'}
                                </button>
                            </div>
                            <div className="overflow-y-auto flex-1 p-2 space-y-1">
                                {files.map(file => (
                                    <div
                                        key={file.name}
                                        onClick={() => toggleFile(file.name)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors group",
                                            selectedFiles.has(file.name) ? "bg-blue-500/10 border border-blue-500/20" : "hover:bg-zinc-800 border border-transparent"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                            selectedFiles.has(file.name) ? "bg-blue-500 border-blue-500" : "border-zinc-600 group-hover:border-zinc-500"
                                        )}>
                                            {selectedFiles.has(file.name) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-200 truncate">{file.name}</p>
                                            <p className="text-xs text-zinc-500">{formatSize(file.size)}</p>
                                        </div>
                                    </div>
                                ))}
                                {files.length === 0 && (
                                    <div className="text-center py-10 text-zinc-600">
                                        No files found. Drop some above!
                                    </div>
                                )}
                            </div>
                            <div className="p-2 border-t border-zinc-800 text-center">
                                <button onClick={clearList} className="text-xs flex items-center justify-center gap-1 w-full py-2 hover:bg-zinc-800 text-red-400 hover:text-red-300 rounded transition-colors">
                                    <Trash2 className="w-3 h-3" /> Clear List
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Settings & Actions */}
                <div className="space-y-6">
                    <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-6">
                        <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
                            <Settings className="w-4 h-4" /> Processing Settings
                        </h3>

                        {/* Convert Toggle */}
                        <div className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
                            <div className="flex items-center gap-3">
                                <FileAudio className="w-5 h-5 text-green-500" />
                                <div>
                                    <p className="text-sm font-medium text-zinc-200">Convert to MP3</p>
                                    <p className="text-xs text-zinc-500">Always active for compatibility</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={settings.convert}
                                disabled
                                className="w-5 h-5 bg-zinc-800 border-zinc-600 rounded opacity-50 cursor-not-allowed"
                            />
                        </div>

                        {/* Segment Toggle */}
                        <div className="space-y-3 p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Scissors className="w-5 h-5 text-orange-500" />
                                    <div>
                                        <p className="text-sm font-medium text-zinc-200">Cut into Segments</p>
                                        <p className="text-xs text-zinc-500">Split into smaller chunks</p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={settings.segment}
                                    onChange={e => setSettings({ ...settings, segment: e.target.checked })}
                                    className="w-5 h-5 bg-zinc-800 border-zinc-600 rounded focus:ring-blue-500"
                                />
                            </div>
                            {settings.segment && (
                                <div className="pt-2 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                                    <label className="text-sm text-zinc-400">Duration (mins):</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={settings.segmentDuration}
                                        onChange={e => setSettings({ ...settings, segmentDuration: parseInt(e.target.value) || 10 })}
                                        className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm w-20 text-zinc-200 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Compression Settings (Bitrate or Target Size) */}
                        <div className="space-y-3 p-3 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <HardDrive className="w-5 h-5 text-purple-500" />
                                    <div>
                                        <p className="text-sm font-medium text-zinc-200">Compression</p>
                                        <p className="text-xs text-zinc-500">Choose method</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setSettings({ ...settings, compressionMode: 'bitrate', targetSizeEnabled: false })}
                                    className={cn(
                                        "px-3 py-2 text-xs font-medium rounded-lg border transition-all",
                                        settings.compressionMode === 'bitrate'
                                            ? "bg-blue-500/10 border-blue-500 text-blue-400"
                                            : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                                    )}
                                >
                                    Fixed Bitrate
                                </button>
                                <button
                                    onClick={() => setSettings({ ...settings, compressionMode: 'size', targetSizeEnabled: true })}
                                    className={cn(
                                        "px-3 py-2 text-xs font-medium rounded-lg border transition-all",
                                        settings.compressionMode === 'size'
                                            ? "bg-purple-500/10 border-purple-500 text-purple-400"
                                            : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                                    )}
                                >
                                    Target Size
                                </button>
                            </div>

                            {/* Bitrate Selector */}
                            {settings.compressionMode === 'bitrate' && (
                                <div className="pt-2 animate-in fade-in slide-in-from-top-1 space-y-2">
                                    <div className="flex justify-between items-center text-xs text-zinc-400">
                                        <span>Quality (Kbps)</span>
                                        <span className={cn(
                                            parseInt(settings.bitrate) >= 192 ? "text-green-500" :
                                                parseInt(settings.bitrate) >= 128 ? "text-yellow-500" : "text-red-500"
                                        )}>
                                            {settings.bitrate} kbps
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="32"
                                        max="320"
                                        step="16" // approximated step, could be list
                                        value={settings.bitrate}
                                        onChange={(e) => {
                                            // Snap to common bitrates
                                            const val = parseInt(e.target.value);
                                            const common = [32, 48, 64, 96, 128, 160, 192, 256, 320];
                                            const closest = common.reduce((prev, curr) => Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev);
                                            setSettings({ ...settings, bitrate: closest.toString() });
                                        }}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                                        <span>32k</span>
                                        <span>128k</span>
                                        <span>192k</span>
                                        <span>320k</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 italic">
                                        Est. size: {settings.segment ? (
                                            <>~{((parseInt(settings.bitrate) / 8) * (settings.segmentDuration * 60) / 1024).toFixed(1)} MB per {settings.segmentDuration} min chunk</>
                                        ) : (
                                            <>
                                                {selectedFiles.size > 0 && files.some(f => selectedFiles.has(f.name) && f.duration) ? (
                                                    (() => {
                                                        const totalDuration = files
                                                            .filter(f => selectedFiles.has(f.name) && f.duration)
                                                            .reduce((acc, curr) => acc + (curr.duration || 0), 0);
                                                        const totalSizeMB = ((parseInt(settings.bitrate) / 8) * totalDuration / 1024);
                                                        return `~${totalSizeMB.toFixed(1)} MB total (${selectedFiles.size} files)`;
                                                    })()
                                                ) : (
                                                    <>~{((parseInt(settings.bitrate) / 8) * 60 / 1024).toFixed(1)} MB per min</>
                                                )}
                                            </>
                                        )}
                                    </p>
                                </div>
                            )}

                            {/* Target Size Input */}
                            {settings.compressionMode === 'size' && (
                                <div className="pt-2 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                                    <label className="text-sm text-zinc-400">Max Size (MB):</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={settings.targetSize}
                                        onChange={e => setSettings({ ...settings, targetSize: parseInt(e.target.value) || 5 })}
                                        className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-sm w-full text-zinc-200 focus:outline-none focus:border-purple-500"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Audio Preview Section */}
                    {selectedFiles.size === 1 && (
                        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-zinc-200 mb-1">Preview Compression</p>
                                    <p className="text-xs text-zinc-500">
                                        {previewUrl ? '15s preview ready' : 'Hear quality before processing'}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    {!previewUrl ? (
                                        <button
                                            onClick={handleGeneratePreview}
                                            disabled={isGeneratingPreview}
                                            className={cn(
                                                "px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2",
                                                isGeneratingPreview
                                                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                            )}
                                        >
                                            {isGeneratingPreview ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <Settings className="w-4 h-4" />
                                                    Generate Preview
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={togglePreviewPlayback}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-all flex items-center gap-2"
                                            >
                                                {isPlayingPreview ? (
                                                    <>
                                                        <Pause className="w-4 h-4" />
                                                        Pause
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play className="w-4 h-4" />
                                                        Play Preview
                                                    </>
                                                )}
                                            </button>
                                            <button
                                                onClick={handleGeneratePreview}
                                                disabled={isGeneratingPreview}
                                                className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-all"
                                                title="Regenerate preview"
                                            >
                                                <Settings className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Hidden audio element */}
                            {previewUrl && (
                                <audio
                                    ref={audioRef}
                                    src={previewUrl}
                                    onEnded={() => setIsPlayingPreview(false)}
                                    onPause={() => setIsPlayingPreview(false)}
                                    onPlay={() => setIsPlayingPreview(true)}
                                />
                            )}
                        </div>
                    )}

                    <button
                        onClick={runProcessing}
                        disabled={isProcessing || selectedFiles.size === 0}
                        className={cn(
                            "w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all",
                            isProcessing
                                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                                : selectedFiles.size === 0
                                    ? "bg-zinc-800 text-zinc-500 cursor-not-allowed hover:bg-zinc-800"
                                    : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 hover:shadow-blue-500/20"
                        )}
                    >
                        {isProcessing ? 'Processing Queue...' : `Process ${selectedFiles.size} Files`}
                    </button>

                    {/* Logs */}
                    <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4 h-48 overflow-y-auto font-mono text-xs text-zinc-400 space-y-1">
                        <div className="text-zinc-600 mb-2 uppercase tracking-wider text-[10px] font-bold">Activity Log</div>
                        {logs.length === 0 && <span className="text-zinc-700 italic">Ready...</span>}
                        {logs.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="text-center text-xs text-zinc-600 pb-10">
                Files will be saved to <code className="text-zinc-500 bg-zinc-900 px-1 rounded">audio_processed</code>
            </div>
        </div>
    );
}
