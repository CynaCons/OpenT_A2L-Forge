import { Box, IconButton, Tooltip } from "@mui/material";
import {
  Description as DescriptionIcon,
  Memory as MemoryIcon,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import { tokens } from "../../theme";

interface ActivityBarProps {
  activeView: "a2l" | "elf" | "settings";
  onViewChange: (view: "a2l" | "elf" | "settings") => void;
}

export function ActivityBar({ activeView, onViewChange }: ActivityBarProps) {
  return (
    <Box sx={{ width: 48, bgcolor: tokens.surface, display: "flex", flexDirection: "column", alignItems: "center", py: 1.5 }}>
      <Tooltip title="Explorer" placement="right">
        <IconButton
          data-testid="sidebar-explorer"
          onClick={() => onViewChange("a2l")}
          sx={{
            mb: 1,
            color: activeView === "a2l" ? "#fff" : tokens.textMuted,
            borderLeft: activeView === "a2l" ? `2px solid ${tokens.accent}` : "2px solid transparent",
            borderRadius: 0,
            width: "100%",
          }}
        >
          <DescriptionIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title="ELF Symbols" placement="right">
        <IconButton
          data-testid="sidebar-elf"
          onClick={() => onViewChange("elf")}
          sx={{
            mb: 1,
            color: activeView === "elf" ? "#fff" : tokens.textMuted,
            borderLeft: activeView === "elf" ? `2px solid ${tokens.accent}` : "2px solid transparent",
            borderRadius: 0,
            width: "100%",
          }}
        >
          <MemoryIcon />
        </IconButton>
      </Tooltip>
      <Box sx={{ flex: 1 }} />
      <Tooltip title="Settings" placement="right">
        <IconButton data-testid="sidebar-settings" onClick={() => onViewChange("settings")} sx={{ color: tokens.textMuted, borderLeft: activeView === "settings" ? `2px solid ${tokens.accent}` : "2px solid transparent", borderRadius: 0, width: "100%" }}>
          <SettingsIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
