import { describe, it, expect } from 'vitest';
import { calculateDailyBudget, dailyBudgetColor, filteredNotesForPage, noteCountLabel, daysAgoLabel, filteredWateringsForPlant, latestWateringStage, plantTimelineStats, dayCountLabel, formatDateDmy, parseDateDmy, environmentChart, latestEnvironmentReading, wateringPhotoEntries, wateringPhotoGroups, plantPhotoCount, latestPlantPhotoId, activePlants, archivedPlants, setPlantArchived, plantsNeedingWater, plantsNeedingWaterTotal, filteredTasksForProject, remainingTotal, sortedFinanceItems, sortedIncomes, fmtMoney, paymentDaysUntil, paymentNeedsAttention, mixHexColors, wateringDaysAgo, plantNeedsWater, todayTasks, taskDueSoon, topWishes, todayPaymentsItems, todayPaymentsTotal, sortTopics, subjectProgress, ungroupedTopics, groupTopics, filteredTopicsForSubject, isModeHidden, isFinanceAdvanced, currentOnHandBalance, financePaymentBalanceDelta, financeOperationAmount, financeOperationBalanceEffect, financeOperationEffectiveDate, nearestUnpaidFinancePayment, nearestPlannedFinanceIncome, financeMonthlyTotals, financeWeeklyFlow, financeUpcomingEvents, financeRecentOperations, financeGoalProgress, financePlanSummary } from './selectors';
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

describe('nearestUnpaidFinancePayment', () => {
  it('returns nearest upcoming unpaid payment and the remaining balance', () => {
    const state = createEmptyState();
    state.financeItems = [
      { id: 'later', type: 'debt', title: 'Аренда', amount: 1000, progress: 0, dueDate: '2026-10-12', createdAt: 1 },
      { id: 'nearest', type: 'debt', title: 'Интернет', amount: 800, progress: 300, dueDate: '2026-10-05', createdAt: 2 },
      { id: 'done', type: 'debt', title: 'Закрыт', amount: 500, dueDate: '2026-10-03', done: true, createdAt: 3 },
    ];

    expect(nearestUnpaidFinancePayment(state, new Date('2026-10-02T00:00:00'))).toEqual({
      title: 'Интернет',
      date: '2026-10-05',
      amount: 500,
    });
  });

  it('falls back to the most recent overdue unpaid payment', () => {
    const state = createEmptyState();
    state.financeItems = [
      { id: 'overdue', type: 'debt', title: 'Кредит', amount: 2000, progress: 500, dueDate: '2026-09-20', createdAt: 1 },
    ];
    expect(nearestUnpaidFinancePayment(state, new Date('2026-10-02T00:00:00'))).toEqual({
      title: 'Кредит',
      date: '2026-09-20',
      amount: 1500,
    });
  });
});

