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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      automation_rules: {
        Row: {
          action_config: Json | null
          action_type: string
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json | null
          action_type: string
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_config?: Json | null
          action_type?: string
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json | null
          slug: string | null
          state: string | null
          stripe_account_id: string | null
          stripe_onboarding_complete: boolean | null
          timezone: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json | null
          slug?: string | null
          state?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json | null
          slug?: string | null
          state?: string | null
          stripe_account_id?: string | null
          stripe_onboarding_complete?: boolean | null
          timezone?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_id: string
          city: string | null
          company_name: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          lead_score: number | null
          lead_status: string | null
          notes: string | null
          phone: string | null
          preferred_contact_method: string | null
          preferred_schedule_days: string[] | null
          preferred_schedule_time: string | null
          source: string | null
          state: string | null
          tags: string[] | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_id: string
          city?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          lead_score?: number | null
          lead_status?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          preferred_schedule_days?: string[] | null
          preferred_schedule_time?: string | null
          source?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_id?: string
          city?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          lead_score?: number | null
          lead_status?: string | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          preferred_schedule_days?: string[] | null
          preferred_schedule_time?: string | null
          source?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          body: string
          business_id: string
          created_at: string
          error_message: string | null
          id: string
          related_id: string | null
          related_type: string | null
          sent_at: string | null
          status: string | null
          subject: string
          template_type: string | null
          to_email: string
          to_name: string | null
        }
        Insert: {
          body: string
          business_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: string | null
          subject: string
          template_type?: string | null
          to_email: string
          to_name?: string | null
        }
        Update: {
          body?: string
          business_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          related_id?: string | null
          related_type?: string | null
          sent_at?: string | null
          status?: string | null
          subject?: string
          template_type?: string | null
          to_email?: string
          to_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          quantity: number | null
          sort_order: number | null
          total: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          quantity?: number | null
          sort_order?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          quantity?: number | null
          sort_order?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number | null
          balance_due: number | null
          business_id: string
          created_at: string
          customer_id: string
          discount_amount: number | null
          due_date: string | null
          id: string
          internal_notes: string | null
          invoice_number: string
          job_id: string | null
          last_reminder_sent_at: string | null
          notes: string | null
          paid_at: string | null
          public_token: string | null
          quote_id: string | null
          sent_at: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total: number | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number | null
          balance_due?: number | null
          business_id: string
          created_at?: string
          customer_id: string
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          internal_notes?: string | null
          invoice_number: string
          job_id?: string | null
          last_reminder_sent_at?: string | null
          notes?: string | null
          paid_at?: string | null
          public_token?: string | null
          quote_id?: string | null
          sent_at?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number | null
          balance_due?: number | null
          business_id?: string
          created_at?: string
          customer_id?: string
          discount_amount?: number | null
          due_date?: string | null
          id?: string
          internal_notes?: string | null
          invoice_number?: string
          job_id?: string | null
          last_reminder_sent_at?: string | null
          notes?: string | null
          paid_at?: string | null
          public_token?: string | null
          quote_id?: string | null
          sent_at?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          address_line1: string | null
          address_line2: string | null
          assigned_to: string | null
          business_id: string
          city: string | null
          created_at: string
          customer_id: string
          description: string | null
          id: string
          internal_notes: string | null
          job_number: string
          notes: string | null
          priority: string | null
          quote_id: string | null
          scheduled_end: string | null
          scheduled_start: string | null
          state: string | null
          status: string | null
          title: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          address_line1?: string | null
          address_line2?: string | null
          assigned_to?: string | null
          business_id: string
          city?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          internal_notes?: string | null
          job_number: string
          notes?: string | null
          priority?: string | null
          quote_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          state?: string | null
          status?: string | null
          title: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          address_line1?: string | null
          address_line2?: string | null
          assigned_to?: string | null
          business_id?: string
          city?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          internal_notes?: string | null
          job_number?: string
          notes?: string | null
          priority?: string | null
          quote_id?: string | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          state?: string | null
          status?: string | null
          title?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_scoring_rules: {
        Row: {
          business_id: string
          condition_field: string
          condition_operator: string
          condition_value: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          score_adjustment: number
        }
        Insert: {
          business_id: string
          condition_field: string
          condition_operator: string
          condition_value?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          score_adjustment: number
        }
        Update: {
          business_id?: string
          condition_field?: string
          condition_operator?: string
          condition_value?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          score_adjustment?: number
        }
        Relationships: [
          {
            foreignKeyName: "lead_scoring_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          business_id: string
          created_at: string
          data: Json | null
          id: string
          message: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          data?: Json | null
          id?: string
          message?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          id: string
          invoice_id: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_reference: string | null
          status: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          id?: string
          invoice_id: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_onboarded: boolean | null
          job_title: string | null
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          business_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          is_onboarded?: boolean | null
          job_title?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          business_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_onboarded?: boolean | null
          job_title?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          id: string
          quantity: number | null
          quote_id: string
          sort_order: number | null
          total: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          quantity?: number | null
          quote_id: string
          sort_order?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          quantity?: number | null
          quote_id?: string
          sort_order?: number | null
          total?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          business_id: string
          created_at: string
          customer_id: string
          discount_amount: number | null
          id: string
          internal_notes: string | null
          notes: string | null
          public_token: string | null
          quote_number: string
          sent_at: string | null
          signature_url: string | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          title: string | null
          total: number | null
          updated_at: string
          valid_until: string | null
          view_count: number | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          business_id: string
          created_at?: string
          customer_id: string
          discount_amount?: number | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          public_token?: string | null
          quote_number: string
          sent_at?: string | null
          signature_url?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          title?: string | null
          total?: number | null
          updated_at?: string
          valid_until?: string | null
          view_count?: number | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string
          discount_amount?: number | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          public_token?: string | null
          quote_number?: string
          sent_at?: string | null
          signature_url?: string | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          title?: string | null
          total?: number | null
          updated_at?: string
          valid_until?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invites: {
        Row: {
          business_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          business_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          business_id: string
          clock_in: string
          clock_out: string | null
          created_at: string
          duration_minutes: number | null
          entry_type: string | null
          id: string
          job_id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          duration_minutes?: number | null
          entry_type?: string | null
          id?: string
          job_id: string
          notes?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          duration_minutes?: number | null
          entry_type?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invite: { Args: { _token: string }; Returns: Json }
      get_user_business_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      setup_business_for_user: {
        Args: {
          _email?: string
          _industry?: string
          _name: string
          _phone?: string
        }
        Returns: string
      }
      user_belongs_to_business: {
        Args: { _business_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "technician" | "viewer"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "technician", "viewer"],
    },
  },
} as const
