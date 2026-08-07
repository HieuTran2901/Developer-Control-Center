export type AlertType = 'cpu_high' | 'mem_high' | 'crash' | 'restart_loop';

export interface Alert {
  id: string;
  pid?: number;
  type: AlertType;
  message: string;
  timestamp: number;
}
