import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Force dynamic rendering since we use request headers
export const dynamic = 'force-dynamic'

function verifyAdminPassword(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  const password = process.env.ADMIN_PASSWORD

  if (!password) {
    return false
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7) === password
  }

  const searchParams = request.nextUrl.searchParams
  const queryPassword = searchParams.get("password")
  return queryPassword === password
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminPassword(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing Supabase configuration" },
        { status: 500 }
      )
    }

    // Create a fresh client with no caching
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      },
    })

    const body = await request.json()
    const { judgeId } = body

    if (!judgeId) {
      return NextResponse.json(
        { error: "Missing required field: judgeId" },
        { status: 400 }
      )
    }

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/b9cff614-5356-493b-8a2f-a25c3a6bf3a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/judges/unlock:POST',message:'Before update',data:{judgeId,supabaseUrl:supabaseUrl?.slice(0,30)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'FIX',runId:'post-fix'})}).catch(()=>{});
    // #endregion

    // Update judge to unlock (set submitted to false)
    // Using both update and immediate select to ensure consistency
    const { data: updated, error } = await supabase
      .from("judges")
      .update({ submitted: false })
      .eq("id", judgeId)
      .select()
      .single()

    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/b9cff614-5356-493b-8a2f-a25c3a6bf3a0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/admin/judges/unlock:POST',message:'After update',data:{judgeId,success:!error,updated:updated,error:error?.message},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'FIX',runId:'post-fix'})}).catch(()=>{});
    // #endregion

    if (error) {
      console.error("Error unlocking judge scores:", error)
      return NextResponse.json({ error: "Failed to unlock judge" }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ error: "Judge not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, judge: updated })
  } catch (error) {
    console.error("Error unlocking judge scores:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

