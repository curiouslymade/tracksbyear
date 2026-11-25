import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
} from '@dnd-kit/core';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { setHint } from '../actions';
import { formatDay, formatRange, parsePartialDate, todayUtc } from '../dates';
import type { SongWithEstimate } from '../estimate';
import { genreInfo, NO_GENRE_ACCENT, NO_GENRE_BACKDROP } from '../genres';
import {
  backdropGradient,
  CARD_WIDTH,
  DEFAULT_ZOOM,
  EDGE_PAD,
  genreSegments,
  laneCount,
  lowestZoom,
  makeScale,
  placeMoments,
  placePeriods,
  placeSongs,
  songGenre,
  spreadGuesses,
  type GenreSegment,
  MAX_LANES,
  type PlacedSong,
  type SongBundle,
  type Scale,
  ZOOM_LEVELS,
} from '../road';
import { MOMENTS } from '../moments';
import { MotifPattern, TILE_W } from '../motifs';
import { listenLink, playerName, type Player } from '../listen';
import type { LifePeriod } from '../types';
import { PlayIcon } from './Icons';

const TOP_PAD = 88;
const LANE_H = 96;
const CARD_H = 76;
const STEM_GAP = 20;
const ROAD_H = 24;
const AXIS_H = 32;
// Life periods are lines on the timeline. Each overlapping period sits PERIOD_STEP px lower,
// and its name sits PERIOD_LABEL_H px higher above the line.
const PERIOD_STEP = 6;
const PERIOD_LABEL_H = 18;
const MOMENT_LANE_H = 24;
// Room under the lowest cards for the scroll bar and the floating bar.
const BOTTOM_PAD = 130;

