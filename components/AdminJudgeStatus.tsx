"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { toast } from "sonner"

interface JudgeStatus {
  id: number
  name: string
  submitted: boolean
  scoreCount: number
}

interface AdminJudgeStatusProps {
  judges: JudgeStatus[]
  onUnlock?: (judgeId: number) => void
}

function getAdminPassword(): string | null {
  if (typeof document === "undefined") return null
  const cookies = document.cookie.split(";")
  const authCookie = cookies.find((c) => c.trim().startsWith("admin-auth="))
  return authCookie ? authCookie.split("=")[1] : null
}

export function AdminJudgeStatus({ judges, onUnlock }: AdminJudgeStatusProps) {
  const [unlocking, setUnlocking] = useState<number | null>(null)

  const handleUnlock = async (judgeId: number, judgeName: string) => {
    if (!confirm(`Are you sure you want to unlock scores for ${judgeName}? They will be able to edit their scores again.`)) {
      return
    }

    setUnlocking(judgeId)
    try {
      const password = getAdminPassword()
      if (!password) {
        toast.error("Admin authentication required")
        return
      }

      const response = await fetch("/api/admin/judges/unlock", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({ judgeId }),
      })

      if (response.ok) {
        toast.success(`Scores unlocked for ${judgeName}`)
        // Call the callback to trigger a refetch
        if (onUnlock) {
          onUnlock(judgeId)
        } else {
          // Fallback: wait a moment for database propagation, then reload
          await new Promise(resolve => setTimeout(resolve, 500))
          window.location.reload()
        }
      } else {
        const error = await response.json()
        toast.error(error.error || "Failed to unlock scores")
      }
    } catch (error) {
      console.error("Error unlocking judge scores:", error)
      toast.error("Failed to unlock scores")
    } finally {
      setUnlocking(null)
    }
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[100px]">Judge</TableHead>
            <TableHead className="min-w-[100px]">Status</TableHead>
            <TableHead className="min-w-[80px]">Scores</TableHead>
            <TableHead className="min-w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {judges.map((judge) => (
            <TableRow key={judge.id}>
              <TableCell className="font-medium">{judge.name}</TableCell>
              <TableCell>
                {judge.submitted ? (
                  <span className="text-[#16A34A] font-semibold">✓ Submitted</span>
                ) : (
                  <span className="text-[#DC2626] font-semibold">✗ Pending</span>
                )}
              </TableCell>
              <TableCell>{judge.scoreCount}</TableCell>
              <TableCell>
                {judge.submitted && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUnlock(judge.id, judge.name)}
                    disabled={unlocking === judge.id}
                    style={{ borderColor: "#DC2626", color: "#DC2626" }}
                  >
                    {unlocking === judge.id ? "Unlocking..." : "Unlock"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

