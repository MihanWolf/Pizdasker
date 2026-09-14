import { useRef } from 'react';
import { useStore } from '../core/store';
import { exportBackup, importBackup } from '../core/backup';
import { createEmptyState } from '../core/types';
import { todayStr } from '../core/selectors';
import { useConfirm } from '../ui/ConfirmDialog';

export function FooterBar() {
  const { state, saveStatus, retrySave, importState } = useStore();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const payload = exportBackup(state);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `konspekt-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let parsed: { exportedAt?: string } | null = null;
      try {
        parsed = JSON.parse(reader.result as string);
      } catch {
        await confirm({ title: 'Не удалось прочитать файл', message: 'Файл повреждён или это не резервная копия из этого приложения.', confirmLabel: 'Понятно' });
        return;
      }
      const dateSuffix = parsed?.exportedAt ? ` (бэкап от ${new Date(parsed.exportedAt).toLocaleDateString('ru-RU')})` : '';
      const ok = await confirm({
        title: 'Импортировать данные?',
        message: `Всё, что сейчас есть в приложении, будет заменено содержимым файла${dateSuffix}. Действие необратимо — если нужно, сначала сделай экспорт текущих данных.`,
        confirmLabel: 'Импортировать',
      });
      if (!ok) return;
      try {
        const { state: imported } = importBackup(reader.result as string);
        importState(imported);
      } catch {
        await confirm({ title: 'Не удалось прочитать файл', message: 'Похоже, это не бэкап из этого приложения.', confirmLabel: 'Понятно' });
      }
    };
    reader.readAsText(file);
  };

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Очистить всё?',
      message: 'Все предметы, заметки, финансовые записи и журналы поливов будут удалены без возможности восстановления.',
      confirmLabel: 'Очистить',
    });
    if (ok) importState(createEmptyState());
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
        <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleFileChange} />
        <button className="footer-reset" onClick={handleReset}>очистить все данные</button>
      </div>
    </div>
  );
}
