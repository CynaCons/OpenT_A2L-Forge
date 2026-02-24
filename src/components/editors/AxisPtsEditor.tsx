import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Box,
  Button,
  Grid,
  Stack,
  TextField,
  Typography,
  Alert,
  Divider,
} from "@mui/material";

type AxisPtsData = {
  name: string;
  long_identifier: string;
  address: string;
  input_quantity: string;
  deposit_record: string;
  max_diff: number;
  conversion: string;
  max_axis_points: number;
  lower_limit: number;
  upper_limit: number;
};

interface AxisPtsEditorProps {
  initialName: string;
  onSave: () => void;
  onCancel: () => void;
}

const ACCENT = "#569cd6";

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

export function AxisPtsEditor({
  initialName,
  onSave,
  onCancel,
}: AxisPtsEditorProps) {
  const [data, setData] = useState<AxisPtsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    invoke<AxisPtsData>("get_axis_pts", { name: initialName })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(String(err));
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
      await invoke("update_axis_pts", { name: initialName, data });
      onSave();
    } catch (err) {
      setError(String(err));
      setIsSaving(false);
    }
  };

  if (error && !data) {
    return (
      <Alert severity="error" onClose={onCancel}>
        {error}
      </Alert>
    );
  }

  if (!data) {
    return <Typography variant="caption">Loading editor...</Typography>;
  }

  return (
    <Box data-testid="editor-axis-pts" component="form" sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}

      {/* Identity */}
      <SectionHeader title="Identity" />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            data-testid="editor-axis-pts-name"
            label="Name"
            fullWidth
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Input Quantity"
            fullWidth
            value={data.input_quantity}
            onChange={(e) => setData({ ...data, input_quantity: e.target.value })}
            size="small"
          />
        </Grid>
      </Grid>

      {/* Description */}
      <SectionHeader title="Description" />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <TextField
            label="Long Identifier"
            fullWidth
            value={data.long_identifier}
            onChange={(e) => setData({ ...data, long_identifier: e.target.value })}
            size="small"
            multiline
            rows={2}
          />
        </Grid>
      </Grid>

      {/* Address */}
      <SectionHeader title="Address" />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
           <TextField
            label="Address (Hex)"
            fullWidth
            value={data.address}
            onChange={(e) => setData({ ...data, address: e.target.value })}
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Deposit Record"
            fullWidth
            value={data.deposit_record}
            onChange={(e) => setData({ ...data, deposit_record: e.target.value })}
            size="small"
          />
        </Grid>
      </Grid>

      {/* Axis Config */}
      <SectionHeader title="Axis Config" />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Conversion"
            fullWidth
            value={data.conversion}
            onChange={(e) => setData({ ...data, conversion: e.target.value })}
            size="small"
          />
        </Grid>
         <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Max Axis Points"
            type="number"
            fullWidth
            value={data.max_axis_points}
            onChange={(e) => setData({ ...data, max_axis_points: parseInt(e.target.value) || 0 })}
            size="small"
          />
        </Grid>
      </Grid>

      {/* Range */}
      <SectionHeader title="Range" />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Lower Limit"
            type="number"
            fullWidth
            value={data.lower_limit}
            onChange={(e) => setData({ ...data, lower_limit: parseFloat(e.target.value) || 0 })}
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Upper Limit"
            type="number"
            fullWidth
            value={data.upper_limit}
            onChange={(e) => setData({ ...data, upper_limit: parseFloat(e.target.value) || 0 })}
            size="small"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Max Diff"
            type="number"
            fullWidth
            value={data.max_diff}
            onChange={(e) => setData({ ...data, max_diff: parseFloat(e.target.value) || 0 })}
            size="small"
          />
        </Grid>
      </Grid>

      {/* Button Bar */}
      <Divider sx={{ mt: 1 }} />
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button data-testid="editor-axis-pts-cancel" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button data-testid="editor-axis-pts-save" variant="contained" onClick={handleSave} disabled={isSaving} sx={{ px: 4, fontWeight: 600 }}>
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </Stack>
    </Box>
  );
}
