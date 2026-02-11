/**
 * メインエントリポイント・ルーティング
 */
import { renderScanView } from './ui/scan-view.js';
import { renderListView } from './ui/list-view.js';
import { renderEditView } from './ui/edit-view.js';
import { renderSettingsView } from './ui/settings-view.js';

const app = document.getElementById('app');
let currentCleanup = null;

/**
 * 画面遷移
 */
function navigate(view, params = {}) {
    // 前画面のクリーンアップ
    if (currentCleanup && typeof currentCleanup === 'function') {
        currentCleanup();
        currentCleanup = null;
    }

    switch (view) {
        case 'scan':
            currentCleanup = renderScanView(app, { onNavigate: navigate });
            break;
        case 'list':
            currentCleanup = renderListView(app, { onNavigate: navigate });
            break;
        case 'edit':
            renderEditView(app, {
                onNavigate: navigate,
                productId: params.productId || null,
                isNew: params.isNew || false,
            });
            break;
        case 'settings':
            renderSettingsView(app, { onNavigate: navigate });
            break;
        default:
            currentCleanup = renderScanView(app, { onNavigate: navigate });
    }
}

// 初期画面
navigate('scan');

// Service Worker登録
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => {
            console.log('SW registration failed:', err);
        });
    });
}
