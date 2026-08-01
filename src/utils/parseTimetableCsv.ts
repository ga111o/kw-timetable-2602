import timetableCsv from '../assets/timetable.csv?raw';
import type { TimetableEntry } from '../types/timetable';

const DAYS = new Set(['월', '화', '수', '목', '금', '토', '일']);
const REQUIRED_HEADERS = [
  '교양영역구분',
  '개설학과',
  '학정번호',
  '과목명',
  '신입생 및 1학년 분반',
  '이수구분',
  '학점',
  '시수',
  '담당교수',
  '요일1-일',
  '요일1-시간',
  '요일2-일',
  '요일2-시간',
  '요일3-일',
  '요일3-시간',
] as const;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error('시간표 CSV에 닫히지 않은 따옴표가 있습니다.');
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function buildLectureTime(get: (header: string) => string): string {
  const slots: string[] = [];

  for (let index = 1; index <= 3; index++) {
    const day = get(`요일${index}-일`);
    if (!DAYS.has(day)) continue;

    for (const period of get(`요일${index}-시간`).split(/[,\s]+/)) {
      if (/^\d+$/.test(period)) slots.push(`${day}${period}`);
    }
  }

  return slots.join(' ');
}

function buildLectureType(get: (header: string) => string): string {
  const types = [
    get('원격100%') && '원격100%',
    get('원격50%') && '원격50%',
    get('사전녹화100%') && '사전녹화100%',
    get('집중이수제') && '집중이수제',
  ].filter(Boolean);
  const language = get('외국어강의');
  const ratio = get('외국어강의비율(%)');
  if (language) types.push(ratio ? `${language}강의 ${ratio}%` : `${language}강의`);
  return types.join(', ');
}

export function parseTimetableCsv(text: string): TimetableEntry[] {
  const [headerRow, ...rows] = parseCsv(text);
  if (!headerRow) throw new Error('시간표 CSV가 비어 있습니다.');

  const headers = headerRow.map((header, index) =>
    (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim()
  );
  for (const header of REQUIRED_HEADERS) {
    if (!headers.includes(header)) {
      throw new Error(`시간표 CSV에 "${header}" 열이 없습니다.`);
    }
  }

  return rows.flatMap((row) => {
    const get = (header: string) => row[headers.indexOf(header)]?.trim() ?? '';
    const 학정번호 = get('학정번호');
    const 과목명 = get('과목명');
    if (!학정번호 || !과목명) return [];

    return [{
      구분: get('교양영역구분') || get('개설학과'),
      학정번호,
      과목명,
      분반: get('신입생 및 1학년 분반'),
      이수: get('이수구분'),
      학점: get('학점'),
      시수: get('시수'),
      담당교수: get('담당교수'),
      강의시간: buildLectureTime(get),
      강의유형: buildLectureType(get),
    }];
  });
}

if (import.meta.env.DEV) {
  const parsed = parseCsv('a,b\r\n"x,y","line 1\nline ""2"""');
  if (parsed[1]?.[0] !== 'x,y' || parsed[1]?.[1] !== 'line 1\nline "2"') {
    throw new Error('시간표 CSV 파서 자체 검사에 실패했습니다.');
  }
}

export const timetableEntries = parseTimetableCsv(timetableCsv);
