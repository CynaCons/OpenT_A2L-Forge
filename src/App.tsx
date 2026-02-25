import { useEffect, useMemo, useRef, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  Box,
  Button,
  Chip,
  CssBaseline,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  ThemeProvider,
  Typography,
  createTheme,
  Tooltip,
  InputBase,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  TextField,
  MenuItem,
  Menu,
} from "@mui/material";
import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";
import {
  Description as DescriptionIcon,
  Memory as MemoryIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  FolderOpen as FolderOpenIcon,
  Add as AddIcon,
  Close as CloseIcon,
  CropSquare,
  Minimize,
  KeyboardArrowDown,
  KeyboardArrowRight,
  Extension,
  Speed,
  Timeline,
  TableChart,
  Functions,
  DataObject,
  Edit as EditIcon,
  Terminal,
  FilterNone,
  Save as SaveIcon,
  NoteAdd as NoteAddIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";

import "./titlebar.css";

import { MeasurementEditor } from "./components/editors/MeasurementEditor";
import { CharacteristicEditor } from "./components/editors/CharacteristicEditor";
import { AxisPtsEditor } from "./components/editors/AxisPtsEditor";

// --- Types ---

type A2lMetadata = {
  project_name: string;
  project_long_identifier: string;
  module_names: string[];
  header_comment?: string | null;
  asap2_version?: string | null;
  warning_count: number;
};

type CoreEntity = {
  kind: string;
  name: string;
  long_identifier?: string | null;
};

type StatusType = "info" | "success" | "error";
type StatusState = {
  type: StatusType;
  message: string;
};

type A2lTreeItem = {
  id: string;
  name: string;
  kind: string;
  description?: string | null;
  details?: A2lTreeDetail[] | null;
};

type A2lTreeDetail = {
  label: string;
  value: string;
};

type A2lTreeSection = {
  id: string;
  title: string;
  items: A2lTreeItem[];
};

type A2lTreeModule = {
  id: string;
  name: string;
  long_identifier?: string | null;
  sections: A2lTreeSection[];
};

type A2lTree = {
  modules: A2lTreeModule[];
};

type RecentFile = {
  name: string;
  path?: string | null;
  lastOpened: number;
};

type ElfSymbol = {
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

type SymbolWithMapping = {
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

type SymbolConflict = {
  symbol_name: string;
  existing_address: string;
  existing_type: string;
  new_address: string;
  new_type: string;
};

type ConflictReport = {
  conflicts: SymbolConflict[];
  non_conflicts: string[];
};

// --- Theme ---

const ideTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#3794ff" },
    secondary: { main: "#b76e79" },
    background: {
      default: "#1e1e1e",
      paper: "#252526",
    },
    text: {
      primary: "#e7e7e7",
      secondary: "#a0a0a0",
    },
    divider: "#333333",
    action: {
      hover: "rgba(255, 255, 255, 0.08)",
      selected: "rgba(255, 255, 255, 0.12)",
    },
  },
  typography: {
    fontFamily: '"JetBrains Mono", "Segoe UI", "Inter", monospace', 
    fontSize: 12,
    button: { textTransform: "none", fontWeight: 600, fontSize: 12 },
    h6: { fontSize: "1rem", fontWeight: 600, letterSpacing: 0.5 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 4 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          marginBottom: 1,
          "&.Mui-selected": {
            backgroundColor: "#37373d",
            borderLeft: "3px solid #3794ff",
            paddingLeft: 13, // Compensate for border
            "&:hover": { backgroundColor: "#2a2d2e" },
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#202020",
          border: "1px solid #454545",
          fontSize: 11,
        },
      },
    },
  },
});

// --- Icons & Color Helpers ---

function getKindColor(kind: string): string {
  switch (kind) {
    case "Module": return "#dcdcaa";
    case "Measurement": return "#4ec9b0";
    case "Characteristic": return "#ce9178";
    case "AxisPts": return "#569cd6";
    case "RecordLayout": return "#c586c0";
    default: return "#888";
  }
}

function getPropertySection(label: string, _kind?: string): string {
  const upper = label.toUpperCase();
  if (["LONG IDENTIFIER"].includes(upper)) return "Description";
  if (["DATATYPE", "TYPE", "CONVERSION", "CONVERSION TYPE", "FORMAT", "UNIT", "ENCODING", "PHYS UNIT"].includes(upper)) return "Data Type & Conversion";
  if (["LIMITS", "LOWER LIMIT", "UPPER LIMIT", "EXTENDED LIMITS", "MAX DIFF", "STEP SIZE"].includes(upper)) return "Limits & Range";
  if (["ADDRESS", "ECU ADDRESS", "ECU ADDRESS EXT", "ADDRESS TYPE", "BIT MASK", "BIT OPERATION", "BYTE ORDER", "DEPOSIT", "DEPOSIT RECORD", "INPUT QUANTITY", "MAX AXIS POINTS"].includes(upper)) return "Address & Layout";
  if (["RESOLUTION", "ACCURACY"].includes(upper)) return "Precision";
  return "Other Properties";
}

function getKindIcon(kind: string) {
  switch (kind) {
    case "Module": return <Extension fontSize="inherit" style={{ color: "#dcdcaa" }} />;
    case "Measurement": return <Speed fontSize="inherit" style={{ color: "#4ec9b0" }} />;
    case "Characteristic": return <Timeline fontSize="inherit" style={{ color: "#ce9178" }} />;
    case "AxisPts": return <Functions fontSize="inherit" style={{ color: "#569cd6" }} />;
    case "RecordLayout": return <TableChart fontSize="inherit" style={{ color: "#c586c0" }} />;
    default: return <DataObject fontSize="inherit" color="disabled" />;
  }
}

// --- Status Bar Component ---

function StatusBar({ status, fileName, elfName, isDirty, onDismissError }: { status: StatusState | null, fileName: string, elfName: string, isDirty?: boolean, onDismissError?: () => void }) {
  const bg = status?.type === "error" ? "#9a3324" : "#007acc";
  return (
    <Box
      sx={{
        height: 22,
        bgcolor: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 1.5,
        color: "#fff",
        fontSize: "11px",
        userSelect: "none",
        borderTop: "1px solid rgba(255,255,255,0.1)",
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, cursor: status?.type === "error" ? "pointer" : "default" }}
          onClick={() => { if (status?.type === "error" && onDismissError) onDismissError(); }}>
           {status?.type === "error" ? <CloseIcon sx={{ fontSize: 12 }} /> : <Terminal sx={{ fontSize: 12 }} />}
           <span data-testid="status-message">{status?.message || "Ready"}</span>
           {status?.type === "error" && <CloseIcon sx={{ fontSize: 10, ml: 0.5, opacity: 0.7 }} />}
        </Box>
      </Stack>
      <Stack direction="row" spacing={3} alignItems="center">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
           <DescriptionIcon sx={{ fontSize: 12, opacity: 0.7 }} />
           <span>{isDirty ? "\u2022 " : ""}{fileName || "No A2L"}</span>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
           <MemoryIcon sx={{ fontSize: 12, opacity: 0.7 }} />
           <span>{elfName || "No ELF"}</span>
        </Box>
        <span>UTF-8</span>
      </Stack>
    </Box>
  );
}

