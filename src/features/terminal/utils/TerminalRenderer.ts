import { LogMessage } from '@/application/managers/LogBuffer';
import { cn } from '@/shared/utils';
import { AnsiParser } from './AnsiParser';

export class TerminalRenderer {
  private container: HTMLDivElement;
  private maxDomLines: number;
  private isAutoScroll: boolean = true;
  private linesCount: number = 0;
  private ansiParserStdout: AnsiParser = new AnsiParser();
  private ansiParserStderr: AnsiParser = new AnsiParser();

  constructor(container: HTMLDivElement, maxDomLines: number = 500) {
    this.container = container;
    this.maxDomLines = maxDomLines;
    this.container.innerHTML = '';
  }

  private formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toISOString().split('T')[1].replace('Z', '');
  }

  private createLogElement(log: LogMessage): HTMLDivElement | null {
    const parser = log.streamType === 'stderr' ? this.ansiParserStderr : this.ansiParserStdout;
    const segments = parser.parse(log.message);
    
    // If chunk contains only an incomplete ANSI sequence, skip rendering a new line for now
    if (segments.length === 0) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-start space-x-3 font-mono text-sm leading-relaxed hover:bg-white/5 px-2 py-0.5 rounded transition-colors';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'text-muted-foreground/60 shrink-0 select-none text-xs mt-0.5';
    timeSpan.textContent = this.formatTime(log.timestamp);

    const contentSpan = document.createElement('span');
    contentSpan.className = cn(
      'break-all whitespace-pre-wrap flex-1',
      log.streamType === 'stderr' ? 'text-red-400' : 'text-gray-200'
    );
    
    for (const seg of segments) {
      if (seg.text.length === 0) continue;
      
      if (!seg.fg && !seg.bold && !seg.dim) {
        contentSpan.appendChild(document.createTextNode(seg.text));
      } else {
        const span = document.createElement('span');
        span.textContent = seg.text;
        if (seg.fg) span.style.color = seg.fg;
        if (seg.bold) span.style.fontWeight = 'bold';
        if (seg.dim) span.style.opacity = '0.7';
        contentSpan.appendChild(span);
      }
    }

    wrapper.appendChild(timeSpan);
    wrapper.appendChild(contentSpan);
    return wrapper;
  }

  public append(log: LogMessage) {
    const el = this.createLogElement(log);
    if (!el) return;
    this.container.appendChild(el);
    this.linesCount++;

    // Prune DOM if auto scroll is ON and lines exceed max
    if (this.isAutoScroll && this.linesCount > this.maxDomLines) {
      this.pruneDom();
    }

    if (this.isAutoScroll) {
      this.scrollToBottom();
    }
  }

  public appendBatch(logs: LogMessage[]) {
    if (logs.length === 0) return;
    
    let addedCount = 0;
    const fragment = document.createDocumentFragment();
    for (const log of logs) {
      const el = this.createLogElement(log);
      if (el) {
        fragment.appendChild(el);
        addedCount++;
      }
    }
    
    if (addedCount === 0) return;
    
    this.container.appendChild(fragment);
    this.linesCount += addedCount;

    if (this.isAutoScroll && this.linesCount > this.maxDomLines) {
      this.pruneDom();
    }

    if (this.isAutoScroll) {
      this.scrollToBottom();
    }
  }

  private pruneDom() {
    const excess = this.linesCount - this.maxDomLines;
    if (excess > 0) {
      for (let i = 0; i < excess; i++) {
        if (this.container.firstChild) {
          this.container.removeChild(this.container.firstChild);
        }
      }
      this.linesCount = this.maxDomLines;
    }
  }

  public setAutoScroll(value: boolean) {
    this.isAutoScroll = value;
    if (value) {
      // User turned on auto-scroll, prune DOM and scroll
      this.pruneDom();
      this.scrollToBottom();
    }
  }

  public getAutoScroll(): boolean {
    return this.isAutoScroll;
  }

  public clear() {
    this.container.innerHTML = '';
    this.linesCount = 0;
    this.ansiParserStdout = new AnsiParser();
    this.ansiParserStderr = new AnsiParser();
  }

  public getLinesCount(): number {
    return this.linesCount;
  }

  public scrollToBottom() {
    this.container.scrollTop = this.container.scrollHeight;
  }

  public copyAll(): string {
    let content = '';
    const children = this.container.children;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const timeSpan = child.children[0]?.textContent || '';
      const textSpan = child.children[1]?.textContent || '';
      content += `${timeSpan} ${textSpan}\n`;
    }
    return content;
  }
}
