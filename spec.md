# Техническая спецификация проекта

> **Проект:** `Pizdasker` — личный офлайн-органайзер «Конспект»
> **Активная кодовая база:** `konspekt-app/` (React + TypeScript + Vite)
> **Архив старой версии:** `Old Version/App/` (vanilla JS, PWA)
> **Дата составления:** 2026-09-14

---

## 1. Назначение и обзор

`Pizdasker` — локальное одностраничное веб-приложение (SPA) для личного
использования: учёба, задачи, финансы, заметки, полив растений и покупки.
Данные хранятся только на устройстве пользователя (localStorage либо
`window.storage`), синхронизации между устройствами нет. Есть экспорт/импорт
JSON-бэкапа.

Проект находится в состоянии **миграции** с vanilla-JS-версии (`Old Version`)
на React-версию (`konspekt-app`). Новая версия покрывает все 7 разделов,
но обряд первого запуска (onboarding) из старой версии на React пока **не
перенесён** — в модели данных он сохранён для совместимости бэкапов.

### 1.1. Статус разделов

| Раздел | Mode | React-версия | Статус |
|---|---|---|---|
| Сегодня | `today` | `modules/today/Today.tsx` | ✅ перенесён |
| Задачи | `tasks` | `modules/tasks/Tasks.tsx` | ✅ перенесён |
| Финансы | `finance` | `modules/finance/Finance.tsx` | ✅ перенесён |
| Покупки | `shopping` | `modules/shopping/Shopping.tsx` | ✅ перенесён |
| Заметки | `notes` | `modules/notes/Notes.tsx` | ✅ перенесён |
| Полив | `plants` | `modules/plants/Plants.tsx` | ✅ перенесён |
| Учёба | `study` | `modules/study/Study.tsx` | ✅ перенесён |
| Обряд первого запуска | `onboarding` | — | ❌ не перенесён (данные сохраняются) |

---

## 2. Технологический стек

- **React 19** (`react`, `react-dom`) — UI.
- **TypeScript ~6.0**, строгий режим (`noUnusedLocals`, `noUnusedParameters`,
  `verbatimModuleSyntax`, `erasableSyntaxOnly`).
- **Vite 8** — сборка и dev-сервер, плагин `@vitejs/plugin-react`.
- **Zustand 5** — единственный глобальный стор (без Redux/Context для данных).
- **Vitest 5** — юнит-тесты (`*.test.ts`, среда Node, без DOM).
- **oxlint 1.79** — линтер (`react/rules-of-hooks`, `react/only-export-components`).
- **CSS** — обычные глобальные CSS-файлы (не CSS Modules), подключаются
  через `import './x.css'`.

### 2.1. Команды

```bash
cd konspekt-app
npm install        # установка зависимостей
npm run dev        # dev-сервер Vite
npm run build      # tsc -b && vite build (обязан проходить без ошибок TS)
npm run preview    # предпросмотр production-сборки
npm run lint       # oxlint
npx vitest run     # прогон всех тестов
```

---

## 3. Архитектура

Приложение разделено на три слоя:

```
core/      — данные, математика, хранение. Ничего не знает про экран.
modules/   — экраны разделов. Ничего не знают про соседей.
app/ ui/   — клей: навигация, диалоги, общие компоненты.
```

### 3.1. Принципы

1. **Один глобальный объект состояния `AppState`**, сериализуемый целиком
   в один JSON. Никаких отдельных ключей под разделы.
2. **Никаких ручных перерисовок.** Компонент вызывает `update(draft => {...})`,
   Zustand сам уведомляет подписанные компоненты.
3. **Вся бизнес-логика — чистые функции** в `src/core/selectors.ts`
   (`(state, ...args) => результат`). Никаких расчётов в JSX, никакого DOM
   внутри селекторов. Это даёт тестируемость без браузера.
4. **Персистентность — обязательно через `AppState`.** Выбранные элементы
   («активная страница», «активный предмет», под-вкладки) живут только в
   `AppState` и переживают перезагрузку. Стор автоматически чинит висящие
   id через `withActiveIdFallbacks()` (см. §10.2).
