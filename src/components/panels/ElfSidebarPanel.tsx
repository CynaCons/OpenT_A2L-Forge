import {
  Box,
  Button,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import {
  Memory as MemoryIcon,
  FolderOpen as FolderOpenIcon,
} from "@mui/icons-material";
import type { RecentFile } from "../../types";

interface ElfSidebarPanelProps {
  recentElfFiles: RecentFile[];
  onOpenElfDialog: () => void;
  onLoadElfFromPath: (path: string) => void;
}

export function ElfSidebarPanel({ recentElfFiles, onOpenElfDialog, onLoadElfFromPath }: ElfSidebarPanelProps) {
  return (
    <Box sx={{ p: 2, overflow: "hidden", overflowY: "auto", flex: 1 }}>
      <Typography variant="overline" data-testid="heading-elf-inspector">ELF INSPECTOR</Typography>
      <Divider sx={{ my: 2 }} />
      <Button data-testid="btn-load-elf" variant="outlined" fullWidth startIcon={<FolderOpenIcon />} onClick={onOpenElfDialog}>
        Load ELF Binary
      </Button>

      {recentElfFiles.length > 0 && (
        <Box sx={{ mt: 3 }} data-testid="recent-elf-list">
          <Typography variant="caption" color="text.secondary">RECENT</Typography>
          <List dense>
            {recentElfFiles.map(file => (
              <ListItemButton key={file.name + file.lastOpened} onClick={() => {
                if (file.path) onLoadElfFromPath(file.path);
              }}>
                <ListItemIcon sx={{ minWidth: 32 }}><MemoryIcon fontSize="small" sx={{ fontSize: 16 }} /></ListItemIcon>
                <ListItemText primary={file.name} secondary={file.path} primaryTypographyProps={{ noWrap: true, fontSize: 12 }} secondaryTypographyProps={{ noWrap: true, fontSize: 10 }} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
}
