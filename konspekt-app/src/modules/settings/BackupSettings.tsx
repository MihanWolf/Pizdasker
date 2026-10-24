import { useRef } from 'react';
import { useStore } from '../../core/store';
import { DASHBOARD_LABELS, replaceDashboardData } from '../../core/backup';
import { createEmptyState } from '../../core/types';
import { todayStr } from '../../core/selectors';
import { exportBackupArchive } from '../../core/backupArchive';
import { clearPlantPhotos, replacePlantPhotos } from '../../core/plantPhotoStorage';
import { readBackupFile } from '../../core/backupFile';
import { useConfirm } from '../../ui/ConfirmDialog';
import { DownloadIcon, ImportIcon, TrashIcon } from '../../ui/icons';

export function BackupSettings() {
  const { state, importState } = useStore();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const payload = await exportBackupArchive(state);
      downloadFile(payload.slice().buffer as ArrayBuffer, `konspekt-backup-${todayStr()}.zip`);
    } catch (error) {
      await confirm({
        title: 'Не удалось создать бэкап',
        message: error instanceof Error ? error.message : 'Ошибка чтения локальных фотографий.',
        confirmLabel: 'Понятно',
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void (async () => {
      try {
        const prepared = await readBackupFile(file);
        const dateSuffix = prepared.exportedAt ? ` (бэкап от ${new Date(prepared.exportedAt).toLocaleDateString('ru-RU')})` : '';
        const isDashboard = prepared.scope === 'dashboard';
        const dashboardLabel = isDashboard ? DASHBOARD_LABELS[prepared.mode] : '';
        const ok = await confirm({
          title: isDashboard ? `Импортировать раздел «${dashboardLabel}»?` : 'Импортировать данные?',
          message: isDashboard
            ? `Данные раздела «${dashboardLabel}» будут заменены данными из файла${dateSuffix}. Остальные разделы не изменятся.`
            : `Всё, что сейчас есть в приложении, будет заменено содержимым файла${dateSuffix}. Действие необратимо — если нужно, сначала сделай экспорт текущих данных.`,
          confirmLabel: 'Импортировать',
        });
        if (!ok) return;
        if (prepared.scope === 'all') {
          if (prepared.photos) await replacePlantPhotos(prepared.photos);
          else await clearPlantPhotos();
          importState(prepared.state);
        } else {
          if (prepared.mode === 'plants') await replacePlantPhotos(prepared.photos ?? []);
          importState(replaceDashboardData(state, prepared.state, prepared.mode));
        }
      } catch (error) {
        await confirm({
          title: 'Не удалось импортировать файл',
          message: error instanceof Error ? error.message : 'Файл повреждён или это не резервная копия из этого приложения.',
          confirmLabel: 'Понятно',
        });
      }
    })();
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Очистить всё?',
      message: 'Все предметы, заметки, финансовые записи и журналы поливов будут удалены без возможности восстановления.',
      confirmLabel: 'Очистить',
    });
    if (!ok) return;
    try {
      await clearPlantPhotos();
      importState(createEmptyState());
    } catch (error) {
      await confirm({
        title: 'Не удалось очистить фотографии',
        message: error instanceof Error ? error.message : 'Неизвестная ошибка локального хранилища.',
        confirmLabel: 'Понятно',
      });
    }
  };

  return (
    <section className="settings-section">
      <h2 className="settings-section-title">Данные и резервные копии</h2>
      <p className="settings-section-hint">
        Экспорт сохраняет все данные и фотографии в ZIP-архив. Импорт заменит данные приложения.
      </p>
      <div className="settings-rows">
        <button className="settings-row" onClick={handleExport}>
          <span className="settings-row-icon"><DownloadIcon /></span>
          <span className="settings-row-label">Экспортировать все данные</span>
        </button>
        <button className="settings-row" onClick={() => fileInputRef.current?.click()}>
          <span className="settings-row-icon"><ImportIcon /></span>
          <span className="settings-row-label">Импортировать данные</span>
        </button>
        <button className="settings-row settings-row-danger" onClick={handleReset}>
          <span className="settings-row-icon"><TrashIcon /></span>
          <span className="settings-row-label">Очистить все данные</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json,application/zip,.zip"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </section>
  );
}

function downloadFile(data: ArrayBuffer, filename: string) {
  const blob = new Blob([data], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
