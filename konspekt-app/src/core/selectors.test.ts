import { describe, it, expect } from 'vitest';
import { calculateDailyBudget, filteredNotesForPage, noteCountLabel, daysAgoLabel, filteredWateringsForPlant, filteredTasksForProject, remainingTotal, sortedFinanceItems, sortedIncomes, fmtMoney, paymentDaysUntil, paymentNeedsAttention, mixHexColors, wateringDaysAgo, plantNeedsWater, importantOpenTasks, topWishes, sortTopics, subjectProgress, ungroupedTopics, groupTopics, filteredTopicsForSubject } from './selectors';
import { createEmptyState } from './types';

describe('calculateDailyBudget', () => {
  it('returns 0 when there is no future income', () => {
    const state = createEmptyState();
    const result = calculateDailyBudget(state);
    expect(result.displayValue).toBe(0);
  });

  it('splits income minus due debts across days until income', () => {
    const state = createEmptyState();
    const now = new Date('2026-09-06T00:00:00');
    state.financeItems = [
      { id: '1', type: 'income', title: 'Доход', amount: 1000, incomeDate: '2026-09-16', createdAt: 1 },
      { id: '2', type: 'debt', title: 'Платёж', amount: 200, progress: 0, dueDate: '2026-09-10', done: false, createdAt: 2 },
    ];
    const result = calculateDailyBudget(state, now);
    // (1000 - 200) / 10 дней = 80
    expect(result.displayValue).toBe(80);
    expect(result.isNegative).toBe(false);
  });

  it('flags negative budget when expenses exceed income', () => {
    const state = createEmptyState();
    const now = new Date('2026-09-06T00:00:00');
    state.financeItems = [
      { id: '1', type: 'income', title: 'Доход', amount: 100, incomeDate: '2026-09-07', createdAt: 1 },
      { id: '2', type: 'debt', title: 'Платёж', amount: 500, progress: 0, dueDate: '2026-09-07', done: false, createdAt: 2 },
    ];
    const result = calculateDailyBudget(state, now);
    expect(result.isNegative).toBe(true);
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

  it('importantOpenTasks returns only important+undone, newest first, capped at limit', () => {
    const state = createEmptyState();
    state.taskItems = [
      { id: 't1', projectId: 'p', title: 'A', important: true, done: false, createdAt: 1, completedAt: null },
      { id: 't2', projectId: 'p', title: 'B', important: false, done: false, createdAt: 2, completedAt: null },
      { id: 't3', projectId: 'p', title: 'C', important: true, done: true, createdAt: 3, completedAt: 3 },
      { id: 't4', projectId: 'p', title: 'D', important: true, done: false, createdAt: 4, completedAt: null },
    ];
    const result = importantOpenTasks(state);
    expect(result.map((t) => t.id)).toEqual(['t4', 't1']);
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
      { id: 'i1', type: 'income', title: 'Доход', amount: 900, incomeDate: '2026-09-16', createdAt: 5 },
      { id: 'i2', type: 'income', title: 'Доход', amount: 100, incomeDate: '2026-09-08', createdAt: 6 },
    ];
    return state;
  }

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
