# AGENT\_PLAYBOOK.md — как добавлять новые вкладки/дашборды в это приложение

Этот файл адресован **агенту** (ИИ или разработчику), который получает запрос вида
«сделай дашборд/вкладку с такими-то полями и функциями» и должен на выходе выдать:
готовый `.tsx`, готовый `.css` и точные строки для вставки в существующие файлы.

Всё, что написано ниже — **дословно соответствует текущему состоянию кодовой базы**
на момент написания этого файла. Если что-то расходится с реальным содержимым
файлов в репозитории — доверяй реальным файлам, а не этому документу, и обнови документ.

\---

## 0\. Стек и общие правила

* React + TypeScript, сборка через Vite. Без Redux — стейт-менеджер: **Zustand**.
* Один глобальный объект состояния `AppState` (`src/core/types.ts`), сохраняется целиком
как один JSON через `src/core/storage.ts` (универсально: `window.storage` внутри Claude,
`localStorage` вне его — компонентам это прозрачно, трогать не нужно).
* Никаких ручных вызовов "перерисовать". Компонент вызывает `update(draft => {...})`,
дальше React сам перерисовывает всё, что подписано на изменившиеся данные.
* Бизнес-логика/расчёты — **всегда** в виде чистых функций в `src/core/selectors.ts`,
никогда напрямую внутри `.tsx`. Это даёт тестируемость без браузера.
* Каждый новый файл с бизнес-логикой в `core/` — по возможности сразу с тестом рядом
(`\*.test.ts`, Vitest).

\---

## 1\. Карта файлов — что где лежит и когда это трогать

|Путь|Когда трогать|Что там|
|-|-|-|
|`src/core/types.ts`|**Всегда** при добавлении новых данных|Интерфейсы данных + `AppState` + `createEmptyState()`|
|`src/core/store.ts`|Редко (обычно не нужно)|Глобальный стор Zustand: `state`, `update()`, `load()`, `importState()`|
|`src/core/storage.ts`|Почти никогда|Слой чтения/записи в `window.storage`/`localStorage`|
|`src/core/selectors.ts`|**Всегда**, если есть расчёты/фильтрация/сортировка|Чистые функции над `AppState`|
|`src/core/selectors.test.ts`|Вместе с новыми селекторами|Тесты на них (Vitest)|
|`src/core/backup.ts`|**Всегда** при добавлении новых полей в `AppState`|Импорт/экспорт JSON-бэкапа — см. раздел 6|
|`src/modules/<name>/<Name>.tsx`|**Всегда** для новой вкладки|Сам компонент вкладки|
|`src/modules/<name>/<name>.css`|**Всегда** для новой вкладки|Стили именно этой вкладки|
|`src/app/Sidebar.tsx`|Если нужна кнопка в полке слева и/или список "корешков"|Массив `MODES` + (опционально) `useSpineConfig()`|
|`src/App.tsx`|**Всегда** для новой вкладки|Регистрация компонента в `ActiveModule()`|
|`src/ui/icons.tsx`|Если нужна новая иконка|SVG-иконки как React-компоненты|
|`src/ui/ConfirmDialog.tsx`|Не создавать заново — переиспользовать|Хук `useConfirm()` для диалогов подтверждения удаления|
|`src/index.css`|Редко — только новые глобальные CSS-переменные|Палитра, шрифты, базовые токены|

**Мысленная модель**: `core/` = данные и математика, ничего не знает про экран.
`modules/<name>/` = экран, ничего не знает про других соседей. `app/` = клей, который
решает, какой экран сейчас показать и как выглядит навигация.

\---

## 2\. Пошаговый рецепт: добавить новую вкладку/дашборд

Ниже — **обязательный порядок**. Каждый шаг с точным местом вставки и шаблоном кода.

### Шаг 1 — Данные: `src/core/types.ts`

1.1. Добавь интерфейс(ы) для своих сущностей. Обязательные поля-конвенции:

