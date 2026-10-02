import { describe, it, expect } from 'vitest';
import { calculateDailyBudget, dailyBudgetColor, filteredNotesForPage, noteCountLabel, daysAgoLabel, filteredWateringsForPlant, filteredTasksForProject, remainingTotal, sortedFinanceItems, sortedIncomes, fmtMoney, paymentDaysUntil, paymentNeedsAttention, mixHexColors, wateringDaysAgo, plantNeedsWater, todayTasks, taskDueSoon, topWishes, todayPaymentsItems, todayPaymentsTotal, sortTopics, subjectProgress, ungroupedTopics, groupTopics, filteredTopicsForSubject, isModeHidden, isFinanceAdvanced, currentOnHandBalance, financePaymentBalanceDelta, financeOperationBalanceEffect } from './selectors';
import { createEmptyState } from './types';

describe('calculateDailyBudget', () => {
  it('subtracts remaining required expenses when there is no future income', () => {
    const state = createEmptyState();
    state.balance = 12000;
    state.financeItems = [
      { id: 'debt', type: 'debt', title: 'Кредит', amount: 5000, progress: 2000, dueDate: '2026-10-15', createdAt: 1 },
    ];
    const result = calculateDailyBudget(state, new Date('2026-10-02T00:00:00'));
    // 12000 cash - 2000 already paid - 3000 remaining = 7000 available.
    expect(result.displayValue).toBe(7000);
    expect(result.isNegative).toBe(false);
  });

  it('divides current cash minus remaining due debts by days until income', () => {
    const state = createEmptyState();
    state.balance = 10000;
    const now = new Date('2026-09-06T00:00:00');
    state.financeItems = [
      { id: '1', type: 'income', title: 'Доход', amount: 1000, incomeDate: '2026-09-16', createdAt: 1 },
      { id: '2', type: 'debt', title: 'Платёж', amount: 5000, progress: 0, dueDate: '2026-09-10', done: false, createdAt: 2 },
    ];
    const result = calculateDailyBudget(state, now);
    // (10000 - 5000) / 10 дней = 500.
    expect(result.displayValue).toBe(500);
    expect(result.isNegative).toBe(false);
  });

  it('does not count unreceived income as available cash', () => {
    const state = createEmptyState();
    const now = new Date('2026-09-06T00:00:00');
    state.balance = 500;
    state.financeItems = [
      { id: '1', type: 'income', title: 'Доход', amount: 1000, incomeDate: '2026-09-16', createdAt: 1 },
      { id: '2', type: 'debt', title: 'Платёж', amount: 200, progress: 0, dueDate: '2026-09-10', done: false, createdAt: 2 },
    ];
    const result = calculateDailyBudget(state, now);
    // (500 - 200) / 10 дней = 30.
    expect(result.displayValue).toBe(30);
  });

  it('matches the daily-limit examples when income is in two days', () => {
    const state = createEmptyState();
    state.balance = 10000;
    state.financeItems = [
      { id: 'income', type: 'income', title: 'Зарплата', amount: 50000, incomeDate: '2026-09-08', createdAt: 1 },
    ];
    const now = new Date('2026-09-06T00:00:00');
    expect(calculateDailyBudget(state, now).displayValue).toBe(5000);

    state.financeItems.push({ id: 'debt', type: 'debt', title: 'Кредит', amount: 5000, progress: 0, dueDate: '2026-09-08', createdAt: 2 });
    expect(calculateDailyBudget(state, now).displayValue).toBe(2500);
  });

  it('uses actual on-hand balance without adding the next unconfirmed income', () => {
    const state = createEmptyState();
    state.balance = 1000;
    state.financeItems = [
      { id: 'received', type: 'income', title: 'Получено', amount: 500, incomeDate: '2026-09-05', confirmed: true, createdAt: 1 },
      { id: 'already-paid', type: 'debt', title: 'Оплачено частично', amount: 400, progress: 200, dueDate: '2026-09-07', createdAt: 2 },
      { id: 'next', type: 'income', title: 'Зарплата', amount: 1000, incomeDate: '2026-09-10', confirmed: false, createdAt: 3 },
      { id: 'future-confirmed', type: 'income', title: 'Уже в руках', amount: 9000, incomeDate: '2026-09-12', confirmed: true, createdAt: 4 },
      { id: 'upcoming-expense', type: 'debt', title: 'Счёт', amount: 300, progress: 0, dueDate: '2026-09-09', createdAt: 5 },
      { id: 'after-income', type: 'debt', title: 'Позже', amount: 800, progress: 0, dueDate: '2026-09-11', createdAt: 6 },
    ];

    const result = calculateDailyBudget(state, new Date('2026-09-06T00:00:00'));
    // Confirmed income is already on hand: 1000 + 500 + 9000 - 200 paid = 10300.
    // Until payday: (10300 - 500 remaining due) / 4 days = 2450.
    expect(result.displayValue).toBe(2450);
    expect(result.isNegative).toBe(false);
  });

  it('recalculates from changed on-hand finance data', () => {
    const state = createEmptyState();
    state.balance = 1000;
    state.financeItems = [
      { id: 'income', type: 'income', title: 'Зарплата', amount: 1000, incomeDate: '2026-09-11', createdAt: 1 },
    ];
    const now = new Date('2026-09-06T00:00:00');

    expect(calculateDailyBudget(state, now).displayValue).toBe(200);
    state.financeItems.push(
      { id: 'received', type: 'income', title: 'Подработка', amount: 500, incomeDate: '2026-09-05', confirmed: true, createdAt: 2 },
      { id: 'paid', type: 'debt', title: 'Счёт', amount: 100, progress: 100, dueDate: '2026-09-07', createdAt: 3 },
    );
    expect(calculateDailyBudget(state, now).displayValue).toBe(280);
  });

  it('reserves overdue unpaid debts through the next income date only once', () => {
    const state = createEmptyState();
    state.balance = 10000;
    state.financeItems = [
      { id: 'income', type: 'income', title: 'Доход', amount: 5000, incomeDate: '2026-09-08', createdAt: 1 },
      { id: 'overdue', type: 'debt', title: 'Просроченный платёж', amount: 2000, progress: 500, dueDate: '2026-09-01', createdAt: 2 },
      { id: 'completed', type: 'debt', title: 'Уже закрыт', amount: 3000, progress: 0, dueDate: '2026-09-07', done: true, createdAt: 3 },
      { id: 'later', type: 'debt', title: 'После дохода', amount: 4000, progress: 0, dueDate: '2026-09-09', createdAt: 4 },
    ];

    const result = calculateDailyBudget(state, new Date('2026-09-06T00:00:00'));
    // On hand is 6500 after completed/paid amounts; reserve 1500 remaining overdue / 2 days.
    expect(result.displayValue).toBe(2500);
  });

  it('flags negative budget when expenses exceed income', () => {
    const state = createEmptyState();
    const now = new Date('2026-09-06T00:00:00');
    state.balance = 100;
    state.financeItems = [
      { id: '1', type: 'income', title: 'Доход', amount: 100, incomeDate: '2026-09-07', createdAt: 1 },
      { id: '2', type: 'debt', title: 'Долг', amount: 500, progress: 0, dueDate: '2026-09-07', done: false, createdAt: 2 },
    ];
    const result = calculateDailyBudget(state, now);
    expect(result.isNegative).toBe(true);
    expect(result.displayValue).toBe(-400);
    expect(result.color).toBe('var(--urgent)');
  });
});

