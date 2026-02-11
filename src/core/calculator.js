/**
 * 単価計算・比較判定モジュール
 */
import { CATEGORY } from './units.js';

/**
 * モードA: 円/基準量
 * 重量: 円/100g、体積: 円/100ml、個数: 円/1単位
 */
export function calcUnitPriceA(price, quantity, category) {
    if (!price || !quantity || price <= 0 || quantity <= 0) return null;
    switch (category) {
        case CATEGORY.WEIGHT:
            return price / (quantity / 100); // 円/100g
        case CATEGORY.VOLUME:
            return price / (quantity / 100); // 円/100ml
        case CATEGORY.COUNT:
            return price / quantity; // 円/1単位
        default:
            return null;
    }
}

/**
 * モードB: 量/100円
 * 重量: g/100円、体積: ml/100円、個数: 単位/100円
 */
export function calcUnitValueB(price, quantity, category) {
    if (!price || !quantity || price <= 0 || quantity <= 0) return null;
    switch (category) {
        case CATEGORY.WEIGHT:
            return quantity / (price / 100); // g/100円
        case CATEGORY.VOLUME:
            return quantity / (price / 100); // ml/100円
        case CATEGORY.COUNT:
            return quantity / (price / 100); // 単位/100円
        default:
            return null;
    }
}

/**
 * 単価の表示フォーマット
 */
export function formatUnitPriceA(value, category) {
    if (value == null) return '—';
    switch (category) {
        case CATEGORY.WEIGHT:
            return `¥${value.toFixed(1)} /100g`;
        case CATEGORY.VOLUME:
            return `¥${value.toFixed(1)} /100ml`;
        case CATEGORY.COUNT:
            return `¥${value.toFixed(1)} /1個`;
        default:
            return '—';
    }
}

export function formatUnitValueB(value, category) {
    if (value == null) return '—';
    switch (category) {
        case CATEGORY.WEIGHT:
            return `${value.toFixed(1)}g /100円`;
        case CATEGORY.VOLUME:
            return `${value.toFixed(1)}ml /100円`;
        case CATEGORY.COUNT:
            return `${value.toFixed(2)}個 /100円`;
        default:
            return '—';
    }
}

/**
 * 商品リストを比較し、勝敗判定する
 * @param {Array} products - 商品カード配列
 * @param {'A'|'B'} mode - 表示モード
 * @returns {Array} 判定結果が付与された商品カード配列
 */
export function compareProducts(products, mode) {
    // 全商品をコピー
    const result = products.map(p => ({
        ...p,
        recommended: false,
        incompatibleReason: null,
    }));

    // カテゴリ別にグループ化
    const groups = {};
    result.forEach(p => {
        if (!p.category) {
            p.incompatibleReason = 'カテゴリ不明';
            return;
        }
        // 個数カテゴリはcountUnitTypeで更に分割
        const groupKey = p.category === CATEGORY.COUNT
            ? `${p.category}_${p.countUnitType || '不明'}`
            : p.category;
        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(p);
    });

    // 各グループ内で比較
    Object.entries(groups).forEach(([groupKey, items]) => {
        if (items.length < 2) {
            // 1商品だけなら比較不可
            return;
        }

        // 同グループ内で単価計算済みかチェック
        const comparable = items.filter(p => {
            if (mode === 'A') return p.unitPriceA != null;
            return p.unitValueB != null;
        });

        if (comparable.length < 2) return;

        if (mode === 'A') {
            // モードA: 単価最小が勝ち
            const best = comparable.reduce((min, p) =>
                p.unitPriceA < min.unitPriceA ? p : min
            );
            best.recommended = true;
        } else {
            // モードB: 量/100円最大が勝ち
            const best = comparable.reduce((max, p) =>
                p.unitValueB > max.unitValueB ? p : max
            );
            best.recommended = true;
        }
    });

    // 異なるカテゴリ間の比較不可表示
    // 個数系で別unitTypeの場合
    result.forEach(p => {
        if (p.category === CATEGORY.COUNT && p.countUnitType) {
            const groupKey = `${p.category}_${p.countUnitType}`;
            const group = groups[groupKey];
            if (group && group.length < 2) {
                // 他の個数系グループがあるかチェック
                const otherCountGroups = Object.keys(groups).filter(
                    k => k.startsWith(CATEGORY.COUNT) && k !== groupKey
                );
                if (otherCountGroups.length > 0) {
                    p.incompatibleReason = '単位が違います';
                }
            }
        }
    });

    return result;
}

/**
 * 商品カードの単価を再計算
 */
export function recalcProduct(product) {
    const totalQuantity = (product.quantityValue || 0) * (product.multiplier || 1);
    return {
        ...product,
        totalQuantity,
        unitPriceA: calcUnitPriceA(product.price, totalQuantity, product.category),
        unitValueB: calcUnitValueB(product.price, totalQuantity, product.category),
    };
}
