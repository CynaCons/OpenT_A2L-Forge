import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

interface UnsavedDialogProps {
  open: boolean;
  onClose: () => void;
  onDontSave: () => void;
  onSave: () => void;
}

export function UnsavedDialog({ open, onClose, onDontSave, onSave }: UnsavedDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Unsaved Changes</DialogTitle>
      <DialogContent>
        <Typography>You have unsaved changes. Do you want to save before continuing?</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onDontSave} color="warning">Don't Save</Button>
        <Button onClick={onSave} variant="contained">Save</Button>
      </DialogActions>
    </Dialog>
  );
}