describe('dailyBudgetColor', () => {
  it('colors zero gray, negative red, low yellow, mid amber, high green', () => {
    expect(dailyBudgetColor(0, false)).toBe('var(--ink-faint)');
    expect(dailyBudgetColor(500, true)).toBe('var(--urgent)');
    expect(dailyBudgetColor(500, false)).toBe('var(--wish)');
    expect(dailyBudgetColor(900, false)).toBe('var(--amber)');
    expect(dailyBudgetColor(1500, false)).toBe('var(--forest)');
  });
});

describe('filteredNotesForPage', () => {
  it('sorts newest first and filters by content or source', () => {
    const state = createEmptyState();
    state.noteEntries = [
      { id: '1', pageId: 'p1', content: 'Первая мысль', source: 'Сенека', important: false, createdAt: 1 },
      { id: '2', pageId: 'p1', content: 'Вторая мысль', source: '', important: false, createdAt: 2 },
      { id: '3', pageId: 'other', content: 'Чужая страница', source: '', important: false, createdAt: 3 },
    ];

    const all = filteredNotesForPage(state, 'p1', '');
    expect(all.map((e) => e.id)).toEqual(['2', '1']); // новые сверху

    const filtered = filteredNotesForPage(state, 'p1', 'сенека');
    expect(filtered.map((e) => e.id)).toEqual(['1']);
  });
});

