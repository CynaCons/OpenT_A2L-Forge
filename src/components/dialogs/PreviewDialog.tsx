import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import type { SymbolWithMapping } from "../../types";

interface PreviewDialogProps {
  open: boolean;
  measurements: SymbolWithMapping[];
  onMeasurementsChange: (measurements: SymbolWithMapping[]) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function PreviewDialog({ open, measurements, onMeasurementsChange, onClose, onConfirm }: PreviewDialogProps) {
  return (
    <Dialog data-testid="dialog-preview" open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Import Preview - {measurements.length} symbols selected</DialogTitle>
      <DialogContent>
        <TableContainer sx={{ maxHeight: 500 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Address</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Lower Limit</TableCell>
                <TableCell>Upper Limit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {measurements.map((measurement, idx) => (
                <TableRow key={idx}>
                  <TableCell sx={{ fontFamily: "monospace" }}>{measurement.name}</TableCell>
                  <TableCell sx={{ fontFamily: "monospace", color: "#4ec9b0" }}>
                    0x{measurement.address.toString(16).toUpperCase()}
                  </TableCell>
                  <TableCell>
                    <TextField
                      select
                      size="small"
                      value={measurement.a2l_type}
                      onChange={(e) => {
                        const updated = [...measurements];
                        updated[idx] = { ...updated[idx], a2l_type: e.target.value };
                        onMeasurementsChange(updated);
                      }}
                      sx={{ minWidth: 120 }}
                    >
                      <MenuItem value="UBYTE">UBYTE</MenuItem>
                      <MenuItem value="SBYTE">SBYTE</MenuItem>
                      <MenuItem value="UWORD">UWORD</MenuItem>
                      <MenuItem value="SWORD">SWORD</MenuItem>
                      <MenuItem value="ULONG">ULONG</MenuItem>
                      <MenuItem value="SLONG">SLONG</MenuItem>
                      <MenuItem value="A_UINT64">A_UINT64</MenuItem>
                      <MenuItem value="A_INT64">A_INT64</MenuItem>
                      <MenuItem value="FLOAT32_IEEE">FLOAT32_IEEE</MenuItem>
                      <MenuItem value="FLOAT64_IEEE">FLOAT64_IEEE</MenuItem>
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={measurement.lower_limit}
                      onChange={(e) => {
                        const updated = [...measurements];
                        updated[idx] = { ...updated[idx], lower_limit: parseFloat(e.target.value) };
                        onMeasurementsChange(updated);
                      }}
                      sx={{ width: 100 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      value={measurement.upper_limit}
                      onChange={(e) => {
                        const updated = [...measurements];
                        updated[idx] = { ...updated[idx], upper_limit: parseFloat(e.target.value) };
                        onMeasurementsChange(updated);
                      }}
                      sx={{ width: 100 }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onConfirm} variant="contained">
          Continue to Import
        </Button>
      </DialogActions>
    </Dialog>
  );
}
