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

type MeasurementData = {
  name: string;
  long_identifier: string;
  datatype: string;
  conversion: string;
  resolution: number;
  accuracy: number;
  lower_limit: number;
  upper_limit: number;
  ecu_address?: string | null;
};

type MeasurementEditorProps = {
  initialName: string;
  onSave: () => void;
  onCancel: () => void;
};

const DATA_TYPES = [
  "UBYTE",
  "SBYTE",
  "UWORD",
  "SWORD",
  "ULONG",
  "SLONG",
  "A_UINT64",
  "A_INT64",
  "FLOAT16_IEEE",
  "FLOAT32_IEEE",
  "FLOAT64_IEEE",
];

export function MeasurementEditor({
  initialName,
  onSave,
  onCancel,
}: MeasurementEditorProps) {
  const [data, setData] = useState<MeasurementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    invoke<MeasurementData>("get_measurement", { name: initialName })
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
      await invoke("update_measurement", { name: initialName, data });
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
            label="Data Type"
            value={data.datatype}
            onChange={(e) => setData({ ...data, datatype: e.target.value })}
            size="small"
            fullWidth
          >
            {DATA_TYPES.map((dt) => (
              <MenuItem key={dt} value={dt}>
                {dt}
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

        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Resolution"
            type="number"
            value={data.resolution}
            onChange={(e) => setData({ ...data, resolution: parseFloat(e.target.value) })}
            size="small"
            fullWidth
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Accuracy"
            type="number"
            value={data.accuracy}
            onChange={(e) => setData({ ...data, accuracy: parseFloat(e.target.value) })}
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
        
        <Grid size={{ xs: 12 }}>
           <TextField
            label="ECU Address (Hex)"
            value={data.ecu_address ?? ""}
            onChange={(e) => setData({ ...data, ecu_address: e.target.value })}
            size="small"
            placeholder="0x..."
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
