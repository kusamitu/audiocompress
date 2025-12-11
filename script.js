const MB = 1024 * 1024;
const MAX_SIZE = 100 * MB; // 100MB
const MAX_FILE_SIZE = 500 * MB; // 処理可能な最大ファイルサイズ（500MB）- ffmpeg.wasm使用により拡大
const SAFE_PROCESSING_SIZE = 200 * MB; // 安全に処理できるサイズ（200MB）

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileSelectBtn = document.getElementById('fileSelectBtn');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const fileType = document.getElementById('fileType');
const message = document.getElementById('message');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const resultContainer = document.getElementById('resultContainer');
const resultMessage = document.getElementById('resultMessage');
const warningBox = document.getElementById('warningBox');
const originalSize = document.getElementById('originalSize');
const compressedSize = document.getElementById('compressedSize');
const compressionRatio = document.getElementById('compressionRatio');

let currentFile = null;
let compressedBlob = null;
let isProcessing = false;
let ffmpeg = null;
let isFFmpegLoaded = false;

// ファイル選択ボタンのイベント
fileSelectBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// ドラッグ&ドロップのイベント
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// ファイルサイズをフォーマット
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < MB) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / MB).toFixed(2) + ' MB';
}

// ファイルを処理
function handleFile(file) {
    // FFmpegが読み込まれているかチェック
    if (typeof FFmpeg === 'undefined') {
        const isLocalFile = window.location.protocol === 'file:';
        
        const errorMsg = `
            <strong>⚠️ エラー: FFmpegが読み込まれていません</strong><br><br>
            ffmpeg.wasmはSharedArrayBufferを使用するため、Cross-Origin Isolationが必要です。<br><br>
            <strong>解決方法:</strong><br>
            1. ローカルサーバーで実行: 「サーバー起動.bat」をダブルクリック<br>
            2. または、GitHub Pagesなどのホスティングサービスで公開<br>
            3. ブラウザで <code style="background: #f0f0f0; padding: 2px 5px; border-radius: 3px;">http://localhost:8000</code> にアクセス
        `;
        showMessage(errorMsg, 'error');
        warningBox.style.display = 'block';
        warningBox.innerHTML = `
            <strong>⚠️ 重要:</strong>
            <p>このツールを使用するには、ローカルサーバーで実行する必要があります。</p>
            <p><strong>手順:</strong></p>
            <ol style="margin-left: 20px; margin-top: 10px;">
                <li>コマンドプロンプトを開く（Windowsキー + R → cmd）</li>
                <li>このHTMLファイルがあるフォルダに移動${folderPath ? `:<br><code style="background: #f0f0f0; padding: 2px 5px; border-radius: 3px; display: inline-block; margin-top: 5px;">cd "${folderPath}"</code>` : ''}</li>
                <li><code style="background: #f0f0f0; padding: 2px 5px; border-radius: 3px;">python -m http.server 8000</code> を実行</li>
                <li>ブラウザで <code style="background: #f0f0f0; padding: 2px 5px; border-radius: 3px;">http://localhost:8000</code> にアクセス</li>
            </ol>
        `;
        return;
    }
    
    // 既に処理中の場合は無視
    if (isProcessing) {
        showMessage('処理中です。完了するまでお待ちください。', 'info');
        return;
    }
    
    currentFile = file;
    
    // ファイル情報を表示
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileType.textContent = file.type || '不明';
    fileInfo.style.display = 'block';
    
    // メッセージと結果をリセット
    message.style.display = 'none';
    progressContainer.style.display = 'none';
    resultContainer.style.display = 'none';
    
    // 100MB未満の場合は圧縮不要
    if (file.size < MAX_SIZE) {
        showMessage('このファイルは100MB未満のため、圧縮の必要はありません。', 'warning');
        warningBox.style.display = 'none';
        return;
    }
    
    // ファイルサイズの上限チェック
    if (file.size > MAX_FILE_SIZE) {
        showMessage(`ファイルサイズが大きすぎます（最大${formatFileSize(MAX_FILE_SIZE)}まで対応）。より大きなファイルは処理できません。ファイルを分割してから処理してください。`, 'error');
        warningBox.style.display = 'block';
        warningBox.innerHTML = `
            <strong>⚠️ 重要:</strong>
            <p>このファイル（${formatFileSize(file.size)}）は大きすぎて処理できません。</p>
            <p><strong>推奨される解決方法:</strong></p>
            <ol style="margin-left: 20px; margin-top: 10px;">
                <li>音声編集ソフトウェアを使用してファイルを分割する</li>
                <li>分割したファイルを個別に圧縮する</li>
            </ol>
            <p style="margin-top: 10px;"><strong>注意:</strong> このツールは音声ファイルを圧縮します。圧縮により音質が低下する可能性があります。</p>
        `;
        return;
    }
    
    // 大きなファイルの場合は警告を表示
    if (file.size > SAFE_PROCESSING_SIZE) {
        warningBox.style.display = 'block';
        warningBox.innerHTML = `
            <strong>⚠️ 注意:</strong>
            <p>大きなファイル（${formatFileSize(file.size)}）の処理には時間がかかる場合があります。</p>
            <p><strong>重要:</strong> このツールはffmpeg.wasmを使用して圧縮します。処理中はブラウザを閉じないでください。</p>
        `;
    } else {
        warningBox.style.display = 'block';
        warningBox.innerHTML = `
            <strong>⚠️ 注意:</strong>
            <p>このツールは音声ファイルを圧縮します。圧縮により音質が低下する可能性があります。</p>
            <p>処理中はブラウザを閉じないでください。</p>
        `;
    }
    
    // 圧縮処理を開始
    compressFile(file);
}

