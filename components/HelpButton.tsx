"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { HelpCircle, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export interface HelpContentItem {
  id?: number
  title: string
  content: string
  videoUrl?: string
  displayOrder?: number
}

interface HelpButtonProps {
  role: string
  pageContext: string
  helpContent?: HelpContentItem[]
  className?: string
}

/**
 * HelpButton - Context-aware help system component
 * 
 * Help and onboarding features are designed to provide just-in-time confidence
 * rather than formal training, enabling judges, volunteers, and coordinators
 * to perform effectively with minimal instruction.
 */
export function HelpButton({
  role,
  pageContext,
  helpContent = [],
  className = "",
}: HelpButtonProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [content, setContent] = useState<HelpContentItem[]>(helpContent)
  const [loading, setLoading] = useState(false)

  // Fetch help content from the server if not provided as props
  useEffect(() => {
    if (helpContent.length === 0 && open) {
      fetchHelpContent()
    }
  }, [open, helpContent.length])

  async function fetchHelpContent() {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/help?role=${encodeURIComponent(role)}&context=${encodeURIComponent(pageContext)}`
      )
      if (response.ok) {
        const data = await response.json()
        setContent(data)
      }
    } catch (error) {
      console.error("Failed to fetch help content:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredContent = content.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className={`fixed bottom-4 right-4 rounded-full w-12 h-12 shadow-lg z-50 bg-white hover:bg-gray-100 border border-gray-200 ${className}`}
        aria-label="Help"
      >
        <HelpCircle className="h-6 w-6 text-gray-600" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Help & Instructions</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search help topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredContent.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery
                  ? "No help topics found matching your search"
                  : "No help content available for this page"}
              </p>
            ) : (
              <div className="space-y-4">
                {filteredContent.map((item, index) => (
                  <div key={item.id || index} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <div
                      className="prose prose-sm max-w-none text-gray-600"
                      dangerouslySetInnerHTML={{ __html: item.content }}
                    />
                    {item.videoUrl && (
                      <div className="mt-3">
                        <a
                          href={item.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Watch video tutorial →
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
