export interface IResourceGateway {
  watchPid(pid: number): Promise<void>;
  unwatchPid(pid: number): Promise<void>;
}
