import { useState } from 'react';
import { useStore } from '../../core/store';
import { uid, type FinanceItem, type FinanceItemType } from '../../core/types';
import { fmtMoney, formatFinanceDate, remainingTotal, sortedFinanceItems, sortedIncomes, financeItemsTotal } from '../../core/selectors';
import { useConfirm } from '../../ui/ConfirmDialog';
import './finance.css';

export function Finance() {
  const { state } = useStore();
  const debtLeft = remainingTotal(state, 'debt');
  const wishLeft = remainingTotal(state, 'wish');

  return (
    <div className="finance-wrap">
      <div className="finance-header">
        <div className="finance-title">Финансы</div>
        <div className="finance-totals">
          <span>Осталось оплатить <b className="debt-color">{fmtMoney(debtLeft)} {state.currency}</b></span>
          <span>Осталось накопить <b className="wish-color">{fmtMoney(wishLeft)} {state.currency}</b></span>
        </div>
      </div>
      <div className="finance-columns">
        <DebtOrWishSection type="debt" />
        <IncomeSection />
        <DebtOrWishSection type="wish" />
      </div>
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
      if (item) fn(item);
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
          <label className="fin-due-field"><span>срок</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        )}
        <button onClick={addItem}>Добавить</button>
      </div>

      <div className="ledger-list">
        {items.length === 0 && <div className="finance-empty">{isDebt ? 'Впиши первый платёж выше' : 'Впиши первое желание выше'}</div>}
        {items.map((item) => {
          const amt = Number(item.amount) || 0;
          const progress = Number(item.progress) || 0;
          const pct = amt > 0 ? Math.min(100, Math.round((progress / amt) * 100)) : 0;
          return (
            <div key={item.id} className={'ledger-row' + (item.done ? ' done' : '')}>
              <div className="ledger-top">
                <button className={'stamp' + (item.done ? ' checked' : '')} onClick={() => patch(item.id, (i) => { i.done = !i.done; })}>
                  {item.done ? '✓' : ''}
                </button>
                <span
                  className="ledger-title"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => patch(item.id, (i) => { i.title = e.currentTarget.textContent?.trim() || i.title; })}
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
                  onBlur={(e) => {
                    const raw = (e.currentTarget.textContent || '').replace(state.currency, '').replace(/[^\d.,-]/g, '').replace(',', '.');
                    patch(item.id, (i) => { i.amount = Number(raw) || 0; });
                  }}
                >
                  {fmtMoney(amt)} {state.currency}
                </span>
                <button className="ledger-del" onClick={() => remove(item)}>×</button>
              </div>
              {!item.done && (
                <div className="ledger-sub">
                  <span className="ledger-sub-label">{isDebt ? 'оплачено' : 'накоплено'}</span>
                  <input
                    type="number"
                    className="ledger-sub-input"
                    defaultValue={progress || ''}
                    placeholder="0"
                    onBlur={(e) => patch(item.id, (i) => { i.progress = Number(e.target.value) || 0; })}
                  />
                  <div className="ledger-progress-track"><div className="ledger-progress-fill" style={{ width: `${pct}%`, background: isDebt ? 'var(--debt)' : 'var(--wish)' }} /></div>
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

  const incomes = sortedIncomes(state);
  const total = financeItemsTotal(incomes);

  const addIncome = () => {
    if (!date || !amount) return;
    update((draft) => {
      draft.financeItems.unshift({ id: uid(), type: 'income', title: 'Доход', amount: Number(amount) || 0, incomeDate: date, createdAt: Date.now() });
    });
    setDate(''); setAmount('');
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
        <label className="fin-due-field"><span>дата</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <input type="number" placeholder="сумма" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addIncome()} />
        <button onClick={addIncome}>Добавить</button>
      </div>

      <div className="ledger-list">
        {incomes.length === 0 && <div className="finance-empty">Добавь первое поступление выше</div>}
        {incomes.map((item) => (
          <div key={item.id} className="ledger-row income-row">
            <div className="ledger-top">
              <span className="ledger-title income-date-label">{formatFinanceDate(item.incomeDate)}</span>
              <div className="ledger-leader" />
              <span
                className="ledger-amount"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => {
                  const raw = (e.currentTarget.textContent || '').replace(state.currency, '').replace(/[^\d.,-]/g, '').replace(',', '.');
                  update((draft) => {
                    const i = draft.financeItems.find((x) => x.id === item.id);
                    if (i) i.amount = Number(raw) || 0;
                  });
                }}
              >
                {fmtMoney(Number(item.amount) || 0)} {state.currency}
              </span>
              <button className="ledger-del" onClick={() => remove(item)}>×</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
