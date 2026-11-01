import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { createEmptyState } from './types';
import { parseBackupArchive } from './backupArchive';
import { exportBackup, exportDashboardBackup } from './backup';

describe('backup archives', () => {
  it('restores an archive manifest and photo blobs with their referenced ids', async () => {
    const state = createEmptyState();
    state.waterings = [{
      id: 'w1',
      plantId: 'p1',
      date: '2026-10-20',
      water: null,
      ph: null,
      fert: { micro: null, grow: null, bloom: null, ripen: null },
      note: '',
      photoIds: ['photo-one'],
      createdAt: 1,
    }];
    state.plantProblems = [{
      id: 'problem-1',
      title: 'Пятна на листе',
      description: 'Пример описания',
      category: 'deficit',
      cause: '',
      signs: '',
      correction: '',
      photoIds: ['problem-photo'],
      isDemo: false,
      createdAt: 2,
      updatedAt: 2,
    }];
    const bytes = zipSync({
      'konspekt-backup.json': strToU8(exportBackup(state)),
      'photos/photo-one.webp': new Uint8Array([1, 2, 3]),
      'photos/problem-photo.png': new Uint8Array([4, 5, 6]),
    });

    const imported = await parseBackupArchive(bytes);

    expect(imported.state.waterings[0].photoIds).toEqual(['photo-one']);
    expect(imported.photos).toHaveLength(2);
    expect(imported.photos.map((photo) => photo.id).sort()).toEqual(['photo-one', 'problem-photo']);
    const problemPhoto = imported.photos.find((photo) => photo.id === 'problem-photo');
    if (!problemPhoto) throw new Error('Expected the problem example photo');
    expect(problemPhoto.blob.type).toBe('image/png');
    expect(Array.from(new Uint8Array(await problemPhoto.blob.arrayBuffer()))).toEqual([4, 5, 6]);
  });

  it('rejects archives with missing attached photos or no manifest', async () => {
    const state = createEmptyState();
    state.waterings = [{
      id: 'w1',
      plantId: 'p1',
      date: '2026-10-20',
      water: null,
      ph: null,
      fert: { micro: null, grow: null, bloom: null, ripen: null },
      note: '',
      photoIds: ['missing'],
      createdAt: 1,
    }];
    const missingPhoto = zipSync({ 'konspekt-backup.json': strToU8(exportBackup(state)) });
    const missingManifest = zipSync({ 'other.json': strToU8('{}') });

    await expect(parseBackupArchive(missingPhoto)).rejects.toThrow(/отсутствуют 1 фото/);
    await expect(parseBackupArchive(missingManifest)).rejects.toThrow(/нет файла резервной копии/);
  });

  it('imports a plant dashboard archive with only its attached photos', async () => {
    const state = createEmptyState();
    state.plants = [{ id: 'p1', name: 'Монстера', color: 'forest', createdAt: 1 }];
    state.waterings = [{
      id: 'w1',
      plantId: 'p1',
      date: '2026-10-20',
      water: null,
      ph: null,
      fert: { micro: null, grow: null, bloom: null, ripen: null },
      note: '',
      photoIds: ['photo-one'],
      createdAt: 2,
    }];
    state.plantProblems = [{
      id: 'problem-1',
      title: 'Пятна на листе',
      description: 'Пример описания',
      category: 'deficit',
      cause: '',
      signs: '',
      correction: '',
      photoIds: ['problem-photo'],
      isDemo: false,
      createdAt: 3,
      updatedAt: 3,
    }];
    const bytes = zipSync({
      'konspekt-dashboard.json': strToU8(exportDashboardBackup(state, 'plants')),
      'photos/photo-one.webp': new Uint8Array([1, 2, 3]),
      'photos/problem-photo.webp': new Uint8Array([4, 5, 6]),
    });

    const imported = await parseBackupArchive(bytes);

    expect(imported.scope).toBe('dashboard');
    if (imported.scope !== 'dashboard') throw new Error('Expected dashboard archive');
    expect(imported.mode).toBe('plants');
    expect(imported.state.plants).toEqual(state.plants);
    expect(imported.state.plantProblems).toEqual(state.plantProblems);
    expect(imported.photos).toHaveLength(2);
  });
});