5. **Удаление чего-либо ценного — через `useConfirm()`**, не через
   `window.confirm`.

### 3.2. Карта файлов

| Путь | Назначение |
|---|---|
| `src/main.tsx` | Точка входа, `createRoot`, подключение `index.css` |
| `src/App.tsx` | Корневой компонент, выбор активного модуля, `load()` |
| `src/index.css` | Глобальные CSS-переменные (палитра, шрифты) |
| `src/core/types.ts` | Все интерфейсы, `AppState`, палитра, `uid()`, `createEmptyState()` |
| `src/core/store.ts` | Zustand-стор: `state`, `loaded`, `saveStatus`, `load/update/importState/retrySave`, `withActiveIdFallbacks` |
| `src/core/store.test.ts` | Тесты фолбэков активных id |
| `src/core/storage.ts` | Драйвер хранения: `window.storage` или `localStorage` |
| `src/core/selectors.ts` | Чистые функции бизнес-логики |
| `src/core/selectors.test.ts` | Тесты селекторов (Vitest) |
| `src/core/backup.ts` | `exportBackup()` / `importBackup()` |
| `src/core/backup.test.ts` | Тесты совместимости бэкапов |
| `src/app/Shelf.tsx` | Единая полка: иконки режимов + корешки активного раздела + «+» |
| `src/app/TopBar.tsx` | Общая шапка раздела: цветная точка, inline-имя, мета, удаление |
| `src/ui/icons.tsx` | Inline-SVG иконки (режимы, флаг, штамп-галочка) |
| `src/ui/ConfirmDialog.tsx` | `ConfirmProvider` + хуки `useConfirm()`, `useNamePrompt()` |
| `src/ui/confirm-dialog.css` | Стили диалогов подтверждения и ввода имени |
| `src/modules/<name>/<Name>.tsx` | Компонент раздела |
| `src/modules/<name>/<name>.css` | Стили раздела |
| `src/modules/BackupBar.tsx` | Нижняя панель: индикатор сохранения + экспорт/импорт/очистка |
| `src/modules/study/DetailDrawer.tsx` | Боковая панель деталей темы |

---

## 4. Модель данных — `src/core/types.ts`

Все формы объектов **1:1 повторяют** состояние старого `shared.js`, чтобы
старые JSON-бэкапы импортировались без миграции.

### 4.1. Типы-примитивы

```ts
type ColorName = 'teal' | 'rust' | 'plum' | 'mustard' | 'slate' | 'forest';
type FinanceItemType = 'debt' | 'wish' | 'income';
type AppMode = 'today' | 'notes' | 'finance' | 'plants'
             | 'shopping' | 'tasks' | 'study';

const PALETTE: ColorName[] = ['teal','rust','plum','mustard','slate','forest'];

const COLOR_VARS: Record<ColorName, string> = {
  teal: '#2F7775', rust: '#B9552A', plum: '#724B8D',
  mustard: '#AA7905', slate: '#435D87', forest: '#3F784A',
};

function uid(): string  // Date.now().toString(36) + random
```

### 4.2. Сущности

```ts
interface Subject {          // Учёба: предмет
  id: string; name: string; color: ColorName;
  ungroupedName?: string;    // переименование псевдо-группы «Общее»
  createdAt: number;
}
interface TopicGroup {       // Учёба: группа тем внутри предмета
  id: string; subjectId: string; name: string;
  color?: ColorName; createdAt: number;
}
interface TopicLink { id: string; url: string; label?: string; }

interface Topic {            // Учёба: тема
  id: string; subjectId: string; groupId: string | null;
  title: string; note: string; why: string;
  links: TopicLink[]; done: boolean; urgent: boolean; createdAt: number;
}

interface NotePage { id: string; name: string; color: ColorName; createdAt: number; }
interface NoteEntry {
  id: string; pageId: string; content: string;
  source: string; important: boolean; createdAt: number;
}

interface FinanceItem {
  id: string; type: FinanceItemType; title: string; amount: number;
  progress?: number; dueDate?: string; incomeDate?: string;
  done?: boolean; createdAt: number;
}

interface Plant { id: string; name: string; color: ColorName; createdAt: number; }
interface FertAmounts { micro: number|null; grow: number|null; bloom: number|null; ripen: number|null; }
interface Watering {
  id: string; plantId: string; date: string;
  water: number|null; ph: number|null;
  fert: FertAmounts; note: string; createdAt: number;
}

interface ShoppingItem {
  id: string; title: string; quantity: string;
  createdAt: number; purchasedAt: number | null;
}

interface TaskProject { id: string; name: string; color: ColorName; createdAt: number; }
interface TaskItem {
  id: string; projectId: string; title: string; important: boolean;
  done: boolean; createdAt: number; completedAt: number | null;
}

interface OnboardingState { active: boolean; scene: string; }
```

