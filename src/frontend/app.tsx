/* global React, ReactDOM */

type RouteKey = 'home' | 'transactions' | 'add' | 'stats' | 'accounts' | 'budgets' | 'settings';
type TransactionType = 'expense' | 'income' | 'transfer';

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
const APP_VERSION = '0.2.4';
let authExpiredHandler: (() => void) | null = null;

function setClientAuth(csrfToken = ''): void {
  currentCsrfToken = csrfToken;
}

const ROUTES: Array<{ key: RouteKey; label: string; icon: string; mobile: boolean }> = [
  { key: 'home', label: '首页', icon: 'home', mobile: true },
  { key: 'transactions', label: '明细', icon: 'list', mobile: true },
  { key: 'add', label: '记一笔', icon: 'plus', mobile: true },
  { key: 'stats', label: '统计', icon: 'chart', mobile: true },
  { key: 'accounts', label: '账户', icon: 'wallet', mobile: false },
  { key: 'budgets', label: '预算', icon: 'target', mobile: false },
  { key: 'settings', label: '设置', icon: 'settings', mobile: true },
];

const CATEGORY_EMOJI: Record<string, string> = {
  bowl: '🍜', basket: '🥬', cup: '🧋', bag: '🧴', car: '🚗', home: '🏠', bolt: '💡', paw: '🐾',
  shopping: '🛍️', game: '🎮', medical: '🩹', plane: '✈️', gift: '🎁', dots: '✨', wallet: '💰',
  star: '⭐', receipt: '🧾', briefcase: '💼', store: '🏪', trend: '📈', cash: '💵', wechat: '💬',
  alipay: '🔵', card: '💳', bank: '🏦', credit: '💳', stored: '🎫', other: '🧺',
};

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

