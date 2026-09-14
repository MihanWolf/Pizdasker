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
| `src/app/ModeSwitch.tsx` | Вертикальная полка вкладок (навигация) |
| `src/app/sidebar.css` | Стили полки вкладок |
| `src/ui/ConfirmDialog.tsx` | `ConfirmProvider` + хук `useConfirm()` |
| `src/ui/confirm-dialog.css` | Стили диалога подтверждения |
| `src/modules/<name>/<Name>.tsx` | Компонент раздела |
| `src/modules/<name>/<name>.css` | Стили раздела |
| `src/modules/BackupBar.tsx` | Фиксированные кнопки экспорта/импорта |
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

  notePages: NotePage[];
  noteEntries: NoteEntry[];
  activeNotePageId: string | null;

  financeItems: FinanceItem[];
  currency: string;                       // по умолчанию '₽'

  plants: Plant[];
  waterings: Watering[];
  activePlantId: string | null;

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
(ближайший будущий доход − остаток обязательных платежей до даты дохода)
──────────────────────────────────────────────────────────────────────────
                    дни до даты дохода (минимум 1)
```

- Ближайший доход: `type='income'`, `incomeDate >= сегодня`, сортировка по
  дате, затем по `createdAt` (при равенстве — более новый).
- Расходы: `type='debt'`, `done=false`, `dueDate` в диапазоне
  `[сегодня, incomeDate]`; остаток = `max(0, amount − progress)`.
- Возвращает `{ displayValue: Math.abs(raw), isNegative: raw < 0 }`.

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
  <ModeSwitch />                 — фиксированная полка слева
  <div flex:1 scroll> <ActiveModule /> </div>
  <statusLine fixed bottom-left> saveStatus.text
  <BackupBar />                  — fixed bottom-right
</ConfirmProvider>
```

- `useEffect` вызывает `load()` один раз; до `loaded` рендерится `null`.
- `ActiveModule()` — switch по `state.mode`, возвращает компонент раздела
  либо заглушку «раздел ещё не перенесён».
- Фон/цвета — из `index.css` (`--ink-faint` и т.п.).

### 7.2. `ModeSwitch.tsx`

Массив `MODE_LABELS` — порядок кнопок:

```ts
today → tasks → finance → shopping → notes → plants → study
```

Каждая кнопка: активная подсвечивается классом `.active`; флаг `ready`
управляет `disabled`/`.pending`. Клик → `update(draft => { draft.mode = mode })`.

### 7.3. `ConfirmDialog.tsx`

- `ConfirmProvider` держит `pending: PendingConfirm | null` и отдаёт через
  Context функцию `confirm(options) => Promise<boolean>`.
- `useConfirm()` бросает ошибку вне провайдера.
- Диалог: оверлей + бокс, кнопки «Отмена» / `confirmLabel`.

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

- Левая полка «корешков» страниц (`notePages`), вертикальный текст, счётчик
  записей; добавление через «+» (инлайн-инпут).
- Активная страница — `state.activeNotePageId` (персистентно, переживает F5).
- Основная область: заголовок, поиск, форма быстрого добавления
  (Ctrl+Enter), список карточек-цитат.
- Карточки редактируются inline через `contentEditable` (`onBlur` →
  `update`), флаг важности (`important`) и удаление с подтверждением.
- Удаление страницы удаляет все её записи.

### 8.3. Финансы — `Finance.tsx`

Три колонки: **Обязательные платежи** (`debt`), **Доходы** (`income`),
**Желаемое** (`wish`).

- Заголовок: «Осталось оплатить» и «Осталось накопить» (`remainingTotal`).
- Дебеты/желания: быстрое добавление (название, сумма, для долга — срок),
  строка ledger с inline-редактированием суммы/названия, поле «оплачено/
  накоплено» и прогресс-бар, чекбокс закрытия.
- Доходы: дата + сумма; строки сортируются по дате поступления.
- Валюта берётся из `state.currency`.

### 8.4. Покупки — `Shopping.tsx`

Две вкладки: **Нужно купить** и **Архив** (`state.shoppingView` —
персистентно). Быстрое добавление (название +
кол-во), чекбокс «куплено» (`purchasedAt`), удаление. Склонение счётчика
через локальный `countLabel`.

