import { useStore } from '../../core/store';
import { HIDEABLE_MODES, type AppMode } from '../../core/types';
import { isModeHidden } from '../../core/selectors';
import { NAV_MODES } from '../../app/modes';
import { GearIcon } from '../../ui/icons';
import './settings.css';

export function Settings() {
  const { state, update } = useStore();

  const hideable = NAV_MODES.filter(({ mode }) => HIDEABLE_MODES.includes(mode));

  const toggleMode = (mode: AppMode) => {
    update((draft) => {
      const hidden = draft.settings.hiddenModes;
      draft.settings.hiddenModes = hidden.includes(mode)
        ? hidden.filter((m) => m !== mode)
        : [...hidden, mode];
    });
  };

  const toggleFinanceAdvanced = () => {
    update((draft) => {
      draft.settings.financeAdvanced.enabled = !draft.settings.financeAdvanced.enabled;
    });
  };

  return (
    <div className="content-scroll">
      <div className="settings-head">
        <div className="settings-kicker"><GearIcon /> Настройки</div>
        <h1 className="settings-title display">Настройки</h1>
      </div>

      <section className="settings-section">
        <h2 className="settings-section-title">Разделы</h2>
        <p className="settings-section-hint">
          Скрытые разделы убираются из полки и не показываются на «Главной».
        </p>
        <div className="settings-rows">
          {hideable.map(({ mode, title, icon }) => {
            const on = !isModeHidden(state, mode);
            return (
              <button
                key={mode}
                className="settings-row"
                role="switch"
                aria-checked={on}
                onClick={() => toggleMode(mode)}
              >
                <span className="settings-row-icon">{icon}</span>
                <span className="settings-row-label">{title}</span>
                <span className={'settings-switch' + (on ? ' on' : '')}><span /></span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Финансы</h2>
        <p className="settings-section-hint">
          Расширенный режим добавит дополнительные поля, операции и типы доходов.
        </p>
        <div className="settings-rows">
          <button
            className="settings-row"
            role="switch"
            aria-checked={state.settings.financeAdvanced.enabled}
            onClick={toggleFinanceAdvanced}
          >
            <span className="settings-row-label">Продвинутый режим</span>
            <span className={'settings-switch' + (state.settings.financeAdvanced.enabled ? ' on' : '')}><span /></span>
          </button>
        </div>
      </section>
    </div>
  );
}