import { useStore } from '../../core/store';
import {
  calculateDailyBudget, fmtMoney, formatFinanceDate,
  todayPaymentsItems, paymentDaysUntil, paymentDueLabel, paymentAccent, todayNeedsAttention,
  importantOpenTasks,
  plantsNeedingWater, wateringDaysAgo, wateringAccent, daysAgoLabel, latestWateringDate,
  importantNotes,
  topWishes,
} from '../../core/selectors';
import { SunIcon, WalletIcon, ChecklistIcon, DropletIcon, QuoteIcon } from '../../ui/icons';
import './today.css';

export function Today() {
  const { state, update } = useStore();
  const budget = calculateDailyBudget(state);
  const dateLabel = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  const goTo = (mode: typeof state.mode) => update((draft) => { draft.mode = mode; });

  const payments = todayPaymentsItems(state);
  const tasks = importantOpenTasks(state);
  const plants = plantsNeedingWater(state);
  const notes = importantNotes(state);
  const wishes = topWishes(state);

  const showPayments = payments.length > 0 || state.financeItems.some((i) => i.type === 'debt' || i.type === 'income');
  const showTasks = state.taskItems.some((t) => t.important && !t.done);
  const showPlants = state.plants.length > 0;
  const showNotes = state.noteEntries.some((n) => n.important);
  const showWishes = state.financeItems.some((i) => i.type === 'wish');

  return (
    <div className="today-wrap content-scroll">
      <div className="today-header">
        <div>
          <div className="today-kicker"><SunIcon /> {dateLabel}</div>
          <h1 className="today-title display">Сегодня</h1>
        </div>
        <div className="today-right-summary">
          <div className="today-daily-value" style={{ color: budget.isNegative ? 'var(--urgent)' : undefined }}>
            {fmtMoney(Math.round(budget.displayValue))} {state.currency}
          </div>
        </div>
      </div>

      <div className="today-grid">
        {showPayments && (
          <Widget title="Платежи" subtitle="Неоплаченные обязательства" attention={todayNeedsAttention(state)} empty="Ближайших платежей нет" items={payments.length} icon={<WalletIcon />} iconAccent={todayNeedsAttention(state) ? '#A63B32' : undefined}>
            {payments.map((item) => item.type === 'income' ? (
              <TodayItem
                key={item.id}
                title="Поступление"
                meta={item.incomeDate ? `поступление ${formatFinanceDate(item.incomeDate)}` : 'дата не указана'}
                accent="var(--forest)"
                detail={`+${fmtMoney(item.amount)} ${state.currency}`}
                onClick={() => goTo('finance')}
              />
            ) : (
              <TodayItem
                key={item.id}
                title={item.title}
                meta={paymentDueLabel(paymentDaysUntil(item.dueDate))}
                accent={paymentAccent(paymentDaysUntil(item.dueDate))}
                detail={`${fmtMoney(Math.max(0, (Number(item.amount) || 0) - (Number(item.progress) || 0)))} ${state.currency} осталось`}
                onClick={() => goTo('finance')}
              />
            ))}
          </Widget>
        )}

        {showTasks && (
          <Widget title="Дела" subtitle="Шаги, которые нельзя потерять" attention={tasks.length > 0} empty="Важных задач пока нет" items={tasks.length} icon={<ChecklistIcon />} iconAccent={tasks.length ? 'var(--rust)' : undefined}>
            {tasks.map((item) => {
              const project = state.taskProjects.find((p) => p.id === item.projectId);
              return (
                <TodayItem
                  key={item.id}
                  title={item.title}
                  meta={project ? project.name : 'Задачи'}
                  accent="var(--rust)"
                  detail="важная задача"
                  onClick={() => goTo('tasks')}
                />
              );
            })}
          </Widget>
        )}

        {showPlants && (
          <Widget title="Пора полить" subtitle="Растения без свежего полива" empty="Все растения политые" items={plants.length} icon={<DropletIcon />} iconAccent={plants.length ? wateringAccent(wateringDaysAgo(state, plants[0].id)) : undefined}>            {plants.map((plant) => {
              const daysAgo = wateringDaysAgo(state, plant.id);
              const last = latestWateringDate(state, plant.id);
              return (
                <TodayItem
                  key={plant.id}
                  title={plant.name}
                  meta={last ? `полив ${daysAgoLabel(last)}` : 'поливов ещё не было'}
                  accent={wateringAccent(daysAgo)}
                  detail="Открыть журнал"
                  onClick={() => goTo('plants')}
                />
              );
            })}
          </Widget>
        )}

        {showNotes && (
          <Widget title="Мысли" subtitle="Мысли, к которым стоит вернуться" empty="Важных заметок пока нет" items={notes.length} icon={<QuoteIcon />}>
            {notes.map((entry) => {
              const page = state.notePages.find((p) => p.id === entry.pageId);
              return (
                <TodayItem
                  key={entry.id}
                  title={entry.content}
                  meta={page ? page.name : 'Заметки'}
                  accent="var(--plum)"
                  detail={entry.source || ''}
                  onClick={() => goTo('notes')}
                />
              );
            })}
          </Widget>
        )}

        {showWishes && (
          <Widget title="Хочеца" subtitle="Цели с самым заметным прогрессом" empty="Целей для накопления пока нет" items={wishes.length} wide icon={<WalletIcon />}>
            {wishes.map((item) => {
              const percent = Math.min(100, Math.round(((Number(item.progress) || 0) / Number(item.amount)) * 100));
              return (
                <TodayItem
                  key={item.id}
                  title={item.title}
                  meta={`${percent}% накоплено`}
                  accent="var(--wish)"
                  detail={`${fmtMoney(Math.max(0, Number(item.amount) - (Number(item.progress) || 0)))} ${state.currency} осталось`}
                  onClick={() => goTo('finance')}
                />
              );
            })}
          </Widget>
        )}
      </div>
    </div>
  );
}

function Widget({ title, subtitle, empty, items, attention, wide, icon, iconAccent, children }: { title: string; subtitle: string; empty: string; items: number; attention?: boolean; wide?: boolean; icon?: React.ReactNode; iconAccent?: string; children: React.ReactNode }) {
  return (
    <section className={'today-widget' + (attention ? ' needs-attention' : '') + (wide ? ' wide' : '')}>
      <div className="today-widget-head">
        {icon && <div className="today-widget-icon" style={iconAccent ? { color: iconAccent } : undefined}>{icon}</div>}
        <div>
          <h2>{title}</h2>
          <div className="today-widget-subtitle">{subtitle}</div>
        </div>
      </div>
      <div className="today-items">
        {items > 0 ? children : <div className="today-empty">{empty}</div>}
      </div>
    </section>
  );
}

function TodayItem({ title, meta, accent, detail, onClick }: { title: string; meta: string; accent: string; detail?: string; onClick: () => void }) {
  return (
    <button className="today-item" style={{ ['--today-accent' as string]: accent }} onClick={onClick}>
      <span className="today-item-mark" />
      <span className="today-item-copy">
        <strong>{title}</strong>
        <small>{meta}</small>
        {detail && <em>{detail}</em>}
      </span>
      <span className="today-item-arrow">›</span>
    </button>
  );
}
