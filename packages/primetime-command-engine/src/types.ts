export type ApprovalLevel = 0 | 1 | 2 | 3;

export type CommandDefinition = {
  code: string;
  category: string;
  description: string;
  approvalLevel: ApprovalLevel;
  regulated?: boolean;
  aliases?: string[];
  conflictsWith?: string[];
};

export type CommandRegistry = {
  version: string;
  commands: CommandDefinition[];
  masterCodes: Record<string, string[]>;
};

export type ParsedCommand = {
  raw: string;
  instruction: string;
  requestedCodes: string[];
  expandedCodes: string[];
  unknownCodes: string[];
  conflicts: Array<{ left: string; right: string }>;
  approvalLevel: ApprovalLevel;
  humanApprovalRequired: boolean;
  licensedReviewRequired: boolean;
  outputFormat?: string;
};
