import { useState, useMemo, useEffect, useRef } from 'react';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const handler = () => setMatches(m.matches);
    m.addEventListener('change', handler);
    return () => m.removeEventListener('change', handler);
  }, [query]);
  return matches;
}
import type { TimetableEntry } from '../types/timetable';
import { timetableEntries as entries } from '../utils/parseTimetableCsv';
import { parseLectureTime } from '../utils/parseLectureTime';
import TimetableView from './TimetableView';
import './TimetableSearch.css';

const STORAGE_KEY = 'kw-timetable-storage';

export type Priority = 1 | 2 | 3 | 4 | 5;

interface StoredState {
  cart: TimetableEntry[];
  currentPriority: Priority;
  savedTimetables: Record<Priority, string[]>;
}

const DEFAULT_PRIORITY: Priority = 1;

function loadFromStorage(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { cart: [], currentPriority: DEFAULT_PRIORITY, savedTimetables: defaultSavedTimetables() };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return { cart: [], currentPriority: DEFAULT_PRIORITY, savedTimetables: defaultSavedTimetables() };
    const { cart = [], currentPriority = DEFAULT_PRIORITY, savedTimetables, timetableChecked: legacyChecked } = parsed as Partial<StoredState & { timetableChecked?: string[] }>;
    const validCart = Array.isArray(cart)
      ? cart.filter(
          (e): e is TimetableEntry =>
            e != null &&
            typeof e === 'object' &&
            typeof (e as TimetableEntry).학정번호 === 'string' &&
            typeof (e as TimetableEntry).과목명 === 'string'
        )
      : [];
    const p = [1, 2, 3, 4, 5].includes(Number(currentPriority)) ? (currentPriority as Priority) : DEFAULT_PRIORITY;
    const saved = defaultSavedTimetables();
    if (savedTimetables && typeof savedTimetables === 'object') {
      ([1, 2, 3, 4, 5] as Priority[]).forEach((rank) => {
        const arr = savedTimetables[rank];
        if (Array.isArray(arr)) saved[rank] = arr.filter((k): k is string => typeof k === 'string');
      });
    } else if (Array.isArray(legacyChecked)) {
      saved[1] = legacyChecked.filter((k): k is string => typeof k === 'string');
    }
    return { cart: validCart, currentPriority: p, savedTimetables: saved };
  } catch {
    return { cart: [], currentPriority: DEFAULT_PRIORITY, savedTimetables: defaultSavedTimetables() };
  }
}

function defaultSavedTimetables(): Record<Priority, string[]> {
  return { 1: [], 2: [], 3: [], 4: [], 5: [] };
}

function saveToStorage(
  cart: TimetableEntry[],
  currentPriority: Priority,
  savedTimetables: Record<Priority, string[]>,
  timetableChecked: Set<string>
) {
  try {
    const toSave = {
      ...savedTimetables,
      [currentPriority]: Array.from(timetableChecked),
    };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        cart,
        currentPriority,
        savedTimetables: toSave,
      })
    );
  } catch {
    // ignore quota or parse errors
  }
}

const SEARCHABLE_FIELDS: (keyof TimetableEntry)[] = [
  '과목명',
  '담당교수',
  '학정번호',
  '구분',
  '강의시간',
  '강의유형',
  '분반',
  '이수',
];

function searchEntries(query: string): TimetableEntry[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const lowerQuery = trimmed.toLowerCase();
  return entries.filter((entry) =>
    SEARCHABLE_FIELDS.some((field) => {
      const value = entry[field];
      return String(value ?? '').toLowerCase().includes(lowerQuery);
    })
  );
}

function isSameEntry(a: TimetableEntry, b: TimetableEntry): boolean {
  return (
    a.학정번호 === b.학정번호 &&
    a.분반 === b.분반 &&
    a.강의시간 === b.강의시간 &&
    a.담당교수 === b.담당교수
  );
}

function entryKey(entry: TimetableEntry): string {
  return `${entry.학정번호}|${entry.분반}|${entry.강의시간}|${entry.담당교수}`;
}

