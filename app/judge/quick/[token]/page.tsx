import { redirect } from "next/navigation"
import { verifyJudgeToken } from "@/lib/judge-tokens"
import { setJudgeId } from "@/lib/cookies"
import { db, schema } from "@/lib/db"
import { eq } from "drizzle-orm"

interface QuickLoginPageProps {
  params: { token: string }
}

export default async function QuickLoginPage({ params }: QuickLoginPageProps) {
  const { token } = params
  
  // Verify the token
  const result = verifyJudgeToken(token)
  
  if (!result.valid || !result.judgeId) {
    // Invalid token - redirect to manual login
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-red-700 mb-2">Invalid QR Code</h1>
          <p className="text-red-600 mb-4">
            This QR code is invalid or has expired. Please ask the coordinator for a new one.
          </p>
          <a 
            href="/judge" 
            className="inline-block bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700"
          >
            Go to Judge Login
          </a>
        </div>
      </div>
    )
  }
  
  // Verify the judge exists
  const judge = await db
    .select()
    .from(schema.judges)
    .where(eq(schema.judges.id, result.judgeId))
    .limit(1)
  
  if (judge.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">👤</div>
          <h1 className="text-2xl font-bold text-red-700 mb-2">Judge Not Found</h1>
          <p className="text-red-600 mb-4">
            This judge account no longer exists. Please contact the coordinator.
          </p>
          <a 
            href="/judge" 
            className="inline-block bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700"
          >
            Go to Judge Login
          </a>
        </div>
      </div>
    )
  }
  
  // Set the judge cookie and redirect to floats
  await setJudgeId(result.judgeId)
  
  // Redirect to the floats page
  redirect("/floats")
}

