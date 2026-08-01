/* global React, ReactDOM */

type RouteKey = 'home' | 'transactions' | 'add' | 'invoices' | 'stats' | 'accounts' | 'budgets' | 'settings';
type TransactionType = 'expense' | 'income' | 'transfer';
type InvoiceType = 'received' | 'issued';

type Bootstrap = {
  user: { id: string; email: string; displayName: string; role: string };
  household: { id: string; name: string; baseCurrency: string; timezone: string };
  accounts: any[];
  categories: any[];
  budgets: any[];
  month: string;
};

type ToastState = {
  message: string;
  kind: 'default' | 'success' | 'error';
  actionLabel?: string;
  action?: () => void;
} | null;

type SetupStatus = { schemaReady: boolean; configured: boolean; secretsReady: boolean; setupTokenReady?: boolean; pepperReady?: boolean; passwordIterations?: number };
type PasswordParams = { salt: string; iterations: number };
type ClientCredential = { proof: string; salt: string; iterations: number };
type AuthUser = { id: string; email: string; displayName: string; role: string; householdName: string };

let currentCsrfToken = '';
const APP_VERSION = '0.3.2';
let authExpiredHandler: (() => void) | null = null;

function setClientAuth(csrfToken = ''): void {
  currentCsrfToken = csrfToken;
}

const ROUTES: Array<{ key: RouteKey; label: string; icon: string; mobile: boolean }> = [
  { key: 'home', label: '首页', icon: 'home', mobile: true },
  { key: 'transactions', label: '明细', icon: 'list', mobile: true },
  { key: 'add', label: '记一笔', icon: 'plus', mobile: true },
  { key: 'invoices', label: '发票', icon: 'invoice', mobile: true },
  { key: 'stats', label: '统计', icon: 'chart', mobile: true },
  { key: 'accounts', label: '账户', icon: 'wallet', mobile: false },
  { key: 'budgets', label: '预算', icon: 'target', mobile: false },
  { key: 'settings', label: '设置', icon: 'settings', mobile: false },
];

const CATEGORY_EMOJI: Record<string, string> = {
  bowl: '🍜', basket: '🥬', cup: '🧋', bag: '🧴', car: '🚗', home: '🏠', bolt: '💡', paw: '🐾',
  shopping: '🛍️', game: '🎮', medical: '🩹', plane: '✈️', gift: '🎁', dots: '✨', wallet: '💰',
  star: '⭐', receipt: '🧾', briefcase: '💼', store: '🏪', trend: '📈', cash: '💵', wechat: '💬',
  alipay: '🔵', card: '💳', bank: '🏦', credit: '💳', stored: '🎫', other: '🧺',
};

const WARM_CHART_COLORS = ['#F29AB5', '#B9D99A', '#AAB6C0', '#F5C77D', '#BDA8D8', '#9BCED4', '#E9A58F'];

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  cash: '现金', wechat: '微信', alipay: '支付宝', bank: '银行卡', credit: '信用卡', stored: '储值账户', other: '其他',
};

function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

