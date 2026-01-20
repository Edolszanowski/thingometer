/**
 * Supabase Client for Realtime Subscriptions
 * 
 * This client is used for client-side realtime subscriptions.
 * It uses the Supabase JS client which connects via WebSocket.
 */

import { createClient, RealtimeChannel } from '@supabase/supabase-js'

// Get Supabase credentials from environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Create singleton client
let supabaseClient: ReturnType<typeof createClient> | null = null

export function getSupabaseClient() {
  if (!supabaseClient && supabaseUrl && supabaseAnonKey) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  }
  return supabaseClient
}

// Types for realtime events
export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export interface RealtimePayload<T = any> {
  commit_timestamp: string
  eventType: RealtimeEvent
  new: T
  old: T
  schema: string
  table: string
}

// Subscribe to table changes
export function subscribeToTable<T = any>(
  tableName: string,
  callback: (payload: RealtimePayload<T>) => void,
  event: RealtimeEvent = '*'
): RealtimeChannel | null {
  const client = getSupabaseClient()
  if (!client) {
    console.warn('Supabase client not initialized - realtime disabled')
    return null
  }

  const channel = client
    .channel(`public:${tableName}`)
    .on(
      'postgres_changes' as any,
      {
        event: event,
        schema: 'public',
        table: tableName,
      },
      (payload: any) => {
        callback(payload as RealtimePayload<T>)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Realtime: Subscribed to ${tableName}`)
      }
    })

  return channel
}

// Unsubscribe from a channel
export async function unsubscribe(channel: RealtimeChannel | null) {
  if (channel) {
    const client = getSupabaseClient()
    if (client) {
      await client.removeChannel(channel)
    }
  }
}

// Subscribe to multiple tables
export function subscribeToTables(
  tables: string[],
  callback: (tableName: string, payload: RealtimePayload) => void
): RealtimeChannel[] {
  return tables
    .map((tableName) => {
      return subscribeToTable(tableName, (payload) => {
        callback(tableName, payload)
      })
    })
    .filter((channel): channel is RealtimeChannel => channel !== null)
}

// Cleanup all channels
export async function unsubscribeAll(channels: RealtimeChannel[]) {
  await Promise.all(channels.map((channel) => unsubscribe(channel)))
}

