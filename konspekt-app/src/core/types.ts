// Домен приложения. Формы объектов повторяют текущий state из shared.js,
// чтобы существующие экспортированные бэкапы (JSON) можно было импортировать без миграции.

export type ColorName = 'teal' | 'rust' | 'plum' | 'mustard' | 'slate' | 'forest';

export interface Subject {
  id: string;
  name: string;
  color: ColorName;
  ungroupedName?: string;
  createdAt: number;
}

export interface TopicGroup {
  id: string;
  subjectId: string;
  name: string;
  color?: ColorName;
  createdAt: number;
}

export interface TopicLink {
  id: string;
  url: string;
  label?: string;
}

export interface Topic {
  id: string;
  subjectId: string;
  groupId: string | null;
  title: string;
  note: string;
  why: string;
  links: TopicLink[];
  done: boolean;
  urgent: boolean;
  createdAt: number;
}

export interface NotePage {
  id: string;
  name: string;
  color: ColorName;
  createdAt: number;
}

export interface NoteEntry {
  id: string;
  pageId: string;
  content: string;
  source: string;
  important: boolean;
  createdAt: number;
}

export type FinanceItemType = 'debt' | 'wish' | 'income';

export interface FinanceItem {
  id: string;
  type: FinanceItemType;
  title: string;
  amount: number;
  progress?: number;
  dueDate?: string;
  incomeDate?: string;
  confirmed?: boolean;
  done?: boolean;
  createdAt: number;
}

export type FinanceOperationKind = 'income' | 'expense' | 'adjustment';

export interface FinanceOperation {
  id: string;
  kind: FinanceOperationKind;
  title: string;
  amount: number;
  date: string;
  note?: string;
  createdAt: number;
}

export interface Plant {
  id: string;
  name: string;
  color: ColorName;
  createdAt: number;
  archivedAt?: number;
}

export type PlantsView = 'watering' | 'library' | 'climate' | 'gallery' | 'archive';
export type PlantsArchiveSort = 'archived' | 'name' | 'age';
export type PlantProblemCategory = 'deficit' | 'excess' | 'pest' | 'mechanical';
export type PlantProblemCategoryFilter = PlantProblemCategory | 'all';

export interface PlantProblem {
  id: string;
  title: string;
  description: string;
  category: PlantProblemCategory;
  cause: string;
  signs: string;
  correction: string;
  photoIds: string[];
  isDemo: boolean;
  createdAt: number;
  updatedAt: number;
}

export function createDemoPlantProblems(): PlantProblem[] {
  const createdAt = Date.now();
  return [
    {
      id: uid(),
      title: 'Пример карточки: проблема листа',
      description: 'Кратко опишите конкретную проблему, например дефицит определённого элемента.',
      category: 'deficit',
      cause: 'Демо-текст. Добавьте сюда сведения о причине проблемы.',
      signs: 'Демо-текст. Опишите, как проблема проявляется на листьях.',
      correction: 'Демо-текст. Укажите, что следует проверить или скорректировать.',
      photoIds: [],
      isDemo: true,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: uid(),
      title: 'Пример карточки: условия ухода',
      description: 'Кратко опишите, что именно происходит с растением.',
      category: 'mechanical',
      cause: 'Демо-текст. Замените его конкретной информацией.',
      signs: 'Демо-текст. Добавьте характерные визуальные признаки.',
      correction: 'Демо-текст. Добавьте проверенные шаги корректировки.',
      photoIds: [],
      isDemo: true,
      createdAt: createdAt + 1,
      updatedAt: createdAt + 1,
    },
  ];
}

export function normalizePlantProblems(raw: unknown): PlantProblem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item): PlantProblem[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const value = item as Partial<PlantProblem>;
    if (typeof value.id !== 'string' || typeof value.title !== 'string') return [];
    const createdAt = typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) ? value.createdAt : Date.now();
    return [{
      id: value.id,
      title: value.title,
      description: typeof value.description === 'string' ? value.description : '',
      category: value.category === 'deficit' || value.category === 'excess' || value.category === 'pest' || value.category === 'mechanical'
        ? value.category
        : 'deficit',
      cause: typeof value.cause === 'string' ? value.cause : '',
      signs: typeof value.signs === 'string' ? value.signs : '',
      correction: typeof value.correction === 'string' ? value.correction : '',
      photoIds: Array.isArray(value.photoIds) ? value.photoIds.filter((id): id is string => typeof id === 'string') : [],
      isDemo: value.isDemo === true,
      createdAt,
      updatedAt: typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt) ? value.updatedAt : createdAt,
    }];
  });
}

export type PlantStage = 'Росток' | 'Вегетация' | 'Предцвет' | 'Цветение';

export const PLANT_STAGES: PlantStage[] = ['Росток', 'Вегетация', 'Предцвет', 'Цветение'];

export interface FertAmounts {
  micro: number | null;
  grow: number | null;
  bloom: number | null;
  ripen: number | null;
}

