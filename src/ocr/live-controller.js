/**
 * ライブOCR制御モジュール
 * 700msタイマー + 安定検知 + ロック管理
 */
import { initOCR, recognizeROI, isFrameStable } from './engine.js';
import { extractPriceCandidates, extractQuantityCandidates } from './extractor.js';
import { CandidateScorer } from './scorer.js';

const OCR_INTERVAL = 700; // ms

export class LiveOCRController {
    constructor() {
        this._video = null;
        this._roi = null;
        this._timer = null;
        this._isProcessing = false;
        this._prevCanvas = null;
        this._scorer = new CandidateScorer();
        this._unstableCount = 0; // 不安定フレーム連続カウント

        // ロック状態
        this._lockedPrice = null;
        this._lockedQuantity = null;

        // コールバック
        this._onCandidatesUpdate = null;
        this._onStatusChange = null;

        // 状態
        this._status = 'idle'; // idle | initializing | scanning | unstable | locked | error
        this._ocrReady = false;
    }

    /**
     * ライブOCR開始
     */
    async start(video, roi, { onCandidatesUpdate, onStatusChange }) {
        this._video = video;
        this._roi = roi;
        this._onCandidatesUpdate = onCandidatesUpdate;
        this._onStatusChange = onStatusChange;

        this._setStatus('initializing');

        try {
            await initOCR((info) => {
                if (info.status === 'loading tesseract core' || info.status === 'loading language traineddata') {
                    this._setStatus('initializing');
                }
            });
            this._ocrReady = true;
            this._setStatus('scanning');
            this._startTimer();
        } catch (err) {
            console.error('OCR init error:', err);
            this._setStatus('error', err.message || String(err));
        }
    }

    /**
     * 停止
     */
    stop() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
        this._setStatus('idle');
    }

    /**
     * ROI更新
     */
    updateROI(roi) {
        this._roi = roi;
    }

    /**
     * 価格ロック
     */
    lockPrice(candidate) {
        this._lockedPrice = candidate;
        this._updateLockStatus();
    }

    /**
     * 容量ロック
     */
    lockQuantity(candidate) {
        this._lockedQuantity = candidate;
        this._updateLockStatus();
    }

    /**
     * 価格ロック解除
     */
    unlockPrice() {
        this._lockedPrice = null;
        this._updateLockStatus();
    }

    /**
     * 容量ロック解除
     */
    unlockQuantity() {
        this._lockedQuantity = null;
        this._updateLockStatus();
    }

    /**
     * 全ロック解除 + スコアリングリセット
     */
    reset() {
        this._lockedPrice = null;
        this._lockedQuantity = null;
        this._scorer.clear();
        this._prevCanvas = null;
        this._updateLockStatus();
        if (this._onCandidatesUpdate) {
            this._onCandidatesUpdate({
                priceCandidates: [],
                quantityCandidates: [],
                unitPriceCandidates: [],
                lockedPrice: null,
                lockedQuantity: null,
            });
        }
    }

    get lockedPrice() { return this._lockedPrice; }
    get lockedQuantity() { return this._lockedQuantity; }
    get isBothLocked() { return this._lockedPrice != null && this._lockedQuantity != null; }

    // ── 内部 ──

    _startTimer() {
        this._timer = setInterval(() => this._tick(), OCR_INTERVAL);
    }

    async _tick() {
        if (!this._ocrReady || this._isProcessing) return;
        if (!this._video || this._video.readyState < 2) return;

        // OCR実行
        this._isProcessing = true;
        this._setStatus('scanning');

        try {
            const text = await recognizeROI(this._video, this._roi);
            if (!text || text.trim().length === 0) {
                this._isProcessing = false;
                return;
            }

            // 候補抽出
            const { priceCandidates, unitPriceCandidates } = extractPriceCandidates(text);
            const quantityCandidates = extractQuantityCandidates(text);

            // スコアリング（安定化）
            const scored = this._scorer.update({ priceCandidates, quantityCandidates });

            // コールバック（ロック済みの候補はそのまま保持）
            if (this._onCandidatesUpdate) {
                this._onCandidatesUpdate({
                    priceCandidates: scored.priceCandidates,
                    quantityCandidates: scored.quantityCandidates,
                    unitPriceCandidates,
                    lockedPrice: this._lockedPrice,
                    lockedQuantity: this._lockedQuantity,
                    rawText: text,
                });
            }
        } catch (err) {
            console.error('OCR tick error:', err);
        } finally {
            this._isProcessing = false;
        }
    }

    /**
     * ROI領域をCanvasにキャプチャ
     */
    _captureROI() {
        const canvas = document.createElement('canvas');
        const roi = this._roi;
        // 安定検知用は小さいサイズで十分
        const scale = 0.25;
        canvas.width = roi.width * scale;
        canvas.height = roi.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(
            this._video,
            roi.x, roi.y, roi.width, roi.height,
            0, 0, canvas.width, canvas.height
        );
        return canvas;
    }

    _updateLockStatus() {
        if (this._lockedPrice && this._lockedQuantity) {
            this._setStatus('locked');
        } else if (this._ocrReady) {
            this._setStatus('scanning');
        }
    }

    _setStatus(status, errorDetail) {
        if (this._status === status && !errorDetail) return;
        this._status = status;
        if (this._onStatusChange) {
            this._onStatusChange(status, errorDetail);
        }
    }
}
