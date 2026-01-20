"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Printer, Maximize2 } from "lucide-react"
import type { Float } from "@/lib/drizzle/schema"

interface Winner {
  float: Float
  total: number
}

interface WinnersData {
  bestLighting: Winner[]
  bestTheme: Winner[]
  bestTraditions: Winner[]
  bestSpirit: Winner[]
  bestMusic: Winner[]
  bestOverall: Winner[]
  categories?: Record<string, Winner[]>
  entryCategoryTitle?: string
}

interface WinnersFullscreenProps {
  winners: WinnersData
  eventName?: string
}

export function WinnersFullscreen({ winners, eventName }: WinnersFullscreenProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handlePrint = () => {
    // Create a new window with just the printable content
    const printWindow = window.open('', '_blank', 'width=800,height=600')
    if (!printWindow) {
      alert('Please allow popups to print/export PDF')
      return
    }

    const categoriesHtml = categories.map(({ title, winners: categoryWinners }) => `
      <div style="border: 2px solid #F59E0B; border-radius: 8px; overflow: hidden; margin-bottom: 16px; page-break-inside: avoid;">
        <div style="background-color: #F59E0B; color: white; padding: 12px 16px; font-weight: bold; font-size: 18px;">
          ${title}
        </div>
        <div style="padding: 16px;">
          ${categoryWinners.length === 0 
            ? '<p style="color: #6b7280; font-style: italic;">No scores yet</p>'
            : categoryWinners.map(winner => `
              <div style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <p style="font-weight: bold; font-size: 18px; color: #14532D; margin: 0;">
                      🏅 Float #${winner.float.floatNumber}
                    </p>
                    <p style="font-size: 14px; margin: 4px 0 0 0;">
                      ${winner.float.organization}
                    </p>
                    ${winner.float.entryName ? `<p style="font-size: 12px; color: #6b7280; font-style: italic; margin: 2px 0 0 0;">${winner.float.entryName}</p>` : ''}
                  </div>
                  <div style="text-align: right;">
                    <p style="font-size: 24px; font-weight: bold; color: #DC2626; margin: 0;">
                      ${winner.total}
                    </p>
                    <p style="font-size: 12px; color: #6b7280; margin: 0;">points</p>
                    ${categoryWinners.length > 1 ? '<p style="font-size: 12px; color: #d97706; font-weight: 500; margin: 0;">TIE</p>' : ''}
                  </div>
                </div>
              </div>
            `).join('')
          }
        </div>
      </div>
    `).join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Parade Winners${eventName ? ` - ${eventName}` : ''}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 24px;
            }
            .header h1 {
              color: #14532D;
              margin: 0 0 8px 0;
            }
            .header p {
              margin: 4px 0;
              color: #6b7280;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 16px;
            }
            .footer {
              margin-top: 24px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              font-size: 12px;
              color: #6b7280;
            }
            @media print {
              body { padding: 0; }
              @page { margin: 0.5in; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🏆 Parade Winners 🏆</h1>
            ${eventName ? `<p style="font-size: 18px; color: #4b5563;">${eventName}</p>` : ''}
            <p>Generated on ${new Date().toLocaleDateString()}</p>
          </div>
          <div class="grid">
            ${categoriesHtml}
          </div>
          <div class="footer">
            <p>Parade Management System • iThrive AI</p>
          </div>
        </body>
      </html>
    `)
    
    printWindow.document.close()
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  const openFullscreen = () => {
    setIsFullscreen(true)
    document.body.style.overflow = 'hidden'
  }

  const closeFullscreen = () => {
    setIsFullscreen(false)
    document.body.style.overflow = ''
  }

  // Get all categories to display
  const getCategories = (): { name: string; title: string; winners: Winner[] }[] => {
    if (winners.categories && Object.keys(winners.categories).length > 0) {
      return Object.entries(winners.categories).map(([name, categoryWinners]) => ({
        name,
        title: name === "Entry" 
          ? (winners.entryCategoryTitle || "Best Entry")
          : `Best ${name}`,
        winners: categoryWinners,
      }))
    }
    
    // Fallback to legacy format
    return [
      { name: "Lighting", title: "Best Lighting", winners: winners.bestLighting },
      { name: "Theme", title: "Best Theme", winners: winners.bestTheme },
      { name: "Traditions", title: "Best Traditions", winners: winners.bestTraditions },
      { name: "Spirit", title: "Best Spirit", winners: winners.bestSpirit },
      { name: "Music", title: "Best Music", winners: winners.bestMusic },
      { name: "Overall", title: "Best Overall Entry", winners: winners.bestOverall },
    ]
  }

  const categories = getCategories()

  // Button to open fullscreen
  if (!isFullscreen) {
    return (
      <Button
        onClick={openFullscreen}
        variant="outline"
        style={{ borderColor: "#F59E0B", color: "#F59E0B" }}
        className="flex items-center gap-2"
      >
        <Maximize2 className="w-4 h-4" />
        View Winners Fullscreen
      </Button>
    )
  }

  // Fullscreen overlay
  return (
    <div className="fixed inset-0 z-[9999] bg-white overflow-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b shadow-sm z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold" style={{ color: "#14532D" }}>
            Category Winners {eventName && `- ${eventName}`}
          </h1>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              variant="outline"
              style={{ borderColor: "#16A34A", color: "#16A34A" }}
              className="flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Export PDF / Print
            </Button>
            <Button
              onClick={closeFullscreen}
              variant="ghost"
              size="icon"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Winners Grid */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map(({ name, title, winners: categoryWinners }) => (
            <div
              key={name}
              className="border-2 rounded-lg overflow-hidden"
              style={{ borderColor: "#F59E0B" }}
            >
              {/* Category Header */}
              <div
                className="px-4 py-3 text-white font-bold text-lg"
                style={{ backgroundColor: "#F59E0B" }}
              >
                {title}
              </div>

              {/* Winners */}
              <div className="p-4">
                {categoryWinners.length === 0 ? (
                  <p className="text-gray-500 italic">No scores yet</p>
                ) : (
                  categoryWinners.map((winner) => (
                    <div
                      key={winner.float.id}
                      className="mb-3 last:mb-0 pb-3 last:pb-0 border-b last:border-0"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-bold text-lg" style={{ color: "#14532D" }}>
                            🏅 Float #{winner.float.floatNumber}
                          </p>
                          <p className="text-sm font-medium">
                            {winner.float.organization}
                          </p>
                          {winner.float.entryName && (
                            <p className="text-xs text-gray-500 italic">
                              {winner.float.entryName}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p
                            className="text-2xl font-bold"
                            style={{ color: "#DC2626" }}
                          >
                            {winner.total}
                          </p>
                          <p className="text-xs text-gray-500">points</p>
                          {categoryWinners.length > 1 && (
                            <p className="text-xs text-amber-600 font-medium">TIE</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

