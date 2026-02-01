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
} from "@mui/material";

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

export function CharacteristicEditor({
  initialName,
  onSave,
  onCancel,
}: CharacteristicEditorProps) {
  const [data, setData] = useState<CharacteristicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    try {
      await invoke("update_characteristic", { name: initialName, data });
      onSave();
    } catch (err) {
      setError(String(err));
    }
  };

  if (loading) return <Typography variant="caption">Loading editor...</Typography>;
  if (error && !data) return <Alert severity="error">{error}</Alert>;
  if (!data) return <Alert severity="warning">No data available</Alert>;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3, pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField
            label="Name"
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            size="small"
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField
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

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Address (Hex)"
            value={data.address}
            onChange={(e) => setData({ ...data, address: e.target.value })}
            size="small"
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Bit Mask (Hex)"
            placeholder="0x..."
            value={data.bit_mask || ""}
            onChange={(e) => setData({ ...data, bit_mask: e.target.value })}
            size="small"
            fullWidth
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
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
            label="Upper Limit"
            type="number"
            value={data.upper_limit}
            onChange={(e) => setData({ ...data, upper_limit: parseFloat(e.target.value) })}
            size="small"
            fullWidth
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TextField
            label="Conversion"
            value={data.conversion}
            onChange={(e) => setData({ ...data, conversion: e.target.value })}
            size="small"
            fullWidth
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Deposit"
            value={data.deposit}
            onChange={(e) => setData({ ...data, deposit: e.target.value })}
            size="small"
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Max Diff"
            type="number"
            value={data.max_diff}
            onChange={(e) => setData({ ...data, max_diff: parseFloat(e.target.value) })}
            size="small"
            fullWidth
          />
        </Grid>
      </Grid>

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>
          Save
        </Button>
      </Stack>
    </Box>
  );
}
