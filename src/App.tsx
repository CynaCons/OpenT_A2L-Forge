import { useEffect, useMemo, useRef, useState, useCallback, type Dispatch, type SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  Box,
  CssBaseline,
  LinearProgress,
  ThemeProvider,
} from "@mui/material";

import "./titlebar.css";

import type {
  A2lMetadata,
  A2lTree,
  A2lTreeItem,
  A2lTreeModule,
  A2lTreeSection,
  ConflictReport,
  ElfSymbol,
  RecentFile,
  StatusState,
  StatusType,
  SymbolWithMapping,
} from "./types";
import { ideTheme } from "./theme";

import { TitleBar } from "./components/layout/TitleBar";
import { MenuBar } from "./components/layout/MenuBar";
import { ActivityBar } from "./components/layout/ActivityBar";
import { StatusBar } from "./components/layout/StatusBar";
import { ExplorerPanel } from "./components/panels/ExplorerPanel";
import { ElfSidebarPanel } from "./components/panels/ElfSidebarPanel";
import { ElfMainPanel } from "./components/panels/ElfMainPanel";
import { SettingsPanel } from "./components/panels/SettingsPanel";
import { EntityDetailPanel } from "./components/panels/EntityDetailPanel";
import { DeleteDialog } from "./components/dialogs/DeleteDialog";
import { ConflictDialog } from "./components/dialogs/ConflictDialog";
import { PreviewDialog } from "./components/dialogs/PreviewDialog";
import { UnsavedDialog } from "./components/dialogs/UnsavedDialog";
import { CreateEntityDialog } from "./components/dialogs/CreateEntityDialog";