export interface Watering {
  id: string;
  plantId: string;
  date: string;
  water: number | null;
  ph: number | null;
  ppm?: number | null;
  fert: FertAmounts;
  note: string;
  stage?: PlantStage;
  photoIds?: string[];
  createdAt: number;
}

export interface EnvironmentReading {
  id: string;
  recordedAt: string;
  temperature: number;
  humidity: number;
  createdAt: number;
}

export interface ShoppingItem {
  id: string;
  title: string;
  quantity: string;
  createdAt: number;
  purchasedAt: number | null;
}

export interface TaskProject {
  id: string;
  name: string;
  color: ColorName;
  createdAt: number;
}

export interface TaskItem {
  id: string;
  projectId: string;
  title: string;
  important: boolean;
  done: boolean;
  dueDate?: string;
  note?: string;
  createdAt: number;
  completedAt: number | null;
}

export type AppMode = 'today' | 'notes' | 'finance' | 'plants' | 'shopping' | 'tasks' | 'study' | 'settings';

export const APP_MODES: AppMode[] = ['today', 'finance', 'tasks', 'shopping', 'notes', 'plants', 'study', 'settings'];

// «Сегодня» и «Настройки» скрывать нельзя: первая — дом, вторая — вход в настройки.
export const HIDEABLE_MODES: AppMode[] = ['finance', 'tasks', 'shopping', 'notes', 'plants', 'study'];

export interface FinanceAdvanced {
  enabled: boolean;
}

export interface AppSettings {
  hiddenModes: AppMode[];
  financeAdvanced: FinanceAdvanced;
}

export function defaultSettings(): AppSettings {
  return { hiddenModes: [], financeAdvanced: { enabled: false } };
}

// Приводит произвольные (в т.ч. из старого бэкапа) настройки к корректному виду.
export function normalizeSettings(raw: unknown): AppSettings {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppSettings>;
  const hidden = Array.isArray(r.hiddenModes)
    ? r.hiddenModes.filter((m): m is AppMode => HIDEABLE_MODES.includes(m as AppMode))
    : base.hiddenModes;
  return {
    hiddenModes: Array.from(new Set(hidden)),
    financeAdvanced: {
      enabled: typeof r.financeAdvanced?.enabled === 'boolean' ? r.financeAdvanced.enabled : false,
    },
  };
}

export interface OnboardingState {
  active: boolean;
  scene: string;
}

// Полный снимок состояния — 1:1 с тем, что сериализует текущий storage.js / app.js (snapshotState).
export interface AppState {
  mode: AppMode;

  subjects: Subject[];
  groups: TopicGroup[];
  topics: Topic[];
  activeSubjectId: string | null;
  studySearch: string;

  notePages: NotePage[];
  noteEntries: NoteEntry[];
  activeNotePageId: string | null;
  notesSearch: string;

  financeItems: FinanceItem[];
  financeOperations: FinanceOperation[];
  currency: string;
  balance: number;

  plants: Plant[];
  waterings: Watering[];
  environmentReadings: EnvironmentReading[];
  activePlantId: string | null;
  plantsSearch: string;
  plantsView: PlantsView;
  plantsArchiveSort: PlantsArchiveSort;
  plantProblems: PlantProblem[];
  plantProblemsSearch: string;
  plantProblemsCategory: PlantProblemCategoryFilter;

  shoppingItems: ShoppingItem[];
  shoppingView: 'current' | 'archive';

  taskProjects: TaskProject[];
  taskItems: TaskItem[];
  activeTaskProjectId: string | null;
  tasksView: 'current' | 'archive';

  settings: AppSettings;

  onboarding: OnboardingState;
}

export const PALETTE: ColorName[] = ['teal', 'rust', 'plum', 'mustard', 'slate', 'forest'];

export const COLOR_VARS: Record<ColorName, string> = {
  teal: '#2F7775',
  rust: '#B9552A',
  plum: '#724B8D',
  mustard: '#AA7905',
  slate: '#435D87',
  forest: '#3F784A',
};

export function createEmptyState(): AppState {
  return {
    mode: 'today',
    subjects: [],
    groups: [],
    topics: [],
    activeSubjectId: null,
    studySearch: '',
    notePages: [],
    noteEntries: [],
    activeNotePageId: null,
    notesSearch: '',
    financeItems: [],
    financeOperations: [],
    currency: '₽',
    balance: 0,
    plants: [],
    waterings: [],
    environmentReadings: [],
    activePlantId: null,
    plantsSearch: '',
    plantsView: 'watering',
    plantsArchiveSort: 'archived',
    plantProblems: [],
    plantProblemsSearch: '',
    plantProblemsCategory: 'all',
    shoppingItems: [],
    shoppingView: 'current',
    taskProjects: [],
    taskItems: [],
    activeTaskProjectId: null,
    tasksView: 'current',
    settings: defaultSettings(),
    onboarding: { active: true, scene: 'birth' },
  };
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