/** 사용자가 직접 입력해 추가한 항목인지 여부 */
function isCustomEntry(entry: TimetableEntry): boolean {
  return entry.학정번호.startsWith('custom-');
}

function createCustomEntry(과목명: string, 강의시간: string = '', 학점: string = ''): TimetableEntry {
  return {
    구분: '',
    학정번호: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    과목명: 과목명.trim(),
    분반: '',
    이수: '',
    학점: 학점.trim(),
    시수: '',
    담당교수: '',
    강의시간: 강의시간.trim(),
    강의유형: '',
  };
}

const PRIORITIES: Priority[] = [1, 2, 3, 4, 5];
const RESIZER_WIDTH = 20;
const MIN_PANEL_WIDTH = 32;
type PanelSizes = [number, number, number];
type Divider = 0 | 1;

function timetableCheckedFromSaved(
  saved: string[],
  cart: TimetableEntry[]
): Set<string> {
  const cartKeys = new Set(cart.map(entryKey));
  return new Set(saved.filter((k) => cartKeys.has(k)));
}

export default function TimetableSearch() {
  const [query, setQuery] = useState('');
  const loaded = useMemo(() => loadFromStorage(), []);
  const [cart, setCart] = useState<TimetableEntry[]>(() => loaded.cart);
  const [currentPriority, setCurrentPriority] = useState<Priority>(() => loaded.currentPriority);
  const [savedTimetables, setSavedTimetables] = useState<Record<Priority, string[]>>(
    () => loaded.savedTimetables
  );
  const [timetableChecked, setTimetableChecked] = useState<Set<string>>(() =>
    timetableCheckedFromSaved(loaded.savedTimetables[loaded.currentPriority], loaded.cart)
  );
  const results = useMemo(() => searchEntries(query), [query]);

  useEffect(() => {
    saveToStorage(cart, currentPriority, savedTimetables, timetableChecked);
  }, [cart, currentPriority, savedTimetables, timetableChecked]);

  const switchPriority = (newPriority: Priority) => {
    if (newPriority === currentPriority) return;
    const updated = {
      ...savedTimetables,
      [currentPriority]: Array.from(timetableChecked),
    };
    setSavedTimetables(updated);
    setCurrentPriority(newPriority);
    setTimetableChecked(timetableCheckedFromSaved(updated[newPriority] ?? [], cart));
  };

  const isInCart = (entry: TimetableEntry) =>
    cart.some((c) => isSameEntry(c, entry));

  const toggleCart = (entry: TimetableEntry) => {
    setCart((prev) => {
      const exists = prev.some((c) => isSameEntry(c, entry));
      if (exists) {
        setTimetableChecked((s) => {
          const next = new Set(s);
          next.delete(entryKey(entry));
          return next;
        });
        return prev.filter((c) => !isSameEntry(c, entry));
      }
      setTimetableChecked((s) => new Set(s).add(entryKey(entry)));
      return [...prev, entry];
    });
  };

  const removeFromCart = (entry: TimetableEntry) => {
    setTimetableChecked((s) => {
      const next = new Set(s);
      next.delete(entryKey(entry));
      return next;
    });
    setCart((prev) => prev.filter((c) => !isSameEntry(c, entry)));
  };

  const toggleTimetable = (entry: TimetableEntry) => {
    const key = entryKey(entry);
    setTimetableChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const entriesOnTimetable = useMemo(
    () => cart.filter((e) => timetableChecked.has(entryKey(e))),
    [cart, timetableChecked]
  );

  /** 시간표 그리드에 표시할 항목 (강의시간이 있고 파싱 가능한 것) */
  const entriesWithTime = useMemo(
    () =>
      entriesOnTimetable.filter(
        (e) => (e.강의시간 ?? '').trim() && parseLectureTime(e.강의시간).length > 0
      ),
    [entriesOnTimetable]
  );

  /** 시간이 없어 막대로만 표시할 항목 */
  const entriesWithoutTime = useMemo(
    () =>
      entriesOnTimetable.filter(
        (e) => !(e.강의시간 ?? '').trim() || parseLectureTime(e.강의시간).length === 0
      ),
    [entriesOnTimetable]
  );

  type MobileTab = 'search' | 'list' | 'timetable';
  const [mobileTab, setMobileTab] = useState<MobileTab>('search');
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [customTitle, setCustomTitle] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [customCredits, setCustomCredits] = useState('');

  const addCustomEntry = () => {
    const title = customTitle.trim();
    if (!title) return;
    const entry = createCustomEntry(title, customTime, customCredits);
    setCart((prev) => [...prev, entry]);
    setTimetableChecked((s) => new Set(s).add(entryKey(entry)));
    setCustomTitle('');
    setCustomTime('');
    setCustomCredits('');
  };

  const cartCredits = useMemo(
    () => cart.reduce((sum, e) => sum + (parseFloat(e.학점) || 0), 0),
    [cart]
  );
  const timetableCredits = useMemo(
    () => entriesOnTimetable.reduce((sum, e) => sum + (parseFloat(e.학점) || 0), 0),
    [entriesOnTimetable]
  );
  const panelsRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{
    divider: Divider;
    clientX: number;
    sizes: PanelSizes;
  } | null>(null);
  const [panelSizes, setPanelSizes] = useState<PanelSizes>([25, 25, 50]);

  const resizePanels = (divider: Divider, deltaPixels: number, sizes: PanelSizes) => {
    const availableWidth = Math.max(
      1,
      (panelsRef.current?.clientWidth ?? 0) - RESIZER_WIDTH * 2
    );
    const minimum = Math.min(100 / 3, (MIN_PANEL_WIDTH / availableWidth) * 100);
    const delta = (deltaPixels / availableWidth) * 100;
    const left = divider;
    const right = divider + 1;
    const clampedDelta = Math.max(
      minimum - sizes[left],
      Math.min(delta, sizes[right] - minimum)
    );
    const next: PanelSizes = [...sizes];
    next[left] += clampedDelta;
    next[right] -= clampedDelta;
    setPanelSizes(next);
  };

  const startResize = (divider: Divider, event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeStartRef.current = { divider, clientX: event.clientX, sizes: panelSizes };
    event.preventDefault();
  };

  const moveResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    const start = resizeStartRef.current;
    if (start) resizePanels(start.divider, event.clientX - start.clientX, start.sizes);
  };

  const stopResize = () => {
    resizeStartRef.current = null;
  };

  const resizeWithKeyboard = (
    divider: Divider,
    event: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    resizePanels(divider, event.key === 'ArrowLeft' ? -24 : 24, panelSizes);
  };

  return (
    <div
      className={`timetable-search timetable-search--mobile-active-${mobileTab}`}
      data-mobile-active={mobileTab}
    >
      <div
        ref={panelsRef}
        className="timetable-search__panels"
        style={{
          '--search-size': `${panelSizes[0]}fr`,
          '--list-size': `${panelSizes[1]}fr`,
          '--timetable-size': `${panelSizes[2]}fr`,
        } as React.CSSProperties}
      >
        {/* 좌측: 검색 */}
        <section
          className="timetable-search__panel timetable-search__panel--search"
          data-mobile-tab="search"
          aria-hidden={isMobile ? mobileTab !== 'search' : undefined}
        >
        <div className="timetable-search__panel-content">
        <input
          type="search"
          className="timetable-search__input"
          placeholder="과목명, 교수, 학정번호, 학과 등으로 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="timetable-search__meta">
          {query.trim() ? (
            <span className="timetable-search__count">
              {results.length}건의 검색 결과
            </span>
          ) : (
            <span className="timetable-search__hint">
              과목명, 교수명, 학정번호, 학과, 분반, 강의유형 등 모든 내용으로 검색할 수 있습니다. (eg. `컴퓨터정보공학` 검색 시 컴공 전공들 확인 가능)
            </span>
          )}
        </div>
        {query.trim() && (
          <div className="timetable-search__results">
            {results.length === 0 ? (
              <p className="timetable-search__empty">검색 결과가 없습니다.</p>
            ) : (
              <ul className="timetable-search__list">
                {results.map((entry, index) => (
                  <li
                    key={`${entry.학정번호}-${index}`}
                    className="timetable-search__item"
                    onClick={() => toggleCart(entry)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleCart(entry);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isInCart(entry)}
                  >
                    <div className="timetable-search__item-header">
                      <strong className="timetable-search__item-title">
                        {entry.과목명}
                      </strong>
                      <span className="timetable-search__item-code">
                        {entry.학정번호}
                      </span>
                    </div>
                    <div className="timetable-search__item-details">
                      <span>{entry.담당교수}</span>
                      <span>·</span>
                      <span>{entry.이수} {entry.학점}학점</span>
                      {entry.강의시간 && (
                        <>
                          <span>·</span>
                          <span>{entry.강의시간}</span>
                        </>
                      )}
                    </div>
                    {entry.구분 && (
                      <div className="timetable-search__item-category">
                        {entry.구분}
                      </div>
                    )}
                    {entry.분반 && (
                      <div className="timetable-search__item-section">
                        분반: {entry.분반}
                      </div>
                    )}
                    {entry.강의유형 && (
                      <div className="timetable-search__item-type">
                        {entry.강의유형}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        </div>
        </section>

        <button
          type="button"
          className="timetable-search__resizer"
          aria-label="검색과 목록 너비 조절. 좌우 방향키 사용 가능"
          title="드래그하여 너비 조절"
          onPointerDown={(event) => startResize(0, event)}
          onPointerMove={moveResize}
          onPointerUp={stopResize}
          onLostPointerCapture={stopResize}
          onKeyDown={(event) => resizeWithKeyboard(0, event)}
        />

        {/* 가운데: 목록 */}
        <section
          className="timetable-search__panel timetable-search__panel--list"
          data-mobile-tab="list"
          aria-hidden={isMobile ? mobileTab !== 'list' : undefined}
        >
        <div className="timetable-search__panel-content">
        <aside className="timetable-search__cart">
          <p className="timetable-search__cart-credits">
            목록에 있는 강의: {cart.length}개, 학점: {cartCredits}학점
          </p>
          <p className="timetable-search__cart-credits timetable-search__cart-credits--timetable">
            시간표에 넣은 강의: {entriesOnTimetable.length}개, 학점: {timetableCredits}학점
          </p>
          <details className="timetable-search__cart-add-details">
            <summary className="timetable-search__cart-add-toggle">강의 직접 추가</summary>
            <form
              className="timetable-search__cart-add"
              onSubmit={(e) => {
                e.preventDefault();
                addCustomEntry();
              }}
            >
              <input
                type="text"
                className="timetable-search__cart-add-input"
                placeholder="추가할 강의명"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                aria-label="추가할 강의명"
              />
              <input
                type="text"
                className="timetable-search__cart-add-input timetable-search__cart-add-input--time"
                placeholder="(예: 월3 수4)"
                value={customTime}
                onChange={(e) => setCustomTime(e.target.value)}
                aria-label="강의시간 선택"
              />
              <input
                type="text"
                inputMode="decimal"
                className="timetable-search__cart-add-input timetable-search__cart-add-input--credits"
                placeholder="학점 (선택)"
                value={customCredits}
                onChange={(e) => setCustomCredits(e.target.value)}
                aria-label="학점 선택"
              />
              <button type="submit" className="timetable-search__cart-add-btn" disabled={!customTitle.trim()}>
                추가
              </button>
            </form>
          </details>
          {cart.length === 0 ? (
            <p className="timetable-search__cart-empty">담은 강의가 없습니다.</p>
          ) : (
            <ul className="timetable-search__cart-list">
              {cart.map((entry, index) => (
                <li
                  key={`cart-${entry.학정번호}-${entry.분반}-${index}`}
                  className="timetable-search__cart-item"
                  onClick={() => toggleTimetable(entry)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleTimetable(entry);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={timetableChecked.has(entryKey(entry))}
                >
                  <div className="timetable-search__cart-item-body">
                    <div className="timetable-search__cart-item-header">
                      <span className="timetable-search__cart-item-title-wrap">
                        <strong>{entry.과목명}</strong>
                        {isCustomEntry(entry) && (
                          <span className="timetable-search__cart-item-badge" aria-hidden>직접 추가</span>
                        )}
                      </span>
                      <button
                        type="button"
                        className="timetable-search__cart-remove"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromCart(entry);
                        }}
                        aria-label="듣고싶은 강의 목록에서 제거"
                      >
                        제거
                      </button>
                    </div>
                    <div className="timetable-search__cart-item-details">
                      {entry.학정번호} · {entry.담당교수}
                      {(entry.이수 || entry.학점) && (
                        <> · {entry.이수} {entry.학점}학점</>
                      )}
                      {entry.강의시간 && ` · ${entry.강의시간}`}
                    </div>
                    {entry.구분 && (
                      <div className="timetable-search__cart-item-category">
                        구분: {entry.구분}
                      </div>
                    )}
                    {entry.강의유형 && (
                      <div className="timetable-search__cart-item-type">
                        강의유형: {entry.강의유형}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
        </div>
        </section>

        <button
          type="button"
          className="timetable-search__resizer"
          aria-label="목록과 시간표 너비 조절. 좌우 방향키 사용 가능"
          title="드래그하여 너비 조절"
          onPointerDown={(event) => startResize(1, event)}
          onPointerMove={moveResize}
          onPointerUp={stopResize}
          onLostPointerCapture={stopResize}
          onKeyDown={(event) => resizeWithKeyboard(1, event)}
        />

        {/* 우측: 시간표 */}
        <section
          className="timetable-search__panel timetable-search__panel--timetable"
          data-mobile-tab="timetable"
          aria-hidden={isMobile ? mobileTab !== 'timetable' : undefined}
        >
        <div className="timetable-search__panel-content">
        {entriesOnTimetable.length > 0 ? (
          <TimetableView entries={entriesWithTime} />
        ) : (
          <div className="timetable-search__timetable-placeholder">
            시간표에 표시할 강의를 목록에서 선택하세요.
          </div>
        )}
        {entriesWithoutTime.length > 0 && (
          <div className="timetable-search__no-time-section" aria-label="시간 미정 과목">
            <h2 className="timetable-search__no-time-heading">온라인/시간미정</h2>
            <ul className="timetable-search__no-time-list">
              {entriesWithoutTime.map((entry) => (
                <li key={entryKey(entry)} className="timetable-search__no-time-bar">
                  <span className="timetable-search__no-time-title">{entry.과목명}</span>
                  <span className="timetable-search__no-time-prof">{entry.담당교수 || '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="timetable-search__priority-row" aria-label="순위별 시간표 저장">
          {PRIORITIES.map((rank) => (
            <button
              key={rank}
              type="button"
              className={`timetable-search__priority-btn ${currentPriority === rank ? 'timetable-search__priority-btn--active' : ''}`}
              onClick={() => switchPriority(rank)}
              aria-pressed={currentPriority === rank}
              aria-label={`${rank}순위 시간표로 전환`}
            >
              {rank}순위
            </button>
          ))}
        </div>
        </div>
        </section>
      </div>

      {/* 모바일 하단 네비게이션 */}
      <nav className="timetable-search__mobile-nav" aria-label="화면 전환">
        <button
          type="button"
          className={`timetable-search__mobile-nav-btn ${mobileTab === 'search' ? 'timetable-search__mobile-nav-btn--active' : ''}`}
          onClick={() => setMobileTab('search')}
          aria-current={mobileTab === 'search' ? 'page' : undefined}
        >
          <span>검색</span>
        </button>
        <button
          type="button"
          className={`timetable-search__mobile-nav-btn ${mobileTab === 'list' ? 'timetable-search__mobile-nav-btn--active' : ''}`}
          onClick={() => setMobileTab('list')}
          aria-current={mobileTab === 'list' ? 'page' : undefined}
        >
          <span>목록보기</span>
        </button>
        <button
          type="button"
          className={`timetable-search__mobile-nav-btn ${mobileTab === 'timetable' ? 'timetable-search__mobile-nav-btn--active' : ''}`}
          onClick={() => setMobileTab('timetable')}
          aria-current={mobileTab === 'timetable' ? 'page' : undefined}
        >
          <span>시간표</span>
        </button>
      </nav>
    </div>
  );
}
