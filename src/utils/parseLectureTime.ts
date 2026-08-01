import type { DayIndex, LectureSlot } from '../types/timetable';

const DAY_MAP: Record<string, DayIndex> = {
  월: 0,
  화: 1,
  수: 2,
  목: 3,
  금: 4,
  토: 5,
  일: 6,
};

/** 교시 0 = 7:30, 교시 1 = 9:00, 한 교시 = 90분 */
const PERIOD_START_MINUTES = 7 * 60 + 30; // 450
const PERIOD_DURATION_MINUTES = 90;
const MAX_PERIOD = 10;

function periodToMinutes(period: number): { start: number; end: number } {
  const start = PERIOD_START_MINUTES + period * PERIOD_DURATION_MINUTES;
  return { start, end: start + PERIOD_DURATION_MINUTES };
}

/**
 * "강의시간" 문자열을 파싱해 슬롯 배열로 반환.
 * 예: "월4 수3" -> [{ day: 0, startMinutes: 810, endMinutes: 900 }, { day: 2, ... }]
 * 형식: (월|화|수|목|금|토|일)(숫자) 쌍을 공백으로 구분.
 */
export function parseLectureTime(강의시간: string): LectureSlot[] {
  const trimmed = (강의시간 ?? '').trim();
  if (!trimmed) return [];

  const slots: LectureSlot[] = [];
  // "월4 수3", "화7 화8 화9", "금3 금4" 등
  const pairs = trimmed.split(/\s+/);

  for (const pair of pairs) {
    const match = pair.match(/^(월|화|수|목|금|토|일)(\d+)$/);
    if (!match) continue;

    const dayLabel = match[1];
    const period = parseInt(match[2], 10);
    const day = DAY_MAP[dayLabel];
    if (day === undefined || isNaN(period) || period < 0 || period > MAX_PERIOD) continue;

    const { start, end } = periodToMinutes(period);
    slots.push({
      day: day as DayIndex,
      startMinutes: start,
      endMinutes: end,
    });
  }

  return slots;
}

export const DAY_NAMES: Record<DayIndex, string> = {
  0: '월',
  1: '화',
  2: '수',
  3: '목',
  4: '금',
  5: '토',
  6: '일',
};

if (import.meta.env.DEV && parseLectureTime('월10 토50 일100').length !== 1) {
  throw new Error('강의시간 파서 자체 검사에 실패했습니다.');
}
