import { describe, it, expect } from 'vitest';
import { withActiveIdFallbacks } from './store';
import { createEmptyState } from './types';

describe('withActiveIdFallbacks', () => {
  it('falls back to the first item when the active id is null', () => {
    const state = createEmptyState();
    state.subjects = [{ id: 's1', name: 'История', color: 'teal', createdAt: 1 }];
    state.notePages = [{ id: 'n1', name: 'Идеи', color: 'plum', createdAt: 1 }];
    state.plants = [{ id: 'p1', name: 'Монстера', color: 'forest', createdAt: 1 }];
    state.taskProjects = [{ id: 'tp1', name: 'Дом', color: 'rust', createdAt: 1 }];

    const result = withActiveIdFallbacks(state);

    expect(result.activeSubjectId).toBe('s1');
    expect(result.activeNotePageId).toBe('n1');
    expect(result.activePlantId).toBe('p1');
    expect(result.activeTaskProjectId).toBe('tp1');
  });

  it('keeps a valid active id and drops one pointing at a deleted item', () => {
    const state = createEmptyState();
    state.subjects = [
      { id: 's1', name: 'История', color: 'teal', createdAt: 1 },
      { id: 's2', name: 'Математика', color: 'rust', createdAt: 2 },
    ];
    state.activeSubjectId = 's2';
    state.plants = [{ id: 'p1', name: 'Монстера', color: 'forest', createdAt: 1 }];
    state.activePlantId = 'missing';

    const result = withActiveIdFallbacks(state);

    expect(result.activeSubjectId).toBe('s2');
    expect(result.activePlantId).toBe('p1');
  });

  it('resolves to null when the list is empty', () => {
    const result = withActiveIdFallbacks(createEmptyState());
    expect(result.activeSubjectId).toBeNull();
    expect(result.activeNotePageId).toBeNull();
    expect(result.activePlantId).toBeNull();
    expect(result.activeTaskProjectId).toBeNull();
  });
});
