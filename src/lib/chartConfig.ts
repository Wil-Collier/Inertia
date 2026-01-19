export const CHART_HEIGHTS = {
  sm: "h-48",   // 192px
  md: "h-52",   // 208px  
  lg: "h-72",   // 288px
} as const

export const CHART_AXIS_STYLE = { 
  fontSize: 11,
  fill: "var(--muted-foreground)"
} as const

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    fontSize: "12px",
  },
  cursor: { fill: "var(--muted)", opacity: 0.2 }
} as const
