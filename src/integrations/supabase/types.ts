export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      chat_messages: {
        Row: {
          agent_run: Json | null
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          agent_run?: Json | null
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          agent_run?: Json | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          title: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_evidence: {
        Row: {
          checklist_item: string
          created_at: string
          dispute_id: string
          file_name: string
          file_path: string | null
          file_size: number
          id: string
          mime_type: string
          note: string | null
          user_id: string
        }
        Insert: {
          checklist_item: string
          created_at?: string
          dispute_id: string
          file_name: string
          file_path?: string | null
          file_size?: number
          id?: string
          mime_type: string
          note?: string | null
          user_id: string
        }
        Update: {
          checklist_item?: string
          created_at?: string
          dispute_id?: string
          file_name?: string
          file_path?: string | null
          file_size?: number
          id?: string
          mime_type?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          ai_summary: string | null
          created_at: string
          description: string | null
          id: string
          reason: string
          reference: string
          source: string
          status: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          reference: string
          source?: string
          status?: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          reference?: string
          source?: string
          status?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_alerts: {
        Row: {
          created_at: string
          explanation: string
          id: string
          indicators: Json
          risk_score: number
          severity: string
          source: string
          status: string
          title: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          explanation: string
          id?: string
          indicators?: Json
          risk_score?: number
          severity: string
          source?: string
          status?: string
          title: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          explanation?: string
          id?: string
          indicators?: Json
          risk_score?: number
          severity?: string
          source?: string
          status?: string
          title?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_alerts_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          occurred_at: string
          payload: Json | null
          paypal_event_id: string | null
          source: string
          title: string
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          paypal_event_id?: string | null
          source: string
          title: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          occurred_at?: string
          payload?: Json | null
          paypal_event_id?: string | null
          source?: string
          title?: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          ai_detail_level: string
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          notifications_enabled: boolean
          phone: string | null
          theme: string
          updated_at: string
        }
        Insert: {
          account_type?: string
          ai_detail_level?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          notifications_enabled?: boolean
          phone?: string | null
          theme?: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          ai_detail_level?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          notifications_enabled?: boolean
          phone?: string | null
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          paypal_refund_id: string | null
          paypal_status: string | null
          raw: Json | null
          reason: string | null
          request_id: string | null
          source: string
          status: string
          transaction_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          paypal_refund_id?: string | null
          paypal_status?: string | null
          raw?: Json | null
          reason?: string | null
          request_id?: string | null
          source: string
          status: string
          transaction_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paypal_refund_id?: string | null
          paypal_status?: string | null
          raw?: Json | null
          reason?: string | null
          request_id?: string | null
          source?: string
          status?: string
          transaction_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          approve_url: string | null
          capture_request_id: string | null
          category: string | null
          create_request_id: string | null
          created_at: string
          currency: string
          description: string | null
          device_status: string | null
          id: string
          location: string | null
          merchant: string
          payer_email: string | null
          payer_id: string | null
          payment_method: string | null
          paypal_capture_id: string | null
          paypal_capture_status: string | null
          paypal_order_id: string | null
          paypal_status: string | null
          raw: Json | null
          reference: string
          source: string
          status: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          approve_url?: string | null
          capture_request_id?: string | null
          category?: string | null
          create_request_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          device_status?: string | null
          id?: string
          location?: string | null
          merchant: string
          payer_email?: string | null
          payer_id?: string | null
          payment_method?: string | null
          paypal_capture_id?: string | null
          paypal_capture_status?: string | null
          paypal_order_id?: string | null
          paypal_status?: string | null
          raw?: Json | null
          reference: string
          source: string
          status: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          approve_url?: string | null
          capture_request_id?: string | null
          category?: string | null
          create_request_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          device_status?: string | null
          id?: string
          location?: string | null
          merchant?: string
          payer_email?: string | null
          payer_id?: string | null
          payment_method?: string | null
          paypal_capture_id?: string | null
          paypal_capture_status?: string | null
          paypal_order_id?: string | null
          paypal_status?: string | null
          raw?: Json | null
          reference?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_demo_data: { Args: never; Returns: undefined }
      seed_demo_data: { Args: { _uid: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