### 4.3. Корневое состояние

```ts
interface AppState {
  mode: AppMode;

  subjects: Subject[];
  groups: TopicGroup[];
  topics: Topic[];
  activeSubjectId: string | null;
  studySearch: string;                    // поле поиска раздела «Учёба»

  notePages: NotePage[];
  noteEntries: NoteEntry[];
  activeNotePageId: string | null;
  notesSearch: string;                    // поле поиска раздела «Заметки»

  financeItems: FinanceItem[];
  currency: string;                       // по умолчанию '₽'

  plants: Plant[];
  waterings: Watering[];
  activePlantId: string | null;
  plantsSearch: string;                   // поле поиска раздела «Полив»

  shoppingItems: ShoppingItem[];
  shoppingView: 'current' | 'archive';

  taskProjects: TaskProject[];
  taskItems: TaskItem[];
  activeTaskProjectId: string | null;
  tasksView: 'current' | 'archive';

  onboarding: OnboardingState;            // совместимость со старой версией
}
```

`createEmptyState()` возвращает состояние с `mode: 'today'`, `currency: '₽'`,
пустыми массивами и `onboarding: { active: true, scene: 'birth' }`.

> **Важно:** при добавлении любого нового поля в `AppState` обязательно
> синхронизировать три места: `createEmptyState()` (иначе ошибка сборки TS),
> `importBackup()` в `backup.ts` (иначе молча теряется при импорте) и, при
> необходимости, фолбэки в `store.ts`.

---

## 5. Слой хранения

### 5.1. `storage.ts`

Универсальный драйвер `StorageDriver` с асинхронным интерфейсом
(`get/set/delete/list`). Логика выбора:

```ts
function getStorageDriver(): StorageDriver {
  if (typeof window !== 'undefined' && window.storage) return window.storage;
  return createLocalStorageDriver();
}
```

- Внутри окружения, где доступен `window.storage` (например, артефакт
  в Claude) — используется он (облачное key-value на аккаунт).
- Иначе — `localStorage` с префиксом ключа `konspekt-app:`.
- Ключ состояния: **`study-data`** (константа `STATE_KEY`).
- `loadRawState()` возвращает `null` при отсутствии ключа/ошибке.
- `saveRawState()` делает до **4 попыток** с нарастающей задержкой
  (400 мс × номер попытки), возвращая `{ ok: true }` либо `{ ok: false, error }`.

UI и бизнес-логика не знают, какое окружение используется.

### 5.2. `store.ts` (Zustand)

```ts
interface Store {
  state: AppState;
  loaded: boolean;
  saveStatus: { kind: 'idle'|'saving'|'saved'|'error'; text: string };
  load: () => Promise<void>;
  update: (mutator: (draft: AppState) => void) => void;
  importState: (next: AppState) => void;
  retrySave: () => Promise<void>;
}
```

- `update(mutator)` — **ключевой механизм**: делает `structuredClone`
  текущего состояния, отдаёт копию в мутатор (можно мутировать напрямую),
  затем ставит новый объект в стор и ставит сохранение в очередь.
- Сохранения **сериализуются** через цепочку промисов `saveChain`, чтобы
  избежать гонок.
