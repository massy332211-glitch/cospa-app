/**
 * UIコンポーネント: トースト通知
 */

let toastContainer = null;

function ensureContainer() {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
}

/**
 * トーストを表示
 * @param {string} message - 表示メッセージ
 * @param {'success' | 'error' | 'info'} type
 * @param {number} duration - 表示時間(ms)
 */
export function showToast(message, type = 'success', duration = 2000) {
    ensureContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span class="toast__icon">${icon}</span><span class="toast__message">${message}</span>`;

    toastContainer.appendChild(toast);

    // アニメーション
    requestAnimationFrame(() => {
        toast.classList.add('toast--visible');
    });

    setTimeout(() => {
        toast.classList.remove('toast--visible');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}
