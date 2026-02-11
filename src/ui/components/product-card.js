/**
 * UIコンポーネント: 商品カード
 */
import { formatUnitPriceA, formatUnitValueB } from '../../core/calculator.js';

/**
 * 商品カードHTMLを生成
 */
export function createProductCardHTML(product, mode) {
    const unitDisplay = mode === 'A'
        ? formatUnitPriceA(product.unitPriceA, product.category)
        : formatUnitValueB(product.unitValueB, product.category);

    const taxLabel = product.taxType === 'included' ? '税込'
        : product.taxType === 'body' ? '本体' : '';

    const recommendedClass = product.recommended ? 'product-card--recommended' : '';
    const incompatibleClass = product.incompatibleReason ? 'product-card--incompatible' : '';

    const quantityDisplay = product.multiplier > 1
        ? `${product.quantityValue}${product.quantityUnit}×${product.multiplier} = ${product.totalQuantity}${product.quantityUnit}`
        : `${product.totalQuantity || product.quantityValue}${product.quantityUnit}`;

    return `
    <div class="product-card ${recommendedClass} ${incompatibleClass}" 
         data-id="${product.id}" 
         role="button" 
         tabindex="0">
      <div class="product-card__header">
        <span class="product-card__name">${product.name}</span>
        ${product.recommended ? '<span class="product-card__badge">🏆 おすすめ</span>' : ''}
      </div>
      <div class="product-card__body">
        <div class="product-card__price">
          ¥${product.price.toLocaleString()}
          ${taxLabel ? `<span class="product-card__tax">${taxLabel}</span>` : ''}
        </div>
        <div class="product-card__quantity">${quantityDisplay}</div>
        <div class="product-card__unit-price">${unitDisplay}</div>
      </div>
      ${product.incompatibleReason
            ? `<div class="product-card__warning">⚠️ ${product.incompatibleReason}</div>`
            : ''}
      <button class="product-card__delete" data-delete-id="${product.id}" aria-label="削除">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;
}
