"use client";

import React, { useState, useEffect } from 'react';
import { Download, Loader2, Youtube, FolderCog } from 'lucide-react';
import { toast } from 'sonner';
import { getAudioConfig, updateAudioConfig } from '@/app/actions';

interface Clip {
    id: string;
    start: string;
    end: string;
    sourceUrl: string;
}

export function ClipDownloader() {
    const [platform, setPlatform] = useState<'youtube' | 'kick'>('youtube');

    // Settings State
    const [showSettings, setShowSettings] = useState(false);
    const [downloadDir, setDownloadDir] = useState('');
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // Initial Config Load
    useEffect(() => {
        getAudioConfig().then(res => {
            if (res.success && res.config?.downloadDirectory) {
                setDownloadDir(res.config.downloadDirectory);
            }
        });
    }, []);

    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        try {
            const res = await updateAudioConfig({ downloadDirectory: downloadDir });
            if (res.success) {
                toast.success('Settings saved');
                setShowSettings(false);
            } else {
                toast.error(res.error || 'Failed to save settings');
            }
        } catch (e) {
            toast.error('Failed to save settings');
        } finally {
            setIsSavingSettings(false);
        }
    };

    // Platform defaults
    const defaults = {
        youtube: 'https://www.youtube.com/watch?v=wz85a0iP_vY',
        kick: 'https://kick.com/example-slug-123'
    };

    const [url, setUrl] = useState(defaults.youtube);
    const [currentStart, setCurrentStart] = useState('');
    const [currentEnd, setCurrentEnd] = useState('');

    // Separate clips or shared? The user asked for "tabs", implies separate context or just filter?
    // "create a kick tab and a youtube tab within the clip dl tab"
    // It's cleaner to just switch context.

    const [clips, setClips] = useState<Clip[]>([
        { id: '1', start: '32:37.2', end: '32:56.8', sourceUrl: 'https://www.youtube.com/watch?v=wz85a0iP_vY' }
    ]);
    const [lastPlatform, setLastPlatform] = useState<'youtube' | 'kick'>('youtube');

    // Switch default URL when tab changes if user hasn't typed much
    React.useEffect(() => {
        if (platform !== lastPlatform) {
            setUrl(defaults[platform]);
            setLastPlatform(platform);
        }
    }, [platform, lastPlatform, defaults]);

    const [isDownloading, setIsDownloading] = useState(false);
    const [processingIndex, setProcessingIndex] = useState<number | null>(null);

    const parseTime = (timeStr: string) => {
        const parts = timeStr.trim().split(':').map(Number);
        if (parts.some(isNaN)) return null;
        if (parts.length === 1) return parts[0];
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
        if (parts.length === 4) return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 1000;
        return null;
    };

    const handleAddClip = () => {
        const start = parseTime(currentStart);
        const end = parseTime(currentEnd);

        if (start === null || end === null) {
            toast.error('Invalid time format');
            return;
        }
        if (end <= start) {
            toast.error('End time must be after start');
            return;
        }

        setClips([...clips, {
            id: crypto.randomUUID(),
            start: currentStart,
            end: currentEnd,
            sourceUrl: url
        }]);
        setCurrentStart('');
        setCurrentEnd('');
    };

    const handleRemoveClip = (id: string) => {
        setClips(clips.filter(c => c.id !== id));
    };

    const handleCreateClips = async () => {
        if (clips.length === 0) {
            toast.error('No clips added');
            return;
        }

        try {
            setIsDownloading(true);

            // Access defaults to new /api/clip-dl
            const res = await fetch('/api/clip-dl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url, // Main URL (though clips have their own sourceUrl, the API expects a top level url usually or we handle per clip)
                    // My API implementation handles array of clips.
                    clips: clips
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to create clips');
            }

            const data = await res.json();

            if (data.success) {
                toast.success(`Successfully created ${data.processed} clips!`);
                // Don't clear clips immediately so user can adjust if needed? Or clear?
                // Source cleared it. I will clear it.
                setClips([]);
            } else {
                toast.error('Some clips failed to download');
            }

        } catch (error) {
            console.error('Creation error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to create clips');
        } finally {
            setIsDownloading(false);
            setProcessingIndex(null);
        }
    };

    return (
        <div className="p-6 bg-zinc-900 rounded-xl border border-zinc-800 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {/* Dynamic Icon based on active tab? Or just generic */}
                    {platform === 'youtube' ? <Youtube className="w-6 h-6 text-red-500" /> : <div className="w-6 h-6 bg-green-500 rounded-sm flex items-center justify-center font-bold text-black text-[10px]">K</div>}
                    <h3 className="text-lg font-medium text-white">Clip Downloader</h3>
                </div>

                {/* Platform Tabs */}
                <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                    <button
                        onClick={() => setPlatform('youtube')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${platform === 'youtube' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <Youtube className="w-3 h-3" /> YouTube
                    </button>
                    <button
                        onClick={() => setPlatform('kick')}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${platform === 'kick' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        <div className="w-3 h-3 bg-green-500 rounded-[1px] flex items-center justify-center text-black font-bold text-[8px] leading-none">K</div> Kick
                    </button>
                </div>
            </div>

            {/* Application Settings (Download Directory) */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
                >
                    <FolderCog className="w-3 h-3" />
                    {showSettings ? 'Hide Settings' : 'Settings'}
                </button>
            </div>

            {showSettings && (
                <div className="bg-zinc-950/50 border border-zinc-800 p-4 rounded-lg space-y-3">
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-zinc-400">Download Directory</label>
                        <div className="flex gap-2">
                            <input
                                value={downloadDir}
                                onChange={(e) => setDownloadDir(e.target.value)}
                                placeholder="/path/to/downloads"
                                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-blue-500 font-mono"
                            />
                            <button
                                onClick={handleSaveSettings}
                                disabled={isSavingSettings}
                                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-md transition-colors disabled:opacity-50"
                            >
                                {isSavingSettings ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                        <p className="text-[10px] text-zinc-600">
                            Absolute path where audio files will be saved. Ensure the server has write permissions.
                        </p>
                    </div>
                </div>
            )}



            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">{platform === 'youtube' ? 'YouTube' : 'Kick'} URL</label>
                    <input
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder={platform === 'youtube' ? "https://youtube.com/watch?v=..." : "https://kick.com/username..."}
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">Start Time</label>
                        <input
                            value={currentStart}
                            onChange={(e) => setCurrentStart(e.target.value)}
                            placeholder="00:00"
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-400">End Time</label>
                        <input
                            value={currentEnd}
                            onChange={(e) => setCurrentEnd(e.target.value)}
                            placeholder="00:10"
                            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <button
                    onClick={handleAddClip}
                    disabled={!currentStart || !currentEnd}
                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Add Clip to Queue
                </button>
            </div>

            {
                clips.length > 0 && (
                    <div className="space-y-3 pt-2 border-t border-zinc-800">
                        <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Queue ({clips.length})</label>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                            {clips.map(clip => (
                                <div key={clip.id} className="flex items-center justify-between text-sm bg-zinc-950 p-3 rounded-lg border border-zinc-800 group">
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <span className="font-mono text-zinc-300">{clip.start} - {clip.end}</span>
                                        <span className="text-[10px] text-zinc-600 truncate max-w-[250px] group-hover:text-zinc-500 transition-colors">
                                            {clip.sourceUrl}
                                        </span>
                                    </div>
                                    <button
                                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-all"
                                        onClick={() => handleRemoveClip(clip.id)}
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            <button
                onClick={handleCreateClips}
                disabled={isDownloading || clips.length === 0 || !url}
                className={`w-full py-3 ${platform === 'youtube' ? 'bg-red-600 hover:bg-red-700 shadow-red-900/20' : 'bg-green-600 hover:bg-green-700 shadow-green-900/20'} text-white rounded-lg font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
            >
                {isDownloading ? (
                    <>
                        <Loader2 className="animate-spin w-4 h-4" />
                        Processing...
                    </>
                ) : (
                    <>
                        <Download className="w-4 h-4" />
                        Download All Clips
                    </>
                )}
            </button>
        </div >
    );
}
