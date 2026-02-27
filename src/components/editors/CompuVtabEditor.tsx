import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Box,
  Button,
  TextField,
  Stack,
  Typography,
  Grid,
  Alert,
  Divider,
  IconButton,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";

type CompuVtabData = {
  name: string;
  long_identifier: string;
  value_pairs: [number, string][];
  default_value: string | null;
};

type CompuVtabEditorProps = {
  moduleName: string;
  onSave: () => void;
  onCancel: () => void;
};

const ACCENT = "#dcdcaa";

function SectionHeader({ title }: { title: string }) {
  return (
    <Typography
      variant="overline"
      sx={{
        display: "block",
        color: "#888",
        letterSpacing: 1.5,
        fontSize: 10,
        borderLeft: `2px solid ${ACCENT}`,
        pl: 1.5,
        mb: 0.5,
        mt: 1,
      }}
    >
      {title}
    </Typography>
  );
}

export function CompuVtabEditor({ moduleName, onSave, onCancel }: CompuVtabEditorProps) {
  const [data, setData] = useState<CompuVtabData>({
    name: "",
    long_identifier: "",
    value_pairs: [[0, ""]],
    default_value: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!data.name.trim()) {
      setError("Name is required");
      return;
    }
    if (data.value_pairs.length === 0) {
      setError("At least one value pair is required");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await invoke("create_compu_vtab", { moduleName, data });
      onSave();
    } catch (err) {
      setError(String(err));
      setIsSaving(false);
    }
  };

  const addPair = () => {
    const nextVal = data.value_pairs.length > 0
      ? data.value_pairs[data.value_pairs.length - 1][0] + 1
      : 0;
    setData({ ...data, value_pairs: [...data.value_pairs, [nextVal, ""]] });
  };

  const removePair = (idx: number) => {
    setData({ ...data, value_pairs: data.value_pairs.filter((_, i) => i !== idx) });
  };

  const updatePair = (idx: number, field: 0 | 1, value: number | string) => {
    const pairs = [...data.value_pairs];
    if (field === 0) {
      pairs[idx] = [value as number, pairs[idx][1]];
    } else {
      pairs[idx] = [pairs[idx][0], value as string];
    }
    setData({ ...data, value_pairs: pairs });
  };

  return (
    <Box data-testid="editor-compu-vtab" sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <SectionHeader title="Identity" />
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

      <SectionHeader title="Description" />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField
            label="Long Identifier"
            value={data.long_identifier}
            onChange={(e) => setData({ ...data, long_identifier: e.target.value })}
            size="small"
            fullWidth
            multiline
            rows={2}
          />
        </Grid>
      </Grid>

      <SectionHeader title="Value Pairs" />
      {data.value_pairs.map((pair, idx) => (
        <Grid container spacing={1} key={idx} alignItems="center">
          <Grid size={{ xs: 4 }}>
            <TextField
              label="Value"
              type="number"
              value={pair[0]}
              onChange={(e) => updatePair(idx, 0, parseFloat(e.target.value) || 0)}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 7 }}>
            <TextField
              label="Text"
              value={pair[1]}
              onChange={(e) => updatePair(idx, 1, e.target.value)}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid size={{ xs: 1 }}>
            <IconButton size="small" onClick={() => removePair(idx)} color="error" disabled={data.value_pairs.length <= 1}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Grid>
        </Grid>
      ))}
      <Button size="small" startIcon={<AddIcon />} onClick={addPair} sx={{ alignSelf: "flex-start" }}>
        Add Pair
      </Button>

      <SectionHeader title="Default Value" />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField
            label="Default Value (optional)"
            value={data.default_value || ""}
            onChange={(e) => setData({ ...data, default_value: e.target.value || null })}
            size="small"
            fullWidth
            placeholder="Text shown for unmapped values"
          />
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
