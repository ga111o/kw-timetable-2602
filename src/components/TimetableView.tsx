import { useMemo } from 'react';
import type { DayIndex, TimetableEntry } from '../types/timetable';
import { parseLectureTime } from '../utils/parseLectureTime';
import { courseCodeToColor, hslToBlockStyle } from '../utils/courseCodeToColor';
import './TimetableView.css';

const DEFAULT_START_MINUTES = 7 * 60 + 30; // 0교시, 7:30
const DEFAULT_END_MINUTES = 18 * 60; // 18:00
const DEFAULT_DAYS: DayIndex[] = [0, 1, 2, 3, 4]; // 월~금

/** 교시 0 = 7:30~9:00, 교시 1 = 9:00~10:30, ... 한 교시 = 90분 */
const PERIOD_START_MINUTES = 7 * 60 + 30;
const PERIOD_DURATION = 90;

type SlotInput = { entry: TimetableEntry; day: DayIndex; start: number; end: number };

/** 같은 과목·같은 요일에서 연속된 슬롯(연강, 예: 화2+화3)을 하나로 합친다. */
function mergeConsecutiveSlots(slots: SlotInput[]): SlotInput[] {
  const key = (s: SlotInput) => `${s.entry.학정번호}-${s.entry.분반}-${s.day}`;
  const byEntryDay = new Map<string, SlotInput[]>();
  for (const s of slots) {
    const k = key(s);
    if (!byEntryDay.has(k)) byEntryDay.set(k, []);
    byEntryDay.get(k)!.push(s);
  }
  const merged: SlotInput[] = [];
  for (const group of byEntryDay.values()) {
    group.sort((a, b) => a.start - b.start);
    let runStart = group[0].start;
    let runEnd = group[0].end;
    const entry = group[0].entry;
    const day = group[0].day;
    for (let i = 1; i < group.length; i++) {
      if (group[i].start === runEnd) {
        runEnd = group[i].end;
      } else {
        merged.push({ entry, day, start: runStart, end: runEnd });
        runStart = group[i].start;
        runEnd = group[i].end;
      }
    }
    merged.push({ entry, day, start: runStart, end: runEnd });
  }
  return merged;
}

/** 두 구간이 겹치는지 (공통 시간이 있는지) */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** 같은 요일에서 시간이 겹치는 슬롯들을 하나의 블록으로 묶는다. 겹치면 isConflict + entries 복수. */
function mergeOverlappingSlots(
  slots: SlotInput[]
): { day: DayIndex; start: number; end: number; entries: TimetableEntry[]; isConflict: boolean }[] {
  const byDay = new Map<DayIndex, SlotInput[]>();
  for (const s of slots) {
    if (!byDay.has(s.day)) byDay.set(s.day, []);
    byDay.get(s.day)!.push(s);
  }
  const result: { day: DayIndex; start: number; end: number; entries: TimetableEntry[]; isConflict: boolean }[] = [];
  for (const [day, daySlots] of byDay) {
    daySlots.sort((a, b) => a.start - b.start);
    type Group = { start: number; end: number; slots: SlotInput[] };
    const groups: Group[] = [];
    for (const s of daySlots) {
      const overlapping = groups.filter((g) => overlaps(s.start, s.end, g.start, g.end));
      if (overlapping.length === 0) {
        groups.push({ start: s.start, end: s.end, slots: [s] });
      } else {
        const first = overlapping[0];
        first.slots.push(s);
        first.start = Math.min(first.start, s.start);
        first.end = Math.max(first.end, s.end);
        for (let i = 1; i < overlapping.length; i++) {
          const g = overlapping[i];
          first.slots.push(...g.slots);
          first.start = Math.min(first.start, g.start);
          first.end = Math.max(first.end, g.end);
          groups.splice(groups.indexOf(g), 1);
        }
      }
    }
    for (const group of groups) {
      const seen = new Set<string>();
      const entries: TimetableEntry[] = [];
      for (const s of group.slots) {
        const id = `${s.entry.학정번호}-${s.entry.분반}`;
        if (!seen.has(id)) {
          seen.add(id);
          entries.push(s.entry);
        }
      }
      result.push({
        day: day,
        start: group.start,
        end: group.end,
        entries,
        isConflict: entries.length > 1,
      });
    }
  }
  return result;
}

function getPeriodLabel(period: number): string {
  return `${period}교시`;
}