function today(): string {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function currentMonth(): string {
  return today().slice(0, 7);
}

function shiftMonth(month: string, amount: number): string {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(year, number - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [year, number] = month.split('-');
  return `${year}年${Number(number)}月`;
}

function dateLabel(value: string): string {
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' }).format(date);
}

function compactDate(value: string): string {
  return value ? value.slice(5, 10).replace('-', '/') : '';
}

function centsToYuan(cents: number): number {
  return Number(cents || 0) / 100;
}

function formatMoney(cents: number, sign = false): string {
  const value = centsToYuan(cents);
  const prefix = sign && value > 0 ? '+' : '';
  return `${prefix}${new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(value)}`;
}

function formatCompactMoney(cents: number): string {
  const value = centsToYuan(cents);
  if (Math.abs(value) >= 10000) return `¥${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  return `¥${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 }).format(value)}`;
}

function moneyToCents(value: string): number {
  const normalized = value.replace(/,/g, '').trim();
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return 0;
  const [whole, decimals = ''] = normalized.split('.');
  return Number(whole) * 100 + Number((decimals + '00').slice(0, 2));
}

function safePercent(value: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.max(0, Math.min(100, (value / total) * 100));
}

function invoiceTypeLabel(type: InvoiceType): string { return type === 'received' ? '收到的发票' : '开出的发票'; }

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
  const angle = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

function describeDonutSlice(cx: number, cy: number, outerRadius: number, innerRadius: number, startAngle: number, endAngle: number): string {
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

function invoiceCounterpartyLabel(type: InvoiceType): string { return type === 'received' ? '开票方' : '客户名称'; }

function transactionTitle(item: any): string {
  if (item.type === 'transfer') return `${item.account_name || '账户'} → ${item.target_account_name || '账户'}`;
  return item.merchant || item.category_name || (item.type === 'income' ? '收入' : '支出');
}

function transactionMeta(item: any): string {
  const pieces = [dateLabel(item.occurred_at), item.account_name];
  if (item.note) pieces.push(item.note);
  if (item.creator_name) pieces.push(`${item.creator_name}记录`);
  return pieces.filter(Boolean).join(' · ');
}

async function apiRequest<T = any>(path: string, options: any = {}): Promise<T> {
  const method = String(options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = { 'x-yupao-client-version': APP_VERSION,
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...(options.headers || {}),
  };
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && currentCsrfToken) headers['x-csrf-token'] = currentCsrfToken;
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    method,
    headers,
  });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) throw new Error('请求失败，请稍后再试');
    return response as any;
  }
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    const error: any = new Error(payload.error?.message || '请求失败，请稍后再试');
    error.code = payload.error?.code;
    error.status = response.status;
    error.details = payload.error?.details;
    if (response.status === 401 && error.code === 'AUTH_REQUIRED' && authExpiredHandler) authExpiredHandler();
    throw error;
  }
  return payload.data as T;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function newPasswordSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function derivePasswordProof(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: base64UrlToBytes(salt), iterations }, key, 256);
  return bytesToBase64Url(new Uint8Array(bits));
}

async function fetchPasswordParams(email: string): Promise<PasswordParams> {
  return apiRequest<PasswordParams>('/api/auth/password-params', { method: 'POST', body: JSON.stringify({ email }) });
}

async function createClientCredential(password: string, iterations: number, salt = newPasswordSalt()): Promise<ClientCredential> {
  return { proof: await derivePasswordProof(password, salt, iterations), salt, iterations };
}

function passwordValidationMessage(password: string, email: string): string {
  if (password.length < 12 || password.length > 128) return '密码需要 12～128 个字符';
  if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) return '密码至少需要包含字母和数字';
  const prefix = email.trim().toLowerCase().split('@')[0] || '';
  if (prefix.length >= 4 && password.toLowerCase().includes(prefix)) return '密码不要包含邮箱名称';
  return '';
}

function registerServiceWorker(onUpdate: () => void): void {
  if (!('serviceWorker' in navigator)) return;
  let controllerChanged = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controllerChanged) return;
    controllerChanged = true;
    onUpdate();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((registration) => {
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) onUpdate();
        });
      });
    }).catch(() => undefined);
  });
}


type MotionHandle = Animation;
const motionRegistry: MotionHandle[] = [];

function motionDisabled(): boolean {
  return document.body.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clearMotionRegistry(): void {
  while (motionRegistry.length) motionRegistry.pop()?.cancel();
}

function playMotion(target: Element | null, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation | null {
  if (!target || motionDisabled() || typeof (target as HTMLElement).animate !== 'function') return null;
  const animation = (target as HTMLElement).animate(keyframes, options);
  motionRegistry.push(animation);
  return animation;
}

function runPageMotion(): void {
  clearMotionRegistry();
  if (motionDisabled()) return;
  const page = document.querySelector('.page');
  if (!page) return;
  const targets = Array.from(page.querySelectorAll('.hero-card, .summary-card, .dashboard-grid > .stack > section, .page-header'));
  targets.slice(0, 12).forEach((target, index) => {
    playMotion(target, [
      { opacity: 0, transform: 'translateY(12px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 360, delay: index * 38, easing: 'cubic-bezier(.2,.78,.2,1)', fill: 'both' });
  });

  const taro = page.querySelector('[data-mascot-motion="taro"]');
  const tank = page.querySelector('[data-mascot-motion="tank"]');
  playMotion(taro, [
    { transform: 'translateY(0) rotate(-1deg)' },
    { transform: 'translateY(-7px) rotate(2deg)' },
    { transform: 'translateY(0) rotate(-1deg)' },
  ], { duration: 3600, iterations: Infinity, easing: 'ease-in-out' });
  playMotion(tank, [
    { transform: 'translateY(0)' },
    { transform: 'translateY(-3px)' },
    { transform: 'translateY(0)' },
  ], { duration: 5200, delay: 400, iterations: Infinity, easing: 'ease-in-out' });
}

function schedulePageMotion(): void {
  window.requestAnimationFrame(() => window.requestAnimationFrame(runPageMotion));
}

function Icon(props: any): any {
  let content: any;
  switch (props.name) {
    case 'home': content = <path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z" />; break;
    case 'list': content = <g><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></g>; break;
    case 'plus': content = <path d="M12 5v14M5 12h14"/>; break;
    case 'chart': content = <g><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></g>; break;
    case 'wallet': content = <g><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H19a2 2 0 0 1 2 2v13H5.5A2.5 2.5 0 0 1 3 16.5z"/><path d="M16 10h6v5h-6a2.5 2.5 0 0 1 0-5Z"/><circle cx="17" cy="12.5" r=".7" fill="currentColor" stroke="none"/></g>; break;
    case 'invoice': content = <g><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 11h6M9 15h6M9 18h4"/><path d="M4 7v14h10"/></g>; break;
    case 'target': content = <g><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></g>; break;
    case 'settings': content = <g><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.2 19.3a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2v-4h.3A1.7 1.7 0 0 0 4 8.2a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.2 4a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V2h4v.3A1.7 1.7 0 0 0 15 4a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 8a1.7 1.7 0 0 0 .6 1 1.7 1.7 0 0 0 1.1.4h.9v4h-.9A1.7 1.7 0 0 0 19.4 15Z"/></g>; break;
    case 'chevron-left': content = <path d="m15 18-6-6 6-6"/>; break;
    case 'chevron-right': content = <path d="m9 18 6-6-6-6"/>; break;
    case 'refresh': content = <g><path d="M20 11a8 8 0 1 0 2 5"/><path d="M20 4v7h-7"/></g>; break;
    case 'search': content = <g><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></g>; break;
    case 'edit': content = <g><path d="M4 20h4l11-11-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></g>; break;
    case 'trash': content = <g><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/><path d="M10 11v6M14 11v6"/></g>; break;
    case 'download': content = <g><path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/></g>; break;
    case 'close': content = <path d="M6 6l12 12M18 6 6 18"/>; break;
    case 'eye': content = <g><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></g>; break;
    default: content = <circle cx="12" cy="12" r="8"/>;
  }
  return <svg className={props.className || 'nav-icon'} width={props.size || 22} height={props.size || 22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{content}</svg>;
}

function TaroCharacter(props: any = {}): any {
  const mode = props.mode || 'ledger';
  const showPencil = mode === 'quick' || mode === 'idle';
  const showLedger = mode === 'ledger' || mode === 'success' || mode === 'idle';
  const showPlus = mode === 'quick';
  return <svg className="mascot-svg taro-svg" viewBox="0 0 180 210" aria-hidden="true">
    <ellipse cx="90" cy="194" rx="52" ry="9" fill="#2D241E" opacity=".08"/>
    <path d="M91 34C62 33 39 62 38 106c-1 48 20 80 53 80s56-31 54-79c-2-45-24-72-54-73Z" fill="#9A78C7" stroke="#51405F" strokeWidth="3"/>
    <path d="M54 84c10-22 30-35 52-34 12 1 22 5 31 13-8-19-23-30-46-29-17 0-31 10-37 25Z" fill="#B99BE0" opacity=".62"/>
    <path d="M77 37c-13-19-6-31 5-34 10 8 11 20-5 34ZM91 35c3-22 17-27 27-18-2 12-10 20-27 18Z" fill="#79924A" stroke="#4F6534" strokeWidth="2.5"/>
    <path d="M52 75c15 3 26 2 38-3M48 99c19 4 35 4 50-2M49 124c21 4 38 2 56-3M58 151c18 3 34 2 49-3" fill="none" stroke="#8060AC" strokeWidth="3" strokeLinecap="round" opacity=".5"/>
    <circle cx="72" cy="104" r="8" fill="#2D2534"/><circle cx="110" cy="104" r="8" fill="#2D2534"/>
    <circle cx="69" cy="101" r="2.5" fill="#FFF"/><circle cx="107" cy="101" r="2.5" fill="#FFF"/>
    <ellipse cx="58" cy="119" rx="10" ry="5" fill="#E6A6C2" opacity=".9"/><ellipse cx="124" cy="119" rx="10" ry="5" fill="#E6A6C2" opacity=".9"/>
    <path d="M79 120c7 8 16 8 23 0" fill="none" stroke="#3D2E45" strokeWidth="3" strokeLinecap="round"/>
    <path d="M48 139c-14 5-17 14-14 20M135 137c14 5 18 13 16 19" fill="none" stroke="#51405F" strokeWidth="4" strokeLinecap="round"/>
    <path d="M72 181c-5 11-15 13-21 8M111 181c6 11 16 13 21 7" fill="none" stroke="#51405F" strokeWidth="5" strokeLinecap="round"/>
    {showPencil ? <g transform="translate(20 118) rotate(-10)"><rect x="0" y="0" width="17" height="72" rx="6" fill="#F0B94C" stroke="#5D4725" strokeWidth="2"/><path d="M0 11h17" stroke="#E37964" strokeWidth="8"/><path d="M3 0 8.5-14 14 0Z" fill="#EFE0BC" stroke="#5D4725" strokeWidth="2"/><path d="M7-10h3l-1.5-4Z" fill="#3B3127"/></g> : null}
    {showLedger ? <g transform="translate(107 128) rotate(5)"><rect x="0" y="0" width="50" height="55" rx="8" fill="#F7E5B5" stroke="#6E5939" strokeWidth="2.5"/><path d="M8 13h34M8 22h28M8 31h24" stroke="#B49865" strokeWidth="2" strokeLinecap="round"/><path d="m18 42 7 7 14-16" fill="none" stroke="#78A65B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/></g> : null}
    {showPlus ? <g transform="translate(129 50)"><circle cx="16" cy="16" r="15" fill="#EEF3E2" stroke="#7BA05D" strokeWidth="2"/><path d="M16 8v16M8 16h16" stroke="#5B8246" strokeWidth="3" strokeLinecap="round"/></g> : null}
  </svg>;
}

function TankCharacter(props: any = {}): any {
  const mode = props.mode || 'organize';
  const showChart = mode === 'summary';
  const showShield = mode === 'safe';
  const showAlert = mode === 'warning';
  return <svg className="mascot-svg tank-svg" viewBox="0 0 250 205" aria-hidden="true">
    <ellipse cx="128" cy="188" rx="84" ry="11" fill="#25231F" opacity=".08"/>
    <path d="M55 94c0-23 19-41 42-41h44c10 0 19 3 27 8l28 19c9 6 15 17 15 28v16c0 16-13 29-29 29H85c-17 0-30-13-30-29Z" fill="#86A55F" stroke="#34432B" strokeWidth="3"/>
    <path d="M65 102c18-24 71-35 116-15-9-19-27-27-57-27-28 0-47 10-59 42Z" fill="#A9C56E" opacity=".72"/>
    <path d="M143 72h27c8 0 14 6 14 14v8h-41Z" fill="#F0C34A" stroke="#87671B" strokeWidth="3"/>
    <path d="M168 83 213 71c10-3 21 4 24 15l1 4c3 11-4 22-15 24l-55 9Z" fill="#252927" stroke="#111411" strokeWidth="4"/>
    <ellipse cx="225" cy="92" rx="8" ry="13" fill="#474B47" transform="rotate(-10 225 92)"/>
    <path d="M86 82h58" stroke="#F0C34A" strokeWidth="7" strokeLinecap="round"/>
    <circle cx="103" cy="108" r="7" fill="#243022"/><circle cx="137" cy="108" r="7" fill="#243022"/>
    <circle cx="100" cy="105" r="2.2" fill="#FFF"/><circle cx="134" cy="105" r="2.2" fill="#FFF"/>
    <ellipse cx="91" cy="121" rx="8" ry="4.5" fill="#EAB0A2" opacity=".9"/><ellipse cx="149" cy="121" rx="8" ry="4.5" fill="#EAB0A2" opacity=".9"/>
    <path d="M112 122c7 7 15 7 22 0" fill="none" stroke="#2B3329" strokeWidth="3" strokeLinecap="round"/>
    <path d="M72 121c-18 3-25-5-28-14M208 120c13 1 22-7 25-18" fill="none" stroke="#34432B" strokeWidth="4" strokeLinecap="round"/>
    <circle cx="39" cy="105" r="7" fill="#F0C34A" stroke="#34432B" strokeWidth="2"/><circle cx="235" cy="98" r="7" fill="#F0C34A" stroke="#34432B" strokeWidth="2"/>
    <path d="M77 145h111c12 0 21 10 21 21v4H56v-4c0-11 9-21 21-21Z" fill="#252927" stroke="#111411" strokeWidth="3"/>
    <path d="M89 148h20M121 148h20M153 148h20" stroke="#5B615B" strokeWidth="4" strokeLinecap="round" opacity=".8"/>
    <circle cx="92" cy="167" r="23" fill="#252927" stroke="#111411" strokeWidth="3"/><circle cx="173" cy="167" r="23" fill="#252927" stroke="#111411" strokeWidth="3"/>
    <circle cx="92" cy="167" r="10" fill="#F0C34A"/><circle cx="173" cy="167" r="10" fill="#F0C34A"/>
    <circle cx="92" cy="167" r="4" fill="#70805D"/><circle cx="173" cy="167" r="4" fill="#70805D"/>
    <path d="M149 54c-2-10 4-19 14-22 8 4 12 12 6 22" fill="#A9C56E" stroke="#5E7640" strokeWidth="2.5"/>
    <circle cx="165" cy="41" r="4" fill="#F0C34A" stroke="#5E7640" strokeWidth="2"/>
    {showChart ? <g transform="translate(8 18)"><rect x="0" y="0" width="76" height="60" rx="10" fill="#FFFDF8" stroke="#5D6E53" strokeWidth="2"/><rect x="14" y="35" width="10" height="13" rx="2" fill="#89A95F"/><rect x="31" y="25" width="10" height="23" rx="2" fill="#F0BE3F"/><rect x="48" y="16" width="10" height="32" rx="2" fill="#303330"/><path d="M12 12h47" stroke="#C8C1B5" strokeWidth="2"/></g> : null}
    {showShield ? <g transform="translate(10 18)"><path d="M35 0 67 12v24c0 25-16 38-32 46C20 74 3 61 3 36V12Z" fill="#EEF3E5" stroke="#63814B" strokeWidth="3"/><rect x="24" y="32" width="22" height="19" rx="5" fill="#F0BE3F"/><path d="M29 32v-7a6 6 0 0 1 12 0v7" fill="none" stroke="#34432B" strokeWidth="3"/></g> : null}
    {showAlert ? <g transform="translate(16 22)"><circle cx="26" cy="26" r="23" fill="#FFF4D8" stroke="#D59D2F" strokeWidth="3"/><path d="M26 13v18M26 39h.1" stroke="#A9761F" strokeWidth="4" strokeLinecap="round"/></g> : null}
  </svg>;
}

function CannonCharacter(props: any = {}): any { return <TankCharacter {...props}/>; }

function HeroMascots(props: any = {}): any {
  return <div className="hero-character-stage" aria-label="活泼的大芋头和沉稳的小坦克">
    <div className="hero-character hero-character-taro" data-mascot-motion="taro"><TaroCharacter mode="quick"/></div>
    <div className="hero-character hero-character-tank" data-mascot-motion="tank"><TankCharacter mode={props.warning ? 'warning' : 'organize'}/></div>
    <span className="hero-life-dot hero-life-dot-one" aria-hidden="true"/>
    <span className="hero-life-dot hero-life-dot-two" aria-hidden="true"/>
  </div>;
}

function LogoMark(): any {
  return <svg viewBox="0 0 72 72" width="44" height="44" aria-hidden="true">
    <rect width="72" height="72" rx="18" fill="#FAF7F1"/>
    <path d="M27 16c-10 0-18 10-18 25 0 14 7 22 18 22s18-8 18-22c0-15-8-25-18-25Z" fill="#9A78C7" stroke="#51405F" strokeWidth="2"/>
    <path d="M22 18c-5-8-1-13 4-14 4 5 4 9-4 14ZM29 17c2-9 8-11 13-6-2 5-5 8-13 6Z" fill="#79924A"/>
    <circle cx="22" cy="39" r="2.5" fill="#2D2534"/><circle cx="31" cy="39" r="2.5" fill="#2D2534"/>
    <path d="M23 46c3 3 6 3 9 0" fill="none" stroke="#3D2E45" strokeWidth="2" strokeLinecap="round"/>
    <rect x="40" y="38" width="19" height="12" rx="6" fill="#86A55F" stroke="#34432B" strokeWidth="2"/>
    <path d="M49 35h8c3 0 5 2 5 5v2H49Z" fill="#F0C34A" stroke="#87671B" strokeWidth="2"/>
    <path d="M55 39 69 36c3-1 5 1 6 4 1 3-1 6-4 7l-15 2Z" fill="#252927" stroke="#111411" strokeWidth="2"/>
    <circle cx="45" cy="55" r="6" fill="#252927"/><circle cx="58" cy="55" r="6" fill="#252927"/>
    <circle cx="45" cy="55" r="2.5" fill="#F0BE3F"/><circle cx="58" cy="55" r="2.5" fill="#F0BE3F"/>
  </svg>;
}

function Mascot(props: any): any {
  const variant = props.variant || 'idle';
  const taroMode = variant === 'empty' ? 'quick' : variant === 'success' ? 'success' : 'ledger';
  const cannonMode = variant === 'summary' ? 'summary' : variant === 'safe' ? 'safe' : variant === 'warning' ? 'warning' : 'organize';
  const onlyTaro = variant === 'empty' || variant === 'success';
  const onlyCannon = variant === 'summary' || variant === 'safe' || variant === 'warning';
  const labelMap: Record<string, string> = {
    idle: '活泼的大芋头和沉稳的小坦克一起守着小账本', loading: '大芋头和小坦克正在整理数据', empty: '芋头拿着铅笔邀请你记账', success: '芋头抱着账本完成记账', warning: '沉稳的小坦克提醒预算接近上限', safe: '沉稳的小坦克守护账户安全', summary: '沉稳的小坦克展示本月统计结果',
  };
  return <div className={cn('static-mascot', `static-mascot-${variant}`)} role="img" aria-label={props.label || labelMap[variant] || labelMap.idle}>
    {!onlyCannon ? <TaroCharacter mode={taroMode}/> : null}
    {!onlyTaro ? <TankCharacter mode={cannonMode}/> : null}
  </div>;
}

class AnimatedNumber extends React.Component<any, any> {
  frame: number | null = null;
  startedAt = 0;
  from = 0;
  to = 0;
  constructor(props: any) {
    super(props);
    this.state = { value: Number(props.value || 0) };
  }
  componentDidMount(): void { this.animateTo(Number(this.props.value || 0)); }
  componentDidUpdate(prevProps: any): void {
    if (Number(prevProps.value || 0) !== Number(this.props.value || 0)) this.animateTo(Number(this.props.value || 0));
  }
  componentWillUnmount(): void { if (this.frame) cancelAnimationFrame(this.frame); }
  animateTo(next: number): void {
    if (document.body.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.setState({ value: next });
      return;
    }
    if (this.frame) cancelAnimationFrame(this.frame);
    this.from = Number(this.state.value || 0);
    this.to = next;
    this.startedAt = performance.now();
    const tick = (time: number) => {
      const progress = Math.min(1, (time - this.startedAt) / 650);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.setState({ value: this.from + (this.to - this.from) * eased });
      if (progress < 1) this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
  render(): any { return this.props.children ? this.props.children(this.state.value) : String(Math.round(this.state.value)); }
}

function MonthSwitcher(props: any): any {
  return <div className="month-switcher" aria-label="选择月份">
    <button type="button" onClick={() => props.onChange(shiftMonth(props.month, -1))}><Icon name="chevron-left" size={18}/></button>
    <span className="month-label">{monthLabel(props.month)}</span>
    <button type="button" onClick={() => props.onChange(shiftMonth(props.month, 1))} disabled={props.month >= currentMonth()}><Icon name="chevron-right" size={18}/></button>
  </div>;
}

function Modal(props: any): any {
  if (!props.open) return null;
  return <div className="modal-backdrop" onMouseDown={(event: any) => { if (event.target === event.currentTarget) props.onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-label={props.title}>
      <header className="modal-header"><h3>{props.title}</h3><button className="icon-btn" type="button" onClick={props.onClose} aria-label="关闭"><Icon name="close" size={19}/></button></header>
      <div className="modal-body">{props.children}</div>
    </section>
  </div>;
}

function PageHeader(props: any): any {
  return <header className="page-header">
    <div><h1 className="page-title">{props.title}</h1><p className="page-subtitle">{props.subtitle}</p></div>
    <div className="header-actions">{props.children}</div>
  </header>;
}

function LoadingPage(): any {
  return <div className="loading-page"><div><Mascot variant="idle" label="芋炮正在整理账本"/><strong>正在整理小账本</strong><div className="loading-dots"><span/><span/><span/></div></div></div>;
}

function EmptyState(props: any): any {
  return <div className="empty-state"><div><div className="empty-mascot"><Mascot variant="empty"/></div><h3>{props.title}</h3><p>{props.message}</p>{props.action}</div></div>;
}

function TransactionItem(props: any): any {
  const item = props.item;
  const sign = item.type === 'income' ? '+' : item.type === 'expense' ? '-' : '';
  return <div className="transaction-item" style={{ animationDelay: `${Math.min(props.index || 0, 10) * 35}ms` }}>
    <div className="transaction-icon" style={{ background: `${item.category_color || '#8E7CDA'}20` }}>{CATEGORY_EMOJI[item.category_icon] || (item.type === 'transfer' ? '↔️' : '✨')}</div>
    <div className="transaction-main"><div className="transaction-name"><span>{transactionTitle(item)}</span>{item.type === 'transfer' ? <span className="tag">转账</span> : null}{Number(item.invoice_count || 0) > 0 ? <span className="tag invoice-link-tag">🧾 {item.invoice_count}张</span> : null}</div><div className="transaction-meta">{transactionMeta(item)}</div></div>
    <div className="transaction-side"><div className={cn('transaction-amount', item.type)}>{sign}{formatMoney(item.amount_cents)}</div>{props.editable ? <div className="transaction-actions"><button className="mini-action" onClick={() => props.onEdit(item)}>编辑</button><button className="mini-action" onClick={() => props.onDelete(item)}>删除</button></div> : null}</div>
  </div>;
}

function TrendChart(props: any): any {
  const items = props.items || [];
  const width = 720, height = 250, paddingX = 34, paddingTop = 20, paddingBottom = 34;
  if (!items.length) return <EmptyState title="还没有趋势数据" message="记几笔以后，这里会慢慢画出你们的生活轨迹。"/>;
  const max = Math.max(1, ...items.map((item: any) => Math.max(Number(item.income_cents || 0), Number(item.expense_cents || 0))));
  const plotHeight = height - paddingTop - paddingBottom;
  const plotWidth = width - paddingX * 2;
  const x = (index: number) => paddingX + (items.length === 1 ? plotWidth / 2 : index * plotWidth / (items.length - 1));
  const y = (value: number) => paddingTop + plotHeight - (Number(value || 0) / max) * plotHeight;
  const expensePoints = items.map((item: any, index: number) => `${x(index)},${y(item.expense_cents)}`).join(' ');
  const incomePoints = items.map((item: any, index: number) => `${x(index)},${y(item.income_cents)}`).join(' ');
  return <div className="chart-wrap">
    <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="收入和支出趋势图">
      {[0, .25, .5, .75, 1].map((ratio: number) => <line key={String(ratio)} className="chart-grid-line" x1={paddingX} x2={width - paddingX} y1={paddingTop + plotHeight * ratio} y2={paddingTop + plotHeight * ratio}/>) }
      <polyline className="chart-income chart-line-animate" points={incomePoints}/>
      <polyline className="chart-expense chart-line-animate" points={expensePoints}/>
      {items.map((item: any, index: number) => <g key={item.date}><circle className="chart-dot" cx={x(index)} cy={y(item.income_cents)} r="4" fill="#58A77B"><title>{`${compactDate(item.date)} 收入 ${formatMoney(item.income_cents)}`}</title></circle><circle className="chart-dot" cx={x(index)} cy={y(item.expense_cents)} r="4" fill="#E77C72"><title>{`${compactDate(item.date)} 支出 ${formatMoney(item.expense_cents)}`}</title></circle>{(index === 0 || index === items.length - 1 || index % Math.max(1, Math.floor(items.length / 5)) === 0) ? <text className="chart-label" textAnchor="middle" x={x(index)} y={height - 10}>{compactDate(item.date)}</text> : null}</g>)}
    </svg>
    <div className="chart-legend"><span className="legend-item"><i className="legend-dot" style={{ background: '#58A77B' }}/>收入</span><span className="legend-item"><i className="legend-dot" style={{ background: '#E77C72' }}/>支出</span></div>
  </div>;
}


function DonutChart(props: any): any {
  const items = (props.items || []).slice(0, props.compact ? 5 : 7);
  const total = items.reduce((sum: number, item: any) => sum + Number(item.amount_cents || 0), 0);
  if (!items.length || !total) return <EmptyState title="分类还是空的" message="本月有支出后，这里会显示钱都花去了哪里。"/>;
  const topItem = items[0];
  const categoryCount = items.length;
  const average = Math.round(total / Math.max(1, categoryCount));
  const chartItems = items.slice(0, props.compact ? 5 : 6);
  const listItems = items;
  const cx = 120, cy = 120, outerR = props.compact ? 82 : 88, innerR = props.compact ? 52 : 56;
  let angleCursor = 0;
  const gapAngle = chartItems.length > 1 ? 2.6 : 0;
  return <div className={cn('expense-module', props.compact && 'compact')}>
    <div className="expense-module-head">
      <div className="expense-head-copy">
        <span className="expense-head-kicker">分类概览</span>
        <strong>这个月主要花在 {topItem.name}</strong>
        <small>不盯着每一笔，也能知道钱大概流向了哪里。</small>
      </div>
      <div className="expense-head-pills" role="list" aria-label="支出摘要">
        <div className="expense-pill" role="listitem"><span>总支出</span><strong>{formatCompactMoney(total)}</strong></div>
        <div className="expense-pill" role="listitem"><span>分类数</span><strong>{categoryCount} 项</strong></div>
        <div className="expense-pill" role="listitem"><span>单类均值</span><strong>{formatCompactMoney(average)}</strong></div>
      </div>
    </div>
    <div className="expense-module-body">
      <div className="expense-chart-panel">
        <div className="expense-chart-shell">
          <svg className="chart-svg expense-donut-svg" viewBox="0 0 240 240" preserveAspectRatio="xMidYMid meet" role="img" aria-label="支出分类占比">
            <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#EFE8DF" strokeWidth={outerR - innerR}/>
            {chartItems.map((item: any, index: number) => {
              const value = Number(item.amount_cents || 0);
              const sweep = total > 0 ? value / total * 360 : 0;
              const visibleSweep = Math.max(1.2, sweep - gapAngle);
              const startAngle = angleCursor + gapAngle / 2;
              const endAngle = angleCursor + visibleSweep;
              angleCursor += sweep;
              const color = WARM_CHART_COLORS[index % WARM_CHART_COLORS.length];
              return <path key={item.category_id || item.name} d={describeDonutSlice(cx, cy, outerR, innerR, startAngle, endAngle)} fill={color} className="expense-donut-sector"><title>{`${item.name} ${formatMoney(value)}`}</title></path>;
            })}
            <circle cx={cx} cy={cy} r={innerR - 3} fill="#FFFDF9"/>
            <text className="expense-donut-label" x={cx} y={cy - 10} textAnchor="middle">本月支出</text>
            <text className="expense-donut-total" x={cx} y={cy + 20} textAnchor="middle">{formatCompactMoney(total)}</text>
          </svg>
          <div className="expense-donut-caption"><strong>{categoryCount}</strong><span>个支出分类</span><em>最高：{topItem.name}</em></div>
        </div>
        <div className="expense-chart-aside">
          <div className="expense-side-card expense-side-highlight">
            <span className="expense-side-label">最高分类</span>
            <div className="expense-side-main"><i style={{ color: WARM_CHART_COLORS[0] }}>{CATEGORY_EMOJI[topItem.icon] || '✨'}</i><strong>{topItem.name}</strong></div>
            <small>{Math.round(Number(topItem.amount_cents || 0) / total * 100)}% · {formatCompactMoney(topItem.amount_cents)}</small>
          </div>
          <div className="expense-side-card">
            <span className="expense-side-label">快速分布</span>
            <div className="expense-mini-legend">
              {chartItems.slice(0, 4).map((item: any, index: number) => {
                const color = WARM_CHART_COLORS[index % WARM_CHART_COLORS.length];
                const percent = Math.round(Number(item.amount_cents || 0) / total * 100);
                return <div key={item.category_id || item.name} className="expense-mini-item"><span className="expense-mini-dot" style={{ background: color }}/><span className="expense-mini-name" title={item.name}>{item.name}</span><span className="expense-mini-percent">{percent}%</span></div>;
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="expense-list-panel">
        <div className="expense-list-head"><strong>分类明细</strong><span>从高到低排列，更容易一眼看清重点。</span></div>
        <div className="expense-ranking" role="list" aria-label="支出分类排行">
          {listItems.map((item: any, index: number) => {
            const percent = Math.round(Number(item.amount_cents || 0) / total * 100);
            const color = WARM_CHART_COLORS[index % WARM_CHART_COLORS.length];
            return <div className="expense-rank-row" role="listitem" key={item.category_id || item.name}>
              <div className="expense-rank-order">{index + 1}</div>
              <div className="expense-rank-icon" style={{ background: `${color}18`, color }}>{CATEGORY_EMOJI[item.icon] || '✨'}</div>
              <div className="expense-rank-main">
                <div className="expense-rank-top"><span className="expense-rank-name" title={item.name}>{item.name}</span><span className="expense-rank-percent">{percent}%</span></div>
                <div className="expense-rank-bar" aria-hidden="true"><span style={{ width: `${Math.max(4, percent)}%`, background: color }}/></div>
              </div>
              <strong className="expense-rank-amount">{formatCompactMoney(item.amount_cents)}</strong>
            </div>;
          })}
        </div>
      </div>
    </div>
    {props.onViewAll ? <div className="expense-module-footer"><button className="expense-more-btn" type="button" onClick={props.onViewAll}><span>查看全部分类</span><small>共 {categoryCount} 项</small><Icon name="chevron-right" size={16}/></button></div> : null}
  </div>;
}

function MonthlyBars(props: any): any {
  const items = props.items || [];
  if (!items.length) return <EmptyState title="还没有月度对比" message="有了几个月的数据以后，会更容易看出变化。"/>;
  const width = 720, height = 260, px = 38, py = 24, bottom = 38;
  const max = Math.max(1, ...items.map((item: any) => Math.max(Number(item.income_cents || 0), Number(item.expense_cents || 0))));
  const plotH = height - py - bottom, groupW = (width - px * 2) / items.length;
  return <div className="chart-wrap"><svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="近六个月收支对比">
    {[0, .5, 1].map((ratio: number) => <line key={String(ratio)} className="chart-grid-line" x1={px} x2={width - px} y1={py + plotH * ratio} y2={py + plotH * ratio}/>) }
    {items.map((item: any, index: number) => {
      const incomeH = Number(item.income_cents || 0) / max * plotH;
      const expenseH = Number(item.expense_cents || 0) / max * plotH;
      const gx = px + index * groupW + groupW * .2;
      const barW = groupW * .24;
      return <g key={item.month}><rect className="chart-bar" x={gx} y={py + plotH - incomeH} width={barW} height={incomeH} rx="5" fill="#58A77B"><title>{`${monthLabel(item.month)} 收入 ${formatMoney(item.income_cents)}`}</title></rect><rect className="chart-bar" style={{ animationDelay: `${index * 70 + 80}ms` }} x={gx + barW + 5} y={py + plotH - expenseH} width={barW} height={expenseH} rx="5" fill="#E77C72"><title>{`${monthLabel(item.month)} 支出 ${formatMoney(item.expense_cents)}`}</title></rect><text className="chart-label" textAnchor="middle" x={gx + barW} y={height - 13}>{item.month.slice(5)}月</text></g>;
    })}
  </svg><div className="chart-legend"><span className="legend-item"><i className="legend-dot" style={{ background: '#58A77B' }}/>收入</span><span className="legend-item"><i className="legend-dot" style={{ background: '#E77C72' }}/>支出</span></div></div>;
}

function BudgetProgressList(props: any): any {
  const items = props.items || [];
  if (!items.length) return <EmptyState title="还没设置分类预算" message="给常用分类设个预算，月底看起来会更轻松。" action={props.onSetup ? <button className="btn btn-secondary" onClick={props.onSetup}>去设置预算</button> : null}/>;
  return <div>{items.map((item: any) => {
    const percent = safePercent(item.used_cents, item.amount_cents);
    const status = item.amount_cents > 0 && item.used_cents > item.amount_cents ? 'over' : percent >= 80 ? 'notice' : 'normal';
    return <div className="budget-row" key={item.id}><div className="budget-top"><span>{CATEGORY_EMOJI[item.category_icon] || '✨'} {item.category_name}</span><strong>{formatCompactMoney(item.used_cents)} / {formatCompactMoney(item.amount_cents)}</strong></div><div className="progress-track"><div className={cn('progress-fill', status)} style={{ width: `${Math.max(2, percent)}%` }}/></div></div>;
  })}</div>;
}

function SummaryMetric(props: any): any {
  return <article className={cn('card', 'summary-card', `summary-${props.tone}`)}>
    <div className="summary-icon"><Icon name={props.icon} size={19}/></div>
    <div className="summary-content"><span className="summary-label">{props.label}</span><span className="summary-value"><AnimatedNumber value={props.value}>{(value: number) => formatMoney(value)}</AnimatedNumber></span><div className="summary-note">{props.note}</div></div>
  </article>;
}

class DashboardPage extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { loading: true, overview: null, trend: [], categories: [], budgets: [], invoiceSummary: null }; }
  componentDidMount(): void { this.load(); }
  componentDidUpdate(prevProps: any): void { if (prevProps.month !== this.props.month || prevProps.refreshToken !== this.props.refreshToken) this.load(); }
  async load(): Promise<void> {
    this.setState({ loading: true });
    try {
      const month = this.props.month;
      const [overview, trend, categories, budgets, invoiceSummary] = await Promise.all([
        apiRequest(`/api/stats/overview?month=${month}`), apiRequest(`/api/stats/trend?month=${month}`),
        apiRequest(`/api/stats/category-breakdown?month=${month}`), apiRequest(`/api/stats/budget-progress?month=${month}`),
        apiRequest(`/api/invoices/summary?month=${month}`),
      ]);
      this.setState({ loading: false, overview, trend: trend.items, categories: categories.items, budgets: budgets.items, invoiceSummary });
    } catch (error: any) { this.setState({ loading: false }); this.props.onError(error.message); }
  }
  render(): any {
    if (this.state.loading || !this.state.overview) return <LoadingPage/>;
    const data = this.state.overview;
    const userName = this.props.bootstrap.user.displayName;
    const hour = new Date().getHours();
    const greeting = hour < 11 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
    const budgetPercent = safePercent(data.budgetUsedCents, data.budgetCents);
    return <div className="page">
      <PageHeader title={`${greeting}，${userName}`} subtitle="两个人的小日子，都记在这里。"><MonthSwitcher month={this.props.month} onChange={this.props.onMonthChange}/><button className="icon-btn" onClick={() => this.load()} title="刷新"><Icon name="refresh" size={18}/></button></PageHeader>
      <section className="hero-card card">
        <div className="hero-copy"><span className="hero-kicker">{monthLabel(this.props.month)} · 家庭生活簿</span><h2>{data.expenseCents > 0 ? '把平常的小日子，轻轻记下来' : '从今天的一笔小事开始'}</h2><p>{data.expenseCents > 0 ? `这个月支出 ${formatMoney(data.expenseCents)}，结余 ${formatMoney(data.balanceCents)}。大芋头负责马上记，小坦克负责慢慢整理。` : '一顿饭、一杯饮料、一次出行，都是你们共同生活的一部分。'}</p><div className="hero-actions"><button className="btn btn-primary" onClick={() => this.props.navigate('add')}><Icon name="plus" size={18}/>记一笔</button><button className="btn btn-secondary" onClick={() => this.props.navigate('transactions')}>看看明细</button></div><div className="hero-gentle-note"><span/>今天也不用记得很完美，重要的先留下。</div></div>
        <div className="hero-mascot"><HeroMascots warning={data.budgetCents > 0 && budgetPercent >= 90}/></div>
      </section>
      <section className="grid grid-4 summary-grid" style={{ marginTop: '18px' }}>
        <SummaryMetric tone="income" icon="wallet" label="本月收入" value={data.incomeCents} note={`上月 ${formatCompactMoney(data.previousIncomeCents)}`}/>
        <SummaryMetric tone="expense" icon="chart" label="本月支出" value={data.expenseCents} note={`上月 ${formatCompactMoney(data.previousExpenseCents)}`}/>
        <SummaryMetric tone="balance" icon="target" label="本月结余" value={data.balanceCents} note="收入减去支出"/>
        <SummaryMetric tone="assets" icon="wallet" label="账户合计" value={data.totalBalanceCents} note={`共 ${data.accounts.length} 个使用中账户`}/>
      </section>
      <div className="dashboard-grid">
        <div className="stack">
          <section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">本月收支趋势</h3><p className="card-subtitle">每天的收入和支出变化</p></div><button className="btn btn-ghost btn-sm" onClick={() => this.props.navigate('stats')}>完整统计</button></div><TrendChart items={this.state.trend}/></section>
          <section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">最近记录</h3><p className="card-subtitle">最新的六笔小账</p></div><button className="btn btn-ghost btn-sm" onClick={() => this.props.navigate('transactions')}>全部明细</button></div>{data.recent.length ? <div className="list">{data.recent.map((item: any, index: number) => <TransactionItem key={item.id} item={item} index={index}/>)}</div> : <EmptyState title="这里还没有记录" message="今天发生的第一笔小事，可以从这里开始。" action={<button className="btn btn-primary" onClick={() => this.props.navigate('add')}>记第一笔</button>}/>}</section>
        </div>
        <div className="stack">
          <section className="card card-pad spending-card"><div className="card-title-row"><div><h3 className="card-title">钱花去了哪里</h3><p className="card-subtitle">本月支出分类</p></div></div><DonutChart items={this.state.categories} compact onViewAll={() => this.props.navigate('stats')}/></section>
          <section className="card card-pad invoice-pocket-card"><div className="card-title-row"><div><h3 className="card-title">发票小夹子</h3><p className="card-subtitle">收入和支出的凭证都收在这里</p></div><button className="btn btn-ghost btn-sm" onClick={() => this.props.navigate('invoices')}>打开</button></div><div className="invoice-pocket-grid"><button type="button" onClick={() => this.props.navigate('invoices')}><span>收到的</span><strong>{formatCompactMoney(this.state.invoiceSummary?.received?.amountCents || 0)}</strong><small>{this.state.invoiceSummary?.received?.count || 0} 张 · 已关联 {this.state.invoiceSummary?.received?.linkedCount || 0}</small></button><button type="button" onClick={() => this.props.navigate('invoices')}><span>开出的</span><strong>{formatCompactMoney(this.state.invoiceSummary?.issued?.amountCents || 0)}</strong><small>{this.state.invoiceSummary?.issued?.count || 0} 张 · 已关联 {this.state.invoiceSummary?.issued?.linkedCount || 0}</small></button></div></section>
          <section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">预算进度</h3><p className="card-subtitle">控制节奏，不用给自己压力</p></div><button className="btn btn-ghost btn-sm" onClick={() => this.props.navigate('budgets')}>管理预算</button></div>{data.budgetCents > 0 ? <div style={{ marginBottom: '16px' }}><div className="budget-top"><span>总预算</span><strong>{formatCompactMoney(data.budgetUsedCents)} / {formatCompactMoney(data.budgetCents)}</strong></div><div className="progress-track"><div className={cn('progress-fill', budgetPercent >= 100 ? 'over' : budgetPercent >= 80 ? 'notice' : 'normal')} style={{ width: `${Math.max(2, budgetPercent)}%` }}/></div></div> : null}<BudgetProgressList items={this.state.budgets} onSetup={() => this.props.navigate('budgets')}/></section>
        </div>
      </div>
    </div>;
  }
}

class TransactionForm extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    const initial = props.initial || {};
    this.state = {
      type: initial.type || 'expense', amount: initial.amount_cents ? (initial.amount_cents / 100).toFixed(2) : '',
      accountId: initial.account_id || props.bootstrap.accounts[0]?.id || '', targetAccountId: initial.target_account_id || props.bootstrap.accounts[1]?.id || '',
      categoryId: initial.category_id || '', occurredAt: initial.occurred_at ? initial.occurred_at.slice(0, 10) : today(),
      merchant: initial.merchant || '', note: initial.note || '', submitting: false, error: '',
    };
  }
  categories(): any[] { return this.props.bootstrap.categories.filter((item: any) => item.type === this.state.type && !item.is_archived); }
  componentDidMount(): void { if (!this.state.categoryId && this.categories()[0]) this.setState({ categoryId: this.categories()[0].id }); }
  setType(type: TransactionType): void {
    const category = this.props.bootstrap.categories.find((item: any) => item.type === type && !item.is_archived);
    this.setState({ type, categoryId: type === 'transfer' ? '' : category?.id || '' });
  }
  async submit(event: any): Promise<void> {
    event.preventDefault();
    const amountCents = moneyToCents(this.state.amount);
    if (!amountCents) { this.setState({ error: '请输入正确的金额' }); return; }
    if (!this.state.accountId) { this.setState({ error: '请选择账户' }); return; }
    if (this.state.type !== 'transfer' && !this.state.categoryId) { this.setState({ error: '请选择分类' }); return; }
    if (this.state.type === 'transfer' && (!this.state.targetAccountId || this.state.targetAccountId === this.state.accountId)) { this.setState({ error: '请选择不同的转入账户' }); return; }
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
    } catch (error: any) { this.setState({ submitting: false, error: error.message || '保存失败，请稍后再试' }); }
  }
  render(): any {
    const categories = this.categories();
    return <form onSubmit={(event: any) => this.submit(event)}>
      <div className="type-switch"><button type="button" className={cn(this.state.type === 'expense' && 'active expense')} onClick={() => this.setType('expense')}>支出</button><button type="button" className={cn(this.state.type === 'income' && 'active income')} onClick={() => this.setType('income')}>收入</button><button type="button" className={cn(this.state.type === 'transfer' && 'active transfer')} onClick={() => this.setType('transfer')}>转账</button></div>
      <div className="amount-field"><div className="amount-input-wrap"><span className="currency-symbol">¥</span><input className="amount-input" inputMode="decimal" autoFocus={!this.props.initial} placeholder="0.00" value={this.state.amount} onChange={(event: any) => this.setState({ amount: event.target.value.replace(/[^\d.]/g, '').replace(/(\.\d{2}).+$/, '$1') })}/></div></div>
      {this.state.type !== 'transfer' ? <div className="field form-span" style={{ marginBottom: '15px' }}><label>分类</label><div className="category-grid">{categories.map((item: any) => <button type="button" key={item.id} className={cn('category-chip', this.state.categoryId === item.id && 'active')} onClick={() => this.setState({ categoryId: item.id })}><span className="emoji">{CATEGORY_EMOJI[item.icon] || '✨'}</span><span>{item.name}</span></button>)}</div></div> : null}
      <div className="form-grid">
        <div className="field"><label>{this.state.type === 'transfer' ? '转出账户' : '账户'}</label><select className="select" value={this.state.accountId} onChange={(event: any) => this.setState({ accountId: event.target.value })}>{this.props.bootstrap.accounts.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        {this.state.type === 'transfer' ? <div className="field"><label>转入账户</label><select className="select" value={this.state.targetAccountId} onChange={(event: any) => this.setState({ targetAccountId: event.target.value })}>{this.props.bootstrap.accounts.filter((item: any) => item.id !== this.state.accountId).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div> : <div className="field"><label>日期</label><input className="input" type="date" value={this.state.occurredAt} onChange={(event: any) => this.setState({ occurredAt: event.target.value })}/></div>}
        {this.state.type === 'transfer' ? <div className="field"><label>日期</label><input className="input" type="date" value={this.state.occurredAt} onChange={(event: any) => this.setState({ occurredAt: event.target.value })}/></div> : <div className="field"><label>商户/来源（可选）</label><input className="input" maxLength={80} placeholder={this.state.type === 'income' ? '例如：公司、客户' : '例如：超市、餐厅'} value={this.state.merchant} onChange={(event: any) => this.setState({ merchant: event.target.value })}/></div>}
        <div className={cn('field', this.state.type !== 'transfer' && 'form-span')}><label>备注（可选）</label><textarea className="textarea" maxLength={300} placeholder="简单记一下这笔钱的用途" value={this.state.note} onChange={(event: any) => this.setState({ note: event.target.value })}/></div>
      </div>
      {this.state.error ? <p className="error-text">{this.state.error}</p> : null}
      <div className="form-actions">{this.props.onCancel ? <button type="button" className="btn btn-ghost" onClick={this.props.onCancel}>取消</button> : null}<button className="btn btn-primary" type="submit" disabled={this.state.submitting}>{this.state.submitting ? '正在保存…' : this.props.initial ? '保存修改' : '收进小账本'}</button></div>
    </form>;
  }
}

class AddPage extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { success: false, savedType: 'expense' }; }
  render(): any {
    return <div className="page"><PageHeader title="记一笔" subtitle="不用填得很复杂，先把重要的记下来。"/><section className="card card-pad add-form-card" style={{ maxWidth: '820px', margin: '0 auto' }}><div className="role-assistant role-assistant-taro"><div className="role-assistant-copy"><strong>芋头准备好啦</strong><span>填好金额，它会马上把这笔记进来。</span></div><div className="role-assistant-mascot"><Mascot variant="idle" label="芋头拿着铅笔准备记账，小坦克打开归档槽"/></div></div><TransactionForm bootstrap={this.props.bootstrap} onSuccess={(_: any, type: TransactionType) => { this.setState({ success: true, savedType: type }); this.props.onChanged(); window.setTimeout(() => { this.setState({ success: false }); this.props.navigate('home'); }, 1350); }}/></section>{this.state.success ? <div className="success-overlay"><div className="success-box"><Mascot variant="success" label="芋头举起收据，小坦克显示已整理"/><h2>这笔记好啦</h2><p>{this.state.savedType === 'income' ? '芋头已经记下收入，小坦克也整理好了' : this.state.savedType === 'transfer' ? '芋头记下转账，小坦克已经同步两个账户' : '芋头已经记下这笔，小坦克也整理好了'}</p></div></div> : null}</div>;
  }
}

class TransactionsPage extends React.Component<any, any> {
  timer: number | null = null;
  constructor(props: any) { super(props); this.state = { loading: true, items: [], total: 0, month: props.month, type: '', accountId: '', search: '', edit: null }; }
  componentDidMount(): void { this.load(); }
  componentDidUpdate(prevProps: any): void { if (prevProps.refreshToken !== this.props.refreshToken) this.load(); }
  async load(): Promise<void> {
    this.setState({ loading: true });
    const params = new URLSearchParams({ month: this.state.month, limit: '200' });
    if (this.state.type) params.set('type', this.state.type);
    if (this.state.accountId) params.set('accountId', this.state.accountId);
    if (this.state.search.trim()) params.set('search', this.state.search.trim());
    try { const data = await apiRequest(`/api/transactions?${params.toString()}`); this.setState({ loading: false, items: data.items, total: data.total }); }
    catch (error: any) { this.setState({ loading: false }); this.props.onError(error.message); }
  }
  changeFilter(state: any): void { this.setState(state, () => this.load()); }
  async remove(item: any): Promise<void> {
    if (!window.confirm(`删除“${transactionTitle(item)}”这笔记录？`)) return;
    try {
      await apiRequest(`/api/transactions/${item.id}`, { method: 'DELETE' });
      this.setState({ items: this.state.items.filter((entry: any) => entry.id !== item.id) });
      this.props.onChanged();
      this.props.onToast('这笔记录已删除', 'default', '撤销', async () => {
        try { await apiRequest(`/api/transactions/${item.id}/restore`, { method: 'POST' }); this.load(); this.props.onChanged(); this.props.onToast('已经恢复这笔记录', 'success'); }
        catch (error: any) { this.props.onToast(error.message, 'error'); }
      });
    } catch (error: any) { this.props.onToast(error.message, 'error'); }
  }
  render(): any {
    return <div className="page"><PageHeader title="收支明细" subtitle="按月份、类型或账户查找每一笔记录。"><MonthSwitcher month={this.state.month} onChange={(month: string) => this.changeFilter({ month })}/><button className="btn btn-primary" onClick={() => this.props.navigate('add')}><Icon name="plus" size={18}/><span className="btn-label">记一笔</span></button></PageHeader>
      <section className="card card-pad">
        <div className="filter-bar"><select className="select" value={this.state.type} onChange={(event: any) => this.changeFilter({ type: event.target.value })}><option value="">全部类型</option><option value="expense">支出</option><option value="income">收入</option><option value="transfer">转账</option></select><select className="select" value={this.state.accountId} onChange={(event: any) => this.changeFilter({ accountId: event.target.value })}><option value="">全部账户</option>{this.props.bootstrap.accounts.map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><div className="search-wrap"><Icon name="search" size={18}/><input className="input" placeholder="搜索商户或备注" value={this.state.search} onChange={(event: any) => this.setState({ search: event.target.value })} onKeyDown={(event: any) => { if (event.key === 'Enter') this.load(); }}/></div><button className="btn btn-secondary" onClick={() => this.load()}>搜索</button></div>
        <div className="card-title-row"><div><h3 className="card-title">{monthLabel(this.state.month)}</h3><p className="card-subtitle">共 {this.state.total} 笔记录</p></div></div>
        {this.state.loading ? <div className="stack"><div className="skeleton" style={{ height: '68px' }}/><div className="skeleton" style={{ height: '68px' }}/><div className="skeleton" style={{ height: '68px' }}/></div> : this.state.items.length ? <div className="list">{this.state.items.map((item: any, index: number) => <TransactionItem key={item.id} item={item} index={index} editable onEdit={(entry: any) => this.setState({ edit: entry })} onDelete={(entry: any) => this.remove(entry)}/>)}</div> : <EmptyState title="没有找到记录" message="换个筛选条件，或者记下新的一笔。" action={<button className="btn btn-primary" onClick={() => this.props.navigate('add')}>记一笔</button>}/>}</section>
      <Modal open={Boolean(this.state.edit)} title="编辑这笔记录" onClose={() => this.setState({ edit: null })}>{this.state.edit ? <TransactionForm bootstrap={this.props.bootstrap} initial={this.state.edit} onCancel={() => this.setState({ edit: null })} onSuccess={() => { this.setState({ edit: null }); this.load(); this.props.onChanged(); this.props.onToast('已经保存修改', 'success'); }}/> : null}</Modal>
    </div>;
  }
}

class StatsPage extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { loading: true, month: props.month, trend: [], categories: [], months: [], budgets: [] }; }
  componentDidMount(): void { this.load(); }
  componentDidUpdate(prevProps: any): void { if (prevProps.refreshToken !== this.props.refreshToken) this.load(); }
  async load(): Promise<void> {
    this.setState({ loading: true });
    const month = this.state.month;
    try {
      const [trend, categories, months, budgets] = await Promise.all([
        apiRequest(`/api/stats/trend?month=${month}`), apiRequest(`/api/stats/category-breakdown?month=${month}`),
        apiRequest(`/api/stats/month-comparison?month=${month}`), apiRequest(`/api/stats/budget-progress?month=${month}`),
      ]);
      this.setState({ loading: false, trend: trend.items, categories: categories.items, months: months.items, budgets: budgets.items });
    } catch (error: any) { this.setState({ loading: false }); this.props.onError(error.message); }
  }
  render(): any {
    return <div className="page"><PageHeader title="收支统计" subtitle="不用盯着每一笔，看看整体节奏就好。"><MonthSwitcher month={this.state.month} onChange={(month: string) => this.setState({ month }, () => this.load())}/></PageHeader>{this.state.loading ? <LoadingPage/> : <div className="grid grid-2"><section className="card role-assistant role-assistant-cannon form-span"><div className="role-assistant-copy"><strong>小坦克已经整理好本月数据</strong><span>趋势、分类和预算都归好类了，慢慢看就行。</span></div><div className="role-assistant-mascot role-assistant-mascot-summary"><Mascot variant="summary" label="绿黑炮台投影本月图表，芋头在旁边查看"/></div></section><section className="card card-pad form-span"><div className="card-title-row"><div><h3 className="card-title">本月趋势</h3><p className="card-subtitle">每天的收入与支出</p></div></div><TrendChart items={this.state.trend}/></section><section className="card card-pad spending-card"><div className="card-title-row"><div><h3 className="card-title">支出分类</h3><p className="card-subtitle">钱主要花在了哪里</p></div></div><DonutChart items={this.state.categories}/></section><section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">分类预算</h3><p className="card-subtitle">预算与实际支出</p></div></div><BudgetProgressList items={this.state.budgets} onSetup={() => this.props.navigate('budgets')}/></section><section className="card card-pad form-span"><div className="card-title-row"><div><h3 className="card-title">近六个月</h3><p className="card-subtitle">收入和支出的月度变化</p></div></div><MonthlyBars items={this.state.months}/></section></div>}</div>;
  }
}


function InvoiceItem(props: any): any {
  const item = props.item;
  const isVoid = item.status === 'void';
  const linkText = item.transaction_id
    ? `${item.transaction_type === 'expense' ? '支出' : '收入'} · ${item.transaction_category_name || item.transaction_merchant || compactDate(item.transaction_occurred_at || '')}`
    : '暂未关联收支';
  return <article className={cn('invoice-card', isVoid && 'is-void')}>
    <div className={cn('invoice-stamp', item.type)}><Icon name="invoice" size={20}/><span>{item.type === 'received' ? '收' : '开'}</span></div>
    <div className="invoice-card-main"><div className="invoice-card-heading"><strong>{item.title}</strong><span className={cn('invoice-type-pill', item.type)}>{invoiceTypeLabel(item.type)}</span>{isVoid ? <span className="tag">已作废</span> : null}</div><p>{item.counterparty_name} · {item.invoice_number}</p><div className="invoice-link-line"><span>🔗 {linkText}</span><span>{dateLabel(item.invoice_date)}</span></div></div>
    <div className="invoice-card-side"><strong>{formatMoney(item.amount_cents)}</strong>{item.tax_amount_cents ? <small>含税额 {formatMoney(item.tax_amount_cents)}</small> : <small>未单列税额</small>}<div className="invoice-actions">{isVoid ? <button onClick={() => props.onRestore(item)}>恢复</button> : <><button onClick={() => props.onEdit(item)}>编辑</button><button onClick={() => props.onVoid(item)}>作废</button></>}</div></div>
  </article>;
}

class InvoiceForm extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    const item = props.initial || {};
    this.state = {
      type: item.type || props.defaultType || 'received', invoiceNumber: item.invoice_number || '', invoiceCode: item.invoice_code || '',
      title: item.title || '', counterpartyName: item.counterparty_name || '', amount: item.amount_cents ? (item.amount_cents / 100).toFixed(2) : '',
      taxAmount: item.tax_amount_cents ? (item.tax_amount_cents / 100).toFixed(2) : '', invoiceDate: item.invoice_date ? item.invoice_date.slice(0, 10) : today(),
      transactionId: item.transaction_id || '', note: item.note || '', saving: false, error: '',
    };
  }
  candidates(): any[] { return (this.props.transactions || []).filter((item: any) => item.type === (this.state.type === 'received' ? 'expense' : 'income')); }
  setType(type: InvoiceType): void { this.setState({ type, transactionId: '' }); }
  async submit(event: any): Promise<void> {
    event.preventDefault();
    const amountCents = moneyToCents(this.state.amount); const taxAmountCents = this.state.taxAmount ? moneyToCents(this.state.taxAmount) : 0;
    if (!this.state.invoiceNumber.trim()) { this.setState({ error: '请输入发票号码' }); return; }
    if (!this.state.title.trim()) { this.setState({ error: '请输入发票抬头或内容' }); return; }
    if (!this.state.counterpartyName.trim()) { this.setState({ error: `请输入${invoiceCounterpartyLabel(this.state.type)}` }); return; }
    if (!amountCents) { this.setState({ error: '请输入正确的发票金额' }); return; }
    if (taxAmountCents > amountCents) { this.setState({ error: '税额不能大于发票金额' }); return; }
    this.setState({ saving: true, error: '' });
    const payload = { type: this.state.type, invoiceNumber: this.state.invoiceNumber.trim(), invoiceCode: this.state.invoiceCode.trim(), title: this.state.title.trim(),
      counterpartyName: this.state.counterpartyName.trim(), amountCents, taxAmountCents, invoiceDate: this.state.invoiceDate,
      transactionId: this.state.transactionId || null, note: this.state.note.trim(), ...(this.props.initial ? { version: this.props.initial.version } : {}) };
    try {
      const path = this.props.initial ? `/api/invoices/${this.props.initial.id}` : '/api/invoices';
      await apiRequest(path, { method: this.props.initial ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      this.props.onSuccess();
    } catch (error: any) { this.setState({ saving: false, error: error.message || '保存发票失败' }); }
  }
  render(): any {
    const candidates = this.candidates();
    return <form className="invoice-form" onSubmit={(event: any) => this.submit(event)}>
      <div className="type-switch invoice-type-switch"><button type="button" className={cn(this.state.type === 'received' && 'active expense')} onClick={() => this.setType('received')}>收到的发票</button><button type="button" className={cn(this.state.type === 'issued' && 'active income')} onClick={() => this.setType('issued')}>开出的发票</button></div>
      <div className="form-grid"><div className="field"><label>发票号码</label><input className="input" maxLength={80} required value={this.state.invoiceNumber} onChange={(event: any) => this.setState({ invoiceNumber: event.target.value })} placeholder="例如：031001900111"/></div><div className="field"><label>发票代码（可选）</label><input className="input" maxLength={80} value={this.state.invoiceCode} onChange={(event: any) => this.setState({ invoiceCode: event.target.value })}/></div><div className="field form-span"><label>发票抬头 / 内容</label><input className="input" maxLength={120} required value={this.state.title} onChange={(event: any) => this.setState({ title: event.target.value })} placeholder="例如：办公用品、设计服务费"/></div><div className="field"><label>{invoiceCounterpartyLabel(this.state.type)}</label><input className="input" maxLength={120} required value={this.state.counterpartyName} onChange={(event: any) => this.setState({ counterpartyName: event.target.value })} placeholder={this.state.type === 'received' ? '谁给你开票' : '发票开给谁'}/></div><div className="field"><label>开票日期</label><input className="input" type="date" required value={this.state.invoiceDate} onChange={(event: any) => this.setState({ invoiceDate: event.target.value })}/></div><div className="field"><label>发票金额</label><input className="input" inputMode="decimal" required value={this.state.amount} onChange={(event: any) => this.setState({ amount: event.target.value.replace(/[^\d.]/g, '').replace(/(\.\d{2}).+$/, '$1') })} placeholder="0.00"/></div><div className="field"><label>其中税额（可选）</label><input className="input" inputMode="decimal" value={this.state.taxAmount} onChange={(event: any) => this.setState({ taxAmount: event.target.value.replace(/[^\d.]/g, '').replace(/(\.\d{2}).+$/, '$1') })} placeholder="0.00"/></div><div className="field form-span"><label>{this.state.type === 'received' ? '关联支出' : '关联收入'}（可选）</label><select className="select" value={this.state.transactionId} onChange={(event: any) => this.setState({ transactionId: event.target.value })}><option value="">暂不关联</option>{candidates.map((item: any) => <option key={item.id} value={item.id}>{item.occurred_at.slice(0, 10)} · {transactionTitle(item)} · {formatMoney(item.amount_cents)}</option>)}</select><small className="field-hint">{this.state.type === 'received' ? '收到的发票只能关联支出' : '开出的发票只能关联收入'}，同一笔收支可以关联多张发票。</small></div><div className="field form-span"><label>备注（可选）</label><textarea className="textarea" maxLength={500} value={this.state.note} onChange={(event: any) => this.setState({ note: event.target.value })} placeholder="例如：用于报销、客户已确认开票等"/></div></div>
      {this.state.error ? <p className="error-text">{this.state.error}</p> : null}<div className="form-actions"><button type="button" className="btn btn-ghost" onClick={this.props.onCancel}>取消</button><button className="btn btn-primary" disabled={this.state.saving}>{this.state.saving ? '保存中…' : this.props.initial ? '保存发票' : '收进发票夹'}</button></div>
    </form>;
  }
}

class InvoicesPage extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { loading: true, month: props.month, type: 'received', status: 'recorded', linked: '', search: '', items: [], total: 0, summary: null, transactions: [], creating: false, edit: null }; }
  componentDidMount(): void { this.load(); }
  componentDidUpdate(prevProps: any): void { if (prevProps.refreshToken !== this.props.refreshToken) this.load(); }
  async load(): Promise<void> {
    this.setState({ loading: true });
    const params = new URLSearchParams({ month: this.state.month, type: this.state.type, status: this.state.status, limit: '200' });
    if (this.state.linked) params.set('linked', this.state.linked); if (this.state.search.trim()) params.set('search', this.state.search.trim());
    try {
      const [data, summary, expenseTransactions, incomeTransactions] = await Promise.all([apiRequest(`/api/invoices?${params.toString()}`), apiRequest(`/api/invoices/summary?month=${this.state.month}`), apiRequest('/api/transactions?type=expense&limit=300'), apiRequest('/api/transactions?type=income&limit=300')]);
      this.setState({ loading: false, items: data.items, total: data.total, summary, transactions: [...expenseTransactions.items, ...incomeTransactions.items] });
    } catch (error: any) { this.setState({ loading: false }); this.props.onError(error.message); }
  }
  change(state: any): void { this.setState(state, () => this.load()); }
  async voidItem(item: any): Promise<void> { if (!window.confirm(`作废发票“${item.invoice_number}”？关联的收支记录不会删除。`)) return; try { await apiRequest(`/api/invoices/${item.id}`, { method: 'DELETE' }); this.load(); this.props.onChanged(); this.props.onToast('发票已经作废', 'success'); } catch (error: any) { this.props.onToast(error.message, 'error'); } }
  async restoreItem(item: any): Promise<void> { try { await apiRequest(`/api/invoices/${item.id}/restore`, { method: 'POST' }); this.load(); this.props.onChanged(); this.props.onToast('发票已经恢复，请重新检查关联记录', 'success'); } catch (error: any) { this.props.onToast(error.message, 'error'); } }
  render(): any {
    const summary = this.state.summary || { received: {}, issued: {} };
    return <div className="page invoice-page"><PageHeader title="发票夹" subtitle="收到的发票关联支出，开出的发票关联收入。"><MonthSwitcher month={this.state.month} onChange={(month: string) => this.change({ month })}/><button className="btn btn-primary" onClick={() => this.setState({ creating: true })}><Icon name="plus" size={18}/>记发票</button></PageHeader>
      <section className="invoice-journal-hero card"><div className="invoice-hero-icon"><Icon name="invoice" size={26}/></div><div><span className="journal-sticker">发票管理</span><h2>每张发票，都能找到对应的小账</h2><p>收到的发票关联支出，开出的发票关联收入；暂时没有对应记录，也可以稍后补充。</p></div></section>
      <section className="invoice-summary-grid"><button className={cn('invoice-summary-card received', this.state.type === 'received' && 'active')} onClick={() => this.change({ type: 'received' })}><span>收到的发票</span><strong>{formatMoney(summary.received.amountCents || 0)}</strong><small>{summary.received.count || 0} 张 · 已关联 {summary.received.linkedCount || 0}</small></button><button className={cn('invoice-summary-card issued', this.state.type === 'issued' && 'active')} onClick={() => this.change({ type: 'issued' })}><span>开出的发票</span><strong>{formatMoney(summary.issued.amountCents || 0)}</strong><small>{summary.issued.count || 0} 张 · 已关联 {summary.issued.linkedCount || 0}</small></button></section>
      <section className="card card-pad invoice-list-card"><div className="invoice-tabs"><button className={cn(this.state.type === 'received' && 'active')} onClick={() => this.change({ type: 'received' })}>我收到的</button><button className={cn(this.state.type === 'issued' && 'active')} onClick={() => this.change({ type: 'issued' })}>我开出的</button></div><div className="filter-bar invoice-filter-bar"><select className="select" value={this.state.status} onChange={(event: any) => this.change({ status: event.target.value })}><option value="recorded">正常发票</option><option value="void">已作废</option></select><select className="select" value={this.state.linked} onChange={(event: any) => this.change({ linked: event.target.value })}><option value="">全部关联状态</option><option value="true">已关联收支</option><option value="false">未关联</option></select><div className="search-wrap"><Icon name="search" size={18}/><input className="input" placeholder="搜索号码、抬头或对方名称" value={this.state.search} onChange={(event: any) => this.setState({ search: event.target.value })} onKeyDown={(event: any) => { if (event.key === 'Enter') this.load(); }}/></div><button className="btn btn-secondary" onClick={() => this.load()}>搜索</button></div><div className="card-title-row"><div><h3 className="card-title">{this.state.type === 'received' ? '我收到的发票' : '我开出的发票'}</h3><p className="card-subtitle">{monthLabel(this.state.month)} · 共 {this.state.total} 张</p></div></div>{this.state.loading ? <div className="stack"><div className="skeleton" style={{ height: '100px' }}/><div className="skeleton" style={{ height: '100px' }}/></div> : this.state.items.length ? <div className="invoice-list">{this.state.items.map((item: any) => <InvoiceItem key={item.id} item={item} onEdit={(entry: any) => this.setState({ edit: entry })} onVoid={(entry: any) => this.voidItem(entry)} onRestore={(entry: any) => this.restoreItem(entry)}/>)}</div> : <EmptyState title="发票夹还是空的" message={this.state.type === 'received' ? '收到发票后记在这里，再和对应支出关联。' : '开出发票后记在这里，再和对应收入关联。'} action={<button className="btn btn-primary" onClick={() => this.setState({ creating: true })}>记第一张发票</button>}/>}</section>
      <Modal open={this.state.creating || Boolean(this.state.edit)} title={this.state.edit ? '编辑发票' : '记录一张发票'} onClose={() => this.setState({ creating: false, edit: null })}><InvoiceForm initial={this.state.edit} defaultType={this.state.type} transactions={this.state.transactions} onCancel={() => this.setState({ creating: false, edit: null })} onSuccess={() => { this.setState({ creating: false, edit: null }); this.load(); this.props.onChanged(); this.props.onToast('发票已经收进夹子', 'success'); }}/></Modal>
    </div>;
  }
}

class AccountForm extends React.Component<any, any> {
  constructor(props: any) { super(props); const item = props.initial || {}; this.state = { name: item.name || '', type: item.type || 'bank', opening: item.opening_balance_cents ? (item.opening_balance_cents / 100).toFixed(2) : '0.00', color: item.color || '#8E7CDA', saving: false, error: '' }; }
  async submit(event: any): Promise<void> {
    event.preventDefault(); if (!this.state.name.trim()) { this.setState({ error: '请输入账户名称' }); return; }
    this.setState({ saving: true, error: '' });
    try {
      const payload = { name: this.state.name.trim(), type: this.state.type, openingBalanceCents: Math.round(Number(this.state.opening || 0) * 100), icon: this.state.type, color: this.state.color };
      await apiRequest(this.props.initial ? `/api/accounts/${this.props.initial.id}` : '/api/accounts', { method: this.props.initial ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      this.props.onSuccess();
    } catch (error: any) { this.setState({ saving: false, error: error.message }); }
  }
  render(): any { return <form onSubmit={(event: any) => this.submit(event)}><div className="form-grid"><div className="field form-span"><label>账户名称</label><input className="input" maxLength={30} placeholder="例如：工资卡" value={this.state.name} onChange={(event: any) => this.setState({ name: event.target.value })}/></div><div className="field"><label>账户类型</label><select className="select" value={this.state.type} onChange={(event: any) => this.setState({ type: event.target.value })}>{Object.keys(ACCOUNT_TYPE_LABEL).map((key) => <option key={key} value={key}>{ACCOUNT_TYPE_LABEL[key]}</option>)}</select></div><div className="field"><label>期初余额</label><input className="input" inputMode="decimal" value={this.state.opening} onChange={(event: any) => this.setState({ opening: event.target.value })}/></div><div className="field form-span"><label>卡片颜色</label><input className="input" type="color" value={this.state.color} onChange={(event: any) => this.setState({ color: event.target.value })}/></div></div>{this.state.error ? <p className="error-text">{this.state.error}</p> : null}<div className="form-actions"><button type="button" className="btn btn-ghost" onClick={this.props.onCancel}>取消</button><button className="btn btn-primary" disabled={this.state.saving}>{this.state.saving ? '保存中…' : '保存账户'}</button></div></form>; }
}

class AccountsPage extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { loading: true, items: [], edit: null, creating: false }; }
  componentDidMount(): void { this.load(); }
  componentDidUpdate(prevProps: any): void { if (prevProps.refreshToken !== this.props.refreshToken) this.load(); }
  async load(): Promise<void> { this.setState({ loading: true }); try { const items = await apiRequest('/api/accounts'); this.setState({ loading: false, items }); } catch (error: any) { this.setState({ loading: false }); this.props.onError(error.message); } }
  async archive(item: any): Promise<void> { if (!window.confirm(`归档“${item.name}”？历史账目仍会保留。`)) return; try { await apiRequest(`/api/accounts/${item.id}`, { method: 'DELETE' }); this.load(); this.props.onChanged(); this.props.onToast('账户已经归档', 'success'); } catch (error: any) { this.props.onToast(error.message, 'error'); } }
  render(): any { return <div className="page"><PageHeader title="账户" subtitle="现金、支付平台和银行卡都放在这里。"><button className="btn btn-primary" onClick={() => this.setState({ creating: true })}><Icon name="plus" size={18}/>新建账户</button></PageHeader>{this.state.loading ? <LoadingPage/> : this.state.items.length ? <div className="account-grid">{this.state.items.map((item: any) => <article className="account-card" style={{ background: `linear-gradient(135deg, ${item.color}, ${item.color}cc)` }} key={item.id}><div className="account-card-head"><div><div className="account-name">{item.name}</div><div className="account-type">{ACCOUNT_TYPE_LABEL[item.type] || item.type}</div></div><span>{CATEGORY_EMOJI[item.icon] || CATEGORY_EMOJI[item.type] || '💳'}</span></div><div className="account-balance"><AnimatedNumber value={item.balance_cents}>{(value: number) => formatMoney(value)}</AnimatedNumber></div><div className="account-actions"><button onClick={() => this.setState({ edit: item })}>编辑</button><button onClick={() => this.archive(item)}>归档</button></div></article>)}</div> : <EmptyState title="还没有账户" message="先添加一个常用账户，记账会更方便。" action={<button className="btn btn-primary" onClick={() => this.setState({ creating: true })}>添加账户</button>}/>}<Modal open={this.state.creating || Boolean(this.state.edit)} title={this.state.edit ? '编辑账户' : '新建账户'} onClose={() => this.setState({ creating: false, edit: null })}><AccountForm initial={this.state.edit} onCancel={() => this.setState({ creating: false, edit: null })} onSuccess={() => { this.setState({ creating: false, edit: null }); this.load(); this.props.onChanged(); this.props.onToast('账户已经保存', 'success'); }}/></Modal></div>; }
}

class BudgetsPage extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { month: props.month, loading: true, budgets: [], progress: [], values: {}, saving: '' }; }
  componentDidMount(): void { this.load(); }
  componentDidUpdate(prevProps: any): void { if (prevProps.refreshToken !== this.props.refreshToken) this.load(); }
  async load(): Promise<void> {
    this.setState({ loading: true });
    try {
      const [budgets, progress] = await Promise.all([apiRequest(`/api/budgets?period=${this.state.month}`), apiRequest(`/api/stats/budget-progress?month=${this.state.month}`)]);
      const values: any = { total: '' };
      budgets.forEach((item: any) => { values[item.category_id || 'total'] = item.amount_cents ? (item.amount_cents / 100).toFixed(2) : ''; });
      this.setState({ loading: false, budgets, progress: progress.items, values });
    } catch (error: any) { this.setState({ loading: false }); this.props.onError(error.message); }
  }
  async save(categoryId: string | null): Promise<void> {
    const key = categoryId || 'total'; const amountCents = Math.max(0, Math.round(Number(this.state.values[key] || 0) * 100)); this.setState({ saving: key });
    try { await apiRequest('/api/budgets', { method: 'POST', body: JSON.stringify({ period: this.state.month, categoryId, amountCents }) }); this.setState({ saving: '' }); this.load(); this.props.onChanged(); this.props.onToast('预算已经保存', 'success'); }
    catch (error: any) { this.setState({ saving: '' }); this.props.onToast(error.message, 'error'); }
  }
  render(): any {
    const categories = this.props.bootstrap.categories.filter((item: any) => item.type === 'expense' && !item.is_archived);
    const progressMap: any = {}; this.state.progress.forEach((item: any) => { progressMap[item.category_id] = item; });
    return <div className="page"><PageHeader title="预算" subtitle="给生活留一点边界，但不用把自己管得太紧。"><MonthSwitcher month={this.state.month} onChange={(month: string) => this.setState({ month }, () => this.load())}/></PageHeader>{this.state.loading ? <LoadingPage/> : <div className="grid grid-2"><section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">总预算</h3><p className="card-subtitle">不设置也没关系，可以只设分类预算</p></div></div><div className="field"><label>{monthLabel(this.state.month)}总预算</label><div style={{ display: 'flex', gap: '10px' }}><input className="input" inputMode="decimal" placeholder="例如 5000" value={this.state.values.total || ''} onChange={(event: any) => this.setState({ values: { ...this.state.values, total: event.target.value } })}/><button className="btn btn-primary" onClick={() => this.save(null)} disabled={this.state.saving === 'total'}>{this.state.saving === 'total' ? '保存中' : '保存'}</button></div></div><div className="empty-mascot" style={{ margin: '18px auto 0', width: '210px' }}><Mascot variant="idle"/></div></section><section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">分类预算</h3><p className="card-subtitle">常用分类可以单独控制</p></div></div><div>{categories.map((category: any) => { const progress = progressMap[category.id]; const percent = progress ? safePercent(progress.used_cents, progress.amount_cents) : 0; return <div className="budget-row" key={category.id}><div className="budget-top"><span>{CATEGORY_EMOJI[category.icon] || '✨'} {category.name}</span>{progress ? <small>{formatCompactMoney(progress.used_cents)} / {formatCompactMoney(progress.amount_cents)}</small> : <small>未设置</small>}</div>{progress ? <div className="progress-track" style={{ marginBottom: '8px' }}><div className={cn('progress-fill', percent >= 100 ? 'over' : percent >= 80 ? 'notice' : 'normal')} style={{ width: `${Math.max(2, percent)}%` }}/></div> : null}<div style={{ display: 'flex', gap: '8px' }}><input className="input" inputMode="decimal" placeholder="预算金额" value={this.state.values[category.id] || ''} onChange={(event: any) => this.setState({ values: { ...this.state.values, [category.id]: event.target.value } })}/><button className="btn btn-secondary btn-sm" onClick={() => this.save(category.id)} disabled={this.state.saving === category.id}>{this.state.saving === category.id ? '保存中' : '保存'}</button></div></div>; })}</div></section></div>}</div>;
  }
}

class CategoryManager extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { type: 'expense', name: '', color: '#8E7CDA', saving: false }; }
  async add(): Promise<void> { if (!this.state.name.trim()) return; this.setState({ saving: true }); try { await apiRequest('/api/categories', { method: 'POST', body: JSON.stringify({ type: this.state.type, name: this.state.name.trim(), color: this.state.color, icon: 'dots' }) }); this.setState({ name: '', saving: false }); this.props.onChanged(); } catch (error: any) { this.setState({ saving: false }); this.props.onToast(error.message, 'error'); } }
  async archive(item: any): Promise<void> { if (!window.confirm(`归档“${item.name}”分类？`)) return; try { await apiRequest(`/api/categories/${item.id}`, { method: 'DELETE' }); this.props.onChanged(); } catch (error: any) { this.props.onToast(error.message, 'error'); } }
  render(): any { const items = this.props.bootstrap.categories.filter((item: any) => item.type === this.state.type && !item.is_archived); return <div><div className="type-switch" style={{ maxWidth: '360px' }}><button type="button" className={cn(this.state.type === 'expense' && 'active expense')} onClick={() => this.setState({ type: 'expense' })}>支出分类</button><button type="button" className={cn(this.state.type === 'income' && 'active income')} onClick={() => this.setState({ type: 'income' })}>收入分类</button><button type="button" disabled>共 {items.length} 个</button></div><div className="category-grid" style={{ margin: '14px 0 18px' }}>{items.map((item: any) => <div className="category-chip" key={item.id} style={{ position: 'relative' }}><span className="emoji">{CATEGORY_EMOJI[item.icon] || '✨'}</span><span>{item.name}</span><button type="button" onClick={() => this.archive(item)} title="归档分类" style={{ position: 'absolute', right: 2, top: 2, border: 0, background: 'transparent', color: '#9C95A8', cursor: 'pointer' }}>×</button></div>)}</div><div className="form-grid"><div className="field"><label>新分类名称</label><input className="input" maxLength={20} placeholder="例如：咖啡" value={this.state.name} onChange={(event: any) => this.setState({ name: event.target.value })}/></div><div className="field"><label>分类颜色</label><input className="input" type="color" value={this.state.color} onChange={(event: any) => this.setState({ color: event.target.value })}/></div></div><div className="form-actions"><button className="btn btn-primary" onClick={() => this.add()} disabled={this.state.saving || !this.state.name.trim()}>{this.state.saving ? '添加中…' : '添加分类'}</button></div></div>; }
}


function AuthFrame(props: any): any {
  return <main className="auth-page">
    <section className="auth-visual" aria-hidden="true">
      <div className="auth-visual-copy"><span className="auth-kicker">芋炮小账本</span><h1>两个人的小日子，<br/>都认真记下来。</h1><p>数据只存进你自己的 Cloudflare D1，不使用第三方登录服务。</p></div>
      <Mascot variant={props.variant || 'idle'} label="芋头和小炮台守护小账本"/>
    </section>
    <section className="auth-panel"><div className="auth-card"><div className="auth-brand"><LogoMark/><div><strong>芋炮小账本</strong><span>{props.subtitle || '两个人的小日子'}</span></div></div>{props.children}</div></section>
  </main>;
}

class LoginPage extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { email: '', password: '', rememberMe: true, saving: false, error: '', showPassword: false }; }
  async submit(event: any): Promise<void> {
    event.preventDefault(); this.setState({ saving: true, error: '' });
    try {
      const params = await fetchPasswordParams(this.state.email);
      const passwordProof = await derivePasswordProof(this.state.password, params.salt, params.iterations);
      const result = await apiRequest<{ user: AuthUser; csrfToken: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: this.state.email, passwordProof, rememberMe: this.state.rememberMe }) });
      this.setState({ saving: false, password: '' }); this.props.onLogin(result);
    } catch (error: any) { this.setState({ saving: false, error: error.message || '登录失败' }); }
  }
  render(): any { return <AuthFrame subtitle="欢迎回来" variant="idle"><div className="auth-heading"><h2>登录小账本</h2><p>使用初始化时设置的邮箱和密码。</p></div><form className="auth-form" onSubmit={(event: any) => this.submit(event)}><div className="field"><label>邮箱</label><input className="input" type="email" autoComplete="username" required maxLength={160} value={this.state.email} onChange={(event: any) => this.setState({ email: event.target.value })} placeholder="name@example.com"/></div><div className="field"><label>密码</label><div className="password-field"><input className="input" type={this.state.showPassword ? 'text' : 'password'} autoComplete="current-password" required value={this.state.password} onChange={(event: any) => this.setState({ password: event.target.value })} placeholder="请输入密码"/><button type="button" onClick={() => this.setState({ showPassword: !this.state.showPassword })}>{this.state.showPassword ? '隐藏' : '显示'}</button></div></div><label className="check-row"><input type="checkbox" checked={this.state.rememberMe} onChange={(event: any) => this.setState({ rememberMe: event.target.checked })}/><span>在这台私人设备上保持登录 30 天</span></label>{this.state.error ? <div className="form-error">{this.state.error}</div> : null}<button className="btn btn-primary auth-submit" type="submit" disabled={this.state.saving}>{this.state.saving ? '正在登录…' : '登录'}</button><button className="text-button" type="button" onClick={this.props.onRecover}>忘记密码？使用恢复码</button></form><p className="auth-footnote">连续输错 5 次会临时锁定 15 分钟。</p></AuthFrame>; }
}

class RecoverPage extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { email: '', recoveryCode: '', newPassword: '', confirmPassword: '', saving: false, error: '', success: false }; }
  async submit(event: any): Promise<void> {
    event.preventDefault();
    if (this.state.newPassword !== this.state.confirmPassword) { this.setState({ error: '两次输入的新密码不一致' }); return; }
    const validation = passwordValidationMessage(this.state.newPassword, this.state.email);
    if (validation) { this.setState({ error: validation }); return; }
    this.setState({ saving: true, error: '' });
    try {
      const params = await fetchPasswordParams(this.state.email);
      const newCredential = await createClientCredential(this.state.newPassword, params.iterations);
      await apiRequest('/api/auth/recover', { method: 'POST', body: JSON.stringify({ email: this.state.email, recoveryCode: this.state.recoveryCode, newCredential }) });
      this.setState({ saving: false, success: true, newPassword: '', confirmPassword: '' });
    } catch (error: any) { this.setState({ saving: false, error: error.message || '恢复失败' }); }
  }
  render(): any { return <AuthFrame subtitle="账号恢复" variant={this.state.success ? 'success' : 'empty'}>{this.state.success ? <div className="auth-result"><h2>密码已经重设</h2><p>旧设备上的登录状态已全部失效。现在可以使用新密码登录。</p><button className="btn btn-primary auth-submit" onClick={this.props.onBack}>返回登录</button></div> : <><div className="auth-heading"><h2>使用恢复码</h2><p>恢复码只能使用一次，重设后其他设备会退出登录。</p></div><form className="auth-form" onSubmit={(event: any) => this.submit(event)}><div className="field"><label>邮箱</label><input className="input" type="email" required autoComplete="username" value={this.state.email} onChange={(event: any) => this.setState({ email: event.target.value })}/></div><div className="field"><label>恢复码</label><input className="input recovery-input" required autoCapitalize="characters" value={this.state.recoveryCode} onChange={(event: any) => this.setState({ recoveryCode: event.target.value })} placeholder="YP-XXXX-XXXX-XXXX-XXXX"/></div><div className="field"><label>新密码</label><input className="input" type="password" required autoComplete="new-password" value={this.state.newPassword} onChange={(event: any) => this.setState({ newPassword: event.target.value })} placeholder="至少 12 位，包含字母和数字"/></div><div className="field"><label>确认新密码</label><input className="input" type="password" required autoComplete="new-password" value={this.state.confirmPassword} onChange={(event: any) => this.setState({ confirmPassword: event.target.value })}/></div>{this.state.error ? <div className="form-error">{this.state.error}</div> : null}<button className="btn btn-primary auth-submit" type="submit" disabled={this.state.saving}>{this.state.saving ? '正在重设…' : '重设密码'}</button><button className="text-button" type="button" onClick={this.props.onBack}>返回登录</button></form></>}</AuthFrame>; }
}

function downloadRecoveryCodes(result: any): void {
  const lines = [`芋炮小账本恢复码`, `生成时间：${new Date().toLocaleString('zh-CN')}`, '', ...result.accounts.flatMap((account: any) => [`${account.displayName}（${account.email} / ${account.role === 'owner' ? '管理员' : '家庭成员'}）`, ...account.recoveryCodes, '']), '每个恢复码只能使用一次，请离线保存。'];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = '芋炮小账本-恢复码.txt'; link.click(); URL.revokeObjectURL(link.href);
}

class SetupPage extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { householdName: '芋炮之家', ownerName: '', ownerEmail: '', ownerPassword: '', ownerConfirm: '', memberName: '', memberEmail: '', memberPassword: '', memberConfirm: '', setupToken: '', saving: false, error: '', result: null }; }
  async submit(event: any): Promise<void> {
    event.preventDefault();
    if (this.state.ownerPassword !== this.state.ownerConfirm || this.state.memberPassword !== this.state.memberConfirm) { this.setState({ error: '请确认两个账号的密码输入一致' }); return; }
    const ownerValidation = passwordValidationMessage(this.state.ownerPassword, this.state.ownerEmail);
    const memberValidation = passwordValidationMessage(this.state.memberPassword, this.state.memberEmail);
    if (ownerValidation || memberValidation) { this.setState({ error: ownerValidation ? `管理员账号：${ownerValidation}` : `家庭成员账号：${memberValidation}` }); return; }
    this.setState({ saving: true, error: '' });
    try {
      const iterations = Number(this.props.passwordIterations || 120000);
      const [ownerCredential, memberCredential] = await Promise.all([
        createClientCredential(this.state.ownerPassword, iterations),
        createClientCredential(this.state.memberPassword, iterations),
      ]);
      const result = await apiRequest('/api/auth/setup', { method: 'POST', body: JSON.stringify({ clientVersion: APP_VERSION, householdName: this.state.householdName, ownerName: this.state.ownerName, ownerEmail: this.state.ownerEmail, ownerCredential, memberName: this.state.memberName, memberEmail: this.state.memberEmail, memberCredential, setupToken: this.state.setupToken }) });
      this.setState({ saving: false, result, ownerPassword: '', ownerConfirm: '', memberPassword: '', memberConfirm: '', setupToken: '' });
    } catch (error: any) { this.setState({ saving: false, error: error.message || '初始化失败' }); }
  }
  render(): any {
    if (this.state.result) return <AuthFrame subtitle="初始化完成" variant="success"><div className="auth-heading"><h2>两个账号已经准备好</h2><p>恢复码只显示这一次。请下载后分别安全保存。</p></div><div className="recovery-accounts">{this.state.result.accounts.map((account: any) => <section className="recovery-card" key={account.email}><strong>{account.displayName}</strong><span>{account.email} · {account.role === 'owner' ? '管理员' : '家庭成员'}</span><code>{account.recoveryCodes.join('\n')}</code></section>)}</div><button className="btn btn-secondary auth-submit" onClick={() => downloadRecoveryCodes(this.state.result)}><Icon name="download" size={17}/>下载恢复码</button><button className="btn btn-primary auth-submit" onClick={this.props.onComplete}>我已保存，去登录</button></AuthFrame>;
    return <AuthFrame subtitle="首次初始化" variant="idle"><div className="auth-heading"><h2>创建你们的两个账号</h2><p>此页面只在首次初始化时开放。密码不会以明文保存。</p></div><form className="auth-form setup-form" onSubmit={(event: any) => this.submit(event)}><div className="field"><label>家庭名称</label><input className="input" maxLength={40} required value={this.state.householdName} onChange={(event: any) => this.setState({ householdName: event.target.value })}/></div><div className="setup-columns"><fieldset><legend>管理员账号</legend><div className="field"><label>昵称</label><input className="input" required maxLength={24} value={this.state.ownerName} onChange={(event: any) => this.setState({ ownerName: event.target.value })}/></div><div className="field"><label>邮箱</label><input className="input" type="email" required value={this.state.ownerEmail} onChange={(event: any) => this.setState({ ownerEmail: event.target.value })}/></div><div className="field"><label>密码</label><input className="input" type="password" required autoComplete="new-password" value={this.state.ownerPassword} onChange={(event: any) => this.setState({ ownerPassword: event.target.value })} placeholder="至少 12 位，包含字母和数字"/></div><div className="field"><label>确认密码</label><input className="input" type="password" required value={this.state.ownerConfirm} onChange={(event: any) => this.setState({ ownerConfirm: event.target.value })}/></div></fieldset><fieldset><legend>家庭成员账号</legend><div className="field"><label>昵称</label><input className="input" required maxLength={24} value={this.state.memberName} onChange={(event: any) => this.setState({ memberName: event.target.value })}/></div><div className="field"><label>邮箱</label><input className="input" type="email" required value={this.state.memberEmail} onChange={(event: any) => this.setState({ memberEmail: event.target.value })}/></div><div className="field"><label>密码</label><input className="input" type="password" required autoComplete="new-password" value={this.state.memberPassword} onChange={(event: any) => this.setState({ memberPassword: event.target.value })} placeholder="至少 12 位，包含字母和数字"/></div><div className="field"><label>确认密码</label><input className="input" type="password" required value={this.state.memberConfirm} onChange={(event: any) => this.setState({ memberConfirm: event.target.value })}/></div></fieldset></div><div className="field"><label>初始化密钥</label><input className="input" type="password" required autoComplete="off" value={this.state.setupToken} onChange={(event: any) => this.setState({ setupToken: event.target.value })} placeholder="Cloudflare 中设置的 SETUP_TOKEN"/><small>这是部署后台的初始化密钥，不是登录密码。</small></div>{this.state.error ? <div className="form-error">{this.state.error}</div> : null}<button className="btn btn-primary auth-submit" type="submit" disabled={this.state.saving}>{this.state.saving ? '正在创建账号…' : '创建两个账号'}</button></form></AuthFrame>;
  }
}

function AuthConfigurationPage(props: any): any {
  const status = props.status || {};
  return <AuthFrame subtitle="还差一步配置" variant="empty"><div className="auth-heading"><h2>认证模块尚未准备好</h2><p>业务数据没有受到影响，按下面提示完成配置后刷新页面。</p></div><div className="config-steps">{!status.schemaReady ? <div><strong>初始化认证数据表</strong><p>在 D1 Console 中执行 <code>migrations/0002_internal_auth.sql</code>。</p></div> : null}{status.pepperReady === false ? <div><strong>设置 PASSWORD_PEPPER</strong><p>在 Settings → Variables and Secrets 中添加长期保存的 <code>PASSWORD_PEPPER</code> Secret。</p></div> : null}{!status.configured && status.setupTokenReady === false ? <div><strong>设置 SETUP_TOKEN</strong><p>添加仅用于首次初始化的 <code>SETUP_TOKEN</code> Secret。</p></div> : null}</div><button className="btn btn-primary auth-submit" onClick={props.onRetry}>我已完成，重新检查</button></AuthFrame>;
}

class SecuritySettings extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { mode: '', currentPassword: '', newPassword: '', confirmPassword: '', saving: false, error: '', codes: null }; }
  close(): void { this.setState({ mode: '', currentPassword: '', newPassword: '', confirmPassword: '', saving: false, error: '', codes: null }); }
  async changePassword(event: any): Promise<void> {
    event.preventDefault();
    if (this.state.newPassword !== this.state.confirmPassword) { this.setState({ error: '两次输入的新密码不一致' }); return; }
    const validation = passwordValidationMessage(this.state.newPassword, this.props.email);
    if (validation) { this.setState({ error: validation }); return; }
    this.setState({ saving: true, error: '' });
    try {
      const params = await fetchPasswordParams(this.props.email);
      const [currentPasswordProof, newCredential] = await Promise.all([
        derivePasswordProof(this.state.currentPassword, params.salt, params.iterations),
        createClientCredential(this.state.newPassword, params.iterations),
      ]);
      const result = await apiRequest<{ changed: boolean; csrfToken: string }>('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPasswordProof, newCredential }) });
      if (result.csrfToken) setClientAuth(result.csrfToken);
      this.close(); this.props.onToast('密码已经修改，所有旧会话已轮换', 'success');
    } catch (error: any) { this.setState({ saving: false, error: error.message }); }
  }
  async regenerate(event: any): Promise<void> {
    event.preventDefault(); this.setState({ saving: true, error: '' });
    try {
      const params = await fetchPasswordParams(this.props.email);
      const currentPasswordProof = await derivePasswordProof(this.state.currentPassword, params.salt, params.iterations);
      const result = await apiRequest('/api/auth/recovery-codes', { method: 'POST', body: JSON.stringify({ currentPasswordProof }) });
      this.setState({ saving: false, currentPassword: '', codes: result.recoveryCodes });
    } catch (error: any) { this.setState({ saving: false, error: error.message }); }
  }
  async revoke(): Promise<void> { if (!window.confirm('退出这个账号在其他设备上的登录？当前设备会继续保持登录。')) return; try { await apiRequest('/api/auth/revoke-other-sessions', { method: 'POST', body: '{}' }); this.props.onToast('其他设备已经退出登录', 'success'); } catch (error: any) { this.props.onToast(error.message, 'error'); } }
  render(): any { return <><div className="settings-list"><div className="setting-row"><div><h4>修改密码</h4><p>修改后会退出这个账号在其他设备上的登录</p></div><button className="btn btn-secondary btn-sm" onClick={() => this.setState({ mode: 'password' })}>修改</button></div><div className="setting-row"><div><h4>重新生成恢复码</h4><p>旧的未使用恢复码会立即失效</p></div><button className="btn btn-secondary btn-sm" onClick={() => this.setState({ mode: 'codes' })}>生成</button></div><div className="setting-row"><div><h4>退出其他设备</h4><p>适用于设备遗失或忘记退出的情况</p></div><button className="btn btn-secondary btn-sm" onClick={() => this.revoke()}>退出</button></div><div className="setting-row"><div><h4>退出当前账号</h4><p>{this.props.email}</p></div><button className="btn btn-danger btn-sm" onClick={this.props.onLogout}>退出登录</button></div></div><Modal open={this.state.mode === 'password'} title="修改密码" onClose={() => this.close()}><form className="auth-form" onSubmit={(event: any) => this.changePassword(event)}><div className="field"><label>当前密码</label><input className="input" type="password" required value={this.state.currentPassword} onChange={(event: any) => this.setState({ currentPassword: event.target.value })}/></div><div className="field"><label>新密码</label><input className="input" type="password" required value={this.state.newPassword} onChange={(event: any) => this.setState({ newPassword: event.target.value })} placeholder="至少 12 位，包含字母和数字"/></div><div className="field"><label>确认新密码</label><input className="input" type="password" required value={this.state.confirmPassword} onChange={(event: any) => this.setState({ confirmPassword: event.target.value })}/></div>{this.state.error ? <div className="form-error">{this.state.error}</div> : null}<div className="form-actions"><button className="btn btn-secondary" type="button" onClick={() => this.close()}>取消</button><button className="btn btn-primary" type="submit" disabled={this.state.saving}>{this.state.saving ? '修改中…' : '确认修改'}</button></div></form></Modal><Modal open={this.state.mode === 'codes'} title="重新生成恢复码" onClose={() => this.close()}>{this.state.codes ? <div><p className="modal-note">这些恢复码只显示这一次，请立即保存。</p><code className="codes-block">{this.state.codes.join('\n')}</code><button className="btn btn-primary auth-submit" onClick={() => { navigator.clipboard?.writeText(this.state.codes.join('\n')); this.props.onToast('恢复码已复制', 'success'); }}>复制恢复码</button></div> : <form className="auth-form" onSubmit={(event: any) => this.regenerate(event)}><div className="field"><label>当前密码</label><input className="input" type="password" required value={this.state.currentPassword} onChange={(event: any) => this.setState({ currentPassword: event.target.value })}/></div>{this.state.error ? <div className="form-error">{this.state.error}</div> : null}<button className="btn btn-primary auth-submit" type="submit" disabled={this.state.saving}>{this.state.saving ? '生成中…' : '确认并生成'}</button></form>}</Modal></>; }
}

function SettingsPage(props: any): any {
  const reduceMotion = props.reduceMotion;
  return <div className="page"><PageHeader title="设置" subtitle="调整小账本的使用方式和数据管理。"/><div className="grid grid-2"><section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">你们的小账本</h3><p className="card-subtitle">当前登录与家庭空间</p></div></div><div className="setting-row"><div><h4>{props.bootstrap.household.name}</h4><p>{props.bootstrap.user.displayName} · {props.bootstrap.user.role === 'owner' ? '管理员' : '家庭成员'}</p></div><div className="avatar">{props.bootstrap.user.displayName.slice(0, 1)}</div></div><div className="setting-row"><div><h4>轻动画</h4><p>关闭后会减少角色、图表和页面转场动画</p></div><button className={cn('switch', !reduceMotion && 'on')} onClick={() => props.onMotionChange(!reduceMotion)} aria-label="切换动画"><span/></button></div><div className="setting-row"><div><h4>账户管理</h4><p>添加、修改或归档常用账户</p></div><button className="btn btn-secondary btn-sm" onClick={() => props.navigate('accounts')}>打开</button></div><div className="setting-row"><div><h4>预算管理</h4><p>设置每月总预算和分类预算</p></div><button className="btn btn-secondary btn-sm" onClick={() => props.navigate('budgets')}>打开</button></div></section><section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">账号与安全</h3><p className="card-subtitle">密码、恢复码和设备会话</p></div></div><SecuritySettings email={props.bootstrap.user.email} onLogout={props.onLogout} onToast={props.onToast}/></section><section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">数据导出</h3><p className="card-subtitle">建议定期留一份自己能读取的副本</p></div></div><div className="settings-list"><div className="setting-row"><div><h4>CSV 表格</h4><p>适合用 Excel 或其他表格工具打开</p></div><a className="btn btn-secondary btn-sm" href="/api/export/csv"><Icon name="download" size={16}/>导出</a></div><div className="setting-row"><div><h4>JSON 完整数据</h4><p>适合迁移、恢复或程序读取</p></div><a className="btn btn-secondary btn-sm" href="/api/export/json"><Icon name="download" size={16}/>导出</a></div></div><div className="divider"/><div className="card-title-row"><div><h3 className="card-title">关于芋炮小账本</h3><p className="card-subtitle">版本 0.3.2 · 分类概览模块重构</p></div></div><p style={{ color: 'var(--text-2)', lineHeight: 1.8, fontSize: '13px' }}>没有广告和第三方行为追踪。密码在浏览器内使用 PBKDF2 和独立盐值处理，服务端再结合 Pepper 保存验证值；登录会话只保存在安全 Cookie 中。</p><div style={{ width: '230px', margin: '8px auto 0' }}><Mascot variant="safe"/></div></section><section className="card card-pad form-span"><div className="card-title-row"><div><h3 className="card-title">分类管理</h3><p className="card-subtitle">新增分类或归档暂时不用的分类</p></div></div><CategoryManager bootstrap={props.bootstrap} onChanged={props.onChanged} onToast={props.onToast}/></section></div></div>;
}

class App extends React.Component<any, any> {
  toastTimer: number | null = null;
  constructor(props: any) {
    super(props);
    const route = this.routeFromHash();
    const reduceMotion = localStorage.getItem('yupao-reduce-motion') === 'true';
    this.state = { route, authPhase: 'checking', setupStatus: null, bootstrap: null, loading: true, error: '', online: navigator.onLine, toast: null, month: currentMonth(), refreshToken: 0, reduceMotion };
    this.onHashChange = this.onHashChange.bind(this); this.onOnline = this.onOnline.bind(this); this.onOffline = this.onOffline.bind(this);
  }
  routeFromHash(): RouteKey { const value = location.hash.replace(/^#\/?/, '').split('/')[0] as RouteKey; return ROUTES.some((route) => route.key === value) ? value : 'home'; }
  componentDidMount(): void {
    window.addEventListener('hashchange', this.onHashChange); window.addEventListener('online', this.onOnline); window.addEventListener('offline', this.onOffline);
    this.applyMotion(this.state.reduceMotion);
    authExpiredHandler = () => this.endSession('登录已失效，请重新登录');
    this.initializeAuth();
    registerServiceWorker(() => this.showToast('小账本有新版本，刷新页面即可更新', 'default'));
  }
  componentDidUpdate(_: any, prevState: any): void {
    if (prevState.route !== this.state.route || prevState.authPhase !== this.state.authPhase || prevState.loading !== this.state.loading || prevState.refreshToken !== this.state.refreshToken) schedulePageMotion();
  }
  componentWillUnmount(): void { window.removeEventListener('hashchange', this.onHashChange); window.removeEventListener('online', this.onOnline); window.removeEventListener('offline', this.onOffline); clearMotionRegistry(); authExpiredHandler = null; }
  onHashChange(): void { this.setState({ route: this.routeFromHash() }); window.scrollTo(0, 0); }
  onOnline(): void { this.setState({ online: true }); this.showToast('网络已经恢复', 'success'); }
  onOffline(): void { this.setState({ online: false }); }
  navigate(route: RouteKey): void { location.hash = `#/${route}`; }
  async initializeAuth(): Promise<void> {
    this.setState({ authPhase: 'checking', error: '', loading: true });
    try {
      const status = await apiRequest<SetupStatus>('/api/auth/setup-status');
      if (!status.schemaReady || !status.secretsReady) { this.setState({ authPhase: 'config', setupStatus: status, loading: false }); return; }
      if (!status.configured) { this.setState({ authPhase: 'setup', setupStatus: status, loading: false }); return; }
      try {
        const session = await apiRequest<{ user: AuthUser; csrfToken: string }>('/api/auth/session'); setClientAuth(session.csrfToken); await this.loadBootstrap(true);
      } catch (error: any) {
        if (error.status === 401) { setClientAuth(''); this.setState({ authPhase: 'login', loading: false, bootstrap: null }); return; }
        throw error;
      }
    } catch (error: any) { this.setState({ authPhase: 'error', error: error.message || '小账本暂时打不开', loading: false }); }
  }
  async loadBootstrap(initial = false): Promise<void> {
    this.setState({ loading: true, error: '' });
    try { const bootstrap = await apiRequest<Bootstrap>(`/api/bootstrap?month=${this.state.month}`); this.setState({ bootstrap, loading: false, authPhase: 'app' }); }
    catch (error: any) { if (error.status === 401) return; this.setState({ loading: false, error: error.message || '小账本暂时打不开', authPhase: initial ? 'error' : this.state.authPhase }); }
  }
  async handleLogin(result: { user: AuthUser; csrfToken: string }): Promise<void> { setClientAuth(result.csrfToken); await this.loadBootstrap(true); }
  endSession(message = ''): void { setClientAuth(''); this.setState({ authPhase: 'login', bootstrap: null, loading: false, error: '' }); if (message) this.showToast(message, 'error'); }
  async logout(): Promise<void> { try { await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' }); } catch {} this.endSession(); }
  changed(): void { this.setState({ refreshToken: this.state.refreshToken + 1 }, () => this.loadBootstrap()); }
  showToast(message: string, kind: 'default' | 'success' | 'error' = 'default', actionLabel?: string, action?: () => void): void { if (this.toastTimer) window.clearTimeout(this.toastTimer); this.setState({ toast: { message, kind, actionLabel, action } }); this.toastTimer = window.setTimeout(() => this.setState({ toast: null }), action ? 6500 : 3200); }
  applyMotion(reduce: boolean): void { document.body.classList.toggle('reduce-motion', reduce); if (reduce) clearMotionRegistry(); else schedulePageMotion(); }
  changeMotion(reduce: boolean): void { localStorage.setItem('yupao-reduce-motion', String(reduce)); this.applyMotion(reduce); this.setState({ reduceMotion: reduce }); }
  renderPage(): any {
    const common = { bootstrap: this.state.bootstrap, month: this.state.month, refreshToken: this.state.refreshToken, navigate: (route: RouteKey) => this.navigate(route), onChanged: () => this.changed(), onError: (message: string) => this.showToast(message, 'error'), onToast: (message: string, kind?: any, actionLabel?: string, action?: () => void) => this.showToast(message, kind, actionLabel, action) };
    switch (this.state.route) { case 'transactions': return <TransactionsPage {...common}/>; case 'add': return <AddPage {...common}/>; case 'invoices': return <InvoicesPage {...common}/>; case 'stats': return <StatsPage {...common}/>; case 'accounts': return <AccountsPage {...common}/>; case 'budgets': return <BudgetsPage {...common}/>; case 'settings': return <SettingsPage {...common} reduceMotion={this.state.reduceMotion} onMotionChange={(value: boolean) => this.changeMotion(value)} onLogout={() => this.logout()}/>; default: return <DashboardPage {...common} onMonthChange={(month: string) => this.setState({ month }, () => this.changed())}/>; }
  }
  render(): any {
    const phase = this.state.authPhase;
    if (phase === 'checking') return <LoadingPage/>;
    if (phase === 'config') return <AuthConfigurationPage status={this.state.setupStatus} onRetry={() => this.initializeAuth()}/>;
    if (phase === 'setup') return <SetupPage passwordIterations={this.state.setupStatus?.passwordIterations || 120000} onComplete={() => this.setState({ authPhase: 'login' })}/>;
    if (phase === 'recover') return <RecoverPage onBack={() => this.setState({ authPhase: 'login' })}/>;
    if (phase === 'login') return <LoginPage onLogin={(result: any) => this.handleLogin(result)} onRecover={() => this.setState({ authPhase: 'recover' })}/>;
    if (phase === 'error' || (this.state.error && !this.state.bootstrap)) return <div className="loading-page"><div><div style={{ width: '240px' }}><Mascot variant="empty"/></div><h2>小账本暂时打不开</h2><p style={{ color: 'var(--text-2)' }}>{this.state.error}</p><button className="btn btn-primary" onClick={() => this.initializeAuth()}>再试一次</button></div></div>;
    if (this.state.loading && !this.state.bootstrap) return <LoadingPage/>;
    const bootstrap = this.state.bootstrap as Bootstrap; const toast = this.state.toast as ToastState;
    return <div className="app-shell">{!this.state.online ? <div className="offline-banner">现在没有网络，连上后再记账吧。</div> : null}<aside className="sidebar"><a className="brand" href="#/home"><span className="brand-mark"><LogoMark/></span><span className="brand-copy"><strong>芋炮小账本</strong><span>两个人的小日子</span></span></a><nav className="nav-list">{ROUTES.map((route) => <button key={route.key} className={cn('nav-item', this.state.route === route.key && 'active')} onClick={() => this.navigate(route.key)}><Icon name={route.icon}/><span>{route.label}</span></button>)}</nav><div className="sidebar-bottom"><div className="member-pill"><div className="avatar">{bootstrap.user.displayName.slice(0, 1)}</div><div><strong>{bootstrap.user.displayName}</strong><small>{bootstrap.household.name}</small></div></div></div></aside><header className="mobile-topbar"><div className="mobile-brand"><LogoMark/><span>芋炮小账本</span></div><button className="avatar avatar-button" type="button" onClick={() => this.navigate('settings')} aria-label="打开设置">{bootstrap.user.displayName.slice(0, 1)}</button></header><main className="main">{this.renderPage()}</main><nav className="bottom-nav">{ROUTES.filter((route) => route.mobile).map((route) => <button key={route.key} className={cn(this.state.route === route.key && 'active', route.key === 'add' && 'center')} onClick={() => this.navigate(route.key)}>{route.key === 'add' ? <span className="nav-icon-wrap"><Icon name={route.icon}/></span> : <Icon name={route.icon}/>}<span>{route.label}</span></button>)}</nav>{toast ? <div className={cn('toast', toast.kind)}><span>{toast.message}</span>{toast.action ? <button onClick={() => { toast.action && toast.action(); this.setState({ toast: null }); }}>{toast.actionLabel || '操作'}</button> : null}</div> : null}</div>;
  }
}

ReactDOM.render(<App/>, document.getElementById('root'));