- `load()` — читает JSON, мерджит с `createEmptyState()`, восстанавливает
  флаг onboarding, прогоняет `withActiveIdFallbacks()` и выставляет `loaded: true`.
- `update()` и `importState()` также прогоняют состояние через
  `withActiveIdFallbacks()` перед записью в стор — так активные id никогда
  не «висят» на удалённых элементах.
- `withActiveIdFallbacks(s)` (экспортируется) для каждого списка с активным
  элементом оставляет валидный id, иначе подставляет первый элемент или
  `null`. Тесты — `store.test.ts`.

---

## 6. Бизнес-логика — `src/core/selectors.ts`

Все функции — чистые, принимают `AppState` и опционально `now: Date`
(для тестируемости дат). Тесты находятся в `selectors.test.ts` (Vitest).

### 6.1. Утилиты

| Функция | Назначение |
|---|---|
| `todayStr(d?)` | `'YYYY-MM-DD'` локальной даты |
| `fmtMoney(n)` | Формат `ru-RU` с группировкой |
| `formatFinanceDate(s)` | Дата в формате `д мес. год` |
| `noteCountLabel(n)` | Склонение: запись/записи/записей |
| `daysAgoLabel(dateStr, now)` | «сегодня», «вчера», «N дн. назад», «через N дн.» |

### 6.2. Главная / дневной лимит

**`calculateDailyBudget(state, now)`** — формула дневного лимита:

```text
(баланс на руках + ближайший будущий доход − остаток обязательных платежей до даты дохода)
──────────────────────────────────────────────────────────────────────────────────────────
                          дни до даты дохода (минимум 1)
```

- Ближайший доход: `type='income'`, `incomeDate >= сегодня`, сортировка по
  дате, затем по `createdAt` (при равенстве — более новый).
- Баланс — поле `state.balance` («Сейчас на руках» в разделе «Финансы»).
- Расходы: `type='debt'`, `done=false`, `dueDate` в диапазоне
  `[сегодня, incomeDate]`; остаток = `max(0, amount − progress)`.
- Возвращает `{ displayValue: Math.abs(raw), isNegative: raw < 0, color }`,
  где `color` — `dailyBudgetColor` (0 — серый, <0 — красный, ≤800 — жёлтый,
  ≤1000 — янтарный, иначе зелёный).

Связанные помощники: `paymentDaysUntil`, `paymentNeedsAttention` (≤ 3 дней),
`paymentDueLabel`, `paymentAccent` (цвет от срочности), `mixHexColors`
(интерполяция двух hex), `todayPaymentsItems` (топ-N платежей/доходов),
`todayNeedsAttention`, `importantOpenTasks`, `plantsNeedingWater`,
`importantNotes`, `topWishes`, `wateringDaysAgo`, `plantNeedsWater`
(полив нужен при `null` или `≥ 2` дней).

### 6.3. Заметки

`notesForPage`, `filteredNotesForPage` (поиск по `content + source`,
сортировка новые сверху).

### 6.4. Полив

`latestWateringDate`, `filteredWateringsForPlant` (поиск по названиям
удобрений и заметке, сортировка по дате desc).

### 6.5. Задачи

`taskProjectItems`, `taskOpenCount`, `filteredTasksForProject`
(фильтр current/archive, важные сверху, затем новые).

### 6.6. Финансы

`remainingTotal(state, 'debt'|'wish')` — сумма остатков по незакрытым;
`sortedFinanceItems` (незакрытые сверху; долги — по сроку; иначе по
`createdAt`); `sortedIncomes` (по дате поступления); `financeItemsTotal`.

### 6.7. Учёба

`sortTopics` (невыполненные выше, срочные выше внутри группы, новые сверху),
`subjectTopics`, `subjectProgress`, `subjectGroups`, `ungroupedTopics`,
`groupTopics`, `filteredTopicsForSubject` (поиск по `title + note`).

---

## 7. UI и навигация

### 7.1. `App.tsx`