function getPeriodsInRange(startMin: number, endMin: number): { period: number; start: number; end: number }[] {
  const periods: { period: number; start: number; end: number }[] = [];
  for (let p = 0; ; p++) {
    const start = PERIOD_START_MINUTES + p * PERIOD_DURATION;
    if (start >= endMin) break;
    const end = start + PERIOD_DURATION;
    if (end > startMin && start < endMin) {
      periods.push({
        period: p,
        start: Math.max(start, startMin),
        end: Math.min(end, endMin),
      });
    }
  }
  return periods;
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface TimetableViewProps {
  entries: TimetableEntry[];
}

export default function TimetableView({ entries }: TimetableViewProps) {
  const { gridStart, gridEnd, days, blocks } = useMemo(() => {
    const allSlots: { entry: TimetableEntry; day: DayIndex; start: number; end: number }[] = [];
    let minStart = DEFAULT_START_MINUTES;
    let maxEnd = DEFAULT_END_MINUTES;
    const daysSet = new Set<DayIndex>(DEFAULT_DAYS);

    for (const entry of entries) {
      const slots = parseLectureTime(entry.강의시간);
      for (const slot of slots) {
        allSlots.push({
          entry,
          day: slot.day,
          start: slot.startMinutes,
          end: slot.endMinutes,
        });
        minStart = Math.min(minStart, slot.startMinutes);
        maxEnd = Math.max(maxEnd, slot.endMinutes);
        daysSet.add(slot.day);
      }
    }

    const gridStart = allSlots.length ? minStart : DEFAULT_START_MINUTES;
    const gridEnd = allSlots.length ? maxEnd : DEFAULT_END_MINUTES;
    const days = [...daysSet].sort((a, b) => a - b);

    const totalMinutes = Math.max(1, gridEnd - gridStart);
    const mergedSlots = mergeConsecutiveSlots(allSlots);
    const displaySlots = mergeOverlappingSlots(mergedSlots);
    const blocks = displaySlots
      .filter((s) => days.includes(s.day))
      .map((s) => {
        const topPercent = Math.min(100, Math.max(0, ((Math.max(s.start, gridStart) - gridStart) / totalMinutes) * 100));
        const endPercent = Math.min(100, Math.max(0, ((Math.min(s.end, gridEnd) - gridStart) / totalMinutes) * 100));
        const heightPercent = Math.max(0, endPercent - topPercent);
        return {
          ...s,
          topPercent,
          heightPercent,
        };
      })
      .filter((b) => b.heightPercent > 0);

    return { gridStart, gridEnd, days, blocks, totalMinutes };
  }, [entries]);

  const timeLabels = useMemo(() => {
    const labels: number[] = [];
    const step = 30; // 30분 단위 레이블
    for (let m = gridStart; m <= gridEnd; m += step) {
      labels.push(m);
    }
    if (labels.length > 0 && labels[labels.length - 1] < gridEnd) {
      labels.push(gridEnd);
    }
    return labels;
  }, [gridStart, gridEnd]);

  const periodLabels = useMemo(
    () => getPeriodsInRange(gridStart, gridEnd),
    [gridStart, gridEnd]
  );

  const totalMinutes = gridEnd - gridStart;

  return (
    <section className="timetable-view">
      <div className="timetable-view__grid-wrap">
        <div
          className="timetable-view__grid"
          style={{
            '--grid-columns': days.length,
            '--total-minutes': totalMinutes,
          } as React.CSSProperties}
        >
          <div className="timetable-view__time-col">
            {timeLabels.map((m) => (
              <div
                key={m}
                className="timetable-view__time-cell"
                style={{
                  top: `${((m - gridStart) / totalMinutes) * 100}%`,
                }}
              >
                {minutesToTime(m)}
              </div>
            ))}
          </div>
          <div className="timetable-view__days">
            {days.map((day) => (
              <div key={day} className="timetable-view__day-col">
                <div className="timetable-view__day-body">
                  {periodLabels.map(({ period, start }) => (
                    <div
                      key={period}
                      className="timetable-view__period-row"
                      style={{ top: `${((start - gridStart) / totalMinutes) * 100}%` }}
                      aria-hidden="true"
                    />
                  ))}
                  {blocks
                    .filter((b) => b.day === day)
                    .map((block) => {
                      const { h, s, l } = block.isConflict
                        ? { h: 0, s: 0, l: 0 }
                        : courseCodeToColor(block.entries[0].학정번호);
                      const colorStyle = block.isConflict ? undefined : hslToBlockStyle(h, s, l);
                      return (
                      <div
                        key={`${day}-${block.start}-${block.end}-${block.entries.map((e) => e.학정번호 + e.분반).join(',')}`}
                        className={`timetable-view__block ${block.isConflict ? 'timetable-view__block--conflict' : ''}`}
                        style={{
                          top: `${block.topPercent}%`,
                          height: `${block.heightPercent}%`,
                          ...(colorStyle ?? {}),
                        }}
                        title={
                          block.isConflict
                            ? `시간 충돌: ${block.entries.map((e) => `${e.과목명} (${e.담당교수})`).join(' / ')} ${minutesToTime(block.start)}–${minutesToTime(block.end)}`
                            : `${block.entries[0].과목명} (${block.entries[0].담당교수}) ${minutesToTime(block.start)}–${minutesToTime(block.end)}`
                        }
                      >
                        <span className="timetable-view__block-title">
                          {block.isConflict
                            ? block.entries.map((e) => e.과목명).join(' / ')
                            : block.entries[0].과목명}
                        </span>
                        <span className="timetable-view__block-time">
                          {minutesToTime(block.start)}–{minutesToTime(block.end)}
                        </span>
                      </div>
                    );})
                  }
                </div>
              </div>
            ))}
          </div>
          <div
            className="timetable-view__period-col"
            data-width-label={getPeriodLabel(periodLabels.at(-1)?.period ?? 0)}
          >
            {periodLabels.map(({ period, start, end }) => {
              const topPercent = ((start - gridStart) / totalMinutes) * 100;
              const heightPercent = ((end - start) / totalMinutes) * 100;
              return (
                <div
                  key={period}
                  className="timetable-view__period-cell"
                  style={{
                    top: `${topPercent}%`,
                    height: `${heightPercent}%`,
                  }}
                >
                  {getPeriodLabel(period)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
