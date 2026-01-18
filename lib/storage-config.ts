import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

interface Config {
    downloadDirectory: string;
}

const DEFAULT_CONFIG: Config = {
    downloadDirectory: path.join(process.cwd(), '4udio7ool_audio', 'downloads')
};

export function getConfig(): Config {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
            const data = JSON.parse(raw);
            return {
                ...DEFAULT_CONFIG,
                ...data
            };
        }
    } catch (e) {
        console.error('Failed to read config:', e);
    }
    return DEFAULT_CONFIG;
}

export function saveConfig(config: Partial<Config>) {
    try {
        const current = getConfig();
        const newConfig = { ...current, ...config };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
        return newConfig;
    } catch (e) {
        console.error('Failed to save config:', e);
        throw e;
    }
}

export function getDownloadDirectory(): string {
    const config = getConfig();
    // Prioritize Env Var if set, for backward compatibility or override
    return process.env.AUDIO_RAW_DIR || config.downloadDirectory;
}
