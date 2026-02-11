/**
 * OCRエンジンラッパー
 * Tesseract.jsを使用してROI領域のOCRを実行
 * ※ Tesseract.js は index.html の <script> タグでグローバルに読み込み済み
 */

let worker = null;
let isInitializing = false;
let initPromise = null;

/**
 * Tesseract Worker の初期化
 */
export async function initOCR(onProgress) {
    if (worker) return worker;
    if (isInitializing) return initPromise;

    isInitializing = true;
    initPromise = _createWorker(onProgress);
    try {
        worker = await initPromise;
        return worker;
    } catch (err) {
        isInitializing = false;
        initPromise = null;
        throw err;
    }
}

async function _createWorker(onProgress) {
    // Tesseract.js がグローバルに読み込まれているか確認
    if (typeof Tesseract === 'undefined') {
        throw new Error('Tesseract.js が読み込まれていません。ネットワーク接続を確認してください。');
    }

    // 数字・英語のみ（価格や容量の読み取りに十分）
    const w = await Tesseract.createWorker('eng', 1, {
        logger: (info) => {
            if (onProgress && info.progress != null) {
                onProgress(info);
            }
        },
    });

    // 数字・記号中心の認識に最適化
    await w.setParameters({
        tessedit_char_whitelist: '0123456789.,¥円gGkKmMlLpPcCxX×個本入袋本体税込抜あたりAbcdefghijklmnopqrstuvwxyz ',
    });

    return w;
}

/**
 * ROI領域を切り出してOCR実行
 */
export async function recognizeROI(video, roi) {
    if (!worker) throw new Error('OCR not initialized');

    const canvas = document.createElement('canvas');
    canvas.width = roi.width;
    canvas.height = roi.height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
        video,
        roi.x, roi.y, roi.width, roi.height,
        0, 0, roi.width, roi.height
    );

    // 前処理
    const imageData = ctx.getImageData(0, 0, roi.width, roi.height);
    preprocessImage(imageData);
    ctx.putImageData(imageData, 0, 0);

    const result = await worker.recognize(canvas);
    return result.data.text;
}

/**
 * 画像前処理（コントラスト強調 + グレースケール）
 */
function preprocessImage(imageData) {
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const enhanced = gray < 128 ? Math.max(0, gray * 0.7) : Math.min(255, gray * 1.3);
        data[i] = data[i + 1] = data[i + 2] = enhanced;
    }
}

/**
 * 安定検知用ピクセル差分計算
 */
export function isFrameStable(prevCanvas, currCanvas, threshold = 0.05) {
    if (!prevCanvas || !currCanvas) return true;

    const w = Math.min(prevCanvas.width, currCanvas.width);
    const h = Math.min(prevCanvas.height, currCanvas.height);
    if (w === 0 || h === 0) return true;

    const prevCtx = prevCanvas.getContext('2d');
    const currCtx = currCanvas.getContext('2d');

    const sampleSize = 100;
    const stepX = Math.max(1, Math.floor(w / sampleSize));
    const stepY = Math.max(1, Math.floor(h / sampleSize));

    const prevData = prevCtx.getImageData(0, 0, w, h).data;
    const currData = currCtx.getImageData(0, 0, w, h).data;

    let diffCount = 0;
    let totalSamples = 0;

    for (let y = 0; y < h; y += stepY) {
        for (let x = 0; x < w; x += stepX) {
            const idx = (y * w + x) * 4;
            const diff = Math.abs(prevData[idx] - currData[idx])
                + Math.abs(prevData[idx + 1] - currData[idx + 1])
                + Math.abs(prevData[idx + 2] - currData[idx + 2]);
            if (diff > 60) diffCount++;
            totalSamples++;
        }
    }

    return (diffCount / totalSamples) <= threshold;
}

/**
 * Worker終了
 */
export async function terminateOCR() {
    if (worker) {
        await worker.terminate();
        worker = null;
    }
}