describe('noteCountLabel', () => {
  it('picks the correct Russian plural form', () => {
    expect(noteCountLabel(1)).toBe('запись');
    expect(noteCountLabel(2)).toBe('записи');
    expect(noteCountLabel(5)).toBe('записей');
    expect(noteCountLabel(11)).toBe('записей');
    expect(noteCountLabel(21)).toBe('запись');
  });
});

describe('daysAgoLabel', () => {
  const now = new Date('2026-09-06T00:00:00');
  it('labels today, yesterday, future and N days ago correctly', () => {
    expect(daysAgoLabel('2026-09-06', now)).toBe('сегодня');
    expect(daysAgoLabel('2026-09-05', now)).toBe('вчера');
    expect(daysAgoLabel('2026-09-01', now)).toBe('5 дн. назад');
    expect(daysAgoLabel('2026-09-10', now)).toBe('через 4 дн.');
    expect(daysAgoLabel(null, now)).toBeNull();
  });
});

describe('Study selectors', () => {
  function studyState() {
    const state = createEmptyState();
    state.subjects = [{ id: 's1', name: 'История', color: 'teal', createdAt: 1 }];
    state.groups = [{ id: 'g1', subjectId: 's1', name: 'Рим', color: 'rust', createdAt: 1 }];
    state.topics = [
      { id: 't1', subjectId: 's1', groupId: null, title: 'Первая тема', note: '', why: '', links: [], done: false, urgent: false, createdAt: 1 },
      { id: 't2', subjectId: 's1', groupId: null, title: 'Срочная тема', note: '', why: '', links: [], done: false, urgent: true, createdAt: 2 },
      { id: 't3', subjectId: 's1', groupId: 'g1', title: 'Тема в группе', note: 'заметка про Цезаря', why: '', links: [], done: false, urgent: false, createdAt: 3 },
      { id: 't4', subjectId: 's1', groupId: null, title: 'Готовая', note: '', why: '', links: [], done: true, urgent: false, createdAt: 4 },
      { id: 't5', subjectId: 'other', groupId: null, title: 'Чужой предмет', note: '', why: '', links: [], done: false, urgent: false, createdAt: 5 },
    ];
    return state;
  }

  it('sortTopics: done last, urgent-first among undone, then newest first', () => {
    const sorted = sortTopics(studyState().topics.filter((t) => t.subjectId === 's1'));
    expect(sorted.map((t) => t.id)).toEqual(['t2', 't3', 't1', 't4']);
  });

  it('subjectProgress counts only topics of that subject', () => {
    expect(subjectProgress(studyState(), 's1')).toEqual({ done: 1, total: 4 });
  });

  it('ungroupedTopics / groupTopics split by groupId within a subject', () => {
    const state = studyState();
    expect(ungroupedTopics(state, 's1').map((t) => t.id)).toEqual(['t2', 't1', 't4']);
    expect(groupTopics(state, 's1', 'g1').map((t) => t.id)).toEqual(['t3']);
  });

  it('filteredTopicsForSubject searches title+note and returns nothing for empty query', () => {
    const state = studyState();
    expect(filteredTopicsForSubject(state, 's1', '')).toEqual([]);
    expect(filteredTopicsForSubject(state, 's1', 'цезаря').map((t) => t.id)).toEqual(['t3']);
    expect(filteredTopicsForSubject(state, 's1', 'срочная').map((t) => t.id)).toEqual(['t2']);
  });
});