* `id: string` — всегда, генерируется через `uid()` из этого же файла.
* `createdAt: number` — всегда (`Date.now()`), нужен для сортировки "новые сверху".
* Если у сущности есть цвет — используй `color: ColorName` (готовый union-тип из 6
цветов с готовыми CSS-переменными, см. `PALETTE`/`COLOR\_VARS` в этом же файле).

Шаблон:

```ts
export interface HabitEntry {
  id: string;
  habitId: string;
  date: string;      // 'YYYY-MM-DD', как в Watering/FinanceItem
  done: boolean;
  note: string;
  createdAt: number;
}

export interface Habit {
  id: string;
  name: string;
  color: ColorName;
  createdAt: number;
}
```

1.2. Добавь новый режим в `AppMode`, если это отдельная вкладка (не суб-экран внутри
существующей):

```ts
export type AppMode = 'today' | 'notes' | 'finance' | 'plants' | 'shopping' | 'tasks' | 'study' | 'habits';
```

1.3. Добавь новые массивы/поля в `AppState`. Если разделу нужен "активный выбранный
элемент" (как предмет в Учёбе или страница в Заметках) — заведи `activeHabitId` по
тому же паттерну:

```ts
export interface AppState {
  // ...существующие поля...
  habits: Habit\[];
  habitEntries: HabitEntry\[];
  activeHabitId: string | null;
}
```

1.4. **Обязательно** добавь дефолтные значения в `createEmptyState()` — если забыть,
TypeScript не даст собраться проекту (и это правильно, значит не забудешь):

```ts
export function createEmptyState(): AppState {
  return {
    // ...существующие поля...
    habits: \[],
    habitEntries: \[],
    activeHabitId: null,
  };
}
```

### Шаг 2 — Логика: `src/core/selectors.ts` (+ тест)

Любой расчёт, фильтрация, сортировка — сюда, как чистая функция `(state, ...) => результат`.
Не обращается к DOM, не использует React-хуки, легко тестируется.

Шаблон (по образцу уже существующих `filteredNotesForPage`, `filteredTasksForProject`):

```ts
export function habitEntriesForHabit(state: AppState, habitId: string) {
  return state.habitEntries.filter((e) => e.habitId === habitId);
}

export function habitStreak(state: AppState, habitId: string, now = new Date()): number {
  const doneDates = new Set(
    habitEntriesForHabit(state, habitId).filter((e) => e.done).map((e) => e.date)
  );
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  while (doneDates.has(todayStr(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
```

Добавь тест в `selectors.test.ts` — **но осторожно с вставкой** (см. раздел 7 "Грабли"):
вставляй новый `describe(...)` блок **между** существующими `describe`-блоками, ни в коем
случае не заменяя первую строку соседнего блока. После вставки **сразу** гоняй
`npx vitest run`, прежде чем писать что-либо ещё.

### Шаг 3 — Компонент: `src/modules/<name>/<Name>.tsx`

Общая анатомия любого модуля (все 7 существующих написаны по этой схеме):

```tsx
import { useState } from 'react';
import { useStore } from '../../core/store';
import { uid, COLOR\_VARS } from '../../core/types';
import { habitEntriesForHabit, habitStreak } from '../../core/selectors';
import { useConfirm } from '../../ui/ConfirmDialog';
import './habits.css';

export function Habits() {
  const { state, update } = useStore();
  const confirm = useConfirm();

  // Если у раздела есть "активный элемент" в полке слева — бери его отсюда,
  // НЕ заводи под него useState (см. раздел 3 про Sidebar).
  const activeHabit = state.habits.find((h) => h.id === state.activeHabitId) ?? null;

  // Локальный UI-стейт (не сохраняется, не переживает уход с экрана) — useState.
  const \[note, setNote] = useState('');

  const markToday = () => {
    if (!activeHabit) return;
    update((draft) => {
      draft.habitEntries.unshift({
        id: uid(), habitId: activeHabit.id, date: todayStr(), done: true, note: note.trim(), createdAt: Date.now(),
      });
    });
    setNote('');
  };

  const deleteEntry = async (id: string) => {
    const ok = await confirm({ title: 'Удалить запись?', message: 'Действие необратимо.', confirmLabel: 'Удалить' });
    if (ok) update((draft) => { draft.habitEntries = draft.habitEntries.filter((e) => e.id !== id); });
  };

  if (!activeHabit) {
    return (
      <main className="habits-main">
        <div className="habits-welcome">
          <div className="habits-welcome-title">Пока пусто</div>
          <div>Добавь первую привычку через «+» слева</div>
        </div>
      </main>
    );
  }

  // ...остальной JSX...
}
```

