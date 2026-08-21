import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import {
  FolderOpen as FolderOpenIcon,
  NoteAdd as NoteAddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  DataObject,
} from "@mui/icons-material";
import type { A2lMetadata, A2lTreeItem } from "../../types";
import { getKindColor, getKindIcon, getPropertySection, tokens } from "../../theme";
import { MeasurementEditor } from "../editors/MeasurementEditor";
import { CharacteristicEditor } from "../editors/CharacteristicEditor";
import { AxisPtsEditor } from "../editors/AxisPtsEditor";

interface EntityDetailPanelProps {
  selectedItem: A2lTreeItem | null;
  selectedDeletableItems: A2lTreeItem[];
  metadata: A2lMetadata | null;
  isEditing: boolean;
  onSetEditing: (editing: boolean) => void;
  onRefreshTree: () => void;
  onOpenA2lDialog: () => void;
  onCreateA2l: () => void;
  onShowDeleteDialog: () => void;
}

export function EntityDetailPanel({
  selectedItem,
  selectedDeletableItems,
  metadata,
  isEditing,
  onSetEditing,
  onRefreshTree,
  onOpenA2lDialog,
  onCreateA2l,
  onShowDeleteDialog,
}: EntityDetailPanelProps) {
  if (!selectedItem) {
    // Multi-select info panel
    if (selectedDeletableItems.length > 1) {
      return (
        <Box sx={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <DataObject sx={{ fontSize: 64, mb: 2, color: tokens.textMuted }} />
          <Typography variant="h5" sx={{ color: tokens.textMuted, mb: 1 }}>{selectedDeletableItems.length} entities selected</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            Use the Delete key or the delete button in the toolbar to remove selected entities.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            data-testid="btn-delete-selected"
            onClick={onShowDeleteDialog}
          >
            Delete {selectedDeletableItems.length} entities
          </Button>
        </Box>
      );
    }
    return (
      <Box sx={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <DataObject sx={{ fontSize: 64, mb: 2, color: tokens.border }} />
        <Typography variant="h5" sx={{ color: tokens.textMuted, mb: 1 }}>OpenT A2L Forge</Typography>
        <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
          {metadata ? "Select an entity from the Explorer to view details" : "Open or create an A2L file to get started"}
        </Typography>
        {!metadata && (
          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <Button variant="outlined" size="small" startIcon={<FolderOpenIcon />} onClick={onOpenA2lDialog}>Open A2L</Button>
            <Button variant="outlined" size="small" startIcon={<NoteAddIcon />} onClick={onCreateA2l}>New A2L</Button>
          </Stack>
        )}
        <Box sx={{ color: tokens.textMuted, fontSize: 11, textAlign: "left" }}>
          <Typography variant="caption" display="block" sx={{ fontFamily: "monospace" }}>Ctrl+O &nbsp; Open File</Typography>
          <Typography variant="caption" display="block" sx={{ fontFamily: "monospace" }}>Ctrl+N &nbsp; New File</Typography>
          <Typography variant="caption" display="block" sx={{ fontFamily: "monospace" }}>Ctrl+S &nbsp; Save</Typography>
        </Box>
      </Box>
    );
  }

  // Editor Area
  return (
    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", bgcolor: tokens.bg }}>
      {/* Tab/Breadcrumb Header */}
      <Box sx={{ height: 36, bgcolor: tokens.surface2, display: "flex", alignItems: "center", px: 2, borderBottom: `1px solid ${tokens.border}` }}>
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
            onClick={() => onSetEditing(true)}
          >
            Edit Entity
          </Button>
        )}
      </Box>

      {/* Content Body */}
      <Box sx={{ flex: 1, overflow: "auto", p: 4 }} tabIndex={0} aria-label="Entity details">
        {isEditing ? (
          <Paper sx={{ p: 3, maxWidth: 800, mx: "auto", border: `1px solid ${tokens.border}` }}>
            {selectedItem.kind === "Measurement" && (
              <MeasurementEditor
                initialName={selectedItem.name}
                onSave={() => { onSetEditing(false); onRefreshTree(); }}
                onCancel={() => onSetEditing(false)}
              />
            )}
            {selectedItem.kind === "Characteristic" && (
              <CharacteristicEditor
                initialName={selectedItem.name}
                onSave={() => { onSetEditing(false); onRefreshTree(); }}
                onCancel={() => onSetEditing(false)}
              />
            )}
            {selectedItem.kind === "AxisPts" && (
              <AxisPtsEditor
                initialName={selectedItem.name}
                onSave={() => { onSetEditing(false); onRefreshTree(); }}
                onCancel={() => onSetEditing(false)}
              />
            )}
          </Paper>
        ) : (
          <Box data-testid="entity-detail" sx={{ maxWidth: 900, mx: "auto" }}>
            {/* Header Section */}
            <Box sx={{ pb: 3, borderBottom: `1px solid ${tokens.border}` }}>
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
                  <Typography sx={{ color: "text.secondary", fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", mt: 3, mb: 0.5 }}>{section}</Typography>
                  <Divider sx={{ borderColor: tokens.border, mb: 0.5 }} />
                  {props?.map(d => {
                    const rowIdx = globalIdx++;
                    return (
                      <Box key={d.label} sx={{ display: "grid", gridTemplateColumns: "180px 1fr", py: 0.8, px: 2, bgcolor: rowIdx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                        <Typography sx={{ color: "text.secondary", fontSize: 12, textTransform: "uppercase", alignSelf: "center" }}>{d.label}</Typography>
                        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: "text.primary", wordBreak: "break-all", alignSelf: "center" }}>{d.value}</Typography>
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
}
