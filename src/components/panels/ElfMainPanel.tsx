import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  Tooltip,
} from "@mui/material";
import {
  Memory as MemoryIcon,
  Search as SearchIcon,
  Add as AddIcon,
  KeyboardArrowDown,
  KeyboardArrowRight,
} from "@mui/icons-material";
import type { A2lMetadata, ElfSymbol } from "../../types";
import { tokens } from "../../theme";

interface ElfMainPanelProps {
  elfSymbols: ElfSymbol[];
  filteredElfSymbols: ElfSymbol[];
  elfDisplayRows: ElfSymbol[];
  selectableDisplayRows: ElfSymbol[];
  structParentNames: Set<string>;
  selectedElfSymbols: Set<string>;
  onSelectedElfSymbolsChange: (symbols: Set<string>) => void;
  onToggleElfSymbol: (symbolName: string) => void;
  onSetStructRootSelection: (rootName: string, checked: boolean) => void;
  collapsedStructs: Set<string>;
  onCollapsedStructsChange: (updater: (prev: Set<string>) => Set<string>) => void;
  elfSearchQuery: string;
  onElfSearchQueryChange: (query: string) => void;
  elfFilterTypes: Set<string>;
  onElfFilterTypesChange: (types: Set<string>) => void;
  elfFilterSections: Set<string>;
  onElfFilterSectionsChange: (sections: Set<string>) => void;
  elfFilterBinds: Set<string>;
  onElfFilterBindsChange: (binds: Set<string>) => void;
  elfSortColumn: "name" | "address" | "size" | "type";
  onElfSortColumnChange: (col: "name" | "address" | "size" | "type") => void;
  elfSortDirection: "asc" | "desc";
  onElfSortDirectionChange: (dir: "asc" | "desc") => void;
  elfTypeOptions: string[];
  elfSectionOptions: string[];
  elfBindOptions: string[];
  addressOverflowCount: number;
  metadata: A2lMetadata | null;
  selectedModule: string | null;
  onSelectedModuleChange: (module: string) => void;
  isBusy: boolean;
  elfChangedBanner: boolean;
  onDismissElfBanner: () => void;
  onReloadElf: () => void;
  onUpdateEcuAddresses: () => void;
  onLoadCliProject: () => void;
  onSaveCliProject: () => void;
  canSaveCliProject: boolean;
  onAddSymbols: () => void;
}