**Правила, которые нельзя нарушать:**

* Читать данные — только через `useStore()`, никогда не хранить копию массива из `state`
в `useState` (иначе перестанет обновляться при изменениях).
* Менять данные — только через `update(draft => {...})`. Внутри можно мутировать `draft`
напрямую (`.push`, `.filter`, присваивание полей) — это безопасно, стор сам всё
сериализует и сохранит.
* Удаление чего-либо, что жалко потерять — всегда через `useConfirm()`, не через
`window.confirm` и не молча.
* Если в разделе есть "заголовок с прогрессом/итогом" — считай его через функцию из
`selectors.ts`, не инлайн-вычислением в JSX.

### Шаг 4 — Стили: `src/modules/<name>/<name>.css`

* Импортируется прямо в `.tsx` строкой `import './habits.css';` — Vite подключит его
глобально (это не CSS Modules, изоляции по умолчанию нет).
* **Все имена классов — с префиксом модуля** (`.habits-main`, `.habits-welcome`,
`.habit-row`), чтобы не столкнуться с классами другого модуля.
* Переиспользуй существующие CSS-переменные из `src/index.css`, не изобретай свои цвета:
`--ink`, `--ink-soft`, `--ink-faint`, `--rule`, `--card`, `--shadow`, `--urgent`,
`--forest`, `--rust`, `--plum`, `--mustard`, `--slate`, `--teal`.
* Шрифты: заголовки — `'Fraunces', serif` (обычно `font-style: italic; font-weight: 600`),
технические/цифровые подписи — `'JetBrains Mono', monospace`, обычный текст — по
умолчанию (`Inter`, подключен глобально в `body`).
* Если элементы появляются динамически (новая строка списка) — добавь лёгкую анимацию
входа, как во всех остальных модулях:

```css
.habit-row-enter { animation: habit-row-in 0.28s cubic-bezier(.2,.8,.3,1) both; }
@keyframes habit-row-in { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
```

### Шаг 5 — Регистрация в `src/App.tsx`

Текущее полное содержимое `ActiveModule()` (сверяйся с реальным файлом, если он
изменился с момента написания этого документа):

```tsx
function ActiveModule() {
  const mode = useStore((s) => s.state.mode);
  if (mode === 'today') return <Today />;
  if (mode === 'shopping') return <Shopping />;
  if (mode === 'notes') return <Notes />;
  if (mode === 'plants') return <Plants />;
  if (mode === 'tasks') return <Tasks />;
  if (mode === 'finance') return <Finance />;
  if (mode === 'study') return <Study />;
  if (mode === 'habits') return <Habits />;   // ← новая строка
  return ( /\* заглушка "не перенесено" \*/ );
}
```

Не забудь импорт вверху файла: `import { Habits } from './modules/habits/Habits';`

### Шаг 6 — Кнопка в полке: `src/app/Sidebar.tsx`

6.1. Добавь иконку, если нужна новая (раздел 5 ниже), и добавь пункт в массив `MODES`
(порядок в массиве = порядок кнопок сверху вниз):

```tsx
import { IconSun, IconChecklist, IconWallet, IconBag, IconQuote, IconDroplet, IconBook, IconFlame } from '../ui/icons';

const MODES: { mode: AppMode; icon: ComponentType<{ className?: string }>; label: string }\[] = \[
  { mode: 'today', icon: IconSun, label: 'Главная' },
  // ...существующие пункты...
  { mode: 'habits', icon: IconFlame, label: 'Привычки' },   // ← новая строка
];
```