### 8.5. Полив — `Plants.tsx`

- Полка растений (корешки) + активное растение (`state.activePlantId`,
  персистентно).
- Верхняя строка: последний полив (`daysAgoLabel`), удаление растения
  (каскадно удаляет `waterings`).
- Быстрое добавление полива: дата, вода (л), pH, удобрения TriPart
  (Micro/Grow/Bloom/Ripen), заметка.
- Строка полива: inline-редактирование даты/воды/pH, разворачиваемые
  удобрения, заметка, удаление.
- Поиск по журналу.

### 8.6. Задачи — `Tasks.tsx`

- Вкладки проектов (`taskProjects`) + «+ проект».
- Заголовок: прогресс `done / total`.
- Внутри проекта: форма добавления шага с флагом «важно», фильтры
  **Открытые / Готовые**, список с чекбоксом, флагом важности, удалением.
- Активный проект — `state.activeTaskProjectId`, фильтр — `state.tasksView`
  (оба персистентны).

### 8.7. Учёба — `Study.tsx` + `DetailDrawer.tsx`

- Полка предметов (`subjects`) с прогрессом `done/total`.
- Внутри предмета: поиск (по темам и разборам), группы тем
  (`TopicGroupSection`), секция «Общее» (ungrouped, переименовывается через
  `subject.ungroupedName`), быстрое добавление тем, сворачивание групп,
  перекрашивание групп, удаление группы (темы переезжают в «Общее»).
- Карточка темы: чекбокс «выучено», флаг срочности, превью разбора, клик
  открывает `DetailDrawer`.
- **DetailDrawer**: breadcrumb, inline-редактирование заголовка, статусы
  «Выучено»/«Срочно», поля «Зачем это нужно» и «Разбор и материал», список
  ссылок (нормализация URL до `https://`), добавление/удаление ссылок,
  удаление темы.

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
- `BackupBar.tsx` — fixed-кнопки внизу справа:
  - **экспорт** → Blob + `<a download="konspekt-backup-YYYY-MM-DD.json">`;
  - **импорт** → FileReader + `window.confirm` о необратимости + `importState`.

### 9.1. Тесты (`backup.test.ts`)

- Импорт реального сэмпла старого vanilla-экспорта.
- Заполнение отсутствующих полей дефолтами (не бросает).
- Round-trip `export(new) → import(new)` сохраняет данные.

---

## 10. Известные расхождения и технический долг

### 10.1. `AGENT_PLAYBOOK.md` устарел

Документ описывает **целевую** архитектуру, которой в коде ещё нет:

- Файла `src/app/Sidebar.tsx` нет — есть `src/app/ModeSwitch.tsx` без иконок.
- Файла `src/ui/icons.tsx` нет.
- Функции `useSpineConfig()` нет; «корешки» (shelf) рисуются внутри
  каждого модуля (`Notes`, `Plants`, `Tasks`, `Study`), а не в общем Sidebar.
- Тип `AppMode` в `types.ts` — **без** `'habits'`.
- В `App.tsx` нет ветки `habits`.
- Режим `onboarding` в React не реализован.

> `withActiveIdFallbacks()` и правило «активное — в `AppState`» **уже
> реализованы** (см. §10.2). Это единственное расхождение из списка,
> которое устранено.

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

- `--debt` / `--wish` используются через fallback (`var(--debt, #AB3D33)`),
  но в `index.css` не объявлены (есть в старом `styles.css`).
- `sw.js` / `manifest.json` в React-версии отсутствуют (PWA не вынесен).
- Шрифты `Inter`, `Fraunces`, `JetBrains Mono` нигде не подключаются —
  используются имена без загрузки (наследие от старой версии).
- Линтер `oxlint` в скрипте `lint`, но тесты запускаются только отдельной
  командой `npx vitest run`.

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
6. Зарегистрировать в `ActiveModule()` в `App.tsx` и в `MODE_LABELS` в
   `ModeSwitch.tsx`.
7. Прогнать `npm run build` и `npx vitest run` **до** дальнейших правок.

---

## 12. Соглашения по стилю

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