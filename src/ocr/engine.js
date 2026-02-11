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

    // 数字・英語のみ
    const w = await Tesseract.createWorker('eng', 1, {
        logger: (info) => {
            if (onProgress && info.progress != null) {
                onProgress(info);
            }
        },
    });

    // 数字・記号中心の認識に最適化
    await w.setParameters({
        tessedit_char_whitelist: '0123456789.,¥円gGkKmMlLpPcCxX×個本入袋本体税込抜あたりAbcdefghijklmnopqrstuvwxyz/ ',
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT, // 疎なテキスト（価格表など）に適したモード
    });

    return w;
}

/**
 * ROI領域を切り出してOCR実行
 */
export async function recognizeROI(video, roi) {
    if (!worker) throw new Error('OCR not initialized');

    const canvas = document.createElement('canvas');
    // 認識精度向上のため、画像を2倍に拡大
    const scale = 2.0;
    canvas.width = roi.width * scale;
    canvas.height = roi.height * scale;
    const ctx = canvas.getContext('2d');

    // 滑らかに拡大
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
        video,
        roi.x, roi.y, roi.width, roi.height,
        0, 0, canvas.width, canvas.height
    );

    // 前処理
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    preprocessImage(imageData);
    ctx.putImageData(imageData, 0, 0);

    const result = await worker.recognize(canvas);
    return result.data.text;
}

/**
 * 画像前処理（グレースケール + ガンマ補正 + コントラスト強調 + 簡易二値化）
 */
function preprocessImage(imageData) {
    const data = imageData.data;
    const len = data.length;

    // 1. グレースケール化
    for (let i = 0; i < len; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = data[i + 1] = data[i + 2] = gray;
    }

    // 2. コントラスト強調 (ヒストグラムストレッチに近い処理)
    // 明るい部分をより明るく、暗い部分をより暗く
    for (let i = 0; i < len; i += 4) {
        let val = data[i];
        // ガンマ補正 (gamma=0.5 で暗部を持ち上げ、gamma=1.5で締める。ここでは文字をはっきりさせるためS字カーブ的処理)
        if (val < 128) {
            val = val * 0.8; // 暗いところをより暗く
        } else {
            val = 255 - (255 - val) * 0.8; // 明るいところをより明るく
        }
        data[i] = data[i + 1] = data[i + 2] = val;
    }

    // 3. 簡易二値化 (固定閾値ではなく、近傍平均などを使いたいが重いので、やや高めの閾値でノイズ除去)
    // 文字（黒）と背景（白）を想定
    /*
    for (let i = 0; i < len; i += 4) {
      const val = data[i];
      const bin = val > 160 ? 255 : 0; // 閾値160
      data[i] = data[i+1] = data[i+2] = bin;
    }
    */
    // ※ 値札は白地に黒文字が多いが、黄色背景に赤文字などもあるため、単純二値化はリスクがある。
    // コントラスト強調だけに留める方が汎用的。
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
