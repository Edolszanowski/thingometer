import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const returnTo = searchParams.get("returnTo") || "/judge/login"
  
  // Validate returnTo is a safe path (starts with /)
  const safePath = returnTo.startsWith("/") ? returnTo : "/judge/login"
  
  const res = NextResponse.redirect(new URL(safePath, req.url))
  res.cookies.delete("judge-auth")
  res.cookies.delete("parade-judge-id")
  return res
}

