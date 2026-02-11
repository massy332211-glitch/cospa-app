/**
 * 単位変換・正規化モジュール
 */

// カテゴリ定義
export const CATEGORY = {
  WEIGHT: 'weight',
  VOLUME: 'volume',
  COUNT: 'count',
};

// 単位→カテゴリマッピング
const UNIT_CATEGORY_MAP = {
  g: CATEGORY.WEIGHT,
  kg: CATEGORY.WEIGHT,
  ml: CATEGORY.VOLUME,
  mL: CATEGORY.VOLUME,
  L: CATEGORY.VOLUME,
  'ℓ': CATEGORY.VOLUME,
  cc: CATEGORY.VOLUME,
  '個': CATEGORY.COUNT,
  '枚': CATEGORY.COUNT,
  '本': CATEGORY.COUNT,
  '袋': CATEGORY.COUNT,
  'パック': CATEGORY.COUNT,
  p: CATEGORY.COUNT,
  pack: CATEGORY.COUNT,
};

// 個数系サブ単位
const COUNT_UNIT_NORMALIZE = {
  '個': '個',
  '枚': '枚',
  '本': '本',
  '袋': '袋',
  'パック': 'パック',
  p: 'パック',
  pack: 'パック',
};

/**
 * 全角→半角変換
 */
export function zenToHan(str) {
  return str
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/．/g, '.')
    .replace(/，/g, ',')
    .replace(/[￥＋×]/g, ch => {
      const map = { '￥': '¥', '＋': '+', '×': '×' };
      return map[ch] || ch;
    });
}

/**
 * カンマ除去・数値化
 */
export function parseNumber(str) {
  const cleaned = String(str).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * 単位を正規化
 * @param {number} value - 数値
 * @param {string} unit - 元の単位文字列
 * @returns {{ value: number, unit: string, category: string, countUnitType?: string } | null}
 */
export function normalizeUnit(value, unit) {
  if (value == null || value <= 0) return null;

  const trimUnit = unit.trim().toLowerCase();

  // 重量
  if (trimUnit === 'kg') {
    return { value: value * 1000, unit: 'g', category: CATEGORY.WEIGHT };
  }
  if (trimUnit === 'g') {
    return { value, unit: 'g', category: CATEGORY.WEIGHT };
  }

  // 体積
  if (trimUnit === 'l' || trimUnit === 'ℓ') {
    return { value: value * 1000, unit: 'ml', category: CATEGORY.VOLUME };
  }
  if (trimUnit === 'ml' || trimUnit === 'cc') {
    return { value, unit: 'ml', category: CATEGORY.VOLUME };
  }

  // 個数
  const countMap = {
    '個': '個', '枚': '枚', '本': '本', '袋': '袋',
    'パック': 'パック', 'ぱっく': 'パック',
    'p': 'パック', 'pack': 'パック',
  };
  if (countMap[trimUnit] || countMap[unit]) {
    const countUnitType = countMap[trimUnit] || countMap[unit];
    return { value, unit: countUnitType, category: CATEGORY.COUNT, countUnitType };
  }

  return null;
}

/**
 * 乗算表記を解析
 * 例: "180g×2" → { value: 360, unit: 'g' }
 * 例: "2個×3" → { value: 6, unit: '個' }
 * @param {string} text
 * @returns {{ totalValue: number, baseValue: number, unit: string, multiplier: number } | null}
 */
export function parseMultiplication(text) {
  const normalized = zenToHan(text);
  // パターン: 数値 + 単位 + ×/x + 数値
  const pattern = /(\d+\.?\d*)\s*(g|kg|ml|mL|L|ℓ|cc|個|枚|本|袋|パック|p|pack)\s*[×xX✕]\s*(\d+)/i;
  const match = normalized.match(pattern);
  if (!match) return null;

  const baseValue = parseFloat(match[1]);
  const unit = match[2];
  const multiplier = parseInt(match[3], 10);

  return {
    totalValue: baseValue * multiplier,
    baseValue,
    unit,
    multiplier,
  };
}
