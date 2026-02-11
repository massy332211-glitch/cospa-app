/**
 * OCR候補抽出モジュール
 * OCRテキストから価格・容量・単価候補を抽出する
 */
import { zenToHan, parseNumber, normalizeUnit, parseMultiplication } from '../core/units.js';
import { store } from '../core/store.js';

/**
 * 価格候補を抽出
 * @param {string} rawText - OCR生テキスト
 * @returns {Array<{ value: number, taxType: string, label: string, isUnitPrice: boolean, score: number }>}
 */
export function extractPriceCandidates(rawText) {
    const text = zenToHan(rawText);
    const candidates = [];
    const unitPriceCandidates = [];

    // 単価キーワードパターン（これらに近い数値は単価候補に回す）
    const unitPricePatterns = [
        /(\d[\d,.]*)\s*円?\s*[\/／]\s*100\s*(g|ml)/gi,
        /100\s*(g|ml)\s*(当り|あたり|当たり|辺り|につき)\s*[¥￥]?\s*(\d[\d,.]*)\s*円?/gi,
        /(1\s*(g|ml|個|枚|本)\s*(当り|あたり|当たり))\s*[¥￥]?\s*(\d[\d,.]*)\s*円?/gi,
    ];

    // 単価候補抽出
    for (const pattern of unitPricePatterns) {
        let m;
        while ((m = pattern.exec(text)) !== null) {
            const val = parseNumber(m[3] || m[1]);
            if (val && val > 0) {
                unitPriceCandidates.push({
                    value: val,
                    label: m[0].trim(),
                    isUnitPrice: true,
                    score: 0,
                });
            }
        }
    }

    // 設定から通貨情報を取得
    const { currency } = store.settings;
    let sym = '[¥￥]';
    let unit = '円';

    switch (currency) {
        case 'USD': sym = '[$＄¢]'; unit = '(?:dollars?|cent|[¢])?'; break;
        case 'EUR': sym = '[€]'; unit = '(?:euros?)?'; break;
        case 'GBP': sym = '[£]'; unit = '(?:pounds?)?'; break;
        case 'KRW': sym = '[₩]'; unit = '(?:won)?'; break;
        case 'CNY': sym = '[¥￥元]'; unit = '元'; break;
        case 'JPY': default: sym = '[¥￥]'; unit = '円'; break;
    }

    // 価格候補パターン
    const pricePatterns = [
        // 税込 + 価格
        { regex: new RegExp(`(税込|税込み)\\s*${sym}?\\s*(\\d[\\d,.]*)\\s*${unit}?`, 'gi'), taxType: 'included' },
        // 価格 + 税込
        { regex: new RegExp(`${sym}?\\s*(\\d[\\d,.]*)\\s*${unit}?\\s*[\\(（]?\\s*(税込|税込み)`, 'gi'), taxType: 'included', valGroup: 1 },
        // 本体 + 価格
        { regex: new RegExp(`(本体|税抜|税別)\\s*${sym}?\\s*(\\d[\\d,.]*)\\s*${unit}?`, 'gi'), taxType: 'body' },
        // 通貨記号付き
        { regex: new RegExp(`${sym}\\s*(\\d[\\d,.]*)`, 'g'), taxType: 'unknown', valGroup: 1 },
        // 数値+単位
        { regex: new RegExp(`(\\d[\\d,.]*)\\s*${unit}`, 'g'), taxType: 'unknown', valGroup: 1 },
        // 通貨記号なし (3桁以上 または 小数点あり)
        // ※ 単位(g,ml等)が直後にないことを確認
        { regex: /(?<![\d,.])([1-9]\d{2,}|[1-9]\d*\.\d+)(?![\d,.])(?!\s*(g|kg|ml|mL|L|ℓ|cc|個|枚|本|袋|パック|p|pack|当り|あたり|当たり|\/|／|:|：|-))/gi, taxType: 'unknown', valGroup: 1, isWeak: true },
    ];

    // JPYの場合の特例: 「円」の誤認識パターンを追加
    if (currency === 'JPY') {
        const weakSymPattern = '円|yen|en|Yen|En|m|M|w|W|F|A|H';
        pricePatterns.push({
            regex: new RegExp(`(\\d[\\d,.]*)\\s*(${weakSymPattern})(?!\\s*(g|kg|ml|L|cc|個|枚|本|袋|p))`, 'gi'),
            taxType: 'unknown',
            valGroup: 1,
            isWeak: true // 誤認識前提なのでWeak扱いだが、後で加点する
        });
    }

    const seen = new Set();
    const unitPriceValues = new Set(unitPriceCandidates.map(c => c.value));

    for (const { regex, taxType, valGroup, isWeak } of pricePatterns) {
        let m;
        while ((m = regex.exec(text)) !== null) {
            const valStr = m[valGroup || 2];
            const val = parseNumber(valStr);
            if (!val || val <= 0) continue;
            if (unitPriceValues.has(val)) continue; // 単価候補は除外
            if (seen.has(val)) continue;

            // 除外ロジック
            if (/^\d{8}$|^\d{13}$/.test(valStr)) continue; // JANコード(8,13桁)
            // 電話番号や日付の一部と推測される場合は除外
            // (正規表現で弾いているが念のため)
            const fullMatch = m[0];
            if (fullMatch.includes('-') || fullMatch.includes('/')) continue;


            // 周辺に単価キーワードがないかチェック
            const surroundStart = Math.max(0, m.index - 15);
            const surroundEnd = Math.min(text.length, m.index + m[0].length + 15);
            const surround = text.substring(surroundStart, surroundEnd);
            if (/100\s*(g|ml)|当り|あたり|当たり/i.test(surround) && !/税込|本体|税抜/i.test(surround)) {
                unitPriceCandidates.push({
                    value: val,
                    label: m[0].trim(),
                    isUnitPrice: true,
                    score: 0,
                });
                continue;
            }

            seen.add(val);

            let baseScore = 0;
            if (isWeak) {
                // 通貨記号なし数値は低スコアからスタート
                baseScore = 1;
            } else {
                if (taxType === 'included') baseScore = 8;
                else if (taxType === 'body') baseScore = 4;

                // 通貨記号や単位が含まれていれば加点
                if (new RegExp(sym).test(m[0])) baseScore += 3;
                else if (unit && new RegExp(unit).test(m[0])) baseScore += 3;
            }

            // JPY特例: 誤認識パターンでも加点して上位に表示させる
            if (currency === 'JPY' && /[円yenmMFWAH]/i.test(m[0])) {
                baseScore += 2;
            }

            // 表示用通貨記号（簡易的にsymの最初の1文字を採用、ただし[]は除く）
            const displaySym = sym.replace(/[\[\]]/g, '').charAt(0);

            // 税表記
            let taxLabel = '';
            if (store.settings.language === 'en') {
                if (taxType === 'included') taxLabel = ' (incl.)';
                else if (taxType === 'body') taxLabel = ' (excl.)';
            } else {
                if (taxType === 'included') taxLabel = '(税込)';
                else if (taxType === 'body') taxLabel = '(本体)';
            }

            candidates.push({
                value: val,
                taxType,
                label: `${displaySym}${val.toLocaleString()}${taxLabel}`,
                isUnitPrice: false,
                score: baseScore,
            });
        }
    }

    // スコア順に並べ替え
    candidates.sort((a, b) => b.score - a.score);

    return { priceCandidates: candidates, unitPriceCandidates };
}

