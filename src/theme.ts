import { createTheme } from "@mui/material";
import {
  Extension,
  Speed,
  Timeline,
  Functions,
  TableChart,
  DataObject,
} from "@mui/icons-material";
import { createElement } from "react";

export const ideTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#3794ff" },
    secondary: { main: "#b76e79" },
    background: {
      default: "#1e1e1e",
      paper: "#252526",
    },
    text: {
      primary: "#e7e7e7",
      secondary: "#a0a0a0",
    },
    divider: "#333333",
    action: {
      hover: "rgba(255, 255, 255, 0.08)",
      selected: "rgba(255, 255, 255, 0.12)",
    },
  },
  typography: {
    fontFamily: '"JetBrains Mono", "Segoe UI", "Inter", monospace',
    fontSize: 12,
    button: { textTransform: "none", fontWeight: 600, fontSize: 12 },
    h6: { fontSize: "1rem", fontWeight: 600, letterSpacing: 0.5 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 4 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          marginBottom: 1,
          "&.Mui-selected": {
            backgroundColor: "#37373d",
            borderLeft: "3px solid #3794ff",
            paddingLeft: 13,
            "&:hover": { backgroundColor: "#2a2d2e" },
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#202020",
          border: "1px solid #454545",
          fontSize: 11,
        },
      },
    },
  },
});

export function getKindColor(kind: string): string {
  switch (kind) {
    case "Module": return "#dcdcaa";
    case "Measurement": return "#4ec9b0";
    case "Characteristic": return "#ce9178";
    case "AxisPts": return "#569cd6";
    case "RecordLayout": return "#c586c0";
    default: return "#888";
  }
}

export function getPropertySection(label: string, _kind?: string): string {
  const upper = label.toUpperCase();
  if (["LONG IDENTIFIER"].includes(upper)) return "Description";
  if (["DATATYPE", "TYPE", "CONVERSION", "CONVERSION TYPE", "FORMAT", "UNIT", "ENCODING", "PHYS UNIT"].includes(upper)) return "Data Type & Conversion";
  if (["LIMITS", "LOWER LIMIT", "UPPER LIMIT", "EXTENDED LIMITS", "MAX DIFF", "STEP SIZE"].includes(upper)) return "Limits & Range";
  if (["ADDRESS", "ECU ADDRESS", "ECU ADDRESS EXT", "ADDRESS TYPE", "BIT MASK", "BIT OPERATION", "BYTE ORDER", "DEPOSIT", "DEPOSIT RECORD", "INPUT QUANTITY", "MAX AXIS POINTS"].includes(upper)) return "Address & Layout";
  if (["RESOLUTION", "ACCURACY"].includes(upper)) return "Precision";
  return "Other Properties";
}

export function getKindIcon(kind: string) {
  switch (kind) {
    case "Module": return createElement(Extension, { fontSize: "inherit", style: { color: "#dcdcaa" } });
    case "Measurement": return createElement(Speed, { fontSize: "inherit", style: { color: "#4ec9b0" } });
    case "Characteristic": return createElement(Timeline, { fontSize: "inherit", style: { color: "#ce9178" } });
    case "AxisPts": return createElement(Functions, { fontSize: "inherit", style: { color: "#569cd6" } });
    case "RecordLayout": return createElement(TableChart, { fontSize: "inherit", style: { color: "#c586c0" } });
    default: return createElement(DataObject, { fontSize: "inherit", color: "disabled" });
  }
}
