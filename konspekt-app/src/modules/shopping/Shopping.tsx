import { useState } from 'react';
import { useStore } from '../../core/store';
import { uid, type ShoppingItem } from '../../core/types';
import { shoppingActiveCount, shoppingArchivedCount } from '../../core/selectors';
import { BagIcon } from '../../ui/icons';
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
  const archived = view === 'archive';

  const activeItems = state.shoppingItems.filter((i) => (archived ? i.purchasedAt : !i.purchasedAt));

  const addItem = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    update((draft) => {
      draft.shoppingItems.unshift({ id: uid(), title: trimmed, quantity: quantity.trim(), createdAt: Date.now(), purchasedAt: null });
    });
    setTitle('');
    setQuantity('');
  };

  const toggle = (id: string, toArchive: boolean) => {
    update((draft) => {
      const item = draft.shoppingItems.find((i) => i.id === id);
      if (item) item.purchasedAt = toArchive ? Date.now() : null;
    });
  };

  const remove = (id: string) => {
    update((draft) => {
      draft.shoppingItems = draft.shoppingItems.filter((i) => i.id !== id);
    });
  };

  return (
    <div className="shopping-wrap content-scroll">
      <div className="shopping-header">
        <div>
          <div className="shopping-kicker"><BagIcon /> список для магазина</div>
          <h1 className="shopping-title display">Покупки</h1>
        </div>
        <div className="shopping-count">{activeItems.length} {countLabel(activeItems.length)}</div>
      </div>

      <div className="shopping-tabs" role="tablist">
        <button className={'shopping-tab' + (!archived ? ' active' : '')} onClick={() => setView('current')}>
          Нужно купить <span>{shoppingActiveCount(state)}</span>
        </button>
        <button className={'shopping-tab' + (archived ? ' active' : '')} onClick={() => setView('archive')}>
          Архив <span>{shoppingArchivedCount(state)}</span>
        </button>
      </div>

      {!archived && (
        <div className="shopping-quick-add">
          <input data-role="title" placeholder="Что купить?" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
          <input data-role="quantity" placeholder="кол-во" aria-label="Количество, необязательно" value={quantity} onChange={(e) => setQuantity(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addItem()} />
          <button onClick={addItem}>Добавить</button>
        </div>
      )}

      <div className="shopping-list">
        {activeItems.length === 0 && (
          <div className="shopping-empty">
            <span className="display">{archived ? 'Архив пока пуст' : 'Список свободен'}</span>
            {archived ? 'Купленные товары появятся здесь' : 'Добавь первый товар выше'}
          </div>
        )}

        {!archived && activeItems
          .slice()
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((item) => (
            <ShoppingRow key={item.id} item={item} archived={false} onToggle={() => toggle(item.id, true)} onDelete={() => remove(item.id)} />
          ))}

        {archived && <ArchiveGroups items={activeItems} onToggle={(id) => toggle(id, false)} onDelete={remove} />}
      </div>
    </div>
  );
}

function ShoppingRow({ item, archived, onToggle, onDelete }: { item: ShoppingItem; archived: boolean; onToggle: () => void; onDelete: () => void }) {
  const date = archived && item.purchasedAt
    ? new Date(item.purchasedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  return (
    <div className={'shopping-row shopping-row-enter' + (archived ? ' archived' : '')}>
      <button className={'shopping-check' + (archived ? ' checked' : '')} aria-label={archived ? 'Вернуть в список' : 'Отметить купленным'} onClick={onToggle} />
      <div className="shopping-row-copy">
        <strong>{item.title}</strong>
        {item.quantity && <span>{item.quantity}</span>}
      </div>
      {archived && <time>{date}</time>}
      <button className="shopping-delete" title="Удалить" onClick={onDelete}>×</button>
    </div>
  );
}

function ArchiveGroups({ items, onToggle, onDelete }: { items: ShoppingItem[]; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const groups = new Map<string, ShoppingItem[]>();
  items
    .slice()
    .sort((a, b) => (b.purchasedAt || 0) - (a.purchasedAt || 0))
    .forEach((item) => {
      const key = new Date(item.purchasedAt || 0).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });

  return (
    <>
      {Array.from(groups.entries()).map(([dateLabel, groupItems]) => (
        <section className="shopping-date-group" key={dateLabel}>
          <h2>{dateLabel}</h2>
          <div className="shopping-date-items">
            {groupItems.map((item) => (
              <ShoppingRow key={item.id} item={item} archived onToggle={() => onToggle(item.id)} onDelete={() => onDelete(item.id)} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