export function Road({
  items,
  periods,
  selectedId,
  showMoments,
  player,
  readOnly = false,
  topClear = 0,
  focus,
  zoom,
  onLowestZoom,
  onSelect,
  onOpenBundle,
}: {
  items: SongWithEstimate[];
  periods: LifePeriod[];
  selectedId?: number;
  showMoments: boolean;
  player: Player;
  /** A shared timeline: no dragging and no song details. */
  readOnly?: boolean;
  /** The height of the headline over the top of the timeline. The era names stay below it. */
  topClear?: number;
  /** A song to show: the timeline scrolls to it and marks it for a moment. `n` repeats a request. */
  focus?: { id: number; n: number; kind?: 'song' | 'period' };
  /** The zoom step: an index into `ZOOM_LEVELS`. */
  zoom: number;
  /** Tells the floating bar the lowest useful zoom step, when the screen width changes. */
  onLowestZoom?: (step: number) => void;
  onSelect: (id: number) => void;
  onOpenBundle: (ids: number[], year: number) => void;
}) {
  const today = useMemo(() => todayUtc(), []);
  // Songs that share one wide guess are spread across it, so they sit side by side.
  const shown = useMemo(() => spreadGuesses(items), [items]);
  const scroller = useRef<HTMLDivElement>(null);
  const viewW = useWidth(scroller);
  const scale = useMemo(() => makeScale(shown, periods, today, ZOOM_LEVELS[zoom], viewW), [shown, periods, today, zoom, viewW]);
  const viewH = useHeight(scroller);
  // Zooming out puts more cards at one place, so the timeline grows taller. Zoom out stops
  // before it needs a scroll down: never taller than the screen, or than at the normal zoom.
  const heights = useMemo(
    () => ZOOM_LEVELS.map((px) => layoutHeight(shown, periods, showMoments, makeScale(shown, periods, today, px, viewW))),
    [shown, periods, showMoments, today, viewW],
  );
  const lowest = useMemo(() => {
    const limit = Math.max(viewH - topClear, heights[DEFAULT_ZOOM]);
    let tall = DEFAULT_ZOOM;
    while (tall > 0 && heights[tall - 1] <= limit) tall--;
    return Math.max(lowestZoom(scale.fitPxPerYear), tall);
  }, [heights, viewH, topClear, scale.fitPxPerYear]);
  useEffect(() => onLowestZoom?.(lowest), [lowest, onLowestZoom]);
  const segments = useMemo(() => genreSegments(shown, scale), [shown, scale]);
  const { placed, bundles } = useMemo(() => placeSongs(shown, scale), [shown, scale]);
  const placedPeriods = useMemo(() => placePeriods(periods, scale), [periods, scale]);
  const placedMoments = useMemo(() => (showMoments ? placeMoments(MOMENTS, scale) : []), [showMoments, scale]);
  const canvas = useRef<HTMLDivElement>(null);
  const [hoverId, setHoverId] = useState<number>();
  const [found, setFound] = useState<number>();
  const [foundPeriod, setFoundPeriod] = useState<number>();
  const [dragYear, setDragYear] = useState<{ id: number; year: number }>();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const aboveLanes = Math.max(1, laneCount(placed, 'above'), bundles.length ? MAX_LANES + 1 : 0);
  const belowLanes = laneCount(placed, 'below');
  const periodLanes = placedPeriods.reduce((n, p) => Math.max(n, p.lane + 1), 0);
  // The content height before centring. The timeline sits in the middle of the screen.
  // Room above the road for the names of the life periods.
  const aboveGap = STEM_GAP + periodLanes * PERIOD_LABEL_H;
  const contentH = contentHeight(aboveLanes, belowLanes, periodLanes, placedMoments);
  const offset = Math.max(topClear, Math.round((viewH - contentH) / 2));
  const roadTop = offset + TOP_PAD + aboveLanes * LANE_H + periodLanes * PERIOD_LABEL_H;
  const momentLanes = placedMoments.reduce((n, m) => Math.max(n, m.lane + 1), 0);
  const linesBelow = Math.max(0, periodLanes - 1) * PERIOD_STEP;
  const momentsTop = roadTop + ROAD_H + linesBelow + AXIS_H;
  const belowTop = momentsTop + momentLanes * MOMENT_LANE_H + (momentLanes ? 8 : 0) + STEM_GAP + 8;
  const height = Math.max(viewH, belowTop + belowLanes * LANE_H + BOTTOM_PAD);

  // A card moves along the road between the start of the timeline and today, never past today.
  const todayX = scale.todayX;
  const firstX = scale.x(new Date(Date.UTC(scale.startYear, 0, 1)));
  const clampDx = (p: PlacedSong, dx: number) => Math.max(firstX - p.x, Math.min(todayX - p.x, dx));
  const yearFor = (p: PlacedSong, dx: number) => Math.floor(scale.yearAt(p.x + clampDx(p, dx)));

  const onDragMove = ({ active, delta }: DragMoveEvent) => {
    const p = placed.find((q) => q.item.song.id === active.id);
    if (p) setDragYear({ id: p.item.song.id!, year: yearFor(p, delta.x) });
  };

  const onDragEnd = ({ active, delta }: DragEndEvent) => {
    setDragYear(undefined);
    const p = placed.find((q) => q.item.song.id === active.id);
    if (!p || Math.abs(delta.x) < PX_THRESHOLD) return;
    // Moving a song along the road means "I first heard it in this year".
    void setHint(p.item.song.id!, { kind: 'year', year: yearFor(p, delta.x) });
  };

  useSmoothScroll(scroller);
  useParallax(scroller, canvas);

  // A zoom keeps the year in the middle of the screen in the middle.
  // The scroll listener remembers that year. A new zoom step scrolls back to it.
  const middleYear = useRef<number>(undefined);
  const scaleRef = useRef(scale);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const remember = () => {
      middleYear.current = scaleRef.current.yearAt(el.scrollLeft + el.clientWidth / 2);
    };
    el.addEventListener('scroll', remember, { passive: true });
    return () => el.removeEventListener('scroll', remember);
  }, []);
  useLayoutEffect(() => {
    const el = scroller.current;
    const zoomed = scaleRef.current.pxPerYear !== scale.pxPerYear;
    scaleRef.current = scale;
    if (!el || !zoomed || middleYear.current === undefined) return;
    el.scrollLeft = xOfYear(scale, middleYear.current) - el.clientWidth / 2;
  }, [scale]);

  // Scroll to a song the search picked. A song in a "+N more" card opens that list.
  useEffect(() => {
    const el = scroller.current;
    if (!focus || !el) return;
    if (focus.kind === 'period') {
      const pp = placedPeriods.find((q) => q.period.id === focus.id);
      if (!pp) return;
      el.scrollTo({ left: Math.max(0, pp.startX - 120), top: Math.max(0, roadTop - el.clientHeight / 2), behavior: 'smooth' });
      setFoundPeriod(focus.id);
      const timer = setTimeout(() => setFoundPeriod(undefined), 2600);
      return () => clearTimeout(timer);
    }
    const p = placed.find((q) => q.item.song.id === focus.id);
    if (!p) {
      const b = bundles.find((q) => q.items.some((i) => i.song.id === focus.id));
      if (b) onOpenBundle(b.items.map((i) => i.song.id!), Math.floor(scale.yearAt(b.x)));
      return;
    }
    const cardTop = p.side === 'above' ? roadTop - aboveGap - CARD_H - p.lane * LANE_H : belowTop + p.lane * LANE_H;
    el.scrollTo({ left: p.x - el.clientWidth / 2, top: Math.max(0, cardTop + CARD_H / 2 - el.clientHeight / 2), behavior: 'smooth' });
    setFound(focus.id);
    const timer = setTimeout(() => setFound(undefined), 2600);
    return () => clearTimeout(timer);
    // Runs once for each request from the search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  const highlighted = placed.find((p) => p.item.song.id === (hoverId ?? selectedId));

  return (
    <div
      className="stage"
      style={
        {
          '--backdrop-day': backdropGradient(segments, scale.width),
          '--backdrop-night': backdropGradient(segments, scale.width, 140, 'accent'),
        } as CSSProperties
      }
    >
      <div className="stage__scroller" ref={scroller} tabIndex={0} aria-label="Timeline. Scroll sideways to move through the years.">
        <DndContext sensors={sensors} onDragMove={onDragMove} onDragEnd={onDragEnd} onDragCancel={() => setDragYear(undefined)}>
          <div className="stage__canvas" ref={canvas} style={{ width: scale.width, height }}>
            <div className="stage__bg" aria-hidden="true">
              <div className="stage__backdrop" />
              <Motifs segments={segments} height={height} drift={scale.width * PARALLAX} />
            </div>

            {segments.map((s, i) => {
              const g = genreInfo(s.genre);
              if (!g || s.endX - s.startX < 300) return null;
              const left = Math.max(s.startX, 0) + (i === 0 ? 72 : 32);
              const from = Math.max(scale.startYear, Math.round(scale.yearAt(s.startX)));
              const to = Math.min(scale.endYear, Math.round(scale.yearAt(s.endX))) - 1;
              return (
                <div key={i} className="era" style={{ left, top: offset + 24 }} aria-hidden="true">
                  <span className="era__name">{g.label}</span>
                  <span className="era__years">{from === to ? from : `${from} to ${to}`}</span>
                </div>
              );
            })}

            <div className="road" style={{ top: roadTop, height: ROAD_H }}>
              <div className="road__line" style={{ right: 'auto', width: todayX }} />
              {placedMoments.map((m) => (
                <span key={m.moment.date} className={`road__moment road__moment--${m.moment.kind}`} style={{ left: m.x }} aria-hidden="true" />
              ))}
            </div>

            {highlighted && (
              <div
                className="road__range"
                style={{
                  top: roadTop + 6,
                  height: ROAD_H - 12,
                  left: scale.x(highlighted.item.estimate.from),
                  width: Math.max(6, scale.x(highlighted.item.estimate.to) - scale.x(highlighted.item.estimate.from)),
                }}
                aria-hidden="true"
              />
            )}

            <Axis scale={scale} top={roadTop + ROAD_H + linesBelow} />

            {todayX < scale.width && (
              <div className="today" style={{ left: todayX, top: roadTop - 18, height: ROAD_H + 36 }}>
                <span>Today</span>
              </div>
            )}

            {placedMoments.map((m) => {
              const when = formatDay(parsePartialDate(m.moment.date)!);
              return (
                <div
                  key={m.moment.date}
                  className={`moment moment--${m.moment.kind}`}
                  style={{ left: m.x, top: momentsTop + m.lane * MOMENT_LANE_H }}
                  title={`${m.moment.label}, ${when}`}
                >
                  <i aria-hidden="true" />
                  {m.moment.label}
                  <span className="visually-hidden">, {when}</span>
                </div>
              );
            })}

            {placedPeriods.map((p, i) => {
              // Each period has its own chart colour, so overlapping periods stay apart.
              const colour = { '--period': `var(--chart-${(i % 6) + 1})` } as CSSProperties;
              const lineY = roadTop + ROAD_H / 2 + p.lane * PERIOD_STEP;
              const label = `${p.period.name}${p.period.place ? `, ${p.period.place}` : ''}`;
              return (
                <div key={p.period.id} title={label}>
                  <div className={`period-line${foundPeriod === p.period.id ? ' period-line--found' : ''}`} style={{ ...colour, left: p.startX, width: Math.max(8, p.endX - p.startX), top: lineY - 2 }} />
                  <div className={`period-name${foundPeriod === p.period.id ? ' period-name--found' : ''}`} style={{ ...colour, left: p.startX, top: roadTop + ROAD_H / 2 - 6 - (p.lane + 1) * PERIOD_LABEL_H }}>
                    {p.period.name}
                    {p.period.place && <span className="period__place"> · {p.period.place}</span>}
                  </div>
                </div>
              );
            })}

            {bundles.map((b) => (
              <BundleMarker
                key={`bundle-${b.items[0].song.id}`}
                bundle={b}
                roadTop={roadTop}
                aboveGap={aboveGap}
                year={Math.floor(scale.yearAt(b.x))}
                onOpen={onOpenBundle}
              />
            ))}

            {placed.map((p) => (
              <SongMarker
                key={p.item.song.id}
                placed={p}
                roadTop={roadTop}
                aboveGap={aboveGap}
                belowTop={belowTop}
                selected={p.item.song.id === selectedId}
                found={p.item.song.id === found}
                dragYear={dragYear && dragYear.id === p.item.song.id ? dragYear.year : undefined}
                player={player}
                readOnly={readOnly}
                clampDx={clampDx}
                onSelect={onSelect}
                onHover={setHoverId}
              />
            ))}
          </div>
        </DndContext>
      </div>
      <ScrollBar scroller={scroller} contentWidth={scale.width} />
    </div>
  );
}

/** The x position of a fractional year, for example 1997.5. */
function xOfYear(scale: Scale, year: number): number {
  return (year - scale.yearAt(0)) * scale.pxPerYear;
}

const PX_THRESHOLD = 12;

/** The height of the timeline content at one scale, as `contentHeight` gives it. */
function layoutHeight(shown: SongWithEstimate[], periods: LifePeriod[], showMoments: boolean, scale: Scale): number {
  const { placed, bundles } = placeSongs(shown, scale);
  const above = Math.max(1, laneCount(placed, 'above'), bundles.length ? MAX_LANES + 1 : 0);
  const periodLanes = placePeriods(periods, scale).reduce((n, p) => Math.max(n, p.lane + 1), 0);
  return contentHeight(above, laneCount(placed, 'below'), periodLanes, showMoments ? placeMoments(MOMENTS, scale) : []);
}

/** The height of the timeline content, from the top padding to the bottom padding. */
function contentHeight(above: number, below: number, periodLanes: number, moments: { lane: number }[]): number {
  const periodSpace = periodLanes * PERIOD_LABEL_H + Math.max(0, periodLanes - 1) * PERIOD_STEP;
  const momentLanes = moments.reduce((n, m) => Math.max(n, m.lane + 1), 0);
  return (
    TOP_PAD + above * LANE_H + ROAD_H + AXIS_H +
    momentLanes * MOMENT_LANE_H + (momentLanes ? 8 : 0) +
    periodSpace + STEM_GAP + 8 + below * LANE_H + BOTTOM_PAD
  );
}

/** The visible width of an element, kept up to date when the window changes size. */
function useWidth(ref: RefObject<HTMLElement | null>): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

/** The background motifs move at this fraction less than the timeline, so they seem further away. */
const PARALLAX = 0.6;

/**
 * Parallax: when the timeline scrolls, the background motifs move more slowly than
 * the road and the cards. The scroll position goes to the `--parallax` CSS variable.
 * The motifs stay inside their genre era. Off when the user asks for reduced motion.
 */
function useParallax(scroller: RefObject<HTMLDivElement | null>, canvas: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = scroller.current;
    const c = canvas.current;
    if (!el || !c || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      c.style.setProperty('--parallax', `${(el.scrollLeft * PARALLAX).toFixed(1)}px`);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
    };
  }, [scroller, canvas]);
}