const RECENT_A2L_KEY = "opent-a2l-recents";
const RECENT_ELF_KEY = "opent-elf-recents";

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
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const statusTimeoutRef = useRef<number | null>(null);

  // --- Core helpers ---

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

  // --- ELF computed values ---

  const filteredElfSymbols = useMemo(() => {
    let result = [...elfSymbols];

    if (elfSearchQuery.trim()) {
      const query = elfSearchQuery.toLowerCase();
      result = result.filter(s => s.name.toLowerCase().includes(query));
    }

    if (elfFilterTypes.size > 0) {
      result = result.filter(s => elfFilterTypes.has(s.type_str));
    }

    if (elfFilterSections.size > 0) {
      result = result.filter(s => elfFilterSections.has(s.section));
    }

    if (elfFilterBinds.size > 0) {
      result = result.filter(s => elfFilterBinds.has(s.bind));
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (elfSortColumn) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'address': comparison = a.address - b.address; break;
        case 'size': comparison = a.size - b.size; break;
        case 'type': comparison = a.type_str.localeCompare(b.type_str); break;
      }
      return elfSortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [elfSymbols, elfSearchQuery, elfFilterTypes, elfFilterSections, elfFilterBinds, elfSortColumn, elfSortDirection]);

  const structParentNames = useMemo(() => {
    const parents = new Set<string>();
    elfSymbols.forEach(s => {
      if (s.is_struct_member && s.parent_struct) parents.add(s.parent_struct);
    });
    return parents;
  }, [elfSymbols]);

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
    for (const [parentName, members] of membersByParent) {
      if (!insertedParents.has(parentName)) rows.push(...members);
    }
    return rows;
  }, [filteredElfSymbols, structParentNames, collapsedStructs]);

  const selectableDisplayRows = useMemo(
    () => elfDisplayRows.filter(s => !structParentNames.has(s.name)),
    [elfDisplayRows, structParentNames],
  );

  const elfTypeOptions = useMemo(() => [...new Set(elfSymbols.map(s => s.type_str))].sort(), [elfSymbols]);
  const elfSectionOptions = useMemo(() => [...new Set(elfSymbols.map(s => s.section))].filter(s => s).sort(), [elfSymbols]);
  const elfBindOptions = useMemo(() => [...new Set(elfSymbols.map(s => s.bind))].sort(), [elfSymbols]);

  const addressOverflowCount = useMemo(() =>
    elfSymbols.filter(s => s.address_warning).length,
  [elfSymbols]);

  // --- Recent files ---

  const loadRecents = (key: string): RecentFile[] => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as RecentFile[];
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

  // --- Tree selection ---

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
    if (!itemId.startsWith("item-")) return;

    if (event.shiftKey && lastClickedTreeItemRef.current) {
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
      setSelectedTreeItemIds((prev) =>
        prev.includes(itemId)
          ? prev.filter((id) => id !== itemId)
          : [...prev, itemId]
      );
    } else {
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

  useEffect(() => {
    if (metadata && metadata.module_names.length > 0 && !selectedModule) {
      const stored = localStorage.getItem('elf_target_module');
      const defaultModule = (stored && metadata.module_names.includes(stored))
        ? stored
        : metadata.module_names[0];
      setSelectedModule(defaultModule);
    }
  }, [metadata, selectedModule]);

  // --- Status ---

  function pushStatus(type: StatusType, message: string, autoClear = true) {
    if (statusTimeoutRef.current) {
      window.clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }
    setStatus({ type, message });
    if (autoClear && type !== "error") {
      statusTimeoutRef.current = window.setTimeout(() => {
        setStatus(null);
      }, 3500);
    }
  }

  // --- ELF file change listener ---

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen<string>("elf-changed", () => {
      setElfChangedBanner(true);
      pushStatus("info", "ELF file changed on disk.");
    }).then((fn) => { unlisten = fn; }).catch(() => {});
    return () => { unlisten?.(); };
  }, []);

  // --- Handlers ---

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

  // --- Window Controls ---

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

  // --- ELF handlers ---

  async function handleOpenElfDialog() {
    const filePath = await open({
      title: "Select ELF Binary",
      multiple: false,
      filters: [
        { name: "ELF Binary", extensions: ["elf", "out", "bin", "axf"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (filePath) {
      await handleLoadElfFromPath(filePath as string);
    }
  }

  async function handleLoadElfFromPath(filePath: string) {
    setIsBusy(true);
    pushStatus("info", "Loading ELF symbols...", false);

    const elfName = filePath.split(/[\\/]/).pop() || filePath;
    setElfFileName(elfName);
    setCurrentElfPath(filePath);

    try {
      const symbols = await invoke<ElfSymbol[]>("load_elf_symbols", { path: filePath });
      setElfSymbols(symbols);
      setSelectedElfSymbols(new Set());

      addRecentFile(RECENT_ELF_KEY, recentElfFiles, setRecentElfFiles, {
        name: elfName, path: filePath, lastOpened: Date.now(),
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

    setPreviewMeasurements(symbolsWithMapping);
    setShowPreviewDialog(true);
  }

  async function handleConfirmPreview() {
    if (!metadata) return;

    setIsBusy(true);
    setShowPreviewDialog(false);

    try {
      const conflicts = await invoke<ConflictReport>("check_symbol_conflicts", {
        moduleName: selectedModule || metadata.module_names[0],
        symbols: previewMeasurements,
      });

      if (conflicts.conflicts.length > 0) {
        setConflictReport(conflicts);
        setShowConflictDialog(true);
        setIsBusy(false);
        return;
      }

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
      const conflictNames = new Set(conflictReport.conflicts.map(c => c.symbol_name));
      symbolsToImport = symbolsToImport.filter(s => !conflictNames.has(s.name));
    }

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
      entities: { kind: string; name: string; long_identifier?: string | null }[];
    }

    try {
      const result = await invoke<EntityUpdateResult>("create_characteristics_from_elf", {
        moduleName: selectedModule || metadata.module_names[0],
        symbols: symbols,
      });

      setMetadata(result.metadata);

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

  // --- E2E Test Hooks ---

  useEffect(() => {
    (window as any).__E2E__ = {
      loadA2lFromPath: handleLoadA2lFromPath,
      loadElfFromPath: handleLoadElfFromPath,
      createA2l: handleCreateA2l,
    };
    return () => { delete (window as any).__E2E__; };
  });

  // --- Render ---

  return (
    <ThemeProvider theme={ideTheme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh", bgcolor: "#1e1e1e", overflow: "hidden" }}>

        <TitleBar
          fileName={fileName}
          isDirty={isDirty}
          isMaximized={isMaximized}
          onMinimize={handleMinimize}
          onToggleMaximize={handleToggleMaximize}
          onClose={handleClose}
        />

        <MenuBar
          fileMenuAnchor={fileMenuAnchor}
          onFileMenuOpen={(e) => setFileMenuAnchor(e.currentTarget)}
          onFileMenuClose={() => setFileMenuAnchor(null)}
          onCreateA2l={handleCreateA2l}
          onOpenA2lDialog={handleOpenA2lDialog}
          onSaveA2l={handleSaveA2l}
          onSaveAsA2l={handleSaveAsA2l}
          hasMetadata={!!metadata}
          isDirty={isDirty}
          recentA2lFiles={recentA2lFiles}
          onLoadA2lFromPath={handleLoadA2lFromPath}
          onPendingAction={(action) => setPendingAction(() => action)}
          onShowUnsavedDialog={() => setShowUnsavedDialog(true)}
        />

        {/* Content */}
        <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <ActivityBar activeView={activeView} onViewChange={setActiveView} />

          {/* Sidebar */}
          <Box sx={{
            minWidth: 280,
            maxWidth: "40vw",
            width: "fit-content",
            bgcolor: "#252526",
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #333",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}>
            {activeView === "a2l" && (
              <ExplorerPanel
                metadata={metadata}
                filteredTree={filteredTree}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedTreeItemIds={selectedTreeItemIds}
                expandedItems={expandedItems}
                onExpandedItemsChange={setExpandedItems}
                sectionItemLimit={sectionItemLimit}
                onSectionItemLimitChange={setSectionItemLimit}
                selectedDeletableItems={selectedDeletableItems}
                recentA2lFiles={recentA2lFiles}
                isDirty={isDirty}
                onCreateA2l={handleCreateA2l}
                onOpenA2lDialog={handleOpenA2lDialog}
                onSaveA2l={handleSaveA2l}
                onShowDeleteDialog={() => setShowDeleteDialog(true)}
                onShowCreateDialog={() => setShowCreateDialog(true)}
                onTreeItemClick={handleTreeItemClick}
                onLoadA2lFromPath={handleLoadA2lFromPath}
                onPendingAction={(action) => setPendingAction(() => action)}
                onShowUnsavedDialog={() => setShowUnsavedDialog(true)}
              />
            )}
            {activeView === "elf" && (
              <ElfSidebarPanel
                recentElfFiles={recentElfFiles}
                onOpenElfDialog={handleOpenElfDialog}
                onLoadElfFromPath={handleLoadElfFromPath}
              />
            )}
            {activeView === "settings" && (
              <SettingsPanel
                onClearRecents={() => {
                  setRecentA2lFiles([]);
                  setRecentElfFiles([]);
                  localStorage.removeItem(RECENT_A2L_KEY);
                  localStorage.removeItem(RECENT_ELF_KEY);
                  pushStatus("info", "Recent files cleared.");
                }}
              />
            )}
          </Box>

          {/* Main Area */}
          {activeView === "elf" ? (
            <ElfMainPanel
              elfSymbols={elfSymbols}
              filteredElfSymbols={filteredElfSymbols}
              elfDisplayRows={elfDisplayRows}
              selectableDisplayRows={selectableDisplayRows}
              structParentNames={structParentNames}
              selectedElfSymbols={selectedElfSymbols}
              onSelectedElfSymbolsChange={setSelectedElfSymbols}
              collapsedStructs={collapsedStructs}
              onCollapsedStructsChange={setCollapsedStructs}
              elfSearchQuery={elfSearchQuery}
              onElfSearchQueryChange={setElfSearchQuery}
              elfFilterTypes={elfFilterTypes}
              onElfFilterTypesChange={setElfFilterTypes}
              elfFilterSections={elfFilterSections}
              onElfFilterSectionsChange={setElfFilterSections}
              elfFilterBinds={elfFilterBinds}
              onElfFilterBindsChange={setElfFilterBinds}
              elfSortColumn={elfSortColumn}
              onElfSortColumnChange={setElfSortColumn}
              elfSortDirection={elfSortDirection}
              onElfSortDirectionChange={setElfSortDirection}
              elfTypeOptions={elfTypeOptions}
              elfSectionOptions={elfSectionOptions}
              elfBindOptions={elfBindOptions}
              addressOverflowCount={addressOverflowCount}
              metadata={metadata}
              selectedModule={selectedModule}
              onSelectedModuleChange={setSelectedModule}
              isBusy={isBusy}
              elfChangedBanner={elfChangedBanner}
              onDismissElfBanner={() => setElfChangedBanner(false)}
              onReloadElf={handleReloadElf}
              onUpdateEcuAddresses={handleUpdateEcuAddresses}
              onAddSymbols={handleAddSymbols}
            />
          ) : (
            <EntityDetailPanel
              selectedItem={selectedItem}
              selectedDeletableItems={selectedDeletableItems}
              metadata={metadata}
              isEditing={isEditing}
              onSetEditing={setIsEditing}
              onRefreshTree={refreshTree}
              onOpenA2lDialog={handleOpenA2lDialog}
              onCreateA2l={handleCreateA2l}
              onShowDeleteDialog={() => setShowDeleteDialog(true)}
            />
          )}
        </Box>

        {isBusy && <LinearProgress sx={{ height: 2 }} />}
        <StatusBar status={status} fileName={fileName} elfName={elfFileName} isDirty={isDirty} onDismissError={() => setStatus(null)} />

        {/* Dialogs */}
        <ConflictDialog
          open={showConflictDialog}
          conflictReport={conflictReport}
          onClose={() => setShowConflictDialog(false)}
          onResolve={handleResolveConflicts}
        />

        <PreviewDialog
          open={showPreviewDialog}
          measurements={previewMeasurements}
          onMeasurementsChange={setPreviewMeasurements}
          onClose={() => setShowPreviewDialog(false)}
          onConfirm={handleConfirmPreview}
        />

        <DeleteDialog
          open={showDeleteDialog}
          items={selectedDeletableItems}
          onClose={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteEntities}
        />

        <UnsavedDialog
          open={showUnsavedDialog}
          onClose={() => { setShowUnsavedDialog(false); setPendingAction(null); }}
          onDontSave={() => {
            setShowUnsavedDialog(false);
            setIsDirty(false);
            if (pendingAction) { pendingAction(); setPendingAction(null); }
          }}
          onSave={async () => {
            setShowUnsavedDialog(false);
            await handleSaveA2l();
            if (pendingAction) { pendingAction(); setPendingAction(null); }
          }}
        />

        {metadata && (
          <CreateEntityDialog
            open={showCreateDialog}
            moduleName={selectedModule || metadata.module_names[0]}
            onClose={() => setShowCreateDialog(false)}
            onCreated={async () => {
              setIsDirty(true);
              await refreshTree();
              pushStatus("success", "Entity created.");
            }}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
