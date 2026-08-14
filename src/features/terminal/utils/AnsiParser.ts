export interface AnsiSegment {
  text: string;
  fg: string | null;
  bold: boolean;
  dim: boolean;
}

export class AnsiParser {
  private leftover: string = '';
  private currentFg: string | null = null;
  private isBold: boolean = false;
  private isDim: boolean = false;

  private static COLORS: Record<number, string> = {
    30: '#000000', 31: '#ef4444', 32: '#22c55e', 33: '#eab308', 
    34: '#3b82f6', 35: '#a855f7', 36: '#06b6d4', 37: '#e5e7eb',
    90: '#6b7280', 91: '#f87171', 92: '#4ade80', 93: '#facc15',
    94: '#60a5fa', 95: '#c084fc', 96: '#22d3ee', 97: '#ffffff',
  };

  public parse(chunk: string): AnsiSegment[] {
    const text = this.leftover + chunk;
    this.leftover = '';
    const result: AnsiSegment[] = [];

    let currentText = '';

    let i = 0;
    while (i < text.length) {
      if (text[i] === '\x1b') {
        if (i + 1 >= text.length) {
          this.leftover = text.substring(i);
          break;
        }
        if (text[i + 1] === '[') {
          let end = -1;
          for (let j = i + 2; j < text.length; j++) {
            const charCode = text.charCodeAt(j);
            if (charCode >= 0x40 && charCode <= 0x7E) {
              end = j;
              break;
            }
          }
          if (end === -1) {
            if (text.length - i > 100) {
              currentText += '\x1b';
              i++;
              continue;
            }
            this.leftover = text.substring(i);
            break;
          }
          
          if (currentText.length > 0) {
            result.push({ text: currentText, fg: this.currentFg, bold: this.isBold, dim: this.isDim });
            currentText = '';
          }

          const command = text[end];
          const paramsStr = text.substring(i + 2, end);
          
          if (command === 'm') {
            const params = paramsStr.split(';').map(p => parseInt(p, 10) || 0);
            if (params.length === 0) params.push(0);

            for (let pIdx = 0; pIdx < params.length; pIdx++) {
              const p = params[pIdx];
              if (p === 0) {
                this.currentFg = null;
                this.isBold = false;
                this.isDim = false;
              } else if (p === 1) {
                this.isBold = true;
              } else if (p === 2) {
                this.isDim = true;
              } else if (p === 22) {
                this.isBold = false;
                this.isDim = false;
              } else if (p === 39) {
                this.currentFg = null;
              } else if ((p >= 30 && p <= 37) || (p >= 90 && p <= 97)) {
                this.currentFg = AnsiParser.COLORS[p];
              } else if (p === 38 && pIdx + 2 < params.length && params[pIdx + 1] === 5) {
                const colorCode = params[pIdx + 2];
                this.currentFg = this.get256Color(colorCode);
                pIdx += 2;
              } else if (p === 38 && pIdx + 4 < params.length && params[pIdx + 1] === 2) {
                const r = params[pIdx + 2];
                const g = params[pIdx + 3];
                const b = params[pIdx + 4];
                this.currentFg = `rgb(${r},${g},${b})`;
                pIdx += 4;
              }
            }
          } else if (command === 'K') {
            // Erase in Line - Ignore for UI simplification but don't output raw
          }
          
          i = end + 1;
        } else {
          // Some other escape sequence (OSC, etc). Just consume the \x1b and let next chars be evaluated or consumed
          i++;
        }
      } else {
        currentText += text[i];
        i++;
      }
    }

    if (currentText.length > 0) {
      result.push({ text: currentText, fg: this.currentFg, bold: this.isBold, dim: this.isDim });
    }

    return result;
  }

  private get256Color(code: number): string {
    if (code >= 0 && code <= 15) {
      const mapping: Record<number, number> = {
        0: 30, 1: 31, 2: 32, 3: 33, 4: 34, 5: 35, 6: 36, 7: 37,
        8: 90, 9: 91, 10: 92, 11: 93, 12: 94, 13: 95, 14: 96, 15: 97
      };
      return AnsiParser.COLORS[mapping[code]] || '#ffffff';
    }
    if (code >= 16 && code <= 231) {
      const c = code - 16;
      const r = Math.floor(c / 36) * 51;
      const g = Math.floor((c % 36) / 6) * 51;
      const b = (c % 6) * 51;
      return `rgb(${r},${g},${b})`;
    }
    if (code >= 232 && code <= 255) {
      const g = (code - 232) * 10 + 8;
      return `rgb(${g},${g},${g})`;
    }
    return '#ffffff';
  }
}
