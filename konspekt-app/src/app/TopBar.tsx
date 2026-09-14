import { useStore } from '../core/store';
import { COLOR_VARS, PALETTE, type ColorName } from '../core/types';
import { useConfirm } from '../ui/ConfirmDialog';

interface TopBarProps {
  name: string;
  color: ColorName;
  onRename: (name: string) => void;
  onCycleColor: () => void;
  deleteLabel: string;
  deleteTitle: string;
  deleteMessage: string;
  onDelete: () => void;
  meta: React.ReactNode;
}

export function TopBar({ name, color, onRename, onCycleColor, deleteLabel, deleteTitle, deleteMessage, onDelete, meta }: TopBarProps) {
  const confirm = useConfirm();

  const handleDelete = async () => {
    const ok = await confirm({ title: deleteTitle, message: deleteMessage, confirmLabel: 'Удалить' });
    if (ok) onDelete();
  };

  return (
    <div className="topbar">
      <div className="subject-title-wrap">
        <div className="subject-dot" style={{ background: COLOR_VARS[color] }} onClick={onCycleColor} title="Сменить цвет" />
        <div
          className="subject-title"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onBlur={(e) => onRename(e.currentTarget.textContent?.trim() ?? '')}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
        >
          {name}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="subject-progress">{meta}</div>
        <button className="delete-subject" onClick={handleDelete}>{deleteLabel}</button>
      </div>
    </div>
  );
}

export function useCycleColor() {
  const { update } = useStore();
  return (kind: 'subject' | 'page' | 'plant', id: string) => {
    update((draft) => {
      const list = kind === 'subject' ? draft.subjects : kind === 'page' ? draft.notePages : draft.plants;
      const item = list.find((x) => x.id === id);
      if (item) {
        const idx = PALETTE.indexOf(item.color);
        item.color = PALETTE[(idx + 1) % PALETTE.length];
      }
    });
  };
}
