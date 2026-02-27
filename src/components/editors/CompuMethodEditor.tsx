import { useState } from "react";
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

type CompuMethodData = {
  name: string;
  long_identifier: string;
  conversion_type: string;
  format: string;
  unit: string;
  coeffs: [number, number, number, number, number, number] | null;
  compu_tab_ref: string | null;
};

type CompuMethodEditorProps = {
  moduleName: string;
  onSave: () => void;
  onCancel: () => void;
};

const CONVERSION_TYPES = ["IDENTICAL", "LINEAR", "RAT_FUNC", "TAB_INTP", "TAB_NOINTP", "TAB_VERB", "FORM"];
const ACCENT = "#c586c0";

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

export function CompuMethodEditor({ moduleName, onSave, onCancel }: CompuMethodEditorProps) {
  const [data, setData] = useState<CompuMethodData>({
    name: "",
    long_identifier: "",
    conversion_type: "IDENTICAL",
    format: "%6.3",
    unit: "",
    coeffs: null,
    compu_tab_ref: null,
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
      await invoke("create_compu_method", { moduleName, data });
      onSave();
    } catch (err) {
      setError(String(err));
      setIsSaving(false);
    }
  };

  const showCoeffs = ["LINEAR", "RAT_FUNC"].includes(data.conversion_type);
  const showTabRef = ["TAB_INTP", "TAB_NOINTP", "TAB_VERB"].includes(data.conversion_type);

  return (
    <Box data-testid="editor-compu-method" sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}

      <SectionHeader title="Identity" />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
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
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            data-testid="create-entity-conversion-type"
            select
            label="Conversion Type"
            value={data.conversion_type}
            onChange={(e) => setData({ ...data, conversion_type: e.target.value })}
            size="small"
            fullWidth
          >
            {CONVERSION_TYPES.map((ct) => (
              <MenuItem key={ct} value={ct}>{ct}</MenuItem>
            ))}
          </TextField>
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

      <SectionHeader title="Format & Unit" />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Format"
            value={data.format}
            onChange={(e) => setData({ ...data, format: e.target.value })}
            size="small"
            fullWidth
            placeholder="%6.3"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            label="Unit"
            value={data.unit}
            onChange={(e) => setData({ ...data, unit: e.target.value })}
            size="small"
            fullWidth
          />
        </Grid>
      </Grid>

      {showCoeffs && (
        <>
          <SectionHeader title="Coefficients (a, b, c, d, e, f)" />
          <Grid container spacing={1}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Grid key={i} size={{ xs: 4, sm: 2 }}>
                <TextField
                  label={String.fromCharCode(97 + i)}
                  type="number"
                  value={data.coeffs ? data.coeffs[i] : (i === 1 ? 1 : 0)}
                  onChange={(e) => {
                    const coeffs: [number, number, number, number, number, number] = data.coeffs
                      ? [...data.coeffs] as [number, number, number, number, number, number]
                      : [0, 1, 0, 0, 0, 1];
                    coeffs[i] = parseFloat(e.target.value) || 0;
                    setData({ ...data, coeffs });
                  }}
                  size="small"
                  fullWidth
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {showTabRef && (
        <>
          <SectionHeader title="Table Reference" />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="CompuTab/CompuVtab Reference"
                value={data.compu_tab_ref || ""}
                onChange={(e) => setData({ ...data, compu_tab_ref: e.target.value || null })}
                size="small"
                fullWidth
                placeholder="Name of CompuTab or CompuVtab"
              />
            </Grid>
          </Grid>
        </>
      )}

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