```
<ConfirmProvider>
  <div class="app-shell">
    <Shelf />                    — фиксированная полка слева
    <div class="app-main"> <ActiveModule /> </div>
  </div>
  <FooterBar />                  — фиксированная нижняя панель
</ConfirmProvider>
```

- `useEffect` вызывает `load()` один раз; до `loaded` рендерится `null`.
- `ActiveModule()` — switch по `state.mode`, возвращает компонент раздела
  либо заглушку «раздел ещё не перенесён».
- Фон/цвета — из `index.css` (`--ink-faint` и т.п.).

### 7.2. `Shelf.tsx` + `TopBar.tsx`

**`Shelf.tsx`** — единая полка (аналог `#shelf` из старой версии):

- Сверху вертикальный `mode-switch` с иконками: `today → tasks → finance →
  shopping → notes → plants → study` (порядок как в старом `renderShelf()`).
- Разделитель `.shelf-divider`.
- Ниже — «корешки» активного раздела: для `study`/`notes`/`plants`
  отрисовываются списки (`spine` с названием вертикально и счётчиком) и
  кнопка «+». Для `finance`/`shopping`/`tasks` корешков нет — навигация
  внутри основной области.
- «+» открывает общий диалог ввода имени (`useNamePrompt`), а не инлайн-поле.

**`TopBar.tsx`** — общая шапка раздела, вынесена **вне** области скролла:

- Цветная точка (`subject-dot`) — клик меняет цвет (`useCycleColor`).
- Название (`subject-title`) — `contentEditable`, inline-переименование.
- Справа: мета (`subject-progress`) и кнопка удаления (`delete-subject`),
  вызывающая `useConfirm`.
- Используется в `Notes`, `Plants`, `Study`.

### 7.3. `ConfirmDialog.tsx`

- `ConfirmProvider` держит `pending` (подтверждение) и `prompt` (ввод имени),
  отдаёт через Context `confirm(options) => Promise<boolean>` и
  `namePrompt(title, placeholder) => Promise<string | null>`.
- `useConfirm()` / `useNamePrompt()` бросают ошибку вне провайдера.
- Оба диалога используют стиль `.name-editor` из старой версии.

---

## 8. Разделы детально

### 8.1. Сегодня — `Today.tsx`

Дашборд-агрегатор. Показывает 5 виджетов, каждый появляется только при
наличии данных; клик по элементу переключает `mode` на соответствующий раздел.

| Виджет | Источник | Условие показа |
|---|---|---|
| Платежи | `todayPaymentsItems` | есть долги или доходы |
| Дела | `importantOpenTasks` | есть важные незакрытые задачи |
| Пора полить | `plantsNeedingWater` | есть растения |
| Мысли | `importantNotes` | есть важные заметки |
| Хочеца | `topWishes` | есть желания (wish), широкий на 2 колонки |

Справа от заголовка — дневной лимит (`calculateDailyBudget`), красный при
отрицательном значении. Виджет «Платежи»/«Дела» получает класс
`needs-attention` при срочности.

### 8.2. Заметки — `Notes.tsx`

- Полка «корешков» страниц вынесена в общий `Shelf` (вертикальный текст,
  счётчик записей); добавление через «+» (`useNamePrompt`).
- Активная страница — `state.activeNotePageId` (персистентно, переживает F5).
- `TopBar` с названием/цветом/удалением — вне скролла; ниже строка поиска
  (`state.notesSearch`).
- Основная область: форма быстрого добавления (Ctrl+Enter, textarea с
  авто-высотой), список карточек-цитат.
- Карточки редактируются inline через `contentEditable` (`onBlur` →
  `update`), флаг важности (`important`) и удаление с подтверждением.
- Удаление страницы удаляет все её записи.

### 8.3. Финансы — `Finance.tsx`

Три колонки в порядке старой версии: **Обязательные платежи** (`debt`),
**Желаемое** (`wish`), **Доходы** (`income`).

- Заголовок: редактируемая валюта (`contentEditable`, `state.currency`),
  «Осталось оплатить» и «Осталось накопить» (`remainingTotal`).
