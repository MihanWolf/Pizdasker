import { describe, it, expect } from 'vitest';
import { DASHBOARD_MODES, exportBackup, exportDashboardBackup, importBackup, importBackupFile, replaceDashboardData } from './backup';
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

  it('keeps older watering entries that do not have a growth stage', () => {
    const oldWatering = {
      id: 'old-watering',
      plantId: 'p1',
      date: '2026-10-19',
      water: 1,
      ph: 6,
      fert: { micro: null, grow: null, bloom: null, ripen: null },
      note: '',
      createdAt: 1,
    };
    const { state } = importBackup(JSON.stringify({ waterings: [oldWatering] }));

    expect(state.waterings[0]).toEqual(oldWatering);
    expect(state.waterings[0].stage).toBeUndefined();
  });

  it('round-trips timestamped environment readings and defaults them for old backups', () => {
    const original = createEmptyState();
    original.environmentReadings = [{
      id: 'climate-1',
      recordedAt: '2026-10-20T04:15:00.000Z',
      temperature: 23.5,
      humidity: 61,
      createdAt: 2,
    }];
    original.plantsView = 'climate';
    original.plantsArchiveSort = 'age';
    original.plants.push({ id: 'archived', name: 'Фикус', color: 'forest', createdAt: 1, archivedAt: 2 });
    const { state: restored } = importBackup(exportBackup(original));
    const { state: legacy } = importBackup('{"plants":[]}');

    expect(restored.environmentReadings).toEqual(original.environmentReadings);
    expect(restored.plantsView).toBe('climate');
    expect(restored.plantsArchiveSort).toBe('age');
    expect(restored.plants[0].archivedAt).toBe(2);
    expect(legacy.environmentReadings).toEqual([]);
    expect(legacy.plantsView).toBe('watering');
    expect(legacy.plantsArchiveSort).toBe('archived');
  });

  it('round-trips archived plants and the archive library view', () => {
    const original = createEmptyState();
    original.plants = [{ id: 'plant-1', name: 'Фикус', color: 'forest', createdAt: 1, archivedAt: 2 }];
    original.plantsView = 'archive';
    original.plantsArchiveSort = 'name';

    const { state } = importBackup(exportBackup(original));

    expect(state.plants).toEqual(original.plants);
    expect(state.plantsView).toBe('archive');
    expect(state.plantsArchiveSort).toBe('name');
  });

  it('round-trips: export(new) -> import(new) preserves data', () => {
    const original = createEmptyState();
    original.shoppingItems = [{ id: 'x', title: 'Хлеб', quantity: '', createdAt: 1, purchasedAt: null }];
    original.waterings = [{
      id: 'w1',
      plantId: 'p1',
      date: '2026-10-20',
      water: 1,
      ph: 6,
      fert: { micro: null, grow: null, bloom: null, ripen: null },
      note: '',
      stage: 'Вегетация',
      createdAt: 2,
    }];
    const exported = exportBackup(original);
    const { state: reimported } = importBackup(exported);
    expect(reimported.shoppingItems).toEqual(original.shoppingItems);
    expect(reimported.waterings).toEqual(original.waterings);
  });

  it('defaults settings for backups that predate them', () => {
    const { state } = importBackup(legacyExportSample);
    expect(state.settings).toEqual({ hiddenModes: [], financeAdvanced: { enabled: false } });
  });

  it('sanitizes settings and round-trips valid ones', () => {
    const original = createEmptyState();
    original.settings.hiddenModes = ['finance'];
    original.settings.financeAdvanced.enabled = true;
    const { state: reimported } = importBackup(exportBackup(original));
    expect(reimported.settings).toEqual({ hiddenModes: ['finance'], financeAdvanced: { enabled: true } });

    const { state: dirty } = importBackup('{"settings":{"hiddenModes":["today","bogus"],"financeAdvanced":{}}}');
    expect(dirty.settings).toEqual({ hiddenModes: [], financeAdvanced: { enabled: false } });
  });

  it('exports a single dashboard and replaces only that dashboard on import', () => {
    const exportedState = createEmptyState();
    exportedState.plants = [{ id: 'plant-new', name: 'Фикус', color: 'forest', createdAt: 1 }];
    exportedState.plants[0].archivedAt = 10;
    exportedState.plantsView = 'archive';
    exportedState.plantsArchiveSort = 'age';
    exportedState.waterings = [{
      id: 'watering-new',
      plantId: 'plant-new',
      date: '2026-10-20',
      water: 1,
      ph: 6,
      fert: { micro: null, grow: null, bloom: null, ripen: null },
      note: '',
      createdAt: 2,
    }];
    exportedState.notePages = [{ id: 'exported-note', name: 'Не переносить', color: 'plum', createdAt: 3 }];

    const exported = exportDashboardBackup(exportedState, 'plants');
    const parsed = importBackupFile(exported);
    expect(parsed.scope).toBe('dashboard');
    if (parsed.scope !== 'dashboard') throw new Error('Expected dashboard backup');
    expect(parsed.mode).toBe('plants');
    expect(parsed.state.plants).toEqual(exportedState.plants);
    expect(parsed.state.plantsView).toBe('archive');
    expect(parsed.state.plantsArchiveSort).toBe('age');
    expect(parsed.state.notePages).toEqual([]);

    const targetState = createEmptyState();
    targetState.plants = [{ id: 'plant-old', name: 'Кактус', color: 'rust', createdAt: 4 }];
    targetState.notePages = [{ id: 'local-note', name: 'Мои заметки', color: 'teal', createdAt: 5 }];
    const replaced = replaceDashboardData(targetState, parsed.state, parsed.mode);

    expect(replaced.plants).toEqual(exportedState.plants);
    expect(replaced.plantsArchiveSort).toBe('age');
    expect(replaced.waterings).toEqual(exportedState.waterings);
    expect(replaced.notePages).toEqual(targetState.notePages);
  });

  it('round-trips an empty export for every standalone dashboard', () => {
    const state = createEmptyState();
    for (const mode of DASHBOARD_MODES) {
      const imported = importBackupFile(exportDashboardBackup(state, mode));
      expect(imported.scope).toBe('dashboard');
      if (imported.scope !== 'dashboard') throw new Error('Expected dashboard backup');
      expect(imported.mode).toBe(mode);
    }
  });

  it('keeps full backups distinguishable and rejects incomplete dashboard exports', () => {
    expect(importBackupFile(exportBackup(createEmptyState())).scope).toBe('all');
    expect(() => importBackupFile(JSON.stringify({
      format: 'pizdasker-dashboard',
      version: 1,
      mode: 'plants',
      data: { plants: [], waterings: [] },
    }))).toThrow(/обязательное поле/);
  });
});
