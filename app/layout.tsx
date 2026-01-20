import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { BrandingFooter } from "@/components/BrandingFooter"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Parade Management System",
  description: "Complete parade management system for event coordination, participant registration, and float judging",
  keywords: ["parade", "judging", "management", "floats", "scoring", "events"],
  authors: [{ name: "iThrive AI" }],
  creator: "iThrive AI",
  publisher: "iThrive AI",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    title: "Parade Management System",
    description: "Complete parade management system for event coordination, participant registration, and float judging",
    siteName: "Parade Management System",
  },
  twitter: {
    card: "summary",
    title: "Parade Management System",
    description: "Complete parade management system for event coordination, participant registration, and float judging",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <BrandingFooter />
        <Toaster />
      </body>
    </html>
  )
}

