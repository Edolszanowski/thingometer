/**
 * Offline Queue Manager
 * 
 * Manages localStorage-based queue for scores when network is unavailable.
 * Ensures zero data loss by only removing scores after server confirms receipt.
 * 
 * Key features:
 * - Multiple sync triggers (online event, page load, visibility change, periodic)
 * - Mutex locking to prevent concurrent syncs
 * - Exponential backoff for retries
 * - Merge duplicate floatId entries (keep latest)
 */

export interface QueuedScore {
  floatId: number
  eventId: number
  judgeId: number
  scores: Record<string, number | null>
  timestamp: number
  retryCount: number
}

type QueueListener = () => void

class OfflineQueue {
  private readonly STORAGE_KEY = 'thingometer_offline_scores'
  private readonly MAX_RETRIES = 10
  private readonly BASE_BACKOFF_MS = 1000 // 1 second
  private readonly MAX_BACKOFF_MS = 30000 // 30 seconds
  
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true
  private isSyncing: boolean = false
  private listeners: Set<QueueListener> = new Set()
  private periodicSyncInterval: NodeJS.Timeout | null = null
  private lastOnlineEventTime: number = 0
  private readonly ONLINE_EVENT_DEBOUNCE_MS = 2000 // Debounce rapid online/offline events

  constructor() {
    // Only run in browser environment
    if (typeof window === 'undefined') return

    // Clean any invalid scores from previous sessions
    this.cleanInvalidScores()

    // Listen to browser online/offline events
    window.addEventListener('online', this.handleOnlineEvent)
    window.addEventListener('offline', this.handleOfflineEvent)
    
    // Sync on visibility change (catches mobile browser backgrounding)
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
    
    // Periodic sync every 30 seconds while online
    this.periodicSyncInterval = setInterval(() => {
      if (this.isOnline && this.getPendingCount() > 0) {
        console.log('[OfflineQueue] Periodic sync triggered')
        this.syncAll()
      }
    }, 30000)
    
    // Initial sync on load (if online and has pending)
    if (this.isOnline && this.getPendingCount() > 0) {
      console.log('[OfflineQueue] Initial sync on page load')
      // Small delay to let the app initialize
      setTimeout(() => this.syncAll(), 1000)
    }
  }

  /**
   * Handle online event with debouncing
   */
  private handleOnlineEvent = () => {
    const now = Date.now()
    
    // Debounce rapid online/offline events (flaky connection)
    if (now - this.lastOnlineEventTime < this.ONLINE_EVENT_DEBOUNCE_MS) {
      console.log('[OfflineQueue] Debouncing online event (too soon)')
      return
    }
    
    this.lastOnlineEventTime = now
    this.isOnline = true
    console.log('[OfflineQueue] Browser online event - triggering sync')
    this.notifyListeners()
    
    // Verify connectivity before syncing
    this.verifyConnectivity().then(isReallyOnline => {
      if (isReallyOnline) {
        this.syncAll()
      } else {
        console.log('[OfflineQueue] Connectivity verification failed, not syncing')
        this.isOnline = false
        this.notifyListeners()
      }
    })
  }

  /**
   * Handle offline event
   */
  private handleOfflineEvent = () => {
    this.isOnline = false
    console.log('[OfflineQueue] Browser offline event')
    this.notifyListeners()
  }

