export interface TimetableEntry {
  구분: string;
  학정번호: string;
  과목명: string;
  분반: string;
  이수: string;
  학점: string;
  시수: string;
  담당교수: string;
  강의시간: string;
  강의유형: string;
}

/** 0=월 … 6=일 */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 강의 한 슬롯: 요일 + 시작/종료(분 단위, 0시 기준) */
export interface LectureSlot {
  day: DayIndex;
  startMinutes: number;
  endMinutes: number;
}
