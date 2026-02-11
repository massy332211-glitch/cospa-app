/**
 * UIコンポーネント: 候補チップ
 */

/**
 * 候補チップのHTMLを生成
 * @param {{ value: number, label: string, score?: number }} candidate
 * @param {'price' | 'quantity' | 'unitPrice'} type
 * @param {boolean} isLocked - ロック状態
 * @returns {string} HTML文字列
 */
export function createChipHTML(candidate, type, isLocked = false) {
    const typeClass = `chip--${type}`;
    const lockedClass = isLocked ? 'chip--locked' : '';
    const scoreDisplay = candidate.frequency ? `(${candidate.frequency}/5)` : '';

    return `
    <button class="chip ${typeClass} ${lockedClass}" 
            data-type="${type}" 
            data-value="${candidate.value}"
            data-label="${candidate.label}">
      <span class="chip__label">${candidate.label}</span>
      ${scoreDisplay ? `<span class="chip__score">${scoreDisplay}</span>` : ''}
      ${isLocked ? '<span class="chip__lock">🔒</span>' : ''}
    </button>
  `;
}

/**
 * チップリストを描画
 */
export function renderChips(container, candidates, type, lockedValue, onClick) {
    container.innerHTML = candidates.map(c =>
        createChipHTML(c, type, lockedValue && c.value === lockedValue.value)
    ).join('');

    container.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const value = parseFloat(btn.dataset.value);
            const label = btn.dataset.label;
            const candidate = candidates.find(c => c.value === value) || { value, label };
            onClick(candidate);
        });
    });
}
