import { redirect } from "next/navigation"
import { getJudgeId } from "@/lib/cookies"
import { db, schema } from "@/lib/db"
import { getScoreItems, getEventCategories } from "@/lib/scores"
import { eq, asc, and } from "drizzle-orm"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SubmitButton } from "@/components/SubmitButton"
import { LogoutButton } from "@/components/LogoutButton"
import Link from "next/link"
import { Button } from "@/components/ui/button"

// Force dynamic rendering since we use cookies
export const dynamic = 'force-dynamic'

export default async function ReviewPage() {
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
  const judgeEventId = judge[0].eventId

  // Get all approved floats - filter by event if judge has eventId
  let floats
  if (judgeEventId) {
    floats = await db
      .select()
      .from(schema.floats)
      .where(
        and(
          eq(schema.floats.approved, true),
          eq(schema.floats.eventId, judgeEventId)
        )
      )
      .orderBy(asc(schema.floats.floatNumber))
  } else {
    floats = await db
      .select()
      .from(schema.floats)
      .where(eq(schema.floats.approved, true))
      .orderBy(asc(schema.floats.floatNumber))
  }

  // Get all scores for this judge
  const scores = await db
    .select()
    .from(schema.scores)
    .where(eq(schema.scores.judgeId, judgeId))

  type ScoreType = typeof schema.scores.$inferSelect
  const scoresMap = new Map<number, ScoreType>(scores.map((s: ScoreType) => [s.floatId, s]))

  // Get event categories if eventId is available
  let categories: typeof schema.eventCategories.$inferSelect[] = []
  if (judgeEventId) {
    try {
      categories = await getEventCategories(judgeEventId)
    } catch (error: any) {
      // If categories don't exist, use defaults
      console.log("Could not fetch event categories, using defaults")
    }
  }

  // If no categories, use default categories
  if (categories.length === 0) {
    categories = [
      { id: 1, eventId: 0, categoryName: "Lighting", displayOrder: 0, required: true, hasNoneOption: true, createdAt: new Date() },
      { id: 2, eventId: 0, categoryName: "Theme", displayOrder: 1, required: true, hasNoneOption: true, createdAt: new Date() },
      { id: 3, eventId: 0, categoryName: "Traditions", displayOrder: 2, required: true, hasNoneOption: true, createdAt: new Date() },
      { id: 4, eventId: 0, categoryName: "Spirit", displayOrder: 3, required: true, hasNoneOption: true, createdAt: new Date() },
      { id: 5, eventId: 0, categoryName: "Music", displayOrder: 4, required: false, hasNoneOption: true, createdAt: new Date() },
    ]
  }

  // Group score items by scoreId
  const itemsByScoreId = new Map<number, Map<string, number | null>>()
  for (const score of scores) {
    try {
      const items = await getScoreItems(score.id)
      const itemsMap = new Map<string, number | null>()
      items.forEach((item: { categoryName: string; value: number | null }) => {
        itemsMap.set(item.categoryName, item.value)
      })
      itemsByScoreId.set(score.id, itemsMap)
    } catch (error) {
      // If score_items don't exist, use legacy columns
      // itemsByScoreId will be empty, so we'll fall back to legacy columns
    }
  }

  // Helper function to check if a score is complete
  const isScoreComplete = (score: typeof scores[0] | undefined, float: typeof floats[0]): boolean => {
    if (!score) return false
    
    // Check if score has items (new system)
    const items = itemsByScoreId.get(score.id)
    if (items && items.size > 0) {
      // Check if all required categories have non-null values
      const requiredCategories = categories.filter(c => c.required)
      for (const category of requiredCategories) {
        const value = items.get(category.categoryName)
        if (value === null || value === undefined) {
          return false
        }
      }
      // Special check for Music
      if (float.hasMusic === false) {
        // Music should be 0 if hasMusic is false
        const musicValue = items.get('Music')
        if (musicValue !== 0) {
          return false
        }
      }
      return true
    }
    
    // Fallback to legacy columns
    const lighting = score.lighting != null ? Number(score.lighting) : 0
    const theme = score.theme != null ? Number(score.theme) : 0
    const traditions = score.traditions != null ? Number(score.traditions) : 0
    const spirit = score.spirit != null ? Number(score.spirit) : 0
    const music = float.hasMusic === false ? 0 : (score.music != null ? Number(score.music) : 0)
    
    const allNonZero = lighting > 0 && theme > 0 && traditions > 0 && spirit > 0 && (float.hasMusic === false || music > 0)
    return allNonZero
  }

  const scoredCount = floats.filter((f: typeof schema.floats.$inferSelect) => {
    const score = scoresMap.get(f.id)
    return isScoreComplete(score, f)
  }).length
  const totalCount = floats.length

  return (
    <div className="min-h-screen pb-20">
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-2 flex items-center justify-between">
        <div className="text-sm font-medium" style={{ color: "#DC2626" }}>
          {judge[0].name}
        </div>
        <Link href="/judge">
          <Button variant="ghost" size="sm" className="text-xs">
            Change Judge
          </Button>
        </Link>
      </div>
      <div className="container mx-auto px-4 py-4 sm:py-6">
        <div className="mb-4 sm:mb-6">
          {/* Mobile-friendly header - stacks on small screens */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2" style={{ color: "#14532D" }}>
                {isSubmitted ? "Final Scores" : "Review Scores"}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                {scoredCount} of {totalCount} floats scored
                {isSubmitted && (
                  <span className="ml-2 text-[#DC2626] font-semibold">• Locked</span>
                )}
              </p>
            </div>
            {!isSubmitted && (
              <Link href="/floats" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto h-10 sm:h-12 text-sm sm:text-base"
                  style={{ borderColor: "#16A34A", color: "#16A34A" }}
                >
                  Continue Scoring
                </Button>
              </Link>
            )}
            {isSubmitted && (
              <Link href="/submit" className="w-full sm:w-auto">
                <Button
                  variant="outline"
                  className="w-full sm:w-auto h-10 sm:h-12 text-sm sm:text-base"
                  style={{ borderColor: "#DC2626", color: "#DC2626" }}
                >
                  Back to Submission
                </Button>
              </Link>
            )}
          </div>
        </div>

        {!isSubmitted && (
          <div className="mb-6">
            <SubmitButton />
          </div>
        )}

        {isSubmitted && (
          <div className="mb-6 space-y-3">
            <div className="p-4 rounded-lg border-2" style={{ borderColor: "#DC2626", backgroundColor: "#FEF2F2" }}>
              <p className="text-sm font-semibold text-[#DC2626]">
                ⚠️ Scores are locked. Contact an administrator to unlock if you need to make changes.
              </p>
            </div>
            <div className="max-w-xs mx-auto">
              <LogoutButton />
            </div>
          </div>
        )}

        <div className="rounded-md border overflow-x-auto -mx-4 sm:mx-0">
          <Table className="text-xs sm:text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="px-2 sm:px-4 whitespace-nowrap">#</TableHead>
                <TableHead className="px-2 sm:px-4 min-w-[100px]">Organization</TableHead>
                {categories.map((category) => (
                  <TableHead key={category.id || category.categoryName} className="px-1 sm:px-2 text-center whitespace-nowrap">
                    <span className="hidden sm:inline">{category.categoryName}</span>
                    <span className="sm:hidden">{category.categoryName.slice(0, 3)}</span>
                    {category.required && <span className="text-red-500 ml-0.5">*</span>}
                  </TableHead>
                ))}
                <TableHead className="px-2 sm:px-4 text-center">Total</TableHead>
                <TableHead className="px-2 sm:px-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {floats.map((float: typeof schema.floats.$inferSelect) => {
                const score = scoresMap.get(float.id)
                const isComplete = isScoreComplete(score, float)
                const hasScore = !!score
                const scoreItems = score ? itemsByScoreId.get(score.id) : null

                return (
                  <TableRow
                    key={float.id}
                    className={!isComplete ? "opacity-50 bg-gray-100" : ""}
                  >
                    <TableCell className="font-medium">
                      #{float.floatNumber}
                    </TableCell>
                    <TableCell>{float.organization}</TableCell>
                    {categories.map((category) => {
                      const categoryName = category.categoryName
                      let value: number | null | undefined = null
                      
                      // Try to get from score_items first
                      if (scoreItems) {
                        value = scoreItems.get(categoryName)
                      } else if (score) {
                        // Fallback to legacy columns
                        const legacyMap: Record<string, string> = {
                          'Lighting': 'lighting',
                          'Theme': 'theme',
                          'Traditions': 'traditions',
                          'Spirit': 'spirit',
                          'Music': 'music',
                        }
                        const legacyKey = legacyMap[categoryName] as keyof ScoreType | undefined
                        if (legacyKey && legacyKey in score) {
                          value = score[legacyKey] as number | null
                        }
                      }

                      // Special handling for Music
                      if (categoryName === 'Music' && float.hasMusic === false) {
                        value = 0
                      }

                      return (
                        <TableCell
                          key={category.id || categoryName}
                          className={!hasScore ? "text-[#DC2626] font-semibold" : ""}
                        >
                          {value === null || value === undefined
                            ? "—"
                            : value === 0
                            ? "0 (N/A)"
                            : value}
                        </TableCell>
                      )
                    })}
                    <TableCell className="font-semibold">
                      {score?.total ?? "—"}
                    </TableCell>
                    <TableCell>
                      {!isSubmitted ? (
                        <Link href={`/float/${float.id}`}>
                          <Button variant="ghost" size="sm">
                            {isComplete ? "Edit" : "Score"}
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground text-sm">Locked</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        {!isSubmitted && (
          <div className="mt-6 mb-8">
            <SubmitButton />
          </div>
        )}
      </div>
    </div>
  )
}
