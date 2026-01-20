'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { RealtimeChannel } from '@supabase/supabase-js'
import { 
  subscribeToTable, 
  subscribeToTables, 
  unsubscribe, 
  unsubscribeAll,
  RealtimePayload 
} from '@/lib/supabase-client'

/**
 * Hook to subscribe to realtime changes on a single table
 */
export function useRealtimeTable<T = any>(
  tableName: string,
  onUpdate?: (payload: RealtimePayload<T>) => void
) {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const channel = subscribeToTable<T>(tableName, (payload) => {
      setLastUpdate(new Date())
      onUpdate?.(payload)
    })
    
    channelRef.current = channel

    return () => {
      unsubscribe(channelRef.current)
    }
  }, [tableName, onUpdate])

  return { lastUpdate }
}

/**
 * Hook to subscribe to multiple tables and trigger refresh
 */
export function useRealtimeRefresh(
  tables: string[],
  refreshFn: () => void,
  debounceMs: number = 500
) {
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const channelsRef = useRef<RealtimeChannel[]>([])
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      setLastUpdate(new Date())
      refreshFn()
    }, debounceMs)
  }, [refreshFn, debounceMs])

  useEffect(() => {
    const channels = subscribeToTables(tables, (tableName, payload) => {
      console.log(`Realtime update on ${tableName}:`, payload.eventType)
      debouncedRefresh()
    })
    
    channelsRef.current = channels

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      unsubscribeAll(channelsRef.current)
    }
  }, [tables.join(','), debouncedRefresh])

  return { lastUpdate }
}

/**
 * Hook for auto-refreshing data with realtime updates
 * Combines initial fetch with realtime subscription
 */
export function useRealtimeQuery<T>(
  fetchFn: () => Promise<T>,
  tables: string[],
  deps: any[] = []
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const channelsRef = useRef<RealtimeChannel[]>([])
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const refresh = useCallback(async () => {
    try {
      const result = await fetchFn()
      setData(result)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      setLoading(false)
    }
  }, [fetchFn])

  const debouncedRefresh = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      refresh()
    }, 300)
  }, [refresh])

  // Initial fetch
  useEffect(() => {
    refresh()
  }, [...deps, refresh])

  // Realtime subscription
  useEffect(() => {
    const channels = subscribeToTables(tables, (tableName, payload) => {
      console.log(`Realtime: ${tableName} ${payload.eventType}`)
      debouncedRefresh()
    })
    
    channelsRef.current = channels

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      unsubscribeAll(channelsRef.current)
    }
  }, [tables.join(','), debouncedRefresh])

  return { data, loading, error, lastUpdate, refresh }
}

/**
 * Simple hook that just triggers a callback on any table changes
 * Use this with existing fetch logic
 */
export function useRealtimeCallback(
  tables: string[],
  callback: () => void,
  enabled: boolean = true
) {
  const channelsRef = useRef<RealtimeChannel[]>([])
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!enabled) return

    const debouncedCallback = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      debounceRef.current = setTimeout(callback, 300)
    }

    const channels = subscribeToTables(tables, () => {
      debouncedCallback()
    })
    
    channelsRef.current = channels

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      unsubscribeAll(channelsRef.current)
    }
  }, [tables.join(','), callback, enabled])
}

