import type { AppState, FinanceItem } from './types';

export function todayStr(d = new Date()): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export interface DailyBudget {
  displayValue: number;
  isNegative: boolean;
  color: string;
}

// Цвет дневного лимита:
// 0 → серый; отрицательный → красный; 1–800 → жёлтый;
// 800–1000 → янтарный; больше 1000 → зелёный.
export function dailyBudgetColor(value: number, isNegative: boolean): string {
  if (isNegative) return 'var(--urgent)';
  if (value <= 0) return 'var(--ink-faint)';
  if (value <= 800) return 'var(--wish)';
  if (value <= 1000) return 'var(--amber)';
  return 'var(--forest)';
}

// Порт calculateDailyBudget() из today.js — теперь чистая функция от state,
// без похода в DOM. Формула из README:
// (доход - остаток обязательных платежей до даты дохода) / дни до дохода
export function calculateDailyBudget(state: AppState, now = new Date()): DailyBudget {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayKey = todayStr(today);

  const nextIncome = state.financeItems
    .filter((i): i is FinanceItem & { incomeDate: string } => i.type === 'income' && !!i.incomeDate && i.incomeDate >= todayKey)
    .sort((a, b) => a.incomeDate.localeCompare(b.incomeDate) || b.createdAt - a.createdAt)[0];

  if (!nextIncome) return { displayValue: 0, isNegative: false, color: 'var(--ink-faint)' };

  const incomeDate = new Date(nextIncome.incomeDate + 'T00:00:00');
  const daysUntil = Math.max(1, Math.ceil((incomeDate.getTime() - today.getTime()) / 86400000));

  const expenses = state.financeItems
    .filter((i) => i.type === 'debt' && !i.done && i.dueDate && i.dueDate >= todayKey && i.dueDate <= nextIncome.incomeDate)
    .reduce((sum, i) => sum + Math.max(0, (Number(i.amount) || 0) - (Number(i.progress) || 0)), 0);

  const rawValue = ((Number(nextIncome.amount) || 0) - expenses) / daysUntil;
  const displayValue = Math.abs(rawValue);
  const isNegative = rawValue < 0;
  return { displayValue, isNegative, color: dailyBudgetColor(displayValue, isNegative) };
}

export function shoppingActiveCount(state: AppState): number {
  return state.shoppingItems.filter((i) => !i.purchasedAt).length;
}

export function shoppingArchivedCount(state: AppState): number {
  return state.shoppingItems.filter((i) => i.purchasedAt).length;
}

export function noteCountLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'запись';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'записи';
  return 'записей';
}

export function notesForPage(state: AppState, pageId: string) {
  return state.noteEntries.filter((e) => e.pageId === pageId);
}

export function filteredNotesForPage(state: AppState, pageId: string, query: string) {
  const q = query.trim().toLowerCase();
  const entries = notesForPage(state, pageId);
  const matched = q ? entries.filter((e) => (e.content + ' ' + (e.source || '')).toLowerCase().includes(q)) : entries;
  return matched.slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function latestWateringDate(state: AppState, plantId: string): string | null {
  const entry = state.waterings
    .filter((w) => w.plantId === plantId)
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  return entry ? entry.date : null;
}

// Порт daysAgoLabel() из plants.js — чистая функция, теперь без похода в DOM.
export function daysAgoLabel(dateStr: string | null, now = new Date()): string | null {
  if (!dateStr) return null;
  const then = new Date(dateStr + 'T00:00:00');
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - then.getTime()) / 86400000);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  if (diff < 0) return `через ${Math.abs(diff)} дн.`;
  return `${diff} дн. назад`;
}

export function filteredWateringsForPlant(state: AppState, plantId: string, query: string) {
  const q = query.trim().toLowerCase();
  let entries = state.waterings.filter((w) => w.plantId === plantId);
  if (q) {
    entries = entries.filter((w) => {
      const fertText = w.fert ? Object.entries(w.fert).filter(([, v]) => v).map(([k]) => k).join(' ') : '';
      return (fertText + ' ' + (w.note || '')).toLowerCase().includes(q);
    });
  }
  return entries.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
}

export function taskProjectItems(state: AppState, projectId: string) {
  return state.taskItems.filter((t) => t.projectId === projectId);
}

export function taskOpenCount(state: AppState, projectId: string): number {
  return taskProjectItems(state, projectId).filter((t) => !t.done).length;
}

