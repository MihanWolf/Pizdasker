import type { AppMode, AppState, EnvironmentReading, FinanceItem, FinanceOperation, FinanceOperationKind, PlantStage, Watering } from './types';

export function isModeHidden(state: AppState, mode: AppMode): boolean {
  return state.settings.hiddenModes.includes(mode);
}

export function isFinanceAdvanced(state: AppState): boolean {
  return state.settings.financeAdvanced.enabled;
}

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

// Безопасный дневной лимит до следующего неподтверждённого дохода:
// (текущие средства на руках - оставшиеся платежи до дохода) / дни.
export function calculateDailyBudget(state: AppState, now = new Date()): DailyBudget {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayKey = todayStr(today);

  const nextIncome = state.financeItems
    .filter((i): i is FinanceItem & { incomeDate: string } => i.type === 'income' && !i.confirmed && !!i.incomeDate && i.incomeDate >= todayKey)
    .sort((a, b) => a.incomeDate.localeCompare(b.incomeDate) || b.createdAt - a.createdAt)[0];

  const cashOnHand = currentOnHandBalance(state);
  if (!nextIncome) {
    const unpaidExpenses = state.financeItems
      .filter((i) => i.type === 'debt' && !i.done)
      .reduce((sum, i) => sum + Math.max(0, (Number(i.amount) || 0) - (Number(i.progress) || 0)), 0);
    const availableBalance = cashOnHand - unpaidExpenses;
    const isNegative = availableBalance < 0;
    return { displayValue: availableBalance, isNegative, color: dailyBudgetColor(availableBalance, isNegative) };
  }

  const incomeDate = new Date(nextIncome.incomeDate + 'T00:00:00');
  const daysUntil = Math.max(1, Math.ceil((incomeDate.getTime() - today.getTime()) / 86400000));

  const expenses = state.financeItems
    .filter((i) => i.type === 'debt' && !i.done && i.dueDate && i.dueDate <= nextIncome.incomeDate)
    .reduce((sum, i) => sum + Math.max(0, (Number(i.amount) || 0) - (Number(i.progress) || 0)), 0);

  const rawValue = (cashOnHand - expenses) / daysUntil;
  const displayValue = rawValue;
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

export function latestWateringStage(state: AppState, plantId: string): PlantStage | null {
  const entry = state.waterings
    .filter((w) => w.plantId === plantId && w.stage)
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt)[0];
  return entry?.stage ?? null;
}

export function plantTimelineStats(
  state: AppState,
  plantId: string,
  now = new Date(),
): { stage: PlantStage | null; daysOnStage: number | null; ageDays: number | null } {
  const entries = state.waterings
    .filter((w) => w.plantId === plantId && w.date)
    .slice()
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.createdAt - b.createdAt);
  if (!entries.length) return { stage: null, daysOnStage: null, ageDays: null };

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysSince = (date: string) => Math.max(
    0,
    Math.round((today.getTime() - new Date(date + 'T00:00:00').getTime()) / 86400000),
  );

  const stagedEntries = entries.filter((entry) => entry.stage);
  const currentStageEntry = stagedEntries[stagedEntries.length - 1];
  let stageStart = currentStageEntry;
  for (let i = stagedEntries.length - 2; i >= 0; i--) {
    if (stagedEntries[i].stage !== currentStageEntry.stage) break;
    stageStart = stagedEntries[i];
  }

  return {
    stage: currentStageEntry?.stage ?? null,
    daysOnStage: currentStageEntry ? daysSince(stageStart.date) : null,
    ageDays: daysSince(entries[0].date),
  };
}

export function dayCountLabel(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;
  const unit = mod10 === 1 && mod100 !== 11
    ? 'день'
    : [2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)
      ? 'дня'
      : 'дней';
  return `${days} ${unit}`;
}

export function formatDateDmy(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
}

export function parseDateDmy(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) return null;
  return `${year}-${month}-${day}`;
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

export function wateringPhotoEntries(state: AppState, plantId: string): Watering[] {
  return state.waterings
    .filter((entry) => entry.plantId === plantId && !!entry.photoIds?.length)
    .slice()
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
}

export function wateringPhotoGroups(state: AppState, plantId: string): { date: string; entries: Watering[] }[] {
  const groups = new Map<string, Watering[]>();
  for (const entry of wateringPhotoEntries(state, plantId)) {
    const group = groups.get(entry.date);
    if (group) group.push(entry);
    else groups.set(entry.date, [entry]);
  }
  return Array.from(groups, ([date, entries]) => ({ date, entries }));
}

