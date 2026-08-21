import { Box, IconButton, Stack } from "@mui/material";
import {
  Description as DescriptionIcon,
  Memory as MemoryIcon,
  Close as CloseIcon,
  Terminal,
} from "@mui/icons-material";
import type { StatusState } from "../../types";
import { tokens } from "../../theme";

interface StatusBarProps {
  status: StatusState | null;
  fileName: string;
  elfName: string;
  isDirty?: boolean;
  onDismissError?: () => void;
}

export function StatusBar({ status, fileName, elfName, isDirty, onDismissError }: StatusBarProps) {
  const bg = status?.type === "error" ? tokens.statusError : tokens.statusBarBg;
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
           <span data-testid="status-message">{status?.message || "Ready"}</span>
           {status?.type === "error" && onDismissError && (
             <IconButton
               data-testid="btn-dismiss-error"
               aria-label="Dismiss error"
               onClick={onDismissError}
               size="small"
               sx={{ color: "#fff", ml: 0.5, p: 0.25 }}
             >
               <CloseIcon sx={{ fontSize: 12 }} />
             </IconButton>
           )}
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