  /**
   * Handle visibility change (mobile browser backgrounding)
   */
  private handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && this.isOnline && this.getPendingCount() > 0) {
      console.log('[OfflineQueue] Tab became visible - triggering sync')
      this.syncAll()
    }
  }

  /**
   * Verify connectivity by making a lightweight request
   */
  private async verifyConnectivity(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      
      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
      })
      
      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      console.error('[OfflineQueue] Connectivity verification failed:', error)
      return false
    }
  }

  /**
   * Get the current queue from localStorage
   */
  private getQueue(): QueuedScore[] {
    if (typeof window === 'undefined') return []
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []
      
      const queue = JSON.parse(stored) as QueuedScore[]
      return Array.isArray(queue) ? queue : []
    } catch (error) {
      console.error('[OfflineQueue] Error reading queue:', error)
      return []
    }
  }

  /**
   * Save the queue to localStorage
   */
  private saveQueue(queue: QueuedScore[]): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queue))
      this.notifyListeners()
    } catch (error) {
      console.error('[OfflineQueue] Error saving queue:', error)
    }
  }

  /**
   * Add a score to the queue (merges if floatId already exists)
   */
  addToQueue(score: QueuedScore): void {
    const queue = this.getQueue()
    
    // Check if this floatId is already queued
    const existingIndex = queue.findIndex(item => item.floatId === score.floatId)
    
    if (existingIndex >= 0) {
      // Merge: keep the latest scores and timestamp
      console.log(`[OfflineQueue] Merging score for float ${score.floatId}`)
      queue[existingIndex] = {
        ...queue[existingIndex],
        scores: { ...score.scores },
        timestamp: score.timestamp,
        retryCount: 0, // Reset retry count for updated score
      }
    } else {
      // Add new entry
      console.log(`[OfflineQueue] Adding score for float ${score.floatId} to queue`)
      queue.push(score)
    }
    
    this.saveQueue(queue)
  }

  /**
   * Remove a score from the queue (only after confirmed save)
   */
  removeFromQueue(floatId: number): void {
    const queue = this.getQueue()
    const filtered = queue.filter(item => item.floatId !== floatId)
    
    if (filtered.length < queue.length) {
      console.log(`[OfflineQueue] Removed float ${floatId} from queue after successful sync`)
      this.saveQueue(filtered)
    }
  }

  /**
   * Sync a single score to the server
   * Returns true if successful, false if failed
   */
  private async syncOne(item: QueuedScore): Promise<boolean> {
    try {
      console.log(`[OfflineQueue] Syncing float ${item.floatId} (attempt ${item.retryCount + 1})`)
      
      const response = await fetch('/api/scores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          floatId: item.floatId,
          scores: item.scores,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(error.error || `HTTP ${response.status}`)
      }

      await response.json()
      
      // CRITICAL: Only remove from queue AFTER confirmed success
      this.removeFromQueue(item.floatId)
      
      // Dispatch scoreSaved event to update UI
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('scoreSaved', { 
          detail: { floatId: item.floatId } 
        }))
      }
      
      console.log(`[OfflineQueue] Successfully synced float ${item.floatId}`)
      return true
      
    } catch (error) {
      console.error(`[OfflineQueue] Sync failed for float ${item.floatId}:`, error)
      return false
    }
  }

  /**
   * Calculate exponential backoff delay
   */
  private getBackoffDelay(retryCount: number): number {
    const delay = Math.min(
      this.BASE_BACKOFF_MS * Math.pow(2, retryCount),
      this.MAX_BACKOFF_MS
    )
    return delay
  }

  /**
   * Sync all pending scores
   */
  async syncAll(): Promise<void> {
    // Prevent concurrent sync attempts
    if (this.isSyncing) {
      console.log('[OfflineQueue] Sync already in progress, skipping')
      return
    }

    const queue = this.getQueue()
    if (queue.length === 0) {
      return
    }

    if (!this.isOnline) {
      console.log('[OfflineQueue] Cannot sync while offline')
      return
    }

    this.isSyncing = true
    console.log(`[OfflineQueue] Starting sync of ${queue.length} score(s)`)
    
    try {
      // Sort by timestamp (oldest first)
      const sortedQueue = [...queue].sort((a, b) => a.timestamp - b.timestamp)
      
      for (const item of sortedQueue) {
        // Check if we've exceeded max retries
        if (item.retryCount >= this.MAX_RETRIES) {
          console.error(`[OfflineQueue] Float ${item.floatId} exceeded max retries, needs manual review`)
          // Keep in queue but mark as needing review
          continue
        }

        // Try to sync
        const success = await this.syncOne(item)
        
        if (!success) {
          // Update retry count and backoff
          const updatedQueue = this.getQueue()
          const itemIndex = updatedQueue.findIndex(q => q.floatId === item.floatId)
          
          if (itemIndex >= 0) {
            updatedQueue[itemIndex].retryCount++
            this.saveQueue(updatedQueue)
            
            // Wait with exponential backoff before next attempt
            const backoffDelay = this.getBackoffDelay(updatedQueue[itemIndex].retryCount)
            console.log(`[OfflineQueue] Waiting ${backoffDelay}ms before next attempt`)
            await new Promise(resolve => setTimeout(resolve, backoffDelay))
          }
        }
        
        // Small delay between syncs to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 200))
      }
      
      const remainingCount = this.getPendingCount()
      if (remainingCount === 0) {
        console.log('[OfflineQueue] All scores synced successfully!')
      } else {
        console.log(`[OfflineQueue] Sync complete, ${remainingCount} score(s) still pending`)
      }
      
    } finally {
      this.isSyncing = false
      this.notifyListeners()
    }
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(listener: QueueListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Notify all listeners of queue changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener()
      } catch (error) {
        console.error('[OfflineQueue] Error in listener:', error)
      }
    })
  }

  /**
   * Get current online status
   */
  getIsOnline(): boolean {
    return this.isOnline
  }

  /**
   * Get count of pending scores
   */
  getPendingCount(): number {
    return this.getQueue().length
  }

  /**
   * Get all pending scores (for debugging)
   */
  getPendingScores(): QueuedScore[] {
    return this.getQueue()
  }

  /**
   * Clear all pending scores (use with caution!)
   */
  clearQueue(): void {
    console.warn('[OfflineQueue] Clearing all pending scores')
    this.saveQueue([])
  }

  /**
   * Clear all queued scores (useful for clearing invalid/corrupted data)
   */
  clearQueue(): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(this.STORAGE_KEY)
      console.log('[OfflineQueue] Queue cleared')
      this.notifyListeners()
    } catch (error) {
      console.error('[OfflineQueue] Failed to clear queue:', error)
    }
  }

  /**
   * Remove invalid scores from queue (scores with 0 values for categories that don't allow None)
   */
  cleanInvalidScores(): void {
    if (typeof window === 'undefined') return
    
    try {
      const queue = this.loadQueue()
      const validQueue = queue.filter(item => {
        // Check if any score value is 0 (which might be invalid)
        const hasZeroScores = Object.values(item.scores).some(v => v === 0)
        if (hasZeroScores) {
          console.log(`[OfflineQueue] Removing invalid score for float ${item.floatId} (contains 0 values)`)
          return false
        }
        return true
      })
      
      if (validQueue.length !== queue.length) {
        this.saveQueue(validQueue)
        console.log(`[OfflineQueue] Cleaned ${queue.length - validQueue.length} invalid scores`)
        this.notifyListeners()
      }
    } catch (error) {
      console.error('[OfflineQueue] Failed to clean invalid scores:', error)
    }
  }

  /**
   * Cleanup (call on app unmount if needed)
   */
  destroy(): void {
    if (typeof window === 'undefined') return
    
    window.removeEventListener('online', this.handleOnlineEvent)
    window.removeEventListener('offline', this.handleOfflineEvent)
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
    
    if (this.periodicSyncInterval) {
      clearInterval(this.periodicSyncInterval)
      this.periodicSyncInterval = null
    }
    
    this.listeners.clear()
  }
}

// Singleton instance
export const offlineQueue = new OfflineQueue()