describe('nearestPlannedFinanceIncome', () => {
  it('returns the nearest future unconfirmed income and ignores past or confirmed income', () => {
    const state = createEmptyState();
    state.financeItems = [
      { id: 'later', type: 'income', title: 'Подработка', amount: 2000, incomeDate: '2026-10-12', createdAt: 1 },
      { id: 'next', type: 'income', title: 'Зарплата', amount: 50000, incomeDate: '2026-10-05', createdAt: 2 },
      { id: 'confirmed', type: 'income', title: 'Получено', amount: 3000, incomeDate: '2026-10-03', confirmed: true, createdAt: 3 },
      { id: 'past', type: 'income', title: 'Старое', amount: 1000, incomeDate: '2026-10-01', createdAt: 4 },
    ];

    expect(nearestPlannedFinanceIncome(state, new Date('2026-10-02T00:00:00'))).toEqual({
      title: 'Зарплата',
      date: '2026-10-05',
      amount: 50000,
    });
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

  it('normalizes operation amounts so incomes add and expenses subtract', () => {
    expect(financeOperationAmount('expense', 120)).toBe(-120);
    expect(financeOperationAmount('expense', -120)).toBe(-120);
    expect(financeOperationAmount('income', -120)).toBe(120);
    expect(financeOperationAmount('adjustment', -120)).toBe(-120);
  });

  it('summarizes current-month income and outflows from operation history', () => {
    const state = createEmptyState();
    state.financeItems = [
      { id: 'planned-income', type: 'income', title: 'Зарплата', amount: 50000, incomeDate: '2026-10-25', confirmed: true, createdAt: 1 },
    ];
    state.financeOperations = [
      { id: 'income', kind: 'income', title: 'Зарплата', amount: 50000, date: '2026-10-25', note: 'Доход подтверждён', createdAt: new Date('2026-10-20T12:00:00').getTime() },
      { id: 'expense', kind: 'expense', title: 'Покупка', amount: -1200, date: '2026-10-11', createdAt: 2 },
      { id: 'old', kind: 'income', title: 'Сентябрь', amount: 30000, date: '2026-09-30', createdAt: 3 },
      { id: 'adjustment', kind: 'adjustment', title: 'Корректировка', amount: 250, date: '2026-10-12', createdAt: 4 },
      { id: 'future', kind: 'income', title: 'Будущий доход', amount: 9000, date: '2026-10-21', createdAt: 5 },
    ];

    expect(financeOperationEffectiveDate(state, state.financeOperations[0])).toBe('2026-10-20');
    expect(financeMonthlyTotals(state, new Date('2026-10-20T12:00:00'))).toEqual({ income: 50000, expenses: 1200 });
  });

  it('builds a normalized seven-day net cashflow series', () => {
    const state = createEmptyState();
    state.financeOperations = [
      { id: 'income', kind: 'income', title: 'Зарплата', amount: 5000, date: '2026-10-20', createdAt: 1 },
      { id: 'expense', kind: 'expense', title: 'Продукты', amount: -1000, date: '2026-10-20', createdAt: 2 },
    ];
    const flow = financeWeeklyFlow(state, new Date('2026-10-20T12:00:00'));

    expect(flow.days).toHaveLength(7);
    expect(flow.days[0].date).toBe('2026-10-14');
    expect(flow.days[6]).toMatchObject({ date: '2026-10-20', net: 4000, height: 100 });
    expect(flow.days.slice(0, 6).every((point) => point.net === 0 && point.height === 7)).toBe(true);
    expect(flow.net).toBe(4000);
  });

  it('prioritizes overdue payments and returns upcoming events by date', () => {
    const state = createEmptyState();
    state.financeItems = [
      { id: 'later', type: 'debt', title: 'Позже', amount: 400, dueDate: '2026-10-25', createdAt: 1 },
      { id: 'overdue', type: 'debt', title: 'Просрочено', amount: 800, progress: 200, dueDate: '2026-10-18', createdAt: 2 },
      { id: 'income', type: 'income', title: 'Зарплата', amount: 1000, incomeDate: '2026-10-22', createdAt: 3 },
      { id: 'past-income', type: 'income', title: 'Старый доход', amount: 1000, incomeDate: '2026-10-01', createdAt: 4 },
    ];

    expect(financeUpcomingEvents(state, new Date('2026-10-20T12:00:00')).map(({ id, amount }) => ({ id, amount }))).toEqual([
      { id: 'overdue', amount: 600 },
      { id: 'income', amount: 1000 },
      { id: 'later', amount: 400 },
    ]);
  });

  it('returns recently created operations first, regardless of their operation date', () => {
    const state = createEmptyState();
    state.financeOperations = [
      { id: 'older', kind: 'expense', title: 'Старое', amount: -1, date: '2026-10-19', createdAt: 3 },
      { id: 'newer-created', kind: 'expense', title: 'Новее создано', amount: -1, date: '2026-10-20', createdAt: 1 },
      { id: 'same-day-latest', kind: 'income', title: 'Последнее', amount: 1, date: '2026-10-20', createdAt: 2 },
    ];
    expect(financeRecentOperations(state, 2).map((operation) => operation.id)).toEqual(['older', 'same-day-latest']);
  });

  it('calculates a bounded savings goal progress and remaining target', () => {
    expect(financeGoalProgress({ id: 'goal', type: 'wish', title: 'Цель', amount: 10000, progress: 2500, createdAt: 1 })).toEqual({
      saved: 2500,
      target: 10000,
      remaining: 7500,
      percent: 25,
    });
    expect(financeGoalProgress({ id: 'goal', type: 'wish', title: 'Цель', amount: 0, progress: 20, createdAt: 1 }).percent).toBe(0);
    expect(financeGoalProgress({ id: 'goal', type: 'wish', title: 'Цель', amount: 100, progress: 120, createdAt: 1 }).percent).toBe(100);
  });

  it('summarizes unpaid obligations, planned income and active savings goals', () => {
    const state = createEmptyState();
    state.financeItems = [
      { id: 'debt', type: 'debt', title: 'Кредит', amount: 10000, progress: 2500, createdAt: 1 },
      { id: 'paid', type: 'debt', title: 'Закрыт', amount: 500, done: true, createdAt: 2 },
      { id: 'income', type: 'income', title: 'Зарплата', amount: 50000, incomeDate: '2026-10-25', createdAt: 3 },
      { id: 'past-income', type: 'income', title: 'Прошёл', amount: 1000, incomeDate: '2026-10-10', createdAt: 4 },
      { id: 'goal', type: 'wish', title: 'Отпуск', amount: 20000, progress: 5000, createdAt: 5 },
      { id: 'done-goal', type: 'wish', title: 'Закрытая цель', amount: 100, done: true, createdAt: 6 },
    ];

    expect(financePlanSummary(state, new Date('2026-10-20T12:00:00'))).toEqual({
      unpaidTotal: 7500,
      unpaidCount: 1,
      upcomingIncomeTotal: 50000,
      upcomingIncomeCount: 1,
      savingsTotal: 15000,
      savingsGoalCount: 1,
    });
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

describe('latestWateringStage', () => {
  it('returns the latest recorded stage for the selected plant and skips older entries without a stage', () => {
    const state = createEmptyState();
    state.waterings = [
      { id: 'old', plantId: 'p1', date: '2026-10-01', water: null, ph: null, fert: { micro: null, grow: null, bloom: null, ripen: null }, note: '', stage: 'Росток', createdAt: 1 },
      { id: 'newer-without-stage', plantId: 'p1', date: '2026-10-03', water: null, ph: null, fert: { micro: null, grow: null, bloom: null, ripen: null }, note: '', createdAt: 2 },
      { id: 'latest', plantId: 'p1', date: '2026-10-02', water: null, ph: null, fert: { micro: null, grow: null, bloom: null, ripen: null }, note: '', stage: 'Цветение', createdAt: 3 },
      { id: 'other-plant', plantId: 'p2', date: '2026-10-04', water: null, ph: null, fert: { micro: null, grow: null, bloom: null, ripen: null }, note: '', stage: 'Предцвет', createdAt: 4 },
    ];

    expect(latestWateringStage(state, 'p1')).toBe('Цветение');
    expect(latestWateringStage(state, 'p2')).toBe('Предцвет');
    expect(latestWateringStage(state, 'missing')).toBeNull();
  });
});

describe('plantTimelineStats', () => {
  it('counts the current stage from its first consecutive entry and plant age from the first watering', () => {
    const state = createEmptyState();
    const fert = { micro: null, grow: null, bloom: null, ripen: null };
    state.waterings = [
      { id: 'first', plantId: 'p1', date: '2026-10-01', water: null, ph: null, fert, note: '', createdAt: 1 },
      { id: 'sprout', plantId: 'p1', date: '2026-10-03', water: null, ph: null, fert, note: '', stage: 'Росток', createdAt: 2 },
      { id: 'veg-start', plantId: 'p1', date: '2026-10-10', water: null, ph: null, fert, note: '', stage: 'Вегетация', createdAt: 3 },
      { id: 'veg-later', plantId: 'p1', date: '2026-10-15', water: null, ph: null, fert, note: '', stage: 'Вегетация', createdAt: 4 },
    ];

    expect(plantTimelineStats(state, 'p1', new Date('2026-10-20T12:00:00'))).toEqual({
      stage: 'Вегетация',
      daysOnStage: 10,
      ageDays: 19,
    });
  });

  it('returns age without a stage and handles plants with no watering records', () => {
    const state = createEmptyState();
    state.waterings = [{
      id: 'legacy', plantId: 'p1', date: '2026-10-19', water: null, ph: null,
      fert: { micro: null, grow: null, bloom: null, ripen: null }, note: '', createdAt: 1,
    }];

    expect(plantTimelineStats(state, 'p1', new Date('2026-10-20T12:00:00'))).toEqual({
      stage: null,
      daysOnStage: null,
      ageDays: 1,
    });
    expect(plantTimelineStats(state, 'missing', new Date('2026-10-20T12:00:00'))).toEqual({
      stage: null,
      daysOnStage: null,
      ageDays: null,
    });
  });
});

describe('dayCountLabel', () => {
  it('uses correct Russian day forms', () => {
    expect(dayCountLabel(1)).toBe('1 день');
    expect(dayCountLabel(3)).toBe('3 дня');
    expect(dayCountLabel(12)).toBe('12 дней');
  });
});

describe('date format helpers', () => {
  it('formats dates as dd/mm/yyyy and parses only valid calendar dates', () => {
    expect(formatDateDmy('2026-10-20')).toBe('20/10/2026');
    expect(parseDateDmy('20/10/2026')).toBe('2026-10-20');
    expect(parseDateDmy('31/02/2026')).toBeNull();
    expect(parseDateDmy('2026-10-20')).toBeNull();
  });
});

describe('environmentChart', () => {
  it('filters by selected time range, orders measurements, and plots each metric on its own scale', () => {
    const state = createEmptyState();
    state.environmentReadings = [
      { id: 'middle', recordedAt: '2026-10-18T12:00:00.000Z', temperature: 22, humidity: 60, createdAt: 2 },
      { id: 'outside', recordedAt: '2026-10-01T12:00:00.000Z', temperature: 10, humidity: 40, createdAt: 1 },
      { id: 'latest', recordedAt: '2026-10-20T06:00:00.000Z', temperature: 26, humidity: 70, createdAt: 3 },
    ];

    const chart = environmentChart(state, '7d', new Date('2026-10-20T12:00:00.000Z'));
    expect(chart.points.map((point) => point.id)).toEqual(['middle', 'latest']);
    expect(chart.temperatureMin).toBe(25);
    expect(chart.temperatureMax).toBe(32);
    expect(chart.humidityMin).toBe(40);
    expect(chart.humidityMax).toBe(70);
    expect(chart.points[0].x).toBeCloseTo((5 / 7) * 600);
    expect(chart.points[1].x).toBeCloseTo((6.75 / 7) * 600);
    expect(chart.points[1].temperatureY).toBeCloseTo(60);
    expect(chart.points[1].humidityY).toBe(12);
    expect(latestEnvironmentReading(state)?.id).toBe('latest');
  });

  it('shows a single all-time measurement in the center and returns empty chart for no matching data', () => {
    const state = createEmptyState();
    state.environmentReadings = [
      { id: 'sole', recordedAt: '2026-10-19T10:00:00.000Z', temperature: 20, humidity: 50, createdAt: 1 },
    ];

    expect(environmentChart(state, 'all').points[0].x).toBe(300);
    expect(environmentChart(state, '7d', new Date('2026-10-30T10:00:00.000Z')).points).toEqual([]);
  });

  it('rounds fractional legacy readings to whole numbers in chart data', () => {
    const state = createEmptyState();
    state.environmentReadings = [
      { id: 'fractional', recordedAt: '2026-10-20T10:00:00.000Z', temperature: 25.6, humidity: 54.4, createdAt: 1 },
    ];

    expect(environmentChart(state, 'all').points[0]).toMatchObject({ temperature: 26, humidity: 54 });
  });
});

describe('watering photo selectors', () => {
  it('lists and groups only photo entries for the selected plant by descending date', () => {
    const state = createEmptyState();
    const fert = { micro: null, grow: null, bloom: null, ripen: null };
    state.waterings = [
      { id: 'older', plantId: 'p1', date: '2026-10-01', water: null, ph: null, fert, note: '', photoIds: ['a'], createdAt: 1 },
      { id: 'newer', plantId: 'p1', date: '2026-10-05', water: null, ph: null, fert, note: '', photoIds: ['b', 'c'], createdAt: 2 },
      { id: 'same-day', plantId: 'p1', date: '2026-10-05', water: null, ph: null, fert, note: '', photoIds: ['d'], createdAt: 3 },
      { id: 'empty', plantId: 'p1', date: '2026-10-06', water: null, ph: null, fert, note: '', createdAt: 4 },
      { id: 'other-plant', plantId: 'p2', date: '2026-10-07', water: null, ph: null, fert, note: '', photoIds: ['e'], createdAt: 5 },
    ];

    expect(wateringPhotoEntries(state, 'p1').map((entry) => entry.id)).toEqual(['same-day', 'newer', 'older']);
    expect(latestPlantPhotoId(state, 'p1')).toBe('d');
    expect(wateringPhotoGroups(state, 'p1').map((group) => [group.date, group.entries.length])).toEqual([
      ['2026-10-05', 2],
      ['2026-10-01', 1],
    ]);
    expect(plantPhotoCount(state, 'p1')).toBe(4);
  });
});

describe('plant archive selectors', () => {
  it('separates active and archived plants and sorts archive by selected order', () => {
    const state = createEmptyState();
    state.plants = [
      { id: 'p1', name: 'Фикус', color: 'forest', createdAt: 1, archivedAt: 100 },
      { id: 'p2', name: 'Алоэ', color: 'teal', createdAt: 2, archivedAt: 200 },
      { id: 'p3', name: 'Монстера', color: 'plum', createdAt: 3 },
    ];
    state.waterings = [
      { id: 'old', plantId: 'p1', date: '2026-10-01', water: null, ph: null, fert: { micro: null, grow: null, bloom: null, ripen: null }, note: '', createdAt: 1 },
      { id: 'young', plantId: 'p2', date: '2026-10-10', water: null, ph: null, fert: { micro: null, grow: null, bloom: null, ripen: null }, note: '', createdAt: 2 },
    ];

    expect(activePlants(state).map((plant) => plant.id)).toEqual(['p3']);
    expect(archivedPlants(state).map((plant) => plant.id)).toEqual(['p2', 'p1']);
    expect(plantsNeedingWater(state).map((plant) => plant.id)).toEqual(['p3']);
    expect(plantsNeedingWaterTotal(state)).toBe(1);
    state.plantsArchiveSort = 'name';
    expect(archivedPlants(state).map((plant) => plant.id)).toEqual(['p2', 'p1']);
    state.plantsArchiveSort = 'age';
    expect(archivedPlants(state, new Date('2026-10-20T12:00:00')).map((plant) => plant.id)).toEqual(['p1', 'p2']);
  });

  it('archives and restores plants without changing their watering records', () => {
    const state = createEmptyState();
    state.plants = [{ id: 'p1', name: 'Монстера', color: 'forest', createdAt: 1 }];
    state.waterings = [{ id: 'w1', plantId: 'p1', date: '2026-10-01', water: null, ph: null, fert: { micro: null, grow: null, bloom: null, ripen: null }, note: '', createdAt: 2 }];

    const archived = setPlantArchived(state, 'p1', 100);
    expect(archived.plants[0].archivedAt).toBe(100);
    expect(archived.plantsView).toBe('archive');
    expect(archived.waterings).toEqual(state.waterings);

    const restored = setPlantArchived(archived, 'p1', null);
    expect(restored.plants[0]).not.toHaveProperty('archivedAt');
    expect(restored.plantsView).toBe('watering');
    expect(restored.waterings).toEqual(state.waterings);
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
