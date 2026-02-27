import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import type { A2lTreeItem } from "../../types";
import { getKindIcon } from "../../theme";

interface DeleteDialogProps {
  open: boolean;
  items: A2lTreeItem[];
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteDialog({ open, items, onClose, onConfirm }: DeleteDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} data-testid="delete-dialog">
      <DialogTitle>Delete {items.length === 1 ? "Entity" : `${items.length} Entities`}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          Are you sure you want to delete the following {items.length === 1 ? "entity" : "entities"}? This action cannot be undone.
        </Typography>
        <Box sx={{ maxHeight: 200, overflow: "auto", bgcolor: "#1a1a1a", borderRadius: 1, p: 1 }}>
          {items.map((item) => (
            <Stack key={item.id} direction="row" spacing={1} alignItems="center" sx={{ py: 0.5 }}>
              {getKindIcon(item.kind)}
              <Typography variant="body2" sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>{item.name}</Typography>
              <Chip label={item.kind} size="small" sx={{ height: 18, fontSize: 10 }} />
            </Stack>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onConfirm} color="error" variant="contained" data-testid="btn-confirm-delete">Delete</Button>
      </DialogActions>
    </Dialog>
  );
}
