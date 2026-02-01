import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
  Card,
  CardContent,
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
} from "@mui/icons-material";

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

// --- Icons Helper ---

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

function StatusBar({ status, fileName, elfName }: { status: StatusState | null, fileName: string, elfName: string }) {
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
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
           {status?.type === "error" ? <CloseIcon sx={{ fontSize: 12 }} /> : <Terminal sx={{ fontSize: 12 }} />}
           <span>{status?.message || "Ready"}</span>
        </Box>
      </Stack>
      <Stack direction="row" spacing={3} alignItems="center">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
           <DescriptionIcon sx={{ fontSize: 12, opacity: 0.7 }} />
           <span>{fileName || "No A2L"}</span>
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
  const [status, setStatus] = useState<StatusState | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [elfFileName, setElfFileName] = useState("");
  const [a2lTree, setA2lTree] = useState<A2lTree | null>(null);
  const [selectedTreeItemId, setSelectedTreeItemId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [sectionItemLimit, setSectionItemLimit] = useState<Record<string, number>>({});
  const [recentA2lFiles, setRecentA2lFiles] = useState<RecentFile[]>([]);
  const [recentElfFiles, setRecentElfFiles] = useState<RecentFile[]>([]);
  const [isEditing, setIsEditing] = useState(false);
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

  const DEFAULT_SECTION_LIMIT = 200;
  const RECENT_A2L_KEY = "opent-a2l-recents";
  const RECENT_ELF_KEY = "opent-elf-recents";

  const loadRecents = (key: string): RecentFile[] => {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as RecentFile[];
      return Array.isArray(parsed) ? parsed : [];
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

  const selectedItem = selectedTreeItemId ? treeItemLookup.get(selectedTreeItemId) ?? null : null;

  useEffect(() => {
    if (!a2lTree) {
      setSelectedTreeItemId(null);
      return;
    }
    if (selectedTreeItemId && treeItemLookup.has(selectedTreeItemId)) {
      return;
    }
    const firstItem = a2lTree.modules[0]?.sections[0]?.items[0];
    setSelectedTreeItemId(firstItem ? `item-${firstItem.id}` : null);
  }, [a2lTree, selectedTreeItemId, treeItemLookup]);

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

  function pushStatus(type: StatusType, message: string, autoClear = true) {
    if (statusTimeoutRef.current) {
      window.clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }
    setStatus({ type, message });
    if (autoClear) {
      statusTimeoutRef.current = window.setTimeout(() => {
        setStatus(null);
      }, 3500);
    }
  }

  // --- Handlers ---

  async function handleFileSelect(file?: File | null) {
    if (!file) return;
    setIsBusy(true);
    pushStatus("info", "Loading ...", false);
    const filePath = (file as { path?: string }).path ?? null;
    setFileName(file.name);
    try {
      const contents = await file.text();
      try {
        const result = await invoke<A2lMetadata>("load_a2l_from_string", { contents });
        setMetadata(result);
        const tree = await invoke<A2lTree>("list_a2l_tree");
        setA2lTree(tree);
        addRecentFile(RECENT_A2L_KEY, recentA2lFiles, setRecentA2lFiles, {
            name: file.name, path: filePath, lastOpened: Date.now(),
        });
        pushStatus("success", "Loaded successfully.");
      } catch (error) {
         pushStatus("error", `Backend load failed: ${error}`, false);
      }
    } catch(e) {
        pushStatus("error", "File read error", false);
    } finally {
        setIsBusy(false);
    }
  }

    async function handleCreateA2l() {
    if (isBusy) return;
    setIsBusy(true);
    pushStatus("info", "Creating new A2L...", false);
    const contents = `ASAP2_VERSION 1 71\n/begin PROJECT new_project ""\n  /begin MODULE new_module ""\n  /end MODULE\n/end PROJECT`;
    setFileName("new_project.a2l");
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

  // Window Controls
  const handleMinimize = () => getCurrentWindow().minimize().catch(() => {});
  const handleToggleMaximize = () => getCurrentWindow().toggleMaximize().catch(() => {});
  const handleClose = () => getCurrentWindow().close().catch(() => {});

  // --- Render Sections ---

  const renderActivityBar = () => (
    <Box sx={{ width: 48, bgcolor: "#333333", display: "flex", flexDirection: "column", alignItems: "center", get py() { return 1.5; } }}>
        <Tooltip title="Explorer" placement="right">
            <IconButton 
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
             <IconButton onClick={() => setActiveView("settings")} sx={{ color: "rgba(255,255,255,0.4)" }}>
                <SettingsIcon />
            </IconButton>
        </Tooltip>
    </Box>
  );

  const renderSideBar = () => (
    <Box sx={{ width: 280, bgcolor: "#252526", display: "flex", flexDirection: "column", borderRight: "1px solid #333" }}>
        {activeView === "a2l" && (
            <>
                <Box sx={{ p: 1, px: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="overline" sx={{ fontWeight: 600, letterSpacing: 1, color: "#bbb" }}>EXPLORER</Typography>
                    <Stack direction="row">
                        <Tooltip title="New A2L">
                            <IconButton size="small" onClick={handleCreateA2l}><AddIcon fontSize="small" /></IconButton>
                        </Tooltip>
                         <Tooltip title="Open A2L">
                            <IconButton size="small" component="label">
                                <FolderOpenIcon fontSize="small" />
                                <input type="file" accept=".a2l" hidden onChange={(e) => handleFileSelect(e.target.files?.[0])} />
                            </IconButton>
                        </Tooltip>
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
                            placeholder="Search entities..." 
                            sx={{ ml: 1, flex: 1, fontSize: 12 }} 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                     </Paper>
                </Box>

                {!metadata && recentA2lFiles.length > 0 && (
                    <Box sx={{ flex: 1, overflow: "auto" }}>
                        <Typography variant="caption" sx={{ px: 2, pb: 1, display: "block", color: "#888", mt: 2 }}>RECENT</Typography>
                        <List dense>
                            {recentA2lFiles.map(file => (
                                <ListItemButton key={file.name + file.lastOpened} onClick={() => {
                                    handleFileSelect({ name: file.name, path: file.path } as any); 
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
                    <Box sx={{ flex: 1, overflow: "auto" }}>
                        <SimpleTreeView
                            selectedItems={selectedTreeItemId ?? undefined}
                            onSelectedItemsChange={(_, itemIds) => {
                                const next = Array.isArray(itemIds) ? itemIds[0] : itemIds;
                                setSelectedTreeItemId(next ?? null);
                            }}
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
                                         const limit = sectionItemLimit[section.id] ?? DEFAULT_SECTION_LIMIT;
                                         const visibleItems = expandedItems.includes(`section-${section.id}`) ? section.items.slice(0, limit) : [];
                                         const remaining = section.items.length - visibleItems.length;
                                         return (
                                            <TreeItem key={section.id} itemId={`section-${section.id}`} label={
                                                <Typography variant="caption" color="text.secondary">{section.title} <span style={{opacity: 0.5}}>({section.items.length})</span></Typography>
                                            }>
                                                {visibleItems.map(item => (
                                                    <TreeItem key={item.id} itemId={`item-${item.id}`} label={
                                                        <Stack direction="row" alignItems="center" spacing={1}>
                                                            <Box sx={{ display: "flex" }}>{getKindIcon(item.kind)}</Box>
                                                            <Typography variant="body2" noWrap sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11 }}>{item.name}</Typography>
                                                        </Stack>
                                                    } />
                                                ))}
                                                {remaining > 0 && (
                                                     <Button 
                                                        size="small" 
                                                        sx={{ ml: 2, fontSize: 10, justifyContent: "flex-start" }} 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSectionItemLimit(c => ({...c, [section.id]: (c[section.id] ?? DEFAULT_SECTION_LIMIT) + 200 }));
                                                        }}
                                                     >
                                                        Load more...
                                                     </Button>
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
            <Box sx={{ p: 2 }}>
                <Typography variant="overline">ELF INSPECTOR</Typography>
                <Divider sx={{ my: 2 }} />
                <Button variant="outlined" component="label" fullWidth startIcon={<FolderOpenIcon />}>
                    Load ELF Binary
                    <input type="file" hidden onChange={(e) => setElfFileName(e.target.files?.[0]?.name ?? "")} />
                </Button>
            </Box>
        )}
    </Box>
  );

  const renderMainArea = () => {
    if (!selectedItem) {
        return (
            <Box sx={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: 0.2 }}>
                <DescriptionIcon sx={{ fontSize: 80, mb: 2 }} />
                <Typography variant="h5">OpenT A2L Forge</Typography>
                <Typography>Select a file to begin</Typography>
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
                    <Box sx={{ maxWidth: 900, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                       {/* Header Section */}
                       <Stack direction="row" alignItems="center" spacing={2.5}>
                            <Box sx={{ p: 1.5, bgcolor: "rgba(255,255,255,0.05)", borderRadius: 2 }}>
                                {getKindIcon(selectedItem.kind)}
                            </Box>
                            <Box>
                                <Typography variant="h4" sx={{ fontWeight: 600 }}>{selectedItem.name}</Typography>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                    <Chip label={selectedItem.kind} size="small" variant="outlined" sx={{ borderRadius: 1, height: 20, fontSize: 10, borderColor: "#555" }} />
                                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "monospace" }}>ID: {selectedItem.id}</Typography>
                                </Stack>
                            </Box>
                       </Stack>

                       <Divider />
                       
                       <Box>
                          <Typography variant="subtitle2" sx={{ mb: 1, color: "#888" }}>DESCRIPTION</Typography>
                          <Paper variant="outlined" sx={{ p: 2, bgcolor: "transparent", borderStyle: "dashed", borderColor: "#444" }}>
                             <Typography variant="body1" sx={{ fontStyle: selectedItem.description ? "normal" : "italic", color: selectedItem.description ? "text.primary" : "text.secondary" }}>
                                {selectedItem.description || "No description provided."}
                             </Typography>
                          </Paper>
                       </Box>

                        <Box>
                          <Typography variant="subtitle2" sx={{ mb: 1, color: "#888" }}>PROPERTIES</Typography>
                           <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 2 }}>
                                {selectedItem.details?.map(d => (
                                    <Card key={d.label} variant="outlined" sx={{  bgcolor: "#222", borderColor: "#333" }}>
                                        <CardContent sx={{ pb: "16px !important" }}>
                                            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>{d.label.toUpperCase()}</Typography>
                                            <Typography variant="body1" sx={{ fontFamily: '"JetBrains Mono", monospace', wordBreak: "break-all" }}>{d.value}</Typography>
                                        </CardContent>
                                    </Card>
                                ))}
                           </Box>
                        </Box>
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
        <Box sx={{ height: 32, display: "flex", alignItems: "center", borderBottom: 1, borderColor: "divider", WebkitAppRegion: "drag", bgcolor: "#1e1e1e" }} onDoubleClick={handleToggleMaximize}>
             <Box sx={{ px: 2, display: "flex", alignItems: "center", gap: 1 }}>
                <DataObject sx={{ fontSize: 16, color: "#007acc" }} />
                <Typography variant="caption" sx={{ fontWeight: 600 }}>OpenT A2L Forge</Typography>
             </Box>
             <Box sx={{ flex: 1 }} />
             <Box sx={{ WebkitAppRegion: "no-drag", display: "flex" }}>
                <IconButton size="small" onClick={handleMinimize} sx={{ borderRadius: 0, width: 40, height: 32, "&:hover":{ bgcolor: "rgba(255,255,255,0.1)"} }}><Minimize sx={{ fontSize: 16 }} /></IconButton>
                <IconButton size="small" onClick={handleToggleMaximize} sx={{ borderRadius: 0, width: 40, height: 32, "&:hover":{ bgcolor: "rgba(255,255,255,0.1)"} }}><CropSquare sx={{ fontSize: 14 }} /></IconButton>
                <IconButton size="small" onClick={handleClose} sx={{ borderRadius: 0, width: 40, height: 32, "&:hover":{ bgcolor: "#c42b1c" } }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
             </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {renderActivityBar()}
            {renderSideBar()}
            {renderMainArea()}
        </Box>

        <StatusBar status={status} fileName={fileName} elfName={elfFileName} />
      </Box>
    </ThemeProvider>
  );
}

export default App;