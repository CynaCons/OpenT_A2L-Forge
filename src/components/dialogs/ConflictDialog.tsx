import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import type { ConflictReport } from "../../types";

interface ConflictDialogProps {
  open: boolean;
  conflictReport: ConflictReport | null;
  onClose: () => void;
  onResolve: (action: "skip" | "replace") => void;
}

export function ConflictDialog({ open, conflictReport, onClose, onResolve }: ConflictDialogProps) {
  return (
    <Dialog data-testid="dialog-conflict" open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Symbol Import Conflicts</DialogTitle>
      <DialogContent>
        {conflictReport && (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              {conflictReport.conflicts.length} of {conflictReport.conflicts.length + conflictReport.non_conflicts.length} symbols already exist in the project.
            </Alert>
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Symbol Name</TableCell>
                    <TableCell>Existing</TableCell>
                    <TableCell>New</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {conflictReport.conflicts.map(conflict => (
                    <TableRow key={conflict.symbol_name}>
                      <TableCell>{conflict.symbol_name}</TableCell>
                      <TableCell>{conflict.existing_address} ({conflict.existing_type})</TableCell>
                      <TableCell>{conflict.new_address} ({conflict.new_type})</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => onResolve("skip")} variant="outlined">
          Skip Conflicts ({conflictReport?.non_conflicts.length || 0} symbols)
        </Button>
        <Button onClick={() => onResolve("replace")} variant="contained" color="warning">
          Replace All
        </Button>
      </DialogActions>
    </Dialog>
  );
}