function Icon(props: any): any {
  let content: any;
  switch (props.name) {
    case 'home': content = <path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5H15v-6H9v6H4.5A1.5 1.5 0 0 1 3 19.5z" />; break;
    case 'list': content = <g><path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></g>; break;
    case 'plus': content = <path d="M12 5v14M5 12h14"/>; break;
    case 'chart': content = <g><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></g>; break;
    case 'wallet': content = <g><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H19a2 2 0 0 1 2 2v13H5.5A2.5 2.5 0 0 1 3 16.5z"/><path d="M16 10h6v5h-6a2.5 2.5 0 0 1 0-5Z"/><circle cx="17" cy="12.5" r=".7" fill="currentColor" stroke="none"/></g>; break;
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

function LogoMark(): any {
  return <svg viewBox="0 0 64 64" width="44" height="44" aria-hidden="true">
    <rect width="64" height="64" rx="18" fill="#FFF8F1"/>
    <ellipse cx="24" cy="35" rx="15" ry="18" fill="#A78BDA"/>
    <path d="M19 18c3-8 9-9 12-4-5 0-8 2-12 4Z" fill="#6FA47D"/>
    <circle cx="20" cy="34" r="2" fill="#302A39"/><circle cx="28" cy="34" r="2" fill="#302A39"/>
    <path d="M21 41c2 2 5 2 7 0" stroke="#302A39" strokeWidth="2" fill="none" strokeLinecap="round"/>
    <path d="M11 43h7v3h-7z" fill="#F5EEFF" transform="rotate(-10 11 43)"/>
    <rect x="37" y="31" width="17" height="13" rx="6.5" fill="#4F7C64"/>
    <rect x="48" y="25" width="11" height="8" rx="4" fill="#355646"/>
    <circle cx="42" cy="47" r="4" fill="#252A28"/><circle cx="51" cy="47" r="4" fill="#252A28"/>
    <circle cx="43" cy="37" r="1.5" fill="#9ED36A"/><circle cx="49" cy="37" r="1.5" fill="#9ED36A"/>
  </svg>;
}

function Mascot(props: any): any {
  const variant = props.variant || 'idle';
  const isSuccess = variant === 'success';
  const isWarning = variant === 'warning';
  const isEmpty = variant === 'empty';
  const isSafe = variant === 'safe';
  const isSummary = variant === 'summary';

  return <svg className={cn('mascot', variant)} viewBox="0 0 360 230" role="img" aria-label={props.label || '芋头记账小助手和绿黑玩具炮台小管家'}>
    <ellipse cx="175" cy="207" rx="128" ry="13" fill="#DCD4E2" opacity=".5"/>

    <g className="taro-body">
      <path d="M105 65c-11 19-18 47-13 78 7 42 32 67 70 67 39 0 65-25 72-67 5-32-3-62-17-80-21-25-88-24-112 2Z" fill="#A78BDA"/>
      <path d="M114 72c21-15 80-17 104 2" fill="none" stroke="#D9C8F2" strokeWidth="9" strokeLinecap="round" opacity=".88"/>
      <path d="M103 124c8 10 11 28 8 45M220 122c-8 12-10 29-7 44" fill="none" stroke="#8061B5" strokeWidth="5" strokeLinecap="round" opacity=".65"/>
      <g className="leaf">
        <path d="M145 67c-18-27-11-48 6-52 11 15 12 33-6 52Z" fill="#5F956F"/>
        <path d="M159 64c5-32 26-42 40-31-1 18-14 31-40 31Z" fill="#75AD82"/>
      </g>
      <g className="taro-brows" fill="none" stroke="#6D4FA2" strokeWidth="2.4" strokeLinecap="round"><path d="M132 113c4-3 9-3 13 0"/><path d="M180 113c4-3 9-3 13 0"/></g>
      <g className="eye"><circle cx="139" cy="125" r="5" fill="#302A39"/><circle cx="187" cy="125" r="5" fill="#302A39"/><circle cx="137.5" cy="123.5" r="1.2" fill="white"/><circle cx="185.5" cy="123.5" r="1.2" fill="white"/></g>
      {isEmpty
        ? <path d="M154 151c7-4 14-4 21 0" fill="none" stroke="#302A39" strokeWidth="3.5" strokeLinecap="round"/>
        : <path d="M150 148c10 10 24 10 34 0" fill="none" stroke="#302A39" strokeWidth="4" strokeLinecap="round"/>}
      <ellipse cx="121" cy="143" rx="11" ry="6" fill="#E9B7D4" opacity=".62"/>
      <ellipse cx="204" cy="143" rx="11" ry="6" fill="#E9B7D4" opacity=".62"/>

      <g className="taro-arm taro-arm-left">
        <path d="M114 163c-18 3-27 13-25 27" fill="none" stroke="#8061B5" strokeWidth="9" strokeLinecap="round"/>
        <circle cx="90" cy="190" r="6" fill="#A78BDA"/>
      </g>
      <g className="taro-arm taro-arm-right">
        <path d="M214 162c18 2 28 11 29 24" fill="none" stroke="#8061B5" strokeWidth="9" strokeLinecap="round"/>
        <circle cx="243" cy="186" r="6" fill="#A78BDA"/>
        <g className="taro-pencil" transform="rotate(-18 247 176)">
          <rect x="241" y="153" width="7" height="31" rx="3.5" fill="#F3C969"/>
          <path d="m241 153 3.5-7 3.5 7Z" fill="#66513B"/>
          <rect x="241" y="176" width="7" height="8" rx="2.5" fill="#E9B7D4"/>
        </g>
      </g>

      <g className="ledger-book">
        <path d="M124 165c12-5 25-4 38 3v31c-13-7-26-8-38-3Z" fill="#F5EEFF" stroke="#6E667A" strokeWidth="2"/>
        <path d="M162 168c13-7 27-8 40-3v31c-13-5-27-4-40 3Z" fill="#FFFDF8" stroke="#6E667A" strokeWidth="2"/>
        <path d="M162 169v29" stroke="#C8BECF" strokeWidth="1.5"/>
        {!isEmpty ? <g stroke="#A89AB3" strokeWidth="1.6" strokeLinecap="round"><path d="M131 176h22M131 182h18M171 176h21M171 182h16"/></g> : null}
        {isEmpty ? <g className="empty-prompt"><rect x="145" y="174" width="34" height="18" rx="5" fill="#FFF8F1" stroke="#A78BDA" strokeWidth="1.5"/><path d="M162 178v10M157 183h10" stroke="#8061B5" strokeWidth="2.2" strokeLinecap="round"/></g> : null}
      </g>

      {isSuccess ? <g className="taro-success-props">
        <g className="success-receipt">
          <rect x="74" y="132" width="31" height="41" rx="6" fill="#FFFDF8" stroke="#8061B5" strokeWidth="2"/>
          <path d="M82 143h16M82 150h12M82 157h15" stroke="#B4A7C2" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="98" cy="166" r="6" fill="#9ED36A"/>
          <path d="m95 166 2 2 4-5" fill="none" stroke="#355646" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
        <circle className="coin coin-one" cx="91" cy="113" r="10" fill="#F3C969"/>
        <path className="coin coin-one" d="M92 108v10M88 111h7M88 115h7" stroke="#8B6925" strokeWidth="1.5"/>
        <circle className="coin coin-two" cx="119" cy="99" r="7" fill="#F3C969"/>
        <g className="sparkles" fill="#F3C969"><path d="m75 91 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z"/><path d="m130 122 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z"/></g>
      </g> : null}
    </g>

    <g className="cannon">
      <g className="cannon-barrel">
        <rect x="274" y="103" width="55" height="28" rx="14" fill="#355646" transform="rotate(-8 274 103)"/>
        <ellipse cx="327" cy="113" rx="7" ry="12" fill="#252A28" transform="rotate(-8 327 113)"/>
        <ellipse cx="325" cy="111" rx="3" ry="6" fill="#789080" opacity=".7" transform="rotate(-8 325 111)"/>
      </g>
      <rect x="226" y="126" width="76" height="45" rx="20" fill="#4F7C64"/>
      <path d="M236 136c16-8 42-8 57 0" fill="none" stroke="#789080" strokeWidth="5" strokeLinecap="round" opacity=".86"/>
      <circle cx="249" cy="178" r="18" fill="#252A28"/><circle cx="289" cy="178" r="18" fill="#252A28"/>
      <circle cx="249" cy="178" r="8" fill="#789080"/><circle cx="289" cy="178" r="8" fill="#789080"/>
      <g className="cannon-eye"><circle cx="250" cy="145" r="4" fill="#17201B"/><circle cx="272" cy="145" r="4" fill="#17201B"/><circle cx="249" cy="144" r="1" fill="#E8F6EA"/><circle cx="271" cy="144" r="1" fill="#E8F6EA"/></g>
      <path d="M254 158c5 4 11 4 16 0" fill="none" stroke="#17201B" strokeWidth="3" strokeLinecap="round"/>
      <circle className="cannon-status" cx="286" cy="157" r="4" fill={isWarning ? '#E5BC57' : '#9ED36A'}/>
      <g className="cannon-arm">
        <path d="M234 151c-14 1-20 8-20 17" fill="none" stroke="#355646" strokeWidth="7" strokeLinecap="round"/>
        <circle cx="214" cy="168" r="5" fill="#4F7C64"/>
      </g>

      {isEmpty ? <g className="archive-box">
        <path d="M305 167h38v24h-38z" fill="#E8EFE9" stroke="#355646" strokeWidth="2"/>
        <path d="m305 167 8-8h22l8 8" fill="#D5E2D8" stroke="#355646" strokeWidth="2" strokeLinejoin="round"/>
      </g> : null}

      {isWarning ? <g className="warning-sign">
        <rect x="208" y="119" width="32" height="27" rx="6" fill="#FFF5DB" stroke="#D9A441" strokeWidth="2"/>
        <path d="M224 125v10" stroke="#9A711F" strokeWidth="3" strokeLinecap="round"/>
        <circle cx="224" cy="140" r="1.7" fill="#9A711F"/>
      </g> : null}

      {isSafe ? <g className="safe-shield">
        <path d="M309 142c13-6 25-5 33 0v17c0 14-10 23-17 26-7-3-16-12-16-26Z" fill="#DFF3E7" stroke="#355646" strokeWidth="2"/>
        <rect x="318" y="153" width="14" height="12" rx="3" fill="#4F7C64"/>
        <path d="M321 153v-3a4 4 0 0 1 8 0v3" fill="none" stroke="#4F7C64" strokeWidth="2"/>
      </g> : null}

      {isSummary ? <g className="summary-projector">
        <path d="M260 62h82v52h-82z" rx="8" fill="#F7FBF7" stroke="#355646" strokeWidth="2"/>
        <path d="M268 103h66" stroke="#CBD9CE" strokeWidth="1.5"/>
        <rect x="272" y="87" width="9" height="16" rx="3" fill="#A78BDA"/>
        <rect x="288" y="78" width="9" height="25" rx="3" fill="#4F7C64"/>
        <rect x="304" y="83" width="9" height="20" rx="3" fill="#9ED36A"/>
        <path d="M270 71c15 5 26 1 38 6 9 4 16 2 26-4" fill="none" stroke="#8061B5" strokeWidth="2" strokeLinecap="round"/>
        <path d="M299 114v10" stroke="#355646" strokeWidth="2"/><path d="M284 124h30" stroke="#355646" strokeWidth="2" strokeLinecap="round"/>
      </g> : null}

      {isSuccess ? <g className="cannon-sort-feedback">
        <rect x="301" y="143" width="35" height="28" rx="7" fill="#E8F3EA" stroke="#355646" strokeWidth="2"/>
        <path d="m310 157 6 6 12-14" fill="none" stroke="#4F7C64" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
      </g> : null}
    </g>
  </svg>;
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
    <div className="transaction-main"><div className="transaction-name"><span>{transactionTitle(item)}</span>{item.type === 'transfer' ? <span className="tag">转账</span> : null}</div><div className="transaction-meta">{transactionMeta(item)}</div></div>
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
  const items = (props.items || []).slice(0, 7);
  const total = items.reduce((sum: number, item: any) => sum + Number(item.amount_cents || 0), 0);
  if (!items.length || !total) return <EmptyState title="分类还是空的" message="本月有支出后，这里会显示钱都花去了哪里。"/>;
  const radius = 55, circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <div className="donut-layout">
    <div className="donut-visual">
      <svg className="chart-svg donut-svg" viewBox="0 0 170 170" role="img" aria-label="支出分类占比">
        <circle cx="85" cy="85" r={radius} fill="none" stroke="#F2EDF3" strokeWidth="22"/>
        {items.map((item: any) => {
          const value = Number(item.amount_cents || 0);
          const length = value / total * circumference;
          const current = offset;
          offset += length;
          return <circle key={item.category_id || item.name} cx="85" cy="85" r={radius} fill="none" stroke={item.color} strokeWidth="22" strokeLinecap="butt" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-current} transform="rotate(-90 85 85)" style={{ transition: 'stroke-dasharray .5s ease' }}><title>{`${item.name} ${formatMoney(value)}`}</title></circle>;
        })}
        <text className="donut-center" x="85" y="79" textAnchor="middle">本月支出</text>
        <text className="donut-total" x="85" y="103" textAnchor="middle">{formatCompactMoney(total)}</text>
      </svg>
      <span className="donut-caption">共 {items.length} 个支出分类</span>
    </div>
    <div className="category-ranking" role="list" aria-label="支出分类排行">
      {items.map((item: any) => {
        const percent = Math.round(Number(item.amount_cents || 0) / total * 100);
        return <div className="rank-row" role="listitem" key={item.category_id || item.name}>
          <div className="rank-icon" style={{ background: `${item.color}22` }}>{CATEGORY_EMOJI[item.icon] || '✨'}</div>
          <div className="rank-main">
            <span className="rank-label" title={item.name}>{item.name}</span>
            <div className="rank-bar" aria-hidden="true"><span style={{ width: `${percent}%`, background: item.color }}/></div>
          </div>
          <span className="rank-percent">{percent}%</span>
          <strong className="rank-amount">{formatCompactMoney(item.amount_cents)}</strong>
        </div>;
      })}
    </div>
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

class DashboardPage extends React.Component<any, any> {
  constructor(props: any) { super(props); this.state = { loading: true, overview: null, trend: [], categories: [], budgets: [] }; }
  componentDidMount(): void { this.load(); }
  componentDidUpdate(prevProps: any): void { if (prevProps.month !== this.props.month || prevProps.refreshToken !== this.props.refreshToken) this.load(); }
  async load(): Promise<void> {
    this.setState({ loading: true });
    try {
      const month = this.props.month;
      const [overview, trend, categories, budgets] = await Promise.all([
        apiRequest(`/api/stats/overview?month=${month}`), apiRequest(`/api/stats/trend?month=${month}`),
        apiRequest(`/api/stats/category-breakdown?month=${month}`), apiRequest(`/api/stats/budget-progress?month=${month}`),
      ]);
      this.setState({ loading: false, overview, trend: trend.items, categories: categories.items, budgets: budgets.items });
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
        <div className="hero-copy"><span className="hero-kicker">{monthLabel(this.props.month)}的小账</span><h2>{data.expenseCents > 0 ? '这个月的生活，已经有迹可循啦' : '先记下这个月的第一笔吧'}</h2><p>{data.expenseCents > 0 ? `目前支出 ${formatMoney(data.expenseCents)}，结余 ${formatMoney(data.balanceCents)}。慢慢记，不用一次做得很复杂。` : '从一杯饮料、一顿饭开始，小账本会慢慢长成你们的生活地图。'}</p><div className="hero-actions"><button className="btn btn-primary" onClick={() => this.props.navigate('add')}><Icon name="plus" size={18}/>记一笔</button><button className="btn btn-secondary" onClick={() => this.props.navigate('transactions')}>看看明细</button></div></div>
        <div className="hero-mascot"><Mascot variant={data.budgetCents > 0 && budgetPercent >= 90 ? 'warning' : 'idle'}/></div>
      </section>
      <section className="grid grid-4" style={{ marginTop: '18px' }}>
        <article className="card summary-card summary-income"><span className="summary-label">本月收入</span><span className="summary-value"><AnimatedNumber value={data.incomeCents}>{(value: number) => formatMoney(value)}</AnimatedNumber></span><div className="summary-note">上月 {formatCompactMoney(data.previousIncomeCents)}</div></article>
        <article className="card summary-card summary-expense"><span className="summary-label">本月支出</span><span className="summary-value"><AnimatedNumber value={data.expenseCents}>{(value: number) => formatMoney(value)}</AnimatedNumber></span><div className="summary-note">上月 {formatCompactMoney(data.previousExpenseCents)}</div></article>
        <article className="card summary-card summary-balance"><span className="summary-label">本月结余</span><span className="summary-value"><AnimatedNumber value={data.balanceCents}>{(value: number) => formatMoney(value)}</AnimatedNumber></span><div className="summary-note">收入减去支出</div></article>
        <article className="card summary-card summary-assets"><span className="summary-label">账户合计</span><span className="summary-value"><AnimatedNumber value={data.totalBalanceCents}>{(value: number) => formatMoney(value)}</AnimatedNumber></span><div className="summary-note">共 {data.accounts.length} 个使用中账户</div></article>
      </section>
      <div className="dashboard-grid">
        <div className="stack">
          <section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">本月收支趋势</h3><p className="card-subtitle">每天的收入和支出变化</p></div><button className="btn btn-ghost btn-sm" onClick={() => this.props.navigate('stats')}>完整统计</button></div><TrendChart items={this.state.trend}/></section>
          <section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">最近记录</h3><p className="card-subtitle">最新的六笔小账</p></div><button className="btn btn-ghost btn-sm" onClick={() => this.props.navigate('transactions')}>全部明细</button></div>{data.recent.length ? <div className="list">{data.recent.map((item: any, index: number) => <TransactionItem key={item.id} item={item} index={index}/>)}</div> : <EmptyState title="这里还没有记录" message="今天发生的第一笔小事，可以从这里开始。" action={<button className="btn btn-primary" onClick={() => this.props.navigate('add')}>记第一笔</button>}/>}</section>
        </div>
        <div className="stack">
          <section className="card card-pad spending-card"><div className="card-title-row"><div><h3 className="card-title">钱花去了哪里</h3><p className="card-subtitle">本月支出分类</p></div></div><DonutChart items={this.state.categories}/></section>
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
    return <div className="page"><PageHeader title="记一笔" subtitle="不用填得很复杂，先把重要的记下来。"/><section className="card card-pad add-form-card" style={{ maxWidth: '820px', margin: '0 auto' }}><div className="role-assistant role-assistant-taro"><div className="role-assistant-copy"><strong>芋头准备好啦</strong><span>填好金额，它会马上把这笔记进来。</span></div><div className="role-assistant-mascot"><Mascot variant="idle" label="芋头拿着铅笔准备记账，炮台打开归档槽"/></div></div><TransactionForm bootstrap={this.props.bootstrap} onSuccess={(_: any, type: TransactionType) => { this.setState({ success: true, savedType: type }); this.props.onChanged(); window.setTimeout(() => { this.setState({ success: false }); this.props.navigate('home'); }, 1350); }}/></section>{this.state.success ? <div className="success-overlay"><div className="success-box"><Mascot variant="success" label="芋头举起收据，炮台显示已整理"/><h2>这笔记好啦</h2><p>{this.state.savedType === 'income' ? '芋头已经记下收入，炮台也整理好了' : this.state.savedType === 'transfer' ? '芋头记下转账，炮台已经同步两个账户' : '芋头已经记下这笔，炮台也整理好了'}</p></div></div> : null}</div>;
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
    return <div className="page"><PageHeader title="收支统计" subtitle="不用盯着每一笔，看看整体节奏就好。"><MonthSwitcher month={this.state.month} onChange={(month: string) => this.setState({ month }, () => this.load())}/></PageHeader>{this.state.loading ? <LoadingPage/> : <div className="grid grid-2"><section className="card role-assistant role-assistant-cannon form-span"><div className="role-assistant-copy"><strong>炮台已经整理好本月数据</strong><span>趋势、分类和预算都归好类了，慢慢看就行。</span></div><div className="role-assistant-mascot role-assistant-mascot-summary"><Mascot variant="summary" label="绿黑炮台投影本月图表，芋头在旁边查看"/></div></section><section className="card card-pad form-span"><div className="card-title-row"><div><h3 className="card-title">本月趋势</h3><p className="card-subtitle">每天的收入与支出</p></div></div><TrendChart items={this.state.trend}/></section><section className="card card-pad spending-card"><div className="card-title-row"><div><h3 className="card-title">支出分类</h3><p className="card-subtitle">钱主要花在了哪里</p></div></div><DonutChart items={this.state.categories}/></section><section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">分类预算</h3><p className="card-subtitle">预算与实际支出</p></div></div><BudgetProgressList items={this.state.budgets} onSetup={() => this.props.navigate('budgets')}/></section><section className="card card-pad form-span"><div className="card-title-row"><div><h3 className="card-title">近六个月</h3><p className="card-subtitle">收入和支出的月度变化</p></div></div><MonthlyBars items={this.state.months}/></section></div>}</div>;
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
  return <div className="page"><PageHeader title="设置" subtitle="调整小账本的使用方式和数据管理。"/><div className="grid grid-2"><section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">你们的小账本</h3><p className="card-subtitle">当前登录与家庭空间</p></div></div><div className="setting-row"><div><h4>{props.bootstrap.household.name}</h4><p>{props.bootstrap.user.displayName} · {props.bootstrap.user.role === 'owner' ? '管理员' : '家庭成员'}</p></div><div className="avatar">{props.bootstrap.user.displayName.slice(0, 1)}</div></div><div className="setting-row"><div><h4>轻动画</h4><p>关闭后会减少角色、图表和页面转场动画</p></div><button className={cn('switch', !reduceMotion && 'on')} onClick={() => props.onMotionChange(!reduceMotion)} aria-label="切换动画"><span/></button></div><div className="setting-row"><div><h4>账户管理</h4><p>添加、修改或归档常用账户</p></div><button className="btn btn-secondary btn-sm" onClick={() => props.navigate('accounts')}>打开</button></div><div className="setting-row"><div><h4>预算管理</h4><p>设置每月总预算和分类预算</p></div><button className="btn btn-secondary btn-sm" onClick={() => props.navigate('budgets')}>打开</button></div></section><section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">账号与安全</h3><p className="card-subtitle">密码、恢复码和设备会话</p></div></div><SecuritySettings email={props.bootstrap.user.email} onLogout={props.onLogout} onToast={props.onToast}/></section><section className="card card-pad"><div className="card-title-row"><div><h3 className="card-title">数据导出</h3><p className="card-subtitle">建议定期留一份自己能读取的副本</p></div></div><div className="settings-list"><div className="setting-row"><div><h4>CSV 表格</h4><p>适合用 Excel 或其他表格工具打开</p></div><a className="btn btn-secondary btn-sm" href="/api/export/csv"><Icon name="download" size={16}/>导出</a></div><div className="setting-row"><div><h4>JSON 完整数据</h4><p>适合迁移、恢复或程序读取</p></div><a className="btn btn-secondary btn-sm" href="/api/export/json"><Icon name="download" size={16}/>导出</a></div></div><div className="divider"/><div className="card-title-row"><div><h3 className="card-title">关于芋炮小账本</h3><p className="card-subtitle">版本 0.2.4 · 角色关系与视觉系统升级</p></div></div><p style={{ color: 'var(--text-2)', lineHeight: 1.8, fontSize: '13px' }}>没有广告和第三方行为追踪。密码在浏览器内使用 PBKDF2 和独立盐值处理，服务端再结合 Pepper 保存验证值；登录会话只保存在安全 Cookie 中。</p><div style={{ width: '230px', margin: '8px auto 0' }}><Mascot variant="safe"/></div></section><section className="card card-pad form-span"><div className="card-title-row"><div><h3 className="card-title">分类管理</h3><p className="card-subtitle">新增分类或归档暂时不用的分类</p></div></div><CategoryManager bootstrap={props.bootstrap} onChanged={props.onChanged} onToast={props.onToast}/></section></div></div>;
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
  componentWillUnmount(): void { window.removeEventListener('hashchange', this.onHashChange); window.removeEventListener('online', this.onOnline); window.removeEventListener('offline', this.onOffline); authExpiredHandler = null; }
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
  applyMotion(reduce: boolean): void { document.body.classList.toggle('reduce-motion', reduce); }
  changeMotion(reduce: boolean): void { localStorage.setItem('yupao-reduce-motion', String(reduce)); this.applyMotion(reduce); this.setState({ reduceMotion: reduce }); }
  renderPage(): any {
    const common = { bootstrap: this.state.bootstrap, month: this.state.month, refreshToken: this.state.refreshToken, navigate: (route: RouteKey) => this.navigate(route), onChanged: () => this.changed(), onError: (message: string) => this.showToast(message, 'error'), onToast: (message: string, kind?: any, actionLabel?: string, action?: () => void) => this.showToast(message, kind, actionLabel, action) };
    switch (this.state.route) { case 'transactions': return <TransactionsPage {...common}/>; case 'add': return <AddPage {...common}/>; case 'stats': return <StatsPage {...common}/>; case 'accounts': return <AccountsPage {...common}/>; case 'budgets': return <BudgetsPage {...common}/>; case 'settings': return <SettingsPage {...common} reduceMotion={this.state.reduceMotion} onMotionChange={(value: boolean) => this.changeMotion(value)} onLogout={() => this.logout()}/>; default: return <DashboardPage {...common} onMonthChange={(month: string) => this.setState({ month }, () => this.changed())}/>; }
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
    return <div className="app-shell">{!this.state.online ? <div className="offline-banner">现在没有网络，连上后再记账吧。</div> : null}<aside className="sidebar"><a className="brand" href="#/home"><span className="brand-mark"><LogoMark/></span><span className="brand-copy"><strong>芋炮小账本</strong><span>两个人的小日子</span></span></a><nav className="nav-list">{ROUTES.map((route) => <button key={route.key} className={cn('nav-item', this.state.route === route.key && 'active')} onClick={() => this.navigate(route.key)}><Icon name={route.icon}/><span>{route.label}</span></button>)}</nav><div className="sidebar-bottom"><div className="member-pill"><div className="avatar">{bootstrap.user.displayName.slice(0, 1)}</div><div><strong>{bootstrap.user.displayName}</strong><small>{bootstrap.household.name}</small></div></div></div></aside><header className="mobile-topbar"><div className="mobile-brand"><LogoMark/><span>芋炮小账本</span></div><div className="avatar">{bootstrap.user.displayName.slice(0, 1)}</div></header><main className="main">{this.renderPage()}</main><nav className="bottom-nav">{ROUTES.filter((route) => route.mobile).map((route) => <button key={route.key} className={cn(this.state.route === route.key && 'active', route.key === 'add' && 'center')} onClick={() => this.navigate(route.key)}>{route.key === 'add' ? <span className="nav-icon-wrap"><Icon name={route.icon}/></span> : <Icon name={route.icon}/>}<span>{route.label}</span></button>)}</nav>{toast ? <div className={cn('toast', toast.kind)}><span>{toast.message}</span>{toast.action ? <button onClick={() => { toast.action && toast.action(); this.setState({ toast: null }); }}>{toast.actionLabel || '操作'}</button> : null}</div> : null}</div>;
  }
}

ReactDOM.render(<App/>, document.getElementById('root'));