export function ElfMainPanel({
  elfSymbols,
  filteredElfSymbols,
  elfDisplayRows,
  selectableDisplayRows,
  structParentNames,
  selectedElfSymbols,
  onSelectedElfSymbolsChange,
  onToggleElfSymbol,
  onSetStructRootSelection,
  collapsedStructs,
  onCollapsedStructsChange,
  elfSearchQuery,
  onElfSearchQueryChange,
  elfFilterTypes,
  onElfFilterTypesChange,
  elfFilterSections,
  onElfFilterSectionsChange,
  elfFilterBinds,
  onElfFilterBindsChange,
  elfSortColumn,
  onElfSortColumnChange,
  elfSortDirection,
  onElfSortDirectionChange,
  elfTypeOptions,
  elfSectionOptions,
  elfBindOptions,
  addressOverflowCount,
  metadata,
  selectedModule,
  onSelectedModuleChange,
  isBusy,
  elfChangedBanner,
  onDismissElfBanner,
  onReloadElf,
  onUpdateEcuAddresses,
  onLoadCliProject,
  onSaveCliProject,
  canSaveCliProject,
  onAddSymbols,
}: ElfMainPanelProps) {
  const handleSortClick = (col: "name" | "address" | "size" | "type") => {
    if (elfSortColumn === col) {
      onElfSortDirectionChange(elfSortDirection === "asc" ? "desc" : "asc");
    } else {
      onElfSortColumnChange(col);
      onElfSortDirectionChange("asc");
    }
  };

  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", bgcolor: tokens.bg, overflow: "hidden" }}>
      <Box sx={{ p: 2, px: 3, borderBottom: `1px solid ${tokens.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", height: 50, bgcolor: tokens.surface }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <MemoryIcon sx={{ color: "#4ec9b0" }} />
          <Typography variant="h6" sx={{ fontSize: 14 }}>ELF Symbols</Typography>
          {elfSymbols.length > 0 && <Chip label={`${filteredElfSymbols.length} of ${elfSymbols.length}`} size="small" variant="outlined" sx={{ height: 20 }} />}
          {selectedElfSymbols.size > 0 && <Chip label={`${selectedElfSymbols.size} Selected`} size="small" color="primary" sx={{ height: 20 }} />}
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            data-testid="btn-load-cli-project"
            variant="outlined"
            size="small"
            onClick={onLoadCliProject}
            disabled={isBusy}
          >
            Load Sync Project
          </Button>
          <Button
            data-testid="btn-save-cli-project"
            variant="outlined"
            size="small"
            onClick={onSaveCliProject}
            disabled={!canSaveCliProject || isBusy}
          >
            Save Sync Project
          </Button>
          {metadata && elfSymbols.length > 0 && (
            <Button
              data-testid="btn-update-ecu"
              variant="outlined"
              size="small"
              onClick={onUpdateEcuAddresses}
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
                onSelectedModuleChange(e.target.value);
                localStorage.setItem("elf_target_module", e.target.value);
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
                onClick={onAddSymbols}
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
            <Button size="small" color="inherit" onClick={onReloadElf}>Reload</Button>
            <Button size="small" color="inherit" onClick={onDismissElfBanner}>Dismiss</Button>
          </Stack>
        }>
          ELF file changed on disk. Reload to update symbols.
        </Alert>
      )}

      {elfSymbols.length > 0 && (
        <Box sx={{ p: 2, px: 3, borderBottom: `1px solid ${tokens.border}`, bgcolor: tokens.surface }}>
          <TextField
            data-testid="search-elf"
            fullWidth
            size="small"
            placeholder="Search symbols..."
            value={elfSearchQuery}
            onChange={(e) => onElfSearchQueryChange(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />,
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
                onChange: (e) => onElfFilterTypesChange(new Set(e.target.value as string[])),
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
                onChange: (e) => onElfFilterSectionsChange(new Set(e.target.value as string[])),
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
                onChange: (e) => onElfFilterBindsChange(new Set(e.target.value as string[])),
              }}
            >
              {elfBindOptions.map(bind => <MenuItem key={bind} value={bind}>{bind}</MenuItem>)}
            </TextField>
            {(elfFilterTypes.size > 0 || elfFilterSections.size > 0 || elfFilterBinds.size > 0) && (
              <Button data-testid="btn-clear-elf-filters" size="small" onClick={() => {
                onElfFilterTypesChange(new Set());
                onElfFilterSectionsChange(new Set());
                onElfFilterBindsChange(new Set());
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
        <TableContainer sx={{ flex: 1, overflow: "auto" }} data-testid="elf-table" tabIndex={0} aria-label="ELF symbol table">
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={{ bgcolor: tokens.bg }}>
                  <Checkbox
                    data-testid="checkbox-select-all"
                    inputProps={{ "aria-label": "Select all displayed symbols" }}
                    checked={selectableDisplayRows.length > 0 && selectableDisplayRows.every(s => selectedElfSymbols.has(s.name))}
                    indeterminate={selectableDisplayRows.some(s => selectedElfSymbols.has(s.name)) && !selectableDisplayRows.every(s => selectedElfSymbols.has(s.name))}
                    onChange={(e) => {
                      if (e.target.checked) onSelectedElfSymbolsChange(new Set(selectableDisplayRows.map(s => s.name)));
                      else onSelectedElfSymbolsChange(new Set());
                    }}
                    size="small"
                  />
                </TableCell>
                <TableCell data-testid="sort-name" sx={{ bgcolor: tokens.bg, fontWeight: 600 }} sortDirection={elfSortColumn === "name" ? elfSortDirection : false}>
                  <TableSortLabel active={elfSortColumn === "name"} direction={elfSortColumn === "name" ? elfSortDirection : "asc"} onClick={() => handleSortClick("name")}>
                    Name
                  </TableSortLabel>
                </TableCell>
                <TableCell data-testid="sort-address" sx={{ bgcolor: tokens.bg, fontWeight: 600 }} sortDirection={elfSortColumn === "address" ? elfSortDirection : false}>
                  <TableSortLabel active={elfSortColumn === "address"} direction={elfSortColumn === "address" ? elfSortDirection : "asc"} onClick={() => handleSortClick("address")}>
                    Address
                  </TableSortLabel>
                </TableCell>
                <TableCell data-testid="sort-size" sx={{ bgcolor: tokens.bg, fontWeight: 600 }} sortDirection={elfSortColumn === "size" ? elfSortDirection : false}>
                  <TableSortLabel active={elfSortColumn === "size"} direction={elfSortColumn === "size" ? elfSortDirection : "asc"} onClick={() => handleSortClick("size")}>
                    Size
                  </TableSortLabel>
                </TableCell>
                <TableCell data-testid="sort-type" sx={{ bgcolor: tokens.bg, fontWeight: 600 }} sortDirection={elfSortColumn === "type" ? elfSortDirection : false}>
                  <TableSortLabel active={elfSortColumn === "type"} direction={elfSortColumn === "type" ? elfSortDirection : "asc"} onClick={() => handleSortClick("type")}>
                    ELF Type
                  </TableSortLabel>
                </TableCell>
                <TableCell sx={{ bgcolor: tokens.bg, fontWeight: 600 }}>A2L Type</TableCell>
                <TableCell sx={{ bgcolor: tokens.bg, fontWeight: 600 }}>DWARF Type</TableCell>
                <TableCell sx={{ bgcolor: tokens.bg, fontWeight: 600 }}>Section</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {elfDisplayRows.map((row) => {
                const isStructParent = structParentNames.has(row.name);
                if (isStructParent) {
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
                        onCollapsedStructsChange(prev => {
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
                        inputProps={{ "aria-label": `Select struct ${row.name} and all members` }}
                        checked={allMembersSelected && someMembersSelected}
                        indeterminate={someMembersSelected && !allMembersSelected}
                        size="small"
                        onChange={(e) => {
                            onSetStructRootSelection(row.name, e.target.checked);
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontWeight: 600 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <IconButton
                            size="small"
                            aria-expanded={!isCollapsed}
                            aria-label={`${isCollapsed ? "Expand" : "Collapse"} struct ${row.name} (${memberCount} members)`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onCollapsedStructsChange(prev => {
                                const next = new Set(prev);
                                if (next.has(row.name)) next.delete(row.name);
                                else next.add(row.name);
                                return next;
                              });
                            }}
                            sx={{ p: 0.25, color: "#4ec9b0" }}
                          >
                            {isCollapsed ? <KeyboardArrowRight sx={{ fontSize: 16 }} /> : <KeyboardArrowDown sx={{ fontSize: 16 }} />}
                          </IconButton>
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
                      <TableCell sx={{ color: "text.secondary" }}>{row.section}</TableCell>
                    </TableRow>
                  );
                }
                const memberPath = row.is_struct_member && row.parent_struct && row.name.startsWith(`${row.parent_struct}.`)
                  ? row.name.slice(row.parent_struct.length + 1)
                  : row.name;
                return (
                  <TableRow key={row.name} data-testid={`elf-row-${row.name}`} hover selected={selectedElfSymbols.has(row.name)} onClick={() => {
                    onToggleElfSymbol(row.name);
                  }} sx={{ cursor: "pointer", bgcolor: row.address_warning ? "rgba(255, 152, 0, 0.08)" : undefined }}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        data-testid={`checkbox-elf-${row.name}`}
                        inputProps={{ "aria-label": `Select symbol ${row.name}` }}
                        checked={selectedElfSymbols.has(row.name)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace", pl: row.is_struct_member ? 4 : undefined }}>
                      {row.is_struct_member ? memberPath : row.name}
                      {row.is_struct_member && (
                        <Typography component="span" sx={{ color: "text.secondary", fontSize: 10, ml: 0.5, fontFamily: "monospace" }}>
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
                    <TableCell sx={{ fontFamily: "monospace", color: row.dwarf_type ? "#ce9178" : tokens.textMuted, fontSize: 11 }}>
                      {row.dwarf_type || "—"}
                    </TableCell>
                    <TableCell sx={{ color: "text.secondary" }}>{row.section}</TableCell>
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
