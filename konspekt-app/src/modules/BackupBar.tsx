import { useRef } from 'react';
import { useStore } from '../core/store';
import { exportBackup, importBackup } from '../core/backup';
import { todayStr } from '../core/selectors';

export function BackupBar() {
  const { state, importState } = useStore();
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
    reader.onload = () => {
      try {
        const { state: imported } = importBackup(reader.result as string);
        const confirmed = window.confirm(
          'Всё, что сейчас есть в приложении, будет заменено содержимым файла. Действие необратимо — если нужно, сначала сделай экспорт текущих данных.'
        );
        if (confirmed) importState(imported);
      } catch {
        window.alert('Не удалось прочитать файл. Похоже, это не бэкап из этого приложения.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ position: 'fixed', bottom: 8, right: 16, display: 'flex', gap: 14, fontSize: 11, fontFamily: 'monospace', color: 'var(--ink-faint)' }}>
      <button style={btnStyle} onClick={handleExport}>экспорт</button>
      <button style={btnStyle} onClick={handleImportClick}>импорт</button>
      <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleFileChange} />
    </div>
  );
}

const btnStyle: React.CSSProperties = { background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' };
