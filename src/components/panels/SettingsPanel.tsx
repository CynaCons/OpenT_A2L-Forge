import { Box, Button, Divider, Typography } from "@mui/material";
import { tokens } from "../../theme";

interface SettingsPanelProps {
  onClearRecents: () => void;
}

export function SettingsPanel({ onClearRecents }: SettingsPanelProps) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="overline" data-testid="heading-settings">SETTINGS</Typography>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Recent Files</Typography>
      <Button size="small" variant="outlined" onClick={onClearRecents}>Clear Recent Files</Button>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Keyboard Shortcuts</Typography>
      <Box sx={{ fontSize: 12, fontFamily: "monospace", color: tokens.textMuted }}>
        <Typography variant="caption" display="block">Ctrl+N &emsp; New A2L</Typography>
        <Typography variant="caption" display="block">Ctrl+O &emsp; Open A2L</Typography>
        <Typography variant="caption" display="block">Ctrl+S &emsp; Save</Typography>
        <Typography variant="caption" display="block">Ctrl+Shift+S &emsp; Save As</Typography>
        <Typography variant="caption" display="block">Escape &emsp; Cancel Edit</Typography>
      </Box>
      <Divider sx={{ my: 2 }} />
      <Typography variant="subtitle2" sx={{ mb: 1 }}>About</Typography>
      <Typography variant="body2" color="text.secondary">OpenT A2L Forge v0.1.0</Typography>
      <Typography variant="caption" color="text.secondary" display="block">Tauri + React + Rust</Typography>
    </Box>
  );
}
