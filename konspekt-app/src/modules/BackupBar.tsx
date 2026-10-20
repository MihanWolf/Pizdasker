import { useRef, useState } from 'react';
import { useStore } from '../core/store';
import { DASHBOARD_LABELS, DASHBOARD_MODES, exportDashboardBackup, importBackupFile, replaceDashboardData, type DashboardMode } from '../core/backup';
import { createEmptyState, type AppState } from '../core/types';
import { todayStr } from '../core/selectors';
import { useConfirm } from '../ui/ConfirmDialog';
import { exportBackupArchive, exportDashboardArchive, parseBackupArchive } from '../core/backupArchive';
import { clearPlantPhotos, replacePlantPhotos } from '../core/plantPhotoStorage';
import type { StoredPlantPhoto } from '../core/plantPhotoStorage';

export function FooterBar() {
  const { state, saveStatus, retrySave, importState } = useStore();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dashboardFileInputRef = useRef<HTMLInputElement>(null);
  const importScopeRef = useRef<'all' | 'dashboard'>('all');
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>('plants');

  const handleExport = async () => {
    try {
      const payload = await exportBackupArchive(state);
      downloadFile(payload.slice().buffer as ArrayBuffer, `konspekt-backup-${todayStr()}.zip`, 'application/zip');
    } catch (error) {
      await confirm({
        title: 'Не удалось создать бэкап',
        message: error instanceof Error ? error.message : 'Ошибка чтения локальных фотографий.',
        confirmLabel: 'Понятно',
      });
    }
  };

  const handleImportClick = () => {
    importScopeRef.current = 'all';
    fileInputRef.current?.click();
  };
  const handleDashboardExport = async () => {
    try {
      if (dashboardMode === 'plants') {
        const payload = await exportDashboardArchive(state);
        downloadFile(payload.slice().buffer as ArrayBuffer, `konspekt-poliv-${todayStr()}.zip`, 'application/zip');
      } else {
        downloadText(exportDashboardBackup(state, dashboardMode), `konspekt-${dashboardMode}-${todayStr()}.json`);
      }
    } catch (error) {
      await confirm({
        title: 'Не удалось экспортировать раздел',
        message: error instanceof Error ? error.message : 'Ошибка чтения локальных данных.',
        confirmLabel: 'Понятно',
      });
    }
  };
  const handleDashboardImportClick = () => {
    importScopeRef.current = 'dashboard';
    dashboardFileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void (async () => {
      try {
        const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';
        let imported: AppState;
        let exportedAt: string | null;
        let photos: StoredPlantPhoto[] | null = null;
        let scope: 'all' | 'dashboard';
        let dashboard: DashboardMode | null = null;
        if (isZip) {
          const prepared = await parseBackupArchive(new Uint8Array(await file.arrayBuffer()));
          imported = prepared.state;
          exportedAt = prepared.exportedAt;
          photos = prepared.photos;
          scope = prepared.scope;
          if (prepared.scope === 'dashboard') dashboard = prepared.mode;
        } else {
          const prepared = importBackupFile(await file.text());
          imported = prepared.state;
          exportedAt = prepared.exportedAt;
          scope = prepared.scope;
          if (prepared.scope === 'dashboard') dashboard = prepared.mode;
        }
        if (scope !== importScopeRef.current) {
          throw new Error(scope === 'dashboard'
            ? 'Выбран бэкап одного раздела. Используй кнопку «импорт раздела».'
            : 'Выбран полный бэкап. Используй кнопку «импорт».');
        }
        if (!isZip && imported.waterings.some((entry) => entry.photoIds?.length)) {
          throw new Error('Бэкап содержит фотографии. Для их восстановления выберите ZIP-архив.');
        }
        const dateSuffix = exportedAt ? ` (бэкап от ${new Date(exportedAt).toLocaleDateString('ru-RU')})` : '';
        const isDashboard = scope === 'dashboard' && dashboard !== null;
        const dashboardLabel = dashboard === null ? '' : DASHBOARD_LABELS[dashboard];
        const ok = await confirm({
          title: isDashboard ? `Импортировать раздел «${dashboardLabel}»?` : 'Импортировать данные?',
          message: isDashboard
            ? `Данные раздела «${dashboardLabel}» будут заменены данными из файла${dateSuffix}. Остальные разделы не изменятся.`
            : `Всё, что сейчас есть в приложении, будет заменено содержимым файла${dateSuffix}. Действие необратимо — если нужно, сначала сделай экспорт текущих данных.`,
          confirmLabel: 'Импортировать',
        });
        if (!ok) return;
        if (scope === 'all') {
          if (photos) await replacePlantPhotos(photos);
          else await clearPlantPhotos();
          importState(imported);
        } else if (dashboard) {
          if (dashboard === 'plants') await replacePlantPhotos(photos ?? []);
          importState(replaceDashboardData(state, imported, dashboard));
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
    if (ok) {
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
    }
  };

  return (
    <div className="footer-bar">
      <div className="save-indicator">
        <div className={'save-dot ' + saveStatus.kind} />
        <span>{saveStatus.text}</span>
        {saveStatus.kind === 'error' && <button className="save-retry" onClick={retrySave}>повторить</button>}
      </div>
      <div className="footer-actions">
        <button className="footer-btn" onClick={handleExport}>экспорт</button>
        <button className="footer-btn" onClick={handleImportClick}>импорт</button>
        <input ref={fileInputRef} type="file" accept="application/json,.json,application/zip,.zip" style={{ display: 'none' }} onChange={handleFileChange} />
        <label className="footer-dashboard-picker">
          <span>Раздел для экспорта</span>
          <select value={dashboardMode} onChange={(event) => setDashboardMode(event.target.value as DashboardMode)}>
            {DASHBOARD_MODES.map((mode) => <option key={mode} value={mode}>{DASHBOARD_LABELS[mode]}</option>)}
          </select>
        </label>
        <button className="footer-btn" onClick={handleDashboardExport}>экспорт раздела</button>
        <button className="footer-btn" onClick={handleDashboardImportClick}>импорт раздела</button>
        <input ref={dashboardFileInputRef} type="file" accept="application/json,.json,application/zip,.zip" style={{ display: 'none' }} onChange={handleFileChange} />
        <button className="footer-reset" onClick={handleReset}>очистить все данные</button>
      </div>
    </div>
  );
}

function downloadFile(data: ArrayBuffer, filename: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadText(data: string, filename: string) {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
