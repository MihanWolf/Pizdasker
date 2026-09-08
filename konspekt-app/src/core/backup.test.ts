import { describe, it, expect } from 'vitest';
import { importBackup, exportBackup } from './backup';
import { createEmptyState } from './types';

// Это ровно то, что выгружает footer-export в старой (vanilla) версии —
// снимок из snapshotState() в app.js, скопированный как есть.
const legacyExportSample = `{
  "subjects": [{ "id": "s1", "name": "История", "color": "teal", "createdAt": 1 }],
  "groups": [],
  "topics": [{ "id": "t1", "subjectId": "s1", "groupId": null, "title": "Древний Рим", "note": "", "why": "", "links": [], "done": false, "urgent": false, "createdAt": 2 }],
  "activeSubjectId": "s1",
  "notePages": [{ "id": "n1", "name": "Идеи", "color": "plum", "createdAt": 3 }],
  "noteEntries": [],
  "activeNotePageId": "n1",
  "financeItems": [{ "id": "f1", "type": "debt", "title": "Кредит", "amount": 5000, "progress": 1000, "dueDate": "2026-10-01", "done": false, "createdAt": 4 }],
  "currency": "₽",
  "plants": [{ "id": "p1", "name": "Монстера", "color": "forest", "createdAt": 5 }],
  "waterings": [],
  "activePlantId": "p1",
  "shoppingItems": [{ "id": "sh1", "title": "Молоко", "quantity": "2 л", "createdAt": 6, "purchasedAt": null }],
  "shoppingView": "current",
  "taskProjects": [{ "id": "tp1", "name": "Дом", "color": "rust", "createdAt": 7 }],
  "taskItems": [{ "id": "ti1", "projectId": "tp1", "title": "Наклеить обои", "important": true, "done": false, "createdAt": 8, "completedAt": null }],
  "activeTaskProjectId": "tp1",
  "tasksView": "current",
  "onboarding": { "active": false, "scene": "done" },
  "mode": "shopping",
  "exportedAt": "2026-08-01T12:00:00.000Z"
}`;

describe('importBackup (legacy compatibility)', () => {
  it('reads a real export produced by the old vanilla app.js unchanged', () => {
    const { state, exportedAt } = importBackup(legacyExportSample);

    expect(state.subjects).toHaveLength(1);
    expect(state.subjects[0].name).toBe('История');
    expect(state.topics[0].title).toBe('Древний Рим');
    expect(state.financeItems[0].amount).toBe(5000);
    expect(state.taskItems[0].important).toBe(true);
    expect(state.shoppingItems[0].title).toBe('Молоко');
    expect(state.mode).toBe('shopping');
    expect(state.onboarding.active).toBe(false); // обряд не должен запускаться заново при импорте реальных данных
    expect(exportedAt).toBe('2026-08-01T12:00:00.000Z');
  });

  it('fills missing fields with empty defaults instead of throwing', () => {
    const { state } = importBackup('{"subjects": []}');
    expect(state.taskItems).toEqual([]);
    expect(state.currency).toBe('₽');
  });

  it('round-trips: export(new) -> import(new) preserves data', () => {
    const original = createEmptyState();
    original.shoppingItems = [{ id: 'x', title: 'Хлеб', quantity: '', createdAt: 1, purchasedAt: null }];
    const exported = exportBackup(original);
    const { state: reimported } = importBackup(exported);
    expect(reimported.shoppingItems).toEqual(original.shoppingItems);
  });
});
