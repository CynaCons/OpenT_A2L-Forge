export type A2lMetadata = {
  project_name: string;
  project_long_identifier: string;
  module_names: string[];
  header_comment?: string | null;
  asap2_version?: string | null;
  warning_count: number;
};

export type CoreEntity = {
  kind: string;
  name: string;
  long_identifier?: string | null;
};

export type StatusType = "info" | "success" | "error";
export type StatusState = {
  type: StatusType;
  message: string;
};

export type A2lTreeItem = {
  id: string;
  name: string;
  kind: string;
  description?: string | null;
  details?: A2lTreeDetail[] | null;
};

export type A2lTreeDetail = {
  label: string;
  value: string;
};

export type A2lTreeSection = {
  id: string;
  title: string;
  items: A2lTreeItem[];
};

export type A2lTreeModule = {
  id: string;
  name: string;
  long_identifier?: string | null;
  sections: A2lTreeSection[];
};

export type A2lTree = {
  modules: A2lTreeModule[];
};

export type RecentFile = {
  name: string;
  path?: string | null;
  lastOpened: number;
};

export type ElfSymbol = {
  name: string;
  address: number;
  size: number;
  bind: string;
  type_str: string;
  section: string;
  suggested_a2l_type: string;
  suggested_limits: [number, number];
  address_warning: string | null;
  dwarf_type: string | null;
  is_struct_member: boolean;
  parent_struct: string | null;
  array_dims: number[];
  enum_values: [string, number][];
};

export type SymbolWithMapping = {
  name: string;
  address: number;
  a2l_type: string;
  lower_limit: number;
  upper_limit: number;
  conversion?: string;
  resolution?: number;
  accuracy?: number;
  array_dims?: number[];
  enum_values?: [string, number][];
};

export type SymbolConflict = {
  symbol_name: string;
  existing_address: string;
  existing_type: string;
  new_address: string;
  new_type: string;
};

export type ConflictReport = {
  conflicts: SymbolConflict[];
  non_conflicts: string[];
};

export type CliSyncMissingPolicy = "report" | "prune";

export type CliTrackedSelector =
  | { kind: "symbol"; name: string }
  | { kind: "struct_root"; name: string };

export type CliSymbolMappingOverride = {
  a2l_type: string;
  lower_limit: number;
  upper_limit: number;
  conversion?: string;
  resolution?: number;
  accuracy?: number;
  array_dims?: number[];
  enum_values?: [string, number][];
};

export type CliSyncProject = {
  version: number;
  a2l_path: string;
  elf_path: string;
  module_name?: string | null;
  output_path?: string | null;
  selectors: CliTrackedSelector[];
  mapping_overrides: Record<string, CliSymbolMappingOverride>;
  missing_policy: CliSyncMissingPolicy;
};

export type LoadedCliSyncProject = {
  project_path: string;
  resolved_a2l_path: string;
  resolved_elf_path: string;
  resolved_output_path?: string | null;
  project: CliSyncProject;
};