describe('Today dashboard helpers', () => {
  const now = new Date('2026-09-06T00:00:00');

  it('paymentDaysUntil / paymentNeedsAttention', () => {
    expect(paymentDaysUntil('2026-09-06', now)).toBe(0);
    expect(paymentDaysUntil('2026-09-09', now)).toBe(3);
    expect(paymentDaysUntil(undefined, now)).toBeNull();

    expect(paymentNeedsAttention({ id: 'x', type: 'debt', title: '', amount: 1, dueDate: '2026-09-09', createdAt: 1 }, now)).toBe(true);
    expect(paymentNeedsAttention({ id: 'x', type: 'debt', title: '', amount: 1, dueDate: '2026-09-20', createdAt: 1 }, now)).toBe(false);
  });

  it('mixHexColors interpolates between two hex colors', () => {
    expect(mixHexColors('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHexColors('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('wateringDaysAgo / plantNeedsWater treat "never watered" and "2+ days ago" as needing water', () => {
    const state = createEmptyState();
    state.plants = [{ id: 'p1', name: 'Монстера', color: 'forest', createdAt: 1 }];
    // никогда не поливали
    expect(wateringDaysAgo(state, 'p1', now)).toBeNull();
    expect(plantNeedsWater(state, 'p1', now)).toBe(true);

    state.waterings = [{ id: 'w1', plantId: 'p1', date: '2026-09-05', water: 1, ph: null, fert: { micro: null, grow: null, bloom: null, ripen: null }, note: '', createdAt: 1 }];
    expect(wateringDaysAgo(state, 'p1', now)).toBe(1);
    expect(plantNeedsWater(state, 'p1', now)).toBe(false); // вчера — ещё рано

    state.waterings[0].date = '2026-09-03';
    expect(plantNeedsWater(state, 'p1', now)).toBe(true); // 3 дня назад — пора
  });

  it('todayTasks includes important tasks and tasks due within 5 days, dues first', () => {
    const state = createEmptyState();
    const now = new Date('2026-09-06T00:00:00');
    state.taskItems = [
      { id: 't1', projectId: 'p', title: 'A', important: true, done: false, createdAt: 1, completedAt: null },
      { id: 't2', projectId: 'p', title: 'B', important: false, done: false, createdAt: 2, completedAt: null },
      { id: 't3', projectId: 'p', title: 'C', important: true, done: true, createdAt: 3, completedAt: 3 },
      { id: 't4', projectId: 'p', title: 'D', important: true, done: false, createdAt: 4, completedAt: null },
      { id: 't5', projectId: 'p', title: 'E', important: false, done: false, dueDate: '2026-09-09', createdAt: 5, completedAt: null },
      { id: 't6', projectId: 'p', title: 'F', important: false, done: false, dueDate: '2026-09-20', createdAt: 6, completedAt: null },
    ];
    const result = todayTasks(state, now);
    // E (через 3 дня) — раньше важных A/D; F (через 14 дней) не попадает
    expect(result.map((t) => t.id)).toEqual(['t5', 't4', 't1']);
    expect(result.some((t) => t.id === 't2')).toBe(false);
    expect(result.some((t) => t.id === 't6')).toBe(false);
  });

  it('taskDueSoon is true within 5 days including overdue', () => {
    const now = new Date('2026-09-06T00:00:00');
    expect(taskDueSoon('2026-09-11', now)).toBe(true);
    expect(taskDueSoon('2026-09-05', now)).toBe(true);
    expect(taskDueSoon('2026-09-12', now)).toBe(false);
    expect(taskDueSoon(undefined, now)).toBe(false);
  });

  it('topWishes sorts by completion percentage descending', () => {
    const state = createEmptyState();
    state.financeItems = [
      { id: 'w1', type: 'wish', title: 'A', amount: 100, progress: 90, done: false, createdAt: 1 },
      { id: 'w2', type: 'wish', title: 'B', amount: 100, progress: 10, done: false, createdAt: 2 },
    ];
    expect(topWishes(state).map((w) => w.id)).toEqual(['w1', 'w2']);
  });
});

describe('finance selectors', () => {
  function financeState() {
    const state = createEmptyState();
    state.financeItems = [
      { id: 'd1', type: 'debt', title: 'Кредит', amount: 1000, progress: 400, dueDate: '2026-09-10', done: false, createdAt: 1 },
      { id: 'd2', type: 'debt', title: 'Интернет', amount: 500, progress: 0, dueDate: '2026-09-05', done: false, createdAt: 2 },
      { id: 'd3', type: 'debt', title: 'Старое', amount: 200, progress: 200, dueDate: '2026-08-01', done: true, createdAt: 3 },
      { id: 'w1', type: 'wish', title: 'Наушники', amount: 300, progress: 100, done: false, createdAt: 4 },
      { id: 'i1', type: 'income', title: 'Доход', amount: 900, incomeDate: '2026-09-16', confirmed: true, createdAt: 5 },
      { id: 'i2', type: 'income', title: 'Доход', amount: 100, incomeDate: '2026-09-08', confirmed: false, createdAt: 6 },
    ];
    return state;
  }

  it('currentOnHandBalance counts base balance plus confirmed income minus paid debt progress', () => {
    const state = createEmptyState();
    state.balance = 500;
    state.financeItems = [
      { id: 'i1', type: 'income', title: 'Доход', amount: 300, incomeDate: '2026-09-20', confirmed: true, createdAt: 1 },
      { id: 'i2', type: 'income', title: 'Ещё не подтверждён', amount: 1000, incomeDate: '2026-09-25', confirmed: false, createdAt: 2 },
      { id: 'd1', type: 'debt', title: 'Кредит', amount: 2000, progress: 200, done: false, dueDate: '2026-09-12', createdAt: 3 },
      { id: 'd2', type: 'debt', title: 'Кредит 2', amount: 1000, progress: 1700, done: false, dueDate: '2026-09-15', createdAt: 4 },
    ];
    expect(currentOnHandBalance(state)).toBe(500 + 300 - (200 + 1700));
  });

  it('counts a checked expense as a confirmed operation', () => {
    const state = createEmptyState();
    state.balance = 500;
    state.financeItems = [
      { id: 'i1', type: 'income', title: 'Доход', amount: 200, incomeDate: '2026-09-11', confirmed: true, createdAt: 1 },
      { id: 'd1', type: 'debt', title: 'Кредит', amount: 1000, progress: 0, done: true, dueDate: '2026-09-12', createdAt: 2 },
    ];
    expect(currentOnHandBalance(state)).toBe(500 + 200 - 1000);
  });

  it('returns signed cash deltas for payment progress and checkbox completion or reversal', () => {
    const unpaid = { amount: 10000, progress: 0, done: false };
    const partiallyPaid = { amount: 10000, progress: 2500, done: false };
    const fullyPaid = { amount: 10000, progress: 2500, done: true };

    expect(financePaymentBalanceDelta(unpaid, { ...unpaid, progress: 10000 })).toBe(-10000);
    expect(financePaymentBalanceDelta({ ...unpaid, progress: 10000 }, unpaid)).toBe(10000);
    expect(financePaymentBalanceDelta(partiallyPaid, fullyPaid)).toBe(-7500);
    expect(financePaymentBalanceDelta(fullyPaid, partiallyPaid)).toBe(7500);
  });

  it('keeps checkbox balance changes equal to their signed operation deltas', () => {
    const state = createEmptyState();
    state.balance = 20000;
    state.financeItems = [
      { id: 'd1', type: 'debt', title: 'Интернет', amount: 10000, progress: 2500, done: false, createdAt: 1 },
    ];
    const item = state.financeItems[0];
    const beforeCheck = currentOnHandBalance(state);
    const unpaidSnapshot = { amount: item.amount, progress: item.progress, done: item.done };
    item.done = true;
    const checkDelta = financePaymentBalanceDelta(unpaidSnapshot, item);
    expect(checkDelta).toBe(-7500);
    expect(currentOnHandBalance(state) - beforeCheck).toBe(checkDelta);

    const beforeUncheck = currentOnHandBalance(state);
    const paidSnapshot = { amount: item.amount, progress: item.progress, done: item.done };
    item.done = false;
    const uncheckDelta = financePaymentBalanceDelta(paidSnapshot, item);
    expect(uncheckDelta).toBe(7500);
    expect(currentOnHandBalance(state) - beforeUncheck).toBe(uncheckDelta);
  });

  it('reads old and new expense operation signs as their actual cash effect', () => {
    expect(financeOperationBalanceEffect({ id: 'old-paid', kind: 'expense', title: 'Оплачено по обязательству', amount: 10000, date: '', createdAt: 1 })).toBe(-10000);
    expect(financeOperationBalanceEffect({ id: 'new-paid', kind: 'expense', title: 'Оплата: Интернет', amount: -10000, date: '', createdAt: 2 })).toBe(-10000);
    expect(financeOperationBalanceEffect({ id: 'old-return', kind: 'expense', title: 'Возврат по обязательству', amount: -10000, date: '', createdAt: 3 })).toBe(10000);
    expect(financeOperationBalanceEffect({ id: 'new-return', kind: 'expense', title: 'Возврат: Интернет', amount: 10000, date: '', createdAt: 4 })).toBe(10000);
  });

  it('remainingTotal sums (amount - progress) only for undone items', () => {
    const state = financeState();
    expect(remainingTotal(state, 'debt')).toBe(600 + 500); // d1: 1000-400, d2: 500-0; d3 done -> excluded
    expect(remainingTotal(state, 'wish')).toBe(200); // w1: 300-100
  });

  it('sortedFinanceItems puts done last and sorts open debts by due date ascending', () => {
    const state = financeState();
    const debts = sortedFinanceItems(state, 'debt');
    expect(debts.map((i) => i.id)).toEqual(['d2', 'd1', 'd3']); // d2 due earlier than d1; d3 done -> last
  });

  it('sortedIncomes sorts by income date ascending', () => {
    const state = financeState();
    const incomes = sortedIncomes(state);
    expect(incomes.map((i) => i.id)).toEqual(['i2', 'i1']);
  });

  it('fmtMoney formats using ru-RU grouping', () => {
    expect(fmtMoney(1234).replace(/\s/g, ' ')).toBe('1 234');
    expect(fmtMoney(0)).toBe('0');
  });

  it('todayPaymentsItems hides incomes with a past date', () => {
    const state = createEmptyState();
    const now = new Date('2026-09-10T00:00:00');
    state.financeItems = [
      { id: 'past', type: 'income', title: 'Прошлое', amount: 100, incomeDate: '2026-09-01', createdAt: 1 },
      { id: 'today', type: 'income', title: 'Сегодня', amount: 100, incomeDate: '2026-09-10', createdAt: 2 },
      { id: 'future', type: 'income', title: 'Будущее', amount: 100, incomeDate: '2026-09-20', createdAt: 3 },
    ];
    const ids = todayPaymentsItems(state, now, 10).map((i) => i.id);
    expect(ids).toEqual(['today', 'future']);
    expect(todayPaymentsTotal(state, now)).toBe(2);
  });
});
describe('filteredTasksForProject', () => {
  it('filters by done/current view and sorts important-first, newest-first', () => {
    const state = createEmptyState();
    state.taskItems = [
      { id: 't1', projectId: 'p1', title: 'A', important: false, done: false, createdAt: 1, completedAt: null },
      { id: 't2', projectId: 'p1', title: 'B', important: true, done: false, createdAt: 2, completedAt: null },
      { id: 't3', projectId: 'p1', title: 'C', important: false, done: true, createdAt: 3, completedAt: 3 },
      { id: 't4', projectId: 'other', title: 'D', important: false, done: false, createdAt: 4, completedAt: null },
    ];
    const current = filteredTasksForProject(state, 'p1', 'current');
    expect(current.map((t) => t.id)).toEqual(['t2', 't1']); // важная выше, хотя создана позже t1... на самом деле t2 новее и важнее

    const archive = filteredTasksForProject(state, 'p1', 'archive');
    expect(archive.map((t) => t.id)).toEqual(['t3']);
  });
});
describe('filteredWateringsForPlant', () => {
  it('sorts by date desc and filters by fertilizer key or note', () => {
    const state = createEmptyState();
    state.waterings = [
      { id: 'w1', plantId: 'p1', date: '2026-09-01', water: 1, ph: null, fert: { micro: null, grow: null, bloom: null, ripen: null }, note: '', createdAt: 1 },
      { id: 'w2', plantId: 'p1', date: '2026-09-03', water: 1, ph: null, fert: { micro: 1, grow: null, bloom: null, ripen: null }, note: 'подкормка', createdAt: 2 },
      { id: 'w3', plantId: 'other', date: '2026-09-05', water: 1, ph: null, fert: { micro: null, grow: null, bloom: null, ripen: null }, note: '', createdAt: 3 },
    ];
    const all = filteredWateringsForPlant(state, 'p1', '');
    expect(all.map((w) => w.id)).toEqual(['w2', 'w1']);

    const filtered = filteredWateringsForPlant(state, 'p1', 'micro');
    expect(filtered.map((w) => w.id)).toEqual(['w2']);
  });
});

describe('settings selectors', () => {
  it('isModeHidden reflects hiddenModes and defaults to visible', () => {
    const state = createEmptyState();
    expect(isModeHidden(state, 'finance')).toBe(false);
    state.settings.hiddenModes = ['finance', 'notes'];
    expect(isModeHidden(state, 'finance')).toBe(true);
    expect(isModeHidden(state, 'tasks')).toBe(false);
  });

  it('isFinanceAdvanced reflects financeAdvanced.enabled', () => {
    const state = createEmptyState();
    expect(isFinanceAdvanced(state)).toBe(false);
    state.settings.financeAdvanced.enabled = true;
    expect(isFinanceAdvanced(state)).toBe(true);
  });
});