6.2. **Только если** у раздела есть список "корешков" слева (пользователь выбирает один
активный элемент из списка — как предметы/страницы/растения). Если раздел устроен как
Задачи/Финансы/Покупки (без выбора одного элемента, вся навигация внутри самого экрана) —
**этот шаг пропускается**.

Текущая полная сигнатура `useSpineConfig()` в файле — добавляй новую ветку `if` внутрь
неё, перед финальным `return null;`:

```tsx
function useSpineConfig(): SpineConfig | null {
  const { state, update } = useStore();

  if (state.mode === 'habits') {
    return {
      items: state.habits.map((h) => ({
        id: h.id, name: h.name, color: h.color,
        count: String(habitStreak(state, h.id)),
      })),
      activeId: state.activeHabitId,
      onSelect: (id) => update((draft) => { draft.activeHabitId = id; }),
      onAdd: (name) => {
        const id = uid();
        update((draft) => {
          draft.habits.push({ id, name, color: PALETTE\[draft.habits.length % PALETTE.length], createdAt: Date.now() });
          draft.activeHabitId = id;
        });
      },
      placeholder: 'Например, Бег по утрам',
    };
  }

  // ...существующие ветки (study/notes/plants)...
  return null;
}
```

\---

## 3\. Персистентный "активный элемент" — когда и как

Если раздел устроен как список с выбором одного элемента (предмет/страница/растение/
привычка), **не** храни выбранный ID в `useState` внутри компонента — это теряется при
перезагрузке страницы и не связано с полкой слева. Вместо этого:

1. Заведи поле `activeXId: string | null` в `AppState` (шаг 1.3).
2. Читай/пиши его напрямую через `state.activeXId` / `update(draft => { draft.activeXId = id; })`.
3. Добавь фолбэк на первый элемент списка в `withActiveIdFallbacks()` внутри
`src/core/store.ts` — по тому же паттерну, что уже сделано для остальных четырёх
полей. Текущее содержимое функции:

```ts
function withActiveIdFallbacks(s: AppState): AppState {
  return {
    ...s,
    activeSubjectId: s.activeSubjectId ?? s.subjects\[0]?.id ?? null,
    activeNotePageId: s.activeNotePageId ?? s.notePages\[0]?.id ?? null,
    activePlantId: s.activePlantId ?? s.plants\[0]?.id ?? null,
    activeTaskProjectId: s.activeTaskProjectId ?? s.taskProjects\[0]?.id ?? null,
    activeHabitId: s.activeHabitId ?? s.habits\[0]?.id ?? null,   // ← новая строка
  };
}
```

\---

## 4\. Разделы без "корешков" (Задачи / Финансы / Покупки — паттерн)

Если у раздела своя внутренняя навигация (вкладки/фильтры прямо в теле экрана, а не в
полке слева) — просто персистентное поле в `AppState` без записи в `useSpineConfig`.
Пример — `tasksView: 'current' | 'archive'` и `activeTaskProjectId` читаются и
пишутся прямо внутри `Tasks.tsx` через `state.tasksView` /
`update(draft => { draft.tasksView = ...})`, а вкладки проектов рисуются как обычные
кнопки внутри самого компонента (не в `Sidebar.tsx`). Используй этот паттерн, если у
раздела несколько "под-вкладок", которые нет смысла выносить в общую боковую полку.

\---

## 5\. Добавление новой иконки: `src/ui/icons.tsx`

Формат — SVG как React-компонент, принимает стандартные `SVGProps<SVGSVGElement>`
(тип `IconProps` уже определён в начале файла):

```tsx
export function IconFlame(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2c2 4-2 5-2 9a4 4 0 0 0 8 0c0-2-1-3-1-3s1 3-1 3-2-2-2-4c0 0 3 2 3 6a6 6 0 0 1-12 0c0-5 4-6 4-11z" />
    </svg>
  );
}
```

