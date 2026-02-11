/**
 * スキャン画面
 * カメラ + ROI + ライブOCR + 候補パネル + ロック
 */
import { LiveOCRController } from '../ocr/live-controller.js';
import { renderChips } from './components/chip.js';
import { showToast } from './components/toast.js';
import { store } from '../core/store.js';

let ocrController = null;
let videoStream = null;

const STATUS_LABELS = {
  idle: '待機中',
  initializing: 'OCRエンジンを読み込み中…（初回は時間がかかります）',
  scanning: '🟢 読み取り中…',
  unstable: '⏸️ 手ブレ検知：安定するまで待機',
  locked: '✅ ロック中 — [追加]を押してください',
  error: 'OCRの初期化に失敗しました',
};

/**
 * スキャン画面を描画
 */
export function renderScanView(container, { onNavigate }) {
  container.innerHTML = `
    <div class="scan-view">
      <div class="scan-view__camera-area">
        <video id="camera-video" autoplay playsinline muted></video>
        <canvas id="camera-canvas" style="display:none"></canvas>
        <div class="scan-view__roi" id="roi-guide">
          <div class="scan-view__roi-border"></div>
        </div>
        <div class="scan-view__status" id="ocr-status">
          <span class="scan-view__status-dot"></span>
          <span id="status-text">カメラを起動中…</span>
        </div>
        <div class="scan-view__camera-error" id="camera-error" style="display:none">
          <div class="scan-view__camera-error-icon">📷</div>
          <p>カメラを起動できません</p>
          <p class="scan-view__camera-error-sub">カメラへのアクセスを許可するか、<br>手入力で商品を追加してください</p>
        </div>
      </div>

      <div class="scan-view__panel">
        <div class="scan-view__section">
          <div class="scan-view__section-header">
            <span class="scan-view__section-title">💰 価格候補</span>
            <button class="scan-view__unlock-btn" id="unlock-price" style="display:none">ロック解除</button>
          </div>
          <div class="scan-view__chips" id="price-chips">
            <span class="scan-view__empty">値札にカメラを向けてください</span>
          </div>
        </div>

        <div class="scan-view__section">
          <div class="scan-view__section-header">
            <span class="scan-view__section-title">📦 容量候補</span>
            <button class="scan-view__unlock-btn" id="unlock-quantity" style="display:none">ロック解除</button>
          </div>
          <div class="scan-view__chips" id="quantity-chips">
            <span class="scan-view__empty">値札にカメラを向けてください</span>
          </div>
        </div>

        <div class="scan-view__section" id="unit-price-section" style="display:none">
          <div class="scan-view__section-header">
            <span class="scan-view__section-title">📊 単価候補</span>
          </div>
          <div class="scan-view__chips" id="unit-price-chips"></div>
        </div>

        <div class="scan-view__actions">
          <button class="btn btn--primary btn--large" id="btn-add" disabled>
            <span>➕ 追加</span>
          </button>
          <button class="btn btn--secondary" id="btn-reset">
            <span>🔄 リセット</span>
          </button>
          <button class="btn btn--secondary" id="btn-manual">
            <span>✏️ 手入力</span>
          </button>
        </div>

        <div class="scan-view__nav">
          <button class="btn btn--accent btn--large" id="btn-list">
            📋 比較リスト
            <span class="scan-view__badge" id="list-badge" style="display:none">0</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // 要素取得
  const video = document.getElementById('camera-video');
  const statusText = document.getElementById('status-text');
  const statusDot = container.querySelector('.scan-view__status-dot');
  const cameraError = document.getElementById('camera-error');
  const priceChips = document.getElementById('price-chips');
  const quantityChips = document.getElementById('quantity-chips');
  const unitPriceSection = document.getElementById('unit-price-section');
  const unitPriceChips = document.getElementById('unit-price-chips');
  const btnAdd = document.getElementById('btn-add');
  const btnReset = document.getElementById('btn-reset');
  const btnManual = document.getElementById('btn-manual');
  const btnList = document.getElementById('btn-list');
  const listBadge = document.getElementById('list-badge');
  const unlockPrice = document.getElementById('unlock-price');
  const unlockQuantity = document.getElementById('unlock-quantity');

  // バッジ更新
  function updateBadge() {
    const count = store.products.length;
    if (count > 0) {
      listBadge.style.display = '';
      listBadge.textContent = count;
    } else {
      listBadge.style.display = 'none';
    }
  }
  updateBadge();
  const unsubStore = store.subscribe(() => updateBadge());

  // カメラ起動
  startCamera(video).then(() => {
    statusText.textContent = 'カメラ起動完了。OCRを初期化中…';
    const roi = calcROI(video);

    async function startOCR() {
      if (ocrController) ocrController.stop();
      ocrController = new LiveOCRController();
      ocrController.start(video, roi, {
        onCandidatesUpdate: (data) => updateCandidatesUI(data),
        onStatusChange: (status, errorDetail) => {
          if (status === 'error' && errorDetail) {
            statusText.innerHTML = `❌ ${errorDetail} <button id="btn-retry" style="margin-left:8px;padding:2px 10px;border:1px solid #fff;border-radius:12px;background:none;color:#fff;cursor:pointer;font-size:0.7rem;">リトライ</button>`;
            statusDot.className = 'scan-view__status-dot scan-view__status-dot--error';
            const retryBtn = document.getElementById('btn-retry');
            if (retryBtn) {
              retryBtn.addEventListener('click', () => {
                statusText.textContent = 'OCRを再初期化中…';
                statusDot.className = 'scan-view__status-dot scan-view__status-dot--initializing';
                startOCR();
              });
            }
          } else {
            statusText.textContent = STATUS_LABELS[status] || status;
            statusDot.className = `scan-view__status-dot scan-view__status-dot--${status}`;
          }
        },
      });
    }

    startOCR();
  }).catch(err => {
    console.error('Camera error:', err);
    cameraError.style.display = 'flex';
    statusText.textContent = 'カメラを使用できません — 手入力をご利用ください';
    statusDot.className = 'scan-view__status-dot scan-view__status-dot--error';
    priceChips.innerHTML = '<span class="scan-view__empty">手入力で商品を追加してください</span>';
    quantityChips.innerHTML = '<span class="scan-view__empty">手入力で商品を追加してください</span>';
  });

  function updateCandidatesUI(data) {
    const { priceCandidates, quantityCandidates, unitPriceCandidates, lockedPrice, lockedQuantity } = data;

    // 価格チップ
    if (priceCandidates.length > 0) {
      renderChips(priceChips, priceCandidates, 'price', lockedPrice, (c) => {
        if (ocrController) {
          if (lockedPrice && lockedPrice.value === c.value) {
            ocrController.unlockPrice();
          } else {
            ocrController.lockPrice(c);
          }
        }
      });
    } else if (!lockedPrice) {
      priceChips.innerHTML = '<span class="scan-view__empty">候補なし — 手入力をお試しください</span>';
    }

    // 容量チップ
    if (quantityCandidates.length > 0) {
      renderChips(quantityChips, quantityCandidates, 'quantity', lockedQuantity, (c) => {
        if (ocrController) {
          if (lockedQuantity && lockedQuantity.value === c.value) {
            ocrController.unlockQuantity();
          } else {
            ocrController.lockQuantity(c);
          }
        }
      });
    } else if (!lockedQuantity) {
      quantityChips.innerHTML = '<span class="scan-view__empty">候補なし — 手入力をお試しください</span>';
    }

    // 単価候補
    if (unitPriceCandidates && unitPriceCandidates.length > 0) {
      unitPriceSection.style.display = '';
      unitPriceChips.innerHTML = unitPriceCandidates.map(c =>
        `<span class="chip chip--unitPrice">${c.label}</span>`
      ).join('');
    } else {
      unitPriceSection.style.display = 'none';
    }

    // ロック解除ボタン表示
    unlockPrice.style.display = lockedPrice ? '' : 'none';
    unlockQuantity.style.display = lockedQuantity ? '' : 'none';

    // 追加ボタン有効化
    btnAdd.disabled = !(lockedPrice && lockedQuantity);
  }

  // ロック解除
  unlockPrice.addEventListener('click', () => {
    if (ocrController) ocrController.unlockPrice();
  });
  unlockQuantity.addEventListener('click', () => {
    if (ocrController) ocrController.unlockQuantity();
  });

  // 追加
  btnAdd.addEventListener('click', () => {
    if (!ocrController || !ocrController.isBothLocked) return;
    const price = ocrController.lockedPrice;
    const qty = ocrController.lockedQuantity;

    store.addProduct({
      name: `商品${store.products.length + 1}`,
      price: price.value,
      taxType: price.taxType || 'unknown',
      quantityValue: qty.value,
      quantityUnit: qty.unit,
      category: qty.category,
      countUnitType: qty.countUnitType || null,
      multiplier: qty.multiplier || 1,
    });

    showToast('商品を追加しました！');
    ocrController.reset();
    btnAdd.disabled = true;
    updateBadge();
  });

  // リセット
  btnReset.addEventListener('click', () => {
    if (ocrController) ocrController.reset();
  });

  // 手入力
  btnManual.addEventListener('click', () => {
    onNavigate('edit', { isNew: true });
  });

  // リスト
  btnList.addEventListener('click', () => {
    onNavigate('list');
  });

  // クリーンアップ関数を返す
  return () => {
    unsubStore();
    if (ocrController) {
      ocrController.stop();
      ocrController = null;
    }
    stopCamera();
  };
}

async function startCamera(video) {
  const constraints = {
    video: {
      facingMode: 'environment',
      width: { ideal: 1280 },
      height: { ideal: 720 },
    }
  };
  videoStream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = videoStream;
  await video.play();
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }
}

function calcROI(video) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const roiW = vw * 0.90;
  const roiH = vh * 0.35;
  return {
    x: (vw - roiW) / 2,
    y: (vh - roiH) / 2,
    width: roiW,
    height: roiH,
  };
}
