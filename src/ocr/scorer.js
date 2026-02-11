/**
 * 候補スコアリングモジュール
 * 直近N回のOCR結果でスコアリングし、安定した候補を返す
 */

const BUFFER_SIZE = 5;

export class CandidateScorer {
    constructor() {
        this._priceBuffer = [];   // 直近N回の価格候補配列
        this._quantityBuffer = []; // 直近N回の容量候補配列
    }

    /**
     * 新しいフレームの候補を追加してスコアリング
     * @param {{ priceCandidates: Array, quantityCandidates: Array }} frameCandidates
     * @returns {{ priceCandidates: Array, quantityCandidates: Array }}
     */
    update(frameCandidates) {
        // バッファに追加
        this._priceBuffer.push(frameCandidates.priceCandidates || []);
        this._quantityBuffer.push(frameCandidates.quantityCandidates || []);

        // サイズ超過分を先頭から除去
        if (this._priceBuffer.length > BUFFER_SIZE) this._priceBuffer.shift();
        if (this._quantityBuffer.length > BUFFER_SIZE) this._quantityBuffer.shift();

        return {
            priceCandidates: this._scoreCandidates(this._priceBuffer, 'value'),
            quantityCandidates: this._scoreCandidates(this._quantityBuffer, 'value'),
        };
    }

    /**
     * 内部: バッファからスコアを集計
     */
    _scoreCandidates(buffer, keyField) {
        const countMap = new Map(); // key → { candidate, count, totalBaseScore }

        for (const frameCandidates of buffer) {
            for (const c of frameCandidates) {
                const key = String(c[keyField]);
                if (countMap.has(key)) {
                    const entry = countMap.get(key);
                    entry.count++;
                    entry.totalBaseScore = Math.max(entry.totalBaseScore, c.score || 0);
                } else {
                    countMap.set(key, {
                        candidate: { ...c },
                        count: 1,
                        totalBaseScore: c.score || 0,
                    });
                }
            }
        }

        // スコア計算: 出現回数×10 + ベーススコア
        const result = [];
        for (const entry of countMap.values()) {
            result.push({
                ...entry.candidate,
                score: entry.count * 10 + entry.totalBaseScore,
                frequency: entry.count,
            });
        }

        // スコア降順
        result.sort((a, b) => b.score - a.score);
        return result;
    }

    /**
     * バッファをクリア
     */
    clear() {
        this._priceBuffer = [];
        this._quantityBuffer = [];
    }
}
