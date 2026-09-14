import { useState } from 'react';
import { useStore } from '../../core/store';
import { uid, COLOR_VARS, type Plant, type Watering, type FertAmounts } from '../../core/types';
import { filteredWateringsForPlant, daysAgoLabel, todayStr, latestWateringDate } from '../../core/selectors';
import { useConfirm } from '../../ui/ConfirmDialog';
import { TopBar, useCycleColor } from '../../app/TopBar';
import { DropletIcon } from '../../ui/icons';
import './plants.css';

const FERT_KEYS: [keyof FertAmounts, string][] = [
  ['micro', 'Micro'],
  ['grow', 'Grow'],
  ['bloom', 'Bloom'],
  ['ripen', 'Ripen'],
];

export function Plants() {
  const { state } = useStore();
  const activePlant = state.plants.find((p) => p.id === state.activePlantId) ?? null;

  if (!activePlant) {
    return (
      <div className="content-scroll">
        <div className="welcome">
          <div className="display">Пока пусто</div>
          <div>Добавь первое растение через «+» слева — например, «Монстера»</div>
        </div>
      </div>
    );
  }

  return <PlantView key={activePlant.id} plant={activePlant} />;
}

function PlantView({ plant }: { plant: Plant }) {
  const { state, update } = useStore();
  const confirm = useConfirm();
  const cycleColor = useCycleColor();

  const search = state.plantsSearch;
  const entries = filteredWateringsForPlant(state, plant.id, search);
  const lastDate = latestWateringDate(state, plant.id);

  const deletePlant = async () => {
    const ok = await confirm({
      title: 'Удалить растение?',
      message: `«${plant.name}» и весь его журнал поливов будут удалены безвозвратно.`,
      confirmLabel: 'Удалить',
    });
    if (!ok) return;
    update((draft) => {
      draft.plants = draft.plants.filter((p) => p.id !== plant.id);
      draft.waterings = draft.waterings.filter((w) => w.plantId !== plant.id);
      draft.activePlantId = null;
    });
  };

  return (
    <>
      <TopBar
        name={plant.name}
        color={plant.color}
        onRename={(name) => { if (name) update((draft) => { const p = draft.plants.find((x) => x.id === plant.id); if (p) p.name = name; }); }}
        onCycleColor={() => cycleColor('plant', plant.id)}
        deleteLabel="удалить растение"
        deleteTitle="Удалить растение?"
        deleteMessage={`«${plant.name}» и весь его журнал поливов будут удалены безвозвратно.`}
        onDelete={deletePlant}
        meta={lastDate ? <div className="plant-last-watered"><DropletIcon />Последний полив: {daysAgoLabel(lastDate)}</div> : <span className="mono">поливов пока нет</span>}
      />

      <div className="searchbar">
        <input
          className="search-input"
          placeholder="Поиск по журналу..."
          value={search}
          onChange={(e) => update((draft) => { draft.plantsSearch = e.target.value; })}
        />
      </div>

      <div className="content-scroll">
        {!search && <QuickAddWatering plantId={plant.id} />}
        {entries.length === 0 ? (
          <div className="empty-state">
            <span className="display">{search ? 'Ничего не найдено' : 'Пока пусто'}</span>
            {search ? 'Попробуй другой запрос' : 'Впиши дату и объём воды выше'}
          </div>
        ) : (
          <div className="waterings-list">
            {entries.map((entry) => <WateringRow key={entry.id} entry={entry} plant={plant} />)}
          </div>
        )}
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
      <input type="text" placeholder="Заметка" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <button onClick={submit}>Добавить</button>
    </div>
  );
}

function WateringRow({ entry, plant }: { entry: Watering; plant: Plant }) {
  const { update } = useStore();
  const confirm = useConfirm();
  const [fertExpanded, setFertExpanded] = useState(FERT_KEYS.some(([key]) => entry.fert[key]));
  const dateLabel = entry.date ? new Date(entry.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  const patch = (p: Partial<Watering>) => {
    update((draft) => { const w = draft.waterings.find((x) => x.id === entry.id); if (w) Object.assign(w, p); });
  };

  const remove = async () => {
    const ok = await confirm({ title: 'Удалить запись полива?', message: 'Эта запись будет удалена безвозвратно.', confirmLabel: 'Удалить' });
    if (ok) update((draft) => { draft.waterings = draft.waterings.filter((w) => w.id !== entry.id); });
  };

  return (
    <div className="watering-row watering-row-enter" style={{ ['--card-accent' as string]: COLOR_VARS[plant.color] }} title={dateLabel}>
      <div className="watering-top">
        <input type="date" className="watering-date" value={entry.date} onChange={(e) => patch({ date: e.target.value })} />
        <span
          className="watering-pill"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          data-placeholder="+ вода"
          onBlur={(e) => {
            const raw = (e.currentTarget.textContent || '').replace(/[^\d.,]/g, '').replace(',', '.');
            patch({ water: raw ? Number(raw) : null });
          }}
        >
          {entry.water != null ? `${entry.water} л` : ''}
        </span>
        <span
          className="watering-pill ph"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          data-placeholder="+ pH"
          onBlur={(e) => {
            const raw = (e.currentTarget.textContent || '').replace(/[^\d.,]/g, '').replace(',', '.');
            patch({ ph: raw ? Number(raw) : null });
          }}
        >
          {entry.ph != null ? `pH ${entry.ph}` : ''}
        </span>
        <button className="watering-del" title="Удалить" onClick={remove}>×</button>
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
                  value={entry.fert[key] != null ? String(entry.fert[key]) : ''}
                  onChange={(e) => patch({ fert: { ...entry.fert, [key]: e.target.value ? Number(e.target.value) : null } })}
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
        spellCheck={false}
        data-placeholder="Заметка"
        onBlur={(e) => patch({ note: e.currentTarget.textContent?.trim() ?? '' })}
      >
        {entry.note}
      </div>
    </div>
  );
}