- Дебеты/желания: быстрое добавление (название, сумма, для долга — срок),
  строка ledger с inline-редактированием суммы/названия, поле «оплачено/
  накоплено» и прогресс-бар, штамп закрытия (SVG).
- Доходы: дата + сумма; строки сортируются по дате поступления.
- Пустые колонки — `.empty-state` с заголовком `.display`.

### 8.4. Покупки — `Shopping.tsx`

Две вкладки: **Нужно купить** и **Архив** (`state.shoppingView` —
персистентно). Заголовок с кикером (`BagIcon`). Быстрое добавление (название +
кол-во), чекбокс «куплено» (`purchasedAt`), удаление. Склонение счётчика
через локальный `countLabel`. Архив группируется по датам покупки
(`ArchiveGroups`), с датой в строке.

### 8.5. Полив — `Plants.tsx`

- Полка растений вынесена в общий `Shelf` + активное растение
  (`state.activePlantId`, персистентно).
- `TopBar`: последний полив (`daysAgoLabel` с иконкой-каплей), удаление
  растения (каскадно удаляет `waterings`).
- Быстрое добавление полива: дата, вода (л), pH, удобрения TriPart
  (Micro/Grow/Bloom/Ripen), заметка.
- Строка полива: inline-редактирование даты/воды/pH, разворачиваемые
  удобрения, заметка, удаление.
- Поиск по журналу (`state.plantsSearch`).

### 8.6. Задачи — `Tasks.tsx`

- Вкладки проектов (`taskProjects`) + «+ проект» (через `useNamePrompt`).
- Заголовок с кикером (`ChecklistIcon`): прогресс `done / total`.
- Внутри проекта: форма добавления шага с флагом «важно», фильтры
  **Открытые / Готовые**, список с чекбоксом, флагом важности, удалением.
- Активный проект — `state.activeTaskProjectId`, фильтр — `state.tasksView`
  (оба персистентны).

### 8.7. Учёба — `Study.tsx` + `DetailDrawer.tsx`

- Полка предметов вынесена в общий `Shelf` с прогрессом `done/total`.
- `TopBar`: прогресс-полоска `.tick` (`subjectProgress`), удаление предмета.
- Внутри предмета: поиск (`state.studySearch`), группы тем
  (`TopicGroupSection`) в виде `.group-pill`, секция «Общее» (ungrouped,
  переименовывается через `subject.ungroupedName`), быстрое добавление тем,
  сворачивание групп, перекрашивание групп, удаление группы (темы переезжают
  в «Общее»).
- Карточка темы (`.card`): SVG-штамп «выучено», флаг срочности (иконка),
  превью разбора, клик открывает `DetailDrawer`.
- **DetailDrawer**: breadcrumb, inline-редактирование заголовка, статусы
  «Выучено»/«Срочно» (с SVG-иконками), поля «Зачем это нужно» и «Разбор и
  материал», список ссылок (нормализация URL до `https://`),
  добавление/удаление ссылок, удаление темы.

---

## 9. Резервное копирование — `backup.ts`

- **Формат** — тот же снимок, что делал `snapshotState()` в старом `app.js`,
  плюс поле `exportedAt: ISO string`. Старые бэкапы читаются без миграции.
- `exportBackup(state)` — `JSON.stringify({ ...state, exportedAt }, null, 2)`.
  Менять не нужно при добавлении полей — spread подхватит автоматически.
- `importBackup(raw)` — парсит JSON, подставляет недостающие поля из
  `createEmptyState()`, валидирует `mode` по белому списку, нормализует
  `shoppingView`/`tasksView`, восстанавливает `onboarding`:
  - если `onboarding.active` — boolean, берётся как есть;
  - иначе — `{ active: false, scene: 'done' }` (импорт = данные уже есть);
  - если `onboarding` отсутствует **и** пользовательских данных нет —
    `{ active: true, scene: 'birth' }`.
- `BackupBar.tsx` (`FooterBar`) — fixed-панель внизу:
  - слева индикатор сохранения (`saveStatus`) + «повторить» при ошибке;
  - **экспорт** → Blob + `<a download="konspekt-backup-YYYY-MM-DD.json">`;
  - **импорт** → FileReader + `useConfirm` о необратимости + `importState`;
  - **очистить все данные** → `useConfirm` + `importState(createEmptyState())`.

