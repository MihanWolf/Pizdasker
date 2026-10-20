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
    const bytes = zipSync({
      'konspekt-backup.json': strToU8(exportBackup(state)),
      'photos/photo-one.webp': new Uint8Array([1, 2, 3]),
    });

    const imported = await parseBackupArchive(bytes);

    expect(imported.state.waterings[0].photoIds).toEqual(['photo-one']);
    expect(imported.photos).toHaveLength(1);
    expect(imported.photos[0].id).toBe('photo-one');
    expect(imported.photos[0].blob.type).toBe('image/webp');
    expect(Array.from(new Uint8Array(await imported.photos[0].blob.arrayBuffer()))).toEqual([1, 2, 3]);
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
    const bytes = zipSync({
      'konspekt-dashboard.json': strToU8(exportDashboardBackup(state, 'plants')),
      'photos/photo-one.webp': new Uint8Array([1, 2, 3]),
    });

    const imported = await parseBackupArchive(bytes);

    expect(imported.scope).toBe('dashboard');
    if (imported.scope !== 'dashboard') throw new Error('Expected dashboard archive');
    expect(imported.mode).toBe('plants');
    expect(imported.state.plants).toEqual(state.plants);
    expect(imported.photos).toHaveLength(1);
  });
});
