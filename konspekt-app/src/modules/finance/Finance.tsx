import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../core/store';
import { uid, type FinanceItem, type FinanceItemType, type FinanceOperation } from '../../core/types';
import { fmtMoney, formatFinanceDate, remainingTotal, sortedFinanceItems, sortedIncomes, financeItemsTotal, currentOnHandBalance, financePaymentBalanceDelta, financeOperationBalanceEffect } from '../../core/selectors';
import { useConfirm } from '../../ui/ConfirmDialog';
import { CheckStamp } from '../../ui/icons';
import './finance.css';

function addFinanceOperation(draft: { financeOperations: FinanceOperation[] }, operation: FinanceOperation) {
  draft.financeOperations.unshift(operation);
}

function dailyStamp(date: string | undefined | null): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  return date;
}

export function Finance() {
  const { state, update } = useStore();
  const debtLeft = remainingTotal(state, 'debt');
  const wishLeft = remainingTotal(state, 'wish');
  const currentBalance = currentOnHandBalance(state);
  const [view, setView] = useState<'ledger' | 'operations'>('ledger');
  const [manualBalanceInput, setManualBalanceInput] = useState(String(currentBalance));
  const previousBalanceRef = useRef(currentBalance);

  useEffect(() => {
    setManualBalanceInput(String(currentBalance));
    previousBalanceRef.current = currentBalance;
  }, [currentBalance]);

  return (
    <div className="finance-wrap content-scroll">
      <div className="finance-header">
        <div className="finance-title">Финансы</div>
        <div className="finance-currency">
          Валюта:
          <span
            contentEditable
            suppressContentEditableWarning
            spellCheck={false}
            onBlur={(e) => {
              const value = e.currentTarget.textContent?.trim() || state.currency;
              update((draft) => { draft.currency = value; });
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
          >
            {state.currency}
          </span>
        </div>
      </div>

      <div className="finance-summary">
        <label className="finance-balance">
          <span className="finance-balance-label">Сейчас на руках</span>
          <span className="finance-balance-input">
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={manualBalanceInput}
              onChange={(e) => setManualBalanceInput(e.target.value)}
              onBlur={() => {
                const nextValue = Number(manualBalanceInput) || 0;
                const previousValue = previousBalanceRef.current;
                const delta = nextValue - previousValue;
                if (delta === 0) return;

                update((draft) => {
                  draft.balance += delta;
                  draft.financeOperations.unshift({
                    id: uid(),
                    kind: 'adjustment',
                    title: 'Корректировка баланса',
                    amount: delta,
                    date: new Date().toISOString().slice(0, 10),
                    note: 'Ручная корректировка остатка',
                    createdAt: Date.now(),
                  });
                });

                previousBalanceRef.current = nextValue;
              }}
            />
            <span className="finance-balance-currency">{state.currency}</span>
          </span>
        </label>
        <div className="finance-summary-item">
          <span className="finance-summary-label">Осталось оплатить</span>
          <b className="mono debt-color">{fmtMoney(debtLeft)} {state.currency}</b>
        </div>
        <div className="finance-summary-item">
          <span className="finance-summary-label">Осталось накопить</span>
          <b className="mono wish-color">{fmtMoney(wishLeft)} {state.currency}</b>
        </div>
      </div>

      <div className="finance-section-header" style={{ marginTop: 12 }}>
        <button className={view === 'ledger' ? 'finance-pill income' : 'finance-pill'} onClick={() => setView('ledger')}>План / факт</button>
        <button className={view === 'operations' ? 'finance-pill debt' : 'finance-pill'} onClick={() => setView('operations')}>Операции</button>
      </div>

      {view === 'operations' ? (
        <FinanceOperationsSection />
      ) : (
        <div className="finance-columns">
          <DebtOrWishSection type="debt" />
          <IncomeSection />
          <DebtOrWishSection type="wish" />
        </div>
      )}
    </div>
  );
}

function FinanceOperationsSection() {
  const { state, update } = useStore();
  const [filter, setFilter] = useState<'all' | 'income' | 'expense' | 'adjustment'>('all');
  const [manualKind, setManualKind] = useState<'income' | 'expense' | 'adjustment'>('income');
  const [manualAmount, setManualAmount] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [operationToDelete, setOperationToDelete] = useState<FinanceOperation | null>(null);

  const ops = [...state.financeOperations].sort((a, b) => b.createdAt - a.createdAt);
  const visibleOps = filter === 'all' ? ops : ops.filter((item) => item.kind === filter);

  const addManualOperation = () => {
    const amount = Number(manualAmount) || 0;
    if (!amount) return;

    update((draft) => {
      const signedAmount = manualKind === 'expense' ? -Math.abs(amount) : manualKind === 'income' ? Math.abs(amount) : amount;
      const title = manualKind === 'income' ? 'Доход' : manualKind === 'expense' ? 'Оплата' : 'Корректировка баланса';
      draft.balance += signedAmount;
      draft.financeOperations.unshift({
        id: uid(),
        kind: manualKind,
        title,
        amount: signedAmount,
        date: manualDate,
        note: manualNote.trim() || undefined,
        createdAt: Date.now(),
      });
    });

    setManualAmount('');
    setManualNote('');
    setManualDate(new Date().toISOString().slice(0, 10));
  };

  const updateOperationNote = (id: string, nextNote: string) => {
    update((draft) => {
      const target = draft.financeOperations.find((item) => item.id === id);
      if (!target) return;
      target.note = nextNote.trim() || undefined;
    });
  };

  const removeOperation = (reverseBalanceEffect: boolean) => {
    if (!operationToDelete) return;
    const operationId = operationToDelete.id;
    const balanceEffect = financeOperationBalanceEffect(operationToDelete);
    update((draft) => {
      if (reverseBalanceEffect) draft.balance -= balanceEffect;
      draft.financeOperations = draft.financeOperations.filter((item) => item.id !== operationId);
    });
    setOperationToDelete(null);
  };

  return (
    <div className="finance-section">
      <div className="finance-section-header">
        <div className="finance-pill income">История операций</div>
      </div>

      <div className="fin-quick-add" style={{ marginBottom: 14 }}>
        <select value={manualKind} onChange={(e) => setManualKind(e.target.value as 'income' | 'expense' | 'adjustment')}>
          <option value="income">Доход</option>
          <option value="expense">Оплата</option>
          <option value="adjustment">Корректировка</option>
        </select>
        <input type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} aria-label="Дата операции" />
        <input type="number" placeholder="сумма" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addManualOperation()} />
        <input type="text" placeholder="комментарий" value={manualNote} onChange={(e) => setManualNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addManualOperation()} />
        <button onClick={addManualOperation}>Добавить</button>
      </div>

      <div className="finance-section-header" style={{ marginBottom: 12 }}>
        <button className={filter === 'all' ? 'finance-pill income' : 'finance-pill'} onClick={() => setFilter('all')}>Все</button>
        <button className={filter === 'income' ? 'finance-pill income' : 'finance-pill'} onClick={() => setFilter('income')}>Доходы</button>
        <button className={filter === 'expense' ? 'finance-pill debt' : 'finance-pill'} onClick={() => setFilter('expense')}>Оплаты</button>
        <button className={filter === 'adjustment' ? 'finance-pill wish' : 'finance-pill'} onClick={() => setFilter('adjustment')}>Корректировки</button>
      </div>

      <div className="ledger-list">
        {visibleOps.length === 0 && (
          <div className="empty-state"><span className="display">Пока пусто</span>Подтверждённые доходы, оплаты и корректировки появятся здесь</div>
        )}

        {visibleOps.map((item) => {
          const signedAmount = financeOperationBalanceEffect(item);
          return (
          <div key={item.id} className="ledger-row">
            <div className="ledger-top">
              <span className="ledger-title">{item.title}</span>
              <div className="ledger-leader" />
              <span className={'ledger-amount ' + (signedAmount >= 0 ? 'ledger-income' : 'ledger-expense')}>{signedAmount >= 0 ? '+' : '-'}{fmtMoney(Math.abs(signedAmount))}</span>
              <button className="ledger-del" title="Удалить операцию" onClick={() => setOperationToDelete(item)}>×</button>
            </div>
            <div className="ledger-sub">
              <span className="ledger-sub-label">{item.kind === 'income' ? 'доход' : item.kind === 'expense' ? 'оплата' : 'корректировка'}</span>
              <span className="ledger-sub-label">{formatFinanceDate(item.date)}</span>
            </div>
            <div className="ledger-sub">
              <input
                type="text"
                className="ledger-sub-input"
                value={item.note ?? ''}
                placeholder="Комментарий к операции"
                onChange={(e) => updateOperationNote(item.id, e.target.value)}
              />
            </div>
          </div>
          );
        })}
      </div>
      {operationToDelete && (
        <div className="name-editor" onClick={() => setOperationToDelete(null)}>
          <div className="name-editor-box" onClick={(e) => e.stopPropagation()}>
            <div className="display" style={{ fontSize: 16 }}>Удалить операцию?</div>
            <div className="confirm-msg">
              «{operationToDelete.title}» на {fmtMoney(Math.abs(operationToDelete.amount))} {state.currency}. Выбери, менять ли баланс.
            </div>
            <div className="row">
              <button className="btn-ghost" onClick={() => setOperationToDelete(null)}>Отмена</button>
              <button className="btn-ghost" onClick={() => removeOperation(false)}>Оставить в балансе</button>
              <button className="btn-danger" onClick={() => removeOperation(true)}>Убрать из баланса</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DebtOrWishSection({ type }: { type: FinanceItemType & ('debt' | 'wish') }) {
  const { state, update } = useStore();
  const confirm = useConfirm();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');

  const isDebt = type === 'debt';
  const items = sortedFinanceItems(state, type);
  const total = financeItemsTotal(items);

  const addItem = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const item: FinanceItem = {
      id: uid(), type, title: trimmed, amount: Number(amount) || 0, progress: 0,
      dueDate: isDebt ? dueDate : undefined, done: false, createdAt: Date.now(),
    };
    update((draft) => { draft.financeItems.unshift(item); });
    setTitle(''); setAmount(''); setDueDate('');
  };

  const patch = (id: string, fn: (item: FinanceItem) => void) => {
    update((draft) => {
      const item = draft.financeItems.find((i) => i.id === id);
      if (!item) return;
      fn(item);
    });
  };

  const commitProgress = (id: string, progress: number) => {
    update((draft) => {
      const item = draft.financeItems.find((i) => i.id === id);
      if (!item) return;
      const previous = { amount: item.amount, progress: item.progress, done: item.done };
      item.progress = progress;
      const balanceDelta = financePaymentBalanceDelta(previous, item);
      if (balanceDelta !== 0) {
        const label = item.type === 'debt'
          ? (balanceDelta < 0 ? 'Оплата' : 'Возврат')
          : (balanceDelta < 0 ? 'Накопление' : 'Возврат из накоплений');
        addFinanceOperation(draft, {
          id: uid(),
          kind: 'expense',
          title: `${label}: ${item.title}`,
          amount: balanceDelta,
          date: dailyStamp(new Date().toISOString().slice(0, 10)),
          createdAt: Date.now(),
        });
      }
    });
  };

  const remove = async (item: FinanceItem) => {
    const ok = await confirm({ title: 'Удалить запись?', message: `«${item.title}» будет удалена безвозвратно.`, confirmLabel: 'Удалить' });
    if (ok) update((draft) => { draft.financeItems = draft.financeItems.filter((i) => i.id !== item.id); });
  };

  return (
    <div className="finance-section">
      <div className="finance-section-header">
        <div className={'finance-pill ' + type}>{isDebt ? 'Обязательные платежи' : 'Желаемое'}</div>
        {items.length > 0 && <div className="finance-total">всего: {fmtMoney(total)} {state.currency}</div>}
      </div>

      <div className="fin-quick-add">
        <input placeholder={isDebt ? 'Например, кредит на телефон' : 'Например, новые наушники'} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
        <input type="number" placeholder={isDebt ? 'сумма' : 'цена'} value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
        {isDebt && (
          <label className="fin-due-field"><span>срок</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="Срок платежа" /></label>
        )}
        <button onClick={addItem}>Добавить</button>
      </div>

      <div className="ledger-list">
        {items.length === 0 && (
          <div className="empty-state"><span className="display">Пока пусто</span>{isDebt ? 'Впиши первый платёж выше' : 'Впиши первое желание выше'}</div>
        )}
        {items.map((item) => {
          const amt = Number(item.amount) || 0;
          const progress = Number(item.progress) || 0;
          const pct = amt > 0 ? Math.min(100, Math.round((progress / amt) * 100)) : 0;
          return (
            <div key={item.id} className={'ledger-row' + (item.done ? ' done' : '')} data-type={type}>
              <div className="ledger-top">
                <div className={'stamp' + (item.done ? ' checked' : '')} title={isDebt ? 'Оплачено' : 'Куплено'} onClick={() => update((draft) => {
                  const target = draft.financeItems.find((i) => i.id === item.id);
                  if (!target) return;
                  const previous = { amount: target.amount, progress: target.progress, done: target.done };
                  target.done = !target.done;
                  const balanceDelta = financePaymentBalanceDelta(previous, target);
                  if (balanceDelta !== 0) {
                    addFinanceOperation(draft, {
                      id: uid(),
                      kind: 'expense',
                      title: `${balanceDelta < 0 ? (isDebt ? 'Оплата' : 'Покупка') : 'Возврат'}: ${target.title}`,
                      amount: balanceDelta,
                      date: dailyStamp(new Date().toISOString().slice(0, 10)),
                      createdAt: Date.now(),
                    });
                  }
                })}>
                  <CheckStamp />
                </div>
                <span
                  className="ledger-title"
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={(e) => patch(item.id, (i) => { i.title = e.currentTarget.textContent?.trim() || i.title; })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
                >
                  {item.title}
                </span>
                <div className="ledger-leader" />
                {isDebt && (
                  <input type="date" className="ledger-due" value={item.dueDate || ''} onChange={(e) => patch(item.id, (i) => { i.dueDate = e.target.value; })} />
                )}
                <span
                  className="ledger-amount"
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onBlur={(e) => {
                    const raw = (e.currentTarget.textContent || '').replace(state.currency, '').replace(/[^\d.,-]/g, '').replace(',', '.');
                    patch(item.id, (i) => { i.amount = Number(raw) || 0; });
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
                >
                  {fmtMoney(amt)} {state.currency}
                </span>
                <button className="ledger-del" title="Удалить" onClick={() => remove(item)}>×</button>
              </div>
              {!item.done && (
                <div className="ledger-sub">
                  <span className="ledger-sub-label">{isDebt ? 'оплачено' : 'накоплено'}</span>
                  <input
                    type="number"
                    className="ledger-sub-input"
                    defaultValue={progress || ''}
                    placeholder="0"
                    onBlur={(e) => commitProgress(item.id, Number(e.currentTarget.value) || 0)}
                  />
                  <div className="ledger-progress-track"><div className="ledger-progress-fill" style={{ width: `${pct}%` }} /></div>
                  <span className="ledger-sub-label">{pct}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IncomeSection() {
  const { state, update } = useStore();
  const confirm = useConfirm();
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [incomeTitle, setIncomeTitle] = useState('');

  const incomes = sortedIncomes(state);
  const total = financeItemsTotal(incomes);

  const addIncome = () => {
    if (!date || !amount) return;
    update((draft) => {
      draft.financeItems.unshift({
        id: uid(),
        type: 'income',
        title: incomeTitle.trim() || 'Доход',
        amount: Number(amount) || 0,
        incomeDate: date,
        confirmed: false,
        createdAt: Date.now(),
      });
    });
    setDate(''); setAmount(''); setIncomeTitle('');
  };

  const remove = async (item: FinanceItem) => {
    const ok = await confirm({ title: 'Удалить доход?', message: `Поступление от ${formatFinanceDate(item.incomeDate)} будет удалено безвозвратно.`, confirmLabel: 'Удалить' });
    if (ok) update((draft) => { draft.financeItems = draft.financeItems.filter((i) => i.id !== item.id); });
  };

  return (
    <div className="finance-section">
      <div className="finance-section-header">
        <div className="finance-pill income">Доходы</div>
        {incomes.length > 0 && <div className="finance-total">всего: {fmtMoney(total)} {state.currency}</div>}
      </div>

      <div className="fin-quick-add income-quick-add">
        <input type="text" placeholder="источник дохода" value={incomeTitle} onChange={(e) => setIncomeTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addIncome()} />
        <label className="fin-due-field"><span>дата</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Дата поступления" /></label>
        <input type="number" placeholder="сумма" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addIncome()} />
        <button onClick={addIncome}>Добавить</button>
      </div>

      <div className="ledger-list">
        {incomes.length === 0 && <div className="empty-state"><span className="display">Пока пусто</span>Добавь первое поступление выше</div>}
        {incomes.map((item) => (
          <div key={item.id} className="ledger-row income-row">
            <div className="ledger-top">
              <div className={'stamp' + (item.confirmed ? ' checked' : '')} title={item.confirmed ? 'Подтверждено' : 'Подтвердить получение'} onClick={() => update((draft) => {
                const incoming = draft.financeItems.find((x) => x.id === item.id);
                if (!incoming) return;
                if (incoming.confirmed) return;
                incoming.confirmed = true;
                addFinanceOperation(draft, {
                  id: uid(),
                  kind: 'income',
                  title: incoming.title || 'Доход',
                  amount: Number(incoming.amount) || 0,
                  date: dailyStamp(incoming.incomeDate),
                  note: 'Доход подтверждён',
                  createdAt: Date.now(),
                });
              })}>
                <CheckStamp />
              </div>
              <span
                className="ledger-title"
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={(e) => update((draft) => {
                  const income = draft.financeItems.find((x) => x.id === item.id);
                  if (income) income.title = e.currentTarget.textContent?.trim() || 'Доход';
                })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
              >
                {item.title || 'Доход'}
              </span>
              <div className="ledger-leader" />
              <span
                className="ledger-amount"
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={(e) => {
                  const raw = (e.currentTarget.textContent || '').replace(state.currency, '').replace(/[^\d.,-]/g, '').replace(',', '.');
                  update((draft) => {
                    const i = draft.financeItems.find((x) => x.id === item.id);
                    if (i) i.amount = Number(raw) || 0;
                  });
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } }}
              >
                {fmtMoney(Number(item.amount) || 0)} {state.currency}
              </span>
              <button className="ledger-del" title="Удалить" onClick={() => remove(item)}>×</button>
            </div>
            <div className="ledger-sub"><span className="ledger-sub-label">{formatFinanceDate(item.incomeDate)}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
