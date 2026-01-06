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
          default_geofence_radius_meters: number | null
          email: string | null
          geofence_allow_override: boolean | null
          geofence_enforcement_mode: string | null
          geofence_override_requires_photo: boolean | null
          geofence_override_requires_reason: boolean | null
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
          default_geofence_radius_meters?: number | null
          email?: string | null
          geofence_allow_override?: boolean | null
          geofence_enforcement_mode?: string | null
          geofence_override_requires_photo?: boolean | null
          geofence_override_requires_reason?: boolean | null
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
          default_geofence_radius_meters?: number | null
          email?: string | null
          geofence_allow_override?: boolean | null
          geofence_enforcement_mode?: string | null
          geofence_override_requires_photo?: boolean | null
          geofence_override_requires_reason?: boolean | null
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
      clock_events: {
        Row: {
          accuracy_meters: number | null
          business_id: string
          created_at: string | null
          distance_from_job_meters: number | null
          event_type: string
          geofence_radius_meters: number | null
          id: string
          job_id: string
          job_latitude: number | null
          job_longitude: number | null
          latitude: number | null
          location_source: string | null
          longitude: number | null
          override_approved_at: string | null
          override_approved_by: string | null
          override_photo_url: string | null
          override_reason: string | null
          recorded_at: string | null
          status: string
          user_id: string
          within_geofence: boolean
        }
        Insert: {
          accuracy_meters?: number | null
          business_id: string
          created_at?: string | null
          distance_from_job_meters?: number | null
          event_type: string
          geofence_radius_meters?: number | null
          id?: string
          job_id: string
          job_latitude?: number | null
          job_longitude?: number | null
          latitude?: number | null
          location_source?: string | null
          longitude?: number | null
          override_approved_at?: string | null
          override_approved_by?: string | null
          override_photo_url?: string | null
          override_reason?: string | null
          recorded_at?: string | null
          status: string
          user_id: string
          within_geofence: boolean
        }
        Update: {
          accuracy_meters?: number | null
          business_id?: string
          created_at?: string | null
          distance_from_job_meters?: number | null
          event_type?: string
          geofence_radius_meters?: number | null
          id?: string
          job_id?: string
          job_latitude?: number | null
          job_longitude?: number | null
          latitude?: number | null
          location_source?: string | null
          longitude?: number | null
          override_approved_at?: string | null
          override_approved_by?: string | null
          override_photo_url?: string | null
          override_reason?: string | null
          recorded_at?: string | null
          status?: string
          user_id?: string
          within_geofence?: boolean
        }
        Relationships: []
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          avoid_days: Json | null
          business_id: string
          city: string | null
          company_name: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          latitude: number | null
          lead_score: number | null
          lead_status: string | null
          longitude: number | null
          notes: string | null
          phone: string | null
          preferred_contact_method: string | null
          preferred_days: Json | null
          preferred_schedule_days: string[] | null
          preferred_schedule_time: string | null
          preferred_time_window: Json | null
          scheduling_notes: string | null
          source: string | null
          state: string | null
          tags: string[] | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          avoid_days?: Json | null
          business_id: string
          city?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          latitude?: number | null
          lead_score?: number | null
          lead_status?: string | null
          longitude?: number | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          preferred_days?: Json | null
          preferred_schedule_days?: string[] | null
          preferred_schedule_time?: string | null
          preferred_time_window?: Json | null
          scheduling_notes?: string | null
          source?: string | null
          state?: string | null
          tags?: string[] | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          avoid_days?: Json | null
          business_id?: string
          city?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          latitude?: number | null
          lead_score?: number | null
          lead_status?: string | null
          longitude?: number | null
          notes?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          preferred_days?: Json | null
          preferred_schedule_days?: string[] | null
          preferred_schedule_time?: string | null
          preferred_time_window?: Json | null
          scheduling_notes?: string | null
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
      daily_route_plans: {
        Row: {
          business_id: string
          created_at: string | null
          end_location: Json | null
          id: string
          job_ids: string[]
          legs: Json | null
          optimization_reasoning: string | null
          optimized_sequence: number[] | null
          overview_polyline: string | null
          route_date: string
          start_location: Json | null
          status: string
          total_distance_meters: number | null
          total_duration_seconds: number | null
          total_job_time_minutes: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          end_location?: Json | null
          id?: string
          job_ids?: string[]
          legs?: Json | null
          optimization_reasoning?: string | null
          optimized_sequence?: number[] | null
          overview_polyline?: string | null
          route_date: string
          start_location?: Json | null
          status?: string
          total_distance_meters?: number | null
          total_duration_seconds?: number | null
          total_job_time_minutes?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          end_location?: Json | null
          id?: string
          job_ids?: string[]
          legs?: Json | null
          optimization_reasoning?: string | null
          optimized_sequence?: number[] | null
          overview_polyline?: string | null
          route_date?: string
          start_location?: Json | null
          status?: string
          total_distance_meters?: number | null
          total_duration_seconds?: number | null
          total_job_time_minutes?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_route_plans_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_route_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      geocode_cache: {
        Row: {
          address: string
          cached_at: string | null
          formatted_address: string | null
          id: string
          latitude: number
          longitude: number
          place_id: string | null
        }
        Insert: {
          address: string
          cached_at?: string | null
          formatted_address?: string | null
          id?: string
          latitude: number
          longitude: number
          place_id?: string | null
        }
        Update: {
          address?: string
          cached_at?: string | null
          formatted_address?: string | null
          id?: string
          latitude?: number
          longitude?: number
          place_id?: string | null
        }
        Relationships: []
      }
      geofence_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          business_id: string
          clock_event_id: string
          created_at: string | null
          distance_meters: number
          id: string
          job_id: string
          resolution_notes: string | null
          severity: string
          status: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          business_id: string
          clock_event_id: string
          created_at?: string | null
          distance_meters: number
          id?: string
          job_id: string
          resolution_notes?: string | null
          severity?: string
          status?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          business_id?: string
          clock_event_id?: string
          created_at?: string | null
          distance_meters?: number
          id?: string
          job_id?: string
          resolution_notes?: string | null
          severity?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geofence_alerts_clock_event_id_fkey"
            columns: ["clock_event_id"]
            isOneToOne: false
            referencedRelation: "clock_events"
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
      job_assignments: {
        Row: {
          business_id: string
          created_at: string
          id: string
          job_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          job_id: string
          role?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          job_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_assignments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_modification_requests: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          job_id: string
          modification_type: string
          new_scheduled_end: string | null
          new_scheduled_start: string | null
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          requested_date: string | null
          source: string
          source_metadata: Json | null
          status: string
          time_preference: string | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          job_id: string
          modification_type: string
          new_scheduled_end?: string | null
          new_scheduled_start?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_date?: string | null
          source: string
          source_metadata?: Json | null
          status?: string
          time_preference?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          job_id?: string
          modification_type?: string
          new_scheduled_end?: string | null
          new_scheduled_start?: string | null
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_date?: string | null
          source?: string
          source_metadata?: Json | null
          status?: string
          time_preference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_modification_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_modification_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_modification_requests_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_requests: {
        Row: {
          address: Json | null
          business_id: string
          converted_to_job_id: string | null
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          form_data: Json
          id: string
          preferred_date: string | null
          preferred_time: string | null
          priority_score: number | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_type: string | null
          source: string
          source_metadata: Json | null
          status: string
          updated_at: string | null
          urgency: string | null
        }
        Insert: {
          address?: Json | null
          business_id: string
          converted_to_job_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          form_data?: Json
          id?: string
          preferred_date?: string | null
          preferred_time?: string | null
          priority_score?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_type?: string | null
          source: string
          source_metadata?: Json | null
          status?: string
          updated_at?: string | null
          urgency?: string | null
        }
        Update: {
          address?: Json | null
          business_id?: string
          converted_to_job_id?: string | null
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          form_data?: Json
          id?: string
          preferred_date?: string | null
          preferred_time?: string | null
          priority_score?: number | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_type?: string | null
          source?: string
          source_metadata?: Json | null
          status?: string
          updated_at?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_requests_converted_to_job_id_fkey"
            columns: ["converted_to_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          actual_arrival: string | null
          actual_end: string | null
          actual_start: string | null
          address_line1: string | null
          address_line2: string | null
          assigned_to: string | null
          assignment_reasoning: string | null
          auto_assigned: boolean | null
          business_id: string
          city: string | null
          clock_in_distance_meters: number | null
          clock_in_location_lat: number | null
          clock_in_location_lng: number | null
          clock_in_override: boolean | null
          clock_in_time: string | null
          clock_out_distance_meters: number | null
          clock_out_location_lat: number | null
          clock_out_location_lng: number | null
          clock_out_override: boolean | null
          clock_out_time: string | null
          created_at: string
          customer_id: string
          description: string | null
          drive_time_from_previous: number | null
          estimated_arrival: string | null
          estimated_duration_minutes: number | null
          geofence_enforcement: string | null
          geofence_expanded_radius_meters: number | null
          geofence_expanded_until: string | null
          geofence_radius_meters: number | null
          id: string
          internal_notes: string | null
          is_clocked_in: boolean | null
          job_number: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          priority: string | null
          quote_id: string | null
          route_plan_id: string | null
          route_sequence: number | null
          scheduled_end: string | null
          scheduled_start: string | null
          state: string | null
          status: string | null
          title: string
          tracking_token: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          actual_arrival?: string | null
          actual_end?: string | null
          actual_start?: string | null
          address_line1?: string | null
          address_line2?: string | null
          assigned_to?: string | null
          assignment_reasoning?: string | null
          auto_assigned?: boolean | null
          business_id: string
          city?: string | null
          clock_in_distance_meters?: number | null
          clock_in_location_lat?: number | null
          clock_in_location_lng?: number | null
          clock_in_override?: boolean | null
          clock_in_time?: string | null
          clock_out_distance_meters?: number | null
          clock_out_location_lat?: number | null
          clock_out_location_lng?: number | null
          clock_out_override?: boolean | null
          clock_out_time?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          drive_time_from_previous?: number | null
          estimated_arrival?: string | null
          estimated_duration_minutes?: number | null
          geofence_enforcement?: string | null
          geofence_expanded_radius_meters?: number | null
          geofence_expanded_until?: string | null
          geofence_radius_meters?: number | null
          id?: string
          internal_notes?: string | null
          is_clocked_in?: boolean | null
          job_number: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          priority?: string | null
          quote_id?: string | null
          route_plan_id?: string | null
          route_sequence?: number | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          state?: string | null
          status?: string | null
          title: string
          tracking_token?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          actual_arrival?: string | null
          actual_end?: string | null
          actual_start?: string | null
          address_line1?: string | null
          address_line2?: string | null
          assigned_to?: string | null
          assignment_reasoning?: string | null
          auto_assigned?: boolean | null
          business_id?: string
          city?: string | null
          clock_in_distance_meters?: number | null
          clock_in_location_lat?: number | null
          clock_in_location_lng?: number | null
          clock_in_override?: boolean | null
          clock_in_time?: string | null
          clock_out_distance_meters?: number | null
          clock_out_location_lat?: number | null
          clock_out_location_lng?: number | null
          clock_out_override?: boolean | null
          clock_out_time?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          drive_time_from_previous?: number | null
          estimated_arrival?: string | null
          estimated_duration_minutes?: number | null
          geofence_enforcement?: string | null
          geofence_expanded_radius_meters?: number | null
          geofence_expanded_until?: string | null
          geofence_radius_meters?: number | null
          id?: string
          internal_notes?: string | null
          is_clocked_in?: boolean | null
          job_number?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          priority?: string | null
          quote_id?: string | null
          route_plan_id?: string | null
          route_sequence?: number | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          state?: string | null
          status?: string | null
          title?: string
          tracking_token?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_jobs_route_plan"
            columns: ["route_plan_id"]
            isOneToOne: false
            referencedRelation: "daily_route_plans"
            referencedColumns: ["id"]
          },
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
      notification_preferences: {
        Row: {
          business_id: string | null
          created_at: string
          daily_digest: boolean | null
          email_delay_notification: boolean | null
          email_invoice_overdue: boolean | null
          email_invoice_reminder: boolean | null
          email_invoice_sent: boolean | null
          email_job_assigned: boolean | null
          email_job_status_changed: boolean | null
          email_payment_failed: boolean | null
          email_payment_received: boolean | null
          email_quote_approved: boolean | null
          email_quote_sent: boolean | null
          email_team_invite: boolean | null
          id: string
          inapp_geofence_alerts: boolean | null
          inapp_invoice_activity: boolean | null
          inapp_job_activity: boolean | null
          inapp_payment_activity: boolean | null
          inapp_quote_activity: boolean | null
          inapp_team_activity: boolean | null
          updated_at: string
          user_id: string
          weekly_summary: boolean | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          daily_digest?: boolean | null
          email_delay_notification?: boolean | null
          email_invoice_overdue?: boolean | null
          email_invoice_reminder?: boolean | null
          email_invoice_sent?: boolean | null
          email_job_assigned?: boolean | null
          email_job_status_changed?: boolean | null
          email_payment_failed?: boolean | null
          email_payment_received?: boolean | null
          email_quote_approved?: boolean | null
          email_quote_sent?: boolean | null
          email_team_invite?: boolean | null
          id?: string
          inapp_geofence_alerts?: boolean | null
          inapp_invoice_activity?: boolean | null
          inapp_job_activity?: boolean | null
          inapp_payment_activity?: boolean | null
          inapp_quote_activity?: boolean | null
          inapp_team_activity?: boolean | null
          updated_at?: string
          user_id: string
          weekly_summary?: boolean | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          daily_digest?: boolean | null
          email_delay_notification?: boolean | null
          email_invoice_overdue?: boolean | null
          email_invoice_reminder?: boolean | null
          email_invoice_sent?: boolean | null
          email_job_assigned?: boolean | null
          email_job_status_changed?: boolean | null
          email_payment_failed?: boolean | null
          email_payment_received?: boolean | null
          email_quote_approved?: boolean | null
          email_quote_sent?: boolean | null
          email_team_invite?: boolean | null
          id?: string
          inapp_geofence_alerts?: boolean | null
          inapp_invoice_activity?: boolean | null
          inapp_job_activity?: boolean | null
          inapp_payment_activity?: boolean | null
          inapp_quote_activity?: boolean | null
          inapp_team_activity?: boolean | null
          updated_at?: string
          user_id?: string
          weekly_summary?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_business_id_fkey"
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
      phone_integrations: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          business_id: string
          created_at: string | null
          created_by: string | null
          id: string
          last_used_at: string | null
          name: string | null
          permissions: Json
          request_count: number | null
          request_count_reset_at: string | null
          revoked_at: string | null
          revoked_by: string | null
          status: string
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          business_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name?: string | null
          permissions?: Json
          request_count?: number | null
          request_count_reset_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          business_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_used_at?: string | null
          name?: string | null
          permissions?: Json
          request_count?: number | null
          request_count_reset_at?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "phone_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_integrations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_integrations_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          home_address: string | null
          home_latitude: number | null
          home_longitude: number | null
          id: string
          is_onboarded: boolean | null
          job_title: string | null
          last_name: string | null
          max_daily_hours: number | null
          max_daily_jobs: number | null
          phone: string | null
          skill_tags: string[] | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          business_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          home_address?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          id: string
          is_onboarded?: boolean | null
          job_title?: string | null
          last_name?: string | null
          max_daily_hours?: number | null
          max_daily_jobs?: number | null
          phone?: string | null
          skill_tags?: string[] | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          business_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          home_address?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          id?: string
          is_onboarded?: boolean | null
          job_title?: string | null
          last_name?: string | null
          max_daily_hours?: number | null
          max_daily_jobs?: number | null
          phone?: string | null
          skill_tags?: string[] | null
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
      route_directions_cache: {
        Row: {
          cached_at: string | null
          expires_at: string | null
          id: string
          legs: Json | null
          overview_polyline: string | null
          route_hash: string
          total_distance_meters: number | null
          total_duration_seconds: number | null
          waypoints: Json
        }
        Insert: {
          cached_at?: string | null
          expires_at?: string | null
          id?: string
          legs?: Json | null
          overview_polyline?: string | null
          route_hash: string
          total_distance_meters?: number | null
          total_duration_seconds?: number | null
          waypoints: Json
        }
        Update: {
          cached_at?: string | null
          expires_at?: string | null
          id?: string
          legs?: Json | null
          overview_polyline?: string | null
          route_hash?: string
          total_distance_meters?: number | null
          total_duration_seconds?: number | null
          waypoints?: Json
        }
        Relationships: []
      }
      team_availability: {
        Row: {
          business_id: string
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean
          start_time: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string | null
          day_of_week: number
          end_time?: string
          id?: string
          is_available?: boolean
          start_time?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean
          start_time?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_availability_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_availability_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          clock_in_event_id: string | null
          clock_in_latitude: number | null
          clock_in_longitude: number | null
          clock_out: string | null
          clock_out_event_id: string | null
          clock_out_latitude: number | null
          clock_out_longitude: number | null
          created_at: string
          duration_minutes: number | null
          entry_type: string | null
          id: string
          job_id: string
          location_accuracy: number | null
          notes: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          clock_in?: string
          clock_in_event_id?: string | null
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_out?: string | null
          clock_out_event_id?: string | null
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          created_at?: string
          duration_minutes?: number | null
          entry_type?: string | null
          id?: string
          job_id: string
          location_accuracy?: number | null
          notes?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          clock_in?: string
          clock_in_event_id?: string | null
          clock_in_latitude?: number | null
          clock_in_longitude?: number | null
          clock_out?: string | null
          clock_out_event_id?: string | null
          clock_out_latitude?: number | null
          clock_out_longitude?: number | null
          created_at?: string
          duration_minutes?: number | null
          entry_type?: string | null
          id?: string
          job_id?: string
          location_accuracy?: number | null
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
            foreignKeyName: "time_entries_clock_in_event_id_fkey"
            columns: ["clock_in_event_id"]
            isOneToOne: false
            referencedRelation: "clock_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_clock_out_event_id_fkey"
            columns: ["clock_out_event_id"]
            isOneToOne: false
            referencedRelation: "clock_events"
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
      time_off_requests: {
        Row: {
          approved_by: string | null
          business_id: string
          created_at: string | null
          end_date: string
          id: string
          reason: string | null
          start_date: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_by?: string | null
          business_id: string
          created_at?: string | null
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_by?: string | null
          business_id?: string
          created_at?: string | null
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_time_cache: {
        Row: {
          cached_at: string | null
          destination_hash: string
          distance_meters: number | null
          expires_at: string | null
          id: string
          origin_hash: string
          travel_time_seconds: number
        }
        Insert: {
          cached_at?: string | null
          destination_hash: string
          distance_meters?: number | null
          expires_at?: string | null
          id?: string
          origin_hash: string
          travel_time_seconds: number
        }
        Update: {
          cached_at?: string | null
          destination_hash?: string
          distance_meters?: number | null
          expires_at?: string | null
          id?: string
          origin_hash?: string
          travel_time_seconds?: number
        }
        Relationships: []
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
      worker_locations: {
        Row: {
          accuracy_meters: number | null
          business_id: string
          created_at: string | null
          heading: number | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          speed_mps: number | null
          user_id: string
        }
        Insert: {
          accuracy_meters?: number | null
          business_id: string
          created_at?: string | null
          heading?: number | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          speed_mps?: number | null
          user_id: string
        }
        Update: {
          accuracy_meters?: number | null
          business_id?: string
          created_at?: string | null
          heading?: number | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          speed_mps?: number | null
          user_id?: string
        }
        Relationships: []
      }
      worker_statuses: {
        Row: {
          business_id: string
          clocked_in_at: string | null
          current_job_id: string | null
          current_location_lat: number | null
          current_location_lng: number | null
          current_status: string
          id: string
          last_location_at: string | null
          status_since: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_id: string
          clocked_in_at?: string | null
          current_job_id?: string | null
          current_location_lat?: number | null
          current_location_lng?: number | null
          current_status?: string
          id?: string
          last_location_at?: string | null
          status_since?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_id?: string
          clocked_in_at?: string | null
          current_job_id?: string | null
          current_location_lat?: number | null
          current_location_lng?: number | null
          current_status?: string
          id?: string
          last_location_at?: string | null
          status_since?: string
          updated_at?: string | null
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
      calculate_distance_meters: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
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
      update_worker_status: {
        Args: {
          p_accuracy_meters?: number
          p_business_id: string
          p_lat: number
          p_lng: number
          p_user_id: string
        }
        Returns: {
          business_id: string
          clocked_in_at: string | null
          current_job_id: string | null
          current_location_lat: number | null
          current_location_lng: number | null
          current_status: string
          id: string
          last_location_at: string | null
          status_since: string
          updated_at: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "worker_statuses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_belongs_to_business: {
        Args: { _business_id: string }
        Returns: boolean
      }
      validate_geofence: {
        Args: { p_job_id: string; p_worker_lat: number; p_worker_lng: number }
        Returns: Json
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
