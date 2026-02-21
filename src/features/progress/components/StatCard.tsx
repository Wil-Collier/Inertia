import { Card, CardContent } from "@/components/ui/card"

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  sublabel?: string
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          <span className="text-xs">{label}</span>
        </div>
        <p className="mt-1 text-2xl font-bold">
          {value}
          {sublabel && (
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              {sublabel}
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  )
}
