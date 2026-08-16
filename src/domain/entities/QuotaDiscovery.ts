export type EndpointClassification =
  | 'Unknown'
  | 'AntigravityMain'
  | 'LanguageServer'
  | 'Hub'
  | 'UsageCandidate'
  | 'QuotaCandidate'
  | 'UsageConfirmed';

export type CorrelationConfidence = 'Low' | 'Medium' | 'High' | 'Confirmed';

export type QuotaMetadataStatus =
  | 'NotAvailable'
  | 'Candidate'
  | 'Observed'
  | 'Confirmed'
  | 'UnsupportedFormat';

export type LocalUsageSourceType =
  | 'UsageMetadata'
  | 'QuotaMetadata'
  | 'PublicConfiguration'
  | 'DiagnosticLog'
  | 'ModelMetadata'
  | 'Unknown';

export type UsageProtocolType =
  | 'Unknown'
  | 'Http'
  | 'Https'
  | 'WebSocket'
  | 'Grpc'
  | 'GrpcWeb'
  | 'ProtobufRpc'
  | 'Other';

export type UsageExecutionOwner =
  | 'Cli'
  | 'LanguageServer'
  | 'AntigravityMain'
  | 'Other'
  | 'Unknown';

export type UsagePayloadFormat =
  | 'ProtectedBinary'
  | 'Json'
  | 'PlainText'
  | 'Unknown';

export type QuotaMetadataAvailability =
  | 'NotObservable'
  | 'Observed'
  | 'Unknown';

export interface QuotaValues {
  used: number | null;
  limit: number | null;
  remaining: number | null;
  percentage: number | null;
  resetAt: string | null;
}

export interface SafeQuotaMetadata {
  source: string;
  endpoint: string;
  observedAt: string | null;
  quota: QuotaValues | null;
  status: QuotaMetadataStatus;
  confidence: CorrelationConfidence;
  diagnosticNotes: string[];
}

export interface LocalUsageSource {
  sourceType: LocalUsageSourceType;
  safePath: string;
  processAssociation: string;
  confidence: CorrelationConfidence;
  observedAt: string;
  skippedSensitiveSource: boolean;
  safeQuota: QuotaValues | null;
}

export interface LocalUsageDiscoveryReport {
  timestamp: string;
  status: string; // "FOUND" | "NOT_FOUND" | "UNSUPPORTED_FORMAT"
  directoriesInspected: number;
  filesInspected: number;
  bytesRead: number;
  scanDurationMs: number;
  sources: LocalUsageSource[];
  bestSource: LocalUsageSource | null;
  diagnosticNotes: string[];
}

export interface UsageProtocolCandidate {
  endpoint: string;
  processName: string;
  pid: number;
  port: number;
  protocol: UsageProtocolType;
  executionOwner: UsageExecutionOwner;
  method?: string | null;
  path?: string | null;
  contentType?: string | null;
  payloadFormat: UsagePayloadFormat;
  quotaAvailability: QuotaMetadataAvailability;
  correlationState: string; // "CONFIRMED" | "CANDIDATE_ACTIVE" | "NOT_CORRELATED"
  confidence: CorrelationConfidence;
  timestamp: string;
  evidence: string;
}

export interface UsageProtocolDiscoveryReport {
  timestamp: string;
  status: string; // "DISCOVERED" | "NOT_DISCOVERED"
  candidate: UsageProtocolCandidate | null;
  candidates: UsageProtocolCandidate[];
  diagnosticNotes: string[];
}

export interface ProcessDiscoveryResult {
  pid: number;
  executableName: string;
  executablePath: string;
  commandLine: string;
  parentPid: number | null;
  detectedAt: string;
}

export interface ListeningPortDiscoveryResult {
  pid: number;
  localAddress: string;
  localPort: number;
  protocol: string;
  state: string;
}

export interface EndpointProbeResult {
  url: string;
  protocol: string;
  port: number;
  statusCode: number | null;
  isReachable: boolean;
  headersSummary: Record<string, string>;
  serverBanner: string | null;
  isAntigravityHub: boolean;
  error: string | null;
}

export interface QuotaDiscoveryReport {
  timestamp: string;
  processes: ProcessDiscoveryResult[];
  listeningPorts: ListeningPortDiscoveryResult[];
  endpoints: EndpointProbeResult[];
  analysisNotes: string[];
}

export interface UsageCorrelationCandidate {
  processPid: number;
  processName: string;
  port: number;
  protocol: string;
  endpoint: string;
  classification: EndpointClassification;
  confidence: CorrelationConfidence;
  correlationMethod: string;
  evidence: string;
  warnings: string[];
  matchedPath?: string | null;
}

export interface UsageCorrelationReport {
  timestamp: string;
  status: string;
  bestCandidate: UsageCorrelationCandidate | null;
  candidates: UsageCorrelationCandidate[];
  diagnosticNotes: string[];
  isUsageConfirmed: boolean;
}

export interface ObservedTraceEvent {
  timestamp: string;
  processPid: number;
  processName: string;
  port: number;
  protocol: string;
  eventType: string;
  details: string;
  matchedPath?: string | null;
  confidence: CorrelationConfidence;
}

export interface UsageEndpointMetadata {
  endpoint: string;
  process: string;
  pid: number;
  port: number;
  protocol: string;
  correlation: string; // "CONFIRMED" | "CANDIDATE_ACTIVE" | "NOT_CORRELATED"
  confidence: CorrelationConfidence;
  observedAt?: string | null;
  source: string; // "InteractiveUserTrace" | "StaticCorrelation"
}

export interface UsageTraceReport {
  timestamp: string;
  status: string; // "CONFIRMED" | "CANDIDATE_ACTIVE" | "NOT_CORRELATED"
  traceDurationMs: number;
  usageTriggeredByUser: boolean;
  observedEvents: ObservedTraceEvent[];
  confirmedEndpoint: string | null;
  confidence: CorrelationConfidence;
  warnings: string[];
  summaryNotes: string[];
  usageEndpointMetadata?: UsageEndpointMetadata | null;
  safeQuotaMetadata?: SafeQuotaMetadata | null;
}
