import { useState } from 'react';
import { useStore } from '../../core/store';
import { uid, COLOR_VARS, PALETTE, type Plant, type Watering, type FertAmounts } from '../../core/types';
import { filteredWateringsForPlant, daysAgoLabel, todayStr } from '../../core/selectors';
import { useConfirm } from '../../ui/ConfirmDialog';
import './plants.css';

const FERT_KEYS: [keyof FertAmounts, string][] = [
  ['micro', 'Micro'],
  ['grow', 'Grow'],
  ['bloom', 'Bloom'],
  ['ripen', 'Ripen'],
];

export function Plants() {
  const { state, update } = useStore();
  const [activePlantId, setActivePlantId] = useState<string | null>(state.plants[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [newPlantName, setNewPlantName] = useState<string | null>(null);
  const confirm = useConfirm();

  const activePlant = state.plants.find((p) => p.id === activePlantId) ?? null;

  const addPlant = () => {
    const name = newPlantName?.trim();
    setNewPlantName(null);
    if (!name) return;
    const plant: Plant = { id: uid(), name, color: PALETTE[state.plants.length % PALETTE.length], createdAt: Date.now() };
    update((draft) => { draft.plants.push(plant); });
    setActivePlantId(plant.id);
  };

  const deletePlant = async (plant: Plant) => {
    const ok = await confirm({
      title: 'Удалить растение?',
      message: `«${plant.name}» и весь его журнал поливов будут удалены безвозвратно.`,
      confirmLabel: 'Удалить',
    });
    if (!ok) return;
    update((draft) => {
      draft.plants = draft.plants.filter((p) => p.id !== plant.id);
      draft.waterings = draft.waterings.filter((w) => w.plantId !== plant.id);
    });
    if (activePlantId === plant.id) setActivePlantId(state.plants.find((p) => p.id !== plant.id)?.id ?? null);
  };

  return (
    <div className="plants-layout">
      <aside className="plants-shelf">
        {state.plants.map((plant) => {
          const count = state.waterings.filter((w) => w.plantId === plant.id).length;
          return (
            <div
              key={plant.id}
              className={'plants-spine' + (plant.id === activePlantId ? ' active' : '')}
              style={{ background: COLOR_VARS[plant.color] }}
              onClick={() => { setActivePlantId(plant.id); setSearch(''); }}
            >
              <div className="plants-spine-label">{plant.name}</div>
              <div className="plants-spine-count">{count}</div>
            </div>
          );
        })}
        {newPlantName === null ? (
          <button className="plants-add" onClick={() => setNewPlantName('')}>+</button>
        ) : (
          <input
            className="plants-add-input"
            autoFocus
            placeholder="Например, Монстера"
            value={newPlantName}
            onChange={(e) => setNewPlantName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addPlant(); if (e.key === 'Escape') setNewPlantName(null); }}
            onBlur={addPlant}
          />
        )}
      </aside>

      <main className="plants-main">
        {!activePlant ? (
          <div className="plants-welcome">
            <div className="plants-welcome-title">Пока пусто</div>
            <div>Добавь первое растение через «+» слева — например, «Монстера»</div>
          </div>
        ) : (
          <PlantView plant={activePlant} search={search} onSearch={setSearch} onDelete={() => deletePlant(activePlant)} />
        )}
      </main>
    </div>
  );
}

function PlantView({ plant, search, onSearch, onDelete }: { plant: Plant; search: string; onSearch: (v: string) => void; onDelete: () => void }) {
  const { state, update } = useStore();
  const confirm = useConfirm();
  const entries = filteredWateringsForPlant(state, plant.id, search);
  const last = filteredWateringsForPlant(state, plant.id, '')[0];

  const deleteEntry = async (id: string) => {
    const ok = await confirm({ title: 'Удалить запись полива?', message: 'Эта запись будет удалена безвозвратно.', confirmLabel: 'Удалить' });
    if (ok) update((draft) => { draft.waterings = draft.waterings.filter((w) => w.id !== id); });
  };

  const patchEntry = (id: string, patch: Partial<Watering>) => {
    update((draft) => {
      const entry = draft.waterings.find((w) => w.id === id);
      if (entry) Object.assign(entry, patch);
    });
  };

  return (
    <>
      <div className="plants-topbar" style={{ borderBottomColor: COLOR_VARS[plant.color] }}>
        <div className="plants-title">{plant.name}</div>
        <div className="plants-meta">
          <span>{last ? `Последний полив: ${daysAgoLabel(last.date)}` : 'поливов пока нет'}</span>
          <button className="plants-delete" onClick={onDelete}>удалить растение</button>
        </div>
      </div>

      <input className="plants-search" placeholder="Поиск по журналу..." value={search} onChange={(e) => onSearch(e.target.value)} />

      {!search && <QuickAddWatering plantId={plant.id} />}

      <div className="waterings-list">
        {entries.length === 0 && <div className="plants-empty">{search ? 'Ничего не найдено' : 'Впиши дату и объём воды выше'}</div>}
        {entries.map((entry) => (
          <WateringRow key={entry.id} entry={entry} accent={COLOR_VARS[plant.color]} onPatch={(patch) => patchEntry(entry.id, patch)} onDelete={() => deleteEntry(entry.id)} />
        ))}
      </div>
    </>
  );
}

function QuickAddWatering({ plantId }: { plantId: string }) {
  const { update } = useStore();
  const [date, setDate] = useState(todayStr());
  const [water, setWater] = useState('');
  const [ph, setPh] = useState('');
  const [fert, setFert] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');

  const submit = () => {
    const fertAmounts: FertAmounts = {
      micro: fert.micro ? Number(fert.micro) : null,
      grow: fert.grow ? Number(fert.grow) : null,
      bloom: fert.bloom ? Number(fert.bloom) : null,
      ripen: fert.ripen ? Number(fert.ripen) : null,
    };
    update((draft) => {
      draft.waterings.unshift({
        id: uid(), plantId,
        date: date || todayStr(),
        water: water ? Number(water) : null,
        ph: ph ? Number(ph) : null,
        fert: fertAmounts,
        note: note.trim(),
        createdAt: Date.now(),
      });
    });
    setWater(''); setPh(''); setNote(''); setFert({}); setDate(todayStr());
  };

  return (
    <div className="plant-quick-add">
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <input type="number" step="0.1" placeholder="вода, л" value={water} onChange={(e) => setWater(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <input type="number" step="0.1" placeholder="pH" value={ph} onChange={(e) => setPh(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <div className="fert-inputs">
        {FERT_KEYS.map(([key, label]) => (
          <div className="fert-field" key={key}>
            <label>{label}</label>
            <input type="number" step="0.1" value={fert[key] ?? ''} onChange={(e) => setFert((f) => ({ ...f, [key]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </div>
        ))}
      </div>
      <input placeholder="Заметка" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <button onClick={submit}>Добавить</button>
    </div>
  );
}

function WateringRow({ entry, accent, onPatch, onDelete }: { entry: Watering; accent: string; onPatch: (patch: Partial<Watering>) => void; onDelete: () => void }) {
  const [fertExpanded, setFertExpanded] = useState(FERT_KEYS.some(([key]) => entry.fert[key]));
  const dateLabel = entry.date ? new Date(entry.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  return (
    <div className="watering-row watering-row-enter" style={{ borderLeftColor: accent }} title={dateLabel}>
      <div className="watering-top">
        <input type="date" className="watering-date" value={entry.date} onChange={(e) => onPatch({ date: e.target.value })} />
        <span
          className="watering-pill"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="+ вода"
          onBlur={(e) => {
            const raw = (e.currentTarget.textContent || '').replace(/[^\d.,]/g, '').replace(',', '.');
            onPatch({ water: raw ? Number(raw) : null });
          }}
        >
          {entry.water != null ? `${entry.water} л` : ''}
        </span>
        <span
          className="watering-pill ph"
          contentEditable
          suppressContentEditableWarning
          data-placeholder="+ pH"
          onBlur={(e) => {
            const raw = (e.currentTarget.textContent || '').replace(/[^\d.,]/g, '').replace(',', '.');
            onPatch({ ph: raw ? Number(raw) : null });
          }}
        >
          {entry.ph != null ? `pH ${entry.ph}` : ''}
        </span>
        <button className="watering-del" onClick={onDelete}>×</button>
      </div>

      <div className="fert-line">
        {!fertExpanded ? (
          <span className="fert-summary-pill" onClick={() => setFertExpanded(true)}>без удобр</span>
        ) : (
          <div className="fert-grid">
            {FERT_KEYS.map(([key, label]) => (
              <div className="fert-field" key={key}>
                <label>{label}</label>
                <input
                  type="number"
                  step="0.1"
                  defaultValue={entry.fert[key] != null ? String(entry.fert[key]) : ''}
                  onBlur={(e) => onPatch({ fert: { ...entry.fert, [key]: e.target.value ? Number(e.target.value) : null } })}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="watering-note"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Заметка"
        onBlur={(e) => onPatch({ note: e.currentTarget.textContent?.trim() ?? '' })}
      >
        {entry.note}
      </div>
    </div>
  );
}