// メッセージを表示
function showMessage(text, type) {
    // HTMLタグが含まれている場合はinnerHTMLを使用
    if (text.includes('<br>') || text.includes('<strong>') || text.includes('<code>')) {
        message.innerHTML = text;
    } else {
        message.textContent = text;
    }
    message.className = `message ${type}`;
    message.style.display = 'block';
}

// 進捗を更新
function updateProgress(percent, text) {
    progressContainer.style.display = 'block';
    progressFill.style.width = percent + '%';
    progressText.textContent = text || `処理中... ${percent.toFixed(1)}%`;
}

// FFmpegの読み込みを待つ
async function waitForFFmpeg(maxWaitTime = 5000) {
    const startTime = Date.now();
    
    // 既に読み込まれている場合は即座に返す
    if (typeof FFmpeg !== 'undefined') {
        return FFmpeg;
    }
    
    // 読み込まれるまで待つ
    while (typeof FFmpeg === 'undefined') {
        if (Date.now() - startTime > maxWaitTime) {
            // タイムアウト時は、より詳細なエラーメッセージを表示
            const isLocalFile = window.location.protocol === 'file:';
            if (isLocalFile) {
                throw new Error('ローカルファイルとして開いているため、FFmpegが読み込めません。ローカルサーバーで実行してください。\n\n解決方法:\n1. コマンドプロンプトでこのフォルダに移動\n2. python -m http.server 8000 を実行\n3. ブラウザで http://localhost:8000 にアクセス');
            } else {
                throw new Error('FFmpegの読み込みがタイムアウトしました。ブラウザのトラッキング防止機能がブロックしている可能性があります。\n\n解決方法:\n1. ローカルサーバーで実行する（推奨）\n2. ブラウザのトラッキング防止設定を変更する');
            }
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return FFmpeg;
}

// ffmpeg.wasmの初期化
async function initFFmpeg() {
    if (isFFmpegLoaded && ffmpeg) return;
    
    try {
        updateProgress(0, 'ffmpeg.wasmを読み込んでいます...');
        
        // FFmpegがグローバルに定義されるまで待つ
        const FFmpegLib = await waitForFFmpeg();
        
        if (!FFmpegLib) {
            throw new Error('FFmpegが読み込まれていません。ページを再読み込みしてください。');
        }
        
        const { createFFmpeg, fetchFile } = FFmpegLib;
        ffmpeg = createFFmpeg({
            // jsDelivr CDNを使用（より信頼性が高い）
            corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
            log: true,
            progress: ({ ratio }) => {
                // 進捗を更新
                const progressPercent = Math.floor(ratio * 100);
                updateProgress(progressPercent, `圧縮中... ${progressPercent}%`);
            }
        });
        
        updateProgress(5, 'ffmpeg.wasmを初期化しています（初回は時間がかかります）...');
        await ffmpeg.load();
        isFFmpegLoaded = true;
        
    } catch (error) {
        console.error('FFmpeg初期化エラー:', error);
        let errorMessage = 'ffmpeg.wasmの初期化に失敗しました。';
        
        if (error.message.includes('タイムアウト') || error.message.includes('読み込めません')) {
            // エラーメッセージに改行を含める場合は、HTMLに変換
            errorMessage = error.message.replace(/\n/g, '<br>');
        } else if (error.message.includes('CORS') || error.message.includes('Tracking Prevention')) {
            errorMessage = 'ブラウザのトラッキング防止機能により、CDNからの読み込みがブロックされています。<br><br><strong>解決方法:</strong><br>1. ローカルサーバーで実行する（推奨）<br>2. ブラウザの設定を変更する';
        } else {
            errorMessage = error.message || 'ffmpeg.wasmの初期化に失敗しました。';
        }
        
        throw new Error(errorMessage);
    }
}

// 音声ファイルを圧縮（ffmpeg.wasmを使用）
async function compressFile(file) {
    isProcessing = true;
    
    try {
        // ffmpegを初期化
        await initFFmpeg();
        
        updateProgress(10, 'ファイルを読み込んでいます...');
        
        // ファイルを仮想ファイルシステムに書き込む
        const inputFileName = 'input.' + file.name.split('.').pop();
        
        // fetchFileを使用してファイルを読み込む（メモリ効率的）
        // FFmpegがグローバルに定義されていることを確認
        if (typeof FFmpeg === 'undefined') {
            throw new Error('FFmpegが読み込まれていません。');
        }
        
        const { fetchFile } = FFmpeg;
        await ffmpeg.FS('writeFile', inputFileName, await fetchFile(file));
        
        updateProgress(30, '圧縮パラメータを計算しています...');
        
        // 圧縮パラメータを計算
        const originalSize = file.size;
        const targetSize = MAX_SIZE - (5 * MB); // 安全マージン5MB
        const compressionRatio = targetSize / originalSize;
        
        // ビットレートを計算
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
        updateProgress(40, '音声を圧縮しています（この処理には時間がかかります）...');
        await ffmpeg.run(
            '-i', inputFileName,
            '-codec:a', 'libmp3lame',
            '-b:a', `${bitrate}`,
            '-ar', '44100', // サンプリングレート
            '-ac', '2', // ステレオ
            outputFileName
        );
        
        // 圧縮後のファイルを読み込む
        updateProgress(90, '圧縮ファイルを読み込んでいます...');
        const compressedData = ffmpeg.FS('readFile', outputFileName);
        
        // 仮想ファイルシステムからファイルを削除してメモリを解放
        try {
            ffmpeg.FS('unlink', inputFileName);
            ffmpeg.FS('unlink', outputFileName);
        } catch (cleanupError) {
            console.warn('ファイル削除エラー（無視）:', cleanupError);
        }
        
        updateProgress(100, '圧縮が完了しました！');
        
        // 結果を保存
        compressedBlob = new Blob([compressedData.buffer], { type: 'audio/mpeg' });
        
        // 結果を表示
        showResult(file.size, compressedData.length, file.name);
        
    } catch (error) {
        console.error('エラー:', error);
        let errorMessage = 'エラーが発生しました。';
        
        if (error.message) {
            errorMessage = error.message;
        } else if (error.name === 'QuotaExceededError' || error.name === 'RangeError' || 
                   (error.message && (error.message.includes('memory') || error.message.includes('メモリ') ||
                   error.message.includes('Out of Memory') || error.message.includes('out of memory')))) {
            errorMessage = 'メモリ不足のため処理できませんでした。ファイルを分割してから処理してください。';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'このブラウザでは必要な機能がサポートされていません。';
        } else if (error.message && error.message.includes('Tracking Prevention')) {
            errorMessage = 'ブラウザのトラッキング防止機能により、CDNからの読み込みがブロックされています。\n\n解決方法:\n1. ローカルサーバー（例: Pythonのhttp.server）で実行する\n2. ブラウザの設定でトラッキング防止を無効にする\n3. 別のブラウザで試す';
        } else if (error.message && error.message.includes('CORS')) {
            errorMessage = 'CORSエラーが発生しました。ローカルサーバーで実行してください。';
        }
        
        showMessage(errorMessage, 'error');
        progressContainer.style.display = 'none';
        
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
    } finally {
        isProcessing = false;
    }
}

// 結果を表示
function showResult(originalSizeBytes, compressedSizeBytes, originalFileName) {
    const originalSizeFormatted = formatFileSize(originalSizeBytes);
    const compressedSizeFormatted = formatFileSize(compressedSizeBytes);
    const ratio = ((1 - compressedSizeBytes / originalSizeBytes) * 100).toFixed(1);
    
    originalSize.textContent = originalSizeFormatted;
    compressedSize.textContent = compressedSizeFormatted;
    compressionRatio.textContent = `${ratio}% 削減`;
    
    if (compressedSizeBytes < MAX_SIZE) {
        resultMessage.textContent = `圧縮が完了しました。ファイルサイズは100MB未満になりました。`;
    } else {
        resultMessage.textContent = `圧縮を試みましたが、100MB未満にするにはさらなる圧縮が必要です。現在のサイズ: ${compressedSizeFormatted}`;
    }
    
    resultContainer.style.display = 'block';
}

// ダウンロード処理
async function downloadFile() {
    if (!compressedBlob) return;
    
    try {
        const baseName = currentFile.name.replace(/\.[^/.]+$/, '');
        
        // ffmpeg.wasmはMP3形式で出力するため、拡張子を.mp3に設定
        const fileName = `${baseName}_compressed.mp3`;
        
        // File System Access APIが利用可能かチェック
        if (window.showSaveFilePicker) {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: '圧縮された音声ファイル',
                        accept: { 'audio/mpeg': ['.mp3'] }
                    }]
                });
                
                const writable = await fileHandle.createWritable();
                await writable.write(compressedBlob);
                await writable.close();
                
                showMessage('ファイルを保存しました。', 'success');
            } catch (error) {
                if (error.name !== 'AbortError') {
                    throw error;
                }
            }
        } else {
            // フォールバック: 通常のダウンロード
            const url = URL.createObjectURL(compressedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showMessage('ダウンロードを開始しました。', 'success');
        }
    } catch (error) {
        console.error('エラー:', error);
        showMessage(`ダウンロードエラー: ${error.message}`, 'error');
    }
}

