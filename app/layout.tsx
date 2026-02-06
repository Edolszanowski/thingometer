import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { BrandingFooter } from "@/components/BrandingFooter"
import { ThemeProvider } from "@/lib/theme-context"
import { cookies } from "next/headers"
import { loadThemeForEvent } from "@/app/actions"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Thingometer",
  description: "Thingometer",
  keywords: ["thingometer"],
  authors: [{ name: "iThrive AI" }],
  creator: "iThrive AI",
  publisher: "iThrive AI",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: "Thingometer",
    description: "Thingometer",
    siteName: "Thingometer",
  },
  twitter: {
    card: "summary",
    title: "Thingometer",
    description: "Thingometer",
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Load theme based on current event
  const cookieStore = await cookies()
  const eventIdStr = cookieStore.get("parade-event-id")?.value
  const eventId = eventIdStr ? parseInt(eventIdStr, 10) : null
  
  // Load branding configuration for the event
  const initialBranding = eventId ? await loadThemeForEvent(eventId) : null

  return (
    <html lang="en">
      <body className={inter.className}>
        <ThemeProvider initialBranding={initialBranding}>
          {children}
          <BrandingFooter />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