Правила: `viewBox="0 0 24 24"`, `stroke="currentColor"` (чтобы цвет наследовался от
родителя, как во всех остальных иконках), никаких хардкодных цветов внутри.

\---

## 6\. Совместимость бэкапов: `src/core/backup.ts` — не забыть!

**Это самый частый пропускаемый шаг.** Экспорт/импорт JSON-бэкапа — отдельный от
`store.ts` кусок кода, и он **не подхватывает новые поля `AppState` автоматически**.
Если добавил новые поля в `AppState` на шаге 1, обязательно добавь их и сюда — иначе
экспортированный бэкап потеряет данные нового раздела при импорте.

В функции `importBackup()` (файл `src/core/backup.ts`) добавь строки по образцу
остальных полей:

```ts
const state: AppState = {
  // ...существующие поля...
  habits: Array.isArray(parsed.habits) ? parsed.habits : empty.habits,
  habitEntries: Array.isArray(parsed.habitEntries) ? parsed.habitEntries : empty.habitEntries,
  activeHabitId: parsed.activeHabitId ?? (parsed.habits?.\[0]?.id ?? null),
};
```

`exportBackup()` менять не нужно — она сериализует весь `state` целиком через spread,
новые поля попадут туда автоматически.

Добавь/расширь тест в `backup.test.ts`, подтверждающий, что новый раздел переживает
цикл экспорт→импорт (см. существующий тест `round-trips: export(new) -> import(new)`
как образец).

\---

## 7\. Грабли, о которых обязательно нужно знать

1. **Структура папок при передаче файлов.** Каждый файл должен лежать ровно по пути
`src/...`, начиная от корня проекта (`konspekt-app/src/modules/habits/Habits.tsx`,
а не `konspekt-app/modules/habits/Habits.tsx` и не `konspekt-app/habits/Habits.tsx`).
Ошибка на уровень выше/ниже даёт `Failed to resolve import` или
`Failed to load /src/main.tsx`.
2. **Вставка нового блока в середину существующего файла** (особенно `selectors.test.ts`
и `selectors.ts`) легко может съесть открывающую/закрывающую скобку соседнего блока.
После **любой** вставки в существующий файл — сразу `npx vitest run` и/или
`npm run build`, не копить несколько правок перед проверкой.
3. **`JSX.Element` как тип не резолвится** в текущем `tsconfig` без явного импорта
пространства имён — использовать `ComponentType<{...}>` из `'react'` вместо
`(props) => JSX.Element` (см. `Sidebar.tsx`, там уже так сделано).
4. **Забытое поле в `createEmptyState()`** после добавления нового поля в `AppState` —
даёт ошибку TypeScript при сборке. Это нормально и ожидаемо — просто заполни поле.
5. **Забытое обновление `backup.ts`** — не даёт ошибки сборки (там `Partial<AppState>`),
но молча теряет данные при импорте старого бэкапа. Не забывай раздел 6.
6. **Не хранить персистентные данные в `useState`.** Если после `F5` данные должны
остаться — им место только в `AppState`, не в локальном стейте компонента.

\---

## 8\. Чек-лист "готово к сдаче" для новой вкладки

```bash
cd konspekt-app
npm install        # если добавлял новые npm-пакеты
npm run build      # обязан пройти без ошибок TypeScript
npx vitest run     # все тесты, включая новые, обязаны быть зелёными
npm run dev        # ручная проверка глазами:
```

* \[ ] Кнопка новой вкладки появилась в полке слева и переключает на неё.
* \[ ] Если есть список-полка (шаг 6.2) — добавление через "+" работает и сразу делает
элемент активным.
* \[ ] Данные переживают перезагрузку страницы (F5).
* \[ ] Удаление чего-либо спрашивает подтверждение.
* \[ ] Экспорт бэкапа → импорт того же файла не теряет данные нового раздела.
* \[ ] Мобильная ширина (<720px) не ломает раскладку (проверить в дев-тулзах браузера).

\---