export function plantPhotoCount(state: AppState, plantId: string): number {
  return state.waterings
    .filter((entry) => entry.plantId === plantId)
    .reduce((total, entry) => total + (entry.photoIds?.length ?? 0), 0);
}

export type EnvironmentChartRange = '7d' | '30d' | 'all';

export interface EnvironmentChartPoint {
  id: string;
  x: number;
  temperatureY: number;
  humidityY: number;
  temperature: number;
  humidity: number;
  recordedAt: string;
}

export interface EnvironmentChart {
  points: EnvironmentChartPoint[];
  temperatureMin: number;
  temperatureMax: number;
  humidityMin: number;
  humidityMax: number;
  startAt: number | null;
  endAt: number | null;
  domainStartAt: number | null;
  domainEndAt: number | null;
}

export function environmentChart(
  state: AppState,
  range: EnvironmentChartRange,
  now = new Date(),
): EnvironmentChart {
  const end = now.getTime();
  const rangeStart = range === 'all' ? Number.NEGATIVE_INFINITY : end - (range === '7d' ? 7 : 30) * 86400000;
  const entries = state.environmentReadings
    .filter((entry) => {
      const time = new Date(entry.recordedAt).getTime();
      return Number.isFinite(time) && Number.isFinite(entry.temperature) && Number.isFinite(entry.humidity) &&
        (range === 'all' || (time >= rangeStart && time <= end));
    })
    .slice()
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime() || a.createdAt - b.createdAt);
  if (!entries.length) {
    return { points: [], temperatureMin: 25, temperatureMax: 32, humidityMin: 40, humidityMax: 70, startAt: null, endAt: null, domainStartAt: null, domainEndAt: null };
  }

  const temperatureMin = 25;
  const temperatureMax = 32;
  const humidityMin = 40;
  const humidityMax = 70;
  const firstTime = new Date(entries[0].recordedAt).getTime();
  const lastTime = new Date(entries[entries.length - 1].recordedAt).getTime();
  const domainStartAt = range === 'all' ? (entries.length === 1 ? firstTime - 43200000 : firstTime) : rangeStart;
  const domainEndAt = range === 'all' ? (entries.length === 1 ? lastTime + 43200000 : lastTime) : end;
  const timeSpan = domainEndAt - domainStartAt || 1;
  const plotHeight = 56;
  const yFor = (value: number, min: number, max: number) => {
    const bounded = Math.max(min, Math.min(max, Math.round(value)));
    return 68 - ((bounded - min) / (max - min)) * plotHeight;
  };

  return {
    points: entries.map((entry): EnvironmentChartPoint => {
      const time = new Date(entry.recordedAt).getTime();
      return {
        id: entry.id,
        x: ((time - domainStartAt) / timeSpan) * 600,
        temperatureY: yFor(entry.temperature, temperatureMin, temperatureMax),
        humidityY: yFor(entry.humidity, humidityMin, humidityMax),
        temperature: Math.round(entry.temperature),
        humidity: Math.round(entry.humidity),
        recordedAt: entry.recordedAt,
      };
    }),
    temperatureMin,
    temperatureMax,
    humidityMin,
    humidityMax,
    startAt: firstTime,
    endAt: lastTime,
    domainStartAt,
    domainEndAt,
  };
}

export function latestEnvironmentReading(state: AppState): EnvironmentReading | null {
  return state.environmentReadings
    .slice()
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime() || b.createdAt - a.createdAt)[0] ?? null;
}

export function sortedEnvironmentReadings(state: AppState): EnvironmentReading[] {
  return state.environmentReadings
    .slice()
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime() || b.createdAt - a.createdAt);
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

export function nearestUnpaidFinancePayment(state: AppState, now = new Date()): { title: string; date: string; amount: number } | null {
  const today = todayStr(now);
  const unpaid = state.financeItems.filter((item) => item.type === 'debt' && !item.done && !!item.dueDate);
  const next = unpaid
    .filter((item) => item.dueDate! >= today)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.createdAt - b.createdAt)[0]
    ?? unpaid
      .filter((item) => item.dueDate! < today)
      .sort((a, b) => b.dueDate!.localeCompare(a.dueDate!) || b.createdAt - a.createdAt)[0];

  if (!next?.dueDate) return null;
  return {
    title: next.title,
    date: next.dueDate,
    amount: Math.max(0, (Number(next.amount) || 0) - (Number(next.progress) || 0)),
  };
}

