import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Stack,
  Typography,
  Grid,
  Alert,
  Divider,
} from "@mui/material";
import { getEntityAccent } from "../../theme";
import { SectionHeader } from "../shared";

type CharacteristicData = {
  name: string;
  long_identifier: string;
  characteristic_type: string;
  address: string;
  deposit: string;
  max_diff: number;
  conversion: string;
  lower_limit: number;
  upper_limit: number;
  bit_mask?: string | null;
};

type CharacteristicEditorProps = {
  initialName: string;
  onSave: () => void;
  onCancel: () => void;
};

const CHARACTERISTIC_TYPES = [
  "ASCII",
  "CURVE",
  "MAP",
  "CUBOID",
  "CUBE_4",
  "CUBE_5",
  "VAL_BLK",
  "VALUE",
];

const ACCENT = getEntityAccent("Characteristic");

export function CharacteristicEditor({
  initialName,
  onSave,
  onCancel,
}: CharacteristicEditorProps) {
  const [data, setData] = useState<CharacteristicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    invoke<CharacteristicData>("get_characteristic", { name: initialName })
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(String(err));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [initialName]);

  const handleSave = async () => {
    if (!data) return;
    setIsSaving(true);
    setError(null);
    try {
      await invoke("update_characteristic", { name: initialName, data });
      onSave();
    } catch (err) {
      setError(String(err));
      setIsSaving(false);
    }
  };

  if (loading) return <Typography variant="caption">Loading editor...</Typography>;
  if (error && !data) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Alert severity="warning">No data available</Alert>;

  return (
    <Box data-testid="editor-characteristic" sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}

      {/* Identity */}
      <SectionHeader title="Identity" accent={ACCENT} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField
            data-testid="editor-characteristic-name"
            label="Name"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            size="small"
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
            data-testid="editor-characteristic-type"
            select
            label="Type"
            value={data.characteristic_type}
            onChange={(e) => setData({ ...data, characteristic_type: e.target.value })}
            size="small"
            fullWidth
          >
            {CHARACTERISTIC_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      {/* Description */}
      <SectionHeader title="Description" accent={ACCENT} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField
            data-testid="editor-characteristic-long-id"
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

      {/* Address */}
      <SectionHeader title="Address" accent={ACCENT} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            data-testid="editor-characteristic-address"
            label="Address (Hex)"
            value={data.address}
            onChange={(e) => setData({ ...data, address: e.target.value })}
            size="small"
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            data-testid="editor-characteristic-bit-mask"
            label="Bit Mask (Hex)"
            placeholder="0x..."
            value={data.bit_mask || ""}
            onChange={(e) => setData({ ...data, bit_mask: e.target.value })}
            size="small"
            fullWidth
          />
        </Grid>
      </Grid>

      {/* Range */}
      <SectionHeader title="Range" accent={ACCENT} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            data-testid="editor-characteristic-lower-limit"
            label="Lower Limit"
            type="number"
            value={data.lower_limit}
            onChange={(e) => setData({ ...data, lower_limit: parseFloat(e.target.value) })}
            size="small"
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            data-testid="editor-characteristic-upper-limit"
            label="Upper Limit"
            type="number"
            value={data.upper_limit}
            onChange={(e) => setData({ ...data, upper_limit: parseFloat(e.target.value) })}
            size="small"
            fullWidth
          />
        </Grid>
      </Grid>

      {/* References */}
      <SectionHeader title="References" accent={ACCENT} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField
            data-testid="editor-characteristic-conversion"
            label="Conversion"
            value={data.conversion}
            onChange={(e) => setData({ ...data, conversion: e.target.value })}
            size="small"
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            data-testid="editor-characteristic-deposit"
            label="Deposit"
            value={data.deposit}
            onChange={(e) => setData({ ...data, deposit: e.target.value })}
            size="small"
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            data-testid="editor-characteristic-max-diff"
            label="Max Diff"
            type="number"
            value={data.max_diff}
            onChange={(e) => setData({ ...data, max_diff: parseFloat(e.target.value) })}
            size="small"
            fullWidth
          />
        </Grid>
      </Grid>

      {/* Button Bar */}
      <Divider sx={{ mt: 1 }} />
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button data-testid="editor-characteristic-cancel" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button data-testid="editor-characteristic-save" variant="contained" onClick={handleSave} disabled={isSaving} sx={{ px: 4, fontWeight: 600 }}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </Stack>
    </Box>
  );
}
