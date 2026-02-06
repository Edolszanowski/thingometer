import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

function getServiceSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      supabase: null as any,
      error: "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY",
    }
  }

  return { supabase: createClient(supabaseUrl, serviceRoleKey), error: null as string | null }
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, error: envError } = getServiceSupabase()
    if (envError) {
      return NextResponse.json({ error: envError }, { status: 500 })
    }

    const searchParams = req.nextUrl.searchParams
    const tokenParam = searchParams.get("token")
    const eventIdParam = searchParams.get("eventId")
    const passwordParam = searchParams.get("password")

    // ---------------------------------------------------------------------------
    // MODE 1: QR TOKEN AUTH (PRIMARY)
    // ---------------------------------------------------------------------------
    if (typeof tokenParam === "string") {
      const token = tokenParam.trim()
      if (!token) {
        return NextResponse.json({ error: "Missing token" }, { status: 400 })
      }

      let judge: any = null
      try {
        const res = await supabase
          .from("judges")
          .select("id,name,event_id,access_token")
          .eq("access_token", token)
          .single()
        judge = res.data
        if (res.error) {
          console.error("[api/judge/auth] Supabase error (judges by token):", res.error)
          return NextResponse.json({ error: "Internal server error" }, { status: 500 })
        }
      } catch (err) {
        console.error("[api/judge/auth] Unhandled error (judges by token):", err)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
      }

      if (!judge) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 })
      }

      const eventId = judge.event_id
      if (typeof eventId !== "number") {
        // Data integrity issue: a judge must belong to exactly one event.
        return NextResponse.json({ error: "Judge is not assigned to an event" }, { status: 500 })
      }

      let event: any = null
      try {
        const res = await supabase
          .from("events")
          .select("id,name,active")
          .eq("id", eventId)
          .single()
        event = res.data
        if (res.error) {
          console.error("[api/judge/auth] Supabase error (event by judge.event_id):", res.error)
          return NextResponse.json({ error: "Internal server error" }, { status: 500 })
        }
      } catch (err) {
        console.error("[api/judge/auth] Unhandled error (event by judge.event_id):", err)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
      }

      if (!event) {
        // Treat missing event as unauthorized to avoid leaking details.
        return NextResponse.json({ error: "Invalid token" }, { status: 401 })
      }

      if (!event.active) {
        return NextResponse.json({ error: "Event inactive" }, { status: 403 })
      }

      return NextResponse.json(
        {
          mode: "qr",
          event: { id: event.id, name: event.name },
          judge: { id: judge.id, name: judge.name },
        },
        { status: 200 }
      )
    }

    // ---------------------------------------------------------------------------
    // MODE 2: PASSWORD FALLBACK (EVENT-LEVEL)
    // ---------------------------------------------------------------------------
    if (typeof eventIdParam === "string" && typeof passwordParam === "string") {
      const eventId = Number.parseInt(eventIdParam, 10)
      if (!Number.isFinite(eventId) || eventId <= 0) {
        return NextResponse.json({ error: "Invalid eventId" }, { status: 400 })
      }

      const password = passwordParam
      if (!password) {
        return NextResponse.json({ error: "Missing password" }, { status: 400 })
      }

      let event: any = null
      try {
        const res = await supabase
          .from("events")
          .select("id,name,active")
          .eq("id", eventId)
          .single()
        event = res.data
        if (res.error) {
          console.error("[api/judge/auth] Supabase error (event by id):", res.error)
          return NextResponse.json({ error: "Internal server error" }, { status: 500 })
        }
      } catch (err) {
        console.error("[api/judge/auth] Unhandled error (event by id):", err)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
      }

      if (!event) {
        return NextResponse.json({ error: "Event not found" }, { status: 404 })
      }

      if (!event.active) {
        return NextResponse.json({ error: "Event inactive" }, { status: 403 })
      }

      const passwordKey = `judge_event_password:${eventId}`
      let setting: any = null
      try {
        const res = await supabase
          .from("settings")
          .select("value")
          .eq("key", passwordKey)
          .single()
        setting = res.data
        if (res.error) {
          console.error("[api/judge/auth] Supabase error (settings by key):", res.error)
          return NextResponse.json({ error: "Internal server error" }, { status: 500 })
        }
      } catch (err) {
        console.error("[api/judge/auth] Unhandled error (settings by key):", err)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
      }

      if (!setting || typeof setting.value !== "string") {
        return NextResponse.json({ error: "Wrong password" }, { status: 401 })
      }

      if (setting.value !== password) {
        return NextResponse.json({ error: "Wrong password" }, { status: 401 })
      }

      let judges: any[] | null = null
      try {
        const res = await supabase
          .from("judges")
          .select("id,name")
          .eq("event_id", eventId)
          .order("name", { ascending: true })

        judges = res.data

        if (res.error) {
          console.error("[api/judge/auth] Supabase error (judges by event):", res.error)
          return NextResponse.json({ error: "Internal server error" }, { status: 500 })
        }
      } catch (err) {
        console.error("[api/judge/auth] Unhandled error (judges by event):", err)
        return NextResponse.json({ error: "Internal server error" }, { status: 500 })
      }

      if (!judges || judges.length === 0) {
        return NextResponse.json({ error: "No judges" }, { status: 404 })
      }

      return NextResponse.json(
        {
          mode: "password",
          event: { id: event.id, name: event.name },
          judges: judges.map((j: any) => ({ id: j.id, name: j.name })),
        },
        { status: 200 }
      )
    }

    // ---------------------------------------------------------------------------
    // Explicit non-fallthrough: missing/unsupported input shape
    // ---------------------------------------------------------------------------
    return NextResponse.json(
      {
        error:
          "Unsupported authentication method. Use ?token=STRING or ?eventId=NUMBER&password=STRING",
      },
      { status: 400 }
    )
  } catch (err: any) {
    console.error("[api/judge/auth] UNHANDLED ERROR", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

