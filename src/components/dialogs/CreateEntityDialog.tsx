import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Grid,
  Stack,
  Typography,
  Alert,
  Divider,
} from "@mui/material";
import { CompuMethodEditor } from "../editors/CompuMethodEditor";
import { CompuVtabEditor } from "../editors/CompuVtabEditor";
import { RecordLayoutEditor } from "../editors/RecordLayoutEditor";
import { DATA_TYPES, CHARACTERISTIC_TYPES, getEntityAccent } from "../../theme";
import { SectionHeader } from "../shared";

type EntityType = "Measurement" | "Characteristic" | "AxisPts" | "CompuMethod" | "CompuVtab" | "RecordLayout";

interface CreateEntityDialogProps {
  open: boolean;
  moduleName: string;
  onClose: () => void;
  onCreated: () => void;
}

function MeasurementCreateForm({ moduleName, onSave, onCancel }: { moduleName: string; onSave: () => void; onCancel: () => void }) {
  const [data, setData] = useState({
    name: "",
    long_identifier: "",
    datatype: "UBYTE",
    conversion: "NO_COMPU_METHOD",
    resolution: 1,
    accuracy: 0,
    lower_limit: 0,
    upper_limit: 255,
    ecu_address: null as string | null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const accent = getEntityAccent("Measurement");

  const handleSave = async () => {
    if (!data.name.trim()) { setError("Name is required"); return; }
    setIsSaving(true);
    setError(null);
    try {
      await invoke("create_measurement", { moduleName, data });
      onSave();
    } catch (err) { setError(String(err)); setIsSaving(false); }
  };

  return (
    <Box data-testid="create-entity-type-Measurement" sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <SectionHeader title="Identity" accent={accent} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField data-testid="create-entity-name" label="Name" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} size="small" fullWidth autoFocus />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField select label="Data Type" value={data.datatype} onChange={(e) => setData({ ...data, datatype: e.target.value })} size="small" fullWidth>
            {DATA_TYPES.map((dt) => <MenuItem key={dt} value={dt}>{dt}</MenuItem>)}
          </TextField>
        </Grid>
      </Grid>
      <SectionHeader title="Description" accent={accent} />
      <TextField label="Long Identifier" value={data.long_identifier} onChange={(e) => setData({ ...data, long_identifier: e.target.value })} size="small" fullWidth multiline rows={2} />
      <SectionHeader title="Range" accent={accent} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Lower Limit" type="number" value={data.lower_limit} onChange={(e) => setData({ ...data, lower_limit: parseFloat(e.target.value) })} size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Upper Limit" type="number" value={data.upper_limit} onChange={(e) => setData({ ...data, upper_limit: parseFloat(e.target.value) })} size="small" fullWidth />
        </Grid>
      </Grid>
      <SectionHeader title="References" accent={accent} />
      <TextField label="Conversion" value={data.conversion} onChange={(e) => setData({ ...data, conversion: e.target.value })} size="small" fullWidth />
      <Divider sx={{ mt: 1 }} />
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button data-testid="create-entity-submit" variant="contained" onClick={handleSave} disabled={isSaving} sx={{ px: 4, fontWeight: 600 }}>{isSaving ? "Creating..." : "Create"}</Button>
      </Stack>
    </Box>
  );
}

function CharacteristicCreateForm({ moduleName, onSave, onCancel }: { moduleName: string; onSave: () => void; onCancel: () => void }) {
  const [data, setData] = useState({
    name: "",
    long_identifier: "",
    characteristic_type: "VALUE",
    address: "0x0",
    deposit: "__default_record_layout",
    conversion: "NO_COMPU_METHOD",
    lower_limit: 0,
    upper_limit: 255,
    max_diff: 0,
    bit_mask: null as string | null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const accent = getEntityAccent("Characteristic");

  const handleSave = async () => {
    if (!data.name.trim()) { setError("Name is required"); return; }
    setIsSaving(true);
    setError(null);
    try {
      await invoke("create_characteristic", { moduleName, data });
      onSave();
    } catch (err) { setError(String(err)); setIsSaving(false); }
  };

  return (
    <Box data-testid="create-entity-type-Characteristic" sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <SectionHeader title="Identity" accent={accent} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 8 }}>
          <TextField data-testid="create-entity-name" label="Name" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} size="small" fullWidth autoFocus />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField select label="Type" value={data.characteristic_type} onChange={(e) => setData({ ...data, characteristic_type: e.target.value })} size="small" fullWidth>
            {CHARACTERISTIC_TYPES.map((ct) => <MenuItem key={ct} value={ct}>{ct}</MenuItem>)}
          </TextField>
        </Grid>
      </Grid>
      <SectionHeader title="Description" accent={accent} />
      <TextField label="Long Identifier" value={data.long_identifier} onChange={(e) => setData({ ...data, long_identifier: e.target.value })} size="small" fullWidth multiline rows={2} />
      <SectionHeader title="Address & Layout" accent={accent} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Address (Hex)" value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} size="small" fullWidth placeholder="0x..." />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Deposit (Record Layout)" value={data.deposit} onChange={(e) => setData({ ...data, deposit: e.target.value })} size="small" fullWidth />
        </Grid>
      </Grid>
      <SectionHeader title="Range" accent={accent} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Lower Limit" type="number" value={data.lower_limit} onChange={(e) => setData({ ...data, lower_limit: parseFloat(e.target.value) })} size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Upper Limit" type="number" value={data.upper_limit} onChange={(e) => setData({ ...data, upper_limit: parseFloat(e.target.value) })} size="small" fullWidth />
        </Grid>
      </Grid>
      <SectionHeader title="References" accent={accent} />
      <TextField label="Conversion" value={data.conversion} onChange={(e) => setData({ ...data, conversion: e.target.value })} size="small" fullWidth />
      <Divider sx={{ mt: 1 }} />
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button data-testid="create-entity-submit" variant="contained" onClick={handleSave} disabled={isSaving} sx={{ px: 4, fontWeight: 600 }}>{isSaving ? "Creating..." : "Create"}</Button>
      </Stack>
    </Box>
  );
}

