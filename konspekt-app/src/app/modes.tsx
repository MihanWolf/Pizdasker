import type { AppMode } from '../core/types';
import { SunIcon, ChecklistIcon, WalletIcon, BagIcon, QuoteIcon, DropletIcon, BookIcon } from '../ui/icons';

// Единый источник правды о разделах: порядок кнопок полки и список
// тумблеров в настройках. «Настройки» сюда не входят — они не скрываемы.
export const NAV_MODES: { mode: AppMode; title: string; icon: React.ReactNode }[] = [
  { mode: 'today', title: 'Главная', icon: <SunIcon /> },
  { mode: 'finance', title: 'Финансы', icon: <WalletIcon /> },
  { mode: 'tasks', title: 'Задачи', icon: <ChecklistIcon /> },
  { mode: 'shopping', title: 'Покупки', icon: <BagIcon /> },
  { mode: 'notes', title: 'Заметки', icon: <QuoteIcon /> },
  { mode: 'plants', title: 'Полив', icon: <DropletIcon /> },
  { mode: 'study', title: 'Учёба', icon: <BookIcon /> },
];