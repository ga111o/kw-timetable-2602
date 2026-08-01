/**
 * 학정번호 문자열을 해시하여 고유한 HSL 색상으로 변환합니다.
 * 같은 학정번호는 항상 같은 색이 됩니다.
 */
export function courseCodeToColor(학정번호: string): { h: number; s: number; l: number } {
  const hash = simpleHash(학정번호);
  const h = Math.abs(hash) % 360;
  const s = 52;
  const l = 48;
  return { h, s, l };
}

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

/**
 * HSL 값을 CSS gradient/테두리용 문자열로 변환합니다.
 */
export function hslToBlockStyle(h: number, s: number, l: number): {
  background: string;
  borderColor: string;
} {
  return {
    background: `linear-gradient(135deg, hsla(${h}, ${s}%, ${l}%, 0.38), hsla(${h}, ${s}%, ${l}%, 0.22))`,
    borderColor: `hsla(${h}, ${s}%, ${l}%, 0.5)`,
  };
}
