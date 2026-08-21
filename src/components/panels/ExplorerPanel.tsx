import {
  Box,
  Button,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";
import {
  Description as DescriptionIcon,
  FolderOpen as FolderOpenIcon,
  Add as AddIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  KeyboardArrowDown,
  KeyboardArrowRight,
  Extension,
  NoteAdd as NoteAddIcon,
} from "@mui/icons-material";
import type { A2lMetadata, A2lTree, A2lTreeItem, RecentFile } from "../../types";
import { getKindIcon, tokens } from "../../theme";

interface ExplorerPanelProps {
  metadata: A2lMetadata | null;
  filteredTree: A2lTree | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTreeItemIds: string[];
  expandedItems: string[];
  onExpandedItemsChange: (itemIds: string[]) => void;
  sectionItemLimit: Record<string, number>;
  onSectionItemLimitChange: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  selectedDeletableItems: A2lTreeItem[];
  recentA2lFiles: RecentFile[];
  isDirty: boolean;
  onCreateA2l: () => void;
  onOpenA2lDialog: () => void;
  onSaveA2l: () => void;
  onShowDeleteDialog: () => void;
  onShowCreateDialog: () => void;
  onTreeItemClick: (itemId: string, event: React.MouseEvent) => void;
  onLoadA2lFromPath: (path: string) => void;
  onPendingAction: (action: () => void) => void;
  onShowUnsavedDialog: () => void;
}

const DEFAULT_SECTION_LIMIT = 500;
const SEARCH_ACTIVE_LIMIT = Infinity;

export function ExplorerPanel({
  metadata,
  filteredTree,
  searchQuery,
  onSearchChange,
  selectedTreeItemIds,
  expandedItems,
  onExpandedItemsChange,
  sectionItemLimit,
  onSectionItemLimitChange,
  selectedDeletableItems,
  recentA2lFiles,
  isDirty,
  onCreateA2l,
  onOpenA2lDialog,
  onSaveA2l,
  onShowDeleteDialog,
  onShowCreateDialog,
  onTreeItemClick,
  onLoadA2lFromPath,
  onPendingAction,
  onShowUnsavedDialog,
}: ExplorerPanelProps) {
  return (
    <>
      <Box sx={{ p: 1, px: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="overline" data-testid="heading-explorer" sx={{ fontWeight: 600, letterSpacing: 1, color: "text.secondary" }}>EXPLORER</Typography>
        <Stack direction="row">
          <Tooltip title="New A2L (Ctrl+N)">
            <IconButton size="small" data-testid="btn-new-a2l" onClick={onCreateA2l} aria-label="New A2L"><AddIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Open A2L (Ctrl+O)">
            <IconButton size="small" data-testid="btn-open-a2l" onClick={onOpenA2lDialog} aria-label="Open A2L">
              <FolderOpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {metadata && (
            <>
              <Tooltip title="Save A2L (Ctrl+S)">
                <IconButton size="small" data-testid="btn-save-a2l" onClick={onSaveA2l} aria-label="Save A2L"><SaveIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Create Entity">
                <IconButton size="small" data-testid="btn-create-entity" onClick={onShowCreateDialog} aria-label="Create Entity" color="primary">
                  <NoteAddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
          {selectedDeletableItems.length > 0 && (
            <Tooltip title={`Delete selected (${selectedDeletableItems.length})`}>
              <IconButton size="small" data-testid="btn-delete-entities" onClick={onShowDeleteDialog} aria-label="Delete selected" color="error">
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
            bgcolor: tokens.surface2,
            border: `1px solid ${tokens.border}`,
            "&:focus-within": { border: `1px solid ${tokens.accent}` },
          }}
        >
          <SearchIcon sx={{ fontSize: 16, color: "text.secondary", ml: 1, mr: 1 }} />
          <InputBase
            data-testid="search-entities"
            placeholder="Search entities..."
            inputProps={{ "aria-label": "Search entities" }}
            sx={{ ml: 1, flex: 1, fontSize: 12 }}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </Paper>
      </Box>

      {!metadata && recentA2lFiles.length > 0 && (
        <Box sx={{ flex: 1, overflow: "auto" }} data-testid="recent-a2l-list">
          <Typography variant="caption" sx={{ px: 2, pb: 1, display: "block", color: "text.secondary", mt: 2 }}>RECENT</Typography>
          <List dense>
            {recentA2lFiles.map(file => (
              <li key={file.name + file.lastOpened} style={{ listStyle: "none" }}>
                <ListItemButton onClick={() => {
                  if (file.path) {
                    if (isDirty) {
                      onPendingAction(() => onLoadA2lFromPath(file.path!));
                      onShowUnsavedDialog();
                      return;
                    }
                    onLoadA2lFromPath(file.path);
                  }
                }}>
                  <ListItemIcon sx={{ minWidth: 32 }}><DescriptionIcon fontSize="small" sx={{ fontSize: 16 }} /></ListItemIcon>
                  <ListItemText
                    primary={file.name}
                    secondary={file.path}
                    primaryTypographyProps={{ noWrap: true, fontSize: 12 }}
                    secondaryTypographyProps={{ noWrap: true, fontSize: 10, color: "text.secondary" }}
                  />
                </ListItemButton>
              </li>
            ))}
          </List>
        </Box>
      )}

      {metadata && filteredTree && (
        <Box sx={{ flex: 1, overflow: "auto" }} data-testid="entity-tree" tabIndex={0} aria-label="Entity tree">
          <SimpleTreeView
            multiSelect
            selectedItems={selectedTreeItemIds}
            onSelectedItemsChange={() => { /* handled by onClick on TreeItem */ }}
            expandedItems={expandedItems}
            onExpandedItemsChange={(_, itemIds) => onExpandedItemsChange(itemIds)}
            slots={{
              expandIcon: KeyboardArrowRight,
              collapseIcon: KeyboardArrowDown,
            }}
            sx={{
              "& .MuiTreeItem-content": {
                py: 0.5, px: 1, borderRadius: 1,
                "&.Mui-selected": { bgcolor: `${tokens.selection} !important` },
              },
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
                      <Typography variant="caption" color="text.secondary">{section.title} <span style={{ opacity: 0.85 }}>({section.items.length})</span></Typography>
                    }>
                      {visibleItems.map(item => (
                        <TreeItem key={item.id} itemId={`item-${item.id}`}
                          onClick={(e) => { e.stopPropagation(); onTreeItemClick(`item-${item.id}`, e); }}
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
                              onSectionItemLimitChange(c => ({ ...c, [section.id]: (c[section.id] ?? DEFAULT_SECTION_LIMIT) + 500 }));
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
                              onSectionItemLimitChange(c => ({ ...c, [section.id]: Infinity }));
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
  );
}
