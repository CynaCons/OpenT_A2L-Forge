import {
  Box,
  Button,
  Divider,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import type { RecentFile } from "../../types";

interface MenuBarProps {
  fileMenuAnchor: HTMLElement | null;
  onFileMenuOpen: (e: React.MouseEvent<HTMLElement>) => void;
  onFileMenuClose: () => void;
  onCreateA2l: () => void;
  onOpenA2lDialog: () => void;
  onSaveA2l: () => void;
  onSaveAsA2l: () => void;
  hasMetadata: boolean;
  isDirty: boolean;
  recentA2lFiles: RecentFile[];
  onLoadA2lFromPath: (path: string) => void;
  onPendingAction: (action: () => void) => void;
  onShowUnsavedDialog: () => void;
}

export function MenuBar({
  fileMenuAnchor,
  onFileMenuOpen,
  onFileMenuClose,
  onCreateA2l,
  onOpenA2lDialog,
  onSaveA2l,
  onSaveAsA2l,
  hasMetadata,
  isDirty,
  recentA2lFiles,
  onLoadA2lFromPath,
  onPendingAction,
  onShowUnsavedDialog,
}: MenuBarProps) {
  return (
    <Box sx={{ height: 28, bgcolor: "#333", display: "flex", alignItems: "center", px: 1, borderBottom: "1px solid #444" }}>
      <Button size="small" sx={{ fontSize: 11, color: "#ccc", minWidth: "auto", px: 1, textTransform: "none" }}
        onClick={onFileMenuOpen}>File</Button>
      <Menu anchorEl={fileMenuAnchor} open={Boolean(fileMenuAnchor)} onClose={onFileMenuClose}
        slotProps={{ paper: { sx: { bgcolor: "#252526", color: "#ccc", minWidth: 200 } } }}>
        <MenuItem onClick={() => { onCreateA2l(); onFileMenuClose(); }} sx={{ fontSize: 13 }}>
          <ListItemText>New A2L</ListItemText>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: 11 }}>Ctrl+N</Typography>
        </MenuItem>
        <MenuItem onClick={() => { onOpenA2lDialog(); onFileMenuClose(); }} sx={{ fontSize: 13 }}>
          <ListItemText>Open A2L...</ListItemText>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: 11 }}>Ctrl+O</Typography>
        </MenuItem>
        <MenuItem onClick={() => { onSaveA2l(); onFileMenuClose(); }} disabled={!hasMetadata} sx={{ fontSize: 13 }}>
          <ListItemText>Save</ListItemText>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: 11 }}>Ctrl+S</Typography>
        </MenuItem>
        <MenuItem onClick={() => { onSaveAsA2l(); onFileMenuClose(); }} disabled={!hasMetadata} sx={{ fontSize: 13 }}>
          <ListItemText>Save As...</ListItemText>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 3, fontSize: 11 }}>Ctrl+Shift+S</Typography>
        </MenuItem>
        {recentA2lFiles.length > 0 && <Divider sx={{ borderColor: "#444" }} />}
        {recentA2lFiles.filter(f => f.path).slice(0, 5).map(f => (
          <MenuItem key={f.path} onClick={() => {
            if (f.path) {
              if (isDirty) {
                onPendingAction(() => onLoadA2lFromPath(f.path!));
                onShowUnsavedDialog();
              } else {
                onLoadA2lFromPath(f.path);
              }
            }
            onFileMenuClose();
          }} sx={{ fontSize: 12 }}>
            {f.name}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}