export function filteredTasksForProject(state: AppState, projectId: string, view: 'current' | 'archive') {
  const items = taskProjectItems(state, projectId).filter((t) => (view === 'archive' ? t.done : !t.done));
  return items.slice().sort((a, b) => (Number(b.important) - Number(a.important)) || (b.createdAt - a.createdAt));
}

export function fmtMoney(n: number): string {
  return (Number(n) || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

export function formatFinanceDate(value: string | undefined | null): string {
  if (!value) return 'дата не указана';
  return new Date(value + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Остаток к оплате / остаток к накоплению — сумма (amount - progress) по незакрытым позициям.
export function remainingTotal(state: AppState, type: 'debt' | 'wish'): number {
  return state.financeItems
    .filter((i) => i.type === type && !i.done)
    .reduce((sum, i) => sum + Math.max(0, (Number(i.amount) || 0) - (Number(i.progress) || 0)), 0);
}

// Порядок: незакрытые сверху; для платежей — по сроку (раньше = выше); иначе по дате создания (новые сверху).
export function sortedFinanceItems(state: AppState, type: 'debt' | 'wish') {
  return state.financeItems
    .filter((i) => i.type === type)
    .slice()
    .sort((a, b) => {
      if (!!a.done !== !!b.done) return a.done ? 1 : -1;
      if (type === 'debt') {
        const da = a.dueDate || '9999', db = b.dueDate || '9999';
        if (da !== db) return da < db ? -1 : 1;
      }
      return b.createdAt - a.createdAt;
    });
}

export function sortedIncomes(state: AppState) {
  return state.financeItems
    .filter((i) => i.type === 'income')
    .slice()
    .sort((a, b) => {
      const dateA = a.incomeDate || '9999-12-31';
      const dateB = b.incomeDate || '9999-12-31';
      return dateA.localeCompare(dateB) || b.createdAt - a.createdAt;
    });
}

export function financeItemsTotal(items: { amount: number }[]): number {
  return items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

// ---------- Today dashboard ----------

export function paymentDaysUntil(dueDate: string | undefined, now = new Date()): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate + 'T00:00:00');
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / 86400000);
}

export function paymentNeedsAttention(item: FinanceItem, now = new Date()): boolean {
  const d = paymentDaysUntil(item.dueDate, now);
  return d !== null && d <= 3;
}

export function paymentDueLabel(daysUntil: number | null): string {
  if (daysUntil === null) return 'срок не указан';
  if (daysUntil < 0) return `просрочен на ${Math.abs(daysUntil)} дн.`;
  if (daysUntil === 0) return 'срок сегодня';
  if (daysUntil === 1) return 'срок завтра';
  return `срок через ${daysUntil} дн.`;
}

export function mixHexColors(first: string, second: string, amount: number): string {
  const parse = (color: string) => (color.match(/\w\w/g) || []).map((v) => parseInt(v, 16));
  const a = parse(first);
  const b = parse(second);
  const channels = a.map((value, i) => Math.round(value + (b[i] - value) * amount));
  return '#' + channels.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function paymentAccent(daysUntil: number | null): string {
  if (daysUntil === null) return '#C9C8BE';
  if (daysUntil <= 0) return '#C7462D';
  if (daysUntil === 1) return '#D26632';
  if (daysUntil <= 3) return '#C47C18';
  if (daysUntil <= 7) return '#B59A4A';
  const fade = Math.min(0.72, (daysUntil - 7) / 30);
  return mixHexColors('#9B9270', '#D7D7CA', fade);
}

export function todayPaymentsItems(state: AppState, limit = 3) {
  return state.financeItems
    .filter((i) => (i.type === 'debt' && !i.done) || i.type === 'income')
    .slice()
    .sort((a, b) => {
      const dateA = a.type === 'income' ? (a.incomeDate || '9999-12-31') : (a.dueDate || '9999-12-31');
      const dateB = b.type === 'income' ? (b.incomeDate || '9999-12-31') : (b.dueDate || '9999-12-31');
      return dateA.localeCompare(dateB) || b.createdAt - a.createdAt;
    })
    .slice(0, limit);
}

export function todayPaymentsTotal(state: AppState): number {
  return state.financeItems.filter((i) => (i.type === 'debt' && !i.done) || i.type === 'income').length;
}

export function todayNeedsAttention(state: AppState, now = new Date()): boolean {
  return state.financeItems.some((i) => i.type === 'debt' && !i.done && paymentNeedsAttention(i, now));
}

// Насколько задача близка по дедлайну: «скоро» = в пределах 5 дней (включая просроченные).
export function taskDueSoon(dueDate: string | undefined, now = new Date()): boolean {
  const d = paymentDaysUntil(dueDate, now);
  return d !== null && d <= 5;
}

// Задачи для главной: важные и/или с ближайшим дедлайном (≤ 5 дней).
// Сначала с дедлайном по возрастанию срока, затем важные, затем новые.
export function todayTasks(state: AppState, now = new Date(), limit = 4) {
  return state.taskItems
    .filter((t) => !t.done && (t.important || taskDueSoon(t.dueDate, now)))
    .slice()
    .sort((a, b) => {
      const da = a.dueDate ? paymentDaysUntil(a.dueDate, now) : null;
      const db = b.dueDate ? paymentDaysUntil(b.dueDate, now) : null;
      if (da !== null && db !== null && da !== db) return da - db;
      if (da !== null && db === null) return -1;
      if (da === null && db !== null) return 1;
      if (a.important !== b.important) return a.important ? -1 : 1;
      return b.createdAt - a.createdAt;
    })
    .slice(0, limit);
}

export function todayTasksTotal(state: AppState, now = new Date()): number {
  return state.taskItems.filter((t) => !t.done && (t.important || taskDueSoon(t.dueDate, now))).length;
}

export function wateringDaysAgo(state: AppState, plantId: string, now = new Date()): number | null {
  const lastDate = latestWateringDate(state, plantId);
  if (!lastDate) return null;
  const then = new Date(lastDate + 'T00:00:00');
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - then.getTime()) / 86400000);
}

export function plantNeedsWater(state: AppState, plantId: string, now = new Date()): boolean {
  const d = wateringDaysAgo(state, plantId, now);
  return d === null || d >= 2;
}

export function wateringAccent(daysAgo: number | null): string {
  if (daysAgo === null) return '#C1442D';
  const severity = Math.min(1, Math.max(0, (daysAgo - 2) / 8));
  const hue = Math.round(42 - severity * 40);
  return `hsl(${hue} 72% 48%)`;
}

export function plantsNeedingWater(state: AppState, now = new Date(), limit = 3) {
  return state.plants
    .filter((p) => plantNeedsWater(state, p.id, now))
    .slice()
    .sort((a, b) => (latestWateringDate(state, a.id) || '').localeCompare(latestWateringDate(state, b.id) || ''))
    .slice(0, limit);
}

export function plantsNeedingWaterTotal(state: AppState, now = new Date()): number {
  return state.plants.filter((p) => plantNeedsWater(state, p.id, now)).length;
}

export function importantNotes(state: AppState, limit = 3) {
  return state.noteEntries
    .filter((e) => e.important)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function importantNotesTotal(state: AppState): number {
  return state.noteEntries.filter((e) => e.important).length;
}

export function topWishes(state: AppState, limit = 3) {
  return state.financeItems
    .filter((i) => i.type === 'wish' && !i.done && Number(i.amount) > 0)
    .slice()
    .sort((a, b) => (Number(b.progress) || 0) / Number(b.amount) - (Number(a.progress) || 0) / Number(a.amount))
    .slice(0, limit);
}

export function topWishesTotal(state: AppState): number {
  return state.financeItems.filter((i) => i.type === 'wish' && !i.done && Number(i.amount) > 0).length;
}

// ---------- Study ----------

// Порт sortTopics() из study.js: невыполненные сначала, срочные — выше в своей группе, дальше новые сверху.
export function sortTopics<T extends { done: boolean; urgent: boolean; createdAt: number }>(list: T[]): T[] {
  return list.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
}

export function subjectTopics(state: AppState, subjectId: string) {
  return state.topics.filter((t) => t.subjectId === subjectId);
}

export function subjectProgress(state: AppState, subjectId: string): { done: number; total: number } {
  const topics = subjectTopics(state, subjectId);
  return { done: topics.filter((t) => t.done).length, total: topics.length };
}

export function subjectGroups(state: AppState, subjectId: string) {
  return state.groups.filter((g) => g.subjectId === subjectId);
}

export function ungroupedTopics(state: AppState, subjectId: string) {
  return sortTopics(state.topics.filter((t) => t.subjectId === subjectId && !t.groupId));
}

export function groupTopics(state: AppState, subjectId: string, groupId: string) {
  return sortTopics(state.topics.filter((t) => t.subjectId === subjectId && t.groupId === groupId));
}

// Поиск — по title+note, вперемешку по группам, только когда есть запрос.
export function filteredTopicsForSubject(state: AppState, subjectId: string, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return sortTopics(state.topics.filter((t) => t.subjectId === subjectId && (t.title + ' ' + t.note).toLowerCase().includes(q)));
}
