import { Box, IconButton, Typography } from "@mui/material";
import {
  Close as CloseIcon,
  CropSquare,
  Minimize,
  FilterNone,
  DataObject,
} from "@mui/icons-material";

interface TitleBarProps {
  fileName: string;
  isDirty: boolean;
  isMaximized: boolean;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
}

export function TitleBar({ fileName, isDirty, isMaximized, onMinimize, onToggleMaximize, onClose }: TitleBarProps) {
  return (
    <Box
      sx={{
        height: 32,
        display: "flex",
        alignItems: "center",
        borderBottom: 1,
        borderColor: "divider",
        bgcolor: "#1e1e1e",
        userSelect: "none",
      }}
    >
      <Box
        className="titlebar-drag"
        sx={{
          flex: 1,
          height: "100%",
          display: "flex",
          alignItems: "center",
          pl: 2,
          gap: 1,
        }}
        onDoubleClick={onToggleMaximize}
      >
        <DataObject sx={{ fontSize: 16, color: "#007acc" }} />
        <Typography variant="caption" sx={{ fontWeight: 600 }} data-testid="titlebar-filename">
          {isDirty ? "\u2022 " : ""}OpenT A2L Forge{fileName ? ` — ${fileName}` : ""}
        </Typography>
      </Box>

      <Box className="titlebar-no-drag" sx={{ display: "flex", height: "100%" }}>
        <IconButton size="small" data-testid="btn-minimize" onClick={onMinimize} aria-label="Minimize" sx={{ borderRadius: 0, width: 40, height: "100%", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}>
          <Minimize sx={{ fontSize: 16 }} />
        </IconButton>
        <IconButton size="small" data-testid="btn-maximize" onClick={onToggleMaximize} aria-label="Maximize" sx={{ borderRadius: 0, width: 40, height: "100%", "&:hover": { bgcolor: "rgba(255,255,255,0.1)" } }}>
          {isMaximized ? <FilterNone sx={{ fontSize: 14 }} /> : <CropSquare sx={{ fontSize: 14 }} />}
        </IconButton>
        <IconButton size="small" data-testid="btn-close" onClick={onClose} aria-label="Close" sx={{ borderRadius: 0, width: 40, height: "100%", "&:hover": { bgcolor: "#c42b1c" } }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    </Box>
  );
}