/** The visible height of an element, kept up to date when the window changes size. */
function useHeight(ref: RefObject<HTMLElement | null>): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, [ref]);
  return h;
}

/**
 * A thin scroll bar above the floating bar. It replaces the browser scroll bar.
 * Drag the thumb, or click the track to jump.
 */
function ScrollBar({ scroller, contentWidth }: { scroller: RefObject<HTMLDivElement | null>; contentWidth: number }) {
  const track = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 0, width: 1, show: false });

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      const width = Math.min(1, el.clientWidth / Math.max(1, el.scrollWidth));
      setPos({ left: max > 0 ? (el.scrollLeft / max) * (1 - width) : 0, width, show: max > 1 });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [scroller, contentWidth]);

  const scrollTo = (clientX: number, grabAt: number) => {
    const el = scroller.current;
    const t = track.current;
    if (!el || !t) return;
    const r = t.getBoundingClientRect();
    const fraction = (clientX - r.left - grabAt) / (r.width * (1 - pos.width) || 1);
    el.scrollLeft = Math.max(0, Math.min(1, fraction)) * (el.scrollWidth - el.clientWidth);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const t = track.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const thumbLeft = r.left + pos.left * r.width;
    const thumbW = pos.width * r.width;
    const onThumb = e.clientX >= thumbLeft && e.clientX <= thumbLeft + thumbW;
    const grabAt = onThumb ? e.clientX - thumbLeft : thumbW / 2;
    scrollTo(e.clientX, grabAt);
    t.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => scrollTo(ev.clientX, grabAt);
    const up = () => {
      t.removeEventListener('pointermove', move);
      t.removeEventListener('pointerup', up);
      t.removeEventListener('pointercancel', up);
    };
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', up);
    t.addEventListener('pointercancel', up);
  };

  if (!pos.show) return null;
  return (
    <div className="scrollbar" ref={track} onPointerDown={onPointerDown} aria-hidden="true">
      <div className="scrollbar__thumb" style={{ left: `${pos.left * 100}%`, width: `${pos.width * 100}%` }} />
    </div>
  );
}

