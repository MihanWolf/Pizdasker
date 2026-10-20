import { useState, type FormEvent } from 'react';
import { useStore } from '../../core/store';
import { uid } from '../../core/types';
import { currentOnHandBalance, financeGoalProgress, financeMonthlyTotals, financeOperationAmount, financeOperationBalanceEffect, financeOperationEffectiveDate, financeRecentOperations, financeUpcomingEvents, financeWeeklyFlow, fmtMoney, formatFinanceDate, nearestPlannedFinanceIncome, remainingTotal, sortedFinanceItems, todayStr } from '../../core/selectors';

type FinanceView = 'overview' | 'ledger' | 'operations';

export function FinanceOverview({ onNavigate }: { onNavigate: (view: FinanceView) => void }) {
  const { state, update } = useStore();
  const balance = currentOnHandBalance(state);
  const month = financeMonthlyTotals(state);
  const week = financeWeeklyFlow(state);
  const events = financeUpcomingEvents(state);
  const operations = financeRecentOperations(state);
  const goals = sortedFinanceItems(state, 'wish').filter((item) => !item.done && Number(item.amount) > 0);
  const goal = goals[0];
  const goalProgress = goal ? financeGoalProgress(goal) : null;
  const nextIncome = nearestPlannedFinanceIncome(state);
  const [operationKind, setOperationKind] = useState<'expense' | 'income'>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [manualBalanceInput, setManualBalanceInput] = useState(String(balance));
  const today = todayStr();
  const todayLabel = new Date(`${today}T00:00:00`).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  const addQuickOperation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(amount);
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !Number.isFinite(value) || value <= 0) return;
    const signedAmount = financeOperationAmount(operationKind, value);
    update((draft) => {
      draft.balance += signedAmount;
      draft.financeOperations.unshift({
        id: uid(),
        kind: operationKind,
        title: trimmedTitle,
        amount: signedAmount,
        date: today,
        createdAt: Date.now(),
      });
    });
    setTitle('');
    setAmount('');
  };

  const saveBalance = () => {
    const nextValue = Number(manualBalanceInput) || 0;
    const delta = nextValue - balance;
    if (delta === 0) return;
    update((draft) => {
      draft.balance += delta;
      draft.financeOperations.unshift({
        id: uid(),
        kind: 'adjustment',
        title: 'Корректировка баланса',
        amount: delta,
        date: today,
        note: 'Ручная корректировка остатка',
        createdAt: Date.now(),
      });
    });
  };

  return (
    <div className="finance-concept content-scroll">
      <div className="finance-concept-topbar">
        <div className="finance-concept-brand">
          <span
            className="finance-concept-mark"
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            role="textbox"
            aria-label="Символ валюты"
            title="Изменить символ валюты"
            onBlur={(event) => {
              const value = event.currentTarget.textContent?.trim() || state.currency;
              update((draft) => { draft.currency = value; });
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          >
            {state.currency}
          </span>
          <span>МОИ ФИНАНСЫ <i>·</i> {todayLabel.toLocaleUpperCase('ru-RU')}</span>
        </div>
      </div>

      <header className="finance-concept-heading">
        <h1>Финансы</h1>
        <button className="finance-concept-plan-button" onClick={() => onNavigate('ledger')}>＋ Запланировать</button>
      </header>

      <section className="finance-concept-hero" aria-label="Финансовый обзор">
        <div className="finance-concept-hero-main">
          <span className="finance-concept-overline">СЕЙЧАС НА РУКАХ</span>
          <label className="finance-concept-balance">
            <input
              type="number"
              inputMode="decimal"
              aria-label={`Текущий баланс в ${state.currency}`}
              value={manualBalanceInput}
              onChange={(event) => setManualBalanceInput(event.target.value)}
              onBlur={saveBalance}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
            <span>{state.currency}</span>
          </label>
          <div className="finance-concept-balance-note"><span>{week.net >= 0 ? '↗' : '↘'}</span> {week.net >= 0 ? '+' : '−'}{fmtMoney(Math.abs(week.net))} {state.currency} за последние 7 дней</div>
          <div className="finance-concept-chart" aria-label="Чистый денежный поток за последние семь дней">
            <div className="finance-concept-chart-bars">
              {week.days.map((day) => (
                <span key={day.date} className={day.net < 0 ? 'negative' : ''} style={{ height: `${day.height}%` }} title={`${day.label}: ${day.net >= 0 ? '+' : '−'}${fmtMoney(Math.abs(day.net))} ${state.currency}`} />
              ))}
            </div>
            <div className="finance-concept-chart-labels">{week.days.map((day) => <span key={day.date}>{day.label}</span>)}</div>
          </div>
        </div>
        <div className="finance-concept-hero-side">
          <div className="finance-concept-period">
            <span className="finance-concept-overline">В ЭТОМ МЕСЯЦЕ</span>
            <div><span>Получено</span><b className="concept-positive">+ {fmtMoney(month.income)} {state.currency}</b></div>
            <div><span>Потрачено</span><b className="concept-negative">− {fmtMoney(month.expenses)} {state.currency}</b></div>
            <div><span>Осталось оплатить</span><b>{fmtMoney(remainingTotal(state, 'debt'))} {state.currency}</b></div>
            <div><span>Осталось накопить</span><b>{fmtMoney(remainingTotal(state, 'wish'))} {state.currency}</b></div>
          </div>
          <div className="finance-concept-next-income">
            <span className="finance-concept-next-icon" aria-hidden="true">↗</span>
            {nextIncome ? (
              <>
                <span><small>СЛЕДУЮЩИЙ ДОХОД</small><b>{nextIncome.title} · {formatFinanceDate(nextIncome.date)}</b></span>
                <strong>{fmtMoney(nextIncome.amount)} {state.currency}</strong>
              </>
            ) : <span><small>СЛЕДУЮЩИЙ ДОХОД</small><b>Пока не запланирован</b></span>}
          </div>
        </div>
      </section>

      <div className="finance-concept-section-title">
        <div><span className="finance-concept-overline">ПЛАН НА БЛИЖАЙШЕЕ</span><h2>Деньги в движении</h2></div>
        <button type="button" onClick={() => onNavigate('ledger')}>Весь план <span aria-hidden="true">↗</span></button>
      </div>

      <div className="finance-concept-layout">
        <div className="finance-concept-main-column">
          <section className="finance-concept-card finance-concept-timeline">
            <div className="finance-concept-card-heading"><h3>Ближайшие события</h3><span>{events.length} в плане</span></div>
            {events.length ? events.map((financeEvent) => {
              const overdue = financeEvent.kind === 'payment' && financeEvent.date < today;
              const eventDate = new Date(`${financeEvent.date}T00:00:00`);
              return (
                <div key={financeEvent.id} className="finance-concept-event">
                  <span className="finance-concept-event-date">
                    <b>{eventDate.toLocaleDateString('ru-RU', { day: '2-digit' })}</b>
                    <small>{eventDate.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '').toUpperCase()}</small>
                  </span>
                  <span className={`finance-concept-event-icon ${financeEvent.kind === 'payment' ? 'concept-event-pay' : 'concept-event-income'}`} aria-hidden="true">{financeEvent.kind === 'payment' ? '↘' : '↗'}</span>
                  <span className="finance-concept-event-info">
                    <b>{financeEvent.title}</b>
                    <small>{overdue ? 'Просроченный платёж' : financeEvent.kind === 'payment' ? 'Обязательный платёж' : 'Ожидаемое поступление'} · {formatFinanceDate(financeEvent.date)}</small>
                  </span>
                  <strong className={financeEvent.kind === 'payment' ? 'concept-negative' : 'concept-positive'}>{financeEvent.kind === 'payment' ? '−' : '+'} {fmtMoney(financeEvent.amount)} {state.currency}</strong>
                </div>
              );
            }) : <div className="finance-concept-empty">Пока нет запланированных платежей и поступлений.</div>}
            <div className="finance-concept-timeline-footer"><span>Всего осталось оплатить</span><b>{fmtMoney(remainingTotal(state, 'debt'))} {state.currency}</b></div>
          </section>

          <section className="finance-concept-card finance-concept-activity">
            <div className="finance-concept-card-heading"><h3>Последние операции</h3><button type="button" onClick={() => onNavigate('operations')}>Все операции <span aria-hidden="true">→</span></button></div>
            {operations.length ? operations.map((operation) => {
              const effect = financeOperationBalanceEffect(operation);
              return (
                <div key={operation.id} className="finance-concept-operation">
                  <span className={`finance-concept-operation-icon ${effect >= 0 ? 'concept-op-income' : 'concept-op-home'}`} aria-hidden="true">{effect >= 0 ? '↗' : '↘'}</span>
                  <span><b>{operation.title}</b><small>{formatFinanceDate(financeOperationEffectiveDate(state, operation))}</small></span>
                  <strong className={effect >= 0 ? 'concept-positive' : 'concept-negative'}>{effect >= 0 ? '+' : '−'} {fmtMoney(Math.abs(effect))} {state.currency}</strong>
                </div>
              );
            }) : <div className="finance-concept-empty">Операции появятся здесь после первой записи.</div>}
          </section>
        </div>

        <aside className="finance-concept-side-column">
          <form className="finance-concept-card finance-concept-quick-add" onSubmit={addQuickOperation}>
            <div className="finance-concept-card-heading"><h3>Записать операцию</h3><span className="finance-concept-sparkle" aria-hidden="true">✳</span></div>
            <div className="finance-concept-kind-switch" aria-label="Тип операции">
              <button type="button" className={operationKind === 'expense' ? 'selected' : ''} aria-pressed={operationKind === 'expense'} onClick={() => setOperationKind('expense')}>Расход</button>
              <button type="button" className={operationKind === 'income' ? 'selected' : ''} aria-pressed={operationKind === 'income'} onClick={() => setOperationKind('income')}>Доход</button>
            </div>
            <label>НАЗВАНИЕ<input type="text" placeholder="Например, продукты" value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
            <label>СУММА<input type="number" inputMode="decimal" min="0" step="0.01" placeholder={`0 ${state.currency}`} value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
            <button className="finance-concept-add-button" type="submit">＋ Добавить {operationKind === 'expense' ? 'расход' : 'доход'}</button>
            <p className="finance-concept-hint">Запишется сегодняшней датой · можно отредактировать в операциях</p>
          </form>

          {goal && goalProgress ? (
            <section className="finance-concept-goal">
              <div className="finance-concept-goal-top"><span className="finance-concept-goal-icon" aria-hidden="true">✦</span><span>ЦЕЛЬ НАКОПЛЕНИЙ</span><span className="finance-concept-goal-menu">···</span></div>
              <h3>{goal.title}</h3>
              <div className="finance-concept-goal-amount">{fmtMoney(goalProgress.saved)} <span>из {fmtMoney(goalProgress.target)} {state.currency}</span></div>
              <div className="finance-concept-goal-track"><span style={{ width: `${goalProgress.percent}%` }} /></div>
              <div className="finance-concept-goal-bottom"><span>{goalProgress.percent}% собрано</span><b>Осталось {fmtMoney(goalProgress.remaining)} {state.currency}</b></div>
              {goals.length > 1 && <button className="finance-concept-more-goals" onClick={() => onNavigate('ledger')}>Ещё целей: {goals.length - 1}</button>}
            </section>
          ) : (
            <section className="finance-concept-goal finance-concept-empty-goal">
              <div className="finance-concept-goal-top"><span className="finance-concept-goal-icon" aria-hidden="true">✦</span><span>ЦЕЛИ НАКОПЛЕНИЙ</span></div>
              <h3>Пока нет цели</h3>
              <p>Добавь желание в плане — здесь появится прогресс накоплений.</p>
              <button className="finance-concept-more-goals" onClick={() => onNavigate('ledger')}>Открыть план →</button>
            </section>
          )}

          <div className="finance-concept-note"><span aria-hidden="true">✦</span><p><b>Маленький шаг — тоже прогресс.</b><br />Запиши сегодняшнюю покупку и держи картину целиком.</p></div>
        </aside>
      </div>
    </div>
  );
}
