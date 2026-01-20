import { redirect } from "next/navigation"
import { getJudgeId } from "@/lib/cookies"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogoutButton } from "@/components/LogoutButton"

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

export default async function SubmitPage() {
  const judgeId = await getJudgeId()
  
  if (!judgeId) {
    redirect("/judge")
  }

  // Get judge info
  const judge = await db
    .select()
    .from(schema.judges)
    .where(eq(schema.judges.id, judgeId))
    .limit(1)

  if (judge.length === 0) {
    redirect("/judge")
  }

  const isSubmitted = judge[0].submitted
  const judgeName = judge[0].name

  if (!isSubmitted) {
    redirect("/review")
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold" style={{ color: "#16A34A" }}>
            Thank You, {judgeName}!
          </h1>
          <p className="text-xl text-muted-foreground">
            Your scores have been finalized and locked.
          </p>
        </div>

        <div className="p-6 rounded-lg border-2" style={{ borderColor: "#DC2626" }}>
          <p className="text-lg font-semibold mb-2">Scores Locked</p>
          <p className="text-sm text-muted-foreground">
            You can no longer modify your scores. All submissions have been recorded.
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/review">
            <Button
              variant="outline"
              className="w-full h-12"
              style={{ borderColor: "#16A34A", color: "#16A34A" }}
            >
              View Final Scores (Read-Only)
            </Button>
          </Link>
          
          <LogoutButton />
        </div>
      </div>
    </div>
  )
}