function AxisPtsCreateForm({ moduleName, onSave, onCancel }: { moduleName: string; onSave: () => void; onCancel: () => void }) {
  const [data, setData] = useState({
    name: "",
    long_identifier: "",
    address: "0x0",
    input_quantity: "NO_INPUT_QUANTITY",
    deposit_record: "__default_record_layout",
    max_diff: 0,
    conversion: "NO_COMPU_METHOD",
    max_axis_points: 1,
    lower_limit: 0,
    upper_limit: 255,
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const accent = getEntityAccent("AxisPts");

  const handleSave = async () => {
    if (!data.name.trim()) { setError("Name is required"); return; }
    setIsSaving(true);
    setError(null);
    try {
      await invoke("create_axis_pts", { moduleName, data });
      onSave();
    } catch (err) { setError(String(err)); setIsSaving(false); }
  };

  return (
    <Box data-testid="create-entity-type-AxisPts" sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <SectionHeader title="Identity" accent={accent} />
      <TextField data-testid="create-entity-name" label="Name" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} size="small" fullWidth autoFocus />
      <SectionHeader title="Description" accent={accent} />
      <TextField label="Long Identifier" value={data.long_identifier} onChange={(e) => setData({ ...data, long_identifier: e.target.value })} size="small" fullWidth multiline rows={2} />
      <SectionHeader title="Address & Layout" accent={accent} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField label="Address (Hex)" value={data.address} onChange={(e) => setData({ ...data, address: e.target.value })} size="small" fullWidth placeholder="0x..." />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField label="Deposit Record" value={data.deposit_record} onChange={(e) => setData({ ...data, deposit_record: e.target.value })} size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField label="Max Axis Points" type="number" value={data.max_axis_points} onChange={(e) => setData({ ...data, max_axis_points: parseInt(e.target.value) || 1 })} size="small" fullWidth />
        </Grid>
      </Grid>
      <SectionHeader title="Range" accent={accent} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Lower Limit" type="number" value={data.lower_limit} onChange={(e) => setData({ ...data, lower_limit: parseFloat(e.target.value) })} size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Upper Limit" type="number" value={data.upper_limit} onChange={(e) => setData({ ...data, upper_limit: parseFloat(e.target.value) })} size="small" fullWidth />
        </Grid>
      </Grid>
      <SectionHeader title="References" accent={accent} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Conversion" value={data.conversion} onChange={(e) => setData({ ...data, conversion: e.target.value })} size="small" fullWidth />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label="Input Quantity" value={data.input_quantity} onChange={(e) => setData({ ...data, input_quantity: e.target.value })} size="small" fullWidth />
        </Grid>
      </Grid>
      <Divider sx={{ mt: 1 }} />
      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button data-testid="create-entity-submit" variant="contained" onClick={handleSave} disabled={isSaving} sx={{ px: 4, fontWeight: 600 }}>{isSaving ? "Creating..." : "Create"}</Button>
      </Stack>
    </Box>
  );
}

export function CreateEntityDialog({ open, moduleName, onClose, onCreated }: CreateEntityDialogProps) {
  const [entityType, setEntityType] = useState<EntityType>("Measurement");

  const handleCreated = () => {
    onCreated();
    onClose();
  };

  return (
    <Dialog data-testid="create-entity-dialog" open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>Create Entity</Typography>
        <TextField
          data-testid="btn-create-entity"
          select
          size="small"
          label="Entity Type"
          value={entityType}
          onChange={(e) => setEntityType(e.target.value as EntityType)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="Measurement">Measurement</MenuItem>
          <MenuItem value="Characteristic">Characteristic</MenuItem>
          <MenuItem value="AxisPts">AxisPts</MenuItem>
          <MenuItem value="CompuMethod">CompuMethod</MenuItem>
          <MenuItem value="CompuVtab">CompuVtab</MenuItem>
          <MenuItem value="RecordLayout">RecordLayout</MenuItem>
        </TextField>
      </DialogTitle>
      <DialogContent>
        {entityType === "Measurement" && (
          <MeasurementCreateForm moduleName={moduleName} onSave={handleCreated} onCancel={onClose} />
        )}
        {entityType === "Characteristic" && (
          <CharacteristicCreateForm moduleName={moduleName} onSave={handleCreated} onCancel={onClose} />
        )}
        {entityType === "AxisPts" && (
          <AxisPtsCreateForm moduleName={moduleName} onSave={handleCreated} onCancel={onClose} />
        )}
        {entityType === "CompuMethod" && (
          <CompuMethodEditor moduleName={moduleName} onSave={handleCreated} onCancel={onClose} />
        )}
        {entityType === "CompuVtab" && (
          <CompuVtabEditor moduleName={moduleName} onSave={handleCreated} onCancel={onClose} />
        )}
        {entityType === "RecordLayout" && (
          <RecordLayoutEditor moduleName={moduleName} onSave={handleCreated} onCancel={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}
