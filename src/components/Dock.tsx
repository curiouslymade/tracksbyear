import type { ReactNode } from 'react';
import { CalendarIcon, MoonIcon, PieChartIcon, PlusIcon, SearchIcon, SettingsIcon, ShareIcon, SunIcon, ZoomInIcon, ZoomOutIcon } from './Icons';

type DockItem = 'add' | 'periods' | 'stats' | 'search' | 'share' | 'settings';

const ITEMS: { kind: DockItem; label: string; name: string; icon: ReactNode }[] = [
  { kind: 'add', label: 'Add', name: 'Add a song', icon: <PlusIcon /> },
  { kind: 'periods', label: 'Periods', name: 'Life periods', icon: <CalendarIcon /> },
  { kind: 'stats', label: 'Breakdown', name: 'Breakdown', icon: <PieChartIcon /> },
  { kind: 'search', label: 'Search', name: 'Search the timeline', icon: <SearchIcon /> },
  { kind: 'share', label: 'Share', name: 'Share', icon: <ShareIcon /> },
  { kind: 'settings', label: 'Settings', name: 'Settings', icon: <SettingsIcon /> },
];

/**
 * The floating bar at the bottom centre of the page. "Add a song" is the main action.
 * The zoom buttons and the sun or moon button sit before Settings.
 */
export function Dock({
  current,
  onOpen,
  theme,
  onToggleTheme,
  only,
  zoom,
}: {
  current?: string;
  onOpen: (kind: DockItem) => void;
  theme: 'day' | 'night';
  onToggleTheme: () => void;
  /** Show only these buttons, for example in a shared timeline. */
  only?: DockItem[];
  /** The zoom buttons. Left out when there is no timeline to zoom. */
  zoom?: { canOut: boolean; canIn: boolean; onZoom: (delta: -1 | 1) => void };
}) {
  const toDark = theme === 'day';
  const themeButton = (
    <button
      key="theme"
      className="dock__btn"
      aria-label={toDark ? 'Switch to dark mode' : 'Switch to light mode'}
      title={toDark ? 'Dark mode' : 'Light mode'}
      onClick={onToggleTheme}
    >
      <span className="dock__icon">{toDark ? <MoonIcon /> : <SunIcon />}</span>
      <span className="dock__label" aria-hidden="true">
        {toDark ? 'Dark' : 'Light'}
      </span>
    </button>
  );
  const zoomGroup = zoom && (
    <div key="zoom" className="dock__zoom" role="group" aria-label="Zoom the timeline">
      <span className="dock__zoom-btns">
        <button className="dock__zoom-btn" aria-label="Zoom out" title="Zoom out" disabled={!zoom.canOut} onClick={() => zoom.onZoom(-1)}>
          <ZoomOutIcon />
        </button>
        <button className="dock__zoom-btn" aria-label="Zoom in" title="Zoom in" disabled={!zoom.canIn} onClick={() => zoom.onZoom(1)}>
          <ZoomInIcon />
        </button>
      </span>
      <span className="dock__label" aria-hidden="true">
        Zoom
      </span>
    </div>
  );
  const shown = ITEMS.filter((item) => !only || only.includes(item.kind));
  return (
    <nav className="dock" aria-label="Main">
      {shown.map((item) => [
        item.kind === 'settings' ? [zoomGroup, themeButton] : null,
        <button
          key={item.kind}
          className={`dock__btn${item.kind === 'add' ? ' dock__btn--primary' : ''}${item.kind === 'stats' ? ' dock__btn--long' : ''}`}
          aria-label={item.name}
          aria-pressed={current === item.kind}
          title={item.name}
          onClick={() => onOpen(item.kind)}
        >
          <span className="dock__icon">{item.icon}</span>
          <span className="dock__label" aria-hidden="true">
            {item.label}
          </span>
        </button>,
      ])}
      {!shown.some((item) => item.kind === 'settings') && [zoomGroup, themeButton]}
    </nav>
  );
}
