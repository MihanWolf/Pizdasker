import { useStore } from '../../core/store';
import { COLOR_VARS } from '../../core/types';
import {
  calculateDailyBudget, fmtMoney, formatFinanceDate,
  todayPaymentsItems, todayPaymentsTotal, paymentDaysUntil, paymentDueLabel, paymentAccent, todayNeedsAttention,
  todayTasks, todayTasksTotal,
  plantsNeedingWater, plantsNeedingWaterTotal, wateringDaysAgo, wateringAccent, daysAgoLabel, latestWateringDate,
  importantNotes, importantNotesTotal,
  topWishes, topWishesTotal,
} from '../../core/selectors';
import { SunIcon, WalletIcon, ChecklistIcon, DropletIcon, QuoteIcon } from '../../ui/icons';
import './today.css';

export function Today() {
  const { state, update } = useStore();
  const budget = calculateDailyBudget(state);
  const dateLabel = new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  const goTo = (mode: typeof state.mode) => update((draft) => { draft.mode = mode; });

  const payments = todayPaymentsItems(state);
  const paymentsTotal = todayPaymentsTotal(state);
  const tasks = todayTasks(state);
  const tasksTotal = todayTasksTotal(state);
  const plants = plantsNeedingWater(state);
  const plantsTotal = plantsNeedingWaterTotal(state);
  const notes = importantNotes(state);
  const notesTotal = importantNotesTotal(state);
  const wishes = topWishes(state);
  const wishesTotal = topWishesTotal(state);

  const showPayments = paymentsTotal > 0;
  const showTasks = tasksTotal > 0;
  const showPlants = state.plants.length > 0;
  const showNotes = notesTotal > 0;
  const showWishes = wishesTotal > 0;

  return (
    <div className="today-wrap content-scroll">
      <div className="today-header">
        <div>
          <div className="today-kicker"><SunIcon /> {dateLabel}</div>
          <h1 className="today-title display">Сегодня</h1>
        </div>
        <div className="today-right-summary">
          <div className="today-daily-value" style={{ color: budget.color }}>
            {fmtMoney(Math.round(budget.displayValue))} {state.currency}
          </div>
        </div>
      </div>

      <div className="today-grid">
        {showPayments && (
          <Widget title="Платежи" subtitle="Неоплаченные обязательства" attention={todayNeedsAttention(state)} empty="Ближайших платежей нет" shown={payments.length} total={paymentsTotal} icon={<WalletIcon />} iconAccent={todayNeedsAttention(state) ? '#A63B32' : undefined}>
            {payments.map((item) => item.type === 'income' ? (
              <TodayItem
                key={item.id}
                title="Поступление"
                meta={item.incomeDate ? `поступление ${formatFinanceDate(item.incomeDate)}` : 'дата не указана'}
                accent={COLOR_VARS.forest}
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
          <Widget title="Дела" subtitle="Важное и срочное по срокам" attention={tasks.length > 0} empty="Важных задач пока нет" shown={tasks.length} total={tasksTotal} icon={<ChecklistIcon />} iconAccent={tasks.length ? COLOR_VARS.rust : undefined}>
            {tasks.map((item) => {
              const project = state.taskProjects.find((p) => p.id === item.projectId);
              const accent = project ? (COLOR_VARS[project.color] || COLOR_VARS.rust) : COLOR_VARS.rust;
              const daysUntil = paymentDaysUntil(item.dueDate);
              const detail = item.dueDate ? paymentDueLabel(daysUntil) : 'важная задача';
              return (
                <TodayItem
                  key={item.id}
                  title={item.title}
                  meta={project ? project.name : 'Задачи'}
                  accent={accent}
                  detail={detail}
                  onClick={() => goTo('tasks')}
                />
              );
            })}
          </Widget>
        )}

        {showPlants && (
          <Widget title="Пора полить" subtitle="Растения без свежего полива" empty="Все растения политые" shown={plants.length} total={plantsTotal} icon={<DropletIcon />} iconAccent={plants.length ? wateringAccent(wateringDaysAgo(state, plants[0].id)) : undefined}>
            {plants.map((plant) => {
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
          <Widget title="Мысли" subtitle="Мысли, к которым стоит вернуться" empty="Важных заметок пока нет" shown={notes.length} total={notesTotal} icon={<QuoteIcon />}>
            {notes.map((entry) => {
              const page = state.notePages.find((p) => p.id === entry.pageId);
              return (
                <TodayItem
                  key={entry.id}
                  title={entry.content}
                  meta={page ? page.name : 'Заметки'}
                  accent={COLOR_VARS.plum}
                  detail={entry.source || ''}
                  onClick={() => goTo('notes')}
                />
              );
            })}
          </Widget>
        )}

        {showWishes && (
          <Widget title="Хочеца" subtitle="Цели с самым заметным прогрессом" empty="Целей для накопления пока нет" shown={wishes.length} total={wishesTotal} wide icon={<WalletIcon />}>
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

function Widget({ title, subtitle, empty, shown, total, attention, wide, icon, iconAccent, children }: { title: string; subtitle: string; empty: string; shown: number; total: number; attention?: boolean; wide?: boolean; icon?: React.ReactNode; iconAccent?: string; children: React.ReactNode }) {
  const hidden = total - shown;
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
        {shown > 0 ? children : <div className="today-empty">{empty}</div>}
        {hidden > 0 && <div className="today-more">… и ещё {hidden}</div>}
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