### 9.1. Тесты (`backup.test.ts`)

- Импорт реального сэмпла старого vanilla-экспорта.
- Заполнение отсутствующих полей дефолтами (не бросает).
- Round-trip `export(new) → import(new)` сохраняет данные.

---

## 10. Известные расхождения и технический долг

### 10.1. `AGENT_PLAYBOOK.md` устарел

Документ описывает **целевую** архитектуру, которой в коде ещё нет:

- Файла `src/app/Sidebar.tsx` нет как отдельного имени, но его роль теперь
  выполняет `src/app/Shelf.tsx` (иконки режимов + корешки, с `src/ui/icons.tsx`).
- Функции `useSpineConfig()` нет; «корешки» (shelf) централизованы в `Shelf.tsx`.
- Тип `AppMode` в `types.ts` — **без** `'habits'`.
- В `App.tsx` нет ветки `habits`.
- Режим `onboarding` в React не реализован.

> `withActiveIdFallbacks()` и правило «активное — в `AppState`» **уже
> реализованы** (см. §10.2).

### 10.2. Активный элемент хранится в `AppState` ✅

Правило «персистентное — только в `AppState`» реализовано для всех
разделов с выбором элемента и под-вкладок:

- `Notes` → `state.activeNotePageId`.
- `Plants` → `state.activePlantId`.
- `Tasks` → `state.activeTaskProjectId` + `state.tasksView`.
- `Study` → `state.activeSubjectId`.
- `Shopping` → `state.shoppingView`.

В компонентах больше нет дублирующих `useState` под эти значения.

**Фолбэки (`store.ts`).** Экспортируемая функция `withActiveIdFallbacks(s)`
вызывается при `load()`, `update()` и `importState()`. Для каждого из
четырёх списков (subjects, notePages, plants, taskProjects) она:

- оставляет `activeXId`, если он ссылается на существующий элемент;
- иначе подставляет первый элемент списка;
- для пустого списка даёт `null`.

Это устраняет и «пустой» выбор при первом запуске, и «висящий» id после
удаления активного элемента. Тесты — `src/core/store.test.ts`.

### 10.3. Прочее

- `--debt` / `--wish` объявлены в `index.css` наравне со старым `styles.css`.
- `sw.js` / `manifest.json` в React-версии отсутствуют (PWA не вынесен).
- Шрифты `Inter`, `Fraunces`, `JetBrains Mono` нигде не подключаются —
  используются имена без загрузки (наследие от старой версии).
- Линтер `oxlint` в скрипте `lint`, но тесты запускаются только отдельной
  командой `npx vitest run`.

### 10.4. Дизайн-паритет со старой версией ✅

Вёрстка React-версии приведена к vanilla-версии (`Old Version/AppLastVer`):

- Единая полка `Shelf` с иконками режимов и корешками (как `#shelf`).
- Заголовки разделов вынесены в `TopBar` **вне** скролла: цветная точка со
  сменой цвета, inline-переименование, мета, кнопка удаления.
- Карточки тем (`Study`) — старый `.card` со «штампом» (SVG с анимацией),
  группами-«таблетками», флагом-иконкой.
- Quote-карточки заметок, ledger-строки финансов, watering-строки — стили
  и разметка как в `styles.css`.
- Финансы: порядок колонок «Обязательные / Желаемое / Доходы», редактируемое
  поле валюты.
- Покупки: кикер с иконкой, группировка архива по датам покупки.
- Диалоги и ввод имени — общий стиль `.name-editor` (как `openNamePrompt`).
- Общие стили (`stamp`, `card`, `group-pill`, `empty-state`, `welcome`,
  `spine`) живут в `src/index.css`.

---

## 11. Целевые показатели качества

### 11.1. Чек-лист перед сдачей

