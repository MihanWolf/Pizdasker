import { useRef } from 'react';
import { useStore } from '../core/store';
import { DASHBOARD_LABELS, DASHBOARD_MODES, exportDashboardBackup, replaceDashboardData, type DashboardMode } from '../core/backup';
import { createEmptyState, type AppState } from '../core/types';
import { todayStr } from '../core/selectors';
import { useConfirm } from '../ui/ConfirmDialog';
import { exportDashboardArchive } from '../core/backupArchive';
import { clearPlantPhotos, replacePlantPhotos } from '../core/plantPhotoStorage';
import { readBackupFile } from '../core/backupFile';
import { DownloadIcon, GearIcon, ImportIcon, TrashIcon } from '../ui/icons';

export function FooterBar() {
  const { state, saveStatus, retrySave, importState, update } = useStore();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeDashboard = isDashboardMode(state.mode) ? state.mode : null;
  const showDeleteSection = activeDashboard !== null && hasDashboardData(state, activeDashboard);

  const handleDeleteSection = async () => {
    if (!activeDashboard) return;
    const label = DASHBOARD_LABELS[activeDashboard];
    const ok = await confirm({
      title: `Удалить данные раздела «${label}»?`,
      message: `Все данные раздела «${label}» будут удалены безвозвратно. Данные остальных разделов не изменятся.`,
      confirmLabel: 'Удалить',
    });
    if (!ok) return;
    try {
      if (activeDashboard === 'plants') await clearPlantPhotos();
      importState(replaceDashboardData(state, createEmptyState(), activeDashboard));
    } catch (error) {
      await confirm({
        title: 'Не удалось очистить раздел',
        message: error instanceof Error ? error.message : 'Неизвестная ошибка локального хранилища.',
        confirmLabel: 'Понятно',
      });
    }
  };

  const handleDashboardExport = async () => {
    const dashboardMode = isDashboardMode(state.mode) ? state.mode : null;
    if (!dashboardMode) {
      await confirm({
        title: 'Нельзя экспортировать этот экран',
        message: 'Открой один из разделов, чтобы экспортировать только его данные.',
        confirmLabel: 'Понятно',
      });
      return;
    }

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void (async () => {
      try {
        const prepared = await readBackupFile(file);
        if (prepared.scope !== 'dashboard') {
          await confirm({
            title: 'Это полный бэкап',
            message: 'Импорт полного бэкапа доступен в настройках. Здесь можно импортировать только данные отдельного раздела.',
            confirmLabel: 'Понятно',
          });
          return;
        }
        const dateSuffix = prepared.exportedAt ? ` (бэкап от ${new Date(prepared.exportedAt).toLocaleDateString('ru-RU')})` : '';
        const dashboardLabel = DASHBOARD_LABELS[prepared.mode];
        const ok = await confirm({
          title: `Импортировать раздел «${dashboardLabel}»?`,
          message: `Данные раздела «${dashboardLabel}» будут заменены данными из файла${dateSuffix}. Остальные разделы не изменятся.`,
          confirmLabel: 'Импортировать',
        });
        if (!ok) return;
        if (prepared.mode === 'plants') await replacePlantPhotos(prepared.photos ?? []);
        importState(replaceDashboardData(state, prepared.state, prepared.mode));
      } catch (error) {
        await confirm({
          title: 'Не удалось импортировать файл',
          message: error instanceof Error ? error.message : 'Файл повреждён или это не резервная копия из этого приложения.',
          confirmLabel: 'Понятно',
        });
      }
    })();
  };

  return (
    <div className="footer-bar">
      <div className="footer-actions">
        <button className="footer-icon-btn" title="Экспортировать раздел" aria-label="Экспортировать раздел" onClick={handleDashboardExport}>
          <DownloadIcon />
        </button>
        <button className="footer-icon-btn" title="Импортировать раздел" aria-label="Импортировать раздел" onClick={() => fileInputRef.current?.click()}>
          <ImportIcon />
        </button>
        <input ref={fileInputRef} type="file" accept="application/json,.json,application/zip,.zip" style={{ display: 'none' }} onChange={handleFileChange} />
        {saveStatus.kind === 'error' && <button className="save-retry" onClick={retrySave}>повторить</button>}
        {showDeleteSection && activeDashboard && (
          <button
            className="footer-icon-btn footer-icon-btn-danger"
            title={`Удалить данные раздела «${DASHBOARD_LABELS[activeDashboard]}»`}
            aria-label={`Удалить данные раздела «${DASHBOARD_LABELS[activeDashboard]}»`}
            onClick={handleDeleteSection}
          >
            <TrashIcon />
          </button>
        )}
        <button
          className={'footer-settings' + (state.mode === 'settings' ? ' active' : '')}
          title={`Настройки · ${saveStatus.text}`}
          aria-label={`Настройки. ${saveStatus.text}`}
          onClick={() => update((draft) => { draft.mode = 'settings'; })}
        >
          <GearIcon />
          <span className={'save-dot ' + saveStatus.kind} />
        </button>
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

function isDashboardMode(mode: AppState['mode']): mode is DashboardMode {
  return DASHBOARD_MODES.includes(mode as DashboardMode);
}

function hasDashboardData(state: AppState, mode: DashboardMode): boolean {
  switch (mode) {
    case 'finance':
      return state.financeItems.length > 0 || state.financeOperations.length > 0 || state.balance !== 0;
    case 'tasks':
      return state.taskProjects.length > 0 || state.taskItems.length > 0;
    case 'shopping':
      return state.shoppingItems.length > 0;
    case 'notes':
      return state.notePages.length > 0 || state.noteEntries.length > 0;
    case 'plants':
      return state.plants.length > 0 || state.waterings.length > 0 || state.environmentReadings.length > 0;
    case 'study':
      return state.subjects.length > 0 || state.groups.length > 0 || state.topics.length > 0;
  }
}
