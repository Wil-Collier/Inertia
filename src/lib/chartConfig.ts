export const CHART_HEIGHTS = {
  sm: "h-48",   // 192px
  md: "h-52",   // 208px  
  lg: "h-72",   // 288px
} as const

export const CHART_AXIS_STYLE = { 
  fontSize: 11,
  fill: "hsl(var(--muted-foreground))"
} as const

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
  },
  cursor: { fill: "hsl(var(--muted))", opacity: 0.2 }
} as const
