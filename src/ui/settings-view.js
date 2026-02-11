/**
 * 設定画面
 */
import { store } from '../core/store.js';
import { showToast } from './components/toast.js';

export function renderSettingsView(container, { onNavigate }) {
  const settings = store.settings;

  container.innerHTML = `
    <div class="settings-view">
      <div class="settings-view__header">
        <button class="btn btn--back" id="btn-back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          戻る
        </button>
        <h1 class="settings-view__title">⚙️ 設定</h1>
      </div>

      <div class="settings-view__body">
        <div class="settings-group">
          <h2 class="settings-group__title">表示モード</h2>
          <div class="settings-item">
            <div class="settings-item__info">
              <span class="settings-item__label">初期表示モード</span>
              <span class="settings-item__desc">A=安さ重視（円/単位）、B=量重視（量/100円）</span>
            </div>
            <select class="form-select form-select--small" id="setting-mode">
              <option value="A" ${settings.displayMode === 'A' ? 'selected' : ''}>モードA（安さ重視）</option>
              <option value="B" ${settings.displayMode === 'B' ? 'selected' : ''}>モードB（量重視）</option>
            </select>
          </div>
        </div>

        <div class="settings-group">
          <h2 class="settings-group__title">価格設定</h2>
          <div class="settings-item">
            <div class="settings-item__info">
              <span class="settings-item__label">税込価格を優先</span>
              <span class="settings-item__desc">ONの場合、税込価格候補を上位に表示</span>
            </div>
            <label class="toggle">
              <input type="checkbox" id="setting-tax" ${settings.taxIncludedPriority ? 'checked' : ''}>
              <span class="toggle__slider"></span>
            </label>
          </div>
        </div>

        <div class="settings-group">
          <h2 class="settings-group__title">単価設定</h2>
          <div class="settings-item">
            <div class="settings-item__info">
              <span class="settings-item__label">値札の単価表記を優先採用</span>
              <span class="settings-item__desc">値札に「100g当り○円」がある場合に表示</span>
            </div>
            <label class="toggle">
              <input type="checkbox" id="setting-unitprice" ${settings.unitPricePriority ? 'checked' : ''}>
              <span class="toggle__slider"></span>
            </label>
          </div>
        </div>

        <div class="settings-group">
          <h2 class="settings-group__title">地域・言語設定</h2>
          
          <div class="settings-item">
            <div class="settings-item__info">
              <span class="settings-item__label">表示言語</span>
              <span class="settings-item__desc">アプリの表示言語を選択</span>
            </div>
            <select class="form-select" id="setting-language">
              <option value="ja" ${settings.language === 'ja' ? 'selected' : ''}>日本語</option>
              <option value="en" ${settings.language === 'en' ? 'selected' : ''}>English</option>
            </select>
          </div>

          <div class="settings-item">
            <div class="settings-item__info">
              <span class="settings-item__label">通貨</span>
              <span class="settings-item__desc">価格表示に使用する通貨</span>
            </div>
            <select class="form-select" id="setting-currency">
              <option value="JPY" ${settings.currency === 'JPY' ? 'selected' : ''}>JPY (¥)</option>
              <option value="USD" ${settings.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
              <option value="EUR" ${settings.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
              <option value="GBP" ${settings.currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
              <option value="KRW" ${settings.currency === 'KRW' ? 'selected' : ''}>KRW (₩)</option>
              <option value="CNY" ${settings.currency === 'CNY' ? 'selected' : ''}>CNY (¥)</option>
            </select>
          </div>

          <div class="settings-item">
            <div class="settings-item__info">
              <span class="settings-item__label">消費税率 (%)</span>
              <span class="settings-item__desc">税抜価格の計算に使用</span>
            </div>
            <input type="number" class="form-input form-input--small" id="setting-tax-rate" value="${settings.taxRate}" min="0" max="100">
          </div>
        </div>

        <div class="settings-group">
          <h2 class="settings-group__title">スキャン設定</h2>
          <div class="settings-item">
            <div class="settings-item__info">
              <span class="settings-item__label">スキャン間隔</span>
              <span class="settings-item__desc">価格検出の頻度（短いと電池消費増）</span>
            </div>
            <select class="form-select" id="setting-scan-interval">
              <option value="1000" ${settings.scanInterval === 1000 ? 'selected' : ''}>高速 (1秒)</option>
              <option value="3000" ${settings.scanInterval === 3000 ? 'selected' : ''}>標準 (3秒)</option>
              <option value="5000" ${settings.scanInterval === 5000 ? 'selected' : ''}>ゆっくり (5秒)</option>
            </select>
          </div>
        </div>

        <div class="settings-group">
          <h2 class="settings-group__title">基準量（固定）</h2>
          <div class="settings-item">
            <div class="settings-item__info">
              <span class="settings-item__label">重量: 100g / 体積: 100ml</span>
              <span class="settings-item__desc">MVPでは基準量は固定です</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // イベント
  document.getElementById('btn-back').addEventListener('click', () => onNavigate('scan'));

  document.getElementById('setting-mode').addEventListener('change', (e) => {
    store.updateSettings({ displayMode: e.target.value });
    showToast('表示モードを変更しました');
  });

  document.getElementById('setting-tax').addEventListener('change', (e) => {
    store.updateSettings({ taxIncludedPriority: e.target.checked });
  });

  document.getElementById('setting-unitprice').addEventListener('change', (e) => {
    store.updateSettings({ unitPricePriority: e.target.checked });
  });

  document.getElementById('setting-language').addEventListener('change', (e) => {
    store.updateSettings({ language: e.target.value });
    showToast('言語を変更しました（一部は再起動後に反映されます）');
  });

  document.getElementById('setting-currency').addEventListener('change', (e) => {
    store.updateSettings({ currency: e.target.value });
    showToast('通貨を変更しました');
  });

  document.getElementById('setting-tax-rate').addEventListener('change', (e) => {
    let val = parseFloat(e.target.value);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 100) val = 100;
    store.updateSettings({ taxRate: val });
    showToast('消費税率を変更しました');
  });

  document.getElementById('setting-scan-interval').addEventListener('change', (e) => {
    store.updateSettings({ scanInterval: parseInt(e.target.value, 10) });
    showToast('スキャン間隔を変更しました');
  });
}
