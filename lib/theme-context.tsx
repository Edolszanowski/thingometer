"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

interface ThemeColors {
  primary: string
  secondary: string
  accent: string
  background: string
  foreground: string
}

export interface BrandingConfig {
  cityLogo?: string
  eventLogo?: string
  favicon?: string
  colors: ThemeColors
  contrastMode: "auto" | "high" | "maximum"
  customCss?: string
}

interface ThemeContextType {
  branding: BrandingConfig | null
  setBranding: (config: BrandingConfig) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Default theme colors (Christmas Parade theme)
export const defaultColors: ThemeColors = {
  primary: "#DC2626",
  secondary: "#16A34A",
  accent: "#F59E0B",
  background: "#FFFFFF",
  foreground: "#14532D",
}

export function ThemeProvider({
  children,
  initialBranding,
}: {
  children: ReactNode
  initialBranding?: BrandingConfig | null
}) {
  const [branding, setBranding] = useState<BrandingConfig | null>(initialBranding || null)

  useEffect(() => {
    if (branding) {
      applyTheme(branding)
    }
  }, [branding])

  return (
    <ThemeContext.Provider value={{ branding, setBranding }}>
      {children}
    </ThemeContext.Provider>
  )
}

function applyTheme(config: BrandingConfig) {
  const root = document.documentElement

  // Apply colors as CSS variables
  root.style.setProperty("--theme-primary", config.colors.primary)
  root.style.setProperty("--theme-secondary", config.colors.secondary)
  root.style.setProperty("--theme-accent", config.colors.accent)
  root.style.setProperty("--theme-background", config.colors.background)
  root.style.setProperty("--theme-foreground", config.colors.foreground)

  // Remove existing contrast mode classes
  root.classList.remove("contrast-high", "contrast-maximum")

  // Apply contrast mode
  if (config.contrastMode === "high" || config.contrastMode === "maximum") {
    root.classList.add(`contrast-${config.contrastMode}`)
  }

  // Apply custom CSS if provided
  if (config.customCss) {
    const styleId = "custom-theme-css"
    let styleEl = document.getElementById(styleId) as HTMLStyleElement
    if (!styleEl) {
      styleEl = document.createElement("style")
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = config.customCss
  }

  // Update favicon
  if (config.favicon) {
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement
    if (link) link.href = config.favicon
  }
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}

// Helper to convert hex to HSL for shadcn/ui compatibility
export function hexToHsl(hex: string): string {
  // Remove the # if present
  hex = hex.replace(/^#/, "")

  // Parse hex values
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}
