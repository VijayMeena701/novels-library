export interface BackupResult {
  dir: string;
  counts: Record<string, number>;
  docs: Record<string, any[]>;
}

export interface StepResult<T = unknown> {
  ok: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface VerifyMismatches {
  missing: { collection: string; id: string }[];
  extra: { collection: string; id: string }[];
  altered: { collection: string; id: string; fields: string[] }[];
}

export interface VerifyResult {
  ok: boolean;
  counts: { pre: Record<string, number>; post: Record<string, number> };
  mismatches: VerifyMismatches;
  messages: string[];
}

export interface ReportData {
  identifier: string;
  startedAt: string;
  completedAt: string;
  steps: { name: string; ok: boolean; message: string }[];
  preBackup: BackupResult;
  postBackup?: BackupResult;
  verify?: VerifyResult;
}
