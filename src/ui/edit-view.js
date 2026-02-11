/**
 * 商品カード編集画面
 */
import { store } from '../core/store.js';
import { normalizeUnit } from '../core/units.js';
import { showToast } from './components/toast.js';

const UNITS = [
    { value: 'g', label: 'g（グラム）', category: 'weight' },
    { value: 'kg', label: 'kg（キログラム）', category: 'weight' },
    { value: 'ml', label: 'ml（ミリリットル）', category: 'volume' },
    { value: 'L', label: 'L（リットル）', category: 'volume' },
    { value: '個', label: '個', category: 'count' },
    { value: '枚', label: '枚', category: 'count' },
    { value: '本', label: '本', category: 'count' },
    { value: '袋', label: '袋', category: 'count' },
    { value: 'パック', label: 'パック', category: 'count' },
];

export function renderEditView(container, { onNavigate, productId, isNew }) {
    let product = productId ? store.products.find(p => p.id === productId) : null;

    const defaults = product || {
        name: '',
        price: '',
        taxType: 'unknown',
        quantityValue: '',
        quantityUnit: 'g',
        multiplier: 1,
    };

    container.innerHTML = `
    <div class="edit-view">
      <div class="edit-view__header">
        <button class="btn btn--back" id="btn-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          戻る
        </button>
        <h1 class="edit-view__title">${isNew ? '手入力で追加' : '商品を編集'}</h1>
      </div>

      <form class="edit-view__form" id="edit-form">
        <div class="form-group">
          <label class="form-label" for="edit-name">商品名（任意）</label>
          <input class="form-input" type="text" id="edit-name" 
                 value="${defaults.name}" placeholder="例：お茶 500ml">
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-price">価格（円）<span class="required">*</span></label>
          <input class="form-input form-input--large" type="number" id="edit-price" 
                 value="${defaults.price}" placeholder="198" inputmode="numeric" min="1" required>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-tax">税区分</label>
          <select class="form-select" id="edit-tax">
            <option value="unknown" ${defaults.taxType === 'unknown' ? 'selected' : ''}>不明</option>
            <option value="included" ${defaults.taxType === 'included' ? 'selected' : ''}>税込</option>
            <option value="body" ${defaults.taxType === 'body' ? 'selected' : ''}>本体（税抜）</option>
          </select>
        </div>

        <div class="form-row">
          <div class="form-group form-group--flex">
            <label class="form-label" for="edit-qty">容量<span class="required">*</span></label>
            <input class="form-input" type="number" id="edit-qty" 
                   value="${defaults.quantityValue}" placeholder="500" inputmode="decimal" min="0.01" step="any" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-unit">単位<span class="required">*</span></label>
            <select class="form-select" id="edit-unit">
              ${UNITS.map(u => `<option value="${u.value}" ${defaults.quantityUnit === u.value ? 'selected' : ''}>${u.label}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-multiplier">乗算（×N、任意）</label>
          <input class="form-input" type="number" id="edit-multiplier" 
                 value="${defaults.multiplier}" placeholder="1" inputmode="numeric" min="1">
        </div>

        <div class="edit-view__actions">
          <button class="btn btn--primary btn--large" type="submit">
            ${isNew ? '➕ 追加' : '💾 保存'}
          </button>
          <button class="btn btn--secondary" type="button" id="btn-cancel">キャンセル</button>
        </div>
      </form>
    </div>
  `;

    const form = document.getElementById('edit-form');
    const btnBack = document.getElementById('btn-back');
    const btnCancel = document.getElementById('btn-cancel');

    function goBack() {
        if (isNew) {
            onNavigate('scan');
        } else {
            onNavigate('list');
        }
    }

    btnBack.addEventListener('click', goBack);
    btnCancel.addEventListener('click', goBack);

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('edit-name').value.trim();
        const price = parseFloat(document.getElementById('edit-price').value);
        const taxType = document.getElementById('edit-tax').value;
        const qtyValue = parseFloat(document.getElementById('edit-qty').value);
        const qtyUnit = document.getElementById('edit-unit').value;
        const multiplier = parseInt(document.getElementById('edit-multiplier').value, 10) || 1;

        if (!price || price <= 0) {
            showToast('価格を正しく入力してください', 'error');
            return;
        }
        if (!qtyValue || qtyValue <= 0) {
            showToast('容量を正しく入力してください', 'error');
            return;
        }

        const normalized = normalizeUnit(qtyValue, qtyUnit);
        if (!normalized) {
            showToast('単位が正しくありません', 'error');
            return;
        }

        const data = {
            name: name || `商品${store.products.length + 1}`,
            price,
            taxType,
            quantityValue: normalized.value,
            quantityUnit: normalized.unit,
            category: normalized.category,
            countUnitType: normalized.countUnitType || null,
            multiplier,
        };

        if (isNew) {
            store.addProduct(data);
            showToast('商品を追加しました！');
        } else {
            store.updateProduct(productId, data);
            showToast('商品を更新しました！');
        }

        goBack();
    });
}
