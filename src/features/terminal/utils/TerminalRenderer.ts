import { LogMessage } from '@/application/managers/LogBuffer';
import { cn } from '@/shared/utils';

export class TerminalRenderer {
  private container: HTMLDivElement;
  private maxDomLines: number;
  private isAutoScroll: boolean = true;
  private linesCount: number = 0;

  constructor(container: HTMLDivElement, maxDomLines: number = 500) {
    this.container = container;
    this.maxDomLines = maxDomLines;
    this.container.innerHTML = '';
  }

  private formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toISOString().split('T')[1].replace('Z', '');
  }

  private createLogElement(log: LogMessage): HTMLDivElement {
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
    contentSpan.textContent = log.message;

    wrapper.appendChild(timeSpan);
    wrapper.appendChild(contentSpan);
    return wrapper;
  }

  public append(log: LogMessage) {
    const el = this.createLogElement(log);
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
    
    const fragment = document.createDocumentFragment();
    for (const log of logs) {
      fragment.appendChild(this.createLogElement(log));
    }
    this.container.appendChild(fragment);
    this.linesCount += logs.length;

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
