// Simple token generation for judge QR codes
// Uses a combination of judge ID and a secret to create verifiable tokens

const TOKEN_SECRET = process.env.JUDGE_TOKEN_SECRET || 'parade-judge-2025-secret'

// Create a simple hash for verification
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  // Convert to base36 and pad to ensure consistent length
  return Math.abs(hash).toString(36).padStart(7, '0')
}

// Generate a token for a judge
export function generateJudgeToken(judgeId: number, eventId?: number): string {
  const payload = `${judgeId}-${eventId || 0}-${TOKEN_SECRET}`
  const hash = simpleHash(payload)
  // Token format: judgeId_eventId_hash (base64 encoded for URL safety)
  const tokenData = `${judgeId}.${eventId || 0}.${hash}`
  return Buffer.from(tokenData).toString('base64url')
}

// Verify and decode a token
export function verifyJudgeToken(token: string): { valid: boolean; judgeId?: number; eventId?: number } {
  try {
    const decoded = Buffer.from(token, 'base64url').toString()
    const parts = decoded.split('.')
    
    if (parts.length !== 3) {
      return { valid: false }
    }
    
    const judgeId = parseInt(parts[0], 10)
    const eventId = parseInt(parts[1], 10)
    const providedHash = parts[2]
    
    if (isNaN(judgeId)) {
      return { valid: false }
    }
    
    // Verify the hash
    const expectedHash = simpleHash(`${judgeId}-${eventId}-${TOKEN_SECRET}`)
    
    if (providedHash !== expectedHash) {
      return { valid: false }
    }
    
    return { 
      valid: true, 
      judgeId, 
      eventId: eventId > 0 ? eventId : undefined 
    }
  } catch {
    return { valid: false }
  }
}