export function nearestPlannedFinanceIncome(state: AppState, now = new Date()): { title: string; date: string; amount: number } | null {
  const today = todayStr(now);
  const next = state.financeItems
    .filter((item): item is FinanceItem & { incomeDate: string } => item.type === 'income' && !item.confirmed && !!item.incomeDate && item.incomeDate >= today)
    .sort((a, b) => a.incomeDate.localeCompare(b.incomeDate) || a.createdAt - b.createdAt)[0];

  if (!next) return null;
  return { title: next.title, date: next.incomeDate, amount: Number(next.amount) || 0 };
}

export function financeItemsTotal(items: { amount: number }[]): number {
  return items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
}

type FinancePaidItem = Pick<FinanceItem, 'amount' | 'progress' | 'done'>;

function financePaidAmount(item: FinancePaidItem): number {
  if (item.done) return Math.max(0, Number(item.amount) || 0);
  return Math.max(0, Number(item.progress) || 0);
}

export function financePaymentBalanceDelta(previous: FinancePaidItem, next: FinancePaidItem): number {
  return financePaidAmount(previous) - financePaidAmount(next);
}

export function financeOperationBalanceEffect(operation: FinanceOperation): number {
  if (operation.kind !== 'expense') return Number(operation.amount) || 0;
  if (operation.title.toLowerCase().includes('возврат')) return Math.abs(Number(operation.amount) || 0);
  return -Math.abs(Number(operation.amount) || 0);
}

export function financeOperationAmount(kind: FinanceOperationKind, amount: number): number {
  if (kind === 'expense') return -Math.abs(amount);
  if (kind === 'income') return Math.abs(amount);
  return amount;
}

export function currentOnHandBalance(state: AppState): number {
  const confirmedIncome = state.financeItems
    .filter((i) => i.type === 'income' && i.confirmed)
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  const confirmedExpenses = state.financeItems
    .filter((i) => i.type === 'debt' || i.type === 'wish')
    .reduce((sum, i) => sum + financePaidAmount(i), 0);

  return (Number(state.balance) || 0) + confirmedIncome - confirmedExpenses;
}

export interface FinanceMonthlyTotals {
  income: number;
  expenses: number;
}

export function financeOperationEffectiveDate(state: AppState, operation: FinanceOperation): string {
  if (operation.kind !== 'income' || operation.note !== 'Доход подтверждён' || !Number.isFinite(operation.createdAt) || operation.createdAt <= 0) {
    return operation.date;
  }

  const isConfirmedPlannedIncome = state.financeItems.some((item) =>
    item.type === 'income'
    && item.confirmed
    && item.incomeDate === operation.date
    && (item.title || 'Доход') === operation.title
    && (Number(item.amount) || 0) === financeOperationBalanceEffect(operation),
  );
  if (!isConfirmedPlannedIncome) return operation.date;

  const receivedDate = todayStr(new Date(operation.createdAt));
  return receivedDate < operation.date ? receivedDate : operation.date;
}

export interface FinanceWeeklyFlowPoint {
  date: string;
  label: string;
  net: number;
  height: number;
}

export interface FinanceWeeklyFlow {
  days: FinanceWeeklyFlowPoint[];
  net: number;
}

export interface FinanceUpcomingEvent {
  id: string;
  kind: 'payment' | 'income';
  title: string;
  date: string;
  amount: number;
}

export interface FinancePlanSummary {
  unpaidTotal: number;
  unpaidCount: number;
  upcomingIncomeTotal: number;
  upcomingIncomeCount: number;
  savingsTotal: number;
  savingsGoalCount: number;
}

export function financePlanSummary(state: AppState, now = new Date()): FinancePlanSummary {
  const today = todayStr(now);
  const unpaid = state.financeItems.filter((item) => item.type === 'debt' && !item.done);
  const upcomingIncomes = state.financeItems.filter((item) =>
    item.type === 'income' && !item.confirmed && !!item.incomeDate && item.incomeDate >= today,
  );
  const activeGoals = state.financeItems.filter((item) => item.type === 'wish' && !item.done);
  return {
    unpaidTotal: unpaid.reduce((total, item) => total + Math.max(0, (Number(item.amount) || 0) - (Number(item.progress) || 0)), 0),
    unpaidCount: unpaid.length,
    upcomingIncomeTotal: upcomingIncomes.reduce((total, item) => total + (Number(item.amount) || 0), 0),
    upcomingIncomeCount: upcomingIncomes.length,
    savingsTotal: activeGoals.reduce((total, item) => total + Math.max(0, (Number(item.amount) || 0) - (Number(item.progress) || 0)), 0),
    savingsGoalCount: activeGoals.length,
  };
}

