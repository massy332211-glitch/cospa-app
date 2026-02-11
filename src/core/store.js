/**
 * 商品カード状態管理モジュール
 */
import { recalcProduct, compareProducts } from './calculator.js';

class Store {
    constructor() {
        this._products = [];
        this._nextId = 1;
        this._listeners = new Set();
        this._settings = {
            displayMode: 'A',        // 'A' or 'B'
            taxIncludedPriority: true,
            unitPricePriority: true,
            language: 'ja',
            currency: 'JPY',
            taxRate: 10,
        };
        this._loadSettings();
    }

    // ── 設定 ──
    get settings() { return { ...this._settings }; }

    updateSettings(partial) {
        Object.assign(this._settings, partial);
        this._saveSettings();
        this._recalcAll();
        this._notify();
    }

    _loadSettings() {
        try {
            const saved = localStorage.getItem('cospa_settings');
            if (saved) Object.assign(this._settings, JSON.parse(saved));
        } catch { /* ignore */ }
    }

    _saveSettings() {
        try {
            localStorage.setItem('cospa_settings', JSON.stringify(this._settings));
        } catch { /* ignore */ }
    }

    // ── 商品カード CRUD ──
    get products() { return [...this._products]; }
    get displayMode() { return this._settings.displayMode; }

    addProduct(data) {
        const product = recalcProduct({
            id: this._nextId++,
            name: data.name || `商品${this._nextId - 1}`,
            price: data.price,
            taxType: data.taxType || 'unknown',
            quantityValue: data.quantityValue,
            quantityUnit: data.quantityUnit,
            category: data.category,
            countUnitType: data.countUnitType || null,
            multiplier: data.multiplier || 1,
            recommended: false,
            incompatibleReason: null,
        });
        this._products.push(product);
        this._recalcAll();
        this._notify();
        return product;
    }

    updateProduct(id, data) {
        const idx = this._products.findIndex(p => p.id === id);
        if (idx === -1) return null;
        const updated = recalcProduct({ ...this._products[idx], ...data });
        this._products[idx] = updated;
        this._recalcAll();
        this._notify();
        return updated;
    }

    removeProduct(id) {
        this._products = this._products.filter(p => p.id !== id);
        this._recalcAll();
        this._notify();
    }

    clearAll() {
        this._products = [];
        this._nextId = 1;
        this._notify();
    }

    // ── 再計算 ──
    _recalcAll() {
        this._products = this._products.map(p => recalcProduct(p));
        this._products = compareProducts(this._products, this._settings.displayMode);
    }

    // ── 変更通知 ──
    subscribe(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _notify() {
        const data = { products: this.products, settings: this.settings };
        this._listeners.forEach(fn => {
            try { fn(data); } catch (e) { console.error('Store listener error:', e); }
        });
    }
}

// シングルトン
export const store = new Store();