/**
 * Smooth sideways scrolling. A mouse wheel glides the road instead of jumping,
 * and a mouse drag on the background pans it in any direction, with a short glide on release.
 * Trackpads and touch screens keep their own smooth scrolling.
 */
function useSmoothScroll(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let target = 0;
    let current = 0;
    let frame = 0;
    const max = () => el.scrollWidth - el.clientWidth;
    const clamp = (x: number) => Math.max(0, Math.min(max(), x));
    const step = () => {
      const d = target - current;
      if (Math.abs(d) < 0.5) {
        el.scrollLeft = target;
        frame = 0;
        return;
      }
      current += d * 0.16;
      el.scrollLeft = current;
      frame = requestAnimationFrame(step);
    };
    const glideTo = (x: number) => {
      if (!frame) current = el.scrollLeft;
      target = clamp(x);
      if (reduce) {
        el.scrollLeft = target;
        return;
      }
      if (!frame) frame = requestAnimationFrame(step);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      // A trackpad scrolls sideways smoothly by itself.
      if (!e.shiftKey && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      let delta = e.deltaY || e.deltaX;
      if (e.deltaMode === 1) delta *= 16;
      else if (e.deltaMode === 2) delta *= el.clientWidth;
      const from = frame ? target : el.scrollLeft;
      const to = clamp(from + delta * 1.5);
      // At either end of the road, let the page scroll instead.
      if (to === from) return;
      e.preventDefault();
      glideTo(to);
    };

    let pan: { x: number; y: number; scroll: number; top: number; t: number; v: number } | undefined;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if ((e.target as Element).closest('.card, button, a, input')) return;
      stop();
      pan = { x: e.clientX, y: e.clientY, scroll: el.scrollLeft, top: el.scrollTop, t: e.timeStamp, v: 0 };
      el.setPointerCapture(e.pointerId);
      el.classList.add('stage__scroller--panning');
    };
    const onMove = (e: PointerEvent) => {
      if (!pan) return;
      const before = el.scrollLeft;
      el.scrollLeft = pan.scroll - (e.clientX - pan.x);
      // A tall timeline (many cards at one place) also moves up and down.
      el.scrollTop = pan.top - (e.clientY - pan.y);
      const dt = e.timeStamp - pan.t;
      if (dt > 0) pan.v = 0.8 * ((el.scrollLeft - before) / dt) + 0.2 * pan.v;
      pan.t = e.timeStamp;
    };
    const onUp = (e: PointerEvent) => {
      if (!pan) return;
      const { v, t } = pan;
      pan = undefined;
      el.releasePointerCapture(e.pointerId);
      el.classList.remove('stage__scroller--panning');
      // A quick flick keeps the road moving for a moment.
      if (e.timeStamp - t < 80 && Math.abs(v) > 0.2) glideTo(el.scrollLeft + v * 260);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      stop();
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [ref]);
}

