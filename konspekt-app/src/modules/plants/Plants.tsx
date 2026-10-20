import { useState } from 'react';
import { useStore } from '../../core/store';
import { uid, COLOR_VARS, PLANT_STAGES, type EnvironmentReading, type Plant, type PlantStage, type Watering, type FertAmounts } from '../../core/types';
import { filteredWateringsForPlant, daysAgoLabel, todayStr, latestWateringDate, latestWateringStage, plantTimelineStats, dayCountLabel, formatDateDmy, parseDateDmy, environmentChart, latestEnvironmentReading, sortedEnvironmentReadings, type EnvironmentChartRange } from '../../core/selectors';
import { useConfirm } from '../../ui/ConfirmDialog';
import { TopBar, useCycleColor } from '../../app/TopBar';
import { DropletIcon } from '../../ui/icons';
import './plants.css';

const FERT_KEYS: [keyof FertAmounts, string][] = [
  ['grow', 'Grow'],
  ['micro', 'Micro'],
  ['bloom', 'Bloom'],
  ['ripen', 'Ripen'],
];

export function Plants() {
  const { state, update } = useStore();
  const activePlant = state.plants.find((p) => p.id === state.activePlantId) ?? null;

  if (state.plantsView === 'climate') {
    return <ClimateView />;
  }

  if (!activePlant) {
    return (
      <>
        <div className="topbar climate-topbar">
          <div className="subject-title-wrap"><h1 className="subject-title">Полив</h1></div>
        </div>
        <div className="searchbar">
          <div className="plants-subtabs">
            <button className="active">Полив</button>
            <button onClick={() => update((draft) => { draft.plantsView = 'climate'; })}>
              Климат <span>{state.environmentReadings.length}</span>
            </button>
          </div>
        </div>
        <div className="content-scroll">
          <div className="welcome">
            <div className="display">Пока пусто</div>
            <div>Добавь первое растение через «+» слева — например, «Монстера»</div>
          </div>
        </div>
      </>
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
  const timeline = plantTimelineStats(state, plant.id);
  const [chartRange, setChartRange] = useState<EnvironmentChartRange>('7d');
  const chart = environmentChart(state, chartRange);
  const latestReading = latestEnvironmentReading(state);

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
        className="plant-topbar"
        name={plant.name}
        color={plant.color}
        onRename={(name) => { if (name) update((draft) => { const p = draft.plants.find((x) => x.id === plant.id); if (p) p.name = name; }); }}
        onCycleColor={() => cycleColor('plant', plant.id)}
        deleteLabel="удалить растение"
        deleteTitle="Удалить растение?"
        deleteMessage={`«${plant.name}» и весь его журнал поливов будут удалены безвозвратно.`}
        onDelete={deletePlant}
        headerContent={<EnvironmentChartView chart={chart} range={chartRange} onRangeChange={setChartRange} latest={latestReading} />}
        meta={
          <div className="plant-meta">
            {lastDate && <div className="plant-last-watered"><DropletIcon />Последний полив: {daysAgoLabel(lastDate)}</div>}
            {timeline.stage && timeline.daysOnStage != null && (
              <div className="plant-timeline-stat">Текущая стадия: {timeline.stage.toLowerCase()} · {dayCountLabel(timeline.daysOnStage)}</div>
            )}
            {timeline.ageDays != null && (
              <div className="plant-timeline-stat">Возраст растения: {dayCountLabel(timeline.ageDays)}</div>
            )}
            {!lastDate && <span className="mono">поливов пока нет</span>}
          </div>
        }
      />

      <div className="searchbar">
        <div className="plants-subtabs">
          <button className={state.plantsView === 'watering' ? 'active' : ''} onClick={() => update((draft) => { draft.plantsView = 'watering'; })}>Полив</button>
          <button className={state.plantsView === 'climate' ? 'active' : ''} onClick={() => update((draft) => { draft.plantsView = 'climate'; })}>Климат <span>{state.environmentReadings.length}</span></button>
        </div>
        <input
          className="search-input"
          placeholder="Поиск по журналу..."
          value={search}
          onChange={(e) => update((draft) => { draft.plantsSearch = e.target.value; })}
        />
      </div>

      <div className="content-scroll">
        <EnvironmentQuickAdd />
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

function EnvironmentQuickAdd() {
  const { update } = useStore();
  const [temperature, setTemperature] = useState('');
  const [humidity, setHumidity] = useState('');

  const submit = () => {
    const temp = Number(temperature);
    const humidityValue = Number(humidity);
    const timestamp = new Date();
    if (!Number.isFinite(temp) ||
      !Number.isFinite(humidityValue) || humidityValue < 0 || humidityValue > 100) return;
    const reading: EnvironmentReading = {
      id: uid(),
      recordedAt: timestamp.toISOString(),
      temperature: Math.round(temp),
      humidity: Math.round(humidityValue),
      createdAt: Date.now(),
    };
    update((draft) => { draft.environmentReadings.push(reading); });
    setTemperature('');
    setHumidity('');
  };

  return (
    <form className="environment-quick-add" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="environment-entry-title">Климат</div>
      <label>
        <span>Температура, °C</span>
        <input type="number" step="1" value={temperature} onChange={(e) => setTemperature(e.target.value)} required />
      </label>
      <label>
        <span>Влажность, %</span>
        <input type="number" min="0" max="100" step="1" value={humidity} onChange={(e) => setHumidity(e.target.value)} required />
      </label>
      <button type="submit" disabled={temperature === '' || humidity === ''}>Записать</button>
    </form>
  );
}

function ClimateView() {
  const { state, update } = useStore();
  const [range, setRange] = useState<EnvironmentChartRange>('7d');
  const chart = environmentChart(state, range);
  const latest = latestEnvironmentReading(state);
  const readings = sortedEnvironmentReadings(state);

  return (
    <>
      <div className="topbar climate-topbar">
        <div className="subject-title-wrap"><h1 className="subject-title">Климат</h1></div>
        <EnvironmentChartView chart={chart} range={range} onRangeChange={setRange} latest={latest} />
      </div>
      <div className="searchbar">
        <div className="plants-subtabs">
          <button onClick={() => update((draft) => { draft.plantsView = 'watering'; })}>Полив</button>
          <button className="active" onClick={() => update((draft) => { draft.plantsView = 'climate'; })}>
            Климат <span>{state.environmentReadings.length}</span>
          </button>
        </div>
      </div>
      <div className="content-scroll">
        <EnvironmentQuickAdd />
        {readings.length ? (
          <div className="environment-journal">
            {readings.map((reading) => <EnvironmentReadingRow key={reading.id} reading={reading} />)}
          </div>
        ) : (
          <div className="empty-state"><span className="display">Пока нет замеров</span>Добавьте температуру и влажность выше</div>
        )}
      </div>
    </>
  );
}

function EnvironmentReadingRow({ reading }: { reading: EnvironmentReading }) {
  const { update } = useStore();
  const confirm = useConfirm();
  const [timestampDraft, setTimestampDraft] = useState(toLocalDateTimeInput(new Date(reading.recordedAt)));

  const patch = (changes: Partial<EnvironmentReading>) => {
    update((draft) => {
      const item = draft.environmentReadings.find((entry) => entry.id === reading.id);
      if (item) Object.assign(item, changes);
    });
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Удалить замер климата?',
      message: 'Запись температуры и влажности будет удалена безвозвратно.',
      confirmLabel: 'Удалить',
    });
    if (ok) update((draft) => {
      draft.environmentReadings = draft.environmentReadings.filter((entry) => entry.id !== reading.id);
    });
  };

  return (
    <div className="environment-reading">
      <input
        className="environment-reading-time"
        type="datetime-local"
        aria-label="Дата и время замера"
        value={timestampDraft}
        onChange={(e) => setTimestampDraft(e.target.value)}
        onBlur={() => {
          const date = new Date(timestampDraft);
          if (Number.isFinite(date.getTime())) {
            patch({ recordedAt: date.toISOString() });
            setTimestampDraft(toLocalDateTimeInput(date));
          } else {
            setTimestampDraft(toLocalDateTimeInput(new Date(reading.recordedAt)));
          }
        }}
      />
      <label className="environment-reading-value environment-reading-temp">
        <span>Температура</span>
        <input
          type="number"
          step="1"
          value={Math.round(reading.temperature)}
          onChange={(e) => { if (e.target.value !== '') patch({ temperature: Math.round(Number(e.target.value)) }); }}
        />
        <b>°C</b>
      </label>
      <label className="environment-reading-value environment-reading-humidity">
        <span>Влажность</span>
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          value={Math.round(reading.humidity)}
          onChange={(e) => { if (e.target.value !== '') patch({ humidity: Math.max(0, Math.min(100, Math.round(Number(e.target.value)))) }); }}
        />
        <b>%</b>
      </label>
      <button className="environment-reading-delete" title="Удалить замер" onClick={remove}>×</button>
    </div>
  );
}

function EnvironmentChartView({
  chart,
  range,
  onRangeChange,
  latest,
}: {
  chart: ReturnType<typeof environmentChart>;
  range: EnvironmentChartRange;
  onRangeChange: (range: EnvironmentChartRange) => void;
  latest: EnvironmentReading | null;
}) {
  const temperaturePath = smoothChartPath(chart.points.map((point) => ({ x: point.x + 40, y: point.temperatureY })));
  const humidityPath = smoothChartPath(chart.points.map((point) => ({ x: point.x + 40, y: point.humidityY })));
  const temperatureArea = chart.points.length > 1 ? `${temperaturePath} L 640 68 L 40 68 Z` : '';
  const humidityArea = chart.points.length > 1 ? `${humidityPath} L 640 68 L 40 68 Z` : '';
  const animationKey = chart.points.map((point) => `${point.id}:${point.x}:${point.temperatureY}:${point.humidityY}`).join('|');
  const tickCount = range === '7d' ? 7 : range === '30d' ? 5 : 4;
  const ticks = chart.domainStartAt != null && chart.domainEndAt != null
    ? Array.from({ length: tickCount }, (_, index) => chart.domainStartAt! + (chart.domainEndAt! - chart.domainStartAt!) * index / Math.max(1, tickCount - 1))
    : [];

  return (
    <div className="environment-chart" aria-label="График температуры и влажности">
      <div className="environment-chart-head">
        <div className="environment-chart-legend">
          <span className="environment-legend-temp">{latest ? `T ${Math.round(latest.temperature)}°C` : 'T °C'}</span>
          <span className="environment-legend-humidity">{latest ? `Вл. ${Math.round(latest.humidity)}%` : 'Вл. %'}</span>
        </div>
        <select
          aria-label="Период графика"
          value={range}
          onChange={(e) => onRangeChange(e.target.value === 'all' ? 'all' : e.target.value === '30d' ? '30d' : '7d')}
        >
          <option value="7d">7 дней</option>
          <option value="30d">30 дней</option>
          <option value="all">Всё время</option>
        </select>
      </div>
      {chart.points.length ? (
        <>
          <svg className="environment-chart-svg" viewBox="0 0 680 82" role="img" aria-label="Температура и влажность по времени">
            <defs>
              <linearGradient id="environment-temperature-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#e87524" stopOpacity=".2" />
                <stop offset="100%" stopColor="#e87524" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="environment-humidity-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3277c7" stopOpacity=".16" />
                <stop offset="100%" stopColor="#3277c7" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="40" x2="640" y1="12" y2="12" />
            <line x1="40" x2="640" y1="40" y2="40" />
            <line x1="40" x2="640" y1="68" y2="68" />
            <text className="environment-axis-temp" x="2" y="14">{chart.temperatureMax}°</text>
            <text className="environment-axis-temp" x="2" y="42">28.5°</text>
            <text className="environment-axis-temp" x="2" y="70">{chart.temperatureMin}°</text>
            <text className="environment-axis-humidity" x="678" y="14" textAnchor="end">{chart.humidityMax}%</text>
            <text className="environment-axis-humidity" x="678" y="42" textAnchor="end">55%</text>
            <text className="environment-axis-humidity" x="678" y="70" textAnchor="end">{chart.humidityMin}%</text>
            {ticks.map((tick) => {
              const x = 40 + ((tick - chart.domainStartAt!) / (chart.domainEndAt! - chart.domainStartAt! || 1)) * 600;
              return <line key={tick} className="environment-chart-day-tick" x1={x} x2={x} y1="12" y2="68" />;
            })}
            {chart.points.length > 1 && <path className="environment-temperature-area" d={temperatureArea} />}
            {chart.points.length > 1 && <path className="environment-humidity-area" d={humidityArea} />}
            {chart.points.length > 1 && <path key={`temperature-${animationKey}`} pathLength="1" className="environment-temperature-line" d={temperaturePath} />}
            {chart.points.length > 1 && <path key={`humidity-${animationKey}`} pathLength="1" className="environment-humidity-line" d={humidityPath} />}
            {chart.points.map((point) => (
              <circle key={`temp-${point.id}`} className="environment-temperature-point" cx={point.x + 40} cy={point.temperatureY} r="3">
                <title>{`${point.temperature}°C · ${formatChartDateTime(point.recordedAt)}`}</title>
              </circle>
            ))}
            {chart.points.map((point) => (
              <circle key={`humidity-${point.id}`} className="environment-humidity-point" cx={point.x + 40} cy={point.humidityY} r="3">
                <title>{`${point.humidity}% · ${formatChartDateTime(point.recordedAt)}`}</title>
              </circle>
            ))}
          </svg>
          <div className="environment-chart-dates">
            {ticks.map((tick) => <span key={tick}>{formatChartDate(tick)}</span>)}
          </div>
        </>
      ) : <div className="environment-chart-empty">Добавьте первое измерение</div>}
    </div>
  );
}

function formatChartDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

function formatChartDateTime(value: string): string {
  return new Date(value).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function smoothChartPath(points: { x: number; y: number }[]): string {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.slice(0, -1).reduce((path, point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[index + 1];
    const afterNext = points[Math.min(points.length - 1, index + 2)];
    const span = next.x - point.x;
    const control1 = { x: point.x + span / 3, y: point.y + (next.y - previous.y) / 6 };
    const control2 = { x: next.x - span / 3, y: next.y - (afterNext.y - point.y) / 6 };
    const prefix = index === 0 ? `M ${point.x} ${point.y}` : path;
    return `${prefix} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${next.x} ${next.y}`;
  }, '');
}

function toLocalDateTimeInput(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function QuickAddWatering({ plantId }: { plantId: string }) {
  const { state, update } = useStore();
  const [date, setDate] = useState(formatDateDmy(todayStr()));
  const [water, setWater] = useState('');
  const [ph, setPh] = useState('');
  const [ppm, setPpm] = useState('');
  const [fert, setFert] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [stage, setStage] = useState<PlantStage | ''>(() => latestWateringStage(state, plantId) ?? '');

  const submit = () => {
    if (!stage) return;
    const parsedDate = parseDateDmy(date);
    if (!parsedDate) return;
    const fertAmounts: FertAmounts = {
      micro: fert.micro ? Number(fert.micro) : null,
      grow: fert.grow ? Number(fert.grow) : null,
      bloom: fert.bloom ? Number(fert.bloom) : null,
      ripen: fert.ripen ? Number(fert.ripen) : null,
    };
    update((draft) => {
      draft.waterings.unshift({
        id: uid(), plantId,
        date: parsedDate,
        water: water ? Number(water) : null,
        ph: ph ? Number(ph) : null,
        ppm: ppm ? Number(ppm) : null,
        fert: fertAmounts,
        note: note.trim(),
        stage,
        createdAt: Date.now(),
      });
    });
    setWater(''); setPh(''); setPpm(''); setNote(''); setFert({}); setDate(formatDateDmy(todayStr()));
  };

  return (
    <div className="plant-quick-add">
      <input type="text" inputMode="numeric" placeholder="дд/мм/гггг" aria-label="Дата полива, день/месяц/год" value={date} onChange={(e) => setDate(e.target.value)} />
      <label className="watering-stage-field">
        <span>Стадия</span>
        <select
          data-stage={stage}
          aria-label="Стадия роста"
          value={stage}
          onChange={(e) => setStage(PLANT_STAGES.find((item) => item === e.target.value) ?? '')}
        >
          <option value="">Выбрать</option>
          {PLANT_STAGES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <input type="number" step="0.1" placeholder="вода, л" value={water} onChange={(e) => setWater(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <input type="number" step="0.1" placeholder="pH" value={ph} onChange={(e) => setPh(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <input type="number" step="1" placeholder="PPM" value={ppm} onChange={(e) => setPpm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <div className="fert-inputs">
        {FERT_KEYS.map(([key, label]) => (
          <div className="fert-field" key={key}>
            <label>{label}</label>
            <input type="number" step="0.1" value={fert[key] ?? ''} onChange={(e) => setFert((f) => ({ ...f, [key]: e.target.value }))} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          </div>
        ))}
      </div>
      <input type="text" placeholder="Заметка" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <button onClick={submit} disabled={!stage || !parseDateDmy(date)}>Добавить</button>
    </div>
  );
}

function WateringRow({ entry, plant }: { entry: Watering; plant: Plant }) {
  const { update } = useStore();
  const confirm = useConfirm();
  const [fertExpanded, setFertExpanded] = useState(FERT_KEYS.some(([key]) => entry.fert[key]));
  const [dateDraft, setDateDraft] = useState(formatDateDmy(entry.date));
  const dateLabel = formatDateDmy(entry.date);

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
        <input
          type="text"
          inputMode="numeric"
          className="watering-date"
          aria-label="Дата полива, день/месяц/год"
          value={dateDraft}
          onChange={(e) => setDateDraft(e.target.value)}
          onBlur={() => {
            const parsedDate = parseDateDmy(dateDraft);
            if (parsedDate) {
              patch({ date: parsedDate });
              setDateDraft(formatDateDmy(parsedDate));
            } else {
              setDateDraft(formatDateDmy(entry.date));
            }
          }}
        />
        <select
          className="watering-stage"
          data-stage={entry.stage ?? ''}
          aria-label="Стадия роста"
          value={entry.stage ?? ''}
          onChange={(e) => patch({ stage: PLANT_STAGES.find((item) => item === e.target.value) })}
        >
          <option value="">Стадия не указана</option>
          {PLANT_STAGES.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
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
        <span
          className="watering-pill ppm"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          data-placeholder="+ PPM"
          onBlur={(e) => {
            const raw = (e.currentTarget.textContent || '').replace(/[^\d.,]/g, '').replace(',', '.');
            patch({ ppm: raw ? Number(raw) : null });
          }}
        >
          {entry.ppm != null ? `PPM ${entry.ppm}` : ''}
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
