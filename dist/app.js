"use strict";
/* global React, ReactDOM */
const ROUTES = [
    { key: 'home', label: '首页', icon: 'home', mobile: true },
    { key: 'transactions', label: '明细', icon: 'list', mobile: true },
    { key: 'add', label: '记一笔', icon: 'plus', mobile: true },
    { key: 'stats', label: '统计', icon: 'chart', mobile: true },
    { key: 'accounts', label: '账户', icon: 'wallet', mobile: false },
    { key: 'budgets', label: '预算', icon: 'target', mobile: false },
    { key: 'settings', label: '设置', icon: 'settings', mobile: true },
];
const CATEGORY_EMOJI = {
    bowl: '🍜', basket: '🥬', cup: '🧋', bag: '🧴', car: '🚗', home: '🏠', bolt: '💡', paw: '🐾',
    shopping: '🛍️', game: '🎮', medical: '🩹', plane: '✈️', gift: '🎁', dots: '✨', wallet: '💰',
    star: '⭐', receipt: '🧾', briefcase: '💼', store: '🏪', trend: '📈', cash: '💵', wechat: '💬',
    alipay: '🔵', card: '💳', bank: '🏦', credit: '💳', stored: '🎫', other: '🧺',
};
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
    const response = await fetch(path, {
        credentials: 'same-origin',
        headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(options.headers || {}) },
        ...options,
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
        throw error;
    }
    return payload.data;
}
function registerServiceWorker(onUpdate) {
    if (!('serviceWorker' in navigator))
        return;
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
function LogoMark() {
    return React.createElement("svg", { viewBox: "0 0 64 64", width: "44", height: "44", "aria-hidden": "true" },
        React.createElement("rect", { width: "64", height: "64", rx: "18", fill: "#FFF8F1" }),
        React.createElement("ellipse", { cx: "25", cy: "35", rx: "15", ry: "18", fill: "#9D89DF" }),
        React.createElement("path", { d: "M20 18c3-8 9-9 12-4-5 0-8 2-12 4Z", fill: "#77B98D" }),
        React.createElement("circle", { cx: "21", cy: "34", r: "2", fill: "#302A39" }),
        React.createElement("circle", { cx: "29", cy: "34", r: "2", fill: "#302A39" }),
        React.createElement("path", { d: "M22 41c2 2 5 2 7 0", stroke: "#302A39", strokeWidth: "2", fill: "none", strokeLinecap: "round" }),
        React.createElement("rect", { x: "38", y: "31", width: "15", height: "12", rx: "6", fill: "#F1A476" }),
        React.createElement("rect", { x: "48", y: "25", width: "10", height: "7", rx: "3.5", fill: "#E78D65" }),
        React.createElement("circle", { cx: "43", cy: "47", r: "4", fill: "#6E667A" }),
        React.createElement("circle", { cx: "51", cy: "47", r: "4", fill: "#6E667A" }));
}
function Mascot(props) {
    const variant = props.variant || 'idle';
    return React.createElement("svg", { className: cn('mascot', variant), viewBox: "0 0 340 220", role: "img", "aria-label": props.label || '芋头和小炮台' },
        React.createElement("ellipse", { cx: "164", cy: "198", rx: "116", ry: "14", fill: "#E7DDE9", opacity: ".55" }),
        React.createElement("g", { className: "taro-body" },
            React.createElement("path", { d: "M103 63c-10 17-17 44-12 74 7 42 31 68 68 68 38 0 63-25 70-66 5-31-3-61-16-78-20-25-87-24-110 2Z", fill: "#9D89DF" }),
            React.createElement("path", { d: "M111 69c19-14 78-17 101 2", fill: "none", stroke: "#B6A7EA", strokeWidth: "9", strokeLinecap: "round", opacity: ".85" }),
            React.createElement("path", { d: "M101 121c8 9 11 28 8 46", fill: "none", stroke: "#8872CD", strokeWidth: "5", strokeLinecap: "round", opacity: ".65" }),
            React.createElement("path", { d: "M215 119c-7 11-9 28-6 43", fill: "none", stroke: "#8872CD", strokeWidth: "5", strokeLinecap: "round", opacity: ".65" }),
            React.createElement("g", { className: "leaf" },
                React.createElement("path", { d: "M142 65c-17-26-10-46 6-50 10 14 11 31-6 50Z", fill: "#68A77A" }),
                React.createElement("path", { d: "M156 62c5-31 25-41 39-31-1 18-13 30-39 31Z", fill: "#7BBE91" })),
            React.createElement("g", { className: "eye" },
                React.createElement("circle", { cx: "139", cy: "123", r: "5", fill: "#302A39" }),
                React.createElement("circle", { cx: "181", cy: "123", r: "5", fill: "#302A39" })),
            React.createElement("path", { d: "M146 146c9 9 22 9 31 0", fill: "none", stroke: "#302A39", strokeWidth: "4", strokeLinecap: "round" }),
            React.createElement("ellipse", { cx: "121", cy: "141", rx: "11", ry: "6", fill: "#D59ACB", opacity: ".55" }),
            React.createElement("ellipse", { cx: "200", cy: "141", rx: "11", ry: "6", fill: "#D59ACB", opacity: ".55" }),
            React.createElement("path", { d: "M111 167c-12 5-17 16-11 25", fill: "none", stroke: "#7A66C0", strokeWidth: "8", strokeLinecap: "round" }),
            React.createElement("path", { d: "M211 166c12 4 18 14 13 24", fill: "none", stroke: "#7A66C0", strokeWidth: "8", strokeLinecap: "round" })),
        React.createElement("g", { className: "cannon" },
            React.createElement("rect", { x: "224", y: "124", width: "72", height: "44", rx: "19", fill: "#F1A476" }),
            React.createElement("rect", { x: "275", y: "102", width: "50", height: "27", rx: "13.5", fill: "#E78D65", transform: "rotate(-8 275 102)" }),
            React.createElement("circle", { cx: "246", cy: "173", r: "18", fill: "#6E667A" }),
            React.createElement("circle", { cx: "285", cy: "173", r: "18", fill: "#6E667A" }),
            React.createElement("circle", { cx: "246", cy: "173", r: "8", fill: "#B6AEC0" }),
            React.createElement("circle", { cx: "285", cy: "173", r: "8", fill: "#B6AEC0" }),
            React.createElement("circle", { cx: "248", cy: "142", r: "4", fill: "#302A39" }),
            React.createElement("circle", { cx: "268", cy: "142", r: "4", fill: "#302A39" }),
            React.createElement("path", { d: "M252 154c5 4 10 4 14 0", fill: "none", stroke: "#302A39", strokeWidth: "3", strokeLinecap: "round" }),
            React.createElement("circle", { className: "coin", cx: "316", cy: "99", r: "10", fill: "#F3C969" }),
            React.createElement("path", { className: "coin", d: "M317 94v10M313 97h7M313 101h7", stroke: "#9A711F", strokeWidth: "1.5" }),
            React.createElement("circle", { className: "coin", cx: "300", cy: "79", r: "7", fill: "#F3C969" })));
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
                item.type === 'transfer' ? React.createElement("span", { className: "tag" }, "\u8F6C\u8D26") : null),
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
    const items = (props.items || []).slice(0, 7);
    const total = items.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);
    if (!items.length || !total)
        return React.createElement(EmptyState, { title: "\u5206\u7C7B\u8FD8\u662F\u7A7A\u7684", message: "\u672C\u6708\u6709\u652F\u51FA\u540E\uFF0C\u8FD9\u91CC\u4F1A\u663E\u793A\u94B1\u90FD\u82B1\u53BB\u4E86\u54EA\u91CC\u3002" });
    const radius = 55, circumference = 2 * Math.PI * radius;
    let offset = 0;
    return React.createElement("div", { className: "donut-layout" },
        React.createElement("svg", { className: "chart-svg", viewBox: "0 0 170 170", role: "img", "aria-label": "\u652F\u51FA\u5206\u7C7B\u5360\u6BD4" },
            React.createElement("circle", { cx: "85", cy: "85", r: radius, fill: "none", stroke: "#F2EDF3", strokeWidth: "22" }),
            items.map((item) => {
                const value = Number(item.amount_cents || 0);
                const length = value / total * circumference;
                const current = offset;
                offset += length;
                return React.createElement("circle", { key: item.category_id || item.name, cx: "85", cy: "85", r: radius, fill: "none", stroke: item.color, strokeWidth: "22", strokeLinecap: "butt", strokeDasharray: `${length} ${circumference - length}`, strokeDashoffset: -current, transform: "rotate(-90 85 85)", style: { transition: 'stroke-dasharray .5s ease' } },
                    React.createElement("title", null, `${item.name} ${formatMoney(value)}`));
            }),
            React.createElement("text", { className: "donut-center", x: "85", y: "80", textAnchor: "middle" }, "\u672C\u6708\u652F\u51FA"),
            React.createElement("text", { x: "85", y: "101", textAnchor: "middle", fill: "#302A39", fontSize: "13", fontWeight: "800" }, formatCompactMoney(total))),
        React.createElement("div", { className: "category-ranking" }, items.map((item) => React.createElement("div", { className: "rank-row", key: item.category_id || item.name },
            React.createElement("div", { className: "rank-icon", style: { background: `${item.color}22` } }, CATEGORY_EMOJI[item.icon] || '✨'),
            React.createElement("div", { className: "rank-info" },
                React.createElement("div", { className: "rank-name" },
                    React.createElement("span", null, item.name),
                    React.createElement("span", null,
                        Math.round(item.amount_cents / total * 100),
                        "%")),
                React.createElement("div", { className: "rank-bar" },
                    React.createElement("span", { style: { width: `${item.amount_cents / total * 100}%`, background: item.color } }))),
            React.createElement("strong", null, formatCompactMoney(item.amount_cents))))));
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
class DashboardPage extends React.Component {
    constructor(props) { super(props); this.state = { loading: true, overview: null, trend: [], categories: [], budgets: [] }; }
    componentDidMount() { this.load(); }
    componentDidUpdate(prevProps) { if (prevProps.month !== this.props.month || prevProps.refreshToken !== this.props.refreshToken)
        this.load(); }
    async load() {
        this.setState({ loading: true });
        try {
            const month = this.props.month;
            const [overview, trend, categories, budgets] = await Promise.all([
                apiRequest(`/api/stats/overview?month=${month}`), apiRequest(`/api/stats/trend?month=${month}`),
                apiRequest(`/api/stats/category-breakdown?month=${month}`), apiRequest(`/api/stats/budget-progress?month=${month}`),
            ]);
            this.setState({ loading: false, overview, trend: trend.items, categories: categories.items, budgets: budgets.items });
        }
        catch (error) {
            this.setState({ loading: false });
            this.props.onError(error.message);
        }
    }
    render() {
        if (this.state.loading || !this.state.overview)
            return React.createElement(LoadingPage, null);
        const data = this.state.overview;
        const userName = this.props.bootstrap.user.displayName;
        const hour = new Date().getHours();
        const greeting = hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
        const budgetPercent = safePercent(data.budgetUsedCents, data.budgetCents);
        return React.createElement("div", { className: "page" },
            React.createElement(PageHeader, { title: `${greeting}，${userName}`, subtitle: "\u4E24\u4E2A\u4EBA\u7684\u5C0F\u65E5\u5B50\uFF0C\u90FD\u8BB0\u5728\u8FD9\u91CC\u3002" },
                React.createElement(MonthSwitcher, { month: this.props.month, onChange: this.props.onMonthChange }),
                React.createElement("button", { className: "icon-btn", onClick: () => this.load(), title: "\u5237\u65B0" },
                    React.createElement(Icon, { name: "refresh", size: 18 }))),
            React.createElement("section", { className: "hero-card card" },
                React.createElement("div", { className: "hero-copy" },
                    React.createElement("span", { className: "hero-kicker" },
                        monthLabel(this.props.month),
                        "\u7684\u5C0F\u8D26"),
                    React.createElement("h2", null, data.expenseCents > 0 ? '这个月的生活，已经有迹可循啦' : '先记下这个月的第一笔吧'),
                    React.createElement("p", null, data.expenseCents > 0 ? `目前支出 ${formatMoney(data.expenseCents)}，结余 ${formatMoney(data.balanceCents)}。慢慢记，不用一次做得很复杂。` : '从一杯饮料、一顿饭开始，小账本会慢慢长成你们的生活地图。'),
                    React.createElement("div", { className: "hero-actions" },
                        React.createElement("button", { className: "btn btn-primary", onClick: () => this.props.navigate('add') },
                            React.createElement(Icon, { name: "plus", size: 18 }),
                            "\u8BB0\u4E00\u7B14"),
                        React.createElement("button", { className: "btn btn-secondary", onClick: () => this.props.navigate('transactions') }, "\u770B\u770B\u660E\u7EC6"))),
                React.createElement("div", { className: "hero-mascot" },
                    React.createElement(Mascot, { variant: data.budgetCents > 0 && budgetPercent >= 90 ? 'warning' : 'idle' }))),
            React.createElement("section", { className: "grid grid-4", style: { marginTop: '18px' } },
                React.createElement("article", { className: "card summary-card summary-income" },
                    React.createElement("span", { className: "summary-label" }, "\u672C\u6708\u6536\u5165"),
                    React.createElement("span", { className: "summary-value" },
                        React.createElement(AnimatedNumber, { value: data.incomeCents }, (value) => formatMoney(value))),
                    React.createElement("div", { className: "summary-note" },
                        "\u4E0A\u6708 ",
                        formatCompactMoney(data.previousIncomeCents))),
                React.createElement("article", { className: "card summary-card summary-expense" },
                    React.createElement("span", { className: "summary-label" }, "\u672C\u6708\u652F\u51FA"),
                    React.createElement("span", { className: "summary-value" },
                        React.createElement(AnimatedNumber, { value: data.expenseCents }, (value) => formatMoney(value))),
                    React.createElement("div", { className: "summary-note" },
                        "\u4E0A\u6708 ",
                        formatCompactMoney(data.previousExpenseCents))),
                React.createElement("article", { className: "card summary-card summary-balance" },
                    React.createElement("span", { className: "summary-label" }, "\u672C\u6708\u7ED3\u4F59"),
                    React.createElement("span", { className: "summary-value" },
                        React.createElement(AnimatedNumber, { value: data.balanceCents }, (value) => formatMoney(value))),
                    React.createElement("div", { className: "summary-note" }, "\u6536\u5165\u51CF\u53BB\u652F\u51FA")),
                React.createElement("article", { className: "card summary-card summary-assets" },
                    React.createElement("span", { className: "summary-label" }, "\u8D26\u6237\u5408\u8BA1"),
                    React.createElement("span", { className: "summary-value" },
                        React.createElement(AnimatedNumber, { value: data.totalBalanceCents }, (value) => formatMoney(value))),
                    React.createElement("div", { className: "summary-note" },
                        "\u5171 ",
                        data.accounts.length,
                        " \u4E2A\u4F7F\u7528\u4E2D\u8D26\u6237"))),
            React.createElement("div", { className: "dashboard-grid" },
                React.createElement("div", { className: "stack" },
                    React.createElement("section", { className: "card card-pad" },
                        React.createElement("div", { className: "card-title-row" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "card-title" }, "\u672C\u6708\u6536\u652F\u8D8B\u52BF"),
                                React.createElement("p", { className: "card-subtitle" }, "\u6BCF\u5929\u7684\u6536\u5165\u548C\u652F\u51FA\u53D8\u5316")),
                            React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => this.props.navigate('stats') }, "\u5B8C\u6574\u7EDF\u8BA1")),
                        React.createElement(TrendChart, { items: this.state.trend })),
                    React.createElement("section", { className: "card card-pad" },
                        React.createElement("div", { className: "card-title-row" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "card-title" }, "\u6700\u8FD1\u8BB0\u5F55"),
                                React.createElement("p", { className: "card-subtitle" }, "\u6700\u65B0\u7684\u516D\u7B14\u5C0F\u8D26")),
                            React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => this.props.navigate('transactions') }, "\u5168\u90E8\u660E\u7EC6")),
                        data.recent.length ? React.createElement("div", { className: "list" }, data.recent.map((item, index) => React.createElement(TransactionItem, { key: item.id, item: item, index: index }))) : React.createElement(EmptyState, { title: "\u8FD9\u91CC\u8FD8\u6CA1\u6709\u8BB0\u5F55", message: "\u4ECA\u5929\u53D1\u751F\u7684\u7B2C\u4E00\u7B14\u5C0F\u4E8B\uFF0C\u53EF\u4EE5\u4ECE\u8FD9\u91CC\u5F00\u59CB\u3002", action: React.createElement("button", { className: "btn btn-primary", onClick: () => this.props.navigate('add') }, "\u8BB0\u7B2C\u4E00\u7B14") }))),
                React.createElement("div", { className: "stack" },
                    React.createElement("section", { className: "card card-pad" },
                        React.createElement("div", { className: "card-title-row" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "card-title" }, "\u94B1\u82B1\u53BB\u4E86\u54EA\u91CC"),
                                React.createElement("p", { className: "card-subtitle" }, "\u672C\u6708\u652F\u51FA\u5206\u7C7B"))),
                        React.createElement(DonutChart, { items: this.state.categories })),
                    React.createElement("section", { className: "card card-pad" },
                        React.createElement("div", { className: "card-title-row" },
                            React.createElement("div", null,
                                React.createElement("h3", { className: "card-title" }, "\u9884\u7B97\u8FDB\u5EA6"),
                                React.createElement("p", { className: "card-subtitle" }, "\u63A7\u5236\u8282\u594F\uFF0C\u4E0D\u7528\u7ED9\u81EA\u5DF1\u538B\u529B")),
                            React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => this.props.navigate('budgets') }, "\u7BA1\u7406\u9884\u7B97")),
                        data.budgetCents > 0 ? React.createElement("div", { style: { marginBottom: '16px' } },
                            React.createElement("div", { className: "budget-top" },
                                React.createElement("span", null, "\u603B\u9884\u7B97"),
                                React.createElement("strong", null,
                                    formatCompactMoney(data.budgetUsedCents),
                                    " / ",
                                    formatCompactMoney(data.budgetCents))),
                            React.createElement("div", { className: "progress-track" },
                                React.createElement("div", { className: cn('progress-fill', budgetPercent >= 100 ? 'over' : budgetPercent >= 80 ? 'notice' : 'normal'), style: { width: `${Math.max(2, budgetPercent)}%` } }))) : null,
                        React.createElement(BudgetProgressList, { items: this.state.budgets, onSetup: () => this.props.navigate('budgets') })))));
    }
}
class TransactionForm extends React.Component {
    constructor(props) {
        var _a, _b;
        super(props);
        const initial = props.initial || {};
        this.state = {
            type: initial.type || 'expense', amount: initial.amount_cents ? (initial.amount_cents / 100).toFixed(2) : '',
            accountId: initial.account_id || ((_a = props.bootstrap.accounts[0]) === null || _a === void 0 ? void 0 : _a.id) || '', targetAccountId: initial.target_account_id || ((_b = props.bootstrap.accounts[1]) === null || _b === void 0 ? void 0 : _b.id) || '',
            categoryId: initial.category_id || '', occurredAt: initial.occurred_at ? initial.occurred_at.slice(0, 10) : today(),
            merchant: initial.merchant || '', note: initial.note || '', submitting: false, error: '',
        };
    }
    categories() { return this.props.bootstrap.categories.filter((item) => item.type === this.state.type && !item.is_archived); }
    componentDidMount() { if (!this.state.categoryId && this.categories()[0])
        this.setState({ categoryId: this.categories()[0].id }); }
    setType(type) {
        const category = this.props.bootstrap.categories.find((item) => item.type === type && !item.is_archived);
        this.setState({ type, categoryId: type === 'transfer' ? '' : (category === null || category === void 0 ? void 0 : category.id) || '' });
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
            occurredAt: this.state.occurredAt, merchant: this.state.merchant, note: this.state.note,
            ...(this.props.initial ? { version: this.props.initial.version } : {}),
        };
        try {
            const path = this.props.initial ? `/api/transactions/${this.props.initial.id}` : '/api/transactions';
            const saved = await apiRequest(path, { method: this.props.initial ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
            this.setState({ submitting: false });
            this.props.onSuccess(saved, this.state.type);
        }
        catch (error) {
            this.setState({ submitting: false, error: error.message || '保存失败，请稍后再试' });
        }
    }
    render() {
        const categories = this.categories();
        return React.createElement("form", { onSubmit: (event) => this.submit(event) },
            React.createElement("div", { className: "type-switch" },
                React.createElement("button", { type: "button", className: cn(this.state.type === 'expense' && 'active expense'), onClick: () => this.setType('expense') }, "\u652F\u51FA"),
                React.createElement("button", { type: "button", className: cn(this.state.type === 'income' && 'active income'), onClick: () => this.setType('income') }, "\u6536\u5165"),
                React.createElement("button", { type: "button", className: cn(this.state.type === 'transfer' && 'active transfer'), onClick: () => this.setType('transfer') }, "\u8F6C\u8D26")),
            React.createElement("div", { className: "amount-field" },
                React.createElement("div", { className: "amount-input-wrap" },
                    React.createElement("span", { className: "currency-symbol" }, "\u00A5"),
                    React.createElement("input", { className: "amount-input", inputMode: "decimal", autoFocus: !this.props.initial, placeholder: "0.00", value: this.state.amount, onChange: (event) => this.setState({ amount: event.target.value.replace(/[^\d.]/g, '').replace(/(\.\d{2}).+$/, '$1') }) }))),
            this.state.type !== 'transfer' ? React.createElement("div", { className: "field form-span", style: { marginBottom: '15px' } },
                React.createElement("label", null, "\u5206\u7C7B"),
                React.createElement("div", { className: "category-grid" }, categories.map((item) => React.createElement("button", { type: "button", key: item.id, className: cn('category-chip', this.state.categoryId === item.id && 'active'), onClick: () => this.setState({ categoryId: item.id }) },
                    React.createElement("span", { className: "emoji" }, CATEGORY_EMOJI[item.icon] || '✨'),
                    React.createElement("span", null, item.name))))) : null,
            React.createElement("div", { className: "form-grid" },
                React.createElement("div", { className: "field" },
                    React.createElement("label", null, this.state.type === 'transfer' ? '转出账户' : '账户'),
                    React.createElement("select", { className: "select", value: this.state.accountId, onChange: (event) => this.setState({ accountId: event.target.value }) }, this.props.bootstrap.accounts.map((item) => React.createElement("option", { key: item.id, value: item.id }, item.name)))),
                this.state.type === 'transfer' ? React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u8F6C\u5165\u8D26\u6237"),
                    React.createElement("select", { className: "select", value: this.state.targetAccountId, onChange: (event) => this.setState({ targetAccountId: event.target.value }) }, this.props.bootstrap.accounts.filter((item) => item.id !== this.state.accountId).map((item) => React.createElement("option", { key: item.id, value: item.id }, item.name)))) : React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u65E5\u671F"),
                    React.createElement("input", { className: "input", type: "date", value: this.state.occurredAt, onChange: (event) => this.setState({ occurredAt: event.target.value }) })),
                this.state.type === 'transfer' ? React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u65E5\u671F"),
                    React.createElement("input", { className: "input", type: "date", value: this.state.occurredAt, onChange: (event) => this.setState({ occurredAt: event.target.value }) })) : React.createElement("div", { className: "field" },
                    React.createElement("label", null, "\u5546\u6237/\u6765\u6E90\uFF08\u53EF\u9009\uFF09"),
                    React.createElement("input", { className: "input", maxLength: 80, placeholder: this.state.type === 'income' ? '例如：公司、客户' : '例如：超市、餐厅', value: this.state.merchant, onChange: (event) => this.setState({ merchant: event.target.value }) })),
                React.createElement("div", { className: cn('field', this.state.type !== 'transfer' && 'form-span') },
                    React.createElement("label", null, "\u5907\u6CE8\uFF08\u53EF\u9009\uFF09"),
                    React.createElement("textarea", { className: "textarea", maxLength: 300, placeholder: "\u7B80\u5355\u8BB0\u4E00\u4E0B\u8FD9\u7B14\u94B1\u7684\u7528\u9014", value: this.state.note, onChange: (event) => this.setState({ note: event.target.value }) }))),
            this.state.error ? React.createElement("p", { className: "error-text" }, this.state.error) : null,
            React.createElement("div", { className: "form-actions" },
                this.props.onCancel ? React.createElement("button", { type: "button", className: "btn btn-ghost", onClick: this.props.onCancel }, "\u53D6\u6D88") : null,
                React.createElement("button", { className: "btn btn-primary", type: "submit", disabled: this.state.submitting }, this.state.submitting ? '正在保存…' : this.props.initial ? '保存修改' : '收进小账本')));
    }
}
class AddPage extends React.Component {
    constructor(props) { super(props); this.state = { success: false, savedType: 'expense' }; }
    render() {
        return React.createElement("div", { className: "page" },
            React.createElement(PageHeader, { title: "\u8BB0\u4E00\u7B14", subtitle: "\u4E0D\u7528\u586B\u5F97\u5F88\u590D\u6742\uFF0C\u5148\u628A\u91CD\u8981\u7684\u8BB0\u4E0B\u6765\u3002" }),
            React.createElement("section", { className: "card card-pad", style: { maxWidth: '820px', margin: '0 auto' } },
                React.createElement(TransactionForm, { bootstrap: this.props.bootstrap, onSuccess: (_, type) => { this.setState({ success: true, savedType: type }); this.props.onChanged(); window.setTimeout(() => { this.setState({ success: false }); this.props.navigate('home'); }, 1350); } })),
            this.state.success ? React.createElement("div", { className: "success-overlay" },
                React.createElement("div", { className: "success-box" },
                    React.createElement(Mascot, { variant: "success" }),
                    React.createElement("h2", null, "\u8FD9\u7B14\u8BB0\u597D\u5566"),
                    React.createElement("p", null, this.state.savedType === 'income' ? '收入已经放进小账本' : this.state.savedType === 'transfer' ? '转账已经同步到两个账户' : '今天也有认真记录生活'))) : null);
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
        return React.createElement("div", { className: "page" },
            React.createElement(PageHeader, { title: "\u6536\u652F\u660E\u7EC6", subtitle: "\u6309\u6708\u4EFD\u3001\u7C7B\u578B\u6216\u8D26\u6237\u67E5\u627E\u6BCF\u4E00\u7B14\u8BB0\u5F55\u3002" },
                React.createElement(MonthSwitcher, { month: this.state.month, onChange: (month) => this.changeFilter({ month }) }),
                React.createElement("button", { className: "btn btn-primary", onClick: () => this.props.navigate('add') },
                    React.createElement(Icon, { name: "plus", size: 18 }),
                    React.createElement("span", { className: "btn-label" }, "\u8BB0\u4E00\u7B14"))),
            React.createElement("section", { className: "card card-pad" },
                React.createElement("div", { className: "filter-bar" },
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
                    React.createElement("button", { className: "btn btn-secondary", onClick: () => this.load() }, "\u641C\u7D22")),
                React.createElement("div", { className: "card-title-row" },
                    React.createElement("div", null,
                        React.createElement("h3", { className: "card-title" }, monthLabel(this.state.month)),
                        React.createElement("p", { className: "card-subtitle" },
                            "\u5171 ",
                            this.state.total,
                            " \u7B14\u8BB0\u5F55"))),
                this.state.loading ? React.createElement("div", { className: "stack" },
                    React.createElement("div", { className: "skeleton", style: { height: '68px' } }),
                    React.createElement("div", { className: "skeleton", style: { height: '68px' } }),
                    React.createElement("div", { className: "skeleton", style: { height: '68px' } })) : this.state.items.length ? React.createElement("div", { className: "list" }, this.state.items.map((item, index) => React.createElement(TransactionItem, { key: item.id, item: item, index: index, editable: true, onEdit: (entry) => this.setState({ edit: entry }), onDelete: (entry) => this.remove(entry) }))) : React.createElement(EmptyState, { title: "\u6CA1\u6709\u627E\u5230\u8BB0\u5F55", message: "\u6362\u4E2A\u7B5B\u9009\u6761\u4EF6\uFF0C\u6216\u8005\u8BB0\u4E0B\u65B0\u7684\u4E00\u7B14\u3002", action: React.createElement("button", { className: "btn btn-primary", onClick: () => this.props.navigate('add') }, "\u8BB0\u4E00\u7B14") })),
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
        return React.createElement("div", { className: "page" },
            React.createElement(PageHeader, { title: "\u6536\u652F\u7EDF\u8BA1", subtitle: "\u4E0D\u7528\u76EF\u7740\u6BCF\u4E00\u7B14\uFF0C\u770B\u770B\u6574\u4F53\u8282\u594F\u5C31\u597D\u3002" },
                React.createElement(MonthSwitcher, { month: this.state.month, onChange: (month) => this.setState({ month }, () => this.load()) })),
            this.state.loading ? React.createElement(LoadingPage, null) : React.createElement("div", { className: "grid grid-2" },
                React.createElement("section", { className: "card card-pad form-span" },
                    React.createElement("div", { className: "card-title-row" },
                        React.createElement("div", null,
                            React.createElement("h3", { className: "card-title" }, "\u672C\u6708\u8D8B\u52BF"),
                            React.createElement("p", { className: "card-subtitle" }, "\u6BCF\u5929\u7684\u6536\u5165\u4E0E\u652F\u51FA"))),
                    React.createElement(TrendChart, { items: this.state.trend })),
                React.createElement("section", { className: "card card-pad" },
                    React.createElement("div", { className: "card-title-row" },
                        React.createElement("div", null,
                            React.createElement("h3", { className: "card-title" }, "\u652F\u51FA\u5206\u7C7B"),
                            React.createElement("p", { className: "card-subtitle" }, "\u94B1\u4E3B\u8981\u82B1\u5728\u4E86\u54EA\u91CC"))),
                    React.createElement(DonutChart, { items: this.state.categories })),
                React.createElement("section", { className: "card card-pad" },
                    React.createElement("div", { className: "card-title-row" },
                        React.createElement("div", null,
                            React.createElement("h3", { className: "card-title" }, "\u5206\u7C7B\u9884\u7B97"),
                            React.createElement("p", { className: "card-subtitle" }, "\u9884\u7B97\u4E0E\u5B9E\u9645\u652F\u51FA"))),
                    React.createElement(BudgetProgressList, { items: this.state.budgets, onSetup: () => this.props.navigate('budgets') })),
                React.createElement("section", { className: "card card-pad form-span" },
                    React.createElement("div", { className: "card-title-row" },
                        React.createElement("div", null,
                            React.createElement("h3", { className: "card-title" }, "\u8FD1\u516D\u4E2A\u6708"),
                            React.createElement("p", { className: "card-subtitle" }, "\u6536\u5165\u548C\u652F\u51FA\u7684\u6708\u5EA6\u53D8\u5316"))),
                    React.createElement(MonthlyBars, { items: this.state.months }))));
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
                        React.createElement("p", { className: "card-subtitle" }, "\u7248\u672C 0.1.0 \u00B7 \u52A8\u6001\u5168\u6808 PWA"))),
                React.createElement("p", { style: { color: 'var(--text-2)', lineHeight: 1.8, fontSize: '13px' } }, "\u4E00\u4E2A\u53EA\u7ED9\u4E24\u4E2A\u4EBA\u4F7F\u7528\u7684\u5C0F\u8D26\u672C\u3002\u6CA1\u6709\u5E7F\u544A\uFF0C\u4E0D\u63A5\u7B2C\u4E09\u65B9\u884C\u4E3A\u8FFD\u8E2A\uFF0C\u4E5F\u4E0D\u4F1A\u628A\u5B8C\u6574\u8D26\u672C\u957F\u671F\u7559\u5728\u6D4F\u89C8\u5668\u672C\u5730\u3002"),
                React.createElement("div", { style: { width: '230px', margin: '8px auto 0' } },
                    React.createElement(Mascot, { variant: "idle" }))),
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
        this.state = { route, bootstrap: null, loading: true, error: '', online: navigator.onLine, toast: null, month: currentMonth(), refreshToken: 0, reduceMotion };
        this.onHashChange = this.onHashChange.bind(this);
        this.onOnline = this.onOnline.bind(this);
        this.onOffline = this.onOffline.bind(this);
    }
    routeFromHash() {
        const value = location.hash.replace(/^#\/?/, '').split('/')[0];
        return ROUTES.some((route) => route.key === value) ? value : 'home';
    }
    componentDidMount() {
        window.addEventListener('hashchange', this.onHashChange);
        window.addEventListener('online', this.onOnline);
        window.addEventListener('offline', this.onOffline);
        this.applyMotion(this.state.reduceMotion);
        this.loadBootstrap();
        registerServiceWorker(() => this.showToast('小账本有新版本，刷新页面即可更新', 'default'));
    }
    componentWillUnmount() {
        window.removeEventListener('hashchange', this.onHashChange);
        window.removeEventListener('online', this.onOnline);
        window.removeEventListener('offline', this.onOffline);
    }
    onHashChange() { this.setState({ route: this.routeFromHash() }); window.scrollTo(0, 0); }
    onOnline() { this.setState({ online: true }); this.showToast('网络已经恢复', 'success'); }
    onOffline() { this.setState({ online: false }); }
    navigate(route) { location.hash = `#/${route}`; }
    async loadBootstrap() {
        this.setState({ loading: true, error: '' });
        try {
            const bootstrap = await apiRequest(`/api/bootstrap?month=${this.state.month}`);
            this.setState({ bootstrap, loading: false });
        }
        catch (error) {
            this.setState({ loading: false, error: error.message || '小账本暂时打不开' });
        }
    }
    changed() { this.setState({ refreshToken: this.state.refreshToken + 1 }, () => this.loadBootstrap()); }
    showToast(message, kind = 'default', actionLabel, action) {
        if (this.toastTimer)
            window.clearTimeout(this.toastTimer);
        this.setState({ toast: { message, kind, actionLabel, action } });
        this.toastTimer = window.setTimeout(() => this.setState({ toast: null }), action ? 6500 : 3200);
    }
    applyMotion(reduce) { document.body.classList.toggle('reduce-motion', reduce); }
    changeMotion(reduce) { localStorage.setItem('yupao-reduce-motion', String(reduce)); this.applyMotion(reduce); this.setState({ reduceMotion: reduce }); }
    renderPage() {
        const common = { bootstrap: this.state.bootstrap, month: this.state.month, refreshToken: this.state.refreshToken, navigate: (route) => this.navigate(route), onChanged: () => this.changed(), onError: (message) => this.showToast(message, 'error'), onToast: (message, kind, actionLabel, action) => this.showToast(message, kind, actionLabel, action) };
        switch (this.state.route) {
            case 'transactions': return React.createElement(TransactionsPage, { ...common });
            case 'add': return React.createElement(AddPage, { ...common });
            case 'stats': return React.createElement(StatsPage, { ...common });
            case 'accounts': return React.createElement(AccountsPage, { ...common });
            case 'budgets': return React.createElement(BudgetsPage, { ...common });
            case 'settings': return React.createElement(SettingsPage, { ...common, reduceMotion: this.state.reduceMotion, onMotionChange: (value) => this.changeMotion(value) });
            default: return React.createElement(DashboardPage, { ...common, onMonthChange: (month) => this.setState({ month }, () => this.changed()) });
        }
    }
    render() {
        if (this.state.loading && !this.state.bootstrap)
            return React.createElement(LoadingPage, null);
        if (this.state.error && !this.state.bootstrap)
            return React.createElement("div", { className: "loading-page" },
                React.createElement("div", null,
                    React.createElement("div", { style: { width: '240px' } },
                        React.createElement(Mascot, { variant: "empty" })),
                    React.createElement("h2", null, "\u5C0F\u8D26\u672C\u6682\u65F6\u6253\u4E0D\u5F00"),
                    React.createElement("p", { style: { color: 'var(--text-2)' } }, this.state.error),
                    React.createElement("button", { className: "btn btn-primary", onClick: () => this.loadBootstrap() }, "\u518D\u8BD5\u4E00\u6B21")));
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
                React.createElement("div", { className: "avatar" }, bootstrap.user.displayName.slice(0, 1))),
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