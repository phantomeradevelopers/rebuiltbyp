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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accountability_pairs: {
        Row: {
          activated_at: string | null
          created_at: string
          id: string
          initiated_by: string
          last_nudge_at: string | null
          last_nudge_by: string | null
          status: string
          unpaired_at: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          id?: string
          initiated_by: string
          last_nudge_at?: string | null
          last_nudge_by?: string | null
          status?: string
          unpaired_at?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          id?: string
          initiated_by?: string
          last_nudge_at?: string | null
          last_nudge_by?: string | null
          status?: string
          unpaired_at?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      achievements: {
        Row: {
          category: string
          created_at: string
          criteria: Json
          description: string
          hidden: boolean
          icon: string | null
          id: string
          key: string
          min_tier: string
          rarity: string
          sort_order: number
          title: string
          xp: number
        }
        Insert: {
          category: string
          created_at?: string
          criteria?: Json
          description: string
          hidden?: boolean
          icon?: string | null
          id?: string
          key: string
          min_tier?: string
          rarity?: string
          sort_order?: number
          title: string
          xp?: number
        }
        Update: {
          category?: string
          created_at?: string
          criteria?: Json
          description?: string
          hidden?: boolean
          icon?: string | null
          id?: string
          key?: string
          min_tier?: string
          rarity?: string
          sort_order?: number
          title?: string
          xp?: number
        }
        Relationships: []
      }
      admin_messages: {
        Row: {
          body: string
          created_at: string
          cta_label: string | null
          cta_url: string | null
          dismissed_at: string | null
          id: string
          kind: string
          read_at: string | null
          recipient_user_id: string
          sender_user_id: string
          subject: string
        }
        Insert: {
          body: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          dismissed_at?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          recipient_user_id: string
          sender_user_id: string
          subject: string
        }
        Update: {
          body?: string
          created_at?: string
          cta_label?: string | null
          cta_url?: string | null
          dismissed_at?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          recipient_user_id?: string
          sender_user_id?: string
          subject?: string
        }
        Relationships: []
      }
      admin_pin: {
        Row: {
          created_at: string
          failed_attempts: number
          id: number
          locked_until: string | null
          pin_hash: string | null
          salt: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          id?: number
          locked_until?: string | null
          pin_hash?: string | null
          salt?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          id?: number
          locked_until?: string | null
          pin_hash?: string | null
          salt?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_clicks: {
        Row: {
          created_at: string
          id: string
          partner: Database["public"]["Enums"]["affiliate_partner"]
          surface: string
          url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          partner: Database["public"]["Enums"]["affiliate_partner"]
          surface: string
          url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          partner?: Database["public"]["Enums"]["affiliate_partner"]
          surface?: string
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_coach_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_coach_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_coach_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_coach_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      anchor_reflections: {
        Row: {
          anchor_date: string
          created_at: string
          id: string
          mood_after: number | null
          mood_before: number | null
          response: string | null
          user_id: string
        }
        Insert: {
          anchor_date: string
          created_at?: string
          id?: string
          mood_after?: number | null
          mood_before?: number | null
          response?: string | null
          user_id: string
        }
        Update: {
          anchor_date?: string
          created_at?: string
          id?: string
          mood_after?: number | null
          mood_before?: number | null
          response?: string | null
          user_id?: string
        }
        Relationships: []
      }
      billing_consents: {
        Row: {
          consent_text: string
          created_at: string
          id: string
          item_key: string
          user_id: string
        }
        Insert: {
          consent_text: string
          created_at?: string
          id?: string
          item_key: string
          user_id: string
        }
        Update: {
          consent_text?: string
          created_at?: string
          id?: string
          item_key?: string
          user_id?: string
        }
        Relationships: []
      }
      breathing_sessions: {
        Row: {
          completed_at: string
          created_at: string
          duration_seconds: number
          id: string
          pattern: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          duration_seconds: number
          id?: string
          pattern: string
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          duration_seconds?: number
          id?: string
          pattern?: string
          user_id?: string
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          app_version: string | null
          created_at: string
          extra: Json | null
          id: string
          message: string
          route: string | null
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          extra?: Json | null
          id?: string
          message: string
          route?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          extra?: Json | null
          id?: string
          message?: string
          route?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      client_notes: {
        Row: {
          author_user_id: string
          body: string
          client_user_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_user_id: string
          body: string
          client_user_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_user_id?: string
          body?: string
          client_user_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      coach_actions: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          kind: string
          message_id: string | null
          payload: Json
          status: string
          undone_at: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind: string
          message_id?: string | null
          payload?: Json
          status?: string
          undone_at?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          message_id?: string | null
          payload?: Json
          status?: string
          undone_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      coach_usage_daily: {
        Row: {
          created_at: string
          day: string
          message_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: string
          message_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: string
          message_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consult_applications: {
        Row: {
          created_at: string
          extra: string | null
          id: string
          obstacle: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: string
          updated_at: string
          user_id: string
          want: string
          why_now: string
        }
        Insert: {
          created_at?: string
          extra?: string | null
          id?: string
          obstacle: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
          want: string
          why_now: string
        }
        Update: {
          created_at?: string
          extra?: string | null
          id?: string
          obstacle?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          want?: string
          why_now?: string
        }
        Relationships: []
      }
      consult_availability: {
        Row: {
          active: boolean
          created_at: string
          dow: number
          end_time: string
          id: string
          start_time: string
          timezone: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          dow: number
          end_time: string
          id?: string
          start_time: string
          timezone?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dow?: number
          end_time?: string
          id?: string
          start_time?: string
          timezone?: string
        }
        Relationships: []
      }
      consult_blackouts: {
        Row: {
          created_at: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: []
      }
      consult_leads: {
        Row: {
          budget: string
          created_at: string
          email: string
          help: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          budget: string
          created_at?: string
          email: string
          help: string
          id?: string
          name: string
          phone: string
        }
        Update: {
          budget?: string
          created_at?: string
          email?: string
          help?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      consult_seats: {
        Row: {
          application_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          slot_dow: number | null
          slot_time: string | null
          started_at: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
          zoom_link_override: string | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          slot_dow?: number | null
          slot_time?: string | null
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
          zoom_link_override?: string | null
        }
        Update: {
          application_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          slot_dow?: number | null
          slot_time?: string | null
          started_at?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
          zoom_link_override?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consult_seats_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "consult_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      consult_sessions: {
        Row: {
          action_items: Json
          brief_generated_at: string | null
          brief_json: Json | null
          completed_at: string | null
          created_at: string
          duration_minutes: number
          id: string
          joined_at: string | null
          p_notes: string | null
          scheduled_at: string
          seat_id: string
          status: string
          updated_at: string
          user_id: string
          video_link: string | null
          voice_note_url: string | null
        }
        Insert: {
          action_items?: Json
          brief_generated_at?: string | null
          brief_json?: Json | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          joined_at?: string | null
          p_notes?: string | null
          scheduled_at: string
          seat_id: string
          status?: string
          updated_at?: string
          user_id: string
          video_link?: string | null
          voice_note_url?: string | null
        }
        Update: {
          action_items?: Json
          brief_generated_at?: string | null
          brief_json?: Json | null
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          joined_at?: string | null
          p_notes?: string | null
          scheduled_at?: string
          seat_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          video_link?: string | null
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consult_sessions_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "consult_seats"
            referencedColumns: ["id"]
          },
        ]
      }
      consult_subscription: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          plan_price_cents: number
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_price_cents?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan_price_cents?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      consult_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      course_modules: {
        Row: {
          created_at: string
          id: string
          published: boolean
          slug: string
          sort_order: number
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          published?: boolean
          slug: string
          sort_order?: number
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          published?: boolean
          slug?: string
          sort_order?: number
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      course_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          module_slug: string
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module_slug: string
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          module_slug?: string
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      course_purchases: {
        Row: {
          amount_cents: number
          email: string
          installments_paid: number
          order_id: string | null
          plan: string
          purchased_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number
          email: string
          installments_paid?: number
          order_id?: string | null
          plan?: string
          purchased_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          email?: string
          installments_paid?: number
          order_id?: string | null
          plan?: string
          purchased_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      daily_affirmations: {
        Row: {
          category: string | null
          content: string
          id: number
        }
        Insert: {
          category?: string | null
          content: string
          id?: number
        }
        Update: {
          category?: string | null
          content?: string
          id?: number
        }
        Relationships: []
      }
      daily_anchors: {
        Row: {
          anchor_date: string
          breath_protocol: string
          created_at: string
          id: string
          reflection_prompt: string
          theme: string
          tradition: string
          verse_ref: string | null
          verse_text: string
        }
        Insert: {
          anchor_date: string
          breath_protocol?: string
          created_at?: string
          id?: string
          reflection_prompt: string
          theme: string
          tradition?: string
          verse_ref?: string | null
          verse_text: string
        }
        Update: {
          anchor_date?: string
          breath_protocol?: string
          created_at?: string
          id?: string
          reflection_prompt?: string
          theme?: string
          tradition?: string
          verse_ref?: string | null
          verse_text?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          created_at: string
          date: string
          energy: number | null
          id: string
          mood: number | null
          notes: string | null
          sleep_hours: number | null
          stress: number | null
          user_id: string
          workout_completed: boolean | null
        }
        Insert: {
          created_at?: string
          date: string
          energy?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          stress?: number | null
          user_id: string
          workout_completed?: boolean | null
        }
        Update: {
          created_at?: string
          date?: string
          energy?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          stress?: number | null
          user_id?: string
          workout_completed?: boolean | null
        }
        Relationships: []
      }
      daily_lessons: {
        Row: {
          content: string
          id: number
          module_tie: string | null
          title: string
        }
        Insert: {
          content: string
          id?: number
          module_tie?: string | null
          title: string
        }
        Update: {
          content?: string
          id?: number
          module_tie?: string | null
          title?: string
        }
        Relationships: []
      }
      daily_quotes: {
        Row: {
          content: string
          context: string | null
          id: number
        }
        Insert: {
          content: string
          context?: string | null
          id?: number
        }
        Update: {
          content?: string
          context?: string | null
          id?: number
        }
        Relationships: []
      }
      daily_training_mode: {
        Row: {
          category: string
          created_at: string
          date: string
          equipment: string[]
          id: string
          modality: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          date: string
          equipment?: string[]
          id?: string
          modality: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          date?: string
          equipment?: string[]
          id?: string
          modality?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      demo_snapshots: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          payload: Json
          source_user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          id?: string
          payload: Json
          source_user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          payload?: Json
          source_user_id?: string
        }
        Relationships: []
      }
      email_campaign_sends: {
        Row: {
          campaign: string
          id: string
          meta: Json | null
          recipient_email: string
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          campaign: string
          id?: string
          meta?: Json | null
          recipient_email: string
          sent_at?: string
          status?: string
          user_id: string
        }
        Update: {
          campaign?: string
          id?: string
          meta?: Json | null
          recipient_email?: string
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      exercise_videos: {
        Row: {
          channel: string | null
          id: string
          normalized_name: string
          resolved_at: string
          score: number | null
          thumbnail_url: string | null
          title: string | null
          video_id: string
          view_count: number | null
        }
        Insert: {
          channel?: string | null
          id?: string
          normalized_name: string
          resolved_at?: string
          score?: number | null
          thumbnail_url?: string | null
          title?: string | null
          video_id: string
          view_count?: number | null
        }
        Update: {
          channel?: string | null
          id?: string
          normalized_name?: string
          resolved_at?: string
          score?: number | null
          thumbnail_url?: string | null
          title?: string | null
          video_id?: string
          view_count?: number | null
        }
        Relationships: []
      }
      food_log: {
        Row: {
          calories: number
          carbs_g: number
          date: string
          fat_g: number
          id: string
          logged_at: string
          meal: string
          meal_id: string | null
          name: string
          notes: string | null
          photo_path: string | null
          protein_g: number
          source: string
          user_id: string
        }
        Insert: {
          calories?: number
          carbs_g?: number
          date?: string
          fat_g?: number
          id?: string
          logged_at?: string
          meal: string
          meal_id?: string | null
          name: string
          notes?: string | null
          photo_path?: string | null
          protein_g?: number
          source?: string
          user_id: string
        }
        Update: {
          calories?: number
          carbs_g?: number
          date?: string
          fat_g?: number
          id?: string
          logged_at?: string
          meal?: string
          meal_id?: string | null
          name?: string
          notes?: string | null
          photo_path?: string | null
          protein_g?: number
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_log_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_lookup_cache: {
        Row: {
          cache_key: string
          fetched_at: string
          id: string
          result: Json
        }
        Insert: {
          cache_key: string
          fetched_at?: string
          id?: string
          result: Json
        }
        Update: {
          cache_key?: string
          fetched_at?: string
          id?: string
          result?: Json
        }
        Relationships: []
      }
      gym_visits: {
        Row: {
          created_at: string
          entered_at: string
          gym_id: string | null
          id: string
          lat: number | null
          left_at: string | null
          lng: number | null
          notification_sent: Json
          source: string
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          entered_at?: string
          gym_id?: string | null
          id?: string
          lat?: number | null
          left_at?: string | null
          lng?: number | null
          notification_sent?: Json
          source?: string
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          entered_at?: string
          gym_id?: string | null
          id?: string
          lat?: number | null
          left_at?: string | null
          lng?: number | null
          notification_sent?: Json
          source?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "gym_visits_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          created_at: string
          formatted_address: string | null
          google_place_id: string
          id: string
          lat: number
          lng: number
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          formatted_address?: string | null
          google_place_id: string
          id?: string
          lat: number
          lng: number
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          formatted_address?: string | null
          google_place_id?: string
          id?: string
          lat?: number
          lng?: number
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      health_samples: {
        Row: {
          created_at: string
          id: string
          metric: string
          recorded_at: string
          source: string
          unit: string | null
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric: string
          recorded_at: string
          source: string
          unit?: string | null
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string
          recorded_at?: string
          source?: string
          unit?: string | null
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      identity_checkins: {
        Row: {
          completed_at: string | null
          contract_id: string
          created_at: string
          due_date: string
          evidence: string | null
          id: string
          milestone_month: number
          recommit: string | null
          score: number | null
          still_him: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          contract_id: string
          created_at?: string
          due_date: string
          evidence?: string | null
          id?: string
          milestone_month: number
          recommit?: string | null
          score?: number | null
          still_him?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          contract_id?: string
          created_at?: string
          due_date?: string
          evidence?: string | null
          id?: string
          milestone_month?: number
          recommit?: string | null
          score?: number | null
          still_him?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_checkins_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "identity_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_contracts: {
        Row: {
          archived: boolean
          id: string
          signature_data_url: string | null
          signed_at: string
          statement: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          id?: string
          signature_data_url?: string | null
          signed_at?: string
          statement: string
          user_id: string
        }
        Update: {
          archived?: boolean
          id?: string
          signature_data_url?: string | null
          signed_at?: string
          statement?: string
          user_id?: string
        }
        Relationships: []
      }
      journal_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          is_read: boolean
          journal_id: string
          recommend_breathing: boolean
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          journal_id: string
          recommend_breathing?: boolean
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          journal_id?: string
          recommend_breathing?: boolean
          user_id?: string
        }
        Relationships: []
      }
      labs_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          document: string
          id: string
          user_agent: string | null
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          document: string
          id?: string
          user_agent?: string | null
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          document?: string
          id?: string
          user_agent?: string | null
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      meal_completions: {
        Row: {
          completed_at: string
          date: string
          day: number
          id: string
          slot: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          date?: string
          day: number
          id?: string
          slot: string
          user_id: string
        }
        Update: {
          completed_at?: string
          date?: string
          day?: number
          id?: string
          slot?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_image_cache: {
        Row: {
          created_at: string
          id: string
          image_url: string
          meal_name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          meal_name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          meal_name?: string
          slug?: string
        }
        Relationships: []
      }
      meal_overrides: {
        Row: {
          created_at: string
          day: number
          id: string
          meal: Json
          slot: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day: number
          id?: string
          meal: Json
          slot: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: number
          id?: string
          meal?: Json
          slot?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_reminder_profile: {
        Row: {
          created_at: string
          eating_pattern: string
          id: string
          last_analyzed_at: string | null
          missed_slots_7d: Json
          quiet_hours: Json
          reminders_enabled: boolean
          typical_times: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          eating_pattern?: string
          id?: string
          last_analyzed_at?: string | null
          missed_slots_7d?: Json
          quiet_hours?: Json
          reminders_enabled?: boolean
          typical_times?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          eating_pattern?: string
          id?: string
          last_analyzed_at?: string | null
          missed_slots_7d?: Json
          quiet_hours?: Json
          reminders_enabled?: boolean
          typical_times?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          active: boolean
          brand: string | null
          carbs_g: number
          created_at: string
          dietary_tags: string[]
          fat_g: number
          id: string
          image_path: string | null
          ingredients: Json
          kcal: number
          prep_minutes: number
          protein_g: number
          seed_key: string | null
          slot: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          brand?: string | null
          carbs_g?: number
          created_at?: string
          dietary_tags?: string[]
          fat_g?: number
          id?: string
          image_path?: string | null
          ingredients?: Json
          kcal?: number
          prep_minutes?: number
          protein_g?: number
          seed_key?: string | null
          slot: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          brand?: string | null
          carbs_g?: number
          created_at?: string
          dietary_tags?: string[]
          fat_g?: number
          id?: string
          image_path?: string | null
          ingredients?: Json
          kcal?: number
          prep_minutes?: number
          protein_g?: number
          seed_key?: string | null
          slot?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      medication_catalog: {
        Row: {
          brand_name: string
          category: string
          created_at: string
          default_unit: string
          generic_name: string | null
          guidance_text: string | null
          id: string
          slug: string
          sort_order: number
          source: string
          typical_route: string
        }
        Insert: {
          brand_name: string
          category: string
          created_at?: string
          default_unit?: string
          generic_name?: string | null
          guidance_text?: string | null
          id?: string
          slug: string
          sort_order?: number
          source?: string
          typical_route?: string
        }
        Update: {
          brand_name?: string
          category?: string
          created_at?: string
          default_unit?: string
          generic_name?: string | null
          guidance_text?: string | null
          id?: string
          slug?: string
          sort_order?: number
          source?: string
          typical_route?: string
        }
        Relationships: []
      }
      medication_dose_notifications: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          scheduled_at: string
          sent_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          scheduled_at: string
          sent_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          scheduled_at?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_dose_notifications_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "user_medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_doses: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          notes: string | null
          scheduled_at: string
          status: string
          taken_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          notes?: string | null
          scheduled_at: string
          status?: string
          taken_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          notes?: string | null
          scheduled_at?: string
          status?: string
          taken_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_doses_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "user_medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_shipments: {
        Row: {
          carrier: string
          created_at: string
          estimated_delivery: string | null
          id: string
          last_event_at: string | null
          last_event_description: string | null
          last_polled_at: string | null
          medication_id: string | null
          notify_on_status: Json
          provider: string
          provider_tracker_id: string | null
          status: string
          tracking_number: string
          updated_at: string
          user_id: string
        }
        Insert: {
          carrier: string
          created_at?: string
          estimated_delivery?: string | null
          id?: string
          last_event_at?: string | null
          last_event_description?: string | null
          last_polled_at?: string | null
          medication_id?: string | null
          notify_on_status?: Json
          provider?: string
          provider_tracker_id?: string | null
          status?: string
          tracking_number: string
          updated_at?: string
          user_id: string
        }
        Update: {
          carrier?: string
          created_at?: string
          estimated_delivery?: string | null
          id?: string
          last_event_at?: string | null
          last_event_description?: string | null
          last_polled_at?: string | null
          medication_id?: string | null
          notify_on_status?: Json
          provider?: string
          provider_tracker_id?: string | null
          status?: string
          tracking_number?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_shipments_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "user_medications"
            referencedColumns: ["id"]
          },
        ]
      }
      member_perk_codes: {
        Row: {
          code: string
          discount_percent: number
          id: string
          issued_at: string
          partner: string
          revoked_at: string | null
          status: string
          tier_required: string
          user_id: string
        }
        Insert: {
          code: string
          discount_percent: number
          id?: string
          issued_at?: string
          partner: string
          revoked_at?: string | null
          status?: string
          tier_required: string
          user_id: string
        }
        Update: {
          code?: string
          discount_percent?: number
          id?: string
          issued_at?: string
          partner?: string
          revoked_at?: string | null
          status?: string
          tier_required?: string
          user_id?: string
        }
        Relationships: []
      }
      mindset_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          date: string
          id: string
          prompt_text: string
          rep_type: string
          state: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          date: string
          id?: string
          prompt_text: string
          rep_type: string
          state: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          date?: string
          id?: string
          prompt_text?: string
          rep_type?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_queue: {
        Row: {
          body: string
          channel: string
          created_at: string
          error_message: string | null
          id: string
          read_at: string | null
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string | null
          type: string
          user_id: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          error_message?: string | null
          id?: string
          read_at?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          type: string
          user_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          error_message?: string | null
          id?: string
          read_at?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      nutrition_foods: {
        Row: {
          best_use: string
          carbs_g: number
          category: string
          created_at: string
          fat_g: number
          fiber_g: number
          id: string
          kcal_per_100g: number
          name: string
          protein_g: number
          slug: string
          swaps: string | null
          tags: string[]
          why_it_matters: string
        }
        Insert: {
          best_use: string
          carbs_g: number
          category: string
          created_at?: string
          fat_g: number
          fiber_g?: number
          id?: string
          kcal_per_100g: number
          name: string
          protein_g: number
          slug: string
          swaps?: string | null
          tags?: string[]
          why_it_matters: string
        }
        Update: {
          best_use?: string
          carbs_g?: number
          category?: string
          created_at?: string
          fat_g?: number
          fiber_g?: number
          id?: string
          kcal_per_100g?: number
          name?: string
          protein_g?: number
          slug?: string
          swaps?: string | null
          tags?: string[]
          why_it_matters?: string
        }
        Relationships: []
      }
      nutrition_lessons: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          read_minutes: number
          slug: string
          sort_order: number
          summary: string
          title: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          read_minutes?: number
          slug: string
          sort_order?: number
          summary: string
          title: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          read_minutes?: number
          slug?: string
          sort_order?: number
          summary?: string
          title?: string
        }
        Relationships: []
      }
      nutrition_suggestions: {
        Row: {
          body: string
          category: string | null
          created_at: string
          dismissed_at: string | null
          id: string
          kind: string
          macros: Json | null
          menu_item: string | null
          order_lines: string[] | null
          rationale: string | null
          saved: boolean
          store_or_brand: string | null
          title: string
          user_id: string
          why: string | null
        }
        Insert: {
          body: string
          category?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          kind: string
          macros?: Json | null
          menu_item?: string | null
          order_lines?: string[] | null
          rationale?: string | null
          saved?: boolean
          store_or_brand?: string | null
          title: string
          user_id: string
          why?: string | null
        }
        Update: {
          body?: string
          category?: string | null
          created_at?: string
          dismissed_at?: string | null
          id?: string
          kind?: string
          macros?: Json | null
          menu_item?: string | null
          order_lines?: string[] | null
          rationale?: string | null
          saved?: boolean
          store_or_brand?: string | null
          title?: string
          user_id?: string
          why?: string | null
        }
        Relationships: []
      }
      oauth_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          expires_at: string
          provider: string
          return_to: string | null
          state: string
          user_id: string
        }
        Insert: {
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          provider: string
          return_to?: string | null
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          provider?: string
          return_to?: string | null
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      outdoor_routes: {
        Row: {
          candidates: Json
          created_at: string
          distance_m: number
          duration_s: number
          elevation_gain_m: number
          generated_for_date: string
          id: string
          origin_lat: number
          origin_lng: number
          polyline: string
          steps: Json | null
          target_distance_m: number
          user_id: string
          waypoints: Json
        }
        Insert: {
          candidates?: Json
          created_at?: string
          distance_m: number
          duration_s: number
          elevation_gain_m?: number
          generated_for_date: string
          id?: string
          origin_lat: number
          origin_lng: number
          polyline: string
          steps?: Json | null
          target_distance_m: number
          user_id: string
          waypoints?: Json
        }
        Update: {
          candidates?: Json
          created_at?: string
          distance_m?: number
          duration_s?: number
          elevation_gain_m?: number
          generated_for_date?: string
          id?: string
          origin_lat?: number
          origin_lng?: number
          polyline?: string
          steps?: Json | null
          target_distance_m?: number
          user_id?: string
          waypoints?: Json
        }
        Relationships: []
      }
      outdoor_sessions: {
        Row: {
          avg_pace_seconds_per_km: number | null
          created_at: string
          distance_meters: number
          duration_seconds: number
          ended_at: string
          id: string
          route_id: string | null
          started_at: string
          track: Json
          user_id: string
        }
        Insert: {
          avg_pace_seconds_per_km?: number | null
          created_at?: string
          distance_meters?: number
          duration_seconds?: number
          ended_at: string
          id?: string
          route_id?: string | null
          started_at: string
          track?: Json
          user_id: string
        }
        Update: {
          avg_pace_seconds_per_km?: number | null
          created_at?: string
          distance_meters?: number
          duration_seconds?: number
          ended_at?: string
          id?: string
          route_id?: string | null
          started_at?: string
          track?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outdoor_sessions_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "outdoor_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_perk_config: {
        Row: {
          discount_percent: number
          enabled: boolean
          partner: string
          tier_required: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          discount_percent?: number
          enabled?: boolean
          partner: string
          tier_required?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          discount_percent?: number
          enabled?: boolean
          partner?: string
          tier_required?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount_cents: number
          billing_kind: string
          created_at: string
          currency: string
          email: string | null
          environment: string
          id: string
          occurred_at: string
          price_id: string | null
          product_key: string | null
          provider: string
          provider_txn_id: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number
          billing_kind?: string
          created_at?: string
          currency?: string
          email?: string | null
          environment?: string
          id?: string
          occurred_at?: string
          price_id?: string | null
          product_key?: string | null
          provider?: string
          provider_txn_id?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          billing_kind?: string
          created_at?: string
          currency?: string
          email?: string | null
          environment?: string
          id?: string
          occurred_at?: string
          price_id?: string | null
          product_key?: string | null
          provider?: string
          provider_txn_id?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      plan_refinements: {
        Row: {
          ai_response: Json | null
          changes: Json
          created_at: string
          id: string
          phase_number: number
          plan_type: string
          user_id: string
          week_number: number | null
        }
        Insert: {
          ai_response?: Json | null
          changes?: Json
          created_at?: string
          id?: string
          phase_number?: number
          plan_type: string
          user_id: string
          week_number?: number | null
        }
        Update: {
          ai_response?: Json | null
          changes?: Json
          created_at?: string
          id?: string
          phase_number?: number
          plan_type?: string
          user_id?: string
          week_number?: number | null
        }
        Relationships: []
      }
      progress_photos: {
        Row: {
          id: string
          logged_at: string
          photo_url: string
          user_id: string
          view_type: string | null
        }
        Insert: {
          id?: string
          logged_at?: string
          photo_url: string
          user_id: string
          view_type?: string | null
        }
        Update: {
          id?: string
          logged_at?: string
          photo_url?: string
          user_id?: string
          view_type?: string | null
        }
        Relationships: []
      }
      public_reviews: {
        Row: {
          approved_at: string | null
          city: string | null
          consent: boolean
          created_at: string
          display_name: string
          id: string
          quote: string
          rating: number
          status: string
          submitted_by: string | null
          submitted_ip: string | null
          track: string
        }
        Insert: {
          approved_at?: string | null
          city?: string | null
          consent?: boolean
          created_at?: string
          display_name: string
          id?: string
          quote: string
          rating: number
          status?: string
          submitted_by?: string | null
          submitted_ip?: string | null
          track?: string
        }
        Update: {
          approved_at?: string | null
          city?: string | null
          consent?: boolean
          created_at?: string
          display_name?: string
          id?: string
          quote?: string
          rating?: number
          status?: string
          submitted_by?: string | null
          submitted_ip?: string | null
          track?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          enabled: boolean
          endpoint: string
          id: string
          last_seen_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          enabled?: boolean
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      qa_login_attempts: {
        Row: {
          attempts: number
          ip: string
          locked_until: string | null
          window_start: string
        }
        Insert: {
          attempts?: number
          ip: string
          locked_until?: string | null
          window_start?: string
        }
        Update: {
          attempts?: number
          ip?: string
          locked_until?: string | null
          window_start?: string
        }
        Relationships: []
      }
      readiness_checkins: {
        Row: {
          created_at: string
          day_date: string
          energy: number | null
          hrv_ms: number | null
          id: string
          mood: number | null
          resting_hr: number | null
          score: number | null
          sleep_hours: number | null
          sleep_quality: number | null
          soreness: number | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_date: string
          energy?: number | null
          hrv_ms?: number | null
          id?: string
          mood?: number | null
          resting_hr?: number | null
          score?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          soreness?: number | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_date?: string
          energy?: number | null
          hrv_ms?: number | null
          id?: string
          mood?: number | null
          resting_hr?: number | null
          score?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          soreness?: number | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      redemption_codes: {
        Row: {
          code: string
          created_at: string
          entitlement_to_grant: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          entitlement_to_grant: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          entitlement_to_grant?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      reengagement_log: {
        Row: {
          id: string
          kind: string
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          kind: string
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          kind?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_reward_config: {
        Row: {
          activity_threshold_checkins: number
          enabled: boolean
          freeze_referred: number
          freeze_referrer: number
          id: number
          reps_referred: number
          reps_referrer: number
          updated_at: string
        }
        Insert: {
          activity_threshold_checkins?: number
          enabled?: boolean
          freeze_referred?: number
          freeze_referrer?: number
          id?: number
          reps_referred?: number
          reps_referrer?: number
          updated_at?: string
        }
        Update: {
          activity_threshold_checkins?: number
          enabled?: boolean
          freeze_referred?: number
          freeze_referrer?: number
          id?: number
          reps_referred?: number
          reps_referrer?: number
          updated_at?: string
        }
        Relationships: []
      }
      referral_rewards_claims: {
        Row: {
          claimed_at: string
          freeze_referred: number
          freeze_referrer: number
          id: string
          referred_user_id: string
          referrer_user_id: string
          reps_referred: number
          reps_referrer: number
        }
        Insert: {
          claimed_at?: string
          freeze_referred?: number
          freeze_referrer?: number
          id?: string
          referred_user_id: string
          referrer_user_id: string
          reps_referred?: number
          reps_referrer?: number
        }
        Update: {
          claimed_at?: string
          freeze_referred?: number
          freeze_referrer?: number
          id?: string
          referred_user_id?: string
          referrer_user_id?: string
          reps_referred?: number
          reps_referrer?: number
        }
        Relationships: []
      }
      safety_events: {
        Row: {
          acknowledged_at: string | null
          created_at: string
          excerpt: string | null
          id: string
          matched_terms: string[]
          severity: string
          source: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          matched_terms?: string[]
          severity?: string
          source: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          matched_terms?: string[]
          severity?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_hikes: {
        Row: {
          id: string
          name: string
          place_id: string
          saved_at: string
          snapshot: Json
          user_id: string
        }
        Insert: {
          id?: string
          name: string
          place_id: string
          saved_at?: string
          snapshot?: Json
          user_id: string
        }
        Update: {
          id?: string
          name?: string
          place_id?: string
          saved_at?: string
          snapshot?: Json
          user_id?: string
        }
        Relationships: []
      }
      sms_opt_outs: {
        Row: {
          id: string
          opted_out_at: string
          phone_e164: string
        }
        Insert: {
          id?: string
          opted_out_at?: string
          phone_e164: string
        }
        Update: {
          id?: string
          opted_out_at?: string
          phone_e164?: string
        }
        Relationships: []
      }
      streak_events: {
        Row: {
          created_at: string
          day_local: string
          from_count: number
          id: string
          kind: string
          metadata: Json
          reason: string
          source_key: string
          to_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          day_local: string
          from_count: number
          id?: string
          kind: string
          metadata?: Json
          reason: string
          source_key: string
          to_count: number
          user_id: string
        }
        Update: {
          created_at?: string
          day_local?: string
          from_count?: number
          id?: string
          kind?: string
          metadata?: Json
          reason?: string
          source_key?: string
          to_count?: number
          user_id?: string
        }
        Relationships: []
      }
      streak_savers: {
        Row: {
          balance: number
          earned_total: number
          kind: string
          updated_at: string
          used_total: number
          user_id: string
        }
        Insert: {
          balance?: number
          earned_total?: number
          kind: string
          updated_at?: string
          used_total?: number
          user_id: string
        }
        Update: {
          balance?: number
          earned_total?: number
          kind?: string
          updated_at?: string
          used_total?: number
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          email: string | null
          id: string
          name: string | null
          read_at: string | null
          source: string
          subject: string | null
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          read_at?: string | null
          source?: string
          subject?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          read_at?: string | null
          source?: string
          subject?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_key: string
          id: string
          progress: Json
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_key: string
          id?: string
          progress?: Json
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_key?: string
          id?: string
          progress?: Json
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_content_history: {
        Row: {
          content_id: number
          content_type: string
          delivered_at: string
          id: string
          user_id: string
        }
        Insert: {
          content_id: number
          content_type: string
          delivered_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content_id?: number
          content_type?: string
          delivered_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_food_bookmarks: {
        Row: {
          created_at: string
          food_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          food_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          food_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_food_bookmarks_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "nutrition_foods"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gyms: {
        Row: {
          created_at: string
          gym_id: string
          id: string
          is_primary: boolean
          nickname: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          gym_id: string
          id?: string
          is_primary?: boolean
          nickname?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          gym_id?: string
          id?: string
          is_primary?: boolean
          nickname?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_gyms_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      user_medications: {
        Row: {
          active: boolean
          auto_decrement: boolean
          catalog_id: string | null
          created_at: string
          display_name: string
          dose_amount: number | null
          dose_unit: string | null
          end_date: string | null
          id: string
          low_supply_threshold: number
          notes: string | null
          route: string | null
          rx_acknowledged_at: string | null
          schedule_config: Json
          schedule_type: string
          source_tag: string
          start_date: string
          supply_remaining: number | null
          supply_unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          auto_decrement?: boolean
          catalog_id?: string | null
          created_at?: string
          display_name: string
          dose_amount?: number | null
          dose_unit?: string | null
          end_date?: string | null
          id?: string
          low_supply_threshold?: number
          notes?: string | null
          route?: string | null
          rx_acknowledged_at?: string | null
          schedule_config?: Json
          schedule_type?: string
          source_tag?: string
          start_date?: string
          supply_remaining?: number | null
          supply_unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          auto_decrement?: boolean
          catalog_id?: string | null
          created_at?: string
          display_name?: string
          dose_amount?: number | null
          dose_unit?: string | null
          end_date?: string | null
          id?: string
          low_supply_threshold?: number
          notes?: string | null
          route?: string | null
          rx_acknowledged_at?: string | null
          schedule_config?: Json
          schedule_type?: string
          source_tag?: string
          start_date?: string
          supply_remaining?: number | null
          supply_unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_medications_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "medication_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plans: {
        Row: {
          active: boolean
          generated_at: string
          id: string
          phase_end_date: string | null
          phase_number: number
          phase_start_date: string | null
          plan_data: Json
          plan_type: string
          user_id: string
        }
        Insert: {
          active?: boolean
          generated_at?: string
          id?: string
          phase_end_date?: string | null
          phase_number?: number
          phase_start_date?: string | null
          plan_data: Json
          plan_type: string
          user_id: string
        }
        Update: {
          active?: boolean
          generated_at?: string
          id?: string
          phase_end_date?: string | null
          phase_number?: number
          phase_start_date?: string | null
          plan_data?: Json
          plan_type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profile: {
        Row: {
          activity_notes: string | null
          age: number | null
          alcohol_per_week: number | null
          allergies: Json
          caffeine_per_day: number | null
          cardio_preference: string | null
          coach_voice: string
          connected_apps_interest: string[]
          cooking_minutes_per_day: number | null
          cooking_skill: string | null
          cooking_willingness: number | null
          country_code: string | null
          created_at: string
          daily_motivation_enabled: boolean
          dietary_pattern: string | null
          dog_count: number
          earned_badges: Json
          email: string
          entitlement: string
          entitlement_granted_at: string | null
          entitlement_source: string | null
          equipment_access: string | null
          faith_mode_enabled: boolean
          first_name: string | null
          foods_avoided: string | null
          foods_liked: string | null
          gender: string | null
          goal_progress_summary: Json | null
          goal_weight_kg: number | null
          goals: Json
          grocery_stores: Json
          has_dog: boolean
          height_cm: number | null
          home_geocoded_at: string | null
          home_lat: number | null
          home_lng: number | null
          injuries: string | null
          is_demo: boolean
          legal_consent_at: string | null
          location: Json
          meal_reminders_enabled: boolean
          medications: string | null
          mindset_intensity: string
          mood_today: number | null
          morning_delivery: string
          nature_preference: string | null
          notification_email: boolean
          notification_push: boolean
          notification_sms: boolean
          notify_medications: boolean
          onboarding_completed_at: string | null
          organic_preference: string | null
          outdoor_activity: string | null
          outdoor_difficulty: string | null
          outdoor_loop_shape: string | null
          peptide_status: string | null
          phone_e164: string | null
          physique_focus: Json
          preferred_activities: Json
          preferred_training_days: Json
          rebuilt_access: boolean
          rebuilt_start_date: string | null
          referral_code: string | null
          referred_by: string | null
          reminder_frequency: string
          reminder_time_evening_local: string
          reminder_time_local: string
          reminder_time_midday_local: string
          restaurants: Json
          screener_conditions: Json
          screener_passed: boolean | null
          session_minutes: number | null
          sleep_hours: number | null
          sms_consent_at: string | null
          staple_seasonings: Json
          stress_level: number | null
          stripe_customer_id: string | null
          subscription_plan: string | null
          subscription_status: string | null
          success_metric: Json | null
          sweet_tooth: number | null
          taste_profile: Json
          tier: string
          tier_granted_at: string | null
          tier_source: string | null
          timezone: string
          top_drain: string | null
          track: string
          tradition: string
          training_days_per_week: number | null
          training_experience: string | null
          training_years: number | null
          treadmill_access: string | null
          trial_ends_at: string | null
          trial_reminder_sent_at: string | null
          trial_started_at: string | null
          tribe_label: string | null
          unit_system: string
          updated_at: string
          user_id: string
          vacation_note: string | null
          vacation_reason: string[]
          vacation_started_at: string | null
          vacation_until: string | null
          weight_kg: number | null
          welcome_email_sent_at: string | null
          work_geocoded_at: string | null
          work_label: string | null
          work_lat: number | null
          work_lng: number | null
          workout_style_preference: string | null
        }
        Insert: {
          activity_notes?: string | null
          age?: number | null
          alcohol_per_week?: number | null
          allergies?: Json
          caffeine_per_day?: number | null
          cardio_preference?: string | null
          coach_voice?: string
          connected_apps_interest?: string[]
          cooking_minutes_per_day?: number | null
          cooking_skill?: string | null
          cooking_willingness?: number | null
          country_code?: string | null
          created_at?: string
          daily_motivation_enabled?: boolean
          dietary_pattern?: string | null
          dog_count?: number
          earned_badges?: Json
          email: string
          entitlement?: string
          entitlement_granted_at?: string | null
          entitlement_source?: string | null
          equipment_access?: string | null
          faith_mode_enabled?: boolean
          first_name?: string | null
          foods_avoided?: string | null
          foods_liked?: string | null
          gender?: string | null
          goal_progress_summary?: Json | null
          goal_weight_kg?: number | null
          goals?: Json
          grocery_stores?: Json
          has_dog?: boolean
          height_cm?: number | null
          home_geocoded_at?: string | null
          home_lat?: number | null
          home_lng?: number | null
          injuries?: string | null
          is_demo?: boolean
          legal_consent_at?: string | null
          location?: Json
          meal_reminders_enabled?: boolean
          medications?: string | null
          mindset_intensity?: string
          mood_today?: number | null
          morning_delivery?: string
          nature_preference?: string | null
          notification_email?: boolean
          notification_push?: boolean
          notification_sms?: boolean
          notify_medications?: boolean
          onboarding_completed_at?: string | null
          organic_preference?: string | null
          outdoor_activity?: string | null
          outdoor_difficulty?: string | null
          outdoor_loop_shape?: string | null
          peptide_status?: string | null
          phone_e164?: string | null
          physique_focus?: Json
          preferred_activities?: Json
          preferred_training_days?: Json
          rebuilt_access?: boolean
          rebuilt_start_date?: string | null
          referral_code?: string | null
          referred_by?: string | null
          reminder_frequency?: string
          reminder_time_evening_local?: string
          reminder_time_local?: string
          reminder_time_midday_local?: string
          restaurants?: Json
          screener_conditions?: Json
          screener_passed?: boolean | null
          session_minutes?: number | null
          sleep_hours?: number | null
          sms_consent_at?: string | null
          staple_seasonings?: Json
          stress_level?: number | null
          stripe_customer_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          success_metric?: Json | null
          sweet_tooth?: number | null
          taste_profile?: Json
          tier?: string
          tier_granted_at?: string | null
          tier_source?: string | null
          timezone?: string
          top_drain?: string | null
          track?: string
          tradition?: string
          training_days_per_week?: number | null
          training_experience?: string | null
          training_years?: number | null
          treadmill_access?: string | null
          trial_ends_at?: string | null
          trial_reminder_sent_at?: string | null
          trial_started_at?: string | null
          tribe_label?: string | null
          unit_system?: string
          updated_at?: string
          user_id: string
          vacation_note?: string | null
          vacation_reason?: string[]
          vacation_started_at?: string | null
          vacation_until?: string | null
          weight_kg?: number | null
          welcome_email_sent_at?: string | null
          work_geocoded_at?: string | null
          work_label?: string | null
          work_lat?: number | null
          work_lng?: number | null
          workout_style_preference?: string | null
        }
        Update: {
          activity_notes?: string | null
          age?: number | null
          alcohol_per_week?: number | null
          allergies?: Json
          caffeine_per_day?: number | null
          cardio_preference?: string | null
          coach_voice?: string
          connected_apps_interest?: string[]
          cooking_minutes_per_day?: number | null
          cooking_skill?: string | null
          cooking_willingness?: number | null
          country_code?: string | null
          created_at?: string
          daily_motivation_enabled?: boolean
          dietary_pattern?: string | null
          dog_count?: number
          earned_badges?: Json
          email?: string
          entitlement?: string
          entitlement_granted_at?: string | null
          entitlement_source?: string | null
          equipment_access?: string | null
          faith_mode_enabled?: boolean
          first_name?: string | null
          foods_avoided?: string | null
          foods_liked?: string | null
          gender?: string | null
          goal_progress_summary?: Json | null
          goal_weight_kg?: number | null
          goals?: Json
          grocery_stores?: Json
          has_dog?: boolean
          height_cm?: number | null
          home_geocoded_at?: string | null
          home_lat?: number | null
          home_lng?: number | null
          injuries?: string | null
          is_demo?: boolean
          legal_consent_at?: string | null
          location?: Json
          meal_reminders_enabled?: boolean
          medications?: string | null
          mindset_intensity?: string
          mood_today?: number | null
          morning_delivery?: string
          nature_preference?: string | null
          notification_email?: boolean
          notification_push?: boolean
          notification_sms?: boolean
          notify_medications?: boolean
          onboarding_completed_at?: string | null
          organic_preference?: string | null
          outdoor_activity?: string | null
          outdoor_difficulty?: string | null
          outdoor_loop_shape?: string | null
          peptide_status?: string | null
          phone_e164?: string | null
          physique_focus?: Json
          preferred_activities?: Json
          preferred_training_days?: Json
          rebuilt_access?: boolean
          rebuilt_start_date?: string | null
          referral_code?: string | null
          referred_by?: string | null
          reminder_frequency?: string
          reminder_time_evening_local?: string
          reminder_time_local?: string
          reminder_time_midday_local?: string
          restaurants?: Json
          screener_conditions?: Json
          screener_passed?: boolean | null
          session_minutes?: number | null
          sleep_hours?: number | null
          sms_consent_at?: string | null
          staple_seasonings?: Json
          stress_level?: number | null
          stripe_customer_id?: string | null
          subscription_plan?: string | null
          subscription_status?: string | null
          success_metric?: Json | null
          sweet_tooth?: number | null
          taste_profile?: Json
          tier?: string
          tier_granted_at?: string | null
          tier_source?: string | null
          timezone?: string
          top_drain?: string | null
          track?: string
          tradition?: string
          training_days_per_week?: number | null
          training_experience?: string | null
          training_years?: number | null
          treadmill_access?: string | null
          trial_ends_at?: string | null
          trial_reminder_sent_at?: string | null
          trial_started_at?: string | null
          tribe_label?: string | null
          unit_system?: string
          updated_at?: string
          user_id?: string
          vacation_note?: string | null
          vacation_reason?: string[]
          vacation_started_at?: string | null
          vacation_until?: string | null
          weight_kg?: number | null
          welcome_email_sent_at?: string | null
          work_geocoded_at?: string | null
          work_label?: string | null
          work_lat?: number | null
          work_lng?: number | null
          workout_style_preference?: string | null
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
          role: Database["public"]["Enums"]["app_role"]
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
      user_streaks: {
        Row: {
          current_count: number
          grace_until: string | null
          id: string
          kind: string
          last_date: string | null
          longest_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_count?: number
          grace_until?: string | null
          id?: string
          kind: string
          last_date?: string | null
          longest_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_count?: number
          grace_until?: string | null
          id?: string
          kind?: string
          last_date?: string | null
          longest_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      voice_journals: {
        Row: {
          audio_path: string | null
          created_at: string
          duration_seconds: number | null
          emotion_tags: string[] | null
          id: string
          summary: string | null
          transcript: string | null
          user_id: string
        }
        Insert: {
          audio_path?: string | null
          created_at?: string
          duration_seconds?: number | null
          emotion_tags?: string[] | null
          id?: string
          summary?: string | null
          transcript?: string | null
          user_id: string
        }
        Update: {
          audio_path?: string | null
          created_at?: string
          duration_seconds?: number | null
          emotion_tags?: string[] | null
          id?: string
          summary?: string | null
          transcript?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wearable_connections: {
        Row: {
          access_token: string
          created_at: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          provider: string
          provider_user_id: string | null
          refresh_token: string | null
          scopes: string[]
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider: string
          provider_user_id?: string | null
          refresh_token?: string | null
          scopes?: string[]
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider?: string
          provider_user_id?: string | null
          refresh_token?: string | null
          scopes?: string[]
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wearable_daily_metrics: {
        Row: {
          active_calories: number | null
          created_at: string
          hrv_ms: number | null
          id: string
          metric_date: string
          provider: string
          raw: Json | null
          readiness_score: number | null
          recovery_score: number | null
          resting_heart_rate: number | null
          sleep_minutes: number | null
          sleep_score: number | null
          steps: number | null
          strain_score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_calories?: number | null
          created_at?: string
          hrv_ms?: number | null
          id?: string
          metric_date: string
          provider: string
          raw?: Json | null
          readiness_score?: number | null
          recovery_score?: number | null
          resting_heart_rate?: number | null
          sleep_minutes?: number | null
          sleep_score?: number | null
          steps?: number | null
          strain_score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_calories?: number | null
          created_at?: string
          hrv_ms?: number | null
          id?: string
          metric_date?: string
          provider?: string
          raw?: Json | null
          readiness_score?: number | null
          recovery_score?: number | null
          resting_heart_rate?: number | null
          sleep_minutes?: number | null
          sleep_score?: number | null
          steps?: number | null
          strain_score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wearables_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          provider: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          provider?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          provider?: string | null
          user_id?: string
        }
        Relationships: []
      }
      web_events: {
        Row: {
          currency: string | null
          dead_link: boolean | null
          device: string | null
          duration_ms: number | null
          event_type: string
          href: string | null
          id: number
          is_new: boolean | null
          meta: Json | null
          name: string | null
          occurred_at: string
          path: string | null
          referrer: string | null
          screen_w: number | null
          session_id: string
          site: string | null
          source: string | null
          user_id: string | null
          utm_medium: string | null
          utm_source: string | null
          value_cents: number | null
          visitor_id: string
        }
        Insert: {
          currency?: string | null
          dead_link?: boolean | null
          device?: string | null
          duration_ms?: number | null
          event_type: string
          href?: string | null
          id?: number
          is_new?: boolean | null
          meta?: Json | null
          name?: string | null
          occurred_at?: string
          path?: string | null
          referrer?: string | null
          screen_w?: number | null
          session_id: string
          site?: string | null
          source?: string | null
          user_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          value_cents?: number | null
          visitor_id: string
        }
        Update: {
          currency?: string | null
          dead_link?: boolean | null
          device?: string | null
          duration_ms?: number | null
          event_type?: string
          href?: string | null
          id?: number
          is_new?: boolean | null
          meta?: Json | null
          name?: string | null
          occurred_at?: string
          path?: string | null
          referrer?: string | null
          screen_w?: number | null
          session_id?: string
          site?: string | null
          source?: string | null
          user_id?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          value_cents?: number | null
          visitor_id?: string
        }
        Relationships: []
      }
      weekly_checkins: {
        Row: {
          created_at: string
          focus_feedback: Json
          id: string
          measurements: Json
          notes: string | null
          photo_id: string | null
          submitted_at: string
          user_id: string
          week_number: number
          week_rating: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          focus_feedback?: Json
          id?: string
          measurements?: Json
          notes?: string | null
          photo_id?: string | null
          submitted_at?: string
          user_id: string
          week_number: number
          week_rating?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          focus_feedback?: Json
          id?: string
          measurements?: Json
          notes?: string | null
          photo_id?: string | null
          submitted_at?: string
          user_id?: string
          week_number?: number
          week_rating?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      weekly_reviews: {
        Row: {
          ai_summary: string | null
          generated_at: string
          id: string
          one_thing: string | null
          stats: Json
          user_id: string
          week_start: string
        }
        Insert: {
          ai_summary?: string | null
          generated_at?: string
          id?: string
          one_thing?: string | null
          stats?: Json
          user_id: string
          week_start: string
        }
        Update: {
          ai_summary?: string | null
          generated_at?: string
          id?: string
          one_thing?: string | null
          stats?: Json
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      weight_log: {
        Row: {
          id: string
          logged_at: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          id?: string
          logged_at?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          id?: string
          logged_at?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      xp_ledger: {
        Row: {
          action_type: string
          balance_after: number | null
          created_at: string
          day_local: string | null
          delta: number
          id: string
          metadata: Json
          source_key: string
          user_id: string
        }
        Insert: {
          action_type: string
          balance_after?: number | null
          created_at?: string
          day_local?: string | null
          delta: number
          id?: string
          metadata?: Json
          source_key: string
          user_id: string
        }
        Update: {
          action_type?: string
          balance_after?: number | null
          created_at?: string
          day_local?: string | null
          delta?: number
          id?: string
          metadata?: Json
          source_key?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_referral_rewards_for: {
        Args: { p_referred: string }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      fn_tick_streak: {
        Args: {
          p_day_local: string
          p_grace_days?: number
          p_kind: string
          p_source?: string
        }
        Returns: {
          current_count: number
          grace_until: string
          last_date: string
          longest_count: number
          reason: string
        }[]
      }
      generate_referral_code: { Args: never; Returns: string }
      grant_entitlement: {
        Args: { p_entitlement: string; p_source: string; p_user_id: string }
        Returns: undefined
      }
      grant_tier: {
        Args: { p_source: string; p_tier: string; p_user_id: string }
        Returns: undefined
      }
      has_active_rebuilt_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      has_purchase: {
        Args: { _product_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tier: {
        Args: { _min_tier: string; _user_id: string }
        Returns: boolean
      }
      incr_coach_usage: { Args: never; Returns: number }
      issue_member_perk_code: {
        Args: { p_partner: string }
        Returns: {
          code: string
          discount_percent: number
          status: string
          tier_required: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_active_partner_id: { Args: { _uid: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_code: { Args: { p_code: string }; Returns: string }
      reset_admin_pin: { Args: never; Returns: undefined }
      restore_my_purchase: { Args: never; Returns: string }
      revoke_member_perks: { Args: { p_user_id: string }; Returns: number }
      sync_entitlement_from_purchase: {
        Args: { p_email: string; p_user_id: string }
        Returns: string
      }
      verify_perk_code: {
        Args: { p_code: string; p_partner: string }
        Returns: {
          discount_percent: number
          tier_required: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      affiliate_partner: "candyrx" | "youthfullab"
      app_role: "admin" | "coach" | "user"
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
    Enums: {
      affiliate_partner: ["candyrx", "youthfullab"],
      app_role: ["admin", "coach", "user"],
    },
  },
} as const
