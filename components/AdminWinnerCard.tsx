import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Float } from "@/lib/drizzle/schema"
import type { UiLabels } from "@/lib/labels"

interface Winner {
  float: Float
  total: number
}

interface AdminWinnerCardProps {
  title: string
  winners: Winner[]
  labels?: UiLabels
}

export function AdminWinnerCard({ title, winners, labels }: AdminWinnerCardProps) {
  if (winners.length === 0) {
    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No scores yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2" style={{ borderColor: "#F59E0B" }}>
      <CardHeader style={{ backgroundColor: "#F59E0B", color: "white" }}>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {winners.map((winner, index) => (
          <div key={winner.float.id} className="mb-4 last:mb-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-lg">
                  {(labels?.entryNumber ?? "Float #")}{winner.float.floatNumber}
                </p>
                <p className="text-sm text-muted-foreground">
                  {winner.float.organization}
                </p>
                {winner.float.entryName && (
                  <p className="text-xs text-muted-foreground italic">
                    {winner.float.entryName}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold" style={{ color: "#DC2626" }}>
                  {winner.total}
                </p>
                {winners.length > 1 && (
                  <p className="text-xs text-muted-foreground">Tie</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