export function financeMonthlyTotals(state: AppState, now = new Date()): FinanceMonthlyTotals {
  const today = todayStr(now);
  const month = today.slice(0, 7);
  return state.financeOperations.reduce<FinanceMonthlyTotals>((totals, operation) => {
    const operationDate = financeOperationEffectiveDate(state, operation);
    if (!operationDate?.startsWith(month) || operationDate > today) return totals;
    const amount = financeOperationBalanceEffect(operation);
    if (operation.kind === 'income') totals.income += Math.max(0, amount);
    if (operation.kind === 'expense') totals.expenses += Math.max(0, -amount);
    return totals;
  }, { income: 0, expenses: 0 });
}

export function financeWeeklyFlow(state: AppState, now = new Date()): FinanceWeeklyFlow {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const totals = new Map<string, number>();
  for (const operation of state.financeOperations) {
    const operationDate = financeOperationEffectiveDate(state, operation);
    const amount = financeOperationBalanceEffect(operation);
    totals.set(operationDate, (totals.get(operationDate) ?? 0) + amount);
  }

  const points = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = todayStr(date);
    return {
      date: key,
      label: date.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', '').toUpperCase(),
      net: totals.get(key) ?? 0,
    };
  });
  const max = Math.max(1, ...points.map((point) => Math.abs(point.net)));
  const days = points.map((point) => ({
    ...point,
    height: point.net === 0 ? 7 : Math.max(15, Math.round(Math.abs(point.net) / max * 100)),
  }));
  return { days, net: days.reduce((sum, point) => sum + point.net, 0) };
}

export function financeUpcomingEvents(state: AppState, now = new Date(), limit = 4): FinanceUpcomingEvent[] {
  const today = todayStr(now);
  const events: FinanceUpcomingEvent[] = [
    ...state.financeItems
      .filter((item) => item.type === 'debt' && !item.done && !!item.dueDate && Number(item.amount) - (Number(item.progress) || 0) > 0)
      .map((item) => ({
        id: item.id,
        kind: 'payment' as const,
        title: item.title,
        date: item.dueDate!,
        amount: Math.max(0, (Number(item.amount) || 0) - (Number(item.progress) || 0)),
      })),
    ...state.financeItems
      .filter((item) => item.type === 'income' && !item.confirmed && !!item.incomeDate && item.incomeDate >= today)
      .map((item) => ({
        id: item.id,
        kind: 'income' as const,
        title: item.title || 'Доход',
        date: item.incomeDate!,
        amount: Number(item.amount) || 0,
      })),
  ];

  return events
    .sort((a, b) => {
      const aOverdue = a.kind === 'payment' && a.date < today;
      const bOverdue = b.kind === 'payment' && b.date < today;
      if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
      if (aOverdue && bOverdue) return b.date.localeCompare(a.date);
      return a.date.localeCompare(b.date);
    })
    .slice(0, Math.max(0, limit));
}

export function financeRecentOperations(state: AppState, limit = 3): FinanceOperation[] {
  return state.financeOperations
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, Math.max(0, limit));
}

export function financeGoalProgress(item: FinanceItem): { saved: number; target: number; remaining: number; percent: number } {
  const target = Math.max(0, Number(item.amount) || 0);
  const saved = Math.max(0, Number(item.progress) || 0);
  return {
    saved,
    target,
    remaining: Math.max(0, target - saved),
    percent: target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0,
  };
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

// Поступления с прошедшей датой считаются полученными и на главной не показываются.
export function incomeIsPending(item: FinanceItem, now = new Date()): boolean {
  if (item.type !== 'income') return false;
  if (item.confirmed) return false;
  if (!item.incomeDate) return true;
  return item.incomeDate >= todayStr(now);
}

export function todayPaymentsItems(state: AppState, now = new Date(), limit = 3) {
  return state.financeItems
    .filter((i) => (i.type === 'debt' && !i.done) || (i.type === 'income' && incomeIsPending(i, now)))
    .slice()
    .sort((a, b) => {
      const dateA = a.type === 'income' ? (a.incomeDate || '9999-12-31') : (a.dueDate || '9999-12-31');
      const dateB = b.type === 'income' ? (b.incomeDate || '9999-12-31') : (b.dueDate || '9999-12-31');
      return dateA.localeCompare(dateB) || b.createdAt - a.createdAt;
    })
    .slice(0, limit);
}

export function todayPaymentsTotal(state: AppState, now = new Date()): number {
  return state.financeItems.filter((i) => (i.type === 'debt' && !i.done) || incomeIsPending(i, now)).length;
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
