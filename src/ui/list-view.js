/**
 * 商品カード一覧（比較リスト）画面
 */
import { store } from '../core/store.js';
import { createProductCardHTML } from './components/product-card.js';
import { CATEGORY } from '../core/units.js';

export function renderListView(container, { onNavigate }) {
    const settings = store.settings;
    const mode = settings.displayMode;

    container.innerHTML = `
    <div class="list-view">
      <div class="list-view__header">
        <button class="btn btn--back" id="btn-back-scan">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          スキャン
        </button>
        <h1 class="list-view__title">比較リスト</h1>
        <div class="list-view__mode-toggle">
          <button class="mode-btn ${mode === 'A' ? 'mode-btn--active' : ''}" data-mode="A">
            <span>A</span>
            <small>安さ重視</small>
          </button>
          <button class="mode-btn ${mode === 'B' ? 'mode-btn--active' : ''}" data-mode="B">
            <span>B</span>
            <small>量重視</small>
          </button>
        </div>
      </div>

      <div class="list-view__filters">
        <button class="filter-btn filter-btn--active" data-filter="all">すべて</button>
        <button class="filter-btn" data-filter="weight">重量</button>
        <button class="filter-btn" data-filter="volume">体積</button>
        <button class="filter-btn" data-filter="count">個数</button>
      </div>

      <div class="list-view__products" id="product-list">
        <!-- 商品カードがここに入る -->
      </div>

      <div class="list-view__empty" id="empty-state" style="display:none">
        <div class="list-view__empty-icon">📷</div>
        <p>商品がまだありません</p>
        <p class="list-view__empty-sub">スキャン画面で値札を読み取って追加してください</p>
        <button class="btn btn--primary" id="btn-go-scan">スキャンを開始</button>
      </div>
    </div>
  `;

    const productList = document.getElementById('product-list');
    const emptyState = document.getElementById('empty-state');
    let activeFilter = 'all';

    function renderProducts() {
        const products = store.products;
        const currentMode = store.settings.displayMode;

        if (products.length === 0) {
            productList.style.display = 'none';
            emptyState.style.display = '';
            return;
        }

        productList.style.display = '';
        emptyState.style.display = 'none';

        const filtered = activeFilter === 'all'
            ? products
            : products.filter(p => p.category === activeFilter);

        productList.innerHTML = filtered.length > 0
            ? filtered.map(p => createProductCardHTML(p, currentMode)).join('')
            : '<p class="list-view__no-match">このカテゴリの商品はありません</p>';

        // 削除ボタン
        productList.querySelectorAll('.product-card__delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.deleteId);
                store.removeProduct(id);
            });
        });

        // カードタップ → 編集
        productList.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = parseInt(card.dataset.id);
                onNavigate('edit', { productId: id });
            });
        });
    }

    // 初期描画
    renderProducts();

    // ストア変更を監視
    const unsub = store.subscribe(() => renderProducts());

    // モード切替
    container.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const newMode = btn.dataset.mode;
            store.updateSettings({ displayMode: newMode });
            container.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('mode-btn--active'));
            btn.classList.add('mode-btn--active');
        });
    });

    // フィルタ
    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            activeFilter = btn.dataset.filter;
            container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
            btn.classList.add('filter-btn--active');
            renderProducts();
        });
    });

    // ナビゲーション
    document.getElementById('btn-back-scan').addEventListener('click', () => onNavigate('scan'));
    const goScanBtn = document.getElementById('btn-go-scan');
    if (goScanBtn) goScanBtn.addEventListener('click', () => onNavigate('scan'));

    return unsub;
}
