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

/**
 * Variant A ("Refined VS Code") design tokens — the single source of truth
 * for colors in the app. Components must import from here instead of using
 * hardcoded hex literals. See docs/prototypes/visual-upgrade.html and PLAN v6.0.
 */
export const tokens = {
  accent: "#3794ff",
  bg: "#1e1e1e",
  surface: "#252529",
  surface2: "#2d2d33",
  border: "#3c3c44",
  textPrimary: "#d6d6dd",
  textMuted: "#9d9daa",
  selection: "rgba(55,148,255,0.18)",
  statusError: "#9a3324",
  // Darker accent shade for the status bar: white text on it must meet WCAG AA (≥4.5:1).
  statusBarBg: "#1f6feb",
  transition: "150ms ease",
} as const;

/** Standard ASAP2 data types (superset used by create forms and editors). */
export const DATA_TYPES = [
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

export const CHARACTERISTIC_TYPES = ["VALUE", "CURVE", "MAP", "CUBOID", "VAL_BLK", "ASCII"];

/** Per-entity-kind accent color (shared by tree icons, chips, form headers). */
export function getEntityAccent(kind: string): string {
  switch (kind) {
    case "Measurement": return "#4ec9b0";
    case "Characteristic": return "#ce9178";
    case "AxisPts": return "#569cd6";
    case "CompuMethod": return "#c586c0";
    case "CompuVtab": return "#dcdcaa";
    case "RecordLayout": return "#c586c0";
    case "Module": return "#dcdcaa";
    default: return tokens.textMuted;
  }
}

export const ideTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: tokens.accent },
    secondary: { main: "#b76e79" },
    background: {
      default: tokens.bg,
      paper: tokens.surface,
    },
    text: {
      primary: tokens.textPrimary,
      secondary: tokens.textMuted,
    },
    divider: tokens.border,
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
        // Contained buttons use the darker accent shade so white label text meets WCAG AA.
        contained: {
          backgroundColor: tokens.statusBarBg,
          "&:hover": { backgroundColor: "#1b5fd0" },
          "&:active": { filter: "brightness(0.92)" },
        },
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
          transition: `background-color ${tokens.transition}`,
          "&.Mui-selected": {
            backgroundColor: tokens.selection,
            borderLeft: `3px solid ${tokens.accent}`,
            paddingLeft: 13,
            "&:hover": { backgroundColor: tokens.surface2 },
          },
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: "#101010",
          color: tokens.textPrimary,
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
    default: return tokens.textMuted;
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
