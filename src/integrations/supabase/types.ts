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
      annotation_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          annotation_id: string | null
          business_id: string
          changes: Json | null
          comparison_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          annotation_id?: string | null
          business_id: string
          changes?: Json | null
          comparison_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          annotation_id?: string | null
          business_id?: string
          changes?: Json | null
          comparison_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotation_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotation_audit_log_annotation_id_fkey"
            columns: ["annotation_id"]
            isOneToOne: false
            referencedRelation: "media_annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotation_audit_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotation_audit_log_comparison_id_fkey"
            columns: ["comparison_id"]
            isOneToOne: false
            referencedRelation: "before_after_comparisons"
            referencedColumns: ["id"]
          },
        ]
      }
      annotation_locks: {
        Row: {
          expires_at: string
          job_media_id: string
          locked_at: string
          locked_by: string
          locked_by_name: string
        }
        Insert: {
          expires_at: string
          job_media_id: string
          locked_at?: string
          locked_by: string
          locked_by_name: string
        }
        Update: {
          expires_at?: string
          job_media_id?: string
          locked_at?: string
          locked_by?: string
          locked_by_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotation_locks_job_media_id_fkey"
            columns: ["job_media_id"]
            isOneToOne: true
            referencedRelation: "job_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotation_locks_job_media_id_fkey"
            columns: ["job_media_id"]
            isOneToOne: true
            referencedRelation: "media_search_index"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "annotation_locks_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audience_segments: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          description: string | null
          estimated_count: number | null
          filter_config: Json
          id: string
          is_dynamic: boolean | null
          last_calculated_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_count?: number | null
          filter_config?: Json
          id?: string
          is_dynamic?: boolean | null
          last_calculated_at?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_count?: number | null
          filter_config?: Json
          id?: string
          is_dynamic?: boolean | null
          last_calculated_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audience_segments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
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
      before_after_comparisons: {
        Row: {
          after_crop: Json | null
          after_media_id: string
          before_crop: Json | null
          before_media_id: string
          business_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          description: string | null
          display_mode: string
          id: string
          is_public: boolean
          job_id: string
          share_expires_at: string | null
          share_token: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          after_crop?: Json | null
          after_media_id: string
          before_crop?: Json | null
          before_media_id: string
          business_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          display_mode?: string
          id?: string
          is_public?: boolean
          job_id: string
          share_expires_at?: string | null
          share_token?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          after_crop?: Json | null
          after_media_id?: string
          before_crop?: Json | null
          before_media_id?: string
          business_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          description?: string | null
          display_mode?: string
          id?: string
          is_public?: boolean
          job_id?: string
          share_expires_at?: string | null
          share_token?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "before_after_comparisons_after_media_id_fkey"
            columns: ["after_media_id"]
            isOneToOne: false
            referencedRelation: "job_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "before_after_comparisons_after_media_id_fkey"
            columns: ["after_media_id"]
            isOneToOne: false
            referencedRelation: "media_search_index"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "before_after_comparisons_before_media_id_fkey"
            columns: ["before_media_id"]
            isOneToOne: false
            referencedRelation: "job_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "before_after_comparisons_before_media_id_fkey"
            columns: ["before_media_id"]
            isOneToOne: false
            referencedRelation: "media_search_index"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "before_after_comparisons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "before_after_comparisons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "before_after_comparisons_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "before_after_comparisons_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      break_rules: {
        Row: {
          business_id: string
          created_at: string
          deduction_minutes: number
          id: string
          is_active: boolean | null
          is_automatic: boolean | null
          is_paid: boolean | null
          name: string
          trigger_hours: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          deduction_minutes: number
          id?: string
          is_active?: boolean | null
          is_automatic?: boolean | null
          is_paid?: boolean | null
          name: string
          trigger_hours: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          deduction_minutes?: number
          id?: string
          is_active?: boolean | null
          is_automatic?: boolean | null
          is_paid?: boolean | null
          name?: string
          trigger_hours?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "break_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_membership_audit: {
        Row: {
          action: string
          business_id: string
          created_at: string
          id: string
          membership_id: string
          metadata: Json | null
          new_role: Database["public"]["Enums"]["app_role"] | null
          old_role: Database["public"]["Enums"]["app_role"] | null
          performed_by: string | null
          reason: string | null
          user_id: string
        }
        Insert: {
          action: string
          business_id: string
          created_at?: string
          id?: string
          membership_id: string
          metadata?: Json | null
          new_role?: Database["public"]["Enums"]["app_role"] | null
          old_role?: Database["public"]["Enums"]["app_role"] | null
          performed_by?: string | null
          reason?: string | null
          user_id: string
        }
        Update: {
          action?: string
          business_id?: string
          created_at?: string
          id?: string
          membership_id?: string
          metadata?: Json | null
          new_role?: Database["public"]["Enums"]["app_role"] | null
          old_role?: Database["public"]["Enums"]["app_role"] | null
          performed_by?: string | null
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_membership_audit_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_memberships: {
        Row: {
          business_id: string
          created_at: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_primary: boolean
          joined_at: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_primary?: boolean
          joined_at?: string
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_primary?: boolean
          joined_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_memberships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          visitor_hash_salt: string | null
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
          visitor_hash_salt?: string | null
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
          visitor_hash_salt?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          body_html: string
          body_text: string | null
          bounced_count: number | null
          business_id: string
          clicked_count: number | null
          complained_count: number | null
          created_at: string
          created_by: string | null
          delivered_count: number | null
          id: string
          name: string
          opened_count: number | null
          scheduled_at: string | null
          segment_id: string | null
          sent_at: string | null
          sent_count: number | null
          status: string
          subject: string
          template_id: string | null
          total_recipients: number | null
          unsubscribed_count: number | null
          updated_at: string
        }
        Insert: {
          body_html: string
          body_text?: string | null
          bounced_count?: number | null
          business_id: string
          clicked_count?: number | null
          complained_count?: number | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          id?: string
          name: string
          opened_count?: number | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject: string
          template_id?: string | null
          total_recipients?: number | null
          unsubscribed_count?: number | null
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string | null
          bounced_count?: number | null
          business_id?: string
          clicked_count?: number | null
          complained_count?: number | null
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          id?: string
          name?: string
          opened_count?: number | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string
          template_id?: string | null
          total_recipients?: number | null
          unsubscribed_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_campaigns_segment"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "audience_segments"
            referencedColumns: ["id"]
          },
        ]
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
      customer_account_links: {
        Row: {
          business_id: string
          created_at: string
          customer_account_id: string
          customer_id: string
          id: string
          is_primary: boolean
          linked_at: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_account_id: string
          customer_id: string
          id?: string
          is_primary?: boolean
          linked_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_account_id?: string
          customer_id?: string
          id?: string
          is_primary?: boolean
          linked_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_account_links_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_links_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_accounts: {
        Row: {
          auth_method: string
          created_at: string
          email: string
          email_verified: boolean
          email_verified_at: string | null
          failed_login_attempts: number
          id: string
          last_login_at: string | null
          locked_until: string | null
          login_count: number
          password_hash: string | null
          updated_at: string
        }
        Insert: {
          auth_method?: string
          created_at?: string
          email: string
          email_verified?: boolean
          email_verified_at?: string | null
          failed_login_attempts?: number
          id?: string
          last_login_at?: string | null
          locked_until?: string | null
          login_count?: number
          password_hash?: string | null
          updated_at?: string
        }
        Update: {
          auth_method?: string
          created_at?: string
          email?: string
          email_verified?: boolean
          email_verified_at?: string | null
          failed_login_attempts?: number
          id?: string
          last_login_at?: string | null
          locked_until?: string | null
          login_count?: number
          password_hash?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_feedback: {
        Row: {
          business_id: string
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          is_public: boolean
          job_id: string | null
          quality_rating: number | null
          rating: number
          technician_rating: number | null
          timeliness_rating: number | null
        }
        Insert: {
          business_id: string
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_public?: boolean
          job_id?: string | null
          quality_rating?: number | null
          rating: number
          technician_rating?: number | null
          timeliness_rating?: number | null
        }
        Update: {
          business_id?: string
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_public?: boolean
          job_id?: string | null
          quality_rating?: number | null
          rating?: number
          technician_rating?: number | null
          timeliness_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_feedback_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_feedback_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_feedback_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_media_uploads: {
        Row: {
          business_id: string
          converted_at: string | null
          converted_to_job_media_id: string | null
          created_at: string
          customer_account_id: string | null
          customer_id: string | null
          file_size_bytes: number
          id: string
          job_request_id: string | null
          mime_type: string
          original_filename: string
          rejection_reason: string | null
          scan_completed_at: string | null
          scan_result: Json | null
          scan_status: string
          storage_bucket: string
          storage_path: string
          updated_at: string
        }
        Insert: {
          business_id: string
          converted_at?: string | null
          converted_to_job_media_id?: string | null
          created_at?: string
          customer_account_id?: string | null
          customer_id?: string | null
          file_size_bytes: number
          id?: string
          job_request_id?: string | null
          mime_type: string
          original_filename: string
          rejection_reason?: string | null
          scan_completed_at?: string | null
          scan_result?: Json | null
          scan_status?: string
          storage_bucket?: string
          storage_path: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          converted_at?: string | null
          converted_to_job_media_id?: string | null
          created_at?: string
          customer_account_id?: string | null
          customer_id?: string | null
          file_size_bytes?: number
          id?: string
          job_request_id?: string | null
          mime_type?: string
          original_filename?: string
          rejection_reason?: string | null
          scan_completed_at?: string | null
          scan_result?: Json | null
          scan_status?: string
          storage_bucket?: string
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_media_uploads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_media_uploads_converted_to_job_media_id_fkey"
            columns: ["converted_to_job_media_id"]
            isOneToOne: false
            referencedRelation: "job_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_media_uploads_converted_to_job_media_id_fkey"
            columns: ["converted_to_job_media_id"]
            isOneToOne: false
            referencedRelation: "media_search_index"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "customer_media_uploads_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_media_uploads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_media_uploads_job_request_id_fkey"
            columns: ["job_request_id"]
            isOneToOne: false
            referencedRelation: "customer_service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payment_methods: {
        Row: {
          brand: string | null
          business_id: string
          created_at: string
          customer_account_id: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          last4: string | null
          stripe_customer_id: string | null
          stripe_payment_method_id: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          business_id: string
          created_at?: string
          customer_account_id: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          business_id?: string
          created_at?: string
          customer_account_id?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payment_methods_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payment_methods_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_invites: {
        Row: {
          accepted_at: string | null
          business_id: string
          created_at: string
          created_by: string | null
          customer_id: string
          email: string
          expires_at: string
          id: string
          invite_token: string
          last_reminder_sent_at: string | null
          reminder_count: number | null
          sent_at: string | null
          status: string
        }
        Insert: {
          accepted_at?: string | null
          business_id: string
          created_at?: string
          created_by?: string | null
          customer_id: string
          email: string
          expires_at?: string
          id?: string
          invite_token?: string
          last_reminder_sent_at?: string | null
          reminder_count?: number | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          accepted_at?: string | null
          business_id?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string
          last_reminder_sent_at?: string | null
          reminder_count?: number | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_invites_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_invites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_sessions: {
        Row: {
          active_business_id: string | null
          active_customer_id: string | null
          created_at: string
          customer_account_id: string
          expires_at: string
          id: string
          ip_address: unknown
          is_revoked: boolean
          last_active_at: string
          token: string
          user_agent: string | null
        }
        Insert: {
          active_business_id?: string | null
          active_customer_id?: string | null
          created_at?: string
          customer_account_id: string
          expires_at: string
          id?: string
          ip_address?: unknown
          is_revoked?: boolean
          last_active_at?: string
          token?: string
          user_agent?: string | null
        }
        Update: {
          active_business_id?: string | null
          active_customer_id?: string | null
          created_at?: string
          customer_account_id?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          is_revoked?: boolean
          last_active_at?: string
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_sessions_active_business_id_fkey"
            columns: ["active_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_sessions_active_customer_id_fkey"
            columns: ["active_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_portal_sessions_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_service_requests: {
        Row: {
          business_id: string
          converted_to_job_id: string | null
          converted_to_quote_id: string | null
          created_at: string
          customer_account_id: string | null
          customer_id: string
          decline_reason: string | null
          description: string
          id: string
          photo_urls: string[] | null
          preferred_dates: Json | null
          preferred_times: Json | null
          request_number: string
          reviewed_at: string | null
          reviewed_by: string | null
          service_type: string | null
          status: string
          updated_at: string
          urgency: string
        }
        Insert: {
          business_id: string
          converted_to_job_id?: string | null
          converted_to_quote_id?: string | null
          created_at?: string
          customer_account_id?: string | null
          customer_id: string
          decline_reason?: string | null
          description: string
          id?: string
          photo_urls?: string[] | null
          preferred_dates?: Json | null
          preferred_times?: Json | null
          request_number: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_type?: string | null
          status?: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          business_id?: string
          converted_to_job_id?: string | null
          converted_to_quote_id?: string | null
          created_at?: string
          customer_account_id?: string | null
          customer_id?: string
          decline_reason?: string | null
          description?: string
          id?: string
          photo_urls?: string[] | null
          preferred_dates?: Json | null
          preferred_times?: Json | null
          request_number?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_type?: string | null
          status?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_service_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_service_requests_converted_to_job_id_fkey"
            columns: ["converted_to_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_service_requests_converted_to_quote_id_fkey"
            columns: ["converted_to_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_service_requests_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_service_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          average_rating_given: number | null
          avoid_days: Json | null
          business_id: string
          city: string | null
          company_name: string | null
          created_at: string
          email: string | null
          email_engagement_score: number | null
          email_status: string | null
          email_verified: boolean | null
          first_name: string
          id: string
          last_email_at: string | null
          last_email_opened_at: string | null
          last_gallery_view_at: string | null
          last_name: string
          last_portal_access: string | null
          last_review_request_at: string | null
          latitude: number | null
          lead_score: number | null
          lead_status: string | null
          longitude: number | null
          notes: string | null
          phone: string | null
          portal_enabled: boolean | null
          portal_notification_prefs: Json | null
          preferred_contact_method: string | null
          preferred_contact_time: string | null
          preferred_days: Json | null
          preferred_review_channel: string | null
          preferred_schedule_days: string[] | null
          preferred_schedule_time: string | null
          preferred_time_window: Json | null
          review_opt_out: boolean
          review_opt_out_at: string | null
          scheduling_notes: string | null
          sms_opted_in: boolean | null
          source: string | null
          state: string | null
          tags: string[] | null
          total_photos_accessible: number | null
          total_reviews_given: number
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          average_rating_given?: number | null
          avoid_days?: Json | null
          business_id: string
          city?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          email_engagement_score?: number | null
          email_status?: string | null
          email_verified?: boolean | null
          first_name: string
          id?: string
          last_email_at?: string | null
          last_email_opened_at?: string | null
          last_gallery_view_at?: string | null
          last_name: string
          last_portal_access?: string | null
          last_review_request_at?: string | null
          latitude?: number | null
          lead_score?: number | null
          lead_status?: string | null
          longitude?: number | null
          notes?: string | null
          phone?: string | null
          portal_enabled?: boolean | null
          portal_notification_prefs?: Json | null
          preferred_contact_method?: string | null
          preferred_contact_time?: string | null
          preferred_days?: Json | null
          preferred_review_channel?: string | null
          preferred_schedule_days?: string[] | null
          preferred_schedule_time?: string | null
          preferred_time_window?: Json | null
          review_opt_out?: boolean
          review_opt_out_at?: string | null
          scheduling_notes?: string | null
          sms_opted_in?: boolean | null
          source?: string | null
          state?: string | null
          tags?: string[] | null
          total_photos_accessible?: number | null
          total_reviews_given?: number
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          average_rating_given?: number | null
          avoid_days?: Json | null
          business_id?: string
          city?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          email_engagement_score?: number | null
          email_status?: string | null
          email_verified?: boolean | null
          first_name?: string
          id?: string
          last_email_at?: string | null
          last_email_opened_at?: string | null
          last_gallery_view_at?: string | null
          last_name?: string
          last_portal_access?: string | null
          last_review_request_at?: string | null
          latitude?: number | null
          lead_score?: number | null
          lead_status?: string | null
          longitude?: number | null
          notes?: string | null
          phone?: string | null
          portal_enabled?: boolean | null
          portal_notification_prefs?: Json | null
          preferred_contact_method?: string | null
          preferred_contact_time?: string | null
          preferred_days?: Json | null
          preferred_review_channel?: string | null
          preferred_schedule_days?: string[] | null
          preferred_schedule_time?: string | null
          preferred_time_window?: Json | null
          review_opt_out?: boolean
          review_opt_out_at?: string | null
          scheduling_notes?: string | null
          sms_opted_in?: boolean | null
          source?: string | null
          state?: string | null
          tags?: string[] | null
          total_photos_accessible?: number | null
          total_reviews_given?: number
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
      email_connections: {
        Row: {
          auto_acknowledge: boolean
          auto_create_requests: boolean
          business_id: string
          classification_threshold: number
          connection_health: string
          created_at: string
          email_address: string
          encrypted_access_token: string
          encrypted_refresh_token: string
          id: string
          is_active: boolean
          last_error_at: string | null
          last_error_message: string | null
          last_sync_at: string | null
          last_sync_message_id: string | null
          poll_interval_seconds: number
          provider: string
          sync_errors_count: number
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          auto_acknowledge?: boolean
          auto_create_requests?: boolean
          business_id: string
          classification_threshold?: number
          connection_health?: string
          created_at?: string
          email_address: string
          encrypted_access_token: string
          encrypted_refresh_token: string
          id?: string
          is_active?: boolean
          last_error_at?: string | null
          last_error_message?: string | null
          last_sync_at?: string | null
          last_sync_message_id?: string | null
          poll_interval_seconds?: number
          provider?: string
          sync_errors_count?: number
          token_expires_at: string
          updated_at?: string
        }
        Update: {
          auto_acknowledge?: boolean
          auto_create_requests?: boolean
          business_id?: string
          classification_threshold?: number
          connection_health?: string
          created_at?: string
          email_address?: string
          encrypted_access_token?: string
          encrypted_refresh_token?: string
          id?: string
          is_active?: boolean
          last_error_at?: string | null
          last_error_message?: string | null
          last_sync_at?: string | null
          last_sync_message_id?: string | null
          poll_interval_seconds?: number
          provider?: string
          sync_errors_count?: number
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preferences: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          id: string
          preference_token: string
          resubscribed_at: string | null
          subscribed_marketing: boolean | null
          subscribed_sequences: boolean | null
          subscribed_transactional: boolean | null
          unsubscribe_reason: string | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          preference_token?: string
          resubscribed_at?: string | null
          subscribed_marketing?: boolean | null
          subscribed_sequences?: boolean | null
          subscribed_transactional?: boolean | null
          unsubscribe_reason?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          preference_token?: string
          resubscribed_at?: string | null
          subscribed_marketing?: boolean | null
          subscribed_sequences?: boolean | null
          subscribed_transactional?: boolean | null
          unsubscribe_reason?: string | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_preferences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
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
      email_reply_templates: {
        Row: {
          body_html: string | null
          body_text: string
          business_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          subject: string
          updated_at: string
          use_for_auto_acknowledge: boolean
          variables: Json | null
        }
        Insert: {
          body_html?: string | null
          body_text: string
          business_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          subject: string
          updated_at?: string
          use_for_auto_acknowledge?: boolean
          variables?: Json | null
        }
        Update: {
          body_html?: string | null
          body_text?: string
          business_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          subject?: string
          updated_at?: string
          use_for_auto_acknowledge?: boolean
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_reply_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_rules: {
        Row: {
          action: string
          action_config: Json | null
          business_id: string
          conditions: Json
          connection_id: string | null
          created_at: string
          created_from_correction: boolean
          id: string
          is_active: boolean
          last_matched_at: string | null
          name: string
          priority: number
          times_matched: number
          updated_at: string
        }
        Insert: {
          action?: string
          action_config?: Json | null
          business_id: string
          conditions?: Json
          connection_id?: string | null
          created_at?: string
          created_from_correction?: boolean
          id?: string
          is_active?: boolean
          last_matched_at?: string | null
          name: string
          priority?: number
          times_matched?: number
          updated_at?: string
        }
        Update: {
          action?: string
          action_config?: Json | null
          business_id?: string
          conditions?: Json
          connection_id?: string | null
          created_at?: string
          created_from_correction?: boolean
          id?: string
          is_active?: boolean
          last_matched_at?: string | null
          name?: string
          priority?: number
          times_matched?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_rules_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          bounced_at: string | null
          business_id: string
          campaign_id: string | null
          click_count: number | null
          clicked_at: string | null
          clicked_links: Json | null
          complained_at: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          email_type: string
          enrollment_id: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          open_count: number | null
          opened_at: string | null
          resend_id: string | null
          sent_at: string | null
          sequence_id: string | null
          status: string
          step_id: string | null
          subject: string
          template_id: string | null
          to_email: string
          to_name: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          bounced_at?: string | null
          business_id: string
          campaign_id?: string | null
          click_count?: number | null
          clicked_at?: string | null
          clicked_links?: Json | null
          complained_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          email_type?: string
          enrollment_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          open_count?: number | null
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          status?: string
          step_id?: string | null
          subject: string
          template_id?: string | null
          to_email: string
          to_name?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          bounced_at?: string | null
          business_id?: string
          campaign_id?: string | null
          click_count?: number | null
          clicked_at?: string | null
          clicked_links?: Json | null
          complained_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          email_type?: string
          enrollment_id?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          open_count?: number | null
          opened_at?: string | null
          resend_id?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          status?: string
          step_id?: string | null
          subject?: string
          template_id?: string | null
          to_email?: string
          to_name?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "sequence_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "sequence_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          business_id: string
          completed_count: number | null
          created_at: string
          created_by: string | null
          description: string | null
          enrollment_count: number | null
          id: string
          name: string
          status: string
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          business_id: string
          completed_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enrollment_count?: number | null
          id?: string
          name: string
          status?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          completed_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          enrollment_count?: number | null
          id?: string
          name?: string
          status?: string
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          business_id: string
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          name: string
          subject: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          body_html: string
          body_text?: string | null
          business_id: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          body_html?: string
          body_text?: string | null
          business_id?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_pay_rates: {
        Row: {
          bill_rate: number | null
          business_id: string
          created_at: string
          created_by: string | null
          double_time_rate: number | null
          effective_from: string
          effective_to: string | null
          hourly_rate: number
          id: string
          is_current: boolean | null
          overtime_rate: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bill_rate?: number | null
          business_id: string
          created_at?: string
          created_by?: string | null
          double_time_rate?: number | null
          effective_from?: string
          effective_to?: string | null
          hourly_rate: number
          id?: string
          is_current?: boolean | null
          overtime_rate?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bill_rate?: number | null
          business_id?: string
          created_at?: string
          created_by?: string | null
          double_time_rate?: number | null
          effective_from?: string
          effective_to?: string | null
          hourly_rate?: number
          id?: string
          is_current?: boolean | null
          overtime_rate?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_pay_rates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_pay_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_pay_rates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_reviews: {
        Row: {
          author_image_url: string | null
          author_name: string | null
          business_id: string
          created_at: string
          external_id: string
          id: string
          is_responded: boolean
          platform: string
          rating: number
          responded_at: string | null
          response_text: string | null
          review_text: string | null
          review_url: string | null
          reviewed_at: string
          sentiment: string | null
          synced_at: string
          updated_at: string
        }
        Insert: {
          author_image_url?: string | null
          author_name?: string | null
          business_id: string
          created_at?: string
          external_id: string
          id?: string
          is_responded?: boolean
          platform: string
          rating: number
          responded_at?: string | null
          response_text?: string | null
          review_text?: string | null
          review_url?: string | null
          reviewed_at: string
          sentiment?: string | null
          synced_at?: string
          updated_at?: string
        }
        Update: {
          author_image_url?: string | null
          author_name?: string | null
          business_id?: string
          created_at?: string
          external_id?: string
          id?: string
          is_responded?: boolean
          platform?: string
          rating?: number
          responded_at?: string | null
          response_text?: string | null
          review_text?: string | null
          review_url?: string | null
          reviewed_at?: string
          sentiment?: string | null
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_brandings: {
        Row: {
          background_color: string | null
          background_image_url: string | null
          body_font: string | null
          business_id: string
          contact_info: string | null
          created_at: string | null
          favicon_url: string | null
          footer_text: string | null
          gallery_title_template: string | null
          heading_font: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          show_address: boolean | null
          show_date: boolean | null
          show_job_details: boolean | null
          show_powered_by: boolean | null
          text_color: string | null
          updated_at: string | null
        }
        Insert: {
          background_color?: string | null
          background_image_url?: string | null
          body_font?: string | null
          business_id: string
          contact_info?: string | null
          created_at?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          gallery_title_template?: string | null
          heading_font?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_address?: boolean | null
          show_date?: boolean | null
          show_job_details?: boolean | null
          show_powered_by?: boolean | null
          text_color?: string | null
          updated_at?: string | null
        }
        Update: {
          background_color?: string | null
          background_image_url?: string | null
          body_font?: string | null
          business_id?: string
          contact_info?: string | null
          created_at?: string | null
          favicon_url?: string | null
          footer_text?: string | null
          gallery_title_template?: string | null
          heading_font?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          show_address?: boolean | null
          show_date?: boolean | null
          show_job_details?: boolean | null
          show_powered_by?: boolean | null
          text_color?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_brandings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_share_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_ip_hash: string | null
          actor_type: string
          business_id: string
          created_at: string | null
          details: Json | null
          id: string
          share_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_ip_hash?: string | null
          actor_type: string
          business_id: string
          created_at?: string | null
          details?: Json | null
          id?: string
          share_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_ip_hash?: string | null
          actor_type?: string
          business_id?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          share_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_share_audit_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_share_audit_log_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "photo_gallery_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      gallery_views: {
        Row: {
          business_id: string
          device_type: string | null
          downloaded_photos: string[] | null
          expires_at: string | null
          id: string
          photos_viewed: number | null
          referrer_domain: string | null
          share_id: string
          time_spent_seconds: number | null
          viewed_at: string | null
          visitor_email: string | null
          visitor_fingerprint_hash: string | null
          visitor_ip_hash: string | null
        }
        Insert: {
          business_id: string
          device_type?: string | null
          downloaded_photos?: string[] | null
          expires_at?: string | null
          id?: string
          photos_viewed?: number | null
          referrer_domain?: string | null
          share_id: string
          time_spent_seconds?: number | null
          viewed_at?: string | null
          visitor_email?: string | null
          visitor_fingerprint_hash?: string | null
          visitor_ip_hash?: string | null
        }
        Update: {
          business_id?: string
          device_type?: string | null
          downloaded_photos?: string[] | null
          expires_at?: string | null
          id?: string
          photos_viewed?: number | null
          referrer_domain?: string | null
          share_id?: string
          time_spent_seconds?: number | null
          viewed_at?: string | null
          visitor_email?: string | null
          visitor_fingerprint_hash?: string | null
          visitor_ip_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gallery_views_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gallery_views_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "photo_gallery_shares"
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
      inbound_emails: {
        Row: {
          ai_extracted_data: Json | null
          attachments: Json | null
          body_html: string | null
          body_text: string | null
          business_id: string
          classification: string | null
          classification_confidence: number | null
          classification_stage: string
          classification_tier: string | null
          classified_at: string | null
          connection_id: string
          content_hash: string
          created_at: string
          duplicate_of_id: string | null
          from_address: string
          from_name: string | null
          id: string
          is_duplicate: boolean
          job_request_id: string | null
          provider_message_id: string
          raw_headers: Json | null
          received_at: string
          status: string
          subject: string | null
          thread_id: string | null
          to_address: string
          updated_at: string
        }
        Insert: {
          ai_extracted_data?: Json | null
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          business_id: string
          classification?: string | null
          classification_confidence?: number | null
          classification_stage?: string
          classification_tier?: string | null
          classified_at?: string | null
          connection_id: string
          content_hash: string
          created_at?: string
          duplicate_of_id?: string | null
          from_address: string
          from_name?: string | null
          id?: string
          is_duplicate?: boolean
          job_request_id?: string | null
          provider_message_id: string
          raw_headers?: Json | null
          received_at: string
          status?: string
          subject?: string | null
          thread_id?: string | null
          to_address: string
          updated_at?: string
        }
        Update: {
          ai_extracted_data?: Json | null
          attachments?: Json | null
          body_html?: string | null
          body_text?: string | null
          business_id?: string
          classification?: string | null
          classification_confidence?: number | null
          classification_stage?: string
          classification_tier?: string | null
          classified_at?: string | null
          connection_id?: string
          content_hash?: string
          created_at?: string
          duplicate_of_id?: string | null
          from_address?: string
          from_name?: string | null
          id?: string
          is_duplicate?: boolean
          job_request_id?: string | null
          provider_message_id?: string
          raw_headers?: Json | null
          received_at?: string
          status?: string
          subject?: string | null
          thread_id?: string | null
          to_address?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_emails_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_duplicate_of_id_fkey"
            columns: ["duplicate_of_id"]
            isOneToOne: false
            referencedRelation: "inbound_emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_emails_job_request_id_fkey"
            columns: ["job_request_id"]
            isOneToOne: false
            referencedRelation: "job_requests"
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
          customer_viewed_at: string | null
          discount_amount: number | null
          due_date: string | null
          embedded_gallery_id: string | null
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
          show_photos: boolean | null
          status: string | null
          subtotal: number | null
          tax_amount: number | null
          tax_rate: number | null
          total: number | null
          updated_at: string
          view_count: number | null
        }
        Insert: {
          amount_paid?: number | null
          balance_due?: number | null
          business_id: string
          created_at?: string
          customer_id: string
          customer_viewed_at?: string | null
          discount_amount?: number | null
          due_date?: string | null
          embedded_gallery_id?: string | null
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
          show_photos?: boolean | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number | null
          updated_at?: string
          view_count?: number | null
        }
        Update: {
          amount_paid?: number | null
          balance_due?: number | null
          business_id?: string
          created_at?: string
          customer_id?: string
          customer_viewed_at?: string | null
          discount_amount?: number | null
          due_date?: string | null
          embedded_gallery_id?: string | null
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
          show_photos?: boolean | null
          status?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number | null
          updated_at?: string
          view_count?: number | null
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
            foreignKeyName: "invoices_embedded_gallery_id_fkey"
            columns: ["embedded_gallery_id"]
            isOneToOne: false
            referencedRelation: "photo_gallery_shares"
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
      job_media: {
        Row: {
          altitude: number | null
          annotation_count: number
          aperture: string | null
          blurhash: string | null
          business_id: string
          camera_make: string | null
          camera_model: string | null
          captured_at: string | null
          category: Database["public"]["Enums"]["media_category"]
          checklist_item_id: string | null
          checklist_sequence: number | null
          content_hash: string | null
          created_at: string
          current_annotation_id: string | null
          customer_id: string | null
          deleted_at: string | null
          description: string | null
          duration_seconds: number | null
          file_extension: string
          file_size_bytes: number
          focal_length: string | null
          gps_accuracy_meters: number | null
          has_annotations: boolean
          height: number | null
          id: string
          is_cover_photo: boolean | null
          is_visible: boolean | null
          iso: number | null
          job_id: string
          latitude: number | null
          longitude: number | null
          media_type: string
          mime_type: string
          perceptual_hash: string | null
          processing_error: string | null
          search_text: string | null
          shutter_speed: string | null
          sort_order: number | null
          status: Database["public"]["Enums"]["media_status"]
          storage_bucket: string
          storage_path: string
          tag_slugs: string[] | null
          thumbnail_url_lg: string | null
          thumbnail_url_md: string | null
          thumbnail_url_sm: string | null
          updated_at: string
          upload_device: string | null
          upload_source: string
          uploaded_by: string | null
          url: string | null
          width: number | null
        }
        Insert: {
          altitude?: number | null
          annotation_count?: number
          aperture?: string | null
          blurhash?: string | null
          business_id: string
          camera_make?: string | null
          camera_model?: string | null
          captured_at?: string | null
          category?: Database["public"]["Enums"]["media_category"]
          checklist_item_id?: string | null
          checklist_sequence?: number | null
          content_hash?: string | null
          created_at?: string
          current_annotation_id?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_extension: string
          file_size_bytes: number
          focal_length?: string | null
          gps_accuracy_meters?: number | null
          has_annotations?: boolean
          height?: number | null
          id?: string
          is_cover_photo?: boolean | null
          is_visible?: boolean | null
          iso?: number | null
          job_id: string
          latitude?: number | null
          longitude?: number | null
          media_type?: string
          mime_type: string
          perceptual_hash?: string | null
          processing_error?: string | null
          search_text?: string | null
          shutter_speed?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["media_status"]
          storage_bucket?: string
          storage_path: string
          tag_slugs?: string[] | null
          thumbnail_url_lg?: string | null
          thumbnail_url_md?: string | null
          thumbnail_url_sm?: string | null
          updated_at?: string
          upload_device?: string | null
          upload_source?: string
          uploaded_by?: string | null
          url?: string | null
          width?: number | null
        }
        Update: {
          altitude?: number | null
          annotation_count?: number
          aperture?: string | null
          blurhash?: string | null
          business_id?: string
          camera_make?: string | null
          camera_model?: string | null
          captured_at?: string | null
          category?: Database["public"]["Enums"]["media_category"]
          checklist_item_id?: string | null
          checklist_sequence?: number | null
          content_hash?: string | null
          created_at?: string
          current_annotation_id?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          description?: string | null
          duration_seconds?: number | null
          file_extension?: string
          file_size_bytes?: number
          focal_length?: string | null
          gps_accuracy_meters?: number | null
          has_annotations?: boolean
          height?: number | null
          id?: string
          is_cover_photo?: boolean | null
          is_visible?: boolean | null
          iso?: number | null
          job_id?: string
          latitude?: number | null
          longitude?: number | null
          media_type?: string
          mime_type?: string
          perceptual_hash?: string | null
          processing_error?: string | null
          search_text?: string | null
          shutter_speed?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["media_status"]
          storage_bucket?: string
          storage_path?: string
          tag_slugs?: string[] | null
          thumbnail_url_lg?: string | null
          thumbnail_url_md?: string | null
          thumbnail_url_sm?: string | null
          updated_at?: string
          upload_device?: string | null
          upload_source?: string
          uploaded_by?: string | null
          url?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_media_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_media_current_annotation_id_fkey"
            columns: ["current_annotation_id"]
            isOneToOne: false
            referencedRelation: "media_annotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_media_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_media_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_media_tags: {
        Row: {
          business_id: string
          id: string
          job_media_id: string
          source: string | null
          tag_id: string
          tagged_at: string | null
          tagged_by: string | null
        }
        Insert: {
          business_id: string
          id?: string
          job_media_id: string
          source?: string | null
          tag_id: string
          tagged_at?: string | null
          tagged_by?: string | null
        }
        Update: {
          business_id?: string
          id?: string
          job_media_id?: string
          source?: string | null
          tag_id?: string
          tagged_at?: string | null
          tagged_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_media_tags_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_media_tags_job_media_id_fkey"
            columns: ["job_media_id"]
            isOneToOne: false
            referencedRelation: "job_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_media_tags_job_media_id_fkey"
            columns: ["job_media_id"]
            isOneToOne: false
            referencedRelation: "media_search_index"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "job_media_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "media_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_media_tags_tagged_by_fkey"
            columns: ["tagged_by"]
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
          source_email_id: string | null
          source_email_thread_id: string | null
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
          source_email_id?: string | null
          source_email_thread_id?: string | null
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
          source_email_id?: string | null
          source_email_thread_id?: string | null
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
          active_gallery_share_id: string | null
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
          comparison_count: number
          cover_photo_url: string | null
          created_at: string
          customer_id: string
          customer_photos: string[] | null
          customer_visible_notes: string | null
          deleted_at: string | null
          description: string | null
          drive_time_from_previous: number | null
          estimated_arrival: string | null
          estimated_duration_minutes: number | null
          feedback_received_at: string | null
          feedback_requested_at: string | null
          gallery_view_count: number | null
          geofence_enforcement: string | null
          geofence_expanded_radius_meters: number | null
          geofence_expanded_until: string | null
          geofence_radius_meters: number | null
          has_active_gallery: boolean | null
          has_after_photos: boolean | null
          has_before_after: boolean
          has_before_photos: boolean | null
          id: string
          internal_notes: string | null
          is_clocked_in: boolean | null
          job_number: string
          latitude: number | null
          longitude: number | null
          media_count: number | null
          notes: string | null
          priority: string | null
          quote_id: string | null
          review_completed_at: string | null
          review_id: string | null
          review_request_id: string | null
          review_requested_at: string | null
          route_plan_id: string | null
          route_sequence: number | null
          scheduled_end: string | null
          scheduled_start: string | null
          service_request_id: string | null
          state: string | null
          status: string | null
          title: string
          total_billable_amount: number | null
          total_labor_cost: number | null
          total_labor_minutes: number | null
          tracking_token: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          active_gallery_share_id?: string | null
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
          comparison_count?: number
          cover_photo_url?: string | null
          created_at?: string
          customer_id: string
          customer_photos?: string[] | null
          customer_visible_notes?: string | null
          deleted_at?: string | null
          description?: string | null
          drive_time_from_previous?: number | null
          estimated_arrival?: string | null
          estimated_duration_minutes?: number | null
          feedback_received_at?: string | null
          feedback_requested_at?: string | null
          gallery_view_count?: number | null
          geofence_enforcement?: string | null
          geofence_expanded_radius_meters?: number | null
          geofence_expanded_until?: string | null
          geofence_radius_meters?: number | null
          has_active_gallery?: boolean | null
          has_after_photos?: boolean | null
          has_before_after?: boolean
          has_before_photos?: boolean | null
          id?: string
          internal_notes?: string | null
          is_clocked_in?: boolean | null
          job_number: string
          latitude?: number | null
          longitude?: number | null
          media_count?: number | null
          notes?: string | null
          priority?: string | null
          quote_id?: string | null
          review_completed_at?: string | null
          review_id?: string | null
          review_request_id?: string | null
          review_requested_at?: string | null
          route_plan_id?: string | null
          route_sequence?: number | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_request_id?: string | null
          state?: string | null
          status?: string | null
          title: string
          total_billable_amount?: number | null
          total_labor_cost?: number | null
          total_labor_minutes?: number | null
          tracking_token?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          active_gallery_share_id?: string | null
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
          comparison_count?: number
          cover_photo_url?: string | null
          created_at?: string
          customer_id?: string
          customer_photos?: string[] | null
          customer_visible_notes?: string | null
          deleted_at?: string | null
          description?: string | null
          drive_time_from_previous?: number | null
          estimated_arrival?: string | null
          estimated_duration_minutes?: number | null
          feedback_received_at?: string | null
          feedback_requested_at?: string | null
          gallery_view_count?: number | null
          geofence_enforcement?: string | null
          geofence_expanded_radius_meters?: number | null
          geofence_expanded_until?: string | null
          geofence_radius_meters?: number | null
          has_active_gallery?: boolean | null
          has_after_photos?: boolean | null
          has_before_after?: boolean
          has_before_photos?: boolean | null
          id?: string
          internal_notes?: string | null
          is_clocked_in?: boolean | null
          job_number?: string
          latitude?: number | null
          longitude?: number | null
          media_count?: number | null
          notes?: string | null
          priority?: string | null
          quote_id?: string | null
          review_completed_at?: string | null
          review_id?: string | null
          review_request_id?: string | null
          review_requested_at?: string | null
          route_plan_id?: string | null
          route_sequence?: number | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_request_id?: string | null
          state?: string | null
          status?: string | null
          title?: string
          total_billable_amount?: number | null
          total_labor_cost?: number | null
          total_labor_minutes?: number | null
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
            foreignKeyName: "jobs_active_gallery_share_id_fkey"
            columns: ["active_gallery_share_id"]
            isOneToOne: false
            referencedRelation: "photo_gallery_shares"
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
          {
            foreignKeyName: "jobs_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_review_request_id_fkey"
            columns: ["review_request_id"]
            isOneToOne: false
            referencedRelation: "review_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "customer_service_requests"
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
      media_annotations: {
        Row: {
          annotation_data: Json
          business_id: string
          created_at: string
          created_by: string | null
          created_by_name: string | null
          deleted_at: string | null
          deleted_by: string | null
          has_arrows: boolean
          has_measurements: boolean
          has_shapes: boolean
          has_text: boolean
          id: string
          is_current: boolean
          job_media_id: string
          object_count: number
          parent_version_id: string | null
          render_error: string | null
          rendered_at: string | null
          rendered_url: string | null
          updated_at: string
          version: number
        }
        Insert: {
          annotation_data?: Json
          business_id: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          has_arrows?: boolean
          has_measurements?: boolean
          has_shapes?: boolean
          has_text?: boolean
          id?: string
          is_current?: boolean
          job_media_id: string
          object_count?: number
          parent_version_id?: string | null
          render_error?: string | null
          rendered_at?: string | null
          rendered_url?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          annotation_data?: Json
          business_id?: string
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          has_arrows?: boolean
          has_measurements?: boolean
          has_shapes?: boolean
          has_text?: boolean
          id?: string
          is_current?: boolean
          job_media_id?: string
          object_count?: number
          parent_version_id?: string | null
          render_error?: string | null
          rendered_at?: string | null
          rendered_url?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "media_annotations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_annotations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_annotations_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_annotations_job_media_id_fkey"
            columns: ["job_media_id"]
            isOneToOne: false
            referencedRelation: "job_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_annotations_job_media_id_fkey"
            columns: ["job_media_id"]
            isOneToOne: false
            referencedRelation: "media_search_index"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "media_annotations_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "media_annotations"
            referencedColumns: ["id"]
          },
        ]
      }
      media_metrics: {
        Row: {
          business_id: string | null
          cleanup_bytes_reclaimed: number | null
          cleanup_deleted: number | null
          created_at: string | null
          id: string
          metric_date: string
          scans_clean: number | null
          scans_rejected: number | null
          storage_bytes: number | null
          thumbnails_bytes: number | null
          uploads_count: number | null
        }
        Insert: {
          business_id?: string | null
          cleanup_bytes_reclaimed?: number | null
          cleanup_deleted?: number | null
          created_at?: string | null
          id?: string
          metric_date?: string
          scans_clean?: number | null
          scans_rejected?: number | null
          storage_bytes?: number | null
          thumbnails_bytes?: number | null
          uploads_count?: number | null
        }
        Update: {
          business_id?: string | null
          cleanup_bytes_reclaimed?: number | null
          cleanup_deleted?: number | null
          created_at?: string | null
          id?: string
          metric_date?: string
          scans_clean?: number | null
          scans_rejected?: number | null
          storage_bytes?: number | null
          thumbnails_bytes?: number | null
          uploads_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_metrics_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      media_search_refresh_queue: {
        Row: {
          id: number
          last_refresh_at: string | null
          needs_refresh: boolean | null
        }
        Insert: {
          id?: number
          last_refresh_at?: string | null
          needs_refresh?: boolean | null
        }
        Update: {
          id?: number
          last_refresh_at?: string | null
          needs_refresh?: boolean | null
        }
        Relationships: []
      }
      media_tags: {
        Row: {
          business_id: string
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          last_used_at: string | null
          name: string
          slug: string
          sort_order: number | null
          tag_group: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          business_id: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          last_used_at?: string | null
          name: string
          slug: string
          sort_order?: number | null
          tag_group?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          business_id?: string
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          last_used_at?: string | null
          name?: string
          slug?: string
          sort_order?: number | null
          tag_group?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_tags_business_id_fkey"
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
          email_portal_first_login: boolean | null
          email_portal_login: boolean | null
          email_quote_approved: boolean | null
          email_quote_sent: boolean | null
          email_team_invite: boolean | null
          email_timesheet_approved: boolean | null
          email_timesheet_rejected: boolean | null
          email_timesheet_submitted: boolean | null
          id: string
          inapp_geofence_alerts: boolean | null
          inapp_invoice_activity: boolean | null
          inapp_job_activity: boolean | null
          inapp_payment_activity: boolean | null
          inapp_portal_activity: boolean | null
          inapp_quote_activity: boolean | null
          inapp_team_activity: boolean | null
          inapp_timesheet_activity: boolean | null
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
          email_portal_first_login?: boolean | null
          email_portal_login?: boolean | null
          email_quote_approved?: boolean | null
          email_quote_sent?: boolean | null
          email_team_invite?: boolean | null
          email_timesheet_approved?: boolean | null
          email_timesheet_rejected?: boolean | null
          email_timesheet_submitted?: boolean | null
          id?: string
          inapp_geofence_alerts?: boolean | null
          inapp_invoice_activity?: boolean | null
          inapp_job_activity?: boolean | null
          inapp_payment_activity?: boolean | null
          inapp_portal_activity?: boolean | null
          inapp_quote_activity?: boolean | null
          inapp_team_activity?: boolean | null
          inapp_timesheet_activity?: boolean | null
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
          email_portal_first_login?: boolean | null
          email_portal_login?: boolean | null
          email_quote_approved?: boolean | null
          email_quote_sent?: boolean | null
          email_team_invite?: boolean | null
          email_timesheet_approved?: boolean | null
          email_timesheet_rejected?: boolean | null
          email_timesheet_submitted?: boolean | null
          id?: string
          inapp_geofence_alerts?: boolean | null
          inapp_invoice_activity?: boolean | null
          inapp_job_activity?: boolean | null
          inapp_payment_activity?: boolean | null
          inapp_portal_activity?: boolean | null
          inapp_quote_activity?: boolean | null
          inapp_team_activity?: boolean | null
          inapp_timesheet_activity?: boolean | null
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
      pay_periods: {
        Row: {
          business_id: string
          created_at: string
          end_date: string
          id: string
          locked_at: string | null
          locked_by: string | null
          period_type: string
          start_date: string
          status: string
          total_hours: number | null
          total_labor_cost: number | null
          total_overtime_hours: number | null
          total_regular_hours: number | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          end_date: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          period_type?: string
          start_date: string
          status?: string
          total_hours?: number | null
          total_labor_cost?: number | null
          total_overtime_hours?: number | null
          total_regular_hours?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          end_date?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          period_type?: string
          start_date?: string
          status?: string
          total_hours?: number | null
          total_labor_cost?: number | null
          total_overtime_hours?: number | null
          total_regular_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_periods_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_periods_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      phone_integration_logs: {
        Row: {
          business_id: string
          created_at: string | null
          duration_ms: number | null
          endpoint: string
          id: string
          integration_id: string
          ip_address: string | null
          method: string
          request_metadata: Json | null
          response_code: string | null
          status_code: number
        }
        Insert: {
          business_id: string
          created_at?: string | null
          duration_ms?: number | null
          endpoint: string
          id?: string
          integration_id: string
          ip_address?: string | null
          method: string
          request_metadata?: Json | null
          response_code?: string | null
          status_code: number
        }
        Update: {
          business_id?: string
          created_at?: string | null
          duration_ms?: number | null
          endpoint?: string
          id?: string
          integration_id?: string
          ip_address?: string | null
          method?: string
          request_metadata?: Json | null
          response_code?: string | null
          status_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "phone_integration_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phone_integration_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "phone_integrations"
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
      photo_comments: {
        Row: {
          admin_id: string | null
          author_email: string | null
          author_name: string
          author_type: string
          business_id: string
          comment_text: string
          created_at: string | null
          customer_id: string | null
          deleted_at: string | null
          deleted_by: string | null
          hidden_at: string | null
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          is_hidden: boolean | null
          is_question: boolean | null
          is_read: boolean | null
          is_resolved: boolean | null
          job_media_id: string
          parent_comment_id: string | null
          reply_depth: number | null
          share_id: string | null
          updated_at: string | null
        }
        Insert: {
          admin_id?: string | null
          author_email?: string | null
          author_name: string
          author_type: string
          business_id: string
          comment_text: string
          created_at?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean | null
          is_question?: boolean | null
          is_read?: boolean | null
          is_resolved?: boolean | null
          job_media_id: string
          parent_comment_id?: string | null
          reply_depth?: number | null
          share_id?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_id?: string | null
          author_email?: string | null
          author_name?: string
          author_type?: string
          business_id?: string
          comment_text?: string
          created_at?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean | null
          is_question?: boolean | null
          is_read?: boolean | null
          is_resolved?: boolean | null
          job_media_id?: string
          parent_comment_id?: string | null
          reply_depth?: number | null
          share_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_comments_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_comments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_comments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_comments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_comments_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_comments_job_media_id_fkey"
            columns: ["job_media_id"]
            isOneToOne: false
            referencedRelation: "job_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_comments_job_media_id_fkey"
            columns: ["job_media_id"]
            isOneToOne: false
            referencedRelation: "media_search_index"
            referencedColumns: ["media_id"]
          },
          {
            foreignKeyName: "photo_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "photo_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_comments_share_id_fkey"
            columns: ["share_id"]
            isOneToOne: false
            referencedRelation: "photo_gallery_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_gallery_shares: {
        Row: {
          allow_comments: boolean | null
          allow_download: boolean | null
          business_id: string
          created_at: string | null
          created_by: string
          custom_message: string | null
          custom_title: string | null
          download_count: number | null
          exclude_media_ids: string[] | null
          expires_at: string | null
          hide_watermark: boolean | null
          id: string
          include_annotations: boolean | null
          include_categories: string[] | null
          include_comparisons: boolean | null
          is_active: boolean | null
          is_permanent: boolean | null
          job_id: string
          last_viewed_at: string | null
          permanent_approved_at: string | null
          permanent_approved_by: string | null
          require_email: boolean | null
          revoked_at: string | null
          revoked_by: string | null
          share_token: string
          token_hash: string
          unique_visitors: number | null
          updated_at: string | null
          view_count: number | null
        }
        Insert: {
          allow_comments?: boolean | null
          allow_download?: boolean | null
          business_id: string
          created_at?: string | null
          created_by: string
          custom_message?: string | null
          custom_title?: string | null
          download_count?: number | null
          exclude_media_ids?: string[] | null
          expires_at?: string | null
          hide_watermark?: boolean | null
          id?: string
          include_annotations?: boolean | null
          include_categories?: string[] | null
          include_comparisons?: boolean | null
          is_active?: boolean | null
          is_permanent?: boolean | null
          job_id: string
          last_viewed_at?: string | null
          permanent_approved_at?: string | null
          permanent_approved_by?: string | null
          require_email?: boolean | null
          revoked_at?: string | null
          revoked_by?: string | null
          share_token: string
          token_hash: string
          unique_visitors?: number | null
          updated_at?: string | null
          view_count?: number | null
        }
        Update: {
          allow_comments?: boolean | null
          allow_download?: boolean | null
          business_id?: string
          created_at?: string | null
          created_by?: string
          custom_message?: string | null
          custom_title?: string | null
          download_count?: number | null
          exclude_media_ids?: string[] | null
          expires_at?: string | null
          hide_watermark?: boolean | null
          id?: string
          include_annotations?: boolean | null
          include_categories?: string[] | null
          include_comparisons?: boolean | null
          is_active?: boolean | null
          is_permanent?: boolean | null
          job_id?: string
          last_viewed_at?: string | null
          permanent_approved_at?: string | null
          permanent_approved_by?: string | null
          require_email?: boolean | null
          revoked_at?: string | null
          revoked_by?: string | null
          share_token?: string
          token_hash?: string
          unique_visitors?: number | null
          updated_at?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_gallery_shares_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_gallery_shares_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_gallery_shares_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_gallery_shares_permanent_approved_by_fkey"
            columns: ["permanent_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_gallery_shares_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_reports: {
        Row: {
          business_id: string
          completed_at: string | null
          created_at: string | null
          created_by: string
          error_code: string | null
          error_message: string | null
          expires_at: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          idempotency_key: string | null
          include_annotations: boolean | null
          include_comparisons: boolean | null
          include_descriptions: boolean | null
          include_gps: boolean | null
          include_media_ids: string[] | null
          include_timestamps: boolean | null
          job_id: string
          layout: string | null
          max_retries: number | null
          orientation: string | null
          page_count: number | null
          paper_size: string | null
          photos_per_page: number | null
          queue_position: number | null
          report_type: string
          retry_count: number | null
          started_at: string | null
          status: string | null
          storage_bucket: string | null
          storage_path: string | null
          title: string
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          error_code?: string | null
          error_message?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          idempotency_key?: string | null
          include_annotations?: boolean | null
          include_comparisons?: boolean | null
          include_descriptions?: boolean | null
          include_gps?: boolean | null
          include_media_ids?: string[] | null
          include_timestamps?: boolean | null
          job_id: string
          layout?: string | null
          max_retries?: number | null
          orientation?: string | null
          page_count?: number | null
          paper_size?: string | null
          photos_per_page?: number | null
          queue_position?: number | null
          report_type: string
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          title: string
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          error_code?: string | null
          error_message?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          idempotency_key?: string | null
          include_annotations?: boolean | null
          include_comparisons?: boolean | null
          include_descriptions?: boolean | null
          include_gps?: boolean | null
          include_media_ids?: string[] | null
          include_timestamps?: boolean | null
          job_id?: string
          layout?: string | null
          max_retries?: number | null
          orientation?: string | null
          page_count?: number | null
          paper_size?: string | null
          photos_per_page?: number | null
          queue_position?: number | null
          report_type?: string
          retry_count?: number | null
          started_at?: string | null
          status?: string | null
          storage_bucket?: string | null
          storage_path?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_reports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_access_audit: {
        Row: {
          business_id: string
          created_at: string | null
          customer_account_id: string | null
          customer_id: string
          event_details: Json | null
          event_type: string
          id: string
          ip_address: string | null
          performed_by: string | null
          user_agent: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          customer_account_id?: string | null
          customer_id: string
          event_details?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          customer_account_id?: string | null
          customer_id?: string
          event_details?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_access_audit_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_access_audit_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_access_audit_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_access_audit_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_activity_log: {
        Row: {
          action: string
          business_id: string | null
          created_at: string
          customer_account_id: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          business_id?: string | null
          created_at?: string
          customer_account_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          business_id?: string | null
          created_at?: string
          customer_account_id?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_activity_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_activity_log_customer_account_id_fkey"
            columns: ["customer_account_id"]
            isOneToOne: false
            referencedRelation: "customer_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_activity_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "customer_portal_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_settings: {
        Row: {
          allow_feedback: boolean
          allow_invoice_payment: boolean
          allow_quote_approval: boolean
          allow_reschedule_requests: boolean
          allow_service_requests: boolean
          business_id: string
          created_at: string
          id: string
          is_enabled: boolean
          logo_url: string | null
          magic_link_expiry_minutes: number
          primary_color: string | null
          require_password_after_first_login: boolean
          session_duration_hours: number
          show_job_eta: boolean
          show_technician_info: boolean
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          allow_feedback?: boolean
          allow_invoice_payment?: boolean
          allow_quote_approval?: boolean
          allow_reschedule_requests?: boolean
          allow_service_requests?: boolean
          business_id: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          logo_url?: string | null
          magic_link_expiry_minutes?: number
          primary_color?: string | null
          require_password_after_first_login?: boolean
          session_duration_hours?: number
          show_job_eta?: boolean
          show_technician_info?: boolean
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          allow_feedback?: boolean
          allow_invoice_payment?: boolean
          allow_quote_approval?: boolean
          allow_reschedule_requests?: boolean
          allow_service_requests?: boolean
          business_id?: string
          created_at?: string
          id?: string
          is_enabled?: boolean
          logo_url?: string | null
          magic_link_expiry_minutes?: number
          primary_color?: string | null
          require_password_after_first_login?: boolean
          session_duration_hours?: number
          show_job_eta?: boolean
          show_technician_info?: boolean
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_business_id: string | null
          active_role: Database["public"]["Enums"]["app_role"] | null
          avatar_url: string | null
          business_id: string | null
          can_approve_timesheets: boolean | null
          created_at: string
          default_hourly_rate: number | null
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
          overtime_exempt: boolean | null
          phone: string | null
          requires_timesheet_approval: boolean | null
          skill_tags: string[] | null
          updated_at: string
        }
        Insert: {
          active_business_id?: string | null
          active_role?: Database["public"]["Enums"]["app_role"] | null
          avatar_url?: string | null
          business_id?: string | null
          can_approve_timesheets?: boolean | null
          created_at?: string
          default_hourly_rate?: number | null
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
          overtime_exempt?: boolean | null
          phone?: string | null
          requires_timesheet_approval?: boolean | null
          skill_tags?: string[] | null
          updated_at?: string
        }
        Update: {
          active_business_id?: string | null
          active_role?: Database["public"]["Enums"]["app_role"] | null
          avatar_url?: string | null
          business_id?: string | null
          can_approve_timesheets?: boolean | null
          created_at?: string
          default_hourly_rate?: number | null
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
          overtime_exempt?: boolean | null
          phone?: string | null
          requires_timesheet_approval?: boolean | null
          skill_tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_business_id_fkey"
            columns: ["active_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
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
          change_request_notes: string | null
          change_requested_at: string | null
          created_at: string
          customer_id: string
          customer_viewed_at: string | null
          discount_amount: number | null
          embedded_gallery_id: string | null
          id: string
          internal_notes: string | null
          notes: string | null
          public_token: string | null
          quote_number: string
          sent_at: string | null
          show_photos: boolean | null
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
          change_request_notes?: string | null
          change_requested_at?: string | null
          created_at?: string
          customer_id: string
          customer_viewed_at?: string | null
          discount_amount?: number | null
          embedded_gallery_id?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          public_token?: string | null
          quote_number: string
          sent_at?: string | null
          show_photos?: boolean | null
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
          change_request_notes?: string | null
          change_requested_at?: string | null
          created_at?: string
          customer_id?: string
          customer_viewed_at?: string | null
          discount_amount?: number | null
          embedded_gallery_id?: string | null
          id?: string
          internal_notes?: string | null
          notes?: string | null
          public_token?: string | null
          quote_number?: string
          sent_at?: string | null
          show_photos?: boolean | null
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
          {
            foreignKeyName: "quotes_embedded_gallery_id_fkey"
            columns: ["embedded_gallery_id"]
            isOneToOne: false
            referencedRelation: "photo_gallery_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      render_jobs: {
        Row: {
          annotation_id: string
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          next_retry_at: string | null
          priority: number
          started_at: string | null
          status: string
        }
        Insert: {
          annotation_id: string
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          priority?: number
          started_at?: string | null
          status?: string
        }
        Update: {
          annotation_id?: string
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          priority?: number
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "render_jobs_annotation_id_fkey"
            columns: ["annotation_id"]
            isOneToOne: false
            referencedRelation: "media_annotations"
            referencedColumns: ["id"]
          },
        ]
      }
      report_generation_queue: {
        Row: {
          attempts: number | null
          business_id: string
          completed_at: string | null
          created_at: string | null
          error_history: Json | null
          id: string
          last_error: string | null
          lock_expires_at: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number | null
          priority: number | null
          report_id: string
          started_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          business_id: string
          completed_at?: string | null
          created_at?: string | null
          error_history?: Json | null
          id?: string
          last_error?: string | null
          lock_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number | null
          priority?: number | null
          report_id: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          business_id?: string
          completed_at?: string | null
          created_at?: string | null
          error_history?: Json | null
          id?: string
          last_error?: string | null
          lock_expires_at?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number | null
          priority?: number | null
          report_id?: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_generation_queue_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_generation_queue_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "photo_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      review_configs: {
        Row: {
          auto_request_enabled: boolean
          average_rating: number | null
          business_id: string
          cooldown_days: number
          created_at: string
          delay_minutes: number
          detractor_threshold: number
          facebook_page_id: string | null
          facebook_review_url: string | null
          google_place_id: string | null
          google_review_url: string | null
          id: string
          max_reminders: number
          minimum_job_value: number | null
          promoter_threshold: number
          reminder_delay_hours: number
          reminder_enabled: boolean
          request_channel: string
          response_rate: number | null
          send_on_weekends: boolean
          send_window_end: string
          send_window_start: string
          sms_enabled: boolean
          sms_sender_name: string | null
          timezone: string
          total_requests_sent: number
          total_reviews_received: number
          updated_at: string
          yelp_business_id: string | null
          yelp_review_url: string | null
        }
        Insert: {
          auto_request_enabled?: boolean
          average_rating?: number | null
          business_id: string
          cooldown_days?: number
          created_at?: string
          delay_minutes?: number
          detractor_threshold?: number
          facebook_page_id?: string | null
          facebook_review_url?: string | null
          google_place_id?: string | null
          google_review_url?: string | null
          id?: string
          max_reminders?: number
          minimum_job_value?: number | null
          promoter_threshold?: number
          reminder_delay_hours?: number
          reminder_enabled?: boolean
          request_channel?: string
          response_rate?: number | null
          send_on_weekends?: boolean
          send_window_end?: string
          send_window_start?: string
          sms_enabled?: boolean
          sms_sender_name?: string | null
          timezone?: string
          total_requests_sent?: number
          total_reviews_received?: number
          updated_at?: string
          yelp_business_id?: string | null
          yelp_review_url?: string | null
        }
        Update: {
          auto_request_enabled?: boolean
          average_rating?: number | null
          business_id?: string
          cooldown_days?: number
          created_at?: string
          delay_minutes?: number
          detractor_threshold?: number
          facebook_page_id?: string | null
          facebook_review_url?: string | null
          google_place_id?: string | null
          google_review_url?: string | null
          id?: string
          max_reminders?: number
          minimum_job_value?: number | null
          promoter_threshold?: number
          reminder_delay_hours?: number
          reminder_enabled?: boolean
          request_channel?: string
          response_rate?: number | null
          send_on_weekends?: boolean
          send_window_end?: string
          send_window_start?: string
          sms_enabled?: boolean
          sms_sender_name?: string | null
          timezone?: string
          total_requests_sent?: number
          total_reviews_received?: number
          updated_at?: string
          yelp_business_id?: string | null
          yelp_review_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_configs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      review_requests: {
        Row: {
          actual_sent_at: string | null
          assigned_technician_id: string | null
          business_id: string
          channel: string
          clicked_at: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          delivered_at: string | null
          error_message: string | null
          id: string
          job_id: string
          last_reminder_at: string | null
          message_id: string | null
          next_reminder_at: string | null
          opened_at: string | null
          reminder_count: number
          retry_count: number
          review_id: string | null
          scheduled_send_at: string
          status: string
          token: string
          token_expires_at: string
          updated_at: string
        }
        Insert: {
          actual_sent_at?: string | null
          assigned_technician_id?: string | null
          business_id: string
          channel?: string
          clicked_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          job_id: string
          last_reminder_at?: string | null
          message_id?: string | null
          next_reminder_at?: string | null
          opened_at?: string | null
          reminder_count?: number
          retry_count?: number
          review_id?: string | null
          scheduled_send_at: string
          status?: string
          token?: string
          token_expires_at?: string
          updated_at?: string
        }
        Update: {
          actual_sent_at?: string | null
          assigned_technician_id?: string | null
          business_id?: string
          channel?: string
          clicked_at?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          job_id?: string
          last_reminder_at?: string | null
          message_id?: string | null
          next_reminder_at?: string | null
          opened_at?: string | null
          reminder_count?: number
          retry_count?: number
          review_id?: string | null
          scheduled_send_at?: string
          status?: string
          token?: string
          token_expires_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_review_requests_review"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_requests_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          assigned_technician_id: string | null
          business_id: string
          created_at: string
          customer_id: string | null
          display_approved: boolean
          display_name: string | null
          external_review_id: string | null
          external_review_url: string | null
          feedback_key_phrases: Json | null
          feedback_sentiment: string | null
          feedback_text: string | null
          id: string
          is_featured: boolean
          is_public: boolean
          job_id: string | null
          nps_score: number | null
          platform: string | null
          quality_rating: number | null
          rating: number
          responded_at: string | null
          responded_by: string | null
          response_suggested: string | null
          response_text: string | null
          review_request_id: string | null
          source: string
          technician_rating: number | null
          timeliness_rating: number | null
          updated_at: string
          value_rating: number | null
        }
        Insert: {
          assigned_technician_id?: string | null
          business_id: string
          created_at?: string
          customer_id?: string | null
          display_approved?: boolean
          display_name?: string | null
          external_review_id?: string | null
          external_review_url?: string | null
          feedback_key_phrases?: Json | null
          feedback_sentiment?: string | null
          feedback_text?: string | null
          id?: string
          is_featured?: boolean
          is_public?: boolean
          job_id?: string | null
          nps_score?: number | null
          platform?: string | null
          quality_rating?: number | null
          rating: number
          responded_at?: string | null
          responded_by?: string | null
          response_suggested?: string | null
          response_text?: string | null
          review_request_id?: string | null
          source?: string
          technician_rating?: number | null
          timeliness_rating?: number | null
          updated_at?: string
          value_rating?: number | null
        }
        Update: {
          assigned_technician_id?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string | null
          display_approved?: boolean
          display_name?: string | null
          external_review_id?: string | null
          external_review_url?: string | null
          feedback_key_phrases?: Json | null
          feedback_sentiment?: string | null
          feedback_text?: string | null
          id?: string
          is_featured?: boolean
          is_public?: boolean
          job_id?: string | null
          nps_score?: number | null
          platform?: string | null
          quality_rating?: number | null
          rating?: number
          responded_at?: string | null
          responded_by?: string | null
          response_suggested?: string | null
          response_text?: string | null
          review_request_id?: string | null
          source?: string
          technician_rating?: number | null
          timeliness_rating?: number | null
          updated_at?: string
          value_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_assigned_technician_id_fkey"
            columns: ["assigned_technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_responded_by_fkey"
            columns: ["responded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_review_request_id_fkey"
            columns: ["review_request_id"]
            isOneToOne: false
            referencedRelation: "review_requests"
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
      sequence_enrollment_queue: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string
          id: string
          processed_at: string | null
          source_id: string
          source_table: string
          trigger_type: string
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          processed_at?: string | null
          source_id: string
          source_table: string
          trigger_type: string
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          processed_at?: string | null
          source_id?: string
          source_table?: string
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollment_queue_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollment_queue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_enrollments: {
        Row: {
          business_id: string
          completed_at: string | null
          created_at: string
          current_step: number
          customer_id: string
          enrolled_at: string
          exit_reason: string | null
          id: string
          metadata: Json | null
          next_email_at: string | null
          paused_at: string | null
          sequence_id: string
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          created_at?: string
          current_step?: number
          customer_id: string
          enrolled_at?: string
          exit_reason?: string | null
          id?: string
          metadata?: Json | null
          next_email_at?: string | null
          paused_at?: string | null
          sequence_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          created_at?: string
          current_step?: number
          customer_id?: string
          enrolled_at?: string
          exit_reason?: string | null
          id?: string
          metadata?: Json | null
          next_email_at?: string | null
          paused_at?: string | null
          sequence_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_enrollments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequence_steps: {
        Row: {
          body_override_html: string | null
          business_id: string
          created_at: string
          delay_days: number
          delay_hours: number
          id: string
          is_active: boolean | null
          send_conditions: Json | null
          sequence_id: string
          step_order: number
          subject_override: string | null
          template_id: string | null
          total_clicked: number | null
          total_opened: number | null
          total_sent: number | null
          updated_at: string
        }
        Insert: {
          body_override_html?: string | null
          business_id: string
          created_at?: string
          delay_days?: number
          delay_hours?: number
          id?: string
          is_active?: boolean | null
          send_conditions?: Json | null
          sequence_id: string
          step_order: number
          subject_override?: string | null
          template_id?: string | null
          total_clicked?: number | null
          total_opened?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Update: {
          body_override_html?: string | null
          business_id?: string
          created_at?: string
          delay_days?: number
          delay_hours?: number
          id?: string
          is_active?: boolean | null
          send_conditions?: Json | null
          sequence_id?: string
          step_order?: number
          subject_override?: string | null
          template_id?: string | null
          total_clicked?: number | null
          total_opened?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sequence_steps_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sequence_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
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
      technician_review_stats: {
        Row: {
          average_rating: number | null
          business_id: string
          created_at: string
          five_star_count: number
          four_star_count: number
          id: string
          last_review_at: string | null
          mentions_count: number
          one_star_count: number
          profile_id: string
          rank_in_business: number | null
          three_star_count: number
          total_reviews: number
          trend_7d: number | null
          two_star_count: number
          updated_at: string
        }
        Insert: {
          average_rating?: number | null
          business_id: string
          created_at?: string
          five_star_count?: number
          four_star_count?: number
          id?: string
          last_review_at?: string | null
          mentions_count?: number
          one_star_count?: number
          profile_id: string
          rank_in_business?: number | null
          three_star_count?: number
          total_reviews?: number
          trend_7d?: number | null
          two_star_count?: number
          updated_at?: string
        }
        Update: {
          average_rating?: number | null
          business_id?: string
          created_at?: string
          five_star_count?: number
          four_star_count?: number
          id?: string
          last_review_at?: string | null
          mentions_count?: number
          one_star_count?: number
          profile_id?: string
          rank_in_business?: number | null
          three_star_count?: number
          total_reviews?: number
          trend_7d?: number | null
          two_star_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_review_stats_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_review_stats_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          approved_duration_minutes: number | null
          bill_amount: number | null
          break_deduction_minutes: number | null
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
          edited_at: string | null
          edited_by: string | null
          entry_type: string | null
          id: string
          is_billable: boolean | null
          is_manual: boolean | null
          job_id: string
          labor_cost: number | null
          location_accuracy: number | null
          manual_entry_reason: string | null
          notes: string | null
          pay_period_id: string | null
          user_id: string
        }
        Insert: {
          approved_duration_minutes?: number | null
          bill_amount?: number | null
          break_deduction_minutes?: number | null
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
          edited_at?: string | null
          edited_by?: string | null
          entry_type?: string | null
          id?: string
          is_billable?: boolean | null
          is_manual?: boolean | null
          job_id: string
          labor_cost?: number | null
          location_accuracy?: number | null
          manual_entry_reason?: string | null
          notes?: string | null
          pay_period_id?: string | null
          user_id: string
        }
        Update: {
          approved_duration_minutes?: number | null
          bill_amount?: number | null
          break_deduction_minutes?: number | null
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
          edited_at?: string | null
          edited_by?: string | null
          entry_type?: string | null
          id?: string
          is_billable?: boolean | null
          is_manual?: boolean | null
          job_id?: string
          labor_cost?: number | null
          location_accuracy?: number | null
          manual_entry_reason?: string | null
          notes?: string | null
          pay_period_id?: string | null
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
            foreignKeyName: "time_entries_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "time_entries_pay_period_id_fkey"
            columns: ["pay_period_id"]
            isOneToOne: false
            referencedRelation: "pay_periods"
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
      time_entry_edits: {
        Row: {
          business_id: string
          created_at: string
          edit_reason: string
          edited_by: string
          id: string
          new_values: Json
          previous_values: Json
          time_entry_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          edit_reason: string
          edited_by: string
          id?: string
          new_values: Json
          previous_values: Json
          time_entry_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          edit_reason?: string
          edited_by?: string
          id?: string
          new_values?: Json
          previous_values?: Json
          time_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entry_edits_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_edits_edited_by_fkey"
            columns: ["edited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entry_edits_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
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
      timesheet_approvals: {
        Row: {
          anomaly_details: Json | null
          business_id: string
          created_at: string
          double_time_hours: number | null
          has_anomalies: boolean | null
          id: string
          overtime_hours: number | null
          pay_period_id: string
          regular_hours: number | null
          rejection_reason: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string | null
          submitted_notes: string | null
          total_hours: number | null
          total_labor_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anomaly_details?: Json | null
          business_id: string
          created_at?: string
          double_time_hours?: number | null
          has_anomalies?: boolean | null
          id?: string
          overtime_hours?: number | null
          pay_period_id: string
          regular_hours?: number | null
          rejection_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_notes?: string | null
          total_hours?: number | null
          total_labor_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anomaly_details?: Json | null
          business_id?: string
          created_at?: string
          double_time_hours?: number | null
          has_anomalies?: boolean | null
          id?: string
          overtime_hours?: number | null
          pay_period_id?: string
          regular_hours?: number | null
          rejection_reason?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_at?: string | null
          submitted_notes?: string | null
          total_hours?: number | null
          total_labor_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheet_approvals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_approvals_pay_period_id_fkey"
            columns: ["pay_period_id"]
            isOneToOne: false
            referencedRelation: "pay_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_approvals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheet_approvals_user_id_fkey"
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
      upload_rate_limits: {
        Row: {
          count: number | null
          created_at: string | null
          id: string
          identifier: string
          identifier_type: string
          window_start: string | null
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          id?: string
          identifier: string
          identifier_type: string
          window_start?: string | null
        }
        Update: {
          count?: number | null
          created_at?: string | null
          id?: string
          identifier?: string
          identifier_type?: string
          window_start?: string | null
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
      media_search_index: {
        Row: {
          address_summary: string | null
          business_id: string | null
          captured_date: string | null
          category: Database["public"]["Enums"]["media_category"] | null
          created_at: string | null
          customer_id: string | null
          customer_name: string | null
          has_gps: boolean | null
          job_id: string | null
          job_number: string | null
          job_title: string | null
          media_id: string | null
          media_type: string | null
          media_url: string | null
          search_vector: unknown
          tags: string[] | null
          thumbnail_url: string | null
          uploaded_by: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_media_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_media_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_media_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_team_invite: { Args: { _token: string }; Returns: Json }
      acquire_annotation_lock: {
        Args: { p_media_id: string; p_ttl_seconds?: number; p_user_id: string }
        Returns: Json
      }
      calculate_distance_meters: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      calculate_time_entry_labor_cost: {
        Args: { p_entry_id: string }
        Returns: number
      }
      check_duplicate_photo: {
        Args: { p_business_id: string; p_content_hash: string }
        Returns: {
          is_exact_match: boolean
          job_id: string
          media_id: string
          url: string
        }[]
      }
      check_email_duplicate: {
        Args: {
          p_connection_id: string
          p_content_hash: string
          p_from_address: string
          p_thread_id: string
        }
        Returns: {
          duplicate_of_id: string
          is_duplicate: boolean
          reason: string
        }[]
      }
      cleanup_expired_annotation_locks: { Args: never; Returns: number }
      cleanup_expired_gallery_data: {
        Args: never
        Returns: {
          reports_expired: number
          shares_deactivated: number
          views_deleted: number
        }[]
      }
      cleanup_expired_rate_limits: { Args: never; Returns: undefined }
      generate_comparison_share_token: { Args: never; Returns: string }
      generate_secure_share_token: {
        Args: never
        Returns: {
          token: string
          token_hash: string
        }[]
      }
      generate_service_request_number: {
        Args: { bus_id: string }
        Returns: string
      }
      get_customer_account_businesses: {
        Args: { account_id: string }
        Returns: {
          business_id: string
          customer_id: string
          is_primary: boolean
        }[]
      }
      get_photo_facets: {
        Args: { p_business_id: string; p_query?: string }
        Returns: {
          facet_count: number
          facet_type: string
          facet_value: string
        }[]
      }
      get_user_business_id: { Args: never; Returns: string }
      get_user_business_ids: { Args: { p_user_id?: string }; Returns: string[] }
      get_user_role_in_business: {
        Args: { p_business_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_any_role: {
        Args: {
          p_roles: Database["public"]["Enums"]["app_role"][]
          p_user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hash_visitor_identifier: {
        Args: { p_business_id: string; p_identifier: string }
        Returns: string
      }
      increment_gallery_views_atomic:
        | { Args: { p_share_id: string }; Returns: undefined }
        | {
            Args: { p_fingerprint_hash: string; p_share_id: string }
            Returns: boolean
          }
      rebuild_media_search_text: {
        Args: { p_media_id: string }
        Returns: undefined
      }
      refresh_media_search_index: { Args: never; Returns: undefined }
      release_annotation_lock: {
        Args: { p_media_id: string; p_user_id: string }
        Returns: boolean
      }
      release_stale_queue_locks: { Args: never; Returns: number }
      save_annotation_version: {
        Args: { p_annotation_data: Json; p_media_id: string; p_user_id: string }
        Returns: Json
      }
      search_photos: {
        Args: {
          p_business_id: string
          p_categories?: string[]
          p_customer_id?: string
          p_date_from?: string
          p_date_to?: string
          p_has_gps?: boolean
          p_job_id?: string
          p_page?: number
          p_per_page?: number
          p_query?: string
          p_tags?: string[]
        }
        Returns: {
          captured_date: string
          category: string
          customer_id: string
          customer_name: string
          has_gps: boolean
          job_id: string
          job_number: string
          job_title: string
          media_id: string
          media_type: string
          media_url: string
          tags: string[]
          thumbnail_url: string
          total_count: number
        }[]
      }
      set_job_cover_photo: {
        Args: { p_job_id: string; p_media_id: string }
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
      switch_active_business: { Args: { p_business_id: string }; Returns: Json }
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
      validate_portal_session: {
        Args: { session_token: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "technician" | "viewer"
      media_category:
        | "before"
        | "during"
        | "after"
        | "damage"
        | "equipment"
        | "materials"
        | "general"
      media_status: "processing" | "ready" | "failed"
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
      media_category: [
        "before",
        "during",
        "after",
        "damage",
        "equipment",
        "materials",
        "general",
      ],
      media_status: ["processing", "ready", "failed"],
    },
  },
} as const
