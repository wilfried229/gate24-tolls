import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      gopass_cards: {
        Row: {
          id: string
          card_number: string
          rfid_code: string
          holder_name: string
          category: string
          subscription_type: 'unlimited' | 'credits'
          balance: number
          is_active: boolean
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          card_number: string
          rfid_code: string
          holder_name: string
          category: string
          subscription_type: 'unlimited' | 'credits'
          balance: number
          is_active: boolean
          expires_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          card_number?: string
          rfid_code?: string
          holder_name?: string
          category?: string
          subscription_type?: 'unlimited' | 'credits'
          balance?: number
          is_active?: boolean
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      gopass_transactions: {
        Row: {
          id: string
          card_id: string
          transaction_type: 'entry' | 'exit'
          amount: number
          created_at: string
          barrier_id?: string
        }
        Insert: {
          id?: string
          card_id: string
          transaction_type: 'entry' | 'exit'
          amount?: number
          created_at?: string
          barrier_id?: string
        }
        Update: {
          id?: string
          card_id?: string
          transaction_type?: 'entry' | 'exit'
          amount?: number
          created_at?: string
          barrier_id?: string
        }
      }
      activity_logs: {
        Row: {
          id: string
          action: string
          details: string
          card_number?: string
          holder_name?: string
          success: boolean
          created_at: string
        }
        Insert: {
          id?: string
          action: string
          details: string
          card_number?: string
          holder_name?: string
          success: boolean
          created_at?: string
        }
        Update: {
          id?: string
          action?: string
          details?: string
          card_number?: string
          holder_name?: string
          success?: boolean
          created_at?: string
        }
      }
    }
  }
}

export type Card = Database['public']['Tables']['gopass_cards']['Row']
export type Transaction = Database['public']['Tables']['gopass_transactions']['Row']
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row']