function App() {
  const [activeView, setActiveView] = useState<"a2l" | "elf" | "settings">("a2l");
  const [searchQuery, setSearchQuery] = useState("");
  const [metadata, setMetadata] = useState<A2lMetadata | null>(null);
  const [fileName, setFileName] = useState("");
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [elfFileName, setElfFileName] = useState("");
  const [a2lTree, setA2lTree] = useState<A2lTree | null>(null);
  const [selectedTreeItemIds, setSelectedTreeItemIds] = useState<string[]>([]);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [sectionItemLimit, setSectionItemLimit] = useState<Record<string, number>>({});
  const [recentA2lFiles, setRecentA2lFiles] = useState<RecentFile[]>([]);
  const [recentElfFiles, setRecentElfFiles] = useState<RecentFile[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const lastClickedTreeItemRef = useRef<string | null>(null);
  const [elfSymbols, setElfSymbols] = useState<ElfSymbol[]>([]);
  const [selectedElfSymbols, setSelectedElfSymbols] = useState<Set<string>>(new Set());
  const [elfSearchQuery, setElfSearchQuery] = useState('');
  const [elfFilterTypes, setElfFilterTypes] = useState<Set<string>>(new Set());
  const [elfFilterSections, setElfFilterSections] = useState<Set<string>>(new Set());
  const [elfFilterBinds, setElfFilterBinds] = useState<Set<string>>(new Set());
  const [elfSortColumn, setElfSortColumn] = useState<'name' | 'address' | 'size' | 'type'>('name');
  const [elfSortDirection, setElfSortDirection] = useState<'asc' | 'desc'>('asc');
  const [collapsedStructs, setCollapsedStructs] = useState<Set<string>>(new Set());
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictReport, setConflictReport] = useState<ConflictReport | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewMeasurements, setPreviewMeasurements] = useState<SymbolWithMapping[]>([]);
  const [elfChangedBanner, setElfChangedBanner] = useState(false);
  const [currentElfPath, setCurrentElfPath] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [fileMenuAnchor, setFileMenuAnchor] = useState<null | HTMLElement>(null);
  const statusTimeoutRef = useRef<number | null>(null);

  const refreshTree = async () => {
    try {
      const tree = await invoke<A2lTree>("list_a2l_tree");
      setA2lTree(tree);
    } catch (error) {
      console.error("Failed to refresh tree", error);
    }
  };

  const filteredTree = useMemo(() => {
    if (!a2lTree) return null;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return a2lTree;

    return {
      modules: a2lTree.modules
        .map((module) => {
          const sections = module.sections
            .map((section) => {
              const items = section.items.filter((item) => {
                return (
                  item.name.toLowerCase().includes(query) ||
                  item.kind.toLowerCase().includes(query) ||
                  (item.description ?? "").toLowerCase().includes(query)
                );
              });
              return items.length ? { ...section, items } : null;
            })
            .filter(Boolean) as A2lTreeSection[];

          return sections.length ? { ...module, sections } : null;
        })
        .filter(Boolean) as A2lTreeModule[],
    } as A2lTree;
  }, [a2lTree, searchQuery]);

  // Filtered and sorted ELF symbols
  const filteredElfSymbols = useMemo(() => {
    let result = [...elfSymbols];

    // Apply search filter
    if (elfSearchQuery.trim()) {
      const query = elfSearchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(query));
    }

    // Apply type filter
    if (elfFilterTypes.size > 0) {
      result = result.filter(s => elfFilterTypes.has(s.type_str));
    }

    // Apply section filter
    if (elfFilterSections.size > 0) {
      result = result.filter(s => elfFilterSections.has(s.section));
    }

    // Apply bind filter
    if (elfFilterBinds.size > 0) {
      result = result.filter(s => elfFilterBinds.has(s.bind));
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      switch (elfSortColumn) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'address':
          comparison = a.address - b.address;
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'type':
          comparison = a.type_str.localeCompare(b.type_str);
          break;
      }
      return elfSortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [elfSymbols, elfSearchQuery, elfFilterTypes, elfFilterSections, elfFilterBinds, elfSortColumn, elfSortDirection]);

  // Names of all symbols that act as struct parents (have at least one member child across ALL loaded symbols)
  const structParentNames = useMemo(() => {
    const parents = new Set<string>();
    elfSymbols.forEach(s => {
      if (s.is_struct_member && s.parent_struct) parents.add(s.parent_struct);
    });
    return parents;
  }, [elfSymbols]);

  // Display rows: struct members are grouped under their parent with indentation.
  // When a struct parent is collapsed its children are hidden.
  const elfDisplayRows = useMemo(() => {
    const membersByParent = new Map<string, ElfSymbol[]>();
    const topLevelRows: ElfSymbol[] = [];

    for (const sym of filteredElfSymbols) {
      if (sym.is_struct_member && sym.parent_struct) {
        if (!membersByParent.has(sym.parent_struct)) membersByParent.set(sym.parent_struct, []);
        membersByParent.get(sym.parent_struct)!.push(sym);
      } else {
        topLevelRows.push(sym);
      }
    }

    const rows: ElfSymbol[] = [];
    const insertedParents = new Set<string>();
    for (const sym of topLevelRows) {
      rows.push(sym);
      insertedParents.add(sym.name);
      if (structParentNames.has(sym.name) && !collapsedStructs.has(sym.name)) {
        const members = membersByParent.get(sym.name) ?? [];
        rows.push(...members);
      }
    }
    // Orphaned members whose parent was filtered out — still show them
    for (const [parentName, members] of membersByParent) {
      if (!insertedParents.has(parentName)) rows.push(...members);
    }
    return rows;
  }, [filteredElfSymbols, structParentNames, collapsedStructs]);

  // Selectable symbols are non-struct-parent rows (struct parents cannot be added as scalar A2L entries)
  const selectableDisplayRows = useMemo(
    () => elfDisplayRows.filter(s => !structParentNames.has(s.name)),
    [elfDisplayRows, structParentNames],
  );

  // Get unique values for filter dropdowns
  const elfTypeOptions = useMemo(() => [...new Set(elfSymbols.map(s => s.type_str))].sort(), [elfSymbols]);
  const elfSectionOptions = useMemo(() => [...new Set(elfSymbols.map(s => s.section))].filter(s => s).sort(), [elfSymbols]);
  const elfBindOptions = useMemo(() => [...new Set(elfSymbols.map(s => s.bind))].sort(), [elfSymbols]);

  // Count address overflow warnings
  const addressOverflowCount = useMemo(() =>
    elfSymbols.filter(s => s.address_warning).length,
  [elfSymbols]);

  const DEFAULT_SECTION_LIMIT = 500;
  const SEARCH_ACTIVE_LIMIT = Infinity;
  const RECENT_A2L_KEY = "opent-a2l-recents";
  const RECENT_ELF_KEY = "opent-elf-recents";

  const loadRecents = (key: string): RecentFile[] => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as RecentFile[];
      // Only return entries that represent a valid path, otherwise we can't reload them
      return Array.isArray(parsed) ? parsed.filter(f => !!f.path) : [];
    } catch {
      return [];
    }
  };

  const saveRecents = (key: string, entries: RecentFile[]) => {
    window.localStorage.setItem(key, JSON.stringify(entries.slice(0, 8)));
  };

  const addRecentFile = (
    key: string,
    current: RecentFile[],
    setCurrent: Dispatch<SetStateAction<RecentFile[]>>,
    next: RecentFile,
  ) => {
    const filtered = current.filter((entry) => entry.name !== next.name || entry.path !== next.path);
    const updated = [next, ...filtered].slice(0, 8);
    setCurrent(updated);
    saveRecents(key, updated);
  };

  useEffect(() => {
    setRecentA2lFiles(loadRecents(RECENT_A2L_KEY));
    setRecentElfFiles(loadRecents(RECENT_ELF_KEY));
  }, []);

  const treeItemLookup = useMemo(() => {
    const map = new Map<string, A2lTreeItem>();
    if (!a2lTree) return map;
    a2lTree.modules.forEach((module) => {
      module.sections.forEach((section) => {
        section.items.forEach((item) => {
          map.set(`item-${item.id}`, item);
        });
      });
    });
    return map;
  }, [a2lTree]);

  const selectedItem = selectedTreeItemIds.length === 1 ? treeItemLookup.get(selectedTreeItemIds[0]) ?? null : null;

  // Build a flat ordered list of visible item IDs for shift-select range
  const flatVisibleItemIds = useMemo(() => {
    if (!filteredTree) return [] as string[];
    const ids: string[] = [];
    filteredTree.modules.forEach((module) => {
      module.sections.forEach((section) => {
        const isSearching = searchQuery.trim().length > 0;
        const limit = isSearching ? 200 : (sectionItemLimit[section.id] ?? 50);
        const visible = section.items.slice(0, limit);
        visible.forEach((item) => ids.push(`item-${item.id}`));
      });
    });
    return ids;
  }, [filteredTree, searchQuery, sectionItemLimit]);

  const handleTreeItemClick = useCallback((itemId: string, event: React.MouseEvent) => {
    // Only allow multi-select on leaf items (item-*)
    if (!itemId.startsWith("item-")) return;

    if (event.shiftKey && lastClickedTreeItemRef.current) {
      // Shift-click: select range
      const lastIdx = flatVisibleItemIds.indexOf(lastClickedTreeItemRef.current);
      const curIdx = flatVisibleItemIds.indexOf(itemId);
      if (lastIdx >= 0 && curIdx >= 0) {
        const start = Math.min(lastIdx, curIdx);
        const end = Math.max(lastIdx, curIdx);
        const rangeIds = flatVisibleItemIds.slice(start, end + 1);
        setSelectedTreeItemIds(rangeIds);
        return;
      }
    }

    if (event.ctrlKey || event.metaKey) {
      // Ctrl-click: toggle individual item
      setSelectedTreeItemIds((prev) =>
        prev.includes(itemId)
          ? prev.filter((id) => id !== itemId)
          : [...prev, itemId]
      );
    } else {
      // Normal click: single select
      setSelectedTreeItemIds([itemId]);
    }
    lastClickedTreeItemRef.current = itemId;
  }, [flatVisibleItemIds]);

  useEffect(() => {
    if (!a2lTree) {
      setSelectedTreeItemIds((prev) => prev.length === 0 ? prev : []);
      return;
    }
    if (selectedTreeItemIds.length > 0 && selectedTreeItemIds.some((id) => treeItemLookup.has(id))) {
      return;
    }
    const firstItem = a2lTree.modules[0]?.sections[0]?.items[0];
    if (firstItem) {
      setSelectedTreeItemIds([`item-${firstItem.id}`]);
    } else {
      setSelectedTreeItemIds((prev) => prev.length === 0 ? prev : []);
    }
  }, [a2lTree, selectedTreeItemIds, treeItemLookup]);

  useEffect(() => {
    if (!a2lTree) {
      setExpandedItems([]);
      setSectionItemLimit({});
      return;
    }
    const initialExpanded = a2lTree.modules.map((module) => `module-${module.id}`);
    setExpandedItems((current) => (current.length ? current : initialExpanded));
    setSectionItemLimit({});
  }, [a2lTree]);

  // Initialize selected module when metadata loads
  useEffect(() => {
    if (metadata && metadata.module_names.length > 0 && !selectedModule) {
      const stored = localStorage.getItem('elf_target_module');
      const defaultModule = (stored && metadata.module_names.includes(stored))
        ? stored
        : metadata.module_names[0];
      setSelectedModule(defaultModule);
    }
  }, [metadata, selectedModule]);

  function pushStatus(type: StatusType, message: string, autoClear = true) {
    if (statusTimeoutRef.current) {
      window.clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }
    setStatus({ type, message });
    // Errors never auto-dismiss — user must acknowledge them
    if (autoClear && type !== "error") {
      statusTimeoutRef.current = window.setTimeout(() => {
        setStatus(null);
      }, 3500);
    }
  }

  // Listen for ELF file change events from the backend
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>("elf-changed", () => {
      setElfChangedBanner(true);
      pushStatus("info", "ELF file changed on disk.");
    }).then((fn) => { unlisten = fn; }).catch(() => {});
    return () => { unlisten?.(); };
  }, []);

  async function handleUpdateEcuAddresses() {
    if (!metadata || elfSymbols.length === 0) return;
    setIsBusy(true);
    try {
      const result = await invoke<{ updated_count: number; matched_names: string[] }>(
        "update_ecu_addresses",
        { moduleName: selectedModule || metadata.module_names[0] }
      );
      pushStatus("success", `Updated ${result.updated_count} ECU addresses.`);
      setIsDirty(true);
      await refreshTree();
    } catch (e) {
      pushStatus("error", `Update ECU addresses failed: ${e}`);
    } finally {
      setIsBusy(false);
      setElfChangedBanner(false);
    }
  }

  async function handleReloadElf() {
    setElfChangedBanner(false);
    if (currentElfPath) {
      await handleLoadElfFromPath(currentElfPath);
    } else if (elfFileName) {
      const recentElf = recentElfFiles.find(f => f.name === elfFileName);
      if (recentElf?.path) {
        await handleLoadElfFromPath(recentElf.path);
      }
    }
  }

  // --- Handlers ---

  async function handleOpenA2lDialog() {
    if (isDirty) {
      setPendingAction(() => () => handleOpenA2lDialog());
      setShowUnsavedDialog(true);
      return;
    }
    const filePath = await open({
      title: "Open A2L File",
      multiple: false,
      filters: [
        { name: "A2L Files", extensions: ["a2l"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (filePath) {
      await handleLoadA2lFromPath(filePath as string);
    }
  }

  async function handleLoadA2lFromPath(filePath: string) {
    setIsBusy(true);
    pushStatus("info", "Loading ...", false);
    const name = filePath.split(/[\\/]/).pop() || filePath;
    setFileName(name);
    setCurrentFilePath(filePath);

    try {
      const result = await invoke<A2lMetadata>("load_a2l_from_path", { path: filePath });
      setMetadata(result);
      const tree = await invoke<A2lTree>("list_a2l_tree");
      setA2lTree(tree);

      addRecentFile(RECENT_A2L_KEY, recentA2lFiles, setRecentA2lFiles, {
        name,
        path: filePath,
        lastOpened: Date.now(),
      });
      setIsDirty(false);
      pushStatus("success", "Loaded successfully.");
    } catch (e) {
      console.error(e);
      pushStatus("error", `Load failed: ${e}`, false);
    } finally {
      setIsBusy(false);
    }
  }

    async function handleCreateA2l() {
    if (isDirty) {
      setPendingAction(() => () => handleCreateA2l());
      setShowUnsavedDialog(true);
      return;
    }
    if (isBusy) return;
    setIsBusy(true);
    pushStatus("info", "Creating new A2L...", false);
    const contents = `ASAP2_VERSION 1 71\n/begin PROJECT new_project ""\n  /begin MODULE new_module ""\n  /end MODULE\n/end PROJECT`;
    setFileName("new_project.a2l");
    setCurrentFilePath(null);
    try {
        const result = await invoke<A2lMetadata>("load_a2l_from_string", { contents });
        setMetadata(result);
        const tree = await invoke<A2lTree>("list_a2l_tree");
        setA2lTree(tree);
        pushStatus("success", "New A2L created.");
    } catch (e) {
        pushStatus("error", "Create failed");
    } finally {
        setIsBusy(false);
    }
  }

  async function handleSaveA2l() {
    if (isBusy || !metadata) return;
    setIsBusy(true);
    
    try {
        if (currentFilePath) {
             pushStatus("info", "Saving...", false);
             await invoke("save_a2l_to_path", { path: currentFilePath });
             setIsDirty(false);
             pushStatus("success", "Saved successfully.");
        } else {
             const savePath = await save({
                 title: "Save A2L File",
                 defaultPath: fileName || "new_project.a2l",
                 filters: [
                     { name: "A2L Files", extensions: ["a2l"] },
                     { name: "All Files", extensions: ["*"] },
                 ],
             });
             if (savePath) {
                 pushStatus("info", "Saving...", false);
                 await invoke("save_a2l_to_path", { path: savePath });
                 setCurrentFilePath(savePath);
                 setFileName(savePath.split(/[\\/]/).pop() || savePath);
                 setIsDirty(false);
                 pushStatus("success", "Saved successfully.");
             }
        }
    } catch (e) {
        pushStatus("error", `Save failed: ${e}`);
    } finally {
        setIsBusy(false);
    }
  }

  // Window Controls
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    try {
      const win = getCurrentWindow();
      const updateState = async () => {
          try { setIsMaximized(await win.isMaximized()); } catch {}
      };
      updateState();

      win.onResized(async () => {
          try { setIsMaximized(await win.isMaximized()); } catch {}
      }).then((fn) => { unlisten = fn; }).catch(() => {});
    } catch {}

    return () => { unlisten?.(); };
  }, []);

  const handleMinimize = () => { try { getCurrentWindow().minimize().catch(() => {}); } catch {} };
  const handleToggleMaximize = async () => {
      try {
          await getCurrentWindow().toggleMaximize();
          setIsMaximized(await getCurrentWindow().isMaximized());
      } catch {}
  };
  const handleClose = () => {
    if (isDirty) {
      setPendingAction(() => () => { try { getCurrentWindow().close().catch(() => {}); } catch {} });
      setShowUnsavedDialog(true);
      return;
    }
    try { getCurrentWindow().close().catch(() => {}); } catch {}
  };

  async function handleOpenElfDialog() {
      const filePath = await open({
          title: "Select ELF Binary",
          multiple: false,
          filters: [
              { name: "ELF Binary", extensions: ["elf", "out", "bin", "axf"] },
              { name: "All Files", extensions: ["*"] }
          ]
      });

      if (filePath) {
          await handleLoadElfFromPath(filePath as string);
      }
  }

  async function handleLoadElfFromPath(filePath: string) {
      setIsBusy(true);
      pushStatus("info", "Loading ELF symbols...", false);

      const fileName = filePath.split(/[\\/]/).pop() || filePath;
      setElfFileName(fileName);
      setCurrentElfPath(filePath);

      try {
          const symbols = await invoke<ElfSymbol[]>("load_elf_symbols", { path: filePath });
          setElfSymbols(symbols);
          setSelectedElfSymbols(new Set());

          // Add to recents
          addRecentFile(RECENT_ELF_KEY, recentElfFiles, setRecentElfFiles, {
             name: fileName, path: filePath, lastOpened: Date.now()
          });

          pushStatus("success", `Loaded ${symbols.length} symbols.`);
      } catch (e) {
          pushStatus("error", `ELF load failed: ${e}`);
          setElfSymbols([]);
      } finally {
          setIsBusy(false);
      }
  }

  async function handleAddSymbols() {
      if (selectedElfSymbols.size === 0) return;
      if (!metadata) {
          pushStatus("error", "No A2L project loaded to add to.");
          return;
      }

      // Prepare symbols with type mappings
      const toAdd = elfDisplayRows.filter(s => selectedElfSymbols.has(s.name));
      const symbolsWithMapping: SymbolWithMapping[] = toAdd.map(s => ({
          name: s.name,
          address: s.address,
          a2l_type: s.suggested_a2l_type,
          lower_limit: s.suggested_limits[0],
          upper_limit: s.suggested_limits[1],
          conversion: "NO_COMPU_METHOD",
          resolution: 1,
          accuracy: 0,
          array_dims: s.array_dims || [],
          enum_values: s.enum_values || [],
      }));

      // Show preview dialog
      setPreviewMeasurements(symbolsWithMapping);
      setShowPreviewDialog(true);
  }

  async function handleConfirmPreview() {
      if (!metadata) return;

      setIsBusy(true);
      setShowPreviewDialog(false);

      try {
          // Check for conflicts
          const conflicts = await invoke<ConflictReport>("check_symbol_conflicts", {
              moduleName: selectedModule || metadata.module_names[0],
              symbols: previewMeasurements,
          });

          if (conflicts.conflicts.length > 0) {
              // Show conflict dialog
              setConflictReport(conflicts);
              setShowConflictDialog(true);
              setIsBusy(false);
              return;
          }

          // No conflicts, proceed with import
          await performImport(previewMeasurements);
      } catch (e) {
          pushStatus("error", `Failed to check conflicts: ${e}`);
          setIsBusy(false);
      }
  }

  async function handleResolveConflicts(action: 'skip' | 'replace') {
      if (!metadata || !conflictReport) return;

      let symbolsToImport = [...previewMeasurements];

      if (action === 'skip') {
          // Skip conflicting symbols
          const conflictNames = new Set(conflictReport.conflicts.map(c => c.symbol_name));
          symbolsToImport = symbolsToImport.filter(s => !conflictNames.has(s.name));
      }
      // If 'replace', we keep all symbols and let backend replace

      setShowConflictDialog(false);
      setIsBusy(true);

      try {
          await performImport(symbolsToImport);
      } catch (e) {
          pushStatus("error", `Failed to import symbols: ${e}`);
      } finally {
          setIsBusy(false);
      }
  }

  async function performImport(symbols: SymbolWithMapping[]) {
      if (!metadata || symbols.length === 0) return;

      interface EntityUpdateResult {
         metadata: A2lMetadata;
         entities: CoreEntity[];
      }

      try {
          const result = await invoke<EntityUpdateResult>("create_characteristics_from_elf", {
              moduleName: selectedModule || metadata.module_names[0],
              symbols: symbols,
          });

          setMetadata(result.metadata);

          // Refresh tree
          const tree = await invoke<A2lTree>("list_a2l_tree");
          setA2lTree(tree);

          pushStatus("success", `Added ${symbols.length} characteristics.`);
          setIsDirty(true);
          setSelectedElfSymbols(new Set());
      } catch (e) {
          pushStatus("error", `Failed to add symbols: ${e}`);
          throw e;
      } finally {
          setIsBusy(false);
      }
  }

  async function handleSaveAsA2l() {
    if (isBusy || !metadata) return;
    const savePath = await save({
      title: "Save A2L File As",
      defaultPath: fileName || "new_project.a2l",
      filters: [
        { name: "A2L Files", extensions: ["a2l"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (savePath) {
      setIsBusy(true);
      pushStatus("info", "Saving...", false);
      try {
        await invoke("save_a2l_to_path", { path: savePath });
        setCurrentFilePath(savePath);
        setFileName(savePath.split(/[\\/]/).pop() || savePath);
        setIsDirty(false);
        pushStatus("success", "Saved successfully.");
      } catch (e) {
        pushStatus("error", `Save failed: ${e}`);
      } finally {
        setIsBusy(false);
      }
    }
  }

  // --- Delete entities ---
  const selectedDeletableItems = useMemo(() => {
    return selectedTreeItemIds
      .map((id) => treeItemLookup.get(id))
      .filter((item): item is A2lTreeItem => item != null);
  }, [selectedTreeItemIds, treeItemLookup]);

  async function handleDeleteEntities() {
    if (selectedDeletableItems.length === 0) return;
    setShowDeleteDialog(false);
    setIsBusy(true);
    try {
      const entities = selectedDeletableItems.map((item) => ({
        kind: item.kind,
        name: item.name,
      }));
      const tree = await invoke<A2lTree>("delete_entities", { entities });
      setA2lTree(tree);
      setSelectedTreeItemIds([]);
      setIsDirty(true);
      pushStatus("success", `Deleted ${entities.length} ${entities.length === 1 ? "entity" : "entities"}.`);
    } catch (e) {
      pushStatus("error", `Delete failed: ${e}`);
    } finally {
      setIsBusy(false);
    }
  }

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "o") { e.preventDefault(); handleOpenA2lDialog(); }
        if (e.key === "s" && e.shiftKey) { e.preventDefault(); handleSaveAsA2l(); }
        else if (e.key === "s") { e.preventDefault(); handleSaveA2l(); }
        if (e.key === "n") { e.preventDefault(); handleCreateA2l(); }
      }
      if (e.key === "Escape" && isEditing) { setIsEditing(false); }
      if (e.key === "Delete" && selectedDeletableItems.length > 0 && !isEditing) {
        e.preventDefault();
        setShowDeleteDialog(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  // --- E2E Test Hooks (expose handlers for binary Playwright tests) ---
  useEffect(() => {
    (window as any).__E2E__ = {
      loadA2lFromPath: handleLoadA2lFromPath,
      loadElfFromPath: handleLoadElfFromPath,
      createA2l: handleCreateA2l,
    };
    return () => { delete (window as any).__E2E__; };
  });

  // --- Render Sections ---

  const renderActivityBar = () => (
    <Box sx={{ width: 48, bgcolor: "#333333", display: "flex", flexDirection: "column", alignItems: "center", py: 1.5 }}>
        <Tooltip title="Explorer" placement="right">
            <IconButton
                data-testid="sidebar-explorer"
                onClick={() => setActiveView("a2l")}
                sx={{
                    mb: 1,
                    color: activeView === "a2l" ? "#fff" : "rgba(255,255,255,0.4)",
                    borderLeft: activeView === "a2l" ? "2px solid #3794ff" : "2px solid transparent",
                    borderRadius: 0,
                    width: "100%"
                }}
            >
                <DescriptionIcon />
            </IconButton>
        </Tooltip>
        <Tooltip title="ELF Symbols" placement="right">
            <IconButton
                data-testid="sidebar-elf"
                onClick={() => setActiveView("elf")}
                sx={{
                    mb: 1,
                    color: activeView === "elf" ? "#fff" : "rgba(255,255,255,0.4)",
                    borderLeft: activeView === "elf" ? "2px solid #3794ff" : "2px solid transparent",
                    borderRadius: 0,
                    width: "100%"
                }}
            >
                <MemoryIcon />
            </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Settings" placement="right">
             <IconButton data-testid="sidebar-settings" onClick={() => setActiveView("settings")} sx={{ color: "rgba(255,255,255,0.4)" }}>
                <SettingsIcon />
            </IconButton>
        </Tooltip>
    </Box>
  );

  const renderSideBar = () => (
    <Box sx={{ 
        minWidth: 280,
        maxWidth: "40vw",
        width: "fit-content",
        bgcolor: "#252526",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid #333",
        whiteSpace: "nowrap",
        overflow: "hidden"
    }}>
        {activeView === "a2l" && (
            <>
                <Box sx={{ p: 1, px: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="overline" data-testid="heading-explorer" sx={{ fontWeight: 600, letterSpacing: 1, color: "#bbb" }}>EXPLORER</Typography>
                    <Stack direction="row">
                        <Tooltip title="New A2L (Ctrl+N)">
                            <IconButton size="small" data-testid="btn-new-a2l" onClick={handleCreateA2l} aria-label="New A2L"><AddIcon fontSize="small" /></IconButton>
                        </Tooltip>
                         <Tooltip title="Open A2L (Ctrl+O)">
                            <IconButton size="small" data-testid="btn-open-a2l" onClick={handleOpenA2lDialog} aria-label="Open A2L">
                                <FolderOpenIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        {metadata && (
                            <Tooltip title="Save A2L (Ctrl+S)">
                                <IconButton size="small" data-testid="btn-save-a2l" onClick={handleSaveA2l} aria-label="Save A2L"><SaveIcon fontSize="small" /></IconButton>
                            </Tooltip>
                        )}
                        {selectedDeletableItems.length > 0 && (
                            <Tooltip title={`Delete selected (${selectedDeletableItems.length})`}>
                                <IconButton size="small" data-testid="btn-delete-entities" onClick={() => setShowDeleteDialog(true)} aria-label="Delete selected" color="error">
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Stack>
                </Box>
                
                {/* Search */}
                <Box sx={{ px: 2, pb: 1 }}>
                     <Paper 
                        variant="outlined" 
                        sx={{ 
                            p: "2px 4px", 
                            display: "flex", 
                            alignItems: "center", 
                            bgcolor: "#333", 
                            border: "1px solid #3c3c3c",
                            "&:focus-within": { border: "1px solid #007acc" }
                        }}
                    >
                        <SearchIcon sx={{ fontSize: 16, color: "#888", ml: 1, mr: 1 }} />
                         <InputBase
                            data-testid="search-entities"
                            placeholder="Search entities..."
                            sx={{ ml: 1, flex: 1, fontSize: 12 }}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                     </Paper>
                </Box>

                {!metadata && recentA2lFiles.length > 0 && (
                    <Box sx={{ flex: 1, overflow: "auto" }} data-testid="recent-a2l-list">
                        <Typography variant="caption" sx={{ px: 2, pb: 1, display: "block", color: "#888", mt: 2 }}>RECENT</Typography>
                        <List dense>
                            {recentA2lFiles.map(file => (
                                <ListItemButton key={file.name + file.lastOpened} onClick={() => {
                                    if (file.path) {
                                      if (isDirty) {
                                        setPendingAction(() => () => handleLoadA2lFromPath(file.path!));
                                        setShowUnsavedDialog(true);
                                        return;
                                      }
                                      handleLoadA2lFromPath(file.path);
                                    }
                                }}>
                                    <ListItemIcon sx={{ minWidth: 32 }}><DescriptionIcon fontSize="small" sx={{ fontSize: 16 }} /></ListItemIcon>
                                    <ListItemText 
                                        primary={file.name} 
                                        secondary={file.path} 
                                        primaryTypographyProps={{ noWrap: true, fontSize: 12 }} 
                                        secondaryTypographyProps={{ noWrap: true, fontSize: 10, color: "#666" }} 
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                    </Box>
                )}

                {metadata && filteredTree && (
                    <Box sx={{ flex: 1, overflow: "auto" }} data-testid="entity-tree">
                        <SimpleTreeView
                            multiSelect
                            selectedItems={selectedTreeItemIds}
                            onSelectedItemsChange={() => { /* handled by onClick on TreeItem */ }}
                            expandedItems={expandedItems}
                            onExpandedItemsChange={(_, itemIds) => setExpandedItems(itemIds)}
                            slots={{
                                expandIcon: KeyboardArrowRight,
                                collapseIcon: KeyboardArrowDown,
                            }}
                            sx={{
                                "& .MuiTreeItem-content": {
                                    py: 0.5, px: 1, borderRadius: 1,
                                    "&.Mui-selected": { bgcolor: "#37373d !important" },
                                }
                            }}
                        >
                            {filteredTree.modules.map((module) => (
                                <TreeItem key={module.id} itemId={`module-${module.id}`} label={
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <Extension fontSize="small" color="warning" sx={{ fontSize: 16 }} />
                                        <Typography variant="body2" fontWeight={600}>{module.name}</Typography>
                                    </Stack>
                                }>
                                    {module.sections.map(section => {
                                         const isSearching = searchQuery.trim().length > 0;
                                         const limit = isSearching ? SEARCH_ACTIVE_LIMIT : (sectionItemLimit[section.id] ?? DEFAULT_SECTION_LIMIT);
                                         const visibleItems = expandedItems.includes(`section-${section.id}`) ? section.items.slice(0, limit) : [];
                                         const remaining = section.items.length - visibleItems.length;
                                         return (
                                            <TreeItem key={section.id} itemId={`section-${section.id}`} label={
                                                <Typography variant="caption" color="text.secondary">{section.title} <span style={{opacity: 0.5}}>({section.items.length})</span></Typography>
                                            }>
                                                {visibleItems.map(item => (
                                                    <TreeItem key={item.id} itemId={`item-${item.id}`}
                                                        onClick={(e) => { e.stopPropagation(); handleTreeItemClick(`item-${item.id}`, e); }}
                                                        label={
                                                        <Tooltip title={item.description || ""} placement="right" enterDelay={500}>
                                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                                <Box sx={{ display: "flex" }}>{getKindIcon(item.kind)}</Box>
                                                                <Typography variant="body2" noWrap sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>{item.name}</Typography>
                                                            </Stack>
                                                        </Tooltip>
                                                    } />
                                                ))}
                                                {remaining > 0 && (
                                                    <Stack direction="row" spacing={1} sx={{ ml: 2, mt: 0.5 }}>
                                                     <Button
                                                        data-testid={`btn-load-more-${section.id}`}
                                                        size="small"
                                                        sx={{ fontSize: 10, justifyContent: "flex-start" }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSectionItemLimit(c => ({...c, [section.id]: (c[section.id] ?? DEFAULT_SECTION_LIMIT) + 500 }));
                                                        }}
                                                     >
                                                        Load 500 more ({remaining} remaining)
                                                     </Button>
                                                     <Button
                                                        data-testid={`btn-load-all-${section.id}`}
                                                        size="small"
                                                        sx={{ fontSize: 10, justifyContent: "flex-start" }}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSectionItemLimit(c => ({...c, [section.id]: Infinity }));
                                                        }}
                                                     >
                                                        Load all
                                                     </Button>
                                                    </Stack>
                                                )}
                                            </TreeItem>
                                         );
                                    })}
                                </TreeItem>
                            ))}
                        </SimpleTreeView>
                    </Box>
                )}
            </>
        )}
        {activeView === "elf" && (
            <Box sx={{ p: 2, overflow: "hidden", overflowY: "auto", flex: 1 }}>
                <Typography variant="overline" data-testid="heading-elf-inspector">ELF INSPECTOR</Typography>
                <Divider sx={{ my: 2 }} />
                <Button data-testid="btn-load-elf" variant="outlined" fullWidth startIcon={<FolderOpenIcon />} onClick={handleOpenElfDialog}>
                    Load ELF Binary
                </Button>

                {recentElfFiles.length > 0 && (
                    <Box sx={{ mt: 3 }} data-testid="recent-elf-list">
                         <Typography variant="caption" color="text.secondary">RECENT</Typography>
                         <List dense>
                            {recentElfFiles.map(file => (
                                <ListItemButton key={file.name + file.lastOpened} onClick={() => {
                                    if (file.path) handleLoadElfFromPath(file.path)
                                }}>
                                    <ListItemIcon sx={{ minWidth: 32 }}><MemoryIcon fontSize="small" sx={{ fontSize: 16 }} /></ListItemIcon>
                                    <ListItemText primary={file.name} secondary={file.path} primaryTypographyProps={{noWrap:true, fontSize: 12}} secondaryTypographyProps={{noWrap:true, fontSize: 10}} />
                                </ListItemButton>
                            ))}
                         </List>
                    </Box>
                )}
            </Box>
        )}
        {activeView === "settings" && (
             <Box sx={{ p: 2 }}>
                <Typography variant="overline" data-testid="heading-settings">SETTINGS</Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Recent Files</Typography>
                <Button size="small" variant="outlined" onClick={() => {
                    setRecentA2lFiles([]);
                    setRecentElfFiles([]);
                    localStorage.removeItem(RECENT_A2L_KEY);
                    localStorage.removeItem(RECENT_ELF_KEY);
                    pushStatus("info", "Recent files cleared.");
                }}>Clear Recent Files</Button>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Keyboard Shortcuts</Typography>
                <Box sx={{ fontSize: 12, fontFamily: "monospace", color: "#aaa" }}>
                    <Typography variant="caption" display="block">Ctrl+N &emsp; New A2L</Typography>
                    <Typography variant="caption" display="block">Ctrl+O &emsp; Open A2L</Typography>
                    <Typography variant="caption" display="block">Ctrl+S &emsp; Save</Typography>
                    <Typography variant="caption" display="block">Ctrl+Shift+S &emsp; Save As</Typography>
                    <Typography variant="caption" display="block">Escape &emsp; Cancel Edit</Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>About</Typography>
                <Typography variant="body2" color="text.secondary">OpenT A2L Forge v0.1.0</Typography>
                <Typography variant="caption" color="text.secondary" display="block">Tauri + React + Rust</Typography>
            </Box>
        )}
    </Box>
  );

  const renderMainArea = () => {
    if (activeView === "elf") {
        return (
             <Box sx={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", bgcolor: "#1e1e1e", overflow: "hidden" }}>
                  <Box sx={{ p: 2, px: 3, borderBottom: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "space-between", height: 50, bgcolor: "#252526" }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                          <MemoryIcon sx={{ color: "#4ec9b0" }} />
                          <Typography variant="h6" sx={{ fontSize: 14 }}>ELF Symbols</Typography>
                          {elfSymbols.length > 0 && <Chip label={`${filteredElfSymbols.length} of ${elfSymbols.length}`} size="small" variant="outlined" sx={{ height: 20 }} />}
                          {selectedElfSymbols.size > 0 && <Chip label={`${selectedElfSymbols.size} Selected`} size="small" color="primary" sx={{ height: 20 }} />}                      </Stack>
                      <Stack direction="row" spacing={1}>
                          {metadata && elfSymbols.length > 0 && (
                              <Button
                                  data-testid="btn-update-ecu"
                                  variant="outlined"
                                  size="small"
                                  onClick={handleUpdateEcuAddresses}
                                  disabled={isBusy}
                              >
                                  Update ECU Addresses
                              </Button>
                          )}
                          {metadata && metadata.module_names.length > 1 && (
                              <TextField
                                  data-testid="select-module"
                                  select
                                  size="small"
                                  label="Module"
                                  value={selectedModule || metadata.module_names[0]}
                                  onChange={(e) => {
                                      setSelectedModule(e.target.value);
                                      localStorage.setItem('elf_target_module', e.target.value);
                                  }}
                                  sx={{ minWidth: 140 }}
                              >
                                  {metadata.module_names.map(name => (
                                      <MenuItem key={name} value={name}>{name}</MenuItem>
                                  ))}
                              </TextField>
                          )}
                          <Tooltip title={!metadata ? "Load an A2L project first" : selectedElfSymbols.size === 0 ? "Select symbols from the table below" : ""}>
                              <span>
                                  <Button
                                      data-testid="btn-add-to-a2l"
                                      variant="contained"
                                      disabled={selectedElfSymbols.size === 0 || !metadata}
                                      startIcon={<AddIcon />}
                                      size="small"
                                      onClick={handleAddSymbols}
                                  >
                                      Add to Project
                                  </Button>
                              </span>
                          </Tooltip>
                      </Stack>
                  </Box>

                  {elfChangedBanner && (
                      <Alert data-testid="banner-elf-changed" severity="info" sx={{ mx: 2, mt: 1 }} action={
                          <Stack direction="row" spacing={1}>
                              <Button size="small" color="inherit" onClick={handleReloadElf}>Reload</Button>
                              <Button size="small" color="inherit" onClick={() => setElfChangedBanner(false)}>Dismiss</Button>
                          </Stack>
                      }>
                          ELF file changed on disk. Reload to update symbols.
                      </Alert>
                  )}

                  {elfSymbols.length > 0 && (
                      <Box sx={{ p: 2, px: 3, borderBottom: "1px solid #333", bgcolor: "#252526" }}>
                          <TextField
                              data-testid="search-elf"
                              fullWidth
                              size="small"
                              placeholder="Search symbols..."
                              value={elfSearchQuery}
                              onChange={(e) => setElfSearchQuery(e.target.value)}
                              InputProps={{
                                  startAdornment: <SearchIcon sx={{ mr: 1, color: "#888" }} />
                              }}
                              sx={{ mb: 1 }}
                          />
                          <Stack direction="row" spacing={1}>
                              <TextField
                                  data-testid="filter-type"
                                  select
                                  size="small"
                                  label="Type"
                                  sx={{ minWidth: 120 }}
                                  SelectProps={{
                                      multiple: true,
                                      value: Array.from(elfFilterTypes),
                                      onChange: (e) => setElfFilterTypes(new Set(e.target.value as string[]))
                                  }}
                              >
                                  {elfTypeOptions.map(type => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                              </TextField>
                              <TextField
                                  data-testid="filter-section"
                                  select
                                  size="small"
                                  label="Section"
                                  sx={{ minWidth: 120 }}
                                  SelectProps={{
                                      multiple: true,
                                      value: Array.from(elfFilterSections),
                                      onChange: (e) => setElfFilterSections(new Set(e.target.value as string[]))
                                  }}
                              >
                                  {elfSectionOptions.map(section => <MenuItem key={section} value={section}>{section}</MenuItem>)}
                              </TextField>
                              <TextField
                                  data-testid="filter-bind"
                                  select
                                  size="small"
                                  label="Bind"
                                  sx={{ minWidth: 120 }}
                                  SelectProps={{
                                      multiple: true,
                                      value: Array.from(elfFilterBinds),
                                      onChange: (e) => setElfFilterBinds(new Set(e.target.value as string[]))
                                  }}
                              >
                                  {elfBindOptions.map(bind => <MenuItem key={bind} value={bind}>{bind}</MenuItem>)}
                              </TextField>
                              {(elfFilterTypes.size > 0 || elfFilterSections.size > 0 || elfFilterBinds.size > 0) && (
                                  <Button data-testid="btn-clear-elf-filters" size="small" onClick={() => {
                                      setElfFilterTypes(new Set());
                                      setElfFilterSections(new Set());
                                      setElfFilterBinds(new Set());
                                  }}>Clear Filters</Button>
                              )}
                          </Stack>
                          {addressOverflowCount > 0 && (
                              <Alert severity="warning" sx={{ mt: 1 }}>
                                  {addressOverflowCount} symbols have addresses exceeding 32-bit range and will be truncated.
                              </Alert>
                          )}
                      </Box>
                  )}

                  {elfSymbols.length > 0 ? (
                      <TableContainer sx={{ flex: 1, overflow: "auto" }} data-testid="elf-table">
                          <Table stickyHeader size="small">
                              <TableHead>
                                  <TableRow>
                                      <TableCell padding="checkbox" sx={{ bgcolor: "#1e1e1e" }}>
                                          <Checkbox
                                              data-testid="checkbox-select-all"
                                              checked={selectableDisplayRows.length > 0 && selectableDisplayRows.every(s => selectedElfSymbols.has(s.name))}
                                              indeterminate={selectableDisplayRows.some(s => selectedElfSymbols.has(s.name)) && !selectableDisplayRows.every(s => selectedElfSymbols.has(s.name))}
                                              onChange={(e) => {
                                                  if (e.target.checked) setSelectedElfSymbols(new Set(selectableDisplayRows.map(s => s.name)));
                                                  else setSelectedElfSymbols(new Set());
                                              }}
                                              size="small"
                                          />
                                      </TableCell>
                                      <TableCell data-testid="sort-name" sx={{ bgcolor: "#1e1e1e", fontWeight: 600, cursor: "pointer" }} onClick={() => {
                                          setElfSortColumn('name');
                                          setElfSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                      }}>
                                          Name {elfSortColumn === 'name' && (elfSortDirection === 'asc' ? '↑' : '↓')}
                                      </TableCell>
                                      <TableCell data-testid="sort-address" sx={{ bgcolor: "#1e1e1e", fontWeight: 600, cursor: "pointer" }} onClick={() => {
                                          setElfSortColumn('address');
                                          setElfSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                      }}>
                                          Address {elfSortColumn === 'address' && (elfSortDirection === 'asc' ? '↑' : '↓')}
                                      </TableCell>
                                      <TableCell data-testid="sort-size" sx={{ bgcolor: "#1e1e1e", fontWeight: 600, cursor: "pointer" }} onClick={() => {
                                          setElfSortColumn('size');
                                          setElfSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                      }}>
                                          Size {elfSortColumn === 'size' && (elfSortDirection === 'asc' ? '↑' : '↓')}
                                      </TableCell>
                                      <TableCell data-testid="sort-type" sx={{ bgcolor: "#1e1e1e", fontWeight: 600, cursor: "pointer" }} onClick={() => {
                                          setElfSortColumn('type');
                                          setElfSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
                                      }}>
                                          ELF Type {elfSortColumn === 'type' && (elfSortDirection === 'asc' ? '↑' : '↓')}
                                      </TableCell>
                                      <TableCell sx={{ bgcolor: "#1e1e1e", fontWeight: 600 }}>A2L Type</TableCell>
                                      <TableCell sx={{ bgcolor: "#1e1e1e", fontWeight: 600 }}>DWARF Type</TableCell>
                                      <TableCell sx={{ bgcolor: "#1e1e1e", fontWeight: 600 }}>Section</TableCell>
                                  </TableRow>
                              </TableHead>
                              <TableBody>
                                  {elfDisplayRows.map((row) => {
                                      const isStructParent = structParentNames.has(row.name);
                                      if (isStructParent) {
                                          // Struct parent row: expand/collapse, not directly selectable
                                          const isCollapsed = collapsedStructs.has(row.name);
                                          const memberCount = elfSymbols.filter(s => s.parent_struct === row.name).length;
                                          const allMembersSelected = elfSymbols
                                              .filter(s => s.parent_struct === row.name)
                                              .every(s => selectedElfSymbols.has(s.name));
                                          const someMembersSelected = elfSymbols
                                              .filter(s => s.parent_struct === row.name)
                                              .some(s => selectedElfSymbols.has(s.name));
                                          return (
                                              <TableRow
                                                  key={row.name}
                                                  data-testid={`elf-row-${row.name}`}
                                                  sx={{ cursor: "pointer", bgcolor: "rgba(78,201,176,0.06)", "&:hover": { bgcolor: "rgba(78,201,176,0.10)" } }}
                                                  onClick={() => {
                                                      setCollapsedStructs(prev => {
                                                          const next = new Set(prev);
                                                          if (next.has(row.name)) next.delete(row.name);
                                                          else next.add(row.name);
                                                          return next;
                                                      });
                                                  }}
                                              >
                                                  <TableCell padding="checkbox" onClick={e => e.stopPropagation()}>
                                                      <Checkbox
                                                          data-testid={`checkbox-elf-${row.name}`}
                                                          checked={allMembersSelected && someMembersSelected}
                                                          indeterminate={someMembersSelected && !allMembersSelected}
                                                          size="small"
                                                          onChange={(e) => {
                                                              const members = elfSymbols.filter(s => s.parent_struct === row.name).map(s => s.name);
                                                              const next = new Set(selectedElfSymbols);
                                                              if (e.target.checked) members.forEach(n => next.add(n));
                                                              else members.forEach(n => next.delete(n));
                                                              setSelectedElfSymbols(next);
                                                          }}
                                                      />
                                                  </TableCell>
                                                  <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>
                                                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                                          {isCollapsed ? <KeyboardArrowRight sx={{ fontSize: 16, color: "#4ec9b0" }} /> : <KeyboardArrowDown sx={{ fontSize: 16, color: "#4ec9b0" }} />}
                                                          {row.name}
                                                          <Chip label={`struct · ${memberCount}`} size="small" sx={{ height: 14, fontSize: 9, ml: 0.5, bgcolor: "rgba(78,201,176,0.15)", color: "#4ec9b0" }} />
                                                      </Box>
                                                  </TableCell>
                                                  <TableCell sx={{ fontFamily: "monospace", color: "#4ec9b0" }}>
                                                      0x{row.address.toString(16).toUpperCase()}
                                                      {row.address_warning && <span style={{ color: "#ff9800", marginLeft: 4 }}>⚠</span>}
                                                  </TableCell>
                                                  <TableCell sx={{ fontFamily: "monospace", color: "#4ec9b0" }}>0x{row.size.toString(16).toUpperCase()}</TableCell>
                                                  <TableCell><Chip label={row.type_str} size="small" variant="outlined" sx={{ height: 16, fontSize: 10 }} /></TableCell>
                                                  <TableCell><Chip label="struct" size="small" variant="outlined" sx={{ height: 16, fontSize: 10, color: "#4ec9b0", borderColor: "#4ec9b0" }} /></TableCell>
                                                  <TableCell sx={{ fontFamily: "monospace", color: "#4ec9b0", fontSize: 11 }}>{row.dwarf_type || "—"}</TableCell>
                                                  <TableCell sx={{ color: "#888" }}>{row.section}</TableCell>
                                              </TableRow>
                                          );
                                      }
                                      // Normal / struct member row
                                      return (
                                          <TableRow key={row.name} data-testid={`elf-row-${row.name}`} hover selected={selectedElfSymbols.has(row.name)} onClick={() => {
                                               const next = new Set(selectedElfSymbols);
                                               if (next.has(row.name)) next.delete(row.name);
                                               else next.add(row.name);
                                               setSelectedElfSymbols(next);
                                          }} sx={{ cursor: "pointer", bgcolor: row.address_warning ? "rgba(255, 152, 0, 0.08)" : undefined }}>
                                              <TableCell padding="checkbox">
                                                  <Checkbox
                                                      data-testid={`checkbox-elf-${row.name}`}
                                                      checked={selectedElfSymbols.has(row.name)}
                                                      size="small"
                                                  />
                                              </TableCell>
                                              <TableCell sx={{ fontFamily: "monospace", pl: row.is_struct_member ? 4 : undefined }}>
                                                  {row.is_struct_member ? row.name.split('.').pop() : row.name}
                                                  {row.is_struct_member && (
                                                      <Typography component="span" sx={{ color: "#666", fontSize: 10, ml: 0.5, fontFamily: "monospace" }}>
                                                          ({row.name})
                                                      </Typography>
                                                  )}
                                              </TableCell>
                                              <TableCell sx={{ fontFamily: "monospace", color: "#4ec9b0" }}>
                                                  0x{row.address.toString(16).toUpperCase()}
                                                  {row.address_warning && <span style={{ color: "#ff9800", marginLeft: 4 }}>⚠</span>}
                                              </TableCell>
                                              <TableCell sx={{ fontFamily: "monospace", color: "#4ec9b0" }}>0x{row.size.toString(16).toUpperCase()}</TableCell>
                                              <TableCell><Chip label={row.type_str} size="small" variant="outlined" sx={{ height: 16, fontSize: 10 }} /></TableCell>
                                              <TableCell><Chip label={row.suggested_a2l_type} size="small" color="primary" sx={{ height: 16, fontSize: 10 }} /></TableCell>
                                              <TableCell sx={{ fontFamily: "monospace", color: row.dwarf_type ? "#ce9178" : "#555", fontSize: 11 }}>
                                                  {row.dwarf_type || "—"}
                                              </TableCell>
                                              <TableCell sx={{ color: "#888" }}>{row.section}</TableCell>
                                          </TableRow>
                                      );
                                  })}
                              </TableBody>
                          </Table>
                      </TableContainer>
                  ) : (
                      <Box sx={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: 0.5 }}>
                          <Typography>Load an ELF binary from the sidebar to view symbols.</Typography>
                      </Box>
                  )}
            </Box>
        );
    }

    if (!selectedItem) {
        // Multi-select info panel
        if (selectedDeletableItems.length > 1) {
            return (
                <Box sx={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                    <DataObject sx={{ fontSize: 64, mb: 2, color: "#555" }} />
                    <Typography variant="h5" sx={{ color: "#aaa", mb: 1 }}>{selectedDeletableItems.length} entities selected</Typography>
                    <Typography variant="body2" sx={{ color: "#666", mb: 3 }}>
                        Use the Delete key or the delete button in the toolbar to remove selected entities.
                    </Typography>
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        data-testid="btn-delete-selected"
                        onClick={() => setShowDeleteDialog(true)}
                    >
                        Delete {selectedDeletableItems.length} entities
                    </Button>
                </Box>
            );
        }
        return (
            <Box sx={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                <DataObject sx={{ fontSize: 64, mb: 2, color: "#333" }} />
                <Typography variant="h5" sx={{ color: "#555", mb: 1 }}>OpenT A2L Forge</Typography>
                <Typography variant="body2" sx={{ color: "#666", mb: 3 }}>
                    {metadata ? "Select an entity from the Explorer to view details" : "Open or create an A2L file to get started"}
                </Typography>
                {!metadata && (
                    <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
                        <Button variant="outlined" size="small" startIcon={<FolderOpenIcon />} onClick={handleOpenA2lDialog}>Open A2L</Button>
                        <Button variant="outlined" size="small" startIcon={<NoteAddIcon />} onClick={handleCreateA2l}>New A2L</Button>
                    </Stack>
                )}
                <Box sx={{ color: "#555", fontSize: 11, textAlign: "left" }}>
                    <Typography variant="caption" display="block" sx={{ fontFamily: "monospace" }}>Ctrl+O &nbsp; Open File</Typography>
                    <Typography variant="caption" display="block" sx={{ fontFamily: "monospace" }}>Ctrl+N &nbsp; New File</Typography>
                    <Typography variant="caption" display="block" sx={{ fontFamily: "monospace" }}>Ctrl+S &nbsp; Save</Typography>
                </Box>
            </Box>
        );
    }

    // Editor Area
    return (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", bgcolor: "#1e1e1e" }}>
            {/* Tab/Breadcrumb Header */}
            <Box sx={{ height: 36, bgcolor: "#2d2d2d", display: "flex", alignItems: "center", px: 2, borderBottom: "1px solid #333" }}>
                <Stack direction="row" spacing={1} alignItems="center">
                    {getKindIcon(selectedItem.kind)}
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{selectedItem.name}</Typography>
                    {isEditing && <Chip label="Editing" size="small" color="primary" sx={{ height: 16, fontSize: 10 }} />}
                </Stack>
                <Box sx={{ flex: 1 }} />
                {!isEditing && ["Measurement", "Characteristic", "AxisPts"].includes(selectedItem.kind) && (
                     <Button
                        data-testid="btn-edit"
                        startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                        size="small"
                        variant="contained"
                        color="primary"
                        sx={{ height: 24, textTransform: "none", fontSize: 11 }}
                        onClick={() => setIsEditing(true)}
                     >
                        Edit Entity
                     </Button>
                )}
            </Box>

            {/* Content Body */}
            <Box sx={{ flex: 1, overflow: "auto", p: 4 }}>
                {isEditing ? (
                     <Paper sx={{ p: 3, maxWidth: 800, mx: "auto", border: "1px solid #444" }}>
                        {selectedItem.kind === "Measurement" && (
                            <MeasurementEditor 
                                initialName={selectedItem.name} 
                                onSave={() => { setIsEditing(false); refreshTree(); }} 
                                onCancel={() => setIsEditing(false)} 
                            />
                        )}
                        {selectedItem.kind === "Characteristic" && (
                            <CharacteristicEditor 
                                initialName={selectedItem.name} 
                                onSave={() => { setIsEditing(false); refreshTree(); }} 
                                onCancel={() => setIsEditing(false)} 
                            />
                        )}
                        {selectedItem.kind === "AxisPts" && (
                            <AxisPtsEditor 
                                initialName={selectedItem.name} 
                                onSave={() => { setIsEditing(false); refreshTree(); }} 
                                onCancel={() => setIsEditing(false)} 
                            />
                        )}
                     </Paper>
                ) : (
                    <Box data-testid="entity-detail" sx={{ maxWidth: 900, mx: "auto" }}>
                       {/* Header Section */}
                       <Box sx={{ pb: 3, borderBottom: "1px solid #333" }}>
                           <Stack direction="row" alignItems="center" spacing={2}>
                                <Box sx={{ p: 1.2, bgcolor: `${getKindColor(selectedItem.kind)}15`, borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                                    {getKindIcon(selectedItem.kind)}
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="h5" sx={{ fontWeight: 600, lineHeight: 1.3 }}>{selectedItem.name}</Typography>
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.3 }}>
                                        <Chip label={selectedItem.kind} size="small" sx={{ borderRadius: 1, height: 20, fontSize: 10, fontWeight: 600, bgcolor: `${getKindColor(selectedItem.kind)}25`, color: getKindColor(selectedItem.kind), border: "none" }} />
                                        <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: 12 }}>ID: {selectedItem.id}</Typography>
                                    </Stack>
                                </Box>
                           </Stack>
                           {selectedItem.description && (
                               <Typography variant="body2" sx={{ mt: 1.5, fontStyle: "italic", color: "text.secondary", pl: 0.5 }}>
                                   {selectedItem.description}
                               </Typography>
                           )}
                       </Box>

                        {/* Properties — grouped by section, table layout */}
                        {(() => {
                          const sections: Record<string, typeof selectedItem.details> = {};
                          selectedItem.details?.forEach(d => {
                            const sec = getPropertySection(d.label, selectedItem.kind);
                            if (!sections[sec]) sections[sec] = [];
                            sections[sec]!.push(d);
                          });
                          let globalIdx = 0;
                          return Object.entries(sections).map(([section, props]) => (
                            <Box key={section}>
                              <Typography sx={{ color: "#666", fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", mt: 3, mb: 0.5 }}>{section}</Typography>
                              <Divider sx={{ borderColor: "#333", mb: 0.5 }} />
                              {props?.map(d => {
                                const rowIdx = globalIdx++;
                                return (
                                  <Box key={d.label} sx={{ display: "grid", gridTemplateColumns: "180px 1fr", py: 0.8, px: 2, bgcolor: rowIdx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                                      <Typography sx={{ color: "#777", fontSize: 12, textTransform: "uppercase", alignSelf: "center" }}>{d.label}</Typography>
                                      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: "#ccc", wordBreak: "break-all", alignSelf: "center" }}>{d.value}</Typography>
                                  </Box>
                                );
                              })}
                            </Box>
                          ));
                        })()}
                    </Box>
                )}
            </Box>
        </Box>
    );
  };


  return (
    <ThemeProvider theme={ideTheme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", bgcolor: "#1e1e1e", overflow: "hidden" }}>
        
        {/* Custom Titlebar */}
        <Box 
            sx={{ 
                height: 32, 
                display: "flex", 
                alignItems: "center", 
                borderBottom: 1, 
                borderColor: "divider", 
                bgcolor: "#1e1e1e",
                userSelect: "none"
            }} 
        >
             {/* Draggable Area - Title and Spacer */}
             <Box 
                className="titlebar-drag"
                sx={{ 
                    flex: 1,
                    height: "100%",
                    display: "flex", 
                    alignItems: "center", 
                    pl: 2,
                    gap: 1
                }}
                onDoubleClick={handleToggleMaximize}
             >
                <DataObject sx={{ fontSize: 16, color: "#007acc" }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }} data-testid="titlebar-filename">{isDirty ? "\u2022 " : ""}OpenT A2L Forge{fileName ? ` — ${fileName}` : ""}</Typography>
             </Box>

             {/* Window Controls - Non-draggable */}
             <Box 
                className="titlebar-no-drag" 
                sx={{ display: "flex", height: "100%" }}
             >
                <IconButton size="small" data-testid="btn-minimize" onClick={handleMinimize} aria-label="Minimize" sx={{ borderRadius: 0, width: 40, height: "100%", "&:hover":{ bgcolor: "rgba(255,255,255,0.1)"} }}><Minimize sx={{ fontSize: 16 }} /></IconButton>
                <IconButton size="small" data-testid="btn-maximize" onClick={handleToggleMaximize} aria-label="Maximize" sx={{ borderRadius: 0, width: 40, height: "100%", "&:hover":{ bgcolor: "rgba(255,255,255,0.1)"} }}>
                    {isMaximized ? <FilterNone sx={{ fontSize: 14 }} /> : <CropSquare sx={{ fontSize: 14 }} />}
                </IconButton>
                <IconButton size="small" data-testid="btn-close" onClick={handleClose} aria-label="Close" sx={{ borderRadius: 0, width: 40, height: "100%", "&:hover":{ bgcolor: "#c42b1c" } }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
             </Box>
        </Box>

        {/* Menu Bar */}
        <Box sx={{ height: 28, bgcolor: "#333", display: "flex", alignItems: "center", px: 1, borderBottom: "1px solid #444" }}>
            <Button size="small" sx={{ fontSize: 11, color: "#ccc", minWidth: "auto", px: 1, textTransform: "none" }}
                onClick={(e) => setFileMenuAnchor(e.currentTarget)}>File</Button>
            <Menu anchorEl={fileMenuAnchor} open={Boolean(fileMenuAnchor)} onClose={() => setFileMenuAnchor(null)}
                slotProps={{ paper: { sx: { bgcolor: "#252526", color: "#ccc", minWidth: 200 } } }}>
                <MenuItem onClick={() => { handleCreateA2l(); setFileMenuAnchor(null); }} sx={{ fontSize: 13 }}>
                    <ListItemText>New A2L</ListItemText>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: 11 }}>Ctrl+N</Typography>
                </MenuItem>
                <MenuItem onClick={() => { handleOpenA2lDialog(); setFileMenuAnchor(null); }} sx={{ fontSize: 13 }}>
                    <ListItemText>Open A2L...</ListItemText>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: 11 }}>Ctrl+O</Typography>
                </MenuItem>
                <MenuItem onClick={() => { handleSaveA2l(); setFileMenuAnchor(null); }} disabled={!metadata} sx={{ fontSize: 13 }}>
                    <ListItemText>Save</ListItemText>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: 11 }}>Ctrl+S</Typography>
                </MenuItem>
                <MenuItem onClick={() => { handleSaveAsA2l(); setFileMenuAnchor(null); }} disabled={!metadata} sx={{ fontSize: 13 }}>
                    <ListItemText>Save As...</ListItemText>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: 11 }}>Ctrl+Shift+S</Typography>
                </MenuItem>
                {recentA2lFiles.length > 0 && <Divider sx={{ borderColor: "#444" }} />}
                {recentA2lFiles.filter(f => f.path).slice(0, 5).map(f => (
                    <MenuItem key={f.path} onClick={() => {
                      if (f.path) {
                        if (isDirty) {
                          setPendingAction(() => () => handleLoadA2lFromPath(f.path!));
                          setShowUnsavedDialog(true);
                        } else {
                          handleLoadA2lFromPath(f.path);
                        }
                      }
                      setFileMenuAnchor(null);
                    }} sx={{ fontSize: 12 }}>
                        {f.name}
                    </MenuItem>
                ))}
            </Menu>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {renderActivityBar()}
            {renderSideBar()}
            {renderMainArea()}
        </Box>

        {isBusy && <LinearProgress sx={{ height: 2 }} />}
        <StatusBar status={status} fileName={fileName} elfName={elfFileName} isDirty={isDirty} onDismissError={() => setStatus(null)} />

        {/* Conflict Resolution Dialog */}
        <Dialog data-testid="dialog-conflict" open={showConflictDialog} onClose={() => setShowConflictDialog(false)} maxWidth="md" fullWidth>
            <DialogTitle>Symbol Import Conflicts</DialogTitle>
            <DialogContent>
                {conflictReport && (
                    <>
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            {conflictReport.conflicts.length} of {conflictReport.conflicts.length + conflictReport.non_conflicts.length} symbols already exist in the project.
                        </Alert>
                        <TableContainer sx={{ maxHeight: 400 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Symbol Name</TableCell>
                                        <TableCell>Existing</TableCell>
                                        <TableCell>New</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {conflictReport.conflicts.map(conflict => (
                                        <TableRow key={conflict.symbol_name}>
                                            <TableCell>{conflict.symbol_name}</TableCell>
                                            <TableCell>{conflict.existing_address} ({conflict.existing_type})</TableCell>
                                            <TableCell>{conflict.new_address} ({conflict.new_type})</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setShowConflictDialog(false)}>Cancel</Button>
                <Button onClick={() => handleResolveConflicts('skip')} variant="outlined">
                    Skip Conflicts ({conflictReport?.non_conflicts.length || 0} symbols)
                </Button>
                <Button onClick={() => handleResolveConflicts('replace')} variant="contained" color="warning">
                    Replace All
                </Button>
            </DialogActions>
        </Dialog>

        {/* Preview Dialog */}
        <Dialog data-testid="dialog-preview" open={showPreviewDialog} onClose={() => setShowPreviewDialog(false)} maxWidth="lg" fullWidth>
            <DialogTitle>Import Preview - {previewMeasurements.length} symbols selected</DialogTitle>
            <DialogContent>
                <TableContainer sx={{ maxHeight: 500 }}>
                    <Table size="small" stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Address</TableCell>
                                <TableCell>Type</TableCell>
                                <TableCell>Lower Limit</TableCell>
                                <TableCell>Upper Limit</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {previewMeasurements.map((measurement, idx) => (
                                <TableRow key={idx}>
                                    <TableCell sx={{ fontFamily: "monospace" }}>{measurement.name}</TableCell>
                                    <TableCell sx={{ fontFamily: "monospace", color: "#4ec9b0" }}>
                                        0x{measurement.address.toString(16).toUpperCase()}
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            select
                                            size="small"
                                            value={measurement.a2l_type}
                                            onChange={(e) => {
                                                const updated = [...previewMeasurements];
                                                updated[idx].a2l_type = e.target.value;
                                                setPreviewMeasurements(updated);
                                            }}
                                            sx={{ minWidth: 120 }}
                                        >
                                            <MenuItem value="UBYTE">UBYTE</MenuItem>
                                            <MenuItem value="SBYTE">SBYTE</MenuItem>
                                            <MenuItem value="UWORD">UWORD</MenuItem>
                                            <MenuItem value="SWORD">SWORD</MenuItem>
                                            <MenuItem value="ULONG">ULONG</MenuItem>
                                            <MenuItem value="SLONG">SLONG</MenuItem>
                                            <MenuItem value="A_UINT64">A_UINT64</MenuItem>
                                            <MenuItem value="A_INT64">A_INT64</MenuItem>
                                            <MenuItem value="FLOAT32_IEEE">FLOAT32_IEEE</MenuItem>
                                            <MenuItem value="FLOAT64_IEEE">FLOAT64_IEEE</MenuItem>
                                        </TextField>
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            type="number"
                                            value={measurement.lower_limit}
                                            onChange={(e) => {
                                                const updated = [...previewMeasurements];
                                                updated[idx].lower_limit = parseFloat(e.target.value);
                                                setPreviewMeasurements(updated);
                                            }}
                                            sx={{ width: 100 }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <TextField
                                            size="small"
                                            type="number"
                                            value={measurement.upper_limit}
                                            onChange={(e) => {
                                                const updated = [...previewMeasurements];
                                                updated[idx].upper_limit = parseFloat(e.target.value);
                                                setPreviewMeasurements(updated);
                                            }}
                                            sx={{ width: 100 }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setShowPreviewDialog(false)}>Cancel</Button>
                <Button onClick={handleConfirmPreview} variant="contained">
                    Continue to Import
                </Button>
            </DialogActions>
        </Dialog>

        {/* Unsaved Changes Dialog */}
        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} data-testid="delete-dialog">
            <DialogTitle>Delete {selectedDeletableItems.length === 1 ? "Entity" : `${selectedDeletableItems.length} Entities`}</DialogTitle>
            <DialogContent>
                <Typography sx={{ mb: 2 }}>
                    Are you sure you want to delete the following {selectedDeletableItems.length === 1 ? "entity" : "entities"}? This action cannot be undone.
                </Typography>
                <Box sx={{ maxHeight: 200, overflow: "auto", bgcolor: "#1a1a1a", borderRadius: 1, p: 1 }}>
                    {selectedDeletableItems.map((item) => (
                        <Stack key={item.id} direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
                            {getKindIcon(item.kind)}
                            <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>{item.name}</Typography>
                            <Chip label={item.kind} size="small" sx={{ height: 18, fontSize: 10 }} />
                        </Stack>
                    ))}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                <Button onClick={handleDeleteEntities} color="error" variant="contained" data-testid="btn-confirm-delete">Delete</Button>
            </DialogActions>
        </Dialog>

        <Dialog open={showUnsavedDialog} onClose={() => setShowUnsavedDialog(false)}>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogContent>
                <Typography>You have unsaved changes. Do you want to save before continuing?</Typography>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => { setShowUnsavedDialog(false); setPendingAction(null); }}>Cancel</Button>
                <Button onClick={() => {
                    setShowUnsavedDialog(false);
                    setIsDirty(false);
                    if (pendingAction) { pendingAction(); setPendingAction(null); }
                }} color="warning">Don't Save</Button>
                <Button onClick={async () => {
                    setShowUnsavedDialog(false);
                    await handleSaveA2l();
                    if (pendingAction) { pendingAction(); setPendingAction(null); }
                }} variant="contained">Save</Button>
            </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default App;