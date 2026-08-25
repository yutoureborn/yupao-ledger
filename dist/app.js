"use strict";
/* global React, ReactDOM */
let currentCsrfToken = '';
const APP_VERSION = '0.3.9';
let authExpiredHandler = null;
function setClientAuth(csrfToken = '') {
    currentCsrfToken = csrfToken;
}
const ROUTES = [
    { key: 'home', label: '首页', icon: 'home', mobile: true },
    { key: 'transactions', label: '明细', icon: 'list', mobile: true },
    { key: 'add', label: '记一笔', icon: 'plus', mobile: true },
    { key: 'invoices', label: '发票', icon: 'invoice', mobile: true },
    { key: 'stats', label: '统计', icon: 'chart', mobile: true },
    { key: 'accounts', label: '账户', icon: 'wallet', mobile: false },
    { key: 'budgets', label: '预算', icon: 'target', mobile: false },
    { key: 'settings', label: '设置', icon: 'settings', mobile: false },
];
const CATEGORY_EMOJI = {
    bowl: '🍜', takeaway: '🥡', basket: '🥬', cup: '🧋', bag: '🧴', bolt: '💡', phone: '📱', subscription: '🔁',
    home: '🏠', building: '🏢', sofa: '🛋️', device: '📺', car: '🚗', metro: '🚇', taxi: '🚕', fuel: '⛽', parking: '🅿️', road: '🛣️',
    shopping: '🛍️', clothes: '👕', beauty: '🧴', tech: '💻', hobby: '🎨', medical: '🩹', medicine: '💊', fitness: '🏃', care: '🧘',
    paw: '🐾', petfood: '🐟', petmedical: '🏥', pettoy: '🧶', game: '🎮', movie: '🎬', party: '🥂', gift: '🎁', redpacket: '🧧',
    study: '📚', software: '🧩', office: '🗂️', insurance: '🛡️', tax: '🧾', fee: '🏦', plane: '✈️', dots: '✨', wallet: '💰',
    star: '⭐', receipt: '🧾', briefcase: '💼', store: '🏪', trend: '📈', cash: '💵', wechat: '💬', alipay: '🔵', card: '💳', bank: '🏦', credit: '💳', stored: '🎫', other: '🧺',
};
const EXPENSE_CATEGORY_GROUPS = [
    { label: '日常生活', names: ['餐饮', '外卖', '买菜', '零食饮品', '日用百货', '水电燃气', '通讯网络', '订阅会员'] },
    { label: '居住家庭', names: ['房租房贷', '物业费', '家居家装', '数码家电'] },
    { label: '交通出行', names: ['交通出行', '公共交通', '打车', '加油', '停车', '车辆养护', '旅行'] },
    { label: '购物消费', names: ['购物', '服饰鞋包', '美妆护肤', '数码产品', '网购'] },
    { label: '健康', names: ['医疗', '药品', '健身运动', '保健护理'] },
    { label: '宠物', names: ['宠物', '宠物食品', '猫砂日用品', '宠物医疗', '宠物玩具'] },
    { label: '娱乐生活', names: ['娱乐', '电影演出', '兴趣爱好'] },
    { label: '人情社交', names: ['人情往来', '礼物', '红包'] },
    { label: '学习工作', names: ['学习培训', '软件工具', '办公用品'] },
    { label: '金融其他', names: ['保险', '税费', '银行手续费', '其他支出'] },
];
function categoryGroups(categories, type) {
    if (type !== 'expense')
        return [{ label: type === 'income' ? '收入分类' : '分类', items: categories }];
    const used = new Set();
    const groups = EXPENSE_CATEGORY_GROUPS.map((group) => {
        const items = group.names.map((name) => categories.find((item) => item.name === name)).filter(Boolean);
        items.forEach((item) => used.add(item.id));
        return { label: group.label, items };
    }).filter((group) => group.items.length);
    const other = categories.filter((item) => !used.has(item.id));
    if (other.length)
        groups.push({ label: '其他', items: other });
    return groups;
}
function safeStorageGet(key, fallback) {
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    }
    catch {
        return fallback;
    }
}
function safeStorageSet(key, value) {
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    }
    catch { /* storage is optional */ }
}
function yesterdayDate() {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}
const WARM_CHART_COLORS = ['#F29AB5', '#B9D99A', '#AAB6C0', '#F5C77D', '#BDA8D8', '#9BCED4', '#E9A58F'];
const MASCOT_ASSETS = {
    hero: { png: '/illustrations/mascots/hero-duo-v033.png?v=0.3.9', webp: '/illustrations/mascots/hero-duo-v033.webp?v=0.3.9' },
    idle: { png: '/illustrations/mascots/hero-duo-v033.png?v=0.3.9', webp: '/illustrations/mascots/hero-duo-v033.webp?v=0.3.9' },
    empty: { png: '/illustrations/mascots/taro-entry-v033.png?v=0.3.9', webp: '/illustrations/mascots/taro-entry-v033.webp?v=0.3.9' },
    success: { png: '/illustrations/mascots/duo-success-v033.png?v=0.3.9', webp: '/illustrations/mascots/duo-success-v033.webp?v=0.3.9' },
    summary: { png: '/illustrations/mascots/tank-summary-v033.png?v=0.3.9', webp: '/illustrations/mascots/tank-summary-v033.webp?v=0.3.9' },
    safe: { png: '/illustrations/mascots/tank-safe-v033.png?v=0.3.9', webp: '/illustrations/mascots/tank-safe-v033.webp?v=0.3.9' },
    warning: { png: '/illustrations/mascots/tank-warning-v033.png?v=0.3.9', webp: '/illustrations/mascots/tank-warning-v033.webp?v=0.3.9' },
    invoice: { png: '/illustrations/mascots/duo-invoice-v033.png?v=0.3.9', webp: '/illustrations/mascots/duo-invoice-v033.webp?v=0.3.9' },
};
function MascotPicture(props) {
    const asset = MASCOT_ASSETS[props.asset] || MASCOT_ASSETS.hero;
    return React.createElement("picture", { className: cn('mascot-picture', props.className) },
        React.createElement("source", { srcSet: asset.webp, type: "image/webp" }),
        React.createElement("img", { className: "mascot-asset-img", src: asset.png, alt: props.alt || '', loading: props.eager ? 'eager' : 'lazy', decoding: "async", fetchPriority: props.eager ? 'high' : 'auto' }));
}
const ACCOUNT_TYPE_LABEL = {
    cash: '现金', wechat: '微信', alipay: '支付宝', bank: '银行卡', credit: '信用卡', stored: '储值账户', other: '其他',
};
function cn(...values) {
    return values.filter(Boolean).join(' ');
}
function today() {
    const date = new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
}
function currentMonth() {
    return today().slice(0, 7);
}
function shiftMonth(month, amount) {
    const [year, number] = month.split('-').map(Number);
    const date = new Date(year, number - 1 + amount, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(month) {
    const [year, number] = month.split('-');
    return `${year}年${Number(number)}月`;
}
function dateLabel(value) {
    const date = new Date(value.replace(' ', 'T'));
    if (Number.isNaN(date.getTime()))
        return value.slice(0, 10);
    return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' }).format(date);
}
function compactDate(value) {
    return value ? value.slice(5, 10).replace('-', '/') : '';
}
function centsToYuan(cents) {
    return Number(cents || 0) / 100;
}
function formatMoney(cents, sign = false) {
    const value = centsToYuan(cents);
    const prefix = sign && value > 0 ? '+' : '';
    return `${prefix}${new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(value)}`;
}
function formatCompactMoney(cents) {
    const value = centsToYuan(cents);
    if (Math.abs(value) >= 10000)
        return `¥${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
    return `¥${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value)}`;
}
function moneyToCents(value) {
    const normalized = value.replace(/,/g, '').trim();
    if (!/^\d+(\.\d{0,2})?$/.test(normalized))
        return 0;
    const [whole, decimals = ''] = normalized.split('.');
    return Number(whole) * 100 + Number((decimals + '00').slice(0, 2));
}
function safePercent(value, total) {
    if (!total || total <= 0)
        return 0;
    return Math.max(0, Math.min(100, (value / total) * 100));
}
function invoiceTypeLabel(type) { return type === 'received' ? '收到的发票' : '开出的发票'; }
function polarToCartesian(cx, cy, radius, angleDeg) {
    const angle = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}
function describeDonutSlice(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
    const startOuter = polarToCartesian(cx, cy, outerRadius, endAngle);
    const endOuter = polarToCartesian(cx, cy, outerRadius, startAngle);
    const startInner = polarToCartesian(cx, cy, innerRadius, startAngle);
    const endInner = polarToCartesian(cx, cy, innerRadius, endAngle);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    return [
        `M ${startOuter.x} ${startOuter.y}`,
        `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${endOuter.x} ${endOuter.y}`,
        `L ${startInner.x} ${startInner.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${endInner.x} ${endInner.y}`,
        'Z',
    ].join(' ');
}
function invoiceCounterpartyLabel(type) { return type === 'received' ? '开票方' : '客户名称'; }
function transactionTitle(item) {
    if (item.type === 'transfer')
        return `${item.account_name || '账户'} → ${item.target_account_name || '账户'}`;
    return item.merchant || item.category_name || (item.type === 'income' ? '收入' : '支出');
}
function transactionMeta(item) {
    const pieces = [dateLabel(item.occurred_at), item.account_name];
    if (item.note)
        pieces.push(item.note);
    if (item.creator_name)
        pieces.push(`${item.creator_name}记录`);
    return pieces.filter(Boolean).join(' · ');
}
async function apiRequest(path, options = {}) {
    var _a, _b, _c;
    const method = String(options.method || 'GET').toUpperCase();
    const headers = { 'x-yupao-client-version': APP_VERSION,
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...(options.headers || {}),
    };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && currentCsrfToken)
        headers['x-csrf-token'] = currentCsrfToken;
    const response = await fetch(path, {
        credentials: 'same-origin',
        ...options,
        method,
        headers,
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        if (!response.ok)
            throw new Error('请求失败，请稍后再试');
        return response;
    }
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
        const error = new Error(((_a = payload.error) === null || _a === void 0 ? void 0 : _a.message) || '请求失败，请稍后再试');
        error.code = (_b = payload.error) === null || _b === void 0 ? void 0 : _b.code;
        error.status = response.status;
        error.details = (_c = payload.error) === null || _c === void 0 ? void 0 : _c.details;
        if (response.status === 401 && error.code === 'AUTH_REQUIRED' && authExpiredHandler)
            authExpiredHandler();
        throw error;
    }
    return payload.data;
}
function bytesToBase64Url(bytes) {
    let binary = '';
    for (const byte of bytes)
        binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function base64UrlToBytes(value) {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
        bytes[index] = binary.charCodeAt(index);
    return bytes;
}
function newPasswordSalt() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return bytesToBase64Url(bytes);
}
async function derivePasswordProof(password, salt, iterations) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: base64UrlToBytes(salt), iterations }, key, 256);
    return bytesToBase64Url(new Uint8Array(bits));
}
async function fetchPasswordParams(email) {
    return apiRequest('/api/auth/password-params', { method: 'POST', body: JSON.stringify({ email }) });
}
async function createClientCredential(password, iterations, salt = newPasswordSalt()) {
    return { proof: await derivePasswordProof(password, salt, iterations), salt, iterations };
}
function passwordValidationMessage(password, email) {
    if (password.length < 12 || password.length > 128)
        return '密码需要 12～128 个字符';
    if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password))
        return '密码至少需要包含字母和数字';
    const prefix = email.trim().toLowerCase().split('@')[0] || '';
    if (prefix.length >= 4 && password.toLowerCase().includes(prefix))
        return '密码不要包含邮箱名称';
    return '';
}
function registerServiceWorker(onUpdate) {
    if (!('serviceWorker' in navigator))
        return;
    let controllerChanged = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (controllerChanged)
            return;
        controllerChanged = true;
        onUpdate();
    });
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((registration) => {
            registration.addEventListener('updatefound', () => {
                const installing = registration.installing;
                if (!installing)
                    return;
                installing.addEventListener('statechange', () => {
                    if (installing.state === 'installed' && navigator.serviceWorker.controller)
                        onUpdate();
                });
            });
        }).catch(() => undefined);
    });
}
const motionRegistry = [];
function motionDisabled() {
    return document.body.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function clearMotionRegistry() {
    var _a;
    while (motionRegistry.length)
        (_a = motionRegistry.pop()) === null || _a === void 0 ? void 0 : _a.cancel();
}
function playMotion(target, keyframes, options) {
    if (!target || motionDisabled() || typeof target.animate !== 'function')
        return null;
    const animation = target.animate(keyframes, options);
    motionRegistry.push(animation);
    return animation;
}
function runPageMotion() {
    clearMotionRegistry();
    if (motionDisabled())
        return;
    const page = document.querySelector('.page');
    if (!page)
        return;
    const targets = Array.from(page.querySelectorAll('.hero-card, .summary-card, .dashboard-bento > section, .page-header'));
    targets.slice(0, 12).forEach((target, index) => {
        playMotion(target, [
            { opacity: 0, transform: 'translateY(12px)' },
            { opacity: 1, transform: 'translateY(0)' },
        ], { duration: 360, delay: index * 38, easing: 'cubic-bezier(.2,.78,.2,1)', fill: 'both' });
    });
    const heroMascot = page.querySelector('[data-mascot-motion="hero"]');
    playMotion(heroMascot, [
        { transform: 'translateY(0)' },
        { transform: 'translateY(-5px)' },
        { transform: 'translateY(0)' },
    ], { duration: 4200, iterations: Infinity, easing: 'ease-in-out' });
}
function schedulePageMotion() {
    window.requestAnimationFrame(() => window.requestAnimationFrame(runPageMotion));
}
function Icon(props) {
    let content;
    switch (props.name) {
        case 'home':
            content = React.createElement("path", { d: "M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z" });
            break;
        case 'list':
            content = React.createElement("g", null,
                React.createElement("path", { d: "M9 6h12M9 12h12M9 18h12" }),
                React.createElement("circle", { cx: "4", cy: "6", r: "1" }),
                React.createElement("circle", { cx: "4", cy: "12", r: "1" }),
                React.createElement("circle", { cx: "4", cy: "18", r: "1" }));
            break;
        case 'plus':
            content = React.createElement("path", { d: "M12 5v14M5 12h14" });
            break;
        case 'chart':
            content = React.createElement("g", null,
                React.createElement("path", { d: "M4 20V10M10 20V4M16 20v-7M22 20H2" }));
            break;
        case 'wallet':
            content = React.createElement("g", null,
                React.createElement("path", { d: "M3 6.5A2.5 2.5 0 0 1 5.5 4H19a2 2 0 0 1 2 2v13H5.5A2.5 2.5 0 0 1 3 16.5z" }),
                React.createElement("path", { d: "M16 10h6v5h-6a2.5 2.5 0 0 1 0-5Z" }),
                React.createElement("circle", { cx: "17", cy: "12.5", r: ".7", fill: "currentColor", stroke: "none" }));
            break;
        case 'invoice':
            content = React.createElement("g", null,
                React.createElement("path", { d: "M6 3h9l3 3v15H6z" }),
                React.createElement("path", { d: "M15 3v4h4M9 11h6M9 15h6M9 18h4" }),
                React.createElement("path", { d: "M4 7v14h10" }));
            break;
        case 'target':
            content = React.createElement("g", null,
                React.createElement("circle", { cx: "12", cy: "12", r: "9" }),
                React.createElement("circle", { cx: "12", cy: "12", r: "5" }),
                React.createElement("circle", { cx: "12", cy: "12", r: "1.5", fill: "currentColor", stroke: "none" }));
            break;
        case 'settings':
            content = React.createElement("g", null,
                React.createElement("circle", { cx: "12", cy: "12", r: "3" }),
                React.createElement("path", { d: "M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.2 19.3a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2v-4h.3A1.7 1.7 0 0 0 4 8.2a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.2 4a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4v.3A1.7 1.7 0 0 0 15 4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.9v4h-.9A1.7 1.7 0 0 0 19.4 15Z" }));
            break;
        case 'chevron-left':
            content = React.createElement("path", { d: "m15 18-6-6 6-6" });
            break;
        case 'chevron-right':
            content = React.createElement("path", { d: "m9 18 6-6-6-6" });
            break;
        case 'refresh':
            content = React.createElement("g", null,
                React.createElement("path", { d: "M20 11a8 8 0 1 0 2 5" }),
                React.createElement("path", { d: "M20 4v7h-7" }));
            break;
        case 'search':
            content = React.createElement("g", null,
                React.createElement("circle", { cx: "11", cy: "11", r: "7" }),
                React.createElement("path", { d: "m20 20-4-4" }));
            break;
        case 'edit':
            content = React.createElement("g", null,
                React.createElement("path", { d: "M4 20h4l11-11-4-4L4 16z" }),
                React.createElement("path", { d: "m13.5 6.5 4 4" }));
            break;
        case 'trash':
            content = React.createElement("g", null,
                React.createElement("path", { d: "M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" }),
                React.createElement("path", { d: "M10 11v6M14 11v6" }));
            break;
        case 'download':
            content = React.createElement("g", null,
                React.createElement("path", { d: "M12 3v12M7 10l5 5 5-5" }),
                React.createElement("path", { d: "M4 20h16" }));
            break;
        case 'close':
            content = React.createElement("path", { d: "M6 6l12 12M18 6 6 18" });
            break;
        case 'eye':
            content = React.createElement("g", null,
                React.createElement("path", { d: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" }),
                React.createElement("circle", { cx: "12", cy: "12", r: "2.5" }));
            break;
        default: content = React.createElement("circle", { cx: "12", cy: "12", r: "8" });
    }
    return React.createElement("svg", { className: props.className || 'nav-icon', width: props.size || 22, height: props.size || 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true" }, content);
}
function HeroMascots(props = {}) {
    return React.createElement("div", { className: "hero-character-stage", "aria-label": "\u6D3B\u6CFC\u7684\u5927\u828B\u5934\u548C\u6C89\u7A33\u7684\u5C0F\u70AE\u53F0" },
        React.createElement("div", { className: cn('hero-character', 'hero-character-duo', props.warning && 'hero-character-warning'), "data-mascot-motion": "hero" },
            React.createElement(MascotPicture, { asset: "hero", eager: true, alt: "" })),
        props.warning ? React.createElement("span", { className: "hero-alert-badge" }, "\u9884\u7B97\u63D0\u9192") : null,
        React.createElement("span", { className: "hero-life-dot hero-life-dot-one", "aria-hidden": "true" }),
        React.createElement("span", { className: "hero-life-dot hero-life-dot-two", "aria-hidden": "true" }));
}
function LogoMark() {
    return React.createElement("img", { className: "brand-logo-img", src: "/brand/brand-mark-v038.svg?v=0.3.9", alt: "", "aria-hidden": "true", decoding: "async" });
}
function BrandLockup() {
    return React.createElement("img", { className: "brand-lockup-img", src: "/brand/brand-lockup-v038.svg?v=0.3.9", alt: "\u828B\u70AE\u5C0F\u8D26\u672C\uFF0C\u4E24\u4E2A\u4EBA\u7684\u5C0F\u65E5\u5B50", decoding: "async" });
}
function Mascot(props) {
    const variant = (props.variant || 'idle');
    const labelMap = {
        idle: '活泼的大芋头和沉稳的小炮台一起守着小账本', loading: '大芋头和小炮台正在整理数据', empty: '芋头拿着铅笔邀请你记账', success: '芋头抱着完成清单，小炮台在旁边陪你庆祝', warning: '沉稳的小炮台提醒预算接近上限', safe: '沉稳的小炮台守护账户安全', summary: '沉稳的小炮台展示本月统计结果', invoice: '芋头和小炮台一起整理发票',
    };
    const assetKey = (variant in MASCOT_ASSETS ? variant : 'idle');
    return React.createElement("div", { className: cn('static-mascot', 'static-mascot-asset', `static-mascot-${variant}`), role: "img", "aria-label": props.label || labelMap[variant] || labelMap.idle },
        React.createElement(MascotPicture, { asset: assetKey, alt: "", eager: props.eager }));
}
class AnimatedNumber extends React.Component {
    constructor(props) {
        super(props);
        this.frame = null;
        this.startedAt = 0;
        this.from = 0;
        this.to = 0;
        this.state = { value: Number(props.value || 0) };
    }
    componentDidMount() { this.animateTo(Number(this.props.value || 0)); }
    componentDidUpdate(prevProps) {
        if (Number(prevProps.value || 0) !== Number(this.props.value || 0))
            this.animateTo(Number(this.props.value || 0));
    }
    componentWillUnmount() { if (this.frame)
        cancelAnimationFrame(this.frame); }
    animateTo(next) {
        if (document.body.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.setState({ value: next });
            return;
        }
        if (this.frame)
            cancelAnimationFrame(this.frame);
        this.from = Number(this.state.value || 0);
        this.to = next;
        this.startedAt = performance.now();
        const tick = (time) => {
            const progress = Math.min(1, (time - this.startedAt) / 650);
            const eased = 1 - Math.pow(1 - progress, 3);
            this.setState({ value: this.from + (this.to - this.from) * eased });
            if (progress < 1)
                this.frame = requestAnimationFrame(tick);
        };
        this.frame = requestAnimationFrame(tick);
    }
    render() { return this.props.children ? this.props.children(this.state.value) : String(Math.round(this.state.value)); }
}
function MonthSwitcher(props) {
    return React.createElement("div", { className: "month-switcher", "aria-label": "\u9009\u62E9\u6708\u4EFD" },
        React.createElement("button", { type: "button", onClick: () => props.onChange(shiftMonth(props.month, -1)) },
            React.createElement(Icon, { name: "chevron-left", size: 18 })),
        React.createElement("span", { className: "month-label" }, monthLabel(props.month)),
        React.createElement("button", { type: "button", onClick: () => props.onChange(shiftMonth(props.month, 1)), disabled: props.month >= currentMonth() },
            React.createElement(Icon, { name: "chevron-right", size: 18 })));
}
function Modal(props) {
    if (!props.open)
        return null;
    return React.createElement("div", { className: "modal-backdrop", onMouseDown: (event) => { if (event.target === event.currentTarget)
            props.onClose(); } },
        React.createElement("section", { className: "modal", role: "dialog", "aria-modal": "true", "aria-label": props.title },
            React.createElement("header", { className: "modal-header" },
                React.createElement("h3", null, props.title),
                React.createElement("button", { className: "icon-btn", type: "button", onClick: props.onClose, "aria-label": "\u5173\u95ED" },
                    React.createElement(Icon, { name: "close", size: 19 }))),
            React.createElement("div", { className: "modal-body" }, props.children)));
}
function PageHeader(props) {
    return React.createElement("header", { className: "page-header" },
        React.createElement("div", null,
            React.createElement("h1", { className: "page-title" }, props.title),
            React.createElement("p", { className: "page-subtitle" }, props.subtitle)),
        React.createElement("div", { className: "header-actions" }, props.children));
}
function LoadingPage() {
    return React.createElement("div", { className: "loading-page" },
        React.createElement("div", null,
            React.createElement(Mascot, { variant: "idle", label: "\u828B\u70AE\u6B63\u5728\u6574\u7406\u8D26\u672C" }),
            React.createElement("strong", null, "\u6B63\u5728\u6574\u7406\u5C0F\u8D26\u672C"),
            React.createElement("div", { className: "loading-dots" },
                React.createElement("span", null),
                React.createElement("span", null),
                React.createElement("span", null))));
}
function EmptyState(props) {
    return React.createElement("div", { className: "empty-state" },
        React.createElement("div", null,
            React.createElement("div", { className: "empty-mascot" },
                React.createElement(Mascot, { variant: "empty" })),
            React.createElement("h3", null, props.title),
            React.createElement("p", null, props.message),
            props.action));
}
function TransactionItem(props) {
    const item = props.item;
    const sign = item.type === 'income' ? '+' : item.type === 'expense' ? '-' : '';
    return React.createElement("div", { className: "transaction-item", style: { animationDelay: `${Math.min(props.index || 0, 10) * 35}ms` } },
        React.createElement("div", { className: "transaction-icon", style: { background: `${item.category_color || '#8E7CDA'}20` } }, CATEGORY_EMOJI[item.category_icon] || (item.type === 'transfer' ? '↔️' : '✨')),
        React.createElement("div", { className: "transaction-main" },
            React.createElement("div", { className: "transaction-name" },
                React.createElement("span", null, transactionTitle(item)),
                item.type === 'transfer' ? React.createElement("span", { className: "tag" }, "\u8F6C\u8D26") : null,
                Number(item.invoice_count || 0) > 0 ? React.createElement("span", { className: "tag invoice-link-tag" },
                    "\uD83E\uDDFE ",
                    item.invoice_count,
                    "\u5F20") : null),
            React.createElement("div", { className: "transaction-meta" }, transactionMeta(item))),
        React.createElement("div", { className: "transaction-side" },
            React.createElement("div", { className: cn('transaction-amount', item.type) },
                sign,
                formatMoney(item.amount_cents)),
            props.editable ? React.createElement("div", { className: "transaction-actions" },
                React.createElement("button", { className: "mini-action", onClick: () => props.onEdit(item) }, "\u7F16\u8F91"),
                React.createElement("button", { className: "mini-action", onClick: () => props.onDelete(item) }, "\u5220\u9664")) : null));
}
function TrendChart(props) {
    const items = props.items || [];
    const width = 720, height = 250, paddingX = 34, paddingTop = 20, paddingBottom = 34;
    if (!items.length)
        return React.createElement(EmptyState, { title: "\u8FD8\u6CA1\u6709\u8D8B\u52BF\u6570\u636E", message: "\u8BB0\u51E0\u7B14\u4EE5\u540E\uFF0C\u8FD9\u91CC\u4F1A\u6162\u6162\u753B\u51FA\u4F60\u4EEC\u7684\u751F\u6D3B\u8F68\u8FF9\u3002" });
    const max = Math.max(1, ...items.map((item) => Math.max(Number(item.income_cents || 0), Number(item.expense_cents || 0))));
    const plotHeight = height - paddingTop - paddingBottom;
    const plotWidth = width - paddingX * 2;
    const x = (index) => paddingX + (items.length === 1 ? plotWidth / 2 : index * plotWidth / (items.length - 1));
    const y = (value) => paddingTop + plotHeight - (Number(value || 0) / max) * plotHeight;
    const expensePoints = items.map((item, index) => `${x(index)},${y(item.expense_cents)}`).join(' ');
    const incomePoints = items.map((item, index) => `${x(index)},${y(item.income_cents)}`).join(' ');
    return React.createElement("div", { className: "chart-wrap" },
        React.createElement("svg", { className: "chart-svg", viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "\u6536\u5165\u548C\u652F\u51FA\u8D8B\u52BF\u56FE" },
            [0, .25, .5, .75, 1].map((ratio) => React.createElement("line", { key: String(ratio), className: "chart-grid-line", x1: paddingX, x2: width - paddingX, y1: paddingTop + plotHeight * ratio, y2: paddingTop + plotHeight * ratio })),
            React.createElement("polyline", { className: "chart-income chart-line-animate", points: incomePoints }),
            React.createElement("polyline", { className: "chart-expense chart-line-animate", points: expensePoints }),
            items.map((item, index) => React.createElement("g", { key: item.date },
                React.createElement("circle", { className: "chart-dot", cx: x(index), cy: y(item.income_cents), r: "4", fill: "#58A77B" },
                    React.createElement("title", null, `${compactDate(item.date)} 收入 ${formatMoney(item.income_cents)}`)),
                React.createElement("circle", { className: "chart-dot", cx: x(index), cy: y(item.expense_cents), r: "4", fill: "#E77C72" },
                    React.createElement("title", null, `${compactDate(item.date)} 支出 ${formatMoney(item.expense_cents)}`)),
                (index === 0 || index === items.length - 1 || index % Math.max(1, Math.floor(items.length / 5)) === 0) ? React.createElement("text", { className: "chart-label", textAnchor: "middle", x: x(index), y: height - 10 }, compactDate(item.date)) : null))),
        React.createElement("div", { className: "chart-legend" },
            React.createElement("span", { className: "legend-item" },
                React.createElement("i", { className: "legend-dot", style: { background: '#58A77B' } }),
                "\u6536\u5165"),
            React.createElement("span", { className: "legend-item" },
                React.createElement("i", { className: "legend-dot", style: { background: '#E77C72' } }),
                "\u652F\u51FA")));
}
function DonutChart(props) {
    const items = (props.items || []).slice(0, props.compact ? 5 : 7);
    const total = items.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
    if (!items.length || !total)
        return React.createElement(EmptyState, { title: "\u5206\u7C7B\u8FD8\u662F\u7A7A\u7684", message: "\u672C\u6708\u6709\u652F\u51FA\u540E\uFF0C\u8FD9\u91CC\u4F1A\u663E\u793A\u94B1\u90FD\u82B1\u53BB\u4E86\u54EA\u91CC\u3002" });
    const topItem = items[0];
    const categoryCount = items.length;
    const average = Math.round(total / Math.max(1, categoryCount));
    const chartItems = items.slice(0, props.compact ? 5 : 6);
    const listItems = items;
    const cx = 120, cy = 120, outerR = props.compact ? 82 : 88, innerR = props.compact ? 52 : 56;
    let angleCursor = 0;
    const gapAngle = chartItems.length > 1 ? 2.6 : 0;
    if (props.compact) {
        const compactItems = chartItems.slice(0, 4);
        let compactAngle = 0;
        return React.createElement("div", { className: "expense-compact" },
            React.createElement("div", { className: "expense-compact-chart" },
                React.createElement("svg", { className: "chart-svg expense-compact-svg", viewBox: "0 0 220 220", preserveAspectRatio: "xMidYMid meet", role: "img", "aria-label": "\u672C\u6708\u652F\u51FA\u5206\u7C7B\u5360\u6BD4" },
                    React.createElement("circle", { cx: "110", cy: "110", r: "76", fill: "none", stroke: "#EEF1ED", strokeWidth: "30" }),
                    compactItems.map((item, index) => {
                        const value = Number(item.amount_cents || 0);
                        const sweep = total > 0 ? value / total * 360 : 0;
                        const visibleSweep = Math.max(1.4, sweep - gapAngle);
                        const startAngle = compactAngle + gapAngle / 2;
                        const endAngle = compactAngle + visibleSweep;
                        compactAngle += sweep;
                        const color = WARM_CHART_COLORS[index % WARM_CHART_COLORS.length];
                        return React.createElement("path", { key: item.category_id || item.name, d: describeDonutSlice(110, 110, 91, 61, startAngle, endAngle), fill: color, className: "expense-donut-sector" },
                            React.createElement("title", null, `${item.name} ${formatMoney(value)}`));
                    }),
                    React.createElement("circle", { cx: "110", cy: "110", r: "56", fill: "#FFFEFC" }),
                    React.createElement("text", { className: "expense-donut-label", x: "110", y: "100", textAnchor: "middle" }, "\u672C\u6708\u652F\u51FA"),
                    React.createElement("text", { className: "expense-donut-total", x: "110", y: "128", textAnchor: "middle" }, formatCompactMoney(total))),
                React.createElement("div", { className: "expense-compact-caption" },
                    React.createElement("strong", null, categoryCount),
                    React.createElement("span", null, "\u4E2A\u5206\u7C7B"),
                    React.createElement("em", null,
                        "\u6700\u9AD8\uFF1A",
                        topItem.name))),
            React.createElement("div", { className: "expense-compact-list", role: "list", "aria-label": "\u652F\u51FA\u5206\u7C7B\u6458\u8981" },
                compactItems.map((item, index) => {
                    const percent = Math.round(Number(item.amount_cents || 0) / total * 100);
                    const color = WARM_CHART_COLORS[index % WARM_CHART_COLORS.length];
                    return React.createElement("div", { className: "expense-compact-row", role: "listitem", key: item.category_id || item.name },
                        React.createElement("span", { className: "expense-compact-dot", style: { background: color } }),
                        React.createElement("div", { className: "expense-compact-copy" },
                            React.createElement("strong", { title: item.name }, item.name),
                            React.createElement("span", null,
                                percent,
                                "%")),
                        React.createElement("b", null, formatCompactMoney(item.amount_cents)));
                }),
                props.onViewAll ? React.createElement("button", { className: "expense-compact-more", type: "button", onClick: props.onViewAll },
                    React.createElement("span", null, "\u67E5\u770B\u5168\u90E8\u5206\u7C7B"),
                    React.createElement(Icon, { name: "chevron-right", size: 16 })) : null));
    }
    return React.createElement("div", { className: cn('expense-module', props.compact && 'compact') },
        React.createElement("div", { className: "expense-module-head" },
            React.createElement("div", { className: "expense-head-copy" },
                React.createElement("span", { className: "expense-head-kicker" }, "\u5206\u7C7B\u6982\u89C8"),
                React.createElement("strong", null,
                    "\u8FD9\u4E2A\u6708\u4E3B\u8981\u82B1\u5728 ",
                    topItem.name),
                React.createElement("small", null, "\u4E0D\u76EF\u7740\u6BCF\u4E00\u7B14\uFF0C\u4E5F\u80FD\u77E5\u9053\u94B1\u5927\u6982\u6D41\u5411\u4E86\u54EA\u91CC\u3002")),
            React.createElement("div", { className: "expense-head-pills", role: "list", "aria-label": "\u652F\u51FA\u6458\u8981" },
                React.createElement("div", { className: "expense-pill", role: "listitem" },
                    React.createElement("span", null, "\u603B\u652F\u51FA"),
                    React.createElement("strong", null, formatCompactMoney(total))),
                React.createElement("div", { className: "expense-pill", role: "listitem" },
                    React.createElement("span", null, "\u5206\u7C7B\u6570"),
                    React.createElement("strong", null,
                        categoryCount,
                        " \u9879")),
                React.createElement("div", { className: "expense-pill", role: "listitem" },
                    React.createElement("span", null, "\u5355\u7C7B\u5747\u503C"),
                    React.createElement("strong", null, formatCompactMoney(average))))),
        React.createElement("div", { className: "expense-module-body" },
            React.createElement("div", { className: "expense-chart-panel" },
                React.createElement("div", { className: "expense-chart-shell" },
                    React.createElement("svg", { className: "chart-svg expense-donut-svg", viewBox: "0 0 240 240", preserveAspectRatio: "xMidYMid meet", role: "img", "aria-label": "\u652F\u51FA\u5206\u7C7B\u5360\u6BD4" },
                        React.createElement("circle", { cx: cx, cy: cy, r: outerR, fill: "none", stroke: "#EFE8DF", strokeWidth: outerR - innerR }),
                        chartItems.map((item, index) => {
                            const value = Number(item.amount_cents || 0);
                            const sweep = total > 0 ? value / total * 360 : 0;
                            const visibleSweep = Math.max(1.2, sweep - gapAngle);
                            const startAngle = angleCursor + gapAngle / 2;
                            const endAngle = angleCursor + visibleSweep;
                            angleCursor += sweep;
                            const color = WARM_CHART_COLORS[index % WARM_CHART_COLORS.length];
                            return React.createElement("path", { key: item.category_id || item.name, d: describeDonutSlice(cx, cy, outerR, innerR, startAngle, endAngle), fill: color, className: "expense-donut-sector" },
                                React.createElement("title", null, `${item.name} ${formatMoney(value)}`));
                        }),
                        React.createElement("circle", { cx: cx, cy: cy, r: innerR - 3, fill: "#FFFDF9" }),
                        React.createElement("text", { className: "expense-donut-label", x: cx, y: cy - 10, textAnchor: "middle" }, "\u672C\u6708\u652F\u51FA"),
                        React.createElement("text", { className: "expense-donut-total", x: cx, y: cy + 20, textAnchor: "middle" }, formatCompactMoney(total))),
                    React.createElement("div", { className: "expense-donut-caption" },
                        React.createElement("strong", null, categoryCount),
                        React.createElement("span", null, "\u4E2A\u652F\u51FA\u5206\u7C7B"),
                        React.createElement("em", null,
                            "\u6700\u9AD8\uFF1A",
                            topItem.name))),
                React.createElement("div", { className: "expense-chart-aside" },
                    React.createElement("div", { className: "expense-side-card expense-side-highlight" },
                        React.createElement("span", { className: "expense-side-label" }, "\u6700\u9AD8\u5206\u7C7B"),
                        React.createElement("div", { className: "expense-side-main" },
                            React.createElement("i", { style: { color: WARM_CHART_COLORS[0] } }, CATEGORY_EMOJI[topItem.icon] || '✨'),
                            React.createElement("strong", null, topItem.name)),
                        React.createElement("small", null,
                            Math.round(Number(topItem.amount_cents || 0) / total * 100),
                            "% \u00B7 ",
                            formatCompactMoney(topItem.amount_cents))),
                    React.createElement("div", { className: "expense-side-card" },
                        React.createElement("span", { className: "expense-side-label" }, "\u5FEB\u901F\u5206\u5E03"),
                        React.createElement("div", { className: "expense-mini-legend" }, chartItems.slice(0, 4).map((item, index) => {
                            const color = WARM_CHART_COLORS[index % WARM_CHART_COLORS.length];
                            const percent = Math.round(Number(item.amount_cents || 0) / total * 100);
                            return React.createElement("div", { key: item.category_id || item.name, className: "expense-mini-item" },
                                React.createElement("span", { className: "expense-mini-dot", style: { background: color } }),
                                React.createElement("span", { className: "expense-mini-name", title: item.name }, item.name),
                                React.createElement("span", { className: "expense-mini-percent" },
                                    percent,
                                    "%"));
                        }))))),
            React.createElement("div", { className: "expense-list-panel" },
                React.createElement("div", { className: "expense-list-head" },
                    React.createElement("strong", null, "\u5206\u7C7B\u660E\u7EC6"),
                    React.createElement("span", null, "\u4ECE\u9AD8\u5230\u4F4E\u6392\u5217\uFF0C\u66F4\u5BB9\u6613\u4E00\u773C\u770B\u6E05\u91CD\u70B9\u3002")),
                React.createElement("div", { className: "expense-ranking", role: "list", "aria-label": "\u652F\u51FA\u5206\u7C7B\u6392\u884C" }, listItems.map((item, index) => {
                    const percent = Math.round(Number(item.amount_cents || 0) / total * 100);
                    const color = WARM_CHART_COLORS[index % WARM_CHART_COLORS.length];
                    return React.createElement("div", { className: "expense-rank-row", role: "listitem", key: item.category_id || item.name },
                        React.createElement("div", { className: "expense-rank-order" }, index + 1),
                        React.createElement("div", { className: "expense-rank-icon", style: { background: `${color}18`, color } }, CATEGORY_EMOJI[item.icon] || '✨'),
                        React.createElement("div", { className: "expense-rank-main" },
                            React.createElement("div", { className: "expense-rank-top" },
                                React.createElement("span", { className: "expense-rank-name", title: item.name }, item.name),
                                React.createElement("span", { className: "expense-rank-percent" },
                                    percent,
                                    "%")),
                            React.createElement("div", { className: "expense-rank-bar", "aria-hidden": "true" },
                                React.createElement("span", { style: { width: `${Math.max(4, percent)}%`, background: color } }))),
                        React.createElement("strong", { className: "expense-rank-amount" }, formatCompactMoney(item.amount_cents)));
                })))),
        props.onViewAll ? React.createElement("div", { className: "expense-module-footer" },
            React.createElement("button", { className: "expense-more-btn", type: "button", onClick: props.onViewAll },
                React.createElement("span", null, "\u67E5\u770B\u5168\u90E8\u5206\u7C7B"),
                React.createElement("small", null,
                    "\u5171 ",
                    categoryCount,
                    " \u9879"),
                React.createElement(Icon, { name: "chevron-right", size: 16 }))) : null);
}
function MonthlyBars(props) {
    const items = props.items || [];
    if (!items.length)
        return React.createElement(EmptyState, { title: "\u8FD8\u6CA1\u6709\u6708\u5EA6\u5BF9\u6BD4", message: "\u6709\u4E86\u51E0\u4E2A\u6708\u7684\u6570\u636E\u4EE5\u540E\uFF0C\u4F1A\u66F4\u5BB9\u6613\u770B\u51FA\u53D8\u5316\u3002" });
    const width = 720, height = 260, px = 38, py = 24, bottom = 38;
    const max = Math.max(1, ...items.map((item) => Math.max(Number(item.income_cents || 0), Number(item.expense_cents || 0))));
    const plotH = height - py - bottom, groupW = (width - px * 2) / items.length;
    return React.createElement("div", { className: "chart-wrap" },
        React.createElement("svg", { className: "chart-svg", viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": "\u8FD1\u516D\u4E2A\u6708\u6536\u652F\u5BF9\u6BD4" },
            [0, .5, 1].map((ratio) => React.createElement("line", { key: String(ratio), className: "chart-grid-line", x1: px, x2: width - px, y1: py + plotH * ratio, y2: py + plotH * ratio })),
            items.map((item, index) => {
                const incomeH = Number(item.income_cents || 0) / max * plotH;
                const expenseH = Number(item.expense_cents || 0) / max * plotH;
                const gx = px + index * groupW + groupW * .2;
                const barW = groupW * .24;
                return React.createElement("g", { key: item.month },
                    React.createElement("rect", { className: "chart-bar", x: gx, y: py + plotH - incomeH, width: barW, height: incomeH, rx: "5", fill: "#58A77B" },
                        React.createElement("title", null, `${monthLabel(item.month)} 收入 ${formatMoney(item.income_cents)}`)),
                    React.createElement("rect", { className: "chart-bar", style: { animationDelay: `${index * 70 + 80}ms` }, x: gx + barW + 5, y: py + plotH - expenseH, width: barW, height: expenseH, rx: "5", fill: "#E77C72" },
                        React.createElement("title", null, `${monthLabel(item.month)} 支出 ${formatMoney(item.expense_cents)}`)),
                    React.createElement("text", { className: "chart-label", textAnchor: "middle", x: gx + barW, y: height - 13 },
                        item.month.slice(5),
                        "\u6708"));
            })),
        React.createElement("div", { className: "chart-legend" },
            React.createElement("span", { className: "legend-item" },
                React.createElement("i", { className: "legend-dot", style: { background: '#58A77B' } }),
                "\u6536\u5165"),
            React.createElement("span", { className: "legend-item" },
                React.createElement("i", { className: "legend-dot", style: { background: '#E77C72' } }),
                "\u652F\u51FA")));
}
function BudgetProgressList(props) {
    const items = props.items || [];
    if (!items.length)
        return React.createElement(EmptyState, { title: "\u8FD8\u6CA1\u8BBE\u7F6E\u5206\u7C7B\u9884\u7B97", message: "\u7ED9\u5E38\u7528\u5206\u7C7B\u8BBE\u4E2A\u9884\u7B97\uFF0C\u6708\u5E95\u770B\u8D77\u6765\u4F1A\u66F4\u8F7B\u677E\u3002", action: props.onSetup ? React.createElement("button", { className: "btn btn-secondary", onClick: props.onSetup }, "\u53BB\u8BBE\u7F6E\u9884\u7B97") : null });
    return React.createElement("div", null, items.map((item) => {
        const percent = safePercent(item.used_cents, item.amount_cents);
        const status = item.amount_cents > 0 && item.used_cents > item.amount_cents ? 'over' : percent >= 80 ? 'notice' : 'normal';
        return React.createElement("div", { className: "budget-row", key: item.id },
            React.createElement("div", { className: "budget-top" },
                React.createElement("span", null,
                    CATEGORY_EMOJI[item.category_icon] || '✨',
                    " ",
                    item.category_name),
                React.createElement("strong", null,
                    formatCompactMoney(item.used_cents),
                    " / ",
                    formatCompactMoney(item.amount_cents))),
            React.createElement("div", { className: "progress-track" },
                React.createElement("div", { className: cn('progress-fill', status), style: { width: `${Math.max(2, percent)}%` } })));
    }));
}
function SummaryMetric(props) {
    return React.createElement("article", { className: cn('card', 'summary-card', `summary-${props.tone}`) },
        React.createElement("div", { className: "summary-icon" },
            React.createElement(Icon, { name: props.icon, size: 19 })),
        React.createElement("div", { className: "summary-content" },
            React.createElement("span", { className: "summary-label" }, props.label),
            React.createElement("span", { className: "summary-value" },
                React.createElement(AnimatedNumber, { value: props.value }, (value) => formatMoney(value))),
            React.createElement("div", { className: "summary-note" }, props.note)));
}
function MobileDashboardView(props) {
    const data = props.data;
    const budgetPercent = safePercent(data.budgetUsedCents, data.budgetCents);
    const recent = (data.recent || []).slice(0, 4);
    return React.createElement("div", { className: "mobile-product-view mobile-dashboard-v038" },
        React.createElement("section", { className: "mobile-home-hero card" },
            React.createElement("div", { className: "mobile-home-hero-body" },
                React.createElement("div", { className: "mobile-home-hero-copy" },
                    React.createElement("span", null,
                        monthLabel(props.month),
                        " \u00B7 \u5BB6\u5EAD\u751F\u6D3B\u7C3F"),
                    React.createElement("h2", null, data.expenseCents > 0 ? '把今天的小日子记下来' : '从今天的一笔小事开始'),
                    React.createElement("p", null, "\u5927\u828B\u5934\u8D1F\u8D23\u5FEB\u901F\u8BB0\u5F55\uFF0C\u5C0F\u70AE\u53F0\u8D1F\u8D23\u5B89\u9759\u6574\u7406\u3002")),
                React.createElement("div", { className: "mobile-home-hero-mascot" },
                    React.createElement(MascotPicture, { asset: "hero", eager: true, alt: "" }))),
            React.createElement("button", { className: "mobile-primary-action", type: "button", onClick: () => props.navigate('add') },
                React.createElement(Icon, { name: "plus", size: 20 }),
                "\u8BB0\u4E00\u7B14")),
        React.createElement("section", { className: "mobile-section-block" },
            React.createElement("div", { className: "mobile-section-head" },
                React.createElement("div", null,
                    React.createElement("span", null, "\u672C\u6708\u6982\u89C8"),
                    React.createElement("small", null, "\u6536\u5165\u3001\u652F\u51FA\u4E0E\u7ED3\u4F59")),
                React.createElement("button", { type: "button", onClick: () => props.navigate('stats') },
                    "\u770B\u7EDF\u8BA1",
                    React.createElement(Icon, { name: "chevron-right", size: 15 }))),
            React.createElement("div", { className: "mobile-money-grid mobile-money-grid-v038" },
                React.createElement("article", { className: "mobile-money-card income" },
                    React.createElement("span", null, "\u6536\u5165"),
                    React.createElement("strong", null, formatCompactMoney(data.incomeCents)),
                    React.createElement("small", null,
                        "\u4E0A\u6708 ",
                        formatCompactMoney(data.previousIncomeCents))),
                React.createElement("article", { className: "mobile-money-card expense" },
                    React.createElement("span", null, "\u652F\u51FA"),
                    React.createElement("strong", null, formatCompactMoney(data.expenseCents)),
                    React.createElement("small", null,
                        "\u4E0A\u6708 ",
                        formatCompactMoney(data.previousExpenseCents))),
                React.createElement("article", { className: "mobile-money-card balance mobile-money-balance" },
                    React.createElement("span", null, "\u672C\u6708\u7ED3\u4F59"),
                    React.createElement("strong", null, formatCompactMoney(data.balanceCents)),
                    React.createElement("small", null, "\u6536\u5165\u51CF\u53BB\u652F\u51FA")))),
        React.createElement("section", { className: "mobile-section-block" },
            React.createElement("div", { className: "mobile-section-head" },
                React.createElement("div", null,
                    React.createElement("span", null, "\u5E38\u7528\u529F\u80FD"),
                    React.createElement("small", null, "\u5FEB\u901F\u8FDB\u5165\u5E38\u7528\u7BA1\u7406"))),
            React.createElement("div", { className: "mobile-quick-grid" },
                React.createElement("button", { type: "button", onClick: () => props.navigate('budgets') },
                    React.createElement("span", { className: "mobile-quick-icon mint" },
                        React.createElement(Icon, { name: "target" })),
                    React.createElement("strong", null, "\u9884\u7B97"),
                    React.createElement("small", null, "\u63A7\u5236\u8282\u594F")),
                React.createElement("button", { type: "button", onClick: () => props.navigate('accounts') },
                    React.createElement("span", { className: "mobile-quick-icon lavender" },
                        React.createElement(Icon, { name: "wallet" })),
                    React.createElement("strong", null, "\u8D26\u6237"),
                    React.createElement("small", null, "\u67E5\u770B\u4F59\u989D")),
                React.createElement("button", { type: "button", onClick: () => props.navigate('invoices') },
                    React.createElement("span", { className: "mobile-quick-icon peach" },
                        React.createElement(Icon, { name: "invoice" })),
                    React.createElement("strong", null, "\u53D1\u7968"),
                    React.createElement("small", null, "\u5173\u8054\u6536\u652F")),
                React.createElement("button", { type: "button", onClick: () => props.navigate('transactions') },
                    React.createElement("span", { className: "mobile-quick-icon pink" },
                        React.createElement(Icon, { name: "list" })),
                    React.createElement("strong", null, "\u660E\u7EC6"),
                    React.createElement("small", null, "\u67E5\u627E\u8BB0\u5F55")))),
        React.createElement("section", { className: "mobile-panel card" },
            React.createElement("div", { className: "mobile-section-head" },
                React.createElement("div", null,
                    React.createElement("span", null, "\u6700\u8FD1\u8BB0\u5F55"),
                    React.createElement("small", null, "\u6700\u8FD1\u53D1\u751F\u7684\u5C0F\u8D26")),
                React.createElement("button", { type: "button", onClick: () => props.navigate('transactions') },
                    "\u5168\u90E8",
                    React.createElement(Icon, { name: "chevron-right", size: 15 }))),
            recent.length ? React.createElement("div", { className: "mobile-recent-list" }, recent.map((item, index) => React.createElement(TransactionItem, { key: item.id, item: item, index: index }))) : React.createElement(EmptyState, { title: "\u8FD8\u6CA1\u6709\u8BB0\u5F55", message: "\u4ECA\u5929\u7684\u7B2C\u4E00\u7B14\uFF0C\u53EF\u4EE5\u4ECE\u8FD9\u91CC\u5F00\u59CB\u3002" })),
        React.createElement("section", { className: "mobile-panel card mobile-budget-panel" },
            React.createElement("div", { className: "mobile-section-head" },
                React.createElement("div", null,
                    React.createElement("span", null, "\u9884\u7B97\u8FDB\u5EA6"),
                    React.createElement("small", null, "\u522B\u7ED9\u81EA\u5DF1\u592A\u5927\u538B\u529B")),
                React.createElement("button", { type: "button", onClick: () => props.navigate('budgets') },
                    "\u7BA1\u7406",
                    React.createElement(Icon, { name: "chevron-right", size: 15 }))),
            data.budgetCents > 0 ? React.createElement(React.Fragment, null,
                React.createElement("div", { className: "mobile-budget-number" },
                    React.createElement("strong", null, formatCompactMoney(data.budgetUsedCents)),
                    React.createElement("span", null,
                        "/ ",
                        formatCompactMoney(data.budgetCents)),
                    React.createElement("em", null,
                        budgetPercent,
                        "%")),
                React.createElement("div", { className: "progress-track" },
                    React.createElement("div", { className: cn('progress-fill', budgetPercent >= 100 ? 'over' : budgetPercent >= 80 ? 'notice' : 'normal'), style: { width: `${Math.max(2, budgetPercent)}%` } }))) : React.createElement("div", { className: "mobile-empty-row" },
                React.createElement("span", null, "\u8FD8\u6CA1\u8BBE\u7F6E\u9884\u7B97"),
                React.createElement("button", { type: "button", onClick: () => props.navigate('budgets') }, "\u53BB\u8BBE\u7F6E"))));
}
function MobileTransactionsView(props) {
    const items = props.items || [];
    const groups = items.reduce((map, item) => {
        const key = (item.occurred_at || '').slice(0, 10) || '未注明日期';
        (map[key] || (map[key] = [])).push(item);
        return map;
    }, {});
    return React.createElement("div", { className: "mobile-product-view mobile-transactions-v037" },
        React.createElement("div", { className: "mobile-page-title" },
            React.createElement("div", null,
                React.createElement("h1", null, "\u660E\u7EC6"),
                React.createElement("p", null, "\u6BCF\u4E00\u7B14\u90FD\u6309\u65E5\u671F\u6574\u7406\u597D\u4E86\u3002")),
            React.createElement("button", { className: "mobile-square-btn", type: "button", onClick: () => props.navigate('add'), "aria-label": "\u8BB0\u4E00\u7B14" },
                React.createElement(Icon, { name: "plus" }))),
        React.createElement("div", { className: "mobile-month-bar" },
            React.createElement(MonthSwitcher, { month: props.month, onChange: props.onMonthChange })),
        React.createElement("div", { className: "mobile-segmented", role: "tablist", "aria-label": "\u6536\u652F\u7C7B\u578B" },
            React.createElement("button", { className: !props.type ? 'active' : '', onClick: () => props.onType('') }, "\u5168\u90E8"),
            React.createElement("button", { className: props.type === 'income' ? 'active' : '', onClick: () => props.onType('income') }, "\u6536\u5165"),
            React.createElement("button", { className: props.type === 'expense' ? 'active' : '', onClick: () => props.onType('expense') }, "\u652F\u51FA"),
            React.createElement("button", { className: props.type === 'transfer' ? 'active' : '', onClick: () => props.onType('transfer') }, "\u8F6C\u8D26")),
        React.createElement("div", { className: "mobile-search-row" },
            React.createElement("div", { className: "search-wrap" },
                React.createElement(Icon, { name: "search", size: 18 }),
                React.createElement("input", { className: "input", placeholder: "\u641C\u7D22\u5546\u6237\u6216\u5907\u6CE8", value: props.search, onChange: (event) => props.onSearch(event.target.value), onKeyDown: (event) => { if (event.key === 'Enter')
                        props.onSubmitSearch(); } })),
            React.createElement("button", { className: "mobile-filter-btn", type: "button", onClick: props.onSubmitSearch },
                React.createElement(Icon, { name: "search", size: 18 }))),
        props.loading ? React.createElement("div", { className: "stack" },
            React.createElement("div", { className: "skeleton", style: { height: '82px' } }),
            React.createElement("div", { className: "skeleton", style: { height: '82px' } })) : items.length ? React.createElement("div", { className: "mobile-date-groups" }, Object.entries(groups).map(([date, groupItems]) => {
            const expense = groupItems.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
            const income = groupItems.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
            return React.createElement("section", { className: "mobile-date-group", key: date },
                React.createElement("header", null,
                    React.createElement("div", null,
                        React.createElement("strong", null, compactDate(date)),
                        React.createElement("span", null, date === today() ? '今天' : '')),
                    React.createElement("small", null,
                        "\u652F\u51FA ",
                        formatCompactMoney(expense),
                        " \u00B7 \u6536\u5165 ",
                        formatCompactMoney(income))),
                React.createElement("div", { className: "mobile-transaction-card" }, groupItems.map((item, index) => React.createElement(TransactionItem, { key: item.id, item: item, index: index, editable: true, onEdit: props.onEdit, onDelete: props.onDelete }))));
        })) : React.createElement(EmptyState, { title: "\u6CA1\u6709\u627E\u5230\u8BB0\u5F55", message: "\u6362\u4E2A\u6761\u4EF6\uFF0C\u6216\u8005\u8BB0\u4E0B\u4E00\u7B14\u3002" }));
}
function MobileMonthlyBars(props) {
    const items = (props.items || []).slice(-6);
    if (!items.length)
        return React.createElement(EmptyState, { title: "\u8FD8\u6CA1\u6709\u6708\u5EA6\u5BF9\u6BD4", message: "\u6709\u4E86\u51E0\u4E2A\u6708\u7684\u6570\u636E\u4EE5\u540E\uFF0C\u4F1A\u66F4\u5BB9\u6613\u770B\u51FA\u53D8\u5316\u3002" });
    const max = Math.max(1, ...items.map((item) => Math.max(Number(item.income_cents || 0), Number(item.expense_cents || 0))));
    return React.createElement("div", { className: "mobile-monthly-list" }, items.map((item) => {
        const income = Number(item.income_cents || 0);
        const expense = Number(item.expense_cents || 0);
        return React.createElement("article", { className: "mobile-monthly-row", key: item.month },
            React.createElement("div", { className: "mobile-monthly-head" },
                React.createElement("strong", null,
                    item.month.slice(5),
                    "\u6708"),
                React.createElement("span", null,
                    "\u6536\u5165 ",
                    formatCompactMoney(income),
                    " \u00B7 \u652F\u51FA ",
                    formatCompactMoney(expense))),
            React.createElement("div", { className: "mobile-monthly-bars" },
                React.createElement("div", null,
                    React.createElement("i", { className: "income", style: { width: `${Math.max(3, income / max * 100)}%` } })),
                React.createElement("div", null,
                    React.createElement("i", { className: "expense", style: { width: `${Math.max(3, expense / max * 100)}%` } }))));
    }));
}
function MobileStatsView(props) {
    const categories = props.categories || [];
    const total = categories.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
    const top = categories[0];
    const budgetCount = (props.budgets || []).length;
    return React.createElement("div", { className: "mobile-product-view mobile-stats-v038" },
        React.createElement("div", { className: "mobile-page-title" },
            React.createElement("div", null,
                React.createElement("h1", null, "\u7EDF\u8BA1"),
                React.createElement("p", null, "\u770B\u770B\u8FD9\u4E2A\u6708\u7684\u94B1\u90FD\u53BB\u4E86\u54EA\u91CC\u3002"))),
        React.createElement("div", { className: "mobile-month-bar" },
            React.createElement(MonthSwitcher, { month: props.month, onChange: props.onMonthChange })),
        React.createElement("section", { className: "mobile-stats-summary card" },
            React.createElement("div", { className: "mobile-section-head" },
                React.createElement("div", null,
                    React.createElement("span", null, "\u6708\u5EA6\u603B\u89C8"),
                    React.createElement("small", null, monthLabel(props.month)))),
            React.createElement("div", { className: "mobile-stats-summary-grid mobile-stats-summary-v038" },
                React.createElement("div", { className: "primary" },
                    React.createElement("span", null, "\u672C\u6708\u652F\u51FA"),
                    React.createElement("strong", null, formatCompactMoney(total)),
                    React.createElement("small", null,
                        categories.length,
                        " \u4E2A\u5206\u7C7B")),
                React.createElement("div", null,
                    React.createElement("span", null, "\u6700\u9AD8\u5206\u7C7B"),
                    React.createElement("strong", null, top ? top.name : '暂无'),
                    React.createElement("small", null, top ? formatCompactMoney(top.amount_cents) : '等待记录')),
                React.createElement("div", null,
                    React.createElement("span", null, "\u9884\u7B97\u9879\u76EE"),
                    React.createElement("strong", null, budgetCount),
                    React.createElement("small", null, budgetCount ? '正在跟踪' : '还未设置')))),
        React.createElement("section", { className: "mobile-panel card mobile-donut-panel" },
            React.createElement("div", { className: "mobile-section-head" },
                React.createElement("div", null,
                    React.createElement("span", null, "\u652F\u51FA\u5360\u6BD4"),
                    React.createElement("small", null, "\u4ECE\u9AD8\u5230\u4F4E\u67E5\u770B"))),
            React.createElement(DonutChart, { items: categories, compact: true })),
        React.createElement("section", { className: "mobile-panel card" },
            React.createElement("div", { className: "mobile-section-head" },
                React.createElement("div", null,
                    React.createElement("span", null, "\u5206\u7C7B\u9884\u7B97"),
                    React.createElement("small", null, "\u9884\u7B97\u4E0E\u5B9E\u9645\u652F\u51FA")),
                React.createElement("button", { type: "button", onClick: () => props.navigate('budgets') },
                    "\u7BA1\u7406",
                    React.createElement(Icon, { name: "chevron-right", size: 15 }))),
            React.createElement(BudgetProgressList, { items: props.budgets, onSetup: () => props.navigate('budgets') })),
        React.createElement("section", { className: "mobile-panel card" },
            React.createElement("div", { className: "mobile-section-head" },
                React.createElement("div", null,
                    React.createElement("span", null, "\u8FD1\u516D\u4E2A\u6708"),
                    React.createElement("small", null, "\u6536\u5165\u548C\u652F\u51FA\u7684\u53D8\u5316"))),
            React.createElement(MobileMonthlyBars, { items: props.months })));
}
class DashboardPage extends React.Component {
    constructor(props) { super(props); this.state = { loading: true, overview: null, trend: [], categories: [], budgets: [], invoiceSummary: null }; }
    componentDidMount() { this.load(); }
    componentDidUpdate(prevProps) { if (prevProps.month !== this.props.month || prevProps.refreshToken !== this.props.refreshToken)
        this.load(); }
    async load() {
        this.setState({ loading: true });
        try {
            const month = this.props.month;
            const [overview, trend, categories, budgets, invoiceSummary] = await Promise.all([
                apiRequest(`/api/stats/overview?month=${month}`), apiRequest(`/api/stats/trend?month=${month}`),
                apiRequest(`/api/stats/category-breakdown?month=${month}`), apiRequest(`/api/stats/budget-progress?month=${month}`),
                apiRequest(`/api/invoices/summary?month=${month}`),
            ]);
            this.setState({ loading: false, overview, trend: trend.items, categories: categories.items, budgets: budgets.items, invoiceSummary });
        }
        catch (error) {
            this.setState({ loading: false });
            this.props.onError(error.message);
        }
    }
    render() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        if (this.state.loading || !this.state.overview)
            return React.createElement(LoadingPage, null);
        const data = this.state.overview;
        const userName = this.props.bootstrap.user.displayName;
        const hour = new Date().getHours();
        const greeting = hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
        const budgetPercent = safePercent(data.budgetUsedCents, data.budgetCents);
        return React.createElement("div", { className: "page dashboard-page dashboard-page-v034" },
            React.createElement("div", { className: "desktop-product-view" },
                React.createElement("div", { className: "dashboard-header-wrap" },
                    React.createElement(PageHeader, { title: `${greeting}，${userName}`, subtitle: "\u4E24\u4E2A\u4EBA\u7684\u5C0F\u65E5\u5B50\uFF0C\u90FD\u8BB0\u5728\u8FD9\u91CC\u3002" },
                        React.createElement(MonthSwitcher, { month: this.props.month, onChange: this.props.onMonthChange }),
                        React.createElement("button", { className: "icon-btn", onClick: () => this.load(), title: "\u5237\u65B0", "aria-label": "\u5237\u65B0\u9996\u9875\u6570\u636E" },
                            React.createElement(Icon, { name: "refresh", size: 18 })))),
                React.createElement("section", { className: "hero-card card dashboard-hero" },
                    React.createElement("div", { className: "hero-copy" },
                        React.createElement("span", { className: "hero-kicker" },
                            monthLabel(this.props.month),
                            " \u00B7 \u5BB6\u5EAD\u751F\u6D3B\u7C3F"),
                        React.createElement("h2", null, data.expenseCents > 0 ? '把平常的小日子，轻轻记下来' : '从今天的一笔小事开始'),
                        React.createElement("p", null, data.expenseCents > 0 ? `这个月支出 ${formatMoney(data.expenseCents)}，结余 ${formatMoney(data.balanceCents)}。大芋头负责马上记，小炮台负责慢慢整理。` : '一顿饭、一杯饮料、一次出行，都是你们共同生活的一部分。'),
                        React.createElement("div", { className: "hero-actions" },
                            React.createElement("button", { className: "btn btn-primary", onClick: () => this.props.navigate('add') },
                                React.createElement(Icon, { name: "plus", size: 18 }),
                                "\u8BB0\u4E00\u7B14"),
                            React.createElement("button", { className: "btn btn-secondary", onClick: () => this.props.navigate('transactions') }, "\u770B\u770B\u660E\u7EC6")),
                        React.createElement("div", { className: "hero-gentle-note" },
                            React.createElement("span", null),
                            "\u4ECA\u5929\u4E5F\u4E0D\u7528\u8BB0\u5F97\u5F88\u5B8C\u7F8E\uFF0C\u91CD\u8981\u7684\u5148\u7559\u4E0B\u3002")),
                    React.createElement("div", { className: "hero-mascot" },
                        React.createElement(HeroMascots, { warning: data.budgetCents > 0 && budgetPercent >= 90 }))),
                React.createElement("section", { className: "grid grid-4 summary-grid dashboard-summary", "aria-label": "\u672C\u6708\u8D22\u52A1\u6458\u8981" },
                    React.createElement(SummaryMetric, { tone: "income", icon: "wallet", label: "\u672C\u6708\u6536\u5165", value: data.incomeCents, note: `上月 ${formatCompactMoney(data.previousIncomeCents)}` }),
                    React.createElement(SummaryMetric, { tone: "expense", icon: "chart", label: "\u672C\u6708\u652F\u51FA", value: data.expenseCents, note: `上月 ${formatCompactMoney(data.previousExpenseCents)}` }),
                    React.createElement(SummaryMetric, { tone: "balance", icon: "target", label: "\u672C\u6708\u7ED3\u4F59", value: data.balanceCents, note: "\u6536\u5165\u51CF\u53BB\u652F\u51FA" }),
                    React.createElement(SummaryMetric, { tone: "assets", icon: "wallet", label: "\u8D26\u6237\u5408\u8BA1", value: data.totalBalanceCents, note: `共 ${data.accounts.length} 个使用中账户` })),
                React.createElement("div", { className: "dashboard-bento" },
                    React.createElement("section", { className: "card card-pad dashboard-card dashboard-card-trend" },
                        React.createElement("div", { className: "card-title-row" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "card-title" }, "\u672C\u6708\u6536\u652F\u8D8B\u52BF"),
                                React.createElement("p", { className: "card-subtitle" }, "\u6BCF\u5929\u7684\u6536\u5165\u548C\u652F\u51FA\u53D8\u5316")),
                            React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => this.props.navigate('stats') }, "\u5B8C\u6574\u7EDF\u8BA1")),
                        React.createElement(TrendChart, { items: this.state.trend })),
                    React.createElement("section", { className: "card card-pad spending-card dashboard-card dashboard-card-spending" },
                        React.createElement("div", { className: "card-title-row" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "card-title" }, "\u94B1\u82B1\u53BB\u4E86\u54EA\u91CC"),
                                React.createElement("p", { className: "card-subtitle" }, "\u672C\u6708\u652F\u51FA\u5206\u7C7B"))),
                        React.createElement(DonutChart, { items: this.state.categories, compact: true, onViewAll: () => this.props.navigate('stats') })),
                    React.createElement("section", { className: "card card-pad dashboard-card dashboard-card-recent" },
                        React.createElement("div", { className: "card-title-row" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "card-title" }, "\u6700\u8FD1\u8BB0\u5F55"),
                                React.createElement("p", { className: "card-subtitle" }, "\u6700\u65B0\u7684\u516D\u7B14\u5C0F\u8D26")),
                            React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => this.props.navigate('transactions') }, "\u5168\u90E8\u660E\u7EC6")),
                        data.recent.length ? React.createElement("div", { className: "list dashboard-recent-list" }, data.recent.map((item, index) => React.createElement(TransactionItem, { key: item.id, item: item, index: index }))) : React.createElement(EmptyState, { title: "\u8FD9\u91CC\u8FD8\u6CA1\u6709\u8BB0\u5F55", message: "\u4ECA\u5929\u53D1\u751F\u7684\u7B2C\u4E00\u7B14\u5C0F\u4E8B\uFF0C\u53EF\u4EE5\u4ECE\u8FD9\u91CC\u5F00\u59CB\u3002", action: React.createElement("button", { className: "btn btn-primary", onClick: () => this.props.navigate('add') }, "\u8BB0\u7B2C\u4E00\u7B14") })),
                    React.createElement("section", { className: "card card-pad dashboard-card dashboard-card-budget" },
                        React.createElement("div", { className: "card-title-row" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "card-title" }, "\u9884\u7B97\u8FDB\u5EA6"),
                                React.createElement("p", { className: "card-subtitle" }, "\u63A7\u5236\u8282\u594F\uFF0C\u4E0D\u7528\u7ED9\u81EA\u5DF1\u538B\u529B")),
                            React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => this.props.navigate('budgets') }, "\u7BA1\u7406\u9884\u7B97")),
                        data.budgetCents > 0 ? React.createElement("div", { className: "dashboard-total-budget" },
                            React.createElement("div", { className: "budget-top" },
                                React.createElement("span", null, "\u603B\u9884\u7B97"),
                                React.createElement("strong", null,
                                    formatCompactMoney(data.budgetUsedCents),
                                    " / ",
                                    formatCompactMoney(data.budgetCents))),
                            React.createElement("div", { className: "progress-track" },
                                React.createElement("div", { className: cn('progress-fill', budgetPercent >= 100 ? 'over' : budgetPercent >= 80 ? 'notice' : 'normal'), style: { width: `${Math.max(2, budgetPercent)}%` } }))) : null,
                        React.createElement(BudgetProgressList, { items: this.state.budgets, onSetup: () => this.props.navigate('budgets') })),
                    React.createElement("section", { className: "card card-pad invoice-pocket-card dashboard-card dashboard-card-invoice" },
                        React.createElement("div", { className: "dashboard-invoice-head" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "card-title" }, "\u53D1\u7968\u5C0F\u5939\u5B50"),
                                React.createElement("p", { className: "card-subtitle" }, "\u6536\u5230\u7684\u53D1\u7968\u5173\u8054\u652F\u51FA\uFF0C\u5F00\u51FA\u7684\u53D1\u7968\u5173\u8054\u6536\u5165\u3002")),
                            React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => this.props.navigate('invoices') }, "\u6253\u5F00\u53D1\u7968\u5939")),
                        React.createElement("div", { className: "invoice-pocket-grid dashboard-invoice-grid" },
                            React.createElement("button", { type: "button", onClick: () => this.props.navigate('invoices') },
                                React.createElement("span", null, "\u6211\u6536\u5230\u7684"),
                                React.createElement("strong", null, formatCompactMoney(((_b = (_a = this.state.invoiceSummary) === null || _a === void 0 ? void 0 : _a.received) === null || _b === void 0 ? void 0 : _b.amountCents) || 0)),
                                React.createElement("small", null,
                                    ((_d = (_c = this.state.invoiceSummary) === null || _c === void 0 ? void 0 : _c.received) === null || _d === void 0 ? void 0 : _d.count) || 0,
                                    " \u5F20 \u00B7 \u5DF2\u5173\u8054 ",
                                    ((_f = (_e = this.state.invoiceSummary) === null || _e === void 0 ? void 0 : _e.received) === null || _f === void 0 ? void 0 : _f.linkedCount) || 0)),
                            React.createElement("button", { type: "button", onClick: () => this.props.navigate('invoices') },
                                React.createElement("span", null, "\u6211\u5F00\u51FA\u7684"),
                                React.createElement("strong", null, formatCompactMoney(((_h = (_g = this.state.invoiceSummary) === null || _g === void 0 ? void 0 : _g.issued) === null || _h === void 0 ? void 0 : _h.amountCents) || 0)),
                                React.createElement("small", null,
                                    ((_k = (_j = this.state.invoiceSummary) === null || _j === void 0 ? void 0 : _j.issued) === null || _k === void 0 ? void 0 : _k.count) || 0,
                                    " \u5F20 \u00B7 \u5DF2\u5173\u8054 ",
                                    ((_m = (_l = this.state.invoiceSummary) === null || _l === void 0 ? void 0 : _l.issued) === null || _m === void 0 ? void 0 : _m.linkedCount) || 0)),
                            React.createElement("div", { className: "dashboard-invoice-mascot" },
                                React.createElement(Mascot, { variant: "invoice", label: "\u828B\u5934\u548C\u5C0F\u70AE\u53F0\u4E00\u8D77\u6574\u7406\u53D1\u7968" })))))),
            React.createElement(MobileDashboardView, { data: data, month: this.props.month, navigate: this.props.navigate }));
    }
}
class TransactionForm extends React.Component {
    constructor(props) {
        var _a, _b;
        super(props);
        const initial = props.initial || {};
        const initialType = initial.type || 'expense';
        const savedAccountId = safeStorageGet(`yupao:last-account:${initialType}`, '');
        const initialAccountId = initial.account_id || (props.bootstrap.accounts.some((item) => item.id === savedAccountId) ? savedAccountId : ((_a = props.bootstrap.accounts[0]) === null || _a === void 0 ? void 0 : _a.id) || '');
        this.state = {
            type: initialType,
            amount: initial.amount_cents ? (initial.amount_cents / 100).toFixed(2) : '',
            accountId: initialAccountId,
            targetAccountId: initial.target_account_id || ((_b = props.bootstrap.accounts.find((item) => item.id !== initialAccountId)) === null || _b === void 0 ? void 0 : _b.id) || '',
            categoryId: initial.category_id || '',
            occurredAt: initial.occurred_at ? initial.occurred_at.slice(0, 10) : today(),
            merchant: initial.merchant || '', note: initial.note || '', submitting: false, error: '',
            recentCategoryIds: safeStorageGet(`yupao:recent-categories:${initialType}`, []),
            recentTransactions: [], sheet: '', showNote: Boolean(initial.note), merchantInput: false,
        };
    }
    categories() { return this.props.bootstrap.categories.filter((item) => item.type === this.state.type && !item.is_archived); }
    commonCategories(categories = this.categories()) {
        const recentIds = this.state.recentCategoryIds || [];
        const popularNames = this.state.type === 'expense' ? ['餐饮', '外卖', '买菜', '零食饮品', '日用百货', '公共交通', '网购', '猫砂日用品'] : ['工资', '生意收入', '报销', '奖金', '兼职'];
        const output = [];
        for (const id of recentIds) {
            const item = categories.find((entry) => entry.id === id);
            if (item && !output.some((entry) => entry.id === item.id))
                output.push(item);
        }
        for (const name of popularNames) {
            const item = categories.find((entry) => entry.name === name);
            if (item && !output.some((entry) => entry.id === item.id))
                output.push(item);
        }
        for (const item of categories) {
            if (output.length >= 6)
                break;
            if (!output.some((entry) => entry.id === item.id))
                output.push(item);
        }
        return output.slice(0, 6);
    }
    merchantSuggestions() {
        const local = safeStorageGet(`yupao:recent-merchants:${this.state.type}`, []);
        const fromTransactions = (this.state.recentTransactions || []).filter((item) => item.type === this.state.type && item.merchant).map((item) => String(item.merchant).trim()).filter(Boolean);
        return Array.from(new Set([...local, ...fromTransactions])).slice(0, 12);
    }
    selectedCategory() { return this.categories().find((item) => item.id === this.state.categoryId); }
    selectedAccount() { return this.props.bootstrap.accounts.find((item) => item.id === this.state.accountId); }
    selectedTargetAccount() { return this.props.bootstrap.accounts.find((item) => item.id === this.state.targetAccountId); }
    componentDidMount() {
        var _a;
        if (!this.state.categoryId && this.categories()[0])
            this.setState({ categoryId: ((_a = this.commonCategories()[0]) === null || _a === void 0 ? void 0 : _a.id) || this.categories()[0].id });
        apiRequest('/api/transactions?limit=150').then((data) => this.setState({ recentTransactions: data.items || [] })).catch(() => undefined);
    }
    setType(type) {
        var _a;
        const categories = this.props.bootstrap.categories.filter((item) => item.type === type && !item.is_archived);
        const recentCategoryIds = safeStorageGet(`yupao:recent-categories:${type}`, []);
        const savedAccount = safeStorageGet(`yupao:last-account:${type}`, '');
        const accountId = this.props.bootstrap.accounts.some((item) => item.id === savedAccount) ? savedAccount : this.state.accountId;
        const recentFirst = recentCategoryIds.map((id) => categories.find((item) => item.id === id)).find(Boolean);
        this.setState({ type, categoryId: type === 'transfer' ? '' : (recentFirst === null || recentFirst === void 0 ? void 0 : recentFirst.id) || ((_a = categories[0]) === null || _a === void 0 ? void 0 : _a.id) || '', recentCategoryIds, accountId, sheet: '', merchant: '', merchantInput: false });
    }
    rememberChoices() {
        safeStorageSet(`yupao:last-account:${this.state.type}`, this.state.accountId);
        if (this.state.categoryId) {
            const recent = [this.state.categoryId, ...(this.state.recentCategoryIds || []).filter((id) => id !== this.state.categoryId)].slice(0, 6);
            safeStorageSet(`yupao:recent-categories:${this.state.type}`, recent);
            this.setState({ recentCategoryIds: recent });
        }
        if (this.state.merchant.trim()) {
            const stored = safeStorageGet(`yupao:recent-merchants:${this.state.type}`, []);
            safeStorageSet(`yupao:recent-merchants:${this.state.type}`, [this.state.merchant.trim(), ...stored.filter((item) => item !== this.state.merchant.trim())].slice(0, 10));
        }
    }
    async submit(event) {
        event.preventDefault();
        const amountCents = moneyToCents(this.state.amount);
        if (!amountCents) {
            this.setState({ error: '请输入正确的金额' });
            return;
        }
        if (!this.state.accountId) {
            this.setState({ error: '请选择账户' });
            return;
        }
        if (this.state.type !== 'transfer' && !this.state.categoryId) {
            this.setState({ error: '请选择分类' });
            return;
        }
        if (this.state.type === 'transfer' && (!this.state.targetAccountId || this.state.targetAccountId === this.state.accountId)) {
            this.setState({ error: '请选择不同的转入账户' });
            return;
        }
        this.setState({ submitting: true, error: '' });
        const payload = {
            type: this.state.type, amountCents, accountId: this.state.accountId,
            targetAccountId: this.state.type === 'transfer' ? this.state.targetAccountId : null,
            categoryId: this.state.type === 'transfer' ? null : this.state.categoryId,
            occurredAt: this.state.occurredAt, merchant: this.state.merchant.trim(), note: this.state.note,
            ...(this.props.initial ? { version: this.props.initial.version } : {}),
        };
        try {
            const path = this.props.initial ? `/api/transactions/${this.props.initial.id}` : '/api/transactions';
            const saved = await apiRequest(path, { method: this.props.initial ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
            this.rememberChoices();
            this.setState({ submitting: false });
            this.props.onSuccess(saved, this.state.type);
        }
        catch (error) {
            this.setState({ submitting: false, error: error.message || '保存失败，请稍后再试' });
        }
    }
    typeSwitch(className = '') {
        return React.createElement("div", { className: cn('type-switch', className) },
            React.createElement("button", { type: "button", className: cn(this.state.type === 'expense' && 'active expense'), onClick: () => this.setType('expense') }, "\u652F\u51FA"),
            React.createElement("button", { type: "button", className: cn(this.state.type === 'income' && 'active income'), onClick: () => this.setType('income') }, "\u6536\u5165"),
            React.createElement("button", { type: "button", className: cn(this.state.type === 'transfer' && 'active transfer'), onClick: () => this.setType('transfer') }, "\u8F6C\u8D26"));
    }
    categoryOptions(categories) {
        return categoryGroups(categories, this.state.type).map((group) => React.createElement("optgroup", { key: group.label, label: group.label }, group.items.map((item) => React.createElement("option", { key: item.id, value: item.id },
            CATEGORY_EMOJI[item.icon] || '✨',
            " ",
            item.name))));
    }
    renderDesktop(categories) {
        const merchants = this.merchantSuggestions();
        return React.createElement("div", { className: "desktop-transaction-form desktop-transaction-form-v039" },
            this.typeSwitch(),
            React.createElement("div", { className: "amount-field" },
                React.createElement("div", { className: "amount-input-wrap" },
                    React.createElement("span", { className: "currency-symbol" }, "\u00A5"),
                    React.createElement("input", { className: "amount-input", inputMode: "decimal", placeholder: "0.00", value: this.state.amount, onChange: (event) => this.setState({ amount: event.target.value.replace(/[^\d.]/g, '').replace(/(\.\d{2}).+$/, '$1') }) }))),
            React.createElement("div", { className: "form-grid compact-choice-grid" },
                this.state.type !== 'transfer' ? React.createElement("div", { className: "field form-span" },
                    React.createElement("label", null, "\u5206\u7C7B"),
                    React.createElement("select", { className: "select", value: this.state.categoryId, onChange: (event) => this.setState({ categoryId: event.target.value }) }, this.categoryOptions(categories))) : null,
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, this.state.type === 'transfer' ? '转出账户' : '账户'),
                    React.createElement("select", { className: "select", value: this.state.accountId, onChange: (event) => this.setState({ accountId: event.target.value }) }, this.props.bootstrap.accounts.map((item) => React.createElement("option", { key: item.id, value: item.id }, item.name)))),
                this.state.type === 'transfer' ? React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u8F6C\u5165\u8D26\u6237"),
                    React.createElement("select", { className: "select", value: this.state.targetAccountId, onChange: (event) => this.setState({ targetAccountId: event.target.value }) }, this.props.bootstrap.accounts.filter((item) => item.id !== this.state.accountId).map((item) => React.createElement("option", { key: item.id, value: item.id }, item.name)))) : React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u65E5\u671F"),
                    React.createElement("div", { className: "desktop-date-quick" },
                        React.createElement("button", { type: "button", className: cn(this.state.occurredAt === today() && 'active'), onClick: () => this.setState({ occurredAt: today() }) }, "\u4ECA\u5929"),
                        React.createElement("button", { type: "button", className: cn(this.state.occurredAt === yesterdayDate() && 'active'), onClick: () => this.setState({ occurredAt: yesterdayDate() }) }, "\u6628\u5929"),
                        React.createElement("input", { className: "input", type: "date", value: this.state.occurredAt, onChange: (event) => this.setState({ occurredAt: event.target.value }) }))),
                this.state.type === 'transfer' ? React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u65E5\u671F"),
                    React.createElement("input", { className: "input", type: "date", value: this.state.occurredAt, onChange: (event) => this.setState({ occurredAt: event.target.value }) })) : React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u5546\u6237 / \u6765\u6E90\uFF08\u53EF\u9009\uFF09"),
                    React.createElement("input", { className: "input", list: "merchant-history-v039", maxLength: 80, placeholder: "\u9009\u62E9\u5386\u53F2\u5546\u6237\uFF0C\u6216\u8F93\u5165\u65B0\u5546\u6237", value: this.state.merchant, onChange: (event) => this.setState({ merchant: event.target.value }) }),
                    React.createElement("datalist", { id: "merchant-history-v039" }, merchants.map((name) => React.createElement("option", { key: name, value: name }))))),
            React.createElement("details", { className: "desktop-optional-v039", open: Boolean(this.state.note) },
                React.createElement("summary", null, "\uFF0B \u6DFB\u52A0\u5907\u6CE8"),
                React.createElement("div", { className: "field" },
                    React.createElement("textarea", { className: "textarea", maxLength: 300, placeholder: "\u7B80\u5355\u8BB0\u4E00\u4E0B\u8FD9\u7B14\u94B1\u7684\u7528\u9014", value: this.state.note, onChange: (event) => this.setState({ note: event.target.value }) }))),
            this.state.error ? React.createElement("p", { className: "error-text" }, this.state.error) : null,
            React.createElement("div", { className: "form-actions" },
                this.props.onCancel ? React.createElement("button", { type: "button", className: "btn btn-ghost", onClick: this.props.onCancel }, "\u53D6\u6D88") : null,
                React.createElement("button", { className: "btn btn-primary", type: "submit", disabled: this.state.submitting }, this.state.submitting ? '正在保存…' : this.props.initial ? '保存修改' : '收进小账本')));
    }
    renderSheet(categories) {
        if (!this.state.sheet)
            return null;
        const close = () => this.setState({ sheet: '', merchantInput: false });
        const groups = categoryGroups(categories, this.state.type);
        const merchants = this.merchantSuggestions();
        return React.createElement("div", { className: "mobile-choice-overlay", role: "presentation", onClick: close },
            React.createElement("section", { className: "mobile-choice-sheet", role: "dialog", "aria-modal": "true", onClick: (event) => event.stopPropagation() },
                React.createElement("div", { className: "mobile-choice-handle" }),
                React.createElement("header", null,
                    React.createElement("div", null,
                        React.createElement("strong", null, this.state.sheet === 'category' ? '选择分类' : this.state.sheet === 'account' ? '选择账户' : this.state.sheet === 'targetAccount' ? '选择转入账户' : this.state.sheet === 'merchant' ? '选择商户 / 来源' : '选择日期'),
                        React.createElement("small", null, this.state.sheet === 'category' ? '按生活场景归好类，找到后点一下即可' : '减少输入，直接选择常用项')),
                    React.createElement("button", { type: "button", onClick: close, "aria-label": "\u5173\u95ED" }, "\u00D7")),
                this.state.sheet === 'category' ? React.createElement("div", { className: "mobile-choice-scroll" }, groups.map((group) => React.createElement("div", { className: "mobile-choice-group", key: group.label },
                    React.createElement("h4", null, group.label),
                    React.createElement("div", { className: "mobile-choice-grid" }, group.items.map((item) => React.createElement("button", { type: "button", key: item.id, className: cn(this.state.categoryId === item.id && 'active'), onClick: () => this.setState({ categoryId: item.id, sheet: '' }) },
                        React.createElement("span", null, CATEGORY_EMOJI[item.icon] || '✨'),
                        React.createElement("b", null, item.name))))))) : null,
                this.state.sheet === 'account' ? React.createElement("div", { className: "mobile-choice-list" }, this.props.bootstrap.accounts.map((item) => React.createElement("button", { type: "button", key: item.id, className: cn(this.state.accountId === item.id && 'active'), onClick: () => this.setState({ accountId: item.id, sheet: '' }) },
                    React.createElement("span", null, CATEGORY_EMOJI[item.icon] || '💳'),
                    React.createElement("b", null, item.name),
                    this.state.accountId === item.id ? React.createElement("em", null, "\u5DF2\u9009") : null))) : null,
                this.state.sheet === 'targetAccount' ? React.createElement("div", { className: "mobile-choice-list" }, this.props.bootstrap.accounts.filter((item) => item.id !== this.state.accountId).map((item) => React.createElement("button", { type: "button", key: item.id, className: cn(this.state.targetAccountId === item.id && 'active'), onClick: () => this.setState({ targetAccountId: item.id, sheet: '' }) },
                    React.createElement("span", null, CATEGORY_EMOJI[item.icon] || '💳'),
                    React.createElement("b", null, item.name),
                    this.state.targetAccountId === item.id ? React.createElement("em", null, "\u5DF2\u9009") : null))) : null,
                this.state.sheet === 'merchant' ? React.createElement("div", { className: "mobile-choice-scroll" },
                    React.createElement("div", { className: "mobile-choice-list" },
                        merchants.length ? merchants.map((name) => React.createElement("button", { type: "button", key: name, className: cn(this.state.merchant === name && 'active'), onClick: () => this.setState({ merchant: name, sheet: '' }) },
                            React.createElement("span", null, "\uD83C\uDFEA"),
                            React.createElement("b", null, name))) : React.createElement("div", { className: "mobile-choice-empty" }, "\u8FD8\u6CA1\u6709\u5386\u53F2\u5546\u6237\uFF0C\u7B2C\u4E00\u6B21\u8F93\u5165\u540E\u4F1A\u81EA\u52A8\u8BB0\u4F4F\u3002"),
                        React.createElement("button", { type: "button", className: "mobile-choice-new", onClick: () => this.setState({ merchantInput: true }) },
                            React.createElement("span", null, "\uFF0B"),
                            React.createElement("b", null, "\u8F93\u5165\u65B0\u5546\u6237"))),
                    this.state.merchantInput ? React.createElement("div", { className: "mobile-choice-input" },
                        React.createElement("input", { autoFocus: true, maxLength: 80, placeholder: "\u4F8B\u5982\uFF1A\u76D2\u9A6C\u3001\u6EF4\u6EF4\u3001\u6DD8\u5B9D", value: this.state.merchant, onChange: (event) => this.setState({ merchant: event.target.value }) }),
                        React.createElement("button", { type: "button", onClick: () => this.setState({ sheet: '', merchantInput: false }) }, "\u786E\u5B9A")) : null) : null,
                this.state.sheet === 'date' ? React.createElement("div", { className: "mobile-date-sheet" },
                    React.createElement("button", { type: "button", className: cn(this.state.occurredAt === today() && 'active'), onClick: () => this.setState({ occurredAt: today(), sheet: '' }) },
                        React.createElement("strong", null, "\u4ECA\u5929"),
                        React.createElement("small", null, dateLabel(today()))),
                    React.createElement("button", { type: "button", className: cn(this.state.occurredAt === yesterdayDate() && 'active'), onClick: () => this.setState({ occurredAt: yesterdayDate(), sheet: '' }) },
                        React.createElement("strong", null, "\u6628\u5929"),
                        React.createElement("small", null, dateLabel(yesterdayDate()))),
                    React.createElement("label", null,
                        React.createElement("span", null, "\u5176\u4ED6\u65E5\u671F"),
                        React.createElement("input", { type: "date", value: this.state.occurredAt, onChange: (event) => this.setState({ occurredAt: event.target.value, sheet: '' }) }))) : null));
    }
    renderMobile(categories) {
        const common = this.commonCategories(categories);
        const selectedCategory = this.selectedCategory();
        const selectedAccount = this.selectedAccount();
        const selectedTarget = this.selectedTargetAccount();
        return React.createElement("div", { className: "mobile-transaction-form-v039" },
            this.typeSwitch('mobile-add-type-switch'),
            React.createElement("section", { className: "mobile-add-amount-card mobile-add-amount-card-v039" },
                React.createElement("span", null, this.state.type === 'expense' ? '这次花了多少' : this.state.type === 'income' ? '这次收到多少' : '转账金额'),
                React.createElement("div", { className: "mobile-add-amount-wrap" },
                    React.createElement("b", null, "\u00A5"),
                    React.createElement("input", { inputMode: "decimal", placeholder: "0.00", "aria-label": "\u91D1\u989D", value: this.state.amount, onChange: (event) => this.setState({ amount: event.target.value.replace(/[^\d.]/g, '').replace(/(\.\d{2}).+$/, '$1') }) }))),
            this.state.type !== 'transfer' ? React.createElement("section", { className: "mobile-add-section mobile-common-category-v039" },
                React.createElement("div", { className: "mobile-add-section-head" },
                    React.createElement("strong", null, "\u5E38\u7528\u5206\u7C7B"),
                    React.createElement("button", { type: "button", className: "mobile-text-action", onClick: () => this.setState({ sheet: 'category' }) }, "\u5168\u90E8\u5206\u7C7B \u203A")),
                React.createElement("div", { className: "mobile-common-category-grid" }, common.map((item) => React.createElement("button", { type: "button", key: item.id, className: cn(this.state.categoryId === item.id && 'active'), onClick: () => this.setState({ categoryId: item.id }) },
                    React.createElement("span", null, CATEGORY_EMOJI[item.icon] || '✨'),
                    React.createElement("b", null, item.name)))),
                selectedCategory && !common.some((item) => item.id === selectedCategory.id) ? React.createElement("button", { type: "button", className: "mobile-selected-category", onClick: () => this.setState({ sheet: 'category' }) },
                    React.createElement("span", null, CATEGORY_EMOJI[selectedCategory.icon] || '✨'),
                    React.createElement("b", null, selectedCategory.name),
                    React.createElement("small", null, "\u5F53\u524D\u5206\u7C7B \u00B7 \u70B9\u51FB\u66F4\u6362")) : null) : null,
            React.createElement("section", { className: "mobile-add-section mobile-choice-summary-v039" },
                React.createElement("div", { className: "mobile-add-section-head" },
                    React.createElement("strong", null, "\u5FC5\u8981\u4FE1\u606F"),
                    React.createElement("small", null, "\u70B9\u4E00\u4E0B\u76F4\u63A5\u9009\u62E9")),
                React.createElement("button", { type: "button", className: "mobile-choice-row", onClick: () => this.setState({ sheet: 'account' }) },
                    React.createElement("span", { className: "mobile-choice-row-icon" }, "\uD83D\uDCB3"),
                    React.createElement("div", null,
                        React.createElement("small", null, this.state.type === 'transfer' ? '转出账户' : '账户'),
                        React.createElement("strong", null, (selectedAccount === null || selectedAccount === void 0 ? void 0 : selectedAccount.name) || '选择账户')),
                    React.createElement(Icon, { name: "chevron-right", size: 18 })),
                this.state.type === 'transfer' ? React.createElement("button", { type: "button", className: "mobile-choice-row", onClick: () => this.setState({ sheet: 'targetAccount' }) },
                    React.createElement("span", { className: "mobile-choice-row-icon" }, "\u2194\uFE0F"),
                    React.createElement("div", null,
                        React.createElement("small", null, "\u8F6C\u5165\u8D26\u6237"),
                        React.createElement("strong", null, (selectedTarget === null || selectedTarget === void 0 ? void 0 : selectedTarget.name) || '选择账户')),
                    React.createElement(Icon, { name: "chevron-right", size: 18 })) : null,
                React.createElement("button", { type: "button", className: "mobile-choice-row", onClick: () => this.setState({ sheet: 'date' }) },
                    React.createElement("span", { className: "mobile-choice-row-icon" }, "\uD83D\uDCC5"),
                    React.createElement("div", null,
                        React.createElement("small", null, "\u65E5\u671F"),
                        React.createElement("strong", null, this.state.occurredAt === today() ? '今天' : this.state.occurredAt === yesterdayDate() ? '昨天' : dateLabel(this.state.occurredAt))),
                    React.createElement(Icon, { name: "chevron-right", size: 18 })),
                this.state.type !== 'transfer' ? React.createElement("button", { type: "button", className: "mobile-choice-row", onClick: () => this.setState({ sheet: 'merchant' }) },
                    React.createElement("span", { className: "mobile-choice-row-icon" }, "\uD83C\uDFEA"),
                    React.createElement("div", null,
                        React.createElement("small", null, "\u5546\u6237 / \u6765\u6E90\uFF08\u53EF\u9009\uFF09"),
                        React.createElement("strong", null, this.state.merchant || '从历史商户中选择')),
                    React.createElement(Icon, { name: "chevron-right", size: 18 })) : null,
                React.createElement("button", { type: "button", className: "mobile-choice-row", onClick: () => this.setState({ showNote: !this.state.showNote }) },
                    React.createElement("span", { className: "mobile-choice-row-icon" }, "\uD83D\uDCDD"),
                    React.createElement("div", null,
                        React.createElement("small", null, "\u5907\u6CE8\uFF08\u53EF\u9009\uFF09"),
                        React.createElement("strong", null, this.state.note ? '已添加备注' : '添加备注')),
                    React.createElement("span", { className: "mobile-note-toggle" }, this.state.showNote ? '收起' : '展开')),
                this.state.showNote ? React.createElement("textarea", { className: "mobile-note-input", maxLength: 300, rows: 3, placeholder: "\u7B80\u5355\u8BB0\u4E00\u4E0B\u8FD9\u7B14\u94B1\u7684\u7528\u9014", value: this.state.note, onChange: (event) => this.setState({ note: event.target.value }) }) : null),
            this.state.error ? React.createElement("p", { className: "error-text mobile-add-error" }, this.state.error) : null,
            React.createElement("div", { className: "mobile-add-submit-bar mobile-add-submit-bar-v039" },
                this.props.onCancel ? React.createElement("button", { type: "button", className: "mobile-add-cancel", onClick: this.props.onCancel }, "\u53D6\u6D88") : null,
                React.createElement("button", { className: "mobile-add-submit", type: "submit", disabled: this.state.submitting },
                    React.createElement("span", null, this.state.submitting ? '正在保存…' : this.props.initial ? '保存修改' : this.state.type === 'expense' ? '保存这笔支出' : this.state.type === 'income' ? '保存这笔收入' : '完成转账'),
                    React.createElement("small", null, this.state.type === 'transfer' ? `${(selectedAccount === null || selectedAccount === void 0 ? void 0 : selectedAccount.name) || ''} → ${(selectedTarget === null || selectedTarget === void 0 ? void 0 : selectedTarget.name) || ''}` : `${(selectedCategory === null || selectedCategory === void 0 ? void 0 : selectedCategory.name) || '请选择分类'} · ${(selectedAccount === null || selectedAccount === void 0 ? void 0 : selectedAccount.name) || '请选择账户'}`))),
            this.renderSheet(categories));
    }
    render() {
        const categories = this.categories();
        return React.createElement("form", { className: "transaction-form-v039", onSubmit: (event) => this.submit(event) },
            this.renderDesktop(categories),
            this.renderMobile(categories));
    }
}
class AddPage extends React.Component {
    constructor(props) { super(props); this.state = { success: false, savedType: 'expense' }; }
    successHandler(_, type) { this.setState({ success: true, savedType: type }); this.props.onChanged(); window.setTimeout(() => { this.setState({ success: false }); this.props.navigate('home'); }, 1350); }
    render() {
        return React.createElement("div", { className: "page add-page-v039" },
            React.createElement("div", { className: "desktop-product-view" },
                React.createElement(PageHeader, { title: "\u8BB0\u4E00\u7B14", subtitle: "\u4E0D\u7528\u586B\u5F97\u5F88\u590D\u6742\uFF0C\u5148\u628A\u91CD\u8981\u7684\u8BB0\u4E0B\u6765\u3002" }),
                React.createElement("section", { className: "card card-pad add-form-card", style: { maxWidth: '820px', margin: '0 auto' } },
                    React.createElement("div", { className: "role-assistant role-assistant-taro" },
                        React.createElement("div", { className: "role-assistant-copy" },
                            React.createElement("strong", null, "\u828B\u5934\u51C6\u5907\u597D\u5566"),
                            React.createElement("span", null, "\u586B\u597D\u91D1\u989D\uFF0C\u5B83\u4F1A\u9A6C\u4E0A\u628A\u8FD9\u7B14\u8BB0\u8FDB\u6765\u3002")),
                        React.createElement("div", { className: "role-assistant-mascot" },
                            React.createElement(Mascot, { variant: "idle", label: "\u828B\u5934\u62FF\u7740\u94C5\u7B14\u51C6\u5907\u8BB0\u8D26\uFF0C\u5C0F\u70AE\u53F0\u6253\u5F00\u5F52\u6863\u69FD" }))),
                    React.createElement(TransactionForm, { bootstrap: this.props.bootstrap, onSuccess: (saved, type) => this.successHandler(saved, type) }))),
            React.createElement("div", { className: "mobile-product-view mobile-add-page-v039" },
                React.createElement("div", { className: "mobile-add-page-head" },
                    React.createElement("div", null,
                        React.createElement("span", null, "\u5FEB\u901F\u8BB0\u8D26"),
                        React.createElement("h1", null, "\u8BB0\u4E00\u7B14"),
                        React.createElement("p", null, "\u5148\u586B\u91D1\u989D\u548C\u5206\u7C7B\uFF0C\u5176\u4ED6\u5185\u5BB9\u53EF\u4EE5\u6162\u6162\u8865\u3002")),
                    React.createElement("div", { className: "mobile-add-page-mascot" },
                        React.createElement(Mascot, { variant: "empty", label: "\u5927\u828B\u5934\u51C6\u5907\u8BB0\u5F55\uFF0C\u5C0F\u70AE\u53F0\u5728\u65C1\u8FB9\u6574\u7406" }))),
                React.createElement(TransactionForm, { bootstrap: this.props.bootstrap, onSuccess: (saved, type) => this.successHandler(saved, type) })),
            this.state.success ? React.createElement("div", { className: "success-overlay" },
                React.createElement("div", { className: "success-box" },
                    React.createElement(Mascot, { variant: "success", label: "\u828B\u5934\u4E3E\u8D77\u6536\u636E\uFF0C\u5C0F\u70AE\u53F0\u663E\u793A\u5DF2\u6574\u7406" }),
                    React.createElement("h2", null, "\u8FD9\u7B14\u8BB0\u597D\u5566"),
                    React.createElement("p", null, this.state.savedType === 'income' ? '芋头已经记下收入，小炮台也整理好了' : this.state.savedType === 'transfer' ? '芋头记下转账，小炮台已经同步两个账户' : '芋头已经记下这笔，小炮台也整理好了'))) : null);
    }
}
class TransactionsPage extends React.Component {
    constructor(props) {
        super(props);
        this.timer = null;
        this.state = { loading: true, items: [], total: 0, month: props.month, type: '', accountId: '', search: '', edit: null };
    }
    componentDidMount() { this.load(); }
    componentDidUpdate(prevProps) { if (prevProps.refreshToken !== this.props.refreshToken)
        this.load(); }
    async load() {
        this.setState({ loading: true });
        const params = new URLSearchParams({ month: this.state.month, limit: '200' });
        if (this.state.type)
            params.set('type', this.state.type);
        if (this.state.accountId)
            params.set('accountId', this.state.accountId);
        if (this.state.search.trim())
            params.set('search', this.state.search.trim());
        try {
            const data = await apiRequest(`/api/transactions?${params.toString()}`);
            this.setState({ loading: false, items: data.items, total: data.total });
        }
        catch (error) {
            this.setState({ loading: false });
            this.props.onError(error.message);
        }
    }
    changeFilter(state) { this.setState(state, () => this.load()); }
    async remove(item) {
        if (!window.confirm(`删除“${transactionTitle(item)}”这笔记录？`))
            return;
        try {
            await apiRequest(`/api/transactions/${item.id}`, { method: 'DELETE' });
            this.setState({ items: this.state.items.filter((entry) => entry.id !== item.id) });
            this.props.onChanged();
            this.props.onToast('这笔记录已删除', 'default', '撤销', async () => {
                try {
                    await apiRequest(`/api/transactions/${item.id}/restore`, { method: 'POST' });
                    this.load();
                    this.props.onChanged();
                    this.props.onToast('已经恢复这笔记录', 'success');
                }
                catch (error) {
                    this.props.onToast(error.message, 'error');
                }
            });
        }
        catch (error) {
            this.props.onToast(error.message, 'error');
        }
    }
    render() {
        const items = this.state.items || [];
        const expenseCents = items.filter((item) => item.type === 'expense').reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
        const incomeCents = items.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
        const transferCount = items.filter((item) => item.type === 'transfer').length;
        return React.createElement("div", { className: "page transactions-page-v037" },
            React.createElement("div", { className: "desktop-product-view" },
                React.createElement(PageHeader, { title: "\u6536\u652F\u660E\u7EC6", subtitle: "\u6309\u6708\u4EFD\u3001\u7C7B\u578B\u6216\u8D26\u6237\u67E5\u627E\u6BCF\u4E00\u7B14\u8BB0\u5F55\u3002" },
                    React.createElement(MonthSwitcher, { month: this.state.month, onChange: (month) => this.changeFilter({ month }) }),
                    React.createElement("button", { className: "btn btn-primary", onClick: () => this.props.navigate('add') },
                        React.createElement(Icon, { name: "plus", size: 18 }),
                        React.createElement("span", { className: "btn-label" }, "\u8BB0\u4E00\u7B14"))),
                React.createElement("section", { className: "card detail-hero-card" },
                    React.createElement("div", { className: "detail-hero-copy" },
                        React.createElement("span", { className: "detail-kicker" },
                            monthLabel(this.state.month),
                            " \u00B7 \u8BB0\u5F55\u53F0\u8D26"),
                        React.createElement("h2", null, "\u8FD9\u4E00\u4E2A\u6708\u7684\u6536\u652F\uFF0C\u90FD\u80FD\u987A\u624B\u7FFB\u51FA\u6765"),
                        React.createElement("p", null, "\u5927\u828B\u5934\u8D1F\u8D23\u628A\u65B0\u8BB0\u5F55\u8BB0\u4E0B\u6765\uFF0C\u5C0F\u70AE\u53F0\u8D1F\u8D23\u628A\u5B83\u4EEC\u6392\u5F97\u6E05\u6E05\u695A\u695A\u3002\u7B5B\u4E00\u7B5B\uFF0C\u5C31\u80FD\u5FEB\u901F\u627E\u5230\u8981\u770B\u7684\u90A3\u4E00\u7B14\u3002")),
                    React.createElement("div", { className: "detail-hero-stats", role: "list", "aria-label": "\u660E\u7EC6\u9875\u6458\u8981" },
                        React.createElement("div", { className: "detail-stat", role: "listitem" },
                            React.createElement("span", null, "\u8BB0\u5F55\u6570"),
                            React.createElement("strong", null, this.state.total),
                            React.createElement("small", null, "\u5F53\u524D\u7B5B\u9009\u7ED3\u679C")),
                        React.createElement("div", { className: "detail-stat", role: "listitem" },
                            React.createElement("span", null, "\u652F\u51FA\u5408\u8BA1"),
                            React.createElement("strong", null, formatCompactMoney(expenseCents)),
                            React.createElement("small", null,
                                items.filter((item) => item.type === 'expense').length,
                                " \u7B14")),
                        React.createElement("div", { className: "detail-stat", role: "listitem" },
                            React.createElement("span", null, "\u6536\u5165\u5408\u8BA1"),
                            React.createElement("strong", null, formatCompactMoney(incomeCents)),
                            React.createElement("small", null,
                                items.filter((item) => item.type === 'income').length,
                                " \u7B14")),
                        React.createElement("div", { className: "detail-stat", role: "listitem" },
                            React.createElement("span", null, "\u8F6C\u8D26\u8BB0\u5F55"),
                            React.createElement("strong", null, transferCount),
                            React.createElement("small", null, "\u8D26\u6237\u4E4B\u95F4\u8C03\u62E8")))),
                React.createElement("section", { className: "card card-pad detail-filter-card" },
                    React.createElement("div", { className: "card-title-row detail-filter-head" },
                        React.createElement("div", null,
                            React.createElement("h3", { className: "card-title" }, "\u7B5B\u9009\u4E0E\u67E5\u627E"),
                            React.createElement("p", { className: "card-subtitle" }, "\u5148\u6309\u6708\u4EFD\u770B\uFF0C\u518D\u7528\u7C7B\u578B\u3001\u8D26\u6237\u548C\u5173\u952E\u8BCD\u6536\u7A84\u8303\u56F4\u3002"))),
                    React.createElement("div", { className: "filter-bar detail-filter-bar" },
                        React.createElement("select", { className: "select", value: this.state.type, onChange: (event) => this.changeFilter({ type: event.target.value }) },
                            React.createElement("option", { value: "" }, "\u5168\u90E8\u7C7B\u578B"),
                            React.createElement("option", { value: "expense" }, "\u652F\u51FA"),
                            React.createElement("option", { value: "income" }, "\u6536\u5165"),
                            React.createElement("option", { value: "transfer" }, "\u8F6C\u8D26")),
                        React.createElement("select", { className: "select", value: this.state.accountId, onChange: (event) => this.changeFilter({ accountId: event.target.value }) },
                            React.createElement("option", { value: "" }, "\u5168\u90E8\u8D26\u6237"),
                            this.props.bootstrap.accounts.map((item) => React.createElement("option", { key: item.id, value: item.id }, item.name))),
                        React.createElement("div", { className: "search-wrap" },
                            React.createElement(Icon, { name: "search", size: 18 }),
                            React.createElement("input", { className: "input", placeholder: "\u641C\u7D22\u5546\u6237\u6216\u5907\u6CE8", value: this.state.search, onChange: (event) => this.setState({ search: event.target.value }), onKeyDown: (event) => { if (event.key === 'Enter')
                                    this.load(); } })),
                        React.createElement("button", { className: "btn btn-secondary", onClick: () => this.load() }, "\u641C\u7D22"))),
                React.createElement("section", { className: "card card-pad detail-list-card" },
                    React.createElement("div", { className: "card-title-row detail-list-head" },
                        React.createElement("div", null,
                            React.createElement("h3", { className: "card-title" }, monthLabel(this.state.month)),
                            React.createElement("p", { className: "card-subtitle" },
                                "\u5171 ",
                                this.state.total,
                                " \u7B14\u8BB0\u5F55\uFF0C\u6309\u65F6\u95F4\u5012\u5E8F\u6392\u5217\u3002"))),
                    this.state.loading ? React.createElement("div", { className: "stack" },
                        React.createElement("div", { className: "skeleton", style: { height: '68px' } }),
                        React.createElement("div", { className: "skeleton", style: { height: '68px' } }),
                        React.createElement("div", { className: "skeleton", style: { height: '68px' } })) : this.state.items.length ? React.createElement("div", { className: "list detail-list" }, this.state.items.map((item, index) => React.createElement(TransactionItem, { key: item.id, item: item, index: index, editable: true, onEdit: (entry) => this.setState({ edit: entry }), onDelete: (entry) => this.remove(entry) }))) : React.createElement(EmptyState, { title: "\u6CA1\u6709\u627E\u5230\u8BB0\u5F55", message: "\u6362\u4E2A\u7B5B\u9009\u6761\u4EF6\uFF0C\u6216\u8005\u8BB0\u4E0B\u65B0\u7684\u4E00\u7B14\u3002", action: React.createElement("button", { className: "btn btn-primary", onClick: () => this.props.navigate('add') }, "\u8BB0\u4E00\u7B14") }))),
            React.createElement(MobileTransactionsView, { items: items, loading: this.state.loading, month: this.state.month, type: this.state.type, search: this.state.search, navigate: this.props.navigate, onMonthChange: (month) => this.changeFilter({ month }), onType: (type) => this.changeFilter({ type }), onSearch: (search) => this.setState({ search }), onSubmitSearch: () => this.load(), onEdit: (entry) => this.setState({ edit: entry }), onDelete: (entry) => this.remove(entry) }),
            React.createElement(Modal, { open: Boolean(this.state.edit), title: "\u7F16\u8F91\u8FD9\u7B14\u8BB0\u5F55", onClose: () => this.setState({ edit: null }) }, this.state.edit ? React.createElement(TransactionForm, { bootstrap: this.props.bootstrap, initial: this.state.edit, onCancel: () => this.setState({ edit: null }), onSuccess: () => { this.setState({ edit: null }); this.load(); this.props.onChanged(); this.props.onToast('已经保存修改', 'success'); } }) : null));
    }
}
class StatsPage extends React.Component {
    constructor(props) { super(props); this.state = { loading: true, month: props.month, trend: [], categories: [], months: [], budgets: [] }; }
    componentDidMount() { this.load(); }
    componentDidUpdate(prevProps) { if (prevProps.refreshToken !== this.props.refreshToken)
        this.load(); }
    async load() {
        this.setState({ loading: true });
        const month = this.state.month;
        try {
            const [trend, categories, months, budgets] = await Promise.all([
                apiRequest(`/api/stats/trend?month=${month}`), apiRequest(`/api/stats/category-breakdown?month=${month}`),
                apiRequest(`/api/stats/month-comparison?month=${month}`), apiRequest(`/api/stats/budget-progress?month=${month}`),
            ]);
            this.setState({ loading: false, trend: trend.items, categories: categories.items, months: months.items, budgets: budgets.items });
        }
        catch (error) {
            this.setState({ loading: false });
            this.props.onError(error.message);
        }
    }
    render() {
        const categories = this.state.categories || [];
        const totalExpense = categories.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
        const topCategory = categories[0];
        const average = totalExpense ? Math.round(totalExpense / Math.max(1, categories.length)) : 0;
        const budgets = this.state.budgets || [];
        const activeBudgetCount = budgets.length;
        return React.createElement("div", { className: "page stats-page-v037" },
            React.createElement("div", { className: "desktop-product-view" },
                React.createElement(PageHeader, { title: "\u6536\u652F\u7EDF\u8BA1", subtitle: "\u4E0D\u7528\u76EF\u7740\u6BCF\u4E00\u7B14\uFF0C\u770B\u770B\u6574\u4F53\u8282\u594F\u5C31\u597D\u3002" },
                    React.createElement(MonthSwitcher, { month: this.state.month, onChange: (month) => this.setState({ month }, () => this.load()) })),
                this.state.loading ? React.createElement(LoadingPage, null) : React.createElement("div", { className: "stats-grid-v036" },
                    React.createElement("section", { className: "card role-assistant role-assistant-cannon stats-hero-card" },
                        React.createElement("div", { className: "role-assistant-copy" },
                            React.createElement("strong", null, "\u5C0F\u70AE\u53F0\u5DF2\u7ECF\u6574\u7406\u597D\u672C\u6708\u6570\u636E"),
                            React.createElement("span", null, "\u8D8B\u52BF\u3001\u5206\u7C7B\u548C\u9884\u7B97\u90FD\u5F52\u597D\u7C7B\u4E86\uFF0C\u6162\u6162\u770B\u5C31\u884C\u3002")),
                        React.createElement("div", { className: "role-assistant-mascot role-assistant-mascot-summary" },
                            React.createElement(Mascot, { variant: "summary", label: "\u6C89\u7A33\u5C0F\u70AE\u53F0\u966A\u4F60\u67E5\u770B\u672C\u6708\u56FE\u8868" }))),
                    React.createElement("section", { className: "stats-overview-strip", "aria-label": "\u7EDF\u8BA1\u6458\u8981" },
                        React.createElement("article", { className: "card stats-mini-card" },
                            React.createElement("span", null, "\u672C\u6708\u652F\u51FA"),
                            React.createElement("strong", null, formatCompactMoney(totalExpense)),
                            React.createElement("small", null, "\u5F53\u524D\u5206\u7C7B\u603B\u8BA1")),
                        React.createElement("article", { className: "card stats-mini-card" },
                            React.createElement("span", null, "\u6700\u9AD8\u5206\u7C7B"),
                            React.createElement("strong", null, topCategory ? topCategory.name : '暂无'),
                            React.createElement("small", null, topCategory ? `${Math.round(Number(topCategory.amount_cents || 0) / Math.max(1, totalExpense) * 100)}% · ${formatCompactMoney(topCategory.amount_cents)}` : '等待更多记录')),
                        React.createElement("article", { className: "card stats-mini-card" },
                            React.createElement("span", null, "\u9884\u7B97\u9879\u76EE"),
                            React.createElement("strong", null, activeBudgetCount),
                            React.createElement("small", null, activeBudgetCount ? '已纳入月度控制' : '还未开始设置')),
                        React.createElement("article", { className: "card stats-mini-card" },
                            React.createElement("span", null, "\u5355\u7C7B\u5747\u503C"),
                            React.createElement("strong", null, formatCompactMoney(average)),
                            React.createElement("small", null,
                                categories.length,
                                " \u4E2A\u652F\u51FA\u5206\u7C7B"))),
                    React.createElement("section", { className: "card card-pad stats-trend-card" },
                        React.createElement("div", { className: "card-title-row" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "card-title" }, "\u672C\u6708\u8D8B\u52BF"),
                                React.createElement("p", { className: "card-subtitle" }, "\u6BCF\u5929\u7684\u6536\u5165\u4E0E\u652F\u51FA"))),
                        React.createElement(TrendChart, { items: this.state.trend })),
                    React.createElement("section", { className: "card card-pad spending-card stats-spending-card" },
                        React.createElement("div", { className: "card-title-row" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "card-title" }, "\u652F\u51FA\u5206\u7C7B"),
                                React.createElement("p", { className: "card-subtitle" }, "\u94B1\u4E3B\u8981\u82B1\u5728\u4E86\u54EA\u91CC"))),
                        React.createElement(DonutChart, { items: this.state.categories })),
                    React.createElement("section", { className: "card card-pad stats-budget-card" },
                        React.createElement("div", { className: "card-title-row" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "card-title" }, "\u5206\u7C7B\u9884\u7B97"),
                                React.createElement("p", { className: "card-subtitle" }, "\u9884\u7B97\u4E0E\u5B9E\u9645\u652F\u51FA"))),
                        React.createElement(BudgetProgressList, { items: this.state.budgets, onSetup: () => this.props.navigate('budgets') })),
                    React.createElement("section", { className: "card card-pad stats-months-card" },
                        React.createElement("div", { className: "card-title-row" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "card-title" }, "\u8FD1\u516D\u4E2A\u6708"),
                                React.createElement("p", { className: "card-subtitle" }, "\u6536\u5165\u548C\u652F\u51FA\u7684\u6708\u5EA6\u53D8\u5316"))),
                        React.createElement(MonthlyBars, { items: this.state.months })))),
            React.createElement(MobileStatsView, { month: this.state.month, categories: categories, budgets: budgets, months: this.state.months, navigate: this.props.navigate, onMonthChange: (month) => this.setState({ month }, () => this.load()) }));
    }
}
function InvoiceItem(props) {
    const item = props.item;
    const isVoid = item.status === 'void';
    const linkText = item.transaction_id
        ? `${item.transaction_type === 'expense' ? '支出' : '收入'} · ${item.transaction_category_name || item.transaction_merchant || compactDate(item.transaction_occurred_at || '')}`
        : '暂未关联收支';
    return React.createElement("article", { className: cn('invoice-card', isVoid && 'is-void') },
        React.createElement("div", { className: cn('invoice-stamp', item.type) },
            React.createElement(Icon, { name: "invoice", size: 20 }),
            React.createElement("span", null, item.type === 'received' ? '收' : '开')),
        React.createElement("div", { className: "invoice-card-main" },
            React.createElement("div", { className: "invoice-card-heading" },
                React.createElement("strong", null, item.title),
                React.createElement("span", { className: cn('invoice-type-pill', item.type) }, invoiceTypeLabel(item.type)),
                isVoid ? React.createElement("span", { className: "tag" }, "\u5DF2\u4F5C\u5E9F") : null),
            React.createElement("p", null,
                item.counterparty_name,
                " \u00B7 ",
                item.invoice_number),
            React.createElement("div", { className: "invoice-link-line" },
                React.createElement("span", null,
                    "\uD83D\uDD17 ",
                    linkText),
                React.createElement("span", null, dateLabel(item.invoice_date)))),
        React.createElement("div", { className: "invoice-card-side" },
            React.createElement("strong", null, formatMoney(item.amount_cents)),
            item.tax_amount_cents ? React.createElement("small", null,
                "\u542B\u7A0E\u989D ",
                formatMoney(item.tax_amount_cents)) : React.createElement("small", null, "\u672A\u5355\u5217\u7A0E\u989D"),
            React.createElement("div", { className: "invoice-actions" }, isVoid ? React.createElement("button", { onClick: () => props.onRestore(item) }, "\u6062\u590D") : React.createElement(React.Fragment, null,
                React.createElement("button", { onClick: () => props.onEdit(item) }, "\u7F16\u8F91"),
                React.createElement("button", { onClick: () => props.onVoid(item) }, "\u4F5C\u5E9F")))));
}
class InvoiceForm extends React.Component {
    constructor(props) {
        super(props);
        const item = props.initial || {};
        this.state = {
            type: item.type || props.defaultType || 'received', invoiceNumber: item.invoice_number || '', invoiceCode: item.invoice_code || '',
            title: item.title || '', counterpartyName: item.counterparty_name || '', amount: item.amount_cents ? (item.amount_cents / 100).toFixed(2) : '',
            taxAmount: item.tax_amount_cents ? (item.tax_amount_cents / 100).toFixed(2) : '', invoiceDate: item.invoice_date ? item.invoice_date.slice(0, 10) : today(),
            transactionId: item.transaction_id || '', note: item.note || '', saving: false, error: '',
        };
    }
    candidates() { return (this.props.transactions || []).filter((item) => item.type === (this.state.type === 'received' ? 'expense' : 'income')); }
    setType(type) { this.setState({ type, transactionId: '' }); }
    async submit(event) {
        event.preventDefault();
        const amountCents = moneyToCents(this.state.amount);
        const taxAmountCents = this.state.taxAmount ? moneyToCents(this.state.taxAmount) : 0;
        if (!this.state.invoiceNumber.trim()) {
            this.setState({ error: '请输入发票号码' });
            return;
        }
        if (!this.state.title.trim()) {
            this.setState({ error: '请输入发票抬头或内容' });
            return;
        }
        if (!this.state.counterpartyName.trim()) {
            this.setState({ error: `请输入${invoiceCounterpartyLabel(this.state.type)}` });
            return;
        }
        if (!amountCents) {
            this.setState({ error: '请输入正确的发票金额' });
            return;
        }
        if (taxAmountCents > amountCents) {
            this.setState({ error: '税额不能大于发票金额' });
            return;
        }
        this.setState({ saving: true, error: '' });
        const payload = { type: this.state.type, invoiceNumber: this.state.invoiceNumber.trim(), invoiceCode: this.state.invoiceCode.trim(), title: this.state.title.trim(),
            counterpartyName: this.state.counterpartyName.trim(), amountCents, taxAmountCents, invoiceDate: this.state.invoiceDate,
            transactionId: this.state.transactionId || null, note: this.state.note.trim(), ...(this.props.initial ? { version: this.props.initial.version } : {}) };
        try {
            const path = this.props.initial ? `/api/invoices/${this.props.initial.id}` : '/api/invoices';
            await apiRequest(path, { method: this.props.initial ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
            this.props.onSuccess();
        }
        catch (error) {
            this.setState({ saving: false, error: error.message || '保存发票失败' });
        }
    }
    render() {
        const candidates = this.candidates();
        return React.createElement("form", { className: "invoice-form", onSubmit: (event) => this.submit(event) },
            React.createElement("div", { className: "type-switch invoice-type-switch" },
                React.createElement("button", { type: "button", className: cn(this.state.type === 'received' && 'active expense'), onClick: () => this.setType('received') }, "\u6536\u5230\u7684\u53D1\u7968"),
                React.createElement("button", { type: "button", className: cn(this.state.type === 'issued' && 'active income'), onClick: () => this.setType('issued') }, "\u5F00\u51FA\u7684\u53D1\u7968")),
            React.createElement("div", { className: "form-grid" },
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u53D1\u7968\u53F7\u7801"),
                    React.createElement("input", { className: "input", maxLength: 80, required: true, value: this.state.invoiceNumber, onChange: (event) => this.setState({ invoiceNumber: event.target.value }), placeholder: "\u4F8B\u5982\uFF1A031001900111" })),
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u53D1\u7968\u4EE3\u7801\uFF08\u53EF\u9009\uFF09"),
                    React.createElement("input", { className: "input", maxLength: 80, value: this.state.invoiceCode, onChange: (event) => this.setState({ invoiceCode: event.target.value }) })),
                React.createElement("div", { className: "field form-span" },
                    React.createElement("label", null, "\u53D1\u7968\u62AC\u5934 / \u5185\u5BB9"),
                    React.createElement("input", { className: "input", maxLength: 120, required: true, value: this.state.title, onChange: (event) => this.setState({ title: event.target.value }), placeholder: "\u4F8B\u5982\uFF1A\u529E\u516C\u7528\u54C1\u3001\u8BBE\u8BA1\u670D\u52A1\u8D39" })),
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, invoiceCounterpartyLabel(this.state.type)),
                    React.createElement("input", { className: "input", maxLength: 120, required: true, value: this.state.counterpartyName, onChange: (event) => this.setState({ counterpartyName: event.target.value }), placeholder: this.state.type === 'received' ? '谁给你开票' : '发票开给谁' })),
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u5F00\u7968\u65E5\u671F"),
                    React.createElement("input", { className: "input", type: "date", required: true, value: this.state.invoiceDate, onChange: (event) => this.setState({ invoiceDate: event.target.value }) })),
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u53D1\u7968\u91D1\u989D"),
                    React.createElement("input", { className: "input", inputMode: "decimal", required: true, value: this.state.amount, onChange: (event) => this.setState({ amount: event.target.value.replace(/[^\d.]/g, '').replace(/(\.\d{2}).+$/, '$1') }), placeholder: "0.00" })),
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u5176\u4E2D\u7A0E\u989D\uFF08\u53EF\u9009\uFF09"),
                    React.createElement("input", { className: "input", inputMode: "decimal", value: this.state.taxAmount, onChange: (event) => this.setState({ taxAmount: event.target.value.replace(/[^\d.]/g, '').replace(/(\.\d{2}).+$/, '$1') }), placeholder: "0.00" })),
                React.createElement("div", { className: "field form-span" },
                    React.createElement("label", null,
                        this.state.type === 'received' ? '关联支出' : '关联收入',
                        "\uFF08\u53EF\u9009\uFF09"),
                    React.createElement("select", { className: "select", value: this.state.transactionId, onChange: (event) => this.setState({ transactionId: event.target.value }) },
                        React.createElement("option", { value: "" }, "\u6682\u4E0D\u5173\u8054"),
                        candidates.map((item) => React.createElement("option", { key: item.id, value: item.id },
                            item.occurred_at.slice(0, 10),
                            " \u00B7 ",
                            transactionTitle(item),
                            " \u00B7 ",
                            formatMoney(item.amount_cents)))),
                    React.createElement("small", { className: "field-hint" },
                        this.state.type === 'received' ? '收到的发票只能关联支出' : '开出的发票只能关联收入',
                        "\uFF0C\u540C\u4E00\u7B14\u6536\u652F\u53EF\u4EE5\u5173\u8054\u591A\u5F20\u53D1\u7968\u3002")),
                React.createElement("div", { className: "field form-span" },
                    React.createElement("label", null, "\u5907\u6CE8\uFF08\u53EF\u9009\uFF09"),
                    React.createElement("textarea", { className: "textarea", maxLength: 500, value: this.state.note, onChange: (event) => this.setState({ note: event.target.value }), placeholder: "\u4F8B\u5982\uFF1A\u7528\u4E8E\u62A5\u9500\u3001\u5BA2\u6237\u5DF2\u786E\u8BA4\u5F00\u7968\u7B49" }))),
            this.state.error ? React.createElement("p", { className: "error-text" }, this.state.error) : null,
            React.createElement("div", { className: "form-actions" },
                React.createElement("button", { type: "button", className: "btn btn-ghost", onClick: this.props.onCancel }, "\u53D6\u6D88"),
                React.createElement("button", { className: "btn btn-primary", disabled: this.state.saving }, this.state.saving ? '保存中…' : this.props.initial ? '保存发票' : '收进发票夹')));
    }
}
class InvoicesPage extends React.Component {
    constructor(props) { super(props); this.state = { loading: true, month: props.month, type: 'received', status: 'recorded', linked: '', search: '', items: [], total: 0, summary: null, transactions: [], creating: false, edit: null }; }
    componentDidMount() { this.load(); }
    componentDidUpdate(prevProps) { if (prevProps.refreshToken !== this.props.refreshToken)
        this.load(); }
    async load() {
        this.setState({ loading: true });
        const params = new URLSearchParams({ month: this.state.month, type: this.state.type, status: this.state.status, limit: '200' });
        if (this.state.linked)
            params.set('linked', this.state.linked);
        if (this.state.search.trim())
            params.set('search', this.state.search.trim());
        try {
            const [data, summary, expenseTransactions, incomeTransactions] = await Promise.all([apiRequest(`/api/invoices?${params.toString()}`), apiRequest(`/api/invoices/summary?month=${this.state.month}`), apiRequest('/api/transactions?type=expense&limit=300'), apiRequest('/api/transactions?type=income&limit=300')]);
            this.setState({ loading: false, items: data.items, total: data.total, summary, transactions: [...expenseTransactions.items, ...incomeTransactions.items] });
        }
        catch (error) {
            this.setState({ loading: false });
            this.props.onError(error.message);
        }
    }
    change(state) { this.setState(state, () => this.load()); }
    async voidItem(item) { if (!window.confirm(`作废发票“${item.invoice_number}”？关联的收支记录不会删除。`))
        return; try {
        await apiRequest(`/api/invoices/${item.id}`, { method: 'DELETE' });
        this.load();
        this.props.onChanged();
        this.props.onToast('发票已经作废', 'success');
    }
    catch (error) {
        this.props.onToast(error.message, 'error');
    } }
    async restoreItem(item) { try {
        await apiRequest(`/api/invoices/${item.id}/restore`, { method: 'POST' });
        this.load();
        this.props.onChanged();
        this.props.onToast('发票已经恢复，请重新检查关联记录', 'success');
    }
    catch (error) {
        this.props.onToast(error.message, 'error');
    } }
    render() {
        const summary = this.state.summary || { received: {}, issued: {} };
        return React.createElement("div", { className: "page invoice-page" },
            React.createElement(PageHeader, { title: "\u53D1\u7968\u5939", subtitle: "\u6536\u5230\u7684\u53D1\u7968\u5173\u8054\u652F\u51FA\uFF0C\u5F00\u51FA\u7684\u53D1\u7968\u5173\u8054\u6536\u5165\u3002" },
                React.createElement(MonthSwitcher, { month: this.state.month, onChange: (month) => this.change({ month }) }),
                React.createElement("button", { className: "btn btn-primary", onClick: () => this.setState({ creating: true }) },
                    React.createElement(Icon, { name: "plus", size: 18 }),
                    "\u8BB0\u53D1\u7968")),
            React.createElement("section", { className: "invoice-journal-hero card" },
                React.createElement("div", { className: "invoice-hero-copy" },
                    React.createElement("div", { className: "invoice-hero-icon" },
                        React.createElement(Icon, { name: "invoice", size: 26 })),
                    React.createElement("div", null,
                        React.createElement("span", { className: "journal-sticker" }, "\u53D1\u7968\u7BA1\u7406"),
                        React.createElement("h2", null, "\u6BCF\u5F20\u53D1\u7968\uFF0C\u90FD\u80FD\u627E\u5230\u5BF9\u5E94\u7684\u5C0F\u8D26"),
                        React.createElement("p", null, "\u6536\u5230\u7684\u53D1\u7968\u5173\u8054\u652F\u51FA\uFF0C\u5F00\u51FA\u7684\u53D1\u7968\u5173\u8054\u6536\u5165\uFF1B\u6682\u65F6\u6CA1\u6709\u5BF9\u5E94\u8BB0\u5F55\uFF0C\u4E5F\u53EF\u4EE5\u7A0D\u540E\u8865\u5145\u3002"))),
                React.createElement("div", { className: "invoice-hero-mascot" },
                    React.createElement(Mascot, { variant: "invoice", label: "\u828B\u5934\u548C\u5C0F\u70AE\u53F0\u4E00\u8D77\u6574\u7406\u53D1\u7968", eager: true }))),
            React.createElement("section", { className: "invoice-summary-grid" },
                React.createElement("button", { className: cn('invoice-summary-card received', this.state.type === 'received' && 'active'), onClick: () => this.change({ type: 'received' }) },
                    React.createElement("span", null, "\u6536\u5230\u7684\u53D1\u7968"),
                    React.createElement("strong", null, formatMoney(summary.received.amountCents || 0)),
                    React.createElement("small", null,
                        summary.received.count || 0,
                        " \u5F20 \u00B7 \u5DF2\u5173\u8054 ",
                        summary.received.linkedCount || 0)),
                React.createElement("button", { className: cn('invoice-summary-card issued', this.state.type === 'issued' && 'active'), onClick: () => this.change({ type: 'issued' }) },
                    React.createElement("span", null, "\u5F00\u51FA\u7684\u53D1\u7968"),
                    React.createElement("strong", null, formatMoney(summary.issued.amountCents || 0)),
                    React.createElement("small", null,
                        summary.issued.count || 0,
                        " \u5F20 \u00B7 \u5DF2\u5173\u8054 ",
                        summary.issued.linkedCount || 0))),
            React.createElement("section", { className: "card card-pad invoice-list-card" },
                React.createElement("div", { className: "invoice-tabs" },
                    React.createElement("button", { className: cn(this.state.type === 'received' && 'active'), onClick: () => this.change({ type: 'received' }) }, "\u6211\u6536\u5230\u7684"),
                    React.createElement("button", { className: cn(this.state.type === 'issued' && 'active'), onClick: () => this.change({ type: 'issued' }) }, "\u6211\u5F00\u51FA\u7684")),
                React.createElement("div", { className: "filter-bar invoice-filter-bar" },
                    React.createElement("select", { className: "select", value: this.state.status, onChange: (event) => this.change({ status: event.target.value }) },
                        React.createElement("option", { value: "recorded" }, "\u6B63\u5E38\u53D1\u7968"),
                        React.createElement("option", { value: "void" }, "\u5DF2\u4F5C\u5E9F")),
                    React.createElement("select", { className: "select", value: this.state.linked, onChange: (event) => this.change({ linked: event.target.value }) },
                        React.createElement("option", { value: "" }, "\u5168\u90E8\u5173\u8054\u72B6\u6001"),
                        React.createElement("option", { value: "true" }, "\u5DF2\u5173\u8054\u6536\u652F"),
                        React.createElement("option", { value: "false" }, "\u672A\u5173\u8054")),
                    React.createElement("div", { className: "search-wrap" },
                        React.createElement(Icon, { name: "search", size: 18 }),
                        React.createElement("input", { className: "input", placeholder: "\u641C\u7D22\u53F7\u7801\u3001\u62AC\u5934\u6216\u5BF9\u65B9\u540D\u79F0", value: this.state.search, onChange: (event) => this.setState({ search: event.target.value }), onKeyDown: (event) => { if (event.key === 'Enter')
                                this.load(); } })),
                    React.createElement("button", { className: "btn btn-secondary", onClick: () => this.load() }, "\u641C\u7D22")),
                React.createElement("div", { className: "card-title-row" },
                    React.createElement("div", null,
                        React.createElement("h3", { className: "card-title" }, this.state.type === 'received' ? '我收到的发票' : '我开出的发票'),
                        React.createElement("p", { className: "card-subtitle" },
                            monthLabel(this.state.month),
                            " \u00B7 \u5171 ",
                            this.state.total,
                            " \u5F20"))),
                this.state.loading ? React.createElement("div", { className: "stack" },
                    React.createElement("div", { className: "skeleton", style: { height: '100px' } }),
                    React.createElement("div", { className: "skeleton", style: { height: '100px' } })) : this.state.items.length ? React.createElement("div", { className: "invoice-list" }, this.state.items.map((item) => React.createElement(InvoiceItem, { key: item.id, item: item, onEdit: (entry) => this.setState({ edit: entry }), onVoid: (entry) => this.voidItem(entry), onRestore: (entry) => this.restoreItem(entry) }))) : React.createElement(EmptyState, { title: "\u53D1\u7968\u5939\u8FD8\u662F\u7A7A\u7684", message: this.state.type === 'received' ? '收到发票后记在这里，再和对应支出关联。' : '开出发票后记在这里，再和对应收入关联。', action: React.createElement("button", { className: "btn btn-primary", onClick: () => this.setState({ creating: true }) }, "\u8BB0\u7B2C\u4E00\u5F20\u53D1\u7968") })),
            React.createElement(Modal, { open: this.state.creating || Boolean(this.state.edit), title: this.state.edit ? '编辑发票' : '记录一张发票', onClose: () => this.setState({ creating: false, edit: null }) },
                React.createElement(InvoiceForm, { initial: this.state.edit, defaultType: this.state.type, transactions: this.state.transactions, onCancel: () => this.setState({ creating: false, edit: null }), onSuccess: () => { this.setState({ creating: false, edit: null }); this.load(); this.props.onChanged(); this.props.onToast('发票已经收进夹子', 'success'); } })));
    }
}
class AccountForm extends React.Component {
    constructor(props) { super(props); const item = props.initial || {}; this.state = { name: item.name || '', type: item.type || 'bank', opening: item.opening_balance_cents ? (item.opening_balance_cents / 100).toFixed(2) : '0.00', color: item.color || '#8E7CDA', saving: false, error: '' }; }
    async submit(event) {
        event.preventDefault();
        if (!this.state.name.trim()) {
            this.setState({ error: '请输入账户名称' });
            return;
        }
        this.setState({ saving: true, error: '' });
        try {
            const payload = { name: this.state.name.trim(), type: this.state.type, openingBalanceCents: Math.round(Number(this.state.opening || 0) * 100), icon: this.state.type, color: this.state.color };
            await apiRequest(this.props.initial ? `/api/accounts/${this.props.initial.id}` : '/api/accounts', { method: this.props.initial ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
            this.props.onSuccess();
        }
        catch (error) {
            this.setState({ saving: false, error: error.message });
        }
    }
    render() { return React.createElement("form", { onSubmit: (event) => this.submit(event) },
        React.createElement("div", { className: "form-grid" },
            React.createElement("div", { className: "field form-span" },
                React.createElement("label", null, "\u8D26\u6237\u540D\u79F0"),
                React.createElement("input", { className: "input", maxLength: 30, placeholder: "\u4F8B\u5982\uFF1A\u5DE5\u8D44\u5361", value: this.state.name, onChange: (event) => this.setState({ name: event.target.value }) })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "\u8D26\u6237\u7C7B\u578B"),
                React.createElement("select", { className: "select", value: this.state.type, onChange: (event) => this.setState({ type: event.target.value }) }, Object.keys(ACCOUNT_TYPE_LABEL).map((key) => React.createElement("option", { key: key, value: key }, ACCOUNT_TYPE_LABEL[key])))),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "\u671F\u521D\u4F59\u989D"),
                React.createElement("input", { className: "input", inputMode: "decimal", value: this.state.opening, onChange: (event) => this.setState({ opening: event.target.value }) })),
            React.createElement("div", { className: "field form-span" },
                React.createElement("label", null, "\u5361\u7247\u989C\u8272"),
                React.createElement("input", { className: "input", type: "color", value: this.state.color, onChange: (event) => this.setState({ color: event.target.value }) }))),
        this.state.error ? React.createElement("p", { className: "error-text" }, this.state.error) : null,
        React.createElement("div", { className: "form-actions" },
            React.createElement("button", { type: "button", className: "btn btn-ghost", onClick: this.props.onCancel }, "\u53D6\u6D88"),
            React.createElement("button", { className: "btn btn-primary", disabled: this.state.saving }, this.state.saving ? '保存中…' : '保存账户'))); }
}
class AccountsPage extends React.Component {
    constructor(props) { super(props); this.state = { loading: true, items: [], edit: null, creating: false }; }
    componentDidMount() { this.load(); }
    componentDidUpdate(prevProps) { if (prevProps.refreshToken !== this.props.refreshToken)
        this.load(); }
    async load() { this.setState({ loading: true }); try {
        const items = await apiRequest('/api/accounts');
        this.setState({ loading: false, items });
    }
    catch (error) {
        this.setState({ loading: false });
        this.props.onError(error.message);
    } }
    async archive(item) { if (!window.confirm(`归档“${item.name}”？历史账目仍会保留。`))
        return; try {
        await apiRequest(`/api/accounts/${item.id}`, { method: 'DELETE' });
        this.load();
        this.props.onChanged();
        this.props.onToast('账户已经归档', 'success');
    }
    catch (error) {
        this.props.onToast(error.message, 'error');
    } }
    render() { return React.createElement("div", { className: "page" },
        React.createElement(PageHeader, { title: "\u8D26\u6237", subtitle: "\u73B0\u91D1\u3001\u652F\u4ED8\u5E73\u53F0\u548C\u94F6\u884C\u5361\u90FD\u653E\u5728\u8FD9\u91CC\u3002" },
            React.createElement("button", { className: "btn btn-primary", onClick: () => this.setState({ creating: true }) },
                React.createElement(Icon, { name: "plus", size: 18 }),
                "\u65B0\u5EFA\u8D26\u6237")),
        this.state.loading ? React.createElement(LoadingPage, null) : this.state.items.length ? React.createElement("div", { className: "account-grid" }, this.state.items.map((item) => React.createElement("article", { className: "account-card", style: { background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)` }, key: item.id },
            React.createElement("div", { className: "account-card-head" },
                React.createElement("div", null,
                    React.createElement("div", { className: "account-name" }, item.name),
                    React.createElement("div", { className: "account-type" }, ACCOUNT_TYPE_LABEL[item.type] || item.type)),
                React.createElement("span", null, CATEGORY_EMOJI[item.icon] || CATEGORY_EMOJI[item.type] || '💳')),
            React.createElement("div", { className: "account-balance" },
                React.createElement(AnimatedNumber, { value: item.balance_cents }, (value) => formatMoney(value))),
            React.createElement("div", { className: "account-actions" },
                React.createElement("button", { onClick: () => this.setState({ edit: item }) }, "\u7F16\u8F91"),
                React.createElement("button", { onClick: () => this.archive(item) }, "\u5F52\u6863"))))) : React.createElement(EmptyState, { title: "\u8FD8\u6CA1\u6709\u8D26\u6237", message: "\u5148\u6DFB\u52A0\u4E00\u4E2A\u5E38\u7528\u8D26\u6237\uFF0C\u8BB0\u8D26\u4F1A\u66F4\u65B9\u4FBF\u3002", action: React.createElement("button", { className: "btn btn-primary", onClick: () => this.setState({ creating: true }) }, "\u6DFB\u52A0\u8D26\u6237") }),
        React.createElement(Modal, { open: this.state.creating || Boolean(this.state.edit), title: this.state.edit ? '编辑账户' : '新建账户', onClose: () => this.setState({ creating: false, edit: null }) },
            React.createElement(AccountForm, { initial: this.state.edit, onCancel: () => this.setState({ creating: false, edit: null }), onSuccess: () => { this.setState({ creating: false, edit: null }); this.load(); this.props.onChanged(); this.props.onToast('账户已经保存', 'success'); } }))); }
}
class BudgetsPage extends React.Component {
    constructor(props) { super(props); this.state = { month: props.month, loading: true, budgets: [], progress: [], values: {}, saving: '' }; }
    componentDidMount() { this.load(); }
    componentDidUpdate(prevProps) { if (prevProps.refreshToken !== this.props.refreshToken)
        this.load(); }
    async load() {
        this.setState({ loading: true });
        try {
            const [budgets, progress] = await Promise.all([apiRequest(`/api/budgets?period=${this.state.month}`), apiRequest(`/api/stats/budget-progress?month=${this.state.month}`)]);
            const values = { total: '' };
            budgets.forEach((item) => { values[item.category_id || 'total'] = item.amount_cents ? (item.amount_cents / 100).toFixed(2) : ''; });
            this.setState({ loading: false, budgets, progress: progress.items, values });
        }
        catch (error) {
            this.setState({ loading: false });
            this.props.onError(error.message);
        }
    }
    async save(categoryId) {
        const key = categoryId || 'total';
        const amountCents = Math.max(0, Math.round(Number(this.state.values[key] || 0) * 100));
        this.setState({ saving: key });
        try {
            await apiRequest('/api/budgets', { method: 'POST', body: JSON.stringify({ period: this.state.month, categoryId, amountCents }) });
            this.setState({ saving: '' });
            this.load();
            this.props.onChanged();
            this.props.onToast('预算已经保存', 'success');
        }
        catch (error) {
            this.setState({ saving: '' });
            this.props.onToast(error.message, 'error');
        }
    }
    render() {
        const categories = this.props.bootstrap.categories.filter((item) => item.type === 'expense' && !item.is_archived);
        const progressMap = {};
        this.state.progress.forEach((item) => { progressMap[item.category_id] = item; });
        return React.createElement("div", { className: "page" },
            React.createElement(PageHeader, { title: "\u9884\u7B97", subtitle: "\u7ED9\u751F\u6D3B\u7559\u4E00\u70B9\u8FB9\u754C\uFF0C\u4F46\u4E0D\u7528\u628A\u81EA\u5DF1\u7BA1\u5F97\u592A\u7D27\u3002" },
                React.createElement(MonthSwitcher, { month: this.state.month, onChange: (month) => this.setState({ month }, () => this.load()) })),
            this.state.loading ? React.createElement(LoadingPage, null) : React.createElement("div", { className: "grid grid-2" },
                React.createElement("section", { className: "card card-pad" },
                    React.createElement("div", { className: "card-title-row" },
                        React.createElement("div", null,
                            React.createElement("h3", { className: "card-title" }, "\u603B\u9884\u7B97"),
                            React.createElement("p", { className: "card-subtitle" }, "\u4E0D\u8BBE\u7F6E\u4E5F\u6CA1\u5173\u7CFB\uFF0C\u53EF\u4EE5\u53EA\u8BBE\u5206\u7C7B\u9884\u7B97"))),
                    React.createElement("div", { className: "field" },
                        React.createElement("label", null,
                            monthLabel(this.state.month),
                            "\u603B\u9884\u7B97"),
                        React.createElement("div", { style: { display: 'flex', gap: '10px' } },
                            React.createElement("input", { className: "input", inputMode: "decimal", placeholder: "\u4F8B\u5982 5000", value: this.state.values.total || '', onChange: (event) => this.setState({ values: { ...this.state.values, total: event.target.value } }) }),
                            React.createElement("button", { className: "btn btn-primary", onClick: () => this.save(null), disabled: this.state.saving === 'total' }, this.state.saving === 'total' ? '保存中' : '保存'))),
                    React.createElement("div", { className: "empty-mascot", style: { margin: '18px auto 0', width: '210px' } },
                        React.createElement(Mascot, { variant: "idle" }))),
                React.createElement("section", { className: "card card-pad" },
                    React.createElement("div", { className: "card-title-row" },
                        React.createElement("div", null,
                            React.createElement("h3", { className: "card-title" }, "\u5206\u7C7B\u9884\u7B97"),
                            React.createElement("p", { className: "card-subtitle" }, "\u5E38\u7528\u5206\u7C7B\u53EF\u4EE5\u5355\u72EC\u63A7\u5236"))),
                    React.createElement("div", null, categories.map((category) => { const progress = progressMap[category.id]; const percent = progress ? safePercent(progress.used_cents, progress.amount_cents) : 0; return React.createElement("div", { className: "budget-row", key: category.id },
                        React.createElement("div", { className: "budget-top" },
                            React.createElement("span", null,
                                CATEGORY_EMOJI[category.icon] || '✨',
                                " ",
                                category.name),
                            progress ? React.createElement("small", null,
                                formatCompactMoney(progress.used_cents),
                                " / ",
                                formatCompactMoney(progress.amount_cents)) : React.createElement("small", null, "\u672A\u8BBE\u7F6E")),
                        progress ? React.createElement("div", { className: "progress-track", style: { marginBottom: '8px' } },
                            React.createElement("div", { className: cn('progress-fill', percent >= 100 ? 'over' : percent >= 80 ? 'notice' : 'normal'), style: { width: `${Math.max(2, percent)}%` } })) : null,
                        React.createElement("div", { style: { display: 'flex', gap: '8px' } },
                            React.createElement("input", { className: "input", inputMode: "decimal", placeholder: "\u9884\u7B97\u91D1\u989D", value: this.state.values[category.id] || '', onChange: (event) => this.setState({ values: { ...this.state.values, [category.id]: event.target.value } }) }),
                            React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => this.save(category.id), disabled: this.state.saving === category.id }, this.state.saving === category.id ? '保存中' : '保存'))); })))));
    }
}
class CategoryManager extends React.Component {
    constructor(props) { super(props); this.state = { type: 'expense', name: '', color: '#8E7CDA', saving: false }; }
    async add() { if (!this.state.name.trim())
        return; this.setState({ saving: true }); try {
        await apiRequest('/api/categories', { method: 'POST', body: JSON.stringify({ type: this.state.type, name: this.state.name.trim(), color: this.state.color, icon: 'dots' }) });
        this.setState({ name: '', saving: false });
        this.props.onChanged();
    }
    catch (error) {
        this.setState({ saving: false });
        this.props.onToast(error.message, 'error');
    } }
    async archive(item) { if (!window.confirm(`归档“${item.name}”分类？`))
        return; try {
        await apiRequest(`/api/categories/${item.id}`, { method: 'DELETE' });
        this.props.onChanged();
    }
    catch (error) {
        this.props.onToast(error.message, 'error');
    } }
    render() { const items = this.props.bootstrap.categories.filter((item) => item.type === this.state.type && !item.is_archived); return React.createElement("div", null,
        React.createElement("div", { className: "type-switch", style: { maxWidth: '360px' } },
            React.createElement("button", { type: "button", className: cn(this.state.type === 'expense' && 'active expense'), onClick: () => this.setState({ type: 'expense' }) }, "\u652F\u51FA\u5206\u7C7B"),
            React.createElement("button", { type: "button", className: cn(this.state.type === 'income' && 'active income'), onClick: () => this.setState({ type: 'income' }) }, "\u6536\u5165\u5206\u7C7B"),
            React.createElement("button", { type: "button", disabled: true },
                "\u5171 ",
                items.length,
                " \u4E2A")),
        React.createElement("div", { className: "category-grid", style: { margin: '14px 0 18px' } }, items.map((item) => React.createElement("div", { className: "category-chip", key: item.id, style: { position: 'relative' } },
            React.createElement("span", { className: "emoji" }, CATEGORY_EMOJI[item.icon] || '✨'),
            React.createElement("span", null, item.name),
            React.createElement("button", { type: "button", onClick: () => this.archive(item), title: "\u5F52\u6863\u5206\u7C7B", style: { position: 'absolute', right: 2, top: 2, border: 0, background: 'transparent', color: '#9C95A8', cursor: 'pointer' } }, "\u00D7")))),
        React.createElement("div", { className: "form-grid" },
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "\u65B0\u5206\u7C7B\u540D\u79F0"),
                React.createElement("input", { className: "input", maxLength: 20, placeholder: "\u4F8B\u5982\uFF1A\u5496\u5561", value: this.state.name, onChange: (event) => this.setState({ name: event.target.value }) })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "\u5206\u7C7B\u989C\u8272"),
                React.createElement("input", { className: "input", type: "color", value: this.state.color, onChange: (event) => this.setState({ color: event.target.value }) }))),
        React.createElement("div", { className: "form-actions" },
            React.createElement("button", { className: "btn btn-primary", onClick: () => this.add(), disabled: this.state.saving || !this.state.name.trim() }, this.state.saving ? '添加中…' : '添加分类'))); }
}
function AuthFrame(props) {
    return React.createElement("main", { className: "auth-page" },
        React.createElement("section", { className: "auth-visual", "aria-hidden": "true" },
            React.createElement("div", { className: "auth-visual-copy" },
                React.createElement("span", { className: "auth-kicker" }, "\u828B\u70AE\u5C0F\u8D26\u672C"),
                React.createElement("h1", null,
                    "\u4E24\u4E2A\u4EBA\u7684\u5C0F\u65E5\u5B50\uFF0C",
                    React.createElement("br", null),
                    "\u90FD\u8BA4\u771F\u8BB0\u4E0B\u6765\u3002"),
                React.createElement("p", null, "\u6570\u636E\u53EA\u5B58\u8FDB\u4F60\u81EA\u5DF1\u7684 Cloudflare D1\uFF0C\u4E0D\u4F7F\u7528\u7B2C\u4E09\u65B9\u767B\u5F55\u670D\u52A1\u3002")),
            React.createElement(Mascot, { variant: props.variant || 'idle', label: "\u828B\u5934\u548C\u5C0F\u70AE\u53F0\u5B88\u62A4\u5C0F\u8D26\u672C" })),
        React.createElement("section", { className: "auth-panel" },
            React.createElement("div", { className: "auth-card" },
                React.createElement("div", { className: "auth-brand auth-brand-approved" },
                    React.createElement(BrandLockup, null)),
                props.children)));
}
class LoginPage extends React.Component {
    constructor(props) { super(props); this.state = { email: '', password: '', rememberMe: true, saving: false, error: '', showPassword: false }; }
    async submit(event) {
        event.preventDefault();
        this.setState({ saving: true, error: '' });
        try {
            const params = await fetchPasswordParams(this.state.email);
            const passwordProof = await derivePasswordProof(this.state.password, params.salt, params.iterations);
            const result = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: this.state.email, passwordProof, rememberMe: this.state.rememberMe }) });
            this.setState({ saving: false, password: '' });
            this.props.onLogin(result);
        }
        catch (error) {
            this.setState({ saving: false, error: error.message || '登录失败' });
        }
    }
    render() { return React.createElement(AuthFrame, { subtitle: "\u6B22\u8FCE\u56DE\u6765", variant: "idle" },
        React.createElement("div", { className: "auth-heading" },
            React.createElement("h2", null, "\u767B\u5F55\u5C0F\u8D26\u672C"),
            React.createElement("p", null, "\u4F7F\u7528\u521D\u59CB\u5316\u65F6\u8BBE\u7F6E\u7684\u90AE\u7BB1\u548C\u5BC6\u7801\u3002")),
        React.createElement("form", { className: "auth-form", onSubmit: (event) => this.submit(event) },
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "\u90AE\u7BB1"),
                React.createElement("input", { className: "input", type: "email", autoComplete: "username", required: true, maxLength: 160, value: this.state.email, onChange: (event) => this.setState({ email: event.target.value }), placeholder: "name@example.com" })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "\u5BC6\u7801"),
                React.createElement("div", { className: "password-field" },
                    React.createElement("input", { className: "input", type: this.state.showPassword ? 'text' : 'password', autoComplete: "current-password", required: true, value: this.state.password, onChange: (event) => this.setState({ password: event.target.value }), placeholder: "\u8BF7\u8F93\u5165\u5BC6\u7801" }),
                    React.createElement("button", { type: "button", onClick: () => this.setState({ showPassword: !this.state.showPassword }) }, this.state.showPassword ? '隐藏' : '显示'))),
            React.createElement("label", { className: "check-row" },
                React.createElement("input", { type: "checkbox", checked: this.state.rememberMe, onChange: (event) => this.setState({ rememberMe: event.target.checked }) }),
                React.createElement("span", null, "\u5728\u8FD9\u53F0\u79C1\u4EBA\u8BBE\u5907\u4E0A\u4FDD\u6301\u767B\u5F55 30 \u5929")),
            this.state.error ? React.createElement("div", { className: "form-error" }, this.state.error) : null,
            React.createElement("button", { className: "btn btn-primary auth-submit", type: "submit", disabled: this.state.saving }, this.state.saving ? '正在登录…' : '登录'),
            React.createElement("button", { className: "text-button", type: "button", onClick: this.props.onRecover }, "\u5FD8\u8BB0\u5BC6\u7801\uFF1F\u4F7F\u7528\u6062\u590D\u7801")),
        React.createElement("p", { className: "auth-footnote" }, "\u8FDE\u7EED\u8F93\u9519 5 \u6B21\u4F1A\u4E34\u65F6\u9501\u5B9A 15 \u5206\u949F\u3002")); }
}
class RecoverPage extends React.Component {
    constructor(props) { super(props); this.state = { email: '', recoveryCode: '', newPassword: '', confirmPassword: '', saving: false, error: '', success: false }; }
    async submit(event) {
        event.preventDefault();
        if (this.state.newPassword !== this.state.confirmPassword) {
            this.setState({ error: '两次输入的新密码不一致' });
            return;
        }
        const validation = passwordValidationMessage(this.state.newPassword, this.state.email);
        if (validation) {
            this.setState({ error: validation });
            return;
        }
        this.setState({ saving: true, error: '' });
        try {
            const params = await fetchPasswordParams(this.state.email);
            const newCredential = await createClientCredential(this.state.newPassword, params.iterations);
            await apiRequest('/api/auth/recover', { method: 'POST', body: JSON.stringify({ email: this.state.email, recoveryCode: this.state.recoveryCode, newCredential }) });
            this.setState({ saving: false, success: true, newPassword: '', confirmPassword: '' });
        }
        catch (error) {
            this.setState({ saving: false, error: error.message || '恢复失败' });
        }
    }
    render() { return React.createElement(AuthFrame, { subtitle: "\u8D26\u53F7\u6062\u590D", variant: this.state.success ? 'success' : 'empty' }, this.state.success ? React.createElement("div", { className: "auth-result" },
        React.createElement("h2", null, "\u5BC6\u7801\u5DF2\u7ECF\u91CD\u8BBE"),
        React.createElement("p", null, "\u65E7\u8BBE\u5907\u4E0A\u7684\u767B\u5F55\u72B6\u6001\u5DF2\u5168\u90E8\u5931\u6548\u3002\u73B0\u5728\u53EF\u4EE5\u4F7F\u7528\u65B0\u5BC6\u7801\u767B\u5F55\u3002"),
        React.createElement("button", { className: "btn btn-primary auth-submit", onClick: this.props.onBack }, "\u8FD4\u56DE\u767B\u5F55")) : React.createElement(React.Fragment, null,
        React.createElement("div", { className: "auth-heading" },
            React.createElement("h2", null, "\u4F7F\u7528\u6062\u590D\u7801"),
            React.createElement("p", null, "\u6062\u590D\u7801\u53EA\u80FD\u4F7F\u7528\u4E00\u6B21\uFF0C\u91CD\u8BBE\u540E\u5176\u4ED6\u8BBE\u5907\u4F1A\u9000\u51FA\u767B\u5F55\u3002")),
        React.createElement("form", { className: "auth-form", onSubmit: (event) => this.submit(event) },
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "\u90AE\u7BB1"),
                React.createElement("input", { className: "input", type: "email", required: true, autoComplete: "username", value: this.state.email, onChange: (event) => this.setState({ email: event.target.value }) })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "\u6062\u590D\u7801"),
                React.createElement("input", { className: "input recovery-input", required: true, autoCapitalize: "characters", value: this.state.recoveryCode, onChange: (event) => this.setState({ recoveryCode: event.target.value }), placeholder: "YP-XXXX-XXXX-XXXX-XXXX" })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "\u65B0\u5BC6\u7801"),
                React.createElement("input", { className: "input", type: "password", required: true, autoComplete: "new-password", value: this.state.newPassword, onChange: (event) => this.setState({ newPassword: event.target.value }), placeholder: "\u81F3\u5C11 12 \u4F4D\uFF0C\u5305\u542B\u5B57\u6BCD\u548C\u6570\u5B57" })),
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "\u786E\u8BA4\u65B0\u5BC6\u7801"),
                React.createElement("input", { className: "input", type: "password", required: true, autoComplete: "new-password", value: this.state.confirmPassword, onChange: (event) => this.setState({ confirmPassword: event.target.value }) })),
            this.state.error ? React.createElement("div", { className: "form-error" }, this.state.error) : null,
            React.createElement("button", { className: "btn btn-primary auth-submit", type: "submit", disabled: this.state.saving }, this.state.saving ? '正在重设…' : '重设密码'),
            React.createElement("button", { className: "text-button", type: "button", onClick: this.props.onBack }, "\u8FD4\u56DE\u767B\u5F55")))); }
}
function downloadRecoveryCodes(result) {
    const lines = [`芋炮小账本恢复码`, `生成时间：${new Date().toLocaleString('zh-CN')}`, '', ...result.accounts.flatMap((account) => [`${account.displayName}（${account.email} / ${account.role === 'owner' ? '管理员' : '家庭成员'}）`, ...account.recoveryCodes, '']), '每个恢复码只能使用一次，请离线保存。'];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '芋炮小账本-恢复码.txt';
    link.click();
    URL.revokeObjectURL(link.href);
}
class SetupPage extends React.Component {
    constructor(props) { super(props); this.state = { householdName: '芋炮之家', ownerName: '', ownerEmail: '', ownerPassword: '', ownerConfirm: '', memberName: '', memberEmail: '', memberPassword: '', memberConfirm: '', setupToken: '', saving: false, error: '', result: null }; }
    async submit(event) {
        event.preventDefault();
        if (this.state.ownerPassword !== this.state.ownerConfirm || this.state.memberPassword !== this.state.memberConfirm) {
            this.setState({ error: '请确认两个账号的密码输入一致' });
            return;
        }
        const ownerValidation = passwordValidationMessage(this.state.ownerPassword, this.state.ownerEmail);
        const memberValidation = passwordValidationMessage(this.state.memberPassword, this.state.memberEmail);
        if (ownerValidation || memberValidation) {
            this.setState({ error: ownerValidation ? `管理员账号：${ownerValidation}` : `家庭成员账号：${memberValidation}` });
            return;
        }
        this.setState({ saving: true, error: '' });
        try {
            const iterations = Number(this.props.passwordIterations || 120000);
            const [ownerCredential, memberCredential] = await Promise.all([
                createClientCredential(this.state.ownerPassword, iterations),
                createClientCredential(this.state.memberPassword, iterations),
            ]);
            const result = await apiRequest('/api/auth/setup', { method: 'POST', body: JSON.stringify({ clientVersion: APP_VERSION, householdName: this.state.householdName, ownerName: this.state.ownerName, ownerEmail: this.state.ownerEmail, ownerCredential, memberName: this.state.memberName, memberEmail: this.state.memberEmail, memberCredential, setupToken: this.state.setupToken }) });
            this.setState({ saving: false, result, ownerPassword: '', ownerConfirm: '', memberPassword: '', memberConfirm: '', setupToken: '' });
        }
        catch (error) {
            this.setState({ saving: false, error: error.message || '初始化失败' });
        }
    }
    render() {
        if (this.state.result)
            return React.createElement(AuthFrame, { subtitle: "\u521D\u59CB\u5316\u5B8C\u6210", variant: "success" },
                React.createElement("div", { className: "auth-heading" },
                    React.createElement("h2", null, "\u4E24\u4E2A\u8D26\u53F7\u5DF2\u7ECF\u51C6\u5907\u597D"),
                    React.createElement("p", null, "\u6062\u590D\u7801\u53EA\u663E\u793A\u8FD9\u4E00\u6B21\u3002\u8BF7\u4E0B\u8F7D\u540E\u5206\u522B\u5B89\u5168\u4FDD\u5B58\u3002")),
                React.createElement("div", { className: "recovery-accounts" }, this.state.result.accounts.map((account) => React.createElement("section", { className: "recovery-card", key: account.email },
                    React.createElement("strong", null, account.displayName),
                    React.createElement("span", null,
                        account.email,
                        " \u00B7 ",
                        account.role === 'owner' ? '管理员' : '家庭成员'),
                    React.createElement("code", null, account.recoveryCodes.join('\n'))))),
                React.createElement("button", { className: "btn btn-secondary auth-submit", onClick: () => downloadRecoveryCodes(this.state.result) },
                    React.createElement(Icon, { name: "download", size: 17 }),
                    "\u4E0B\u8F7D\u6062\u590D\u7801"),
                React.createElement("button", { className: "btn btn-primary auth-submit", onClick: this.props.onComplete }, "\u6211\u5DF2\u4FDD\u5B58\uFF0C\u53BB\u767B\u5F55"));
        return React.createElement(AuthFrame, { subtitle: "\u9996\u6B21\u521D\u59CB\u5316", variant: "idle" },
            React.createElement("div", { className: "auth-heading" },
                React.createElement("h2", null, "\u521B\u5EFA\u4F60\u4EEC\u7684\u4E24\u4E2A\u8D26\u53F7"),
                React.createElement("p", null, "\u6B64\u9875\u9762\u53EA\u5728\u9996\u6B21\u521D\u59CB\u5316\u65F6\u5F00\u653E\u3002\u5BC6\u7801\u4E0D\u4F1A\u4EE5\u660E\u6587\u4FDD\u5B58\u3002")),
            React.createElement("form", { className: "auth-form setup-form", onSubmit: (event) => this.submit(event) },
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u5BB6\u5EAD\u540D\u79F0"),
                    React.createElement("input", { className: "input", maxLength: 40, required: true, value: this.state.householdName, onChange: (event) => this.setState({ householdName: event.target.value }) })),
                React.createElement("div", { className: "setup-columns" },
                    React.createElement("fieldset", null,
                        React.createElement("legend", null, "\u7BA1\u7406\u5458\u8D26\u53F7"),
                        React.createElement("div", { className: "field" },
                            React.createElement("label", null, "\u6635\u79F0"),
                            React.createElement("input", { className: "input", required: true, maxLength: 24, value: this.state.ownerName, onChange: (event) => this.setState({ ownerName: event.target.value }) })),
                        React.createElement("div", { className: "field" },
                            React.createElement("label", null, "\u90AE\u7BB1"),
                            React.createElement("input", { className: "input", type: "email", required: true, value: this.state.ownerEmail, onChange: (event) => this.setState({ ownerEmail: event.target.value }) })),
                        React.createElement("div", { className: "field" },
                            React.createElement("label", null, "\u5BC6\u7801"),
                            React.createElement("input", { className: "input", type: "password", required: true, autoComplete: "new-password", value: this.state.ownerPassword, onChange: (event) => this.setState({ ownerPassword: event.target.value }), placeholder: "\u81F3\u5C11 12 \u4F4D\uFF0C\u5305\u542B\u5B57\u6BCD\u548C\u6570\u5B57" })),
                        React.createElement("div", { className: "field" },
                            React.createElement("label", null, "\u786E\u8BA4\u5BC6\u7801"),
                            React.createElement("input", { className: "input", type: "password", required: true, value: this.state.ownerConfirm, onChange: (event) => this.setState({ ownerConfirm: event.target.value }) }))),
                    React.createElement("fieldset", null,
                        React.createElement("legend", null, "\u5BB6\u5EAD\u6210\u5458\u8D26\u53F7"),
                        React.createElement("div", { className: "field" },
                            React.createElement("label", null, "\u6635\u79F0"),
                            React.createElement("input", { className: "input", required: true, maxLength: 24, value: this.state.memberName, onChange: (event) => this.setState({ memberName: event.target.value }) })),
                        React.createElement("div", { className: "field" },
                            React.createElement("label", null, "\u90AE\u7BB1"),
                            React.createElement("input", { className: "input", type: "email", required: true, value: this.state.memberEmail, onChange: (event) => this.setState({ memberEmail: event.target.value }) })),
                        React.createElement("div", { className: "field" },
                            React.createElement("label", null, "\u5BC6\u7801"),
                            React.createElement("input", { className: "input", type: "password", required: true, autoComplete: "new-password", value: this.state.memberPassword, onChange: (event) => this.setState({ memberPassword: event.target.value }), placeholder: "\u81F3\u5C11 12 \u4F4D\uFF0C\u5305\u542B\u5B57\u6BCD\u548C\u6570\u5B57" })),
                        React.createElement("div", { className: "field" },
                            React.createElement("label", null, "\u786E\u8BA4\u5BC6\u7801"),
                            React.createElement("input", { className: "input", type: "password", required: true, value: this.state.memberConfirm, onChange: (event) => this.setState({ memberConfirm: event.target.value }) })))),
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u521D\u59CB\u5316\u5BC6\u94A5"),
                    React.createElement("input", { className: "input", type: "password", required: true, autoComplete: "off", value: this.state.setupToken, onChange: (event) => this.setState({ setupToken: event.target.value }), placeholder: "Cloudflare \u4E2D\u8BBE\u7F6E\u7684 SETUP_TOKEN" }),
                    React.createElement("small", null, "\u8FD9\u662F\u90E8\u7F72\u540E\u53F0\u7684\u521D\u59CB\u5316\u5BC6\u94A5\uFF0C\u4E0D\u662F\u767B\u5F55\u5BC6\u7801\u3002")),
                this.state.error ? React.createElement("div", { className: "form-error" }, this.state.error) : null,
                React.createElement("button", { className: "btn btn-primary auth-submit", type: "submit", disabled: this.state.saving }, this.state.saving ? '正在创建账号…' : '创建两个账号')));
    }
}
function AuthConfigurationPage(props) {
    const status = props.status || {};
    return React.createElement(AuthFrame, { subtitle: "\u8FD8\u5DEE\u4E00\u6B65\u914D\u7F6E", variant: "empty" },
        React.createElement("div", { className: "auth-heading" },
            React.createElement("h2", null, "\u8BA4\u8BC1\u6A21\u5757\u5C1A\u672A\u51C6\u5907\u597D"),
            React.createElement("p", null, "\u4E1A\u52A1\u6570\u636E\u6CA1\u6709\u53D7\u5230\u5F71\u54CD\uFF0C\u6309\u4E0B\u9762\u63D0\u793A\u5B8C\u6210\u914D\u7F6E\u540E\u5237\u65B0\u9875\u9762\u3002")),
        React.createElement("div", { className: "config-steps" },
            !status.schemaReady ? React.createElement("div", null,
                React.createElement("strong", null, "\u521D\u59CB\u5316\u8BA4\u8BC1\u6570\u636E\u8868"),
                React.createElement("p", null,
                    "\u5728 D1 Console \u4E2D\u6267\u884C ",
                    React.createElement("code", null, "migrations/0002_internal_auth.sql"),
                    "\u3002")) : null,
            status.pepperReady === false ? React.createElement("div", null,
                React.createElement("strong", null, "\u8BBE\u7F6E PASSWORD_PEPPER"),
                React.createElement("p", null,
                    "\u5728 Settings \u2192 Variables and Secrets \u4E2D\u6DFB\u52A0\u957F\u671F\u4FDD\u5B58\u7684 ",
                    React.createElement("code", null, "PASSWORD_PEPPER"),
                    " Secret\u3002")) : null,
            !status.configured && status.setupTokenReady === false ? React.createElement("div", null,
                React.createElement("strong", null, "\u8BBE\u7F6E SETUP_TOKEN"),
                React.createElement("p", null,
                    "\u6DFB\u52A0\u4EC5\u7528\u4E8E\u9996\u6B21\u521D\u59CB\u5316\u7684 ",
                    React.createElement("code", null, "SETUP_TOKEN"),
                    " Secret\u3002")) : null),
        React.createElement("button", { className: "btn btn-primary auth-submit", onClick: props.onRetry }, "\u6211\u5DF2\u5B8C\u6210\uFF0C\u91CD\u65B0\u68C0\u67E5"));
}
class SecuritySettings extends React.Component {
    constructor(props) { super(props); this.state = { mode: '', currentPassword: '', newPassword: '', confirmPassword: '', saving: false, error: '', codes: null }; }
    close() { this.setState({ mode: '', currentPassword: '', newPassword: '', confirmPassword: '', saving: false, error: '', codes: null }); }
    async changePassword(event) {
        event.preventDefault();
        if (this.state.newPassword !== this.state.confirmPassword) {
            this.setState({ error: '两次输入的新密码不一致' });
            return;
        }
        const validation = passwordValidationMessage(this.state.newPassword, this.props.email);
        if (validation) {
            this.setState({ error: validation });
            return;
        }
        this.setState({ saving: true, error: '' });
        try {
            const params = await fetchPasswordParams(this.props.email);
            const [currentPasswordProof, newCredential] = await Promise.all([
                derivePasswordProof(this.state.currentPassword, params.salt, params.iterations),
                createClientCredential(this.state.newPassword, params.iterations),
            ]);
            const result = await apiRequest('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPasswordProof, newCredential }) });
            if (result.csrfToken)
                setClientAuth(result.csrfToken);
            this.close();
            this.props.onToast('密码已经修改，所有旧会话已轮换', 'success');
        }
        catch (error) {
            this.setState({ saving: false, error: error.message });
        }
    }
    async regenerate(event) {
        event.preventDefault();
        this.setState({ saving: true, error: '' });
        try {
            const params = await fetchPasswordParams(this.props.email);
            const currentPasswordProof = await derivePasswordProof(this.state.currentPassword, params.salt, params.iterations);
            const result = await apiRequest('/api/auth/recovery-codes', { method: 'POST', body: JSON.stringify({ currentPasswordProof }) });
            this.setState({ saving: false, currentPassword: '', codes: result.recoveryCodes });
        }
        catch (error) {
            this.setState({ saving: false, error: error.message });
        }
    }
    async revoke() { if (!window.confirm('退出这个账号在其他设备上的登录？当前设备会继续保持登录。'))
        return; try {
        await apiRequest('/api/auth/revoke-other-sessions', { method: 'POST', body: '{}' });
        this.props.onToast('其他设备已经退出登录', 'success');
    }
    catch (error) {
        this.props.onToast(error.message, 'error');
    } }
    render() { return React.createElement(React.Fragment, null,
        React.createElement("div", { className: "settings-list" },
            React.createElement("div", { className: "setting-row" },
                React.createElement("div", null,
                    React.createElement("h4", null, "\u4FEE\u6539\u5BC6\u7801"),
                    React.createElement("p", null, "\u4FEE\u6539\u540E\u4F1A\u9000\u51FA\u8FD9\u4E2A\u8D26\u53F7\u5728\u5176\u4ED6\u8BBE\u5907\u4E0A\u7684\u767B\u5F55")),
                React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => this.setState({ mode: 'password' }) }, "\u4FEE\u6539")),
            React.createElement("div", { className: "setting-row" },
                React.createElement("div", null,
                    React.createElement("h4", null, "\u91CD\u65B0\u751F\u6210\u6062\u590D\u7801"),
                    React.createElement("p", null, "\u65E7\u7684\u672A\u4F7F\u7528\u6062\u590D\u7801\u4F1A\u7ACB\u5373\u5931\u6548")),
                React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => this.setState({ mode: 'codes' }) }, "\u751F\u6210")),
            React.createElement("div", { className: "setting-row" },
                React.createElement("div", null,
                    React.createElement("h4", null, "\u9000\u51FA\u5176\u4ED6\u8BBE\u5907"),
                    React.createElement("p", null, "\u9002\u7528\u4E8E\u8BBE\u5907\u9057\u5931\u6216\u5FD8\u8BB0\u9000\u51FA\u7684\u60C5\u51B5")),
                React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => this.revoke() }, "\u9000\u51FA")),
            React.createElement("div", { className: "setting-row" },
                React.createElement("div", null,
                    React.createElement("h4", null, "\u9000\u51FA\u5F53\u524D\u8D26\u53F7"),
                    React.createElement("p", null, this.props.email)),
                React.createElement("button", { className: "btn btn-danger btn-sm", onClick: this.props.onLogout }, "\u9000\u51FA\u767B\u5F55"))),
        React.createElement(Modal, { open: this.state.mode === 'password', title: "\u4FEE\u6539\u5BC6\u7801", onClose: () => this.close() },
            React.createElement("form", { className: "auth-form", onSubmit: (event) => this.changePassword(event) },
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u5F53\u524D\u5BC6\u7801"),
                    React.createElement("input", { className: "input", type: "password", required: true, value: this.state.currentPassword, onChange: (event) => this.setState({ currentPassword: event.target.value }) })),
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u65B0\u5BC6\u7801"),
                    React.createElement("input", { className: "input", type: "password", required: true, value: this.state.newPassword, onChange: (event) => this.setState({ newPassword: event.target.value }), placeholder: "\u81F3\u5C11 12 \u4F4D\uFF0C\u5305\u542B\u5B57\u6BCD\u548C\u6570\u5B57" })),
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u786E\u8BA4\u65B0\u5BC6\u7801"),
                    React.createElement("input", { className: "input", type: "password", required: true, value: this.state.confirmPassword, onChange: (event) => this.setState({ confirmPassword: event.target.value }) })),
                this.state.error ? React.createElement("div", { className: "form-error" }, this.state.error) : null,
                React.createElement("div", { className: "form-actions" },
                    React.createElement("button", { className: "btn btn-secondary", type: "button", onClick: () => this.close() }, "\u53D6\u6D88"),
                    React.createElement("button", { className: "btn btn-primary", type: "submit", disabled: this.state.saving }, this.state.saving ? '修改中…' : '确认修改')))),
        React.createElement(Modal, { open: this.state.mode === 'codes', title: "\u91CD\u65B0\u751F\u6210\u6062\u590D\u7801", onClose: () => this.close() }, this.state.codes ? React.createElement("div", null,
            React.createElement("p", { className: "modal-note" }, "\u8FD9\u4E9B\u6062\u590D\u7801\u53EA\u663E\u793A\u8FD9\u4E00\u6B21\uFF0C\u8BF7\u7ACB\u5373\u4FDD\u5B58\u3002"),
            React.createElement("code", { className: "codes-block" }, this.state.codes.join('\n')),
            React.createElement("button", { className: "btn btn-primary auth-submit", onClick: () => { var _a; (_a = navigator.clipboard) === null || _a === void 0 ? void 0 : _a.writeText(this.state.codes.join('\n')); this.props.onToast('恢复码已复制', 'success'); } }, "\u590D\u5236\u6062\u590D\u7801")) : React.createElement("form", { className: "auth-form", onSubmit: (event) => this.regenerate(event) },
            React.createElement("div", { className: "field" },
                React.createElement("label", null, "\u5F53\u524D\u5BC6\u7801"),
                React.createElement("input", { className: "input", type: "password", required: true, value: this.state.currentPassword, onChange: (event) => this.setState({ currentPassword: event.target.value }) })),
            this.state.error ? React.createElement("div", { className: "form-error" }, this.state.error) : null,
            React.createElement("button", { className: "btn btn-primary auth-submit", type: "submit", disabled: this.state.saving }, this.state.saving ? '生成中…' : '确认并生成')))); }
}
function SettingsPage(props) {
    const reduceMotion = props.reduceMotion;
    return React.createElement("div", { className: "page" },
        React.createElement(PageHeader, { title: "\u8BBE\u7F6E", subtitle: "\u8C03\u6574\u5C0F\u8D26\u672C\u7684\u4F7F\u7528\u65B9\u5F0F\u548C\u6570\u636E\u7BA1\u7406\u3002" }),
        React.createElement("div", { className: "grid grid-2" },
            React.createElement("section", { className: "card card-pad" },
                React.createElement("div", { className: "card-title-row" },
                    React.createElement("div", null,
                        React.createElement("h3", { className: "card-title" }, "\u4F60\u4EEC\u7684\u5C0F\u8D26\u672C"),
                        React.createElement("p", { className: "card-subtitle" }, "\u5F53\u524D\u767B\u5F55\u4E0E\u5BB6\u5EAD\u7A7A\u95F4"))),
                React.createElement("div", { className: "setting-row" },
                    React.createElement("div", null,
                        React.createElement("h4", null, props.bootstrap.household.name),
                        React.createElement("p", null,
                            props.bootstrap.user.displayName,
                            " \u00B7 ",
                            props.bootstrap.user.role === 'owner' ? '管理员' : '家庭成员')),
                    React.createElement("div", { className: "avatar" }, props.bootstrap.user.displayName.slice(0, 1))),
                React.createElement("div", { className: "setting-row" },
                    React.createElement("div", null,
                        React.createElement("h4", null, "\u8F7B\u52A8\u753B"),
                        React.createElement("p", null, "\u5173\u95ED\u540E\u4F1A\u51CF\u5C11\u89D2\u8272\u3001\u56FE\u8868\u548C\u9875\u9762\u8F6C\u573A\u52A8\u753B")),
                    React.createElement("button", { className: cn('switch', !reduceMotion && 'on'), onClick: () => props.onMotionChange(!reduceMotion), "aria-label": "\u5207\u6362\u52A8\u753B" },
                        React.createElement("span", null))),
                React.createElement("div", { className: "setting-row" },
                    React.createElement("div", null,
                        React.createElement("h4", null, "\u8D26\u6237\u7BA1\u7406"),
                        React.createElement("p", null, "\u6DFB\u52A0\u3001\u4FEE\u6539\u6216\u5F52\u6863\u5E38\u7528\u8D26\u6237")),
                    React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => props.navigate('accounts') }, "\u6253\u5F00")),
                React.createElement("div", { className: "setting-row" },
                    React.createElement("div", null,
                        React.createElement("h4", null, "\u9884\u7B97\u7BA1\u7406"),
                        React.createElement("p", null, "\u8BBE\u7F6E\u6BCF\u6708\u603B\u9884\u7B97\u548C\u5206\u7C7B\u9884\u7B97")),
                    React.createElement("button", { className: "btn btn-secondary btn-sm", onClick: () => props.navigate('budgets') }, "\u6253\u5F00"))),
            React.createElement("section", { className: "card card-pad" },
                React.createElement("div", { className: "card-title-row" },
                    React.createElement("div", null,
                        React.createElement("h3", { className: "card-title" }, "\u8D26\u53F7\u4E0E\u5B89\u5168"),
                        React.createElement("p", { className: "card-subtitle" }, "\u5BC6\u7801\u3001\u6062\u590D\u7801\u548C\u8BBE\u5907\u4F1A\u8BDD"))),
                React.createElement(SecuritySettings, { email: props.bootstrap.user.email, onLogout: props.onLogout, onToast: props.onToast })),
            React.createElement("section", { className: "card card-pad" },
                React.createElement("div", { className: "card-title-row" },
                    React.createElement("div", null,
                        React.createElement("h3", { className: "card-title" }, "\u6570\u636E\u5BFC\u51FA"),
                        React.createElement("p", { className: "card-subtitle" }, "\u5EFA\u8BAE\u5B9A\u671F\u7559\u4E00\u4EFD\u81EA\u5DF1\u80FD\u8BFB\u53D6\u7684\u526F\u672C"))),
                React.createElement("div", { className: "settings-list" },
                    React.createElement("div", { className: "setting-row" },
                        React.createElement("div", null,
                            React.createElement("h4", null, "CSV \u8868\u683C"),
                            React.createElement("p", null, "\u9002\u5408\u7528 Excel \u6216\u5176\u4ED6\u8868\u683C\u5DE5\u5177\u6253\u5F00")),
                        React.createElement("a", { className: "btn btn-secondary btn-sm", href: "/api/export/csv" },
                            React.createElement(Icon, { name: "download", size: 16 }),
                            "\u5BFC\u51FA")),
                    React.createElement("div", { className: "setting-row" },
                        React.createElement("div", null,
                            React.createElement("h4", null, "JSON \u5B8C\u6574\u6570\u636E"),
                            React.createElement("p", null, "\u9002\u5408\u8FC1\u79FB\u3001\u6062\u590D\u6216\u7A0B\u5E8F\u8BFB\u53D6")),
                        React.createElement("a", { className: "btn btn-secondary btn-sm", href: "/api/export/json" },
                            React.createElement(Icon, { name: "download", size: 16 }),
                            "\u5BFC\u51FA"))),
                React.createElement("div", { className: "divider" }),
                React.createElement("div", { className: "card-title-row" },
                    React.createElement("div", null,
                        React.createElement("h3", { className: "card-title" }, "\u5173\u4E8E\u828B\u70AE\u5C0F\u8D26\u672C"),
                        React.createElement("p", { className: "card-subtitle" }, "\u7248\u672C 0.3.7 \u00B7 \u7EDF\u4E00\u54C1\u724C\u4E0E\u79FB\u52A8\u7AEF\u72EC\u7ACB\u91CD\u6784"))),
                React.createElement("p", { style: { color: 'var(--text-2)', lineHeight: 1.8, fontSize: '13px' } }, "\u6CA1\u6709\u5E7F\u544A\u548C\u7B2C\u4E09\u65B9\u884C\u4E3A\u8FFD\u8E2A\u3002\u5BC6\u7801\u5728\u6D4F\u89C8\u5668\u5185\u4F7F\u7528 PBKDF2 \u548C\u72EC\u7ACB\u76D0\u503C\u5904\u7406\uFF0C\u670D\u52A1\u7AEF\u518D\u7ED3\u5408 Pepper \u4FDD\u5B58\u9A8C\u8BC1\u503C\uFF1B\u767B\u5F55\u4F1A\u8BDD\u53EA\u4FDD\u5B58\u5728\u5B89\u5168 Cookie \u4E2D\u3002"),
                React.createElement("div", { style: { width: '230px', margin: '8px auto 0' } },
                    React.createElement(Mascot, { variant: "safe" }))),
            React.createElement("section", { className: "card card-pad form-span" },
                React.createElement("div", { className: "card-title-row" },
                    React.createElement("div", null,
                        React.createElement("h3", { className: "card-title" }, "\u5206\u7C7B\u7BA1\u7406"),
                        React.createElement("p", { className: "card-subtitle" }, "\u65B0\u589E\u5206\u7C7B\u6216\u5F52\u6863\u6682\u65F6\u4E0D\u7528\u7684\u5206\u7C7B"))),
                React.createElement(CategoryManager, { bootstrap: props.bootstrap, onChanged: props.onChanged, onToast: props.onToast }))));
}
class App extends React.Component {
    constructor(props) {
        super(props);
        this.toastTimer = null;
        const route = this.routeFromHash();
        const reduceMotion = localStorage.getItem('yupao-reduce-motion') === 'true';
        this.state = { route, authPhase: 'checking', setupStatus: null, bootstrap: null, loading: true, error: '', online: navigator.onLine, toast: null, month: currentMonth(), refreshToken: 0, reduceMotion };
        this.onHashChange = this.onHashChange.bind(this);
        this.onOnline = this.onOnline.bind(this);
        this.onOffline = this.onOffline.bind(this);
    }
    routeFromHash() { const value = location.hash.replace(/^#\/?/, '').split('/')[0]; return ROUTES.some((route) => route.key === value) ? value : 'home'; }
    componentDidMount() {
        window.addEventListener('hashchange', this.onHashChange);
        window.addEventListener('online', this.onOnline);
        window.addEventListener('offline', this.onOffline);
        this.applyMotion(this.state.reduceMotion);
        authExpiredHandler = () => this.endSession('登录已失效，请重新登录');
        this.initializeAuth();
        registerServiceWorker(() => this.showToast('小账本有新版本，刷新页面即可更新', 'default'));
    }
    componentDidUpdate(_, prevState) {
        if (prevState.route !== this.state.route || prevState.authPhase !== this.state.authPhase || prevState.loading !== this.state.loading || prevState.refreshToken !== this.state.refreshToken)
            schedulePageMotion();
    }
    componentWillUnmount() { window.removeEventListener('hashchange', this.onHashChange); window.removeEventListener('online', this.onOnline); window.removeEventListener('offline', this.onOffline); clearMotionRegistry(); authExpiredHandler = null; }
    onHashChange() { this.setState({ route: this.routeFromHash() }); window.scrollTo(0, 0); }
    onOnline() { this.setState({ online: true }); this.showToast('网络已经恢复', 'success'); }
    onOffline() { this.setState({ online: false }); }
    navigate(route) { location.hash = `#/${route}`; }
    async initializeAuth() {
        this.setState({ authPhase: 'checking', error: '', loading: true });
        try {
            const status = await apiRequest('/api/auth/setup-status');
            if (!status.schemaReady || !status.secretsReady) {
                this.setState({ authPhase: 'config', setupStatus: status, loading: false });
                return;
            }
            if (!status.configured) {
                this.setState({ authPhase: 'setup', setupStatus: status, loading: false });
                return;
            }
            try {
                const session = await apiRequest('/api/auth/session');
                setClientAuth(session.csrfToken);
                await this.loadBootstrap(true);
            }
            catch (error) {
                if (error.status === 401) {
                    setClientAuth('');
                    this.setState({ authPhase: 'login', loading: false, bootstrap: null });
                    return;
                }
                throw error;
            }
        }
        catch (error) {
            this.setState({ authPhase: 'error', error: error.message || '小账本暂时打不开', loading: false });
        }
    }
    async loadBootstrap(initial = false) {
        this.setState({ loading: true, error: '' });
        try {
            const bootstrap = await apiRequest(`/api/bootstrap?month=${this.state.month}`);
            this.setState({ bootstrap, loading: false, authPhase: 'app' });
        }
        catch (error) {
            if (error.status === 401)
                return;
            this.setState({ loading: false, error: error.message || '小账本暂时打不开', authPhase: initial ? 'error' : this.state.authPhase });
        }
    }
    async handleLogin(result) { setClientAuth(result.csrfToken); await this.loadBootstrap(true); }
    endSession(message = '') { setClientAuth(''); this.setState({ authPhase: 'login', bootstrap: null, loading: false, error: '' }); if (message)
        this.showToast(message, 'error'); }
    async logout() { try {
        await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' });
    }
    catch { } this.endSession(); }
    changed() { this.setState({ refreshToken: this.state.refreshToken + 1 }, () => this.loadBootstrap()); }
    showToast(message, kind = 'default', actionLabel, action) { if (this.toastTimer)
        window.clearTimeout(this.toastTimer); this.setState({ toast: { message, kind, actionLabel, action } }); this.toastTimer = window.setTimeout(() => this.setState({ toast: null }), action ? 6500 : 3200); }
    applyMotion(reduce) { document.body.classList.toggle('reduce-motion', reduce); if (reduce)
        clearMotionRegistry();
    else
        schedulePageMotion(); }
    changeMotion(reduce) { localStorage.setItem('yupao-reduce-motion', String(reduce)); this.applyMotion(reduce); this.setState({ reduceMotion: reduce }); }
    renderPage() {
        const common = { bootstrap: this.state.bootstrap, month: this.state.month, refreshToken: this.state.refreshToken, navigate: (route) => this.navigate(route), onChanged: () => this.changed(), onError: (message) => this.showToast(message, 'error'), onToast: (message, kind, actionLabel, action) => this.showToast(message, kind, actionLabel, action) };
        switch (this.state.route) {
            case 'transactions': return React.createElement(TransactionsPage, { ...common });
            case 'add': return React.createElement(AddPage, { ...common });
            case 'invoices': return React.createElement(InvoicesPage, { ...common });
            case 'stats': return React.createElement(StatsPage, { ...common });
            case 'accounts': return React.createElement(AccountsPage, { ...common });
            case 'budgets': return React.createElement(BudgetsPage, { ...common });
            case 'settings': return React.createElement(SettingsPage, { ...common, reduceMotion: this.state.reduceMotion, onMotionChange: (value) => this.changeMotion(value), onLogout: () => this.logout() });
            default: return React.createElement(DashboardPage, { ...common, onMonthChange: (month) => this.setState({ month }, () => this.changed()) });
        }
    }
    render() {
        var _a;
        const phase = this.state.authPhase;
        if (phase === 'checking')
            return React.createElement(LoadingPage, null);
        if (phase === 'config')
            return React.createElement(AuthConfigurationPage, { status: this.state.setupStatus, onRetry: () => this.initializeAuth() });
        if (phase === 'setup')
            return React.createElement(SetupPage, { passwordIterations: ((_a = this.state.setupStatus) === null || _a === void 0 ? void 0 : _a.passwordIterations) || 120000, onComplete: () => this.setState({ authPhase: 'login' }) });
        if (phase === 'recover')
            return React.createElement(RecoverPage, { onBack: () => this.setState({ authPhase: 'login' }) });
        if (phase === 'login')
            return React.createElement(LoginPage, { onLogin: (result) => this.handleLogin(result), onRecover: () => this.setState({ authPhase: 'recover' }) });
        if (phase === 'error' || (this.state.error && !this.state.bootstrap))
            return React.createElement("div", { className: "loading-page" },
                React.createElement("div", null,
                    React.createElement("div", { style: { width: '240px' } },
                        React.createElement(Mascot, { variant: "empty" })),
                    React.createElement("h2", null, "\u5C0F\u8D26\u672C\u6682\u65F6\u6253\u4E0D\u5F00"),
                    React.createElement("p", { style: { color: 'var(--text-2)' } }, this.state.error),
                    React.createElement("button", { className: "btn btn-primary", onClick: () => this.initializeAuth() }, "\u518D\u8BD5\u4E00\u6B21")));
        if (this.state.loading && !this.state.bootstrap)
            return React.createElement(LoadingPage, null);
        const bootstrap = this.state.bootstrap;
        const toast = this.state.toast;
        return React.createElement("div", { className: "app-shell" },
            !this.state.online ? React.createElement("div", { className: "offline-banner" }, "\u73B0\u5728\u6CA1\u6709\u7F51\u7EDC\uFF0C\u8FDE\u4E0A\u540E\u518D\u8BB0\u8D26\u5427\u3002") : null,
            React.createElement("aside", { className: "sidebar" },
                React.createElement("a", { className: "brand", href: "#/home" },
                    React.createElement("span", { className: "brand-mark" },
                        React.createElement(LogoMark, null)),
                    React.createElement("span", { className: "brand-copy" },
                        React.createElement("strong", null, "\u828B\u70AE\u5C0F\u8D26\u672C"),
                        React.createElement("span", null, "\u4E24\u4E2A\u4EBA\u7684\u5C0F\u65E5\u5B50"))),
                React.createElement("nav", { className: "nav-list" }, ROUTES.map((route) => React.createElement("button", { key: route.key, className: cn('nav-item', this.state.route === route.key && 'active'), onClick: () => this.navigate(route.key) },
                    React.createElement(Icon, { name: route.icon }),
                    React.createElement("span", null, route.label)))),
                React.createElement("div", { className: "sidebar-bottom" },
                    React.createElement("div", { className: "member-pill" },
                        React.createElement("div", { className: "avatar" }, bootstrap.user.displayName.slice(0, 1)),
                        React.createElement("div", null,
                            React.createElement("strong", null, bootstrap.user.displayName),
                            React.createElement("small", null, bootstrap.household.name))))),
            React.createElement("header", { className: "mobile-topbar" },
                React.createElement("div", { className: "mobile-brand" },
                    React.createElement(LogoMark, null),
                    React.createElement("span", null, "\u828B\u70AE\u5C0F\u8D26\u672C")),
                React.createElement("button", { className: "avatar avatar-button", type: "button", onClick: () => this.navigate('settings'), "aria-label": "\u6253\u5F00\u8BBE\u7F6E" }, bootstrap.user.displayName.slice(0, 1))),
            React.createElement("main", { className: "main" }, this.renderPage()),
            React.createElement("nav", { className: "bottom-nav" }, ROUTES.filter((route) => route.mobile).map((route) => React.createElement("button", { key: route.key, className: cn(this.state.route === route.key && 'active', route.key === 'add' && 'center'), onClick: () => this.navigate(route.key) },
                route.key === 'add' ? React.createElement("span", { className: "nav-icon-wrap" },
                    React.createElement(Icon, { name: route.icon })) : React.createElement(Icon, { name: route.icon }),
                React.createElement("span", null, route.label)))),
            toast ? React.createElement("div", { className: cn('toast', toast.kind) },
                React.createElement("span", null, toast.message),
                toast.action ? React.createElement("button", { onClick: () => { toast.action && toast.action(); this.setState({ toast: null }); } }, toast.actionLabel || '操作') : null) : null);
    }
}
ReactDOM.render(React.createElement(App, null), document.getElementById('root'));
//# sourceMappingURL=app.js.map