// イベントリスナーを設定
function initEventListeners() {
    const downloadBtn = document.getElementById('downloadBtn');
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadFile);
    }
}

// Cross-Origin Isolationの状態をチェック
function checkCrossOriginIsolation() {
    // SharedArrayBufferが利用可能かチェック
    if (typeof SharedArrayBuffer === 'undefined') {
        return {
            available: false,
            reason: 'SharedArrayBufferが利用できません。Cross-Origin Isolationが有効になっていない可能性があります。'
        };
    }
    
    // Cross-Origin Isolationのヘッダーが設定されているかチェック
    const crossOriginIsolated = window.crossOriginIsolated;
    if (!crossOriginIsolated) {
        return {
            available: false,
            reason: 'Cross-Origin Isolationが有効になっていません。COI ServiceWorkerが正しく動作していない可能性があります。'
        };
    }
    
    return {
        available: true,
        reason: null
    };
}

// FFmpegの読み込み状態をチェック
function checkFFmpegLoaded() {
    // ページ読み込み後、少し待ってからチェック
    setTimeout(() => {
        const isLocalFile = window.location.protocol === 'file:';
        const coiStatus = checkCrossOriginIsolation();
        const ffmpegLoaded = typeof FFmpeg !== 'undefined';
        
        if (!ffmpegLoaded || !coiStatus.available) {
            // アップロードエリアを無効化
            uploadArea.style.opacity = '0.6';
            uploadArea.style.pointerEvents = 'none';
            uploadArea.style.cursor = 'not-allowed';
            
            let warningMsg = '<strong>⚠️ 重要: FFmpegが読み込まれていません</strong>';
            
            if (!coiStatus.available) {
                warningMsg += `<p>${coiStatus.reason}</p>`;
            }
            
            if (!ffmpegLoaded) {
                warningMsg += '<p>FFmpegライブラリが読み込まれていません。</p>';
            }
            
            warningMsg += `
                <p><strong>解決方法:</strong></p>
                <p style="margin-top: 10px;"><strong>方法1: ローカルサーバーで実行（推奨）</strong></p>
                <ol style="margin-left: 20px; margin-top: 5px;">
                    <li>このフォルダにある「<code style="background: #f0f0f0; padding: 2px 5px; border-radius: 3px;">サーバー起動.bat</code>」をダブルクリック</li>
                    <li>ブラウザで <code style="background: #f0f0f0; padding: 2px 5px; border-radius: 3px;">http://localhost:8000</code> にアクセス</li>
                    <li>COI ServiceWorkerが自動的にCross-Origin Isolationを有効にします</li>
                    <li>ページを再読み込みしてください</li>
                </ol>
                <p style="margin-top: 15px;"><strong>方法2: GitHub Pagesでホスティング（不特定多数向け）</strong></p>
                <ol style="margin-left: 20px; margin-top: 5px;">
                    <li>GitHubリポジトリを作成</li>
                    <li>このフォルダのファイルをアップロード</li>
                    <li>GitHub Pagesで公開（Settings → Pages）</li>
                    <li>公開されたURLにアクセス</li>
                </ol>
                ${isLocalFile ? '<p style="margin-top: 15px; color: #d32f2f; font-weight: bold;">現在、ローカルファイルとして開いています。ローカルサーバーまたはホスティングサービスで実行してください。</p>' : ''}
            `;
            
            warningBox.innerHTML = warningMsg;
            warningBox.style.display = 'block';
            warningBox.style.background = '#ffebee';
            warningBox.style.borderLeft = '4px solid #d32f2f';
            warningBox.style.color = '#c62828';
            
            // アップロードエリアにメッセージを追加
            const uploadContent = uploadArea.querySelector('.upload-content');
            if (uploadContent && !uploadContent.querySelector('.error-message')) {
                const errorMsg = document.createElement('div');
                errorMsg.className = 'error-message';
                errorMsg.style.color = '#d32f2f';
                errorMsg.style.marginTop = '10px';
                errorMsg.style.fontWeight = 'bold';
                errorMsg.textContent = '⚠️ FFmpegが読み込まれていません。ローカルサーバーで実行してください。';
                uploadContent.appendChild(errorMsg);
            }
        } else {
            // FFmpegが読み込まれている場合、アップロードエリアを有効化
            uploadArea.style.opacity = '1';
            uploadArea.style.pointerEvents = 'auto';
            uploadArea.style.cursor = 'pointer';
            
            // 成功メッセージを表示（オプション）
            console.log('FFmpeg loaded successfully. Cross-Origin Isolation is enabled.');
        }
    }, 3000); // 3秒後にチェック（FFmpegの読み込みを待つ）
}

// DOMContentLoadedまたは即座に実行
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initEventListeners();
        checkFFmpegLoaded();
    });
} else {
    initEventListeners();
    checkFFmpegLoaded();
}

