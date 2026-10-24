import { useStore } from '../core/store';
import { COLOR_VARS, PALETTE, type ColorName } from '../core/types';

export interface TopBarAction {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'danger' | 'neutral';
}

interface TopBarProps {
  name: string;
  color: ColorName;
  onRename: (name: string) => void;
  onCycleColor: () => void;
  action: TopBarAction;
  meta: React.ReactNode;
  headerContent?: React.ReactNode;
  className?: string;
}

export function TopBar({ name, color, onRename, onCycleColor, action, meta, headerContent, className }: TopBarProps) {
  return (
    <div className={`topbar ${className ?? ''}`}>
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
      {headerContent}
      <div className="topbar-meta">
        <div className="subject-progress">{meta}</div>
      </div>
      <button
        className={`topbar-action${action.variant === 'danger' ? ' danger' : ''}`}
        title={action.label}
        aria-label={action.label}
        disabled={action.disabled}
        onClick={action.onClick}
      >
        {action.icon}
      </button>
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
