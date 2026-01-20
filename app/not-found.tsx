import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold" style={{ color: "#DC2626" }}>
          404
        </h1>
        <h2 className="text-2xl font-semibold" style={{ color: "#14532D" }}>
          Page Not Found
        </h2>
        <p className="text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Link href="/">
          <Button className="bg-[#DC2626] hover:bg-[#DC2626]/90 text-white">
            Go Home
          </Button>
        </Link>
      </div>
    </div>
  )
}

