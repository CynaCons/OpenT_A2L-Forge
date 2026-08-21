import { Typography } from "@mui/material";

interface SectionHeaderProps {
  title: string;
  accent: string;
}

/** Overline section header with a per-entity accent bar, used by all editors and create forms. */
export function SectionHeader({ title, accent }: SectionHeaderProps) {
  return (
    <Typography
      variant="overline"
      sx={{
        display: "block",
        color: "text.secondary",
        letterSpacing: 1.5,
        fontSize: 10,
        borderLeft: `2px solid ${accent}`,
        pl: 1.5,
        mb: 0.5,
        mt: 1,
      }}
    >
      {title}
    </Typography>
  );
}
