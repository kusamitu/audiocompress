// Web Worker内でffmpeg.wasmを使用して音声ファイルを圧縮
// 注意: importScriptsは同期読み込みのため、CDNから直接読み込む場合は
// メインスレッドでロードしてからWorkerに渡す方が良い場合があります
// ここでは簡易的にimportScriptsを使用しますが、本番環境では適切なローダーを使用してください

// ffmpeg.wasmをロード（グローバルスコープにFFmpegが定義される）
importScripts('https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/umd/ffmpeg.js');

const MB = 1024 * 1024;
const MAX_SIZE = 100 * MB; // 100MB

let ffmpeg = null;
let isInitialized = false;

// ffmpeg.wasmの初期化
async function initFFmpeg() {
    if (isInitialized) return;
    
    // FFmpegがグローバルに定義されていることを確認（UMDバージョン）
    // self.FFmpeg または FFmpeg として定義される可能性がある
    const FFmpegLib = self.FFmpeg || self.FFmpeg || (typeof FFmpeg !== 'undefined' ? FFmpeg : null);
    
    if (!FFmpegLib) {
        throw new Error('FFmpegが読み込まれていません。CDNからの読み込みに失敗した可能性があります。');
    }
    
    const { createFFmpeg } = FFmpegLib;
    ffmpeg = createFFmpeg({
        corePath: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        log: true,
        progress: ({ ratio }) => {
            // 進捗をメインスレッドに送信
            self.postMessage({
                type: 'progress',
                progress: Math.floor(ratio * 100)
            });
        }
    });
    
    await ffmpeg.load();
    isInitialized = true;
}

// 音声ファイルを圧縮
async function compressAudio(fileData, fileName, originalSize) {
    try {
        // ffmpegを初期化
        self.postMessage({ type: 'status', message: 'ffmpegを初期化しています...' });
        await initFFmpeg();
        
        // ファイルを仮想ファイルシステムに書き込む
        self.postMessage({ type: 'status', message: 'ファイルを読み込んでいます...' });
        const inputFileName = 'input.' + fileName.split('.').pop();
        
        // fileDataは既にArrayBufferなので、Uint8Arrayに変換して書き込む
        // ffmpeg.FS('writeFile')はUint8Arrayを受け取る
        const fileBuffer = new Uint8Array(fileData);
        ffmpeg.FS('writeFile', inputFileName, fileBuffer);
        
        // 圧縮パラメータを計算
        const targetSize = MAX_SIZE - (5 * MB); // 安全マージン5MB
        const compressionRatio = targetSize / originalSize;
        
        // ビットレートを計算（目標サイズに基づいて）
        // おおよその計算: ビットレート ≈ (目標サイズ * 8) / 時間（秒）
        // ここでは、まず低いビットレートから開始
        let bitrate = 64000; // 64kbpsから開始
        
        if (compressionRatio < 0.4) {
            bitrate = 32000; // 32kbps
        } else if (compressionRatio < 0.6) {
            bitrate = 48000; // 48kbps
        } else if (compressionRatio < 0.8) {
            bitrate = 64000; // 64kbps
        } else {
            bitrate = 96000; // 96kbps
        }
        
        // 出力ファイル名
        const outputFileName = 'output.mp3';
        
        // ffmpegで圧縮実行
        self.postMessage({ type: 'status', message: '音声を圧縮しています...' });
        await ffmpeg.run(
            '-i', inputFileName,
            '-codec:a', 'libmp3lame',
            '-b:a', `${bitrate}`,
            '-ar', '44100', // サンプリングレート
            '-ac', '2', // ステレオ
            outputFileName
        );
        
        // 圧縮後のファイルを読み込む
        self.postMessage({ type: 'status', message: '圧縮ファイルを読み込んでいます...' });
        const compressedData = ffmpeg.FS('readFile', outputFileName);
        
        // 仮想ファイルシステムからファイルを削除してメモリを解放
        ffmpeg.FS('unlink', inputFileName);
        ffmpeg.FS('unlink', outputFileName);
        
        // 結果を返す
        return {
            success: true,
            data: compressedData.buffer,
            size: compressedData.length
        };
        
    } catch (error) {
        // エラー発生時も仮想ファイルを削除
        try {
            if (ffmpeg) {
                const files = ffmpeg.FS('readdir', '/');
                files.forEach(file => {
                    if (file !== '.' && file !== '..') {
                        try {
                            ffmpeg.FS('unlink', file);
                        } catch (e) {
                            // 無視
                        }
                    }
                });
            }
        } catch (cleanupError) {
            // 無視
        }
        
        return {
            success: false,
            error: error.message || '圧縮処理中にエラーが発生しました'
        };
    }
}

// メインスレッドからのメッセージを受信
self.addEventListener('message', async (e) => {
    const { type, fileData, fileName, originalSize } = e.data;
    
    if (type === 'compress') {
        const result = await compressAudio(fileData, fileName, originalSize);
        self.postMessage({
            type: 'result',
            ...result
        });
    }
});