```bash
npm run build      # без ошибок TypeScript
npx vitest run     # все тесты зелёные
npm run lint       # без ошибок oxlint
npm run dev        # ручная проверка
```

- [ ] Вкладка переключается и отображается корректно.
- [ ] Данные переживают перезагрузку (F5).
- [ ] Удаление запрашивает подтверждение (кроме списка покупок/задач, где
      удаление мгновенное — это осознанно).
- [ ] Экспорт → импорт не теряет данные.
- [ ] Мобильная ширина (<720px) не ломает раскладку.

### 11.2. Правила добавления нового раздела

1. Добавить интерфейсы и поля в `AppState` + `createEmptyState()`.
2. Добавить `mode` в `AppMode`.
3. Чистую логику — в `selectors.ts` + тест в `selectors.test.ts`.
4. Создать `modules/<name>/<Name>.tsx` + `<name>.css` с префиксом классов.
5. Обновить `importBackup()` в `backup.ts`.
6. Зарегистрировать в `ActiveModule()` в `App.tsx` и в `MODE_BUTTONS` в
   `Shelf.tsx`.
7. Прогнать `npm run build` и `npx vitest run` **до** дальнейших правок.

---

## 12. Публикация (GitHub Pages)

Приложение публикуется как статический сайт на GitHub Pages через
GitHub Actions. Бэкенда нет — вся логика и данные (`localStorage`) работают
в браузере, поэтому Pages подходит без изменений кода.

### 12.1. Настройка

- **Репозиторий:** `MihanWolf/Pizdasker` (project page).
- **Адрес сайта:** `https://mihanwolf.github.io/Pizdasker/`.
- **База сборки:** в `konspekt-app/vite.config.ts` задано
  `base: '/Pizdasker/'`. Это обязательно для project page — без `base`
  ассеты ссылаются на `/assets/...` и сайт открывается пустым.
  **При переименовании репозитория обновить `base` соответственно.**

### 12.2. Workflow

Файл `.github/workflows/deploy.yml`:

1. Триггер — `push` в `main` (и ручной `workflow_dispatch`).
2. `npm ci` и `npm run build` в `konspekt-app/`.
3. Артефакт `konspekt-app/dist` публикуется через `actions/deploy-pages`.

**Автодеплой:** любой коммит в `main` автоматически пересобирает и
обновляет сайт (1–3 минуты). Отдельно ничего запускать не нужно. Пуш в
другие ветки на сайт не влияет. Ошибочная сборка не публикуется — на сайте
остаётся предыдущая рабочая версия.

### 12.3. Первичная настройка (один раз)

В GitHub: **Settings → Pages → Source → GitHub Actions**. После этого
достаточно пушить в `main`.

### 12.4. Локальная проверка production-сборки

```bash
cd konspekt-app
npm run build
npm run preview   # открыть указанный URL (с учётом base)
```

---

## 13. Соглашения по стилю

- **CSS-переменные** (`index.css`): `--paper`, `--card`, `--ink`,
  `--ink-soft`, `--ink-faint`, `--rule`, `--shadow`, `--teal`, `--rust`,
  `--plum`, `--mustard`, `--slate`, `--forest`, `--urgent`.
- **Шрифты по назначению:** заголовки — `'Fraunces', serif` (обычно
  `font-style: italic; font-weight: 600`), технические подписи и цифры —
  `'JetBrains Mono', monospace` / `monospace`, основной текст — `Inter`.
- **Префикс классов модуля** (`.notes-*`, `.plants-*`, `.task-*`) — во
  избежание конфликтов, т.к. CSS глобальный.
- **Анимации входа** новых динамических элементов
  (`.quote-card-enter`, `.watering-row-enter`, `.task-row-enter` и т.п.).
- **Иконки** — inline SVG, `stroke="currentColor"`, `viewBox="0 0 24 24"`.
- **Без комментариев в коде** — за исключением поясняющих комментариев к
  неочевидной логике (в проекте встречаются, стиль допускает).
- **Иммутабельность снаружи:** внутри `update(draft => ...)` мутации
  допустимы (`push`, `filter`, присваивание) — стор сам клонирует.