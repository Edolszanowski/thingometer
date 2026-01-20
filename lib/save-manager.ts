/**
 * Global Save Manager
 * 
 * Tracks pending saves across components and provides API to check and wait for saves.
 * This ensures navigation blocks until saves complete, preventing data loss.
 */

interface PendingSave {
  floatId: number
  promise: Promise<void>
  timestamp: number
}

class SaveManager {
  private pendingSaves: Map<number, PendingSave> = new Map()
  private readonly SAVE_TIMEOUT = 5000 // 5 seconds max wait

  /**
   * Register a pending save
   */
  registerSave(floatId: number, promise: Promise<void>): void {
    console.log(`[SaveManager] Registering save for float ${floatId}`)
    this.pendingSaves.set(floatId, {
      floatId,
      promise,
      timestamp: Date.now(),
    })
  }

  /**
   * Unregister a completed save
   */
  unregisterSave(floatId: number): void {
    console.log(`[SaveManager] Unregistering save for float ${floatId}`)
    this.pendingSaves.delete(floatId)
  }

  /**
   * Check if there are any pending saves
   */
  hasPendingSaves(): boolean {
    return this.pendingSaves.size > 0
  }

  /**
   * Check if a specific float has a pending save
   */
  hasPendingSave(floatId: number): boolean {
    return this.pendingSaves.has(floatId)
  }

  /**
   * Wait for all pending saves to complete (with timeout)
   */
  async waitForAllSaves(timeoutMs: number = 5000): Promise<void> {
    if (this.pendingSaves.size === 0) {
      return
    }

    console.log(`[SaveManager] Waiting for ${this.pendingSaves.size} pending save(s)...`)
    
    const promises = Array.from(this.pendingSaves.values()).map(save => save.promise)
    
    try {
      await Promise.race([
        Promise.all(promises),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Save timeout')), timeoutMs)
        ),
      ])
      console.log(`[SaveManager] All saves completed`)
    } catch (error) {
      console.error(`[SaveManager] Error waiting for saves:`, error)
      throw error // Re-throw so navigation can handle it
    }
  }

  /**
   * Wait for a specific float's save to complete (with timeout)
   */
  async waitForSave(floatId: number): Promise<void> {
    const save = this.pendingSaves.get(floatId)
    if (!save) {
      return
    }

    console.log(`[SaveManager] Waiting for save of float ${floatId}...`)
    
    try {
      await Promise.race([
        save.promise,
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Save timeout')), this.SAVE_TIMEOUT)
        ),
      ])
      console.log(`[SaveManager] Save for float ${floatId} completed`)
    } catch (error) {
      console.error(`[SaveManager] Error waiting for save of float ${floatId}:`, error)
      // Don't throw - allow navigation even if save times out
    }
  }

  /**
   * Get all pending float IDs
   */
  getPendingFloatIds(): number[] {
    return Array.from(this.pendingSaves.keys())
  }

  /**
   * Clear all pending saves (use with caution)
   */
  clear(): void {
    console.log(`[SaveManager] Clearing all pending saves`)
    this.pendingSaves.clear()
  }
}

// Singleton instance
export const saveManager = new SaveManager()

