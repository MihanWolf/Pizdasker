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
}

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
  activePlantId: string | null;
  plantsSearch: string;

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
    activePlantId: null,
    plantsSearch: '',
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
