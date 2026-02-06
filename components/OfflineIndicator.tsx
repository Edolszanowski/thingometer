"use client"

import { useEffect, useState } from 'react'
import { offlineQueue } from '@/lib/offline-queue'
import { WifiOff, CloudOff, CheckCircle2, RefreshCw } from 'lucide-react'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [showSyncSuccess, setShowSyncSuccess] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    // Initialize state
    setIsOnline(offlineQueue.getIsOnline())
    setPendingCount(offlineQueue.getPendingCount())

    // Subscribe to queue changes
    const unsubscribe = offlineQueue.subscribe(() => {
      const newIsOnline = offlineQueue.getIsOnline()
      const newPendingCount = offlineQueue.getPendingCount()
      
      // Detect successful sync completion
      if (pendingCount > 0 && newPendingCount === 0 && newIsOnline) {
        setShowSyncSuccess(true)
        setTimeout(() => setShowSyncSuccess(false), 3000)
      }
      
      setIsOnline(newIsOnline)
      setPendingCount(newPendingCount)
    })

    // Listen for scoreSaved events to update syncing state
    const handleScoreSaved = () => {
      setIsSyncing(false)
    }
    window.addEventListener('scoreSaved', handleScoreSaved)

    // Detect when syncing starts (when pending count increases while online)
    const prevPendingCount = pendingCount
    if (isOnline && pendingCount > prevPendingCount) {
      setIsSyncing(true)
    }

    return () => {
      unsubscribe()
      window.removeEventListener('scoreSaved', handleScoreSaved)
    }
  }, [pendingCount, isOnline])

  // Don't show anything if online and no pending scores
  if (isOnline && pendingCount === 0 && !showSyncSuccess) {
    return null
  }

  // Show success flash
  if (showSyncSuccess) {
    return (
      <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border-2 border-green-600">
          <CheckCircle2 className="h-5 w-5 animate-pulse" />
          <div>
            <p className="font-semibold">All synced!</p>
            <p className="text-xs text-green-100">Scores saved to server</p>
          </div>
        </div>
      </div>
    )
  }

  // Show offline badge
  if (!isOnline) {
    return (
      <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border-2 border-red-600">
          <WifiOff className="h-5 w-5 animate-pulse" />
          <div>
            <p className="font-semibold">Offline</p>
            <p className="text-xs text-red-100">
              {pendingCount > 0 
                ? `${pendingCount} score${pendingCount === 1 ? '' : 's'} saved locally`
                : 'Scores will be saved locally'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show pending sync badge (online but has queued scores)
  return (
    <div className="fixed top-4 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="bg-yellow-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 border-2 border-yellow-600">
        {isSyncing ? (
          <RefreshCw className="h-5 w-5 animate-spin" />
        ) : (
          <CloudOff className="h-5 w-5" />
        )}
        <div>
          <p className="font-semibold">
            {isSyncing ? 'Syncing...' : 'Pending sync'}
          </p>
          <p className="text-xs text-yellow-100">
            {pendingCount} score{pendingCount === 1 ? '' : 's'} waiting to upload
          </p>
        </div>
      </div>
    </div>
  )
}
