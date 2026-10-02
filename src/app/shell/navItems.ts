import {
  CalendarDays,
  ChartColumn,
  Clapperboard,
  Image,
  LayoutDashboard,
  Lightbulb,
  Palette,
  Settings,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { de } from '@/i18n/de';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

/** Main sections in navigation order; hardware keys 1–8 open them (see Shell). */
export const MAIN_NAV_ITEMS: readonly NavItem[] = [
  { to: '/start', label: de.nav.start, icon: LayoutDashboard },
  { to: '/videos', label: de.nav.videos, icon: Clapperboard },
  { to: '/covers', label: de.nav.covers, icon: Image },
  { to: '/stats', label: de.nav.stats, icon: ChartColumn },
  { to: '/plan', label: de.nav.plan, icon: CalendarDays },
  { to: '/ideas', label: de.nav.ideas, icon: Lightbulb },
  { to: '/brand', label: de.nav.brand, icon: Palette },
  { to: '/settings', label: de.nav.settings, icon: Settings },
];

export function navItems(devMode: boolean): NavItem[] {
  const items = [...MAIN_NAV_ITEMS];
  if (devMode) items.push({ to: '/dev/ui', label: de.nav.dev, icon: Wrench });
  return items;
}
