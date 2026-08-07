export interface DesktopError {
  kind: 'ValidationError' | 'PermissionError' | 'UnknownError';
  message: string;
}