/** Faint genre motifs over each era, faded out at the era edges. */
function Motifs({ segments, height, drift }: { segments: GenreSegment[]; height: number; drift: number }) {
  const uid = useId();
  return (
    <>
      {segments.map((s, i) => {
        const g = genreInfo(s.genre);
        if (!g) return null;
        const id = `${uid}-motif-${i}`;
        const width = s.endX - s.startX;
        return (
          <svg
            key={i}
            className="motifs"
            style={{ left: s.startX, '--g-dark': g.backdrop, '--g-light': g.accent } as CSSProperties}
            width={width}
            height={height}
            aria-hidden="true"
          >
            <defs>
              {/* Shift the tile per era, so neighbouring eras do not line up. */}
              <MotifPattern id={id} genre={g.id} offset={(i * 97) % TILE_W} />
            </defs>
            {/* The pattern starts further left than the era, so the parallax shift never shows a gap. */}
            <g className="motifs__drift">
              <rect x={-drift} width={width + drift} height={height} fill={`url(#${id})`} />
            </g>
          </svg>
        );
      })}
    </>
  );
}

function Axis({ scale, top }: { scale: Scale; top: number }) {
  // Zoomed out, a year is too narrow for its label: show every fifth year.
  const step = scale.pxPerYear < 100 ? 5 : 1;
  const years: number[] = [];
  for (let y = scale.startYear; y <= scale.endYear; y++) {
    // Leave out year labels after today. The timeline ends EDGE_PAD after today.
    if (y % step === 0 && scale.x(new Date(Date.UTC(y, 0, 1))) <= scale.width - EDGE_PAD) years.push(y);
  }
  return (
    <div className="axis" style={{ top }} aria-hidden="true">
      {years.map((y) => (
        <span key={y} className="axis__year" style={{ left: scale.x(new Date(Date.UTC(y, 0, 1))) }}>
          {y}
        </span>
      ))}
    </div>
  );
}

