import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Stack,
  Grid,
  Alert,
  Divider,
} from "@mui/material";
import { getEntityAccent } from "../../theme";
import { SectionHeader } from "../shared";

type RecordLayoutData = {
  name: string;
  fnc_values_datatype: string | null;
};

type RecordLayoutEditorProps = {
  moduleName: string;
  onSave: () => void;
  onCancel: () => void;
};

const DATA_TYPES = [
  "", "UBYTE", "SBYTE", "UWORD", "SWORD", "ULONG", "SLONG",
  "A_UINT64", "A_INT64", "FLOAT32_IEEE", "FLOAT64_IEEE",
];

const ACCENT = getEntityAccent("RecordLayout");

export function RecordLayoutEditor({ moduleName, onSave, onCancel }: RecordLayoutEditorProps) {
  const [data, setData] = useState<RecordLayoutData>({
    name: "",
    fnc_values_datatype: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!data.name.trim()) {
      setError("Name is required");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await invoke("create_record_layout", { moduleName, data });
      onSave();
    } catch (err) {
      setError(String(err));
      setIsSaving(false);
    }
  };

  return (
    <Box data-testid="editor-record-layout" sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <SectionHeader title="Identity" accent={ACCENT} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField
            data-testid="create-entity-name"
            label="Name"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            size="small"
            fullWidth
            autoFocus
          />
        </Grid>
      </Grid>

      <SectionHeader title="FNC Values" accent={ACCENT} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField
            select
            label="FNC Values Datatype (optional)"
            value={data.fnc_values_datatype || ""}
            onChange={(e) => setData({ ...data, fnc_values_datatype: e.target.value || null })}
            size="small"
            fullWidth
          >
            {DATA_TYPES.map((dt) => (
              <MenuItem key={dt} value={dt}>{dt || "(None)"}</MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      <Divider sx={{ mt: 1 }} />
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button data-testid="create-entity-submit" variant="contained" onClick={handleSave} disabled={isSaving} sx={{ px: 4, fontWeight: 600 }}>
          {isSaving ? "Creating..." : "Create"}
        </Button>
      </Stack>
    </Box>
  );
}