/**
 * 容量候補を抽出
 * @param {string} rawText - OCR生テキスト
 * @returns {Array<{ value: number, unit: string, category: string, countUnitType?: string, label: string, multiplier: number, score: number }>}
 */
export function extractQuantityCandidates(rawText) {
    const text = zenToHan(rawText);
    const candidates = [];
    const seen = new Set();

    // 乗算パターン（優先的にチェック）
    const mulPattern = /(\d+\.?\d*)\s*(g|kg|ml|mL|L|ℓ|cc|個|枚|本|袋|パック|p|pack)\s*[×xX✕]\s*(\d+)/gi;
    let m;
    while ((m = mulPattern.exec(text)) !== null) {
        const baseVal = parseFloat(m[1]);
        const unit = m[2];
        const multiplier = parseInt(m[3], 10);
        const normalized = normalizeUnit(baseVal, unit);
        if (!normalized) continue;

        const totalValue = normalized.value * multiplier;
        const key = `${totalValue}_${normalized.unit}`;
        if (seen.has(key)) continue;
        seen.add(key);

        let score = 3; // 乗算 +3
        score += 5; // 単位付き +5

        candidates.push({
            value: totalValue,
            originalValue: baseVal,
            unit: normalized.unit,
            category: normalized.category,
            countUnitType: normalized.countUnitType || null,
            label: `${baseVal}${unit}×${multiplier} = ${totalValue}${normalized.unit}`,
            multiplier,
            score,
        });
    }

    // 通常パターン
    const quantityPatterns = [
        // 内容量付き (高スコア)
        { regex: /(内容量|正味量)\s*[：:]?\s*(\d+\.?\d*)\s*(g|kg|ml|mL|L|ℓ|cc)/gi, valGroup: 2, unitGroup: 3, bonus: 8 },
        // 通常の重量/体積
        { regex: /(\d+\.?\d*)\s*(g|kg|ml|mL|L|ℓ|cc)(?![×xX✕])/gi, valGroup: 1, unitGroup: 2, bonus: 5 },
        // 個数 (内容量付き)
        { regex: /(内容量|入数)\s*[：:]?\s*(\d+)\s*(個|枚|本|袋|パック|p|pack)/gi, valGroup: 2, unitGroup: 3, bonus: 8 },
        // 個数 (通常)
        { regex: /(\d+)\s*(個|枚|本|袋|パック|p|pack)(?![×xX✕])/gi, valGroup: 1, unitGroup: 2, bonus: 5 },
    ];

    for (const { regex, valGroup, unitGroup, bonus } of quantityPatterns) {
        while ((m = regex.exec(text)) !== null) {
            const val = parseFloat(m[valGroup]);
            const unit = m[unitGroup];
            const normalized = normalizeUnit(val, unit);
            if (!normalized) continue;

            const key = `${normalized.value}_${normalized.unit}`;
            if (seen.has(key)) continue;
            seen.add(key);

            candidates.push({
                value: normalized.value,
                unit: normalized.unit,
                category: normalized.category,
                countUnitType: normalized.countUnitType || null,
                label: normalized.value !== val
                    ? `${val}${unit} → ${normalized.value}${normalized.unit}`
                    : `${normalized.value}${normalized.unit}`,
                multiplier: 1,
                score: bonus,
            });
        }
    }

    // スコア順に並べ替え
    candidates.sort((a, b) => b.score - a.score);

    return candidates;
}