function SongMarker({
  placed,
  roadTop,
  aboveGap,
  belowTop,
  selected,
  found,
  dragYear,
  player,
  readOnly,
  clampDx,
  onSelect,
  onHover,
}: {
  placed: PlacedSong;
  roadTop: number;
  aboveGap: number;
  belowTop: number;
  selected: boolean;
  found: boolean;
  dragYear?: number;
  player: Player;
  readOnly: boolean;
  /** Keeps a dragged card between the start of the timeline and today. */
  clampDx: (p: PlacedSong, dx: number) => number;
  onSelect: (id: number) => void;
  onHover: (id: number | undefined) => void;
}) {
  const { item, x, side, lane } = placed;
  const { song, estimate } = item;
  const id = song.id!;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id, disabled: readOnly });
  const dx = transform ? clampDx(placed, transform.x) : 0;
  const genre = genreInfo(songGenre(song));
  // Each theme picks the genre colour with enough contrast: dark on Day, light on Night.
  const colours = { '--g-dark': genre?.backdrop ?? NO_GENRE_BACKDROP, '--g-light': genre?.accent ?? NO_GENRE_ACCENT } as CSSProperties;

  const cardTop = side === 'above' ? roadTop - aboveGap - CARD_H - lane * LANE_H : belowTop + lane * LANE_H;
  const stemTop = side === 'above' ? cardTop + CARD_H : roadTop + ROAD_H / 2;
  const stemBottom = side === 'above' ? roadTop + ROAD_H / 2 : cardTop;

  return (
    <>
      <div
        className={`stem stem--${estimate.label.toLowerCase()}`}
        style={{ left: x + dx, top: stemTop, height: stemBottom - stemTop }}
        aria-hidden="true"
      />
      <div className="marker" style={{ ...colours, left: x + dx, top: roadTop + ROAD_H / 2 }} aria-hidden="true" />
      <div
        ref={setNodeRef}
        className={`card${selected ? ' card--selected' : ''}${found ? ' card--found' : ''}${isDragging ? ' card--dragging' : ''}${readOnly ? ' card--readonly' : ''}`}
        style={{ left: x - CARD_WIDTH / 2, top: cardTop, width: CARD_WIDTH, height: CARD_H, transform: dx ? `translateX(${dx}px)` : undefined, ...colours }}
        onClick={() => !readOnly && onSelect(id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !readOnly) onSelect(id);
        }}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(undefined)}
        {...listeners}
        {...attributes}
        aria-label={`${song.title} by ${song.artist}. Likely first heard ${formatRange(estimate.from, estimate.to)}. ${estimate.label} confidence. Press Enter for details, or Space to move it along the timeline.`}
        aria-describedby={undefined}
      >
        <span className="card__title">{song.title}</span>
        <span className="card__artist">{song.artist}</span>
        <span className="card__when">
          {dragYear !== undefined ? `Heard in ${dragYear}` : formatRange(estimate.from, estimate.to)}
        </span>
        <a
          className="card__play"
          href={listenLink(song, player)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Play ${song.title} in ${playerName(player)}`}
          title={`Play in ${playerName(player)}`}
          // Playing must not start a drag or open the song details.
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <PlayIcon />
        </a>
      </div>
    </>
  );
}

/** A "+N more" card for songs that did not fit in the card rows. It opens a list of them. */
function BundleMarker({
  bundle,
  roadTop,
  aboveGap,
  year,
  onOpen,
}: {
  bundle: SongBundle;
  roadTop: number;
  aboveGap: number;
  year: number;
  onOpen: (ids: number[], year: number) => void;
}) {
  const cardTop = roadTop - aboveGap - CARD_H - bundle.lane * LANE_H;
  const n = bundle.items.length;
  const open = () => onOpen(bundle.items.map((i) => i.song.id!), year);
  return (
    <>
      <div className="stem stem--bundle" style={{ left: bundle.x, top: cardTop + CARD_H, height: roadTop + ROAD_H / 2 - cardTop - CARD_H }} aria-hidden="true" />
      <button
        className="card card--bundle"
        style={{ left: bundle.x - CARD_WIDTH / 2, top: cardTop, width: CARD_WIDTH, height: CARD_H }}
        onClick={open}
        aria-label={`${n} more song${n === 1 ? '' : 's'} around ${year}. Show the list.`}
      >
        <span className="card__title">+{n} more</span>
        <span className="card__artist">around {year}</span>
        <span className="card__when">Show the list</span>
      </button>
    </>
  );
}
