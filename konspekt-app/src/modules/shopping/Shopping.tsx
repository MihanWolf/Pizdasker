import { useState } from 'react';
import { useStore } from '../../core/store';
import { uid } from '../../core/types';
import { shoppingActiveCount, shoppingArchivedCount } from '../../core/selectors';
import './shopping.css';

function countLabel(value: number): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return 'товар';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'товара';
  return 'товаров';
}

export function Shopping() {
  const { state, update } = useStore();
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');

  const view = state.shoppingView;
  const setView = (next: 'current' | 'archive') => update((draft) => { draft.shoppingView = next; });

  const items = state.shoppingItems.filter((i) => (view === 'archive' ? i.purchasedAt : !i.purchasedAt));

  const addItem = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    update((draft) => {
      draft.shoppingItems.unshift({ id: uid(), title: trimmed, quantity: quantity.trim(), createdAt: Date.now(), purchasedAt: null });
    });
    setTitle('');
    setQuantity('');
  };

  const toggle = (id: string) => {
    update((draft) => {
      const item = draft.shoppingItems.find((i) => i.id === id);
      if (item) item.purchasedAt = item.purchasedAt ? null : Date.now();
    });
  };

  const remove = (id: string) => {
    update((draft) => {
      draft.shoppingItems = draft.shoppingItems.filter((i) => i.id !== id);
    });
  };

  return (
    <div className="shopping-wrap">
      <div className="shopping-header">
        <h1 className="shopping-title">Покупки</h1>
        <div className="shopping-count">
          {shoppingActiveCount(state)} {countLabel(shoppingActiveCount(state))}
        </div>
      </div>

      <div className="shopping-tabs">
        <button className={view === 'current' ? 'active' : ''} onClick={() => setView('current')}>
          Нужно купить <span>{shoppingActiveCount(state)}</span>
        </button>
        <button className={view === 'archive' ? 'active' : ''} onClick={() => setView('archive')}>
          Архив <span>{shoppingArchivedCount(state)}</span>
        </button>
      </div>

      {view === 'current' && (
        <div className="shopping-add">
          <input placeholder="Что купить?" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
          <input placeholder="кол-во" value={quantity} onChange={(e) => setQuantity(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
          <button onClick={addItem}>Добавить</button>
        </div>
      )}

      <div className="shopping-list">
        {items.length === 0 && (
          <div className="shopping-empty">{view === 'archive' ? 'Архив пока пуст' : 'Список свободен'}</div>
        )}
        {items.map((item) => (
          <div key={item.id} className="shopping-row shopping-row-enter">
            <button className={'shopping-check' + (item.purchasedAt ? ' checked' : '')} onClick={() => toggle(item.id)}>
              {item.purchasedAt ? '✓' : ''}
            </button>
            <div className="shopping-copy">
              <strong>{item.title}</strong>
              {item.quantity && <span>{item.quantity}</span>}
            </div>
            <button className="shopping-delete" onClick={() => remove(item.id)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
