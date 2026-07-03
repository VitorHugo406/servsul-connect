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
      announcement_comments: {
        Row: {
          announcement_id: string
          author_id: string
          content: string
          created_at: string
          id: string
        }
        Insert: {
          announcement_id: string
          author_id: string
          content: string
          created_at?: string
          id?: string
        }
        Update: {
          announcement_id?: string
          author_id?: string
          content?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_comments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          author_id: string
          company_id: string
          content: string
          created_at: string
          expire_at: string | null
          id: string
          is_pinned: boolean
          priority: string
          start_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          company_id?: string
          content: string
          created_at?: string
          expire_at?: string | null
          id?: string
          is_pinned?: boolean
          priority?: string
          start_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          company_id?: string
          content?: string
          created_at?: string
          expire_at?: string | null
          id?: string
          is_pinned?: boolean
          priority?: string
          start_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      api_access_logs: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          integration_id: string
          ip_address: string | null
          method: string
          status_code: number
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          integration_id: string
          ip_address?: string | null
          method: string
          status_code: number
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          integration_id?: string
          ip_address?: string | null
          method?: string
          status_code?: number
        }
        Relationships: [
          {
            foreignKeyName: "api_access_logs_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "api_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_integration_history: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          integration_id: string
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          integration_id: string
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          integration_id?: string
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_integration_history_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "api_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_integrations: {
        Row: {
          api_key_hash: string
          api_key_hint: string
          api_token_hash: string
          company_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          updated_at: string
        }
        Insert: {
          api_key_hash: string
          api_key_hint: string
          api_token_hash: string
          company_id?: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          api_key_hash?: string
          api_key_hint?: string
          api_token_hash?: string
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          announcement_id: string | null
          created_at: string
          direct_message_id: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          message_id: string | null
          uploaded_by: string
        }
        Insert: {
          announcement_id?: string | null
          created_at?: string
          direct_message_id?: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          message_id?: string | null
          uploaded_by: string
        }
        Update: {
          announcement_id?: string | null
          created_at?: string
          direct_message_id?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_direct_message_id_fkey"
            columns: ["direct_message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string | null
          id: string
          ip_address: string | null
          performed_by: string | null
          performed_by_email: string | null
          record_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          performed_by_email?: string | null
          record_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          performed_by?: string | null
          performed_by_email?: string | null
          record_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      board_join_requests: {
        Row: {
          board_id: string
          created_at: string
          id: string
          profile_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          id?: string
          profile_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          profile_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_join_requests_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_join_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      board_share_links: {
        Row: {
          board_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean | null
          share_token: string
        }
        Insert: {
          board_id: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean | null
          share_token?: string
        }
        Update: {
          board_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean | null
          share_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_share_links_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean
          color: string
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          event_type: string
          id: string
          meeting_link: string | null
          reminder_minutes: number | null
          start_date: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          color?: string
          company_id?: string
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          meeting_link?: string | null
          reminder_minutes?: number | null
          start_date: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          color?: string
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          event_type?: string
          id?: string
          meeting_link?: string | null
          reminder_minutes?: number | null
          start_date?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      column_auto_subtasks: {
        Row: {
          column_id: string
          created_at: string
          group_title: string
          id: string
          position: number
          title: string
        }
        Insert: {
          column_id: string
          created_at?: string
          group_title?: string
          id?: string
          position?: number
          title: string
        }
        Update: {
          column_id?: string
          created_at?: string
          group_title?: string
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "column_auto_subtasks_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "task_board_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      column_workflow_rules: {
        Row: {
          board_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          required_column_id: string | null
          rule_type: string
          source_column_id: string | null
          target_column_id: string
        }
        Insert: {
          board_id: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          required_column_id?: string | null
          rule_type?: string
          source_column_id?: string | null
          target_column_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          required_column_id?: string | null
          rule_type?: string
          source_column_id?: string | null
          target_column_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "column_workflow_rules_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "column_workflow_rules_required_column_id_fkey"
            columns: ["required_column_id"]
            isOneToOne: false
            referencedRelation: "task_board_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "column_workflow_rules_source_column_id_fkey"
            columns: ["source_column_id"]
            isOneToOne: false
            referencedRelation: "task_board_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "column_workflow_rules_target_column_id_fkey"
            columns: ["target_column_id"]
            isOneToOne: false
            referencedRelation: "task_board_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          logo_url: string | null
          name: string
          primary_color: string
          secondary_color: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          logo_url?: string | null
          name: string
          primary_color?: string
          secondary_color?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          logo_url?: string | null
          name?: string
          primary_color?: string
          secondary_color?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          company_id: string
          content: string
          created_at: string
          id: string
          is_read: boolean
          receiver_id: string
          sender_id: string
        }
        Insert: {
          company_id?: string
          content: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id: string
          sender_id: string
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          is_read?: boolean
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_competencies: {
        Row: {
          category: string
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          category?: string
          company_id?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_competencies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_cycles: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          created_by: string
          description?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_cycles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_position_competencies: {
        Row: {
          competency_id: string
          created_at: string
          id: string
          min_expected_score: number | null
          position_id: string
          requires_comment: boolean
          weight: number
        }
        Insert: {
          competency_id: string
          created_at?: string
          id?: string
          min_expected_score?: number | null
          position_id: string
          requires_comment?: boolean
          weight?: number
        }
        Update: {
          competency_id?: string
          created_at?: string
          id?: string
          min_expected_score?: number | null
          position_id?: string
          requires_comment?: boolean
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "eval_position_competencies_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "eval_competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_position_competencies_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "eval_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_positions: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sector_id: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sector_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sector_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_positions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_positions_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_history: {
        Row: {
          action: string
          created_at: string
          details: string | null
          evaluation_id: string
          id: string
          new_status: string | null
          old_status: string | null
          performed_by: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          evaluation_id: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          performed_by: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          evaluation_id?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          performed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_history_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_items: {
        Row: {
          classification: string | null
          competency_id: string
          created_at: string
          evaluated_response: string | null
          evaluation_id: string
          evaluator_comment: string | null
          evaluator_reply: string | null
          id: string
          score: number | null
          updated_at: string
          weight: number
        }
        Insert: {
          classification?: string | null
          competency_id: string
          created_at?: string
          evaluated_response?: string | null
          evaluation_id: string
          evaluator_comment?: string | null
          evaluator_reply?: string | null
          id?: string
          score?: number | null
          updated_at?: string
          weight?: number
        }
        Update: {
          classification?: string | null
          competency_id?: string
          created_at?: string
          evaluated_response?: string | null
          evaluation_id?: string
          evaluator_comment?: string | null
          evaluator_reply?: string | null
          id?: string
          score?: number | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_items_competency_id_fkey"
            columns: ["competency_id"]
            isOneToOne: false
            referencedRelation: "eval_competencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluation_items_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          company_id: string
          created_at: string
          cycle_id: string | null
          evaluated_comment: string | null
          evaluated_id: string
          evaluator_id: string
          evaluator_response: string | null
          finalized_at: string | null
          id: string
          overall_comment: string | null
          overall_score: number | null
          position_id: string | null
          responded_at: string | null
          sent_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          company_id?: string
          created_at?: string
          cycle_id?: string | null
          evaluated_comment?: string | null
          evaluated_id: string
          evaluator_id: string
          evaluator_response?: string | null
          finalized_at?: string | null
          id?: string
          overall_comment?: string | null
          overall_score?: number | null
          position_id?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          cycle_id?: string | null
          evaluated_comment?: string | null
          evaluated_id?: string
          evaluator_id?: string
          evaluator_response?: string | null
          finalized_at?: string | null
          id?: string
          overall_comment?: string | null
          overall_score?: number | null
          position_id?: string | null
          responded_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "eval_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "eval_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      important_announcement_reads: {
        Row: {
          announcement_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "important_announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "important_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      important_announcements: {
        Row: {
          border_style: string
          company_id: string
          content: string
          created_at: string
          created_by: string
          expire_at: string | null
          id: string
          is_active: boolean
          start_at: string | null
          title: string
        }
        Insert: {
          border_style?: string
          company_id?: string
          content: string
          created_at?: string
          created_by: string
          expire_at?: string | null
          id?: string
          is_active?: boolean
          start_at?: string | null
          title: string
        }
        Update: {
          border_style?: string
          company_id?: string
          content?: string
          created_at?: string
          created_by?: string
          expire_at?: string | null
          id?: string
          is_active?: boolean
          start_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "important_announcements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_participants: {
        Row: {
          created_at: string
          event_id: string
          id: string
          profile_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          profile_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          profile_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          profile_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author_id: string
          company_id: string
          content: string
          created_at: string
          id: string
          reply_to_id: string | null
          sector_id: string
        }
        Insert: {
          author_id: string
          company_id?: string
          content: string
          created_at?: string
          id?: string
          reply_to_id?: string | null
          sector_id: string
        }
        Update: {
          author_id?: string
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          reply_to_id?: string | null
          sector_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_scores: {
        Row: {
          board_id: string | null
          completed_tasks: number
          created_at: string
          id: string
          late_tasks: number
          on_time_tasks: number
          profile_id: string
          score: number
          total_tasks: number
          updated_at: string
          year_month: string
        }
        Insert: {
          board_id?: string | null
          completed_tasks?: number
          created_at?: string
          id?: string
          late_tasks?: number
          on_time_tasks?: number
          profile_id: string
          score?: number
          total_tasks?: number
          updated_at?: string
          year_month: string
        }
        Update: {
          board_id?: string | null
          completed_tasks?: number
          created_at?: string
          id?: string
          late_tasks?: number
          on_time_tasks?: number
          profile_id?: string
          score?: number
          total_tasks?: number
          updated_at?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_scores_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_scores_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_shares: {
        Row: {
          created_at: string
          id: string
          note_id: string
          permission: string
          shared_with_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_id: string
          permission?: string
          shared_with_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_id?: string
          permission?: string
          shared_with_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_shares_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          background_color: string
          background_image: string | null
          background_texture: string | null
          company_id: string
          content: string
          created_at: string
          id: string
          is_archived: boolean
          is_pinned: boolean
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          background_color?: string
          background_image?: string | null
          background_texture?: string | null
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          owner_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          background_color?: string
          background_image?: string | null
          background_texture?: string | null
          company_id?: string
          content?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      private_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          profile_id: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          profile_id: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          profile_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "private_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      private_group_message_reads: {
        Row: {
          group_id: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_group_message_reads_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "private_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      private_group_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "private_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_group_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_groups: {
        Row: {
          avatar_url: string | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "private_groups_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          autonomy_level: string
          avatar_url: string | null
          birth_date: string | null
          company: string | null
          company_id: string
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          name: string
          phone: string | null
          profile_type: string
          registration_number: string | null
          sector_id: string | null
          updated_at: string
          user_id: string
          user_status: string | null
          work_period: string | null
        }
        Insert: {
          address?: string | null
          autonomy_level?: string
          avatar_url?: string | null
          birth_date?: string | null
          company?: string | null
          company_id?: string
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name: string
          phone?: string | null
          profile_type?: string
          registration_number?: string | null
          sector_id?: string | null
          updated_at?: string
          user_id: string
          user_status?: string | null
          work_period?: string | null
        }
        Update: {
          address?: string | null
          autonomy_level?: string
          avatar_url?: string | null
          birth_date?: string | null
          company?: string | null
          company_id?: string
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string | null
          name?: string
          phone?: string | null
          profile_type?: string
          registration_number?: string | null
          sector_id?: string | null
          updated_at?: string
          user_id?: string
          user_status?: string | null
          work_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_summaries: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          format: string
          frequency: string
          id: string
          is_active: boolean
          metrics: Json
          month_day: number | null
          send_time: string
          target_id: string
          target_type: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          created_by: string
          format?: string
          frequency: string
          id?: string
          is_active?: boolean
          metrics?: Json
          month_day?: number | null
          send_time?: string
          target_id: string
          target_type: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          format?: string
          frequency?: string
          id?: string
          is_active?: boolean
          metrics?: Json
          month_day?: number | null
          send_time?: string
          target_id?: string
          target_type?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_summaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          color: string
          company_id: string
          created_at: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          color?: string
          company_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      subtask_groups: {
        Row: {
          created_at: string
          id: string
          position: number
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          task_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtask_groups_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      supervisor_team_members: {
        Row: {
          created_at: string
          id: string
          member_profile_id: string
          supervisor_id: string
          team_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          member_profile_id: string
          supervisor_id: string
          team_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          member_profile_id?: string
          supervisor_id?: string
          team_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supervisor_team_members_member_profile_id_fkey"
            columns: ["member_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      task_activities: {
        Row: {
          action_type: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          task_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          task_id: string
          user_id: string
          user_name?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          task_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_activities_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_auto_duplications: {
        Row: {
          board_id: string
          created_at: string
          created_by: string
          frequency: string
          id: string
          is_active: boolean
          last_duplicated_at: string | null
          month_day: number | null
          target_column_id: string
          task_id: string
          weekdays: number[] | null
        }
        Insert: {
          board_id: string
          created_at?: string
          created_by: string
          frequency: string
          id?: string
          is_active?: boolean
          last_duplicated_at?: string | null
          month_day?: number | null
          target_column_id: string
          task_id: string
          weekdays?: number[] | null
        }
        Update: {
          board_id?: string
          created_at?: string
          created_by?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_duplicated_at?: string | null
          month_day?: number | null
          target_column_id?: string
          task_id?: string
          weekdays?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "task_auto_duplications_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_auto_duplications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_automation_rules: {
        Row: {
          action_config: Json
          action_type: string
          board_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          task_id: string | null
          trigger_config: Json
          trigger_type: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          board_id: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          task_id?: string | null
          trigger_config?: Json
          trigger_type: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          board_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          task_id?: string | null
          trigger_config?: Json
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_automation_rules_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_automation_rules_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_board_columns: {
        Row: {
          auto_assign_to: string | null
          auto_cover: string | null
          board_id: string
          color: string
          created_at: string
          id: string
          is_conclusion: boolean | null
          is_template_column: boolean
          position: number
          title: string
        }
        Insert: {
          auto_assign_to?: string | null
          auto_cover?: string | null
          board_id: string
          color?: string
          created_at?: string
          id?: string
          is_conclusion?: boolean | null
          is_template_column?: boolean
          position?: number
          title: string
        }
        Update: {
          auto_assign_to?: string | null
          auto_cover?: string | null
          board_id?: string
          color?: string
          created_at?: string
          id?: string
          is_conclusion?: boolean | null
          is_template_column?: boolean
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_board_columns_auto_assign_to_fkey"
            columns: ["auto_assign_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_board_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      task_board_members: {
        Row: {
          board_id: string
          id: string
          joined_at: string
          profile_id: string
          role: string
          user_id: string
        }
        Insert: {
          board_id: string
          id?: string
          joined_at?: string
          profile_id: string
          role?: string
          user_id: string
        }
        Update: {
          board_id?: string
          id?: string
          joined_at?: string
          profile_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_board_members_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      task_boards: {
        Row: {
          background_image: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          overload_threshold: number
          owner_id: string
          updated_at: string
        }
        Insert: {
          background_image?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          overload_threshold?: number
          owner_id: string
          updated_at?: string
        }
        Update: {
          background_image?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          overload_threshold?: number
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_boards_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          task_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          task_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_decisions: {
        Row: {
          created_at: string
          created_by: string
          decision_date: string
          decision_text: string
          id: string
          responsible_name: string
          task_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          decision_date: string
          decision_text: string
          id?: string
          responsible_name: string
          task_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          decision_date?: string
          decision_text?: string
          id?: string
          responsible_name?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_decisions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_label_assignments: {
        Row: {
          created_at: string
          id: string
          label_id: string
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label_id: string
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_label_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "task_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_label_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_labels: {
        Row: {
          board_id: string
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          board_id: string
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          board_id?: string
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_labels_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      task_subtasks: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          is_completed: boolean
          position: number
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_completed?: boolean
          position?: number
          task_id: string
          title: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          is_completed?: boolean
          position?: number
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_subtasks_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "subtask_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          board_id: string | null
          company_id: string
          completed_at: string | null
          completed_late: boolean | null
          cover_image: string | null
          created_at: string
          created_by: string
          delay_days: number | null
          description: string | null
          due_date: string | null
          id: string
          is_archived: boolean
          is_emergency: boolean
          is_template: boolean
          position: number
          priority: string
          reminder_minutes: number | null
          sector_id: string | null
          status: string
          task_number: number
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          board_id?: string | null
          company_id?: string
          completed_at?: string | null
          completed_late?: boolean | null
          cover_image?: string | null
          created_at?: string
          created_by: string
          delay_days?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean
          is_emergency?: boolean
          is_template?: boolean
          position?: number
          priority?: string
          reminder_minutes?: number | null
          sector_id?: string | null
          status?: string
          task_number?: number
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          board_id?: string | null
          company_id?: string
          completed_at?: string | null
          completed_late?: boolean | null
          cover_image?: string | null
          created_at?: string
          created_by?: string
          delay_days?: number | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean
          is_emergency?: boolean
          is_template?: boolean
          position?: number
          priority?: string
          reminder_minutes?: number | null
          sector_id?: string | null
          status?: string
          task_number?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          supervisor_id: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          supervisor_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          supervisor_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_additional_sectors: {
        Row: {
          created_at: string
          id: string
          sector_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sector_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sector_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_additional_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_facial_data: {
        Row: {
          created_at: string
          face_image_url: string | null
          facial_descriptors: Json
          id: string
          profile_id: string
          registered_by: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          face_image_url?: string | null
          facial_descriptors: Json
          id?: string
          profile_id: string
          registered_by: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          face_image_url?: string | null
          facial_descriptors?: Json
          id?: string
          profile_id?: string
          registered_by?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reference_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          can_access_bh: boolean
          can_access_fechamento: boolean
          can_access_management: boolean
          can_access_orbs: boolean
          can_access_password_change: boolean
          can_create_war_room: boolean
          can_delete_messages: boolean
          can_post_announcements: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_access_bh?: boolean
          can_access_fechamento?: boolean
          can_access_management?: boolean
          can_access_orbs?: boolean
          can_access_password_change?: boolean
          can_create_war_room?: boolean
          can_delete_messages?: boolean
          can_post_announcements?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_access_bh?: boolean
          can_access_fechamento?: boolean
          can_access_management?: boolean
          can_access_orbs?: boolean
          can_access_password_change?: boolean
          can_create_war_room?: boolean
          can_delete_messages?: boolean
          can_post_announcements?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          created_at: string
          id: string
          is_online: boolean
          last_heartbeat: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_online?: boolean
          last_heartbeat?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_online?: boolean
          last_heartbeat?: string
          user_id?: string
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
      war_room_members: {
        Row: {
          acknowledged_at: string | null
          has_acknowledged: boolean
          id: string
          joined_at: string
          profile_id: string
          user_id: string
          war_room_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          has_acknowledged?: boolean
          id?: string
          joined_at?: string
          profile_id: string
          user_id: string
          war_room_id: string
        }
        Update: {
          acknowledged_at?: string | null
          has_acknowledged?: boolean
          id?: string
          joined_at?: string
          profile_id?: string
          user_id?: string
          war_room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "war_room_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "war_room_members_war_room_id_fkey"
            columns: ["war_room_id"]
            isOneToOne: false
            referencedRelation: "war_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      war_room_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender_id: string
          war_room_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender_id: string
          war_room_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
          war_room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "war_room_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "war_room_messages_war_room_id_fkey"
            columns: ["war_room_id"]
            isOneToOne: false
            referencedRelation: "war_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      war_room_timeline: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          task_id: string | null
          war_room_id: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          task_id?: string | null
          war_room_id: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          task_id?: string | null
          war_room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "war_room_timeline_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "war_room_timeline_war_room_id_fkey"
            columns: ["war_room_id"]
            isOneToOne: false
            referencedRelation: "war_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      war_rooms: {
        Row: {
          closed_at: string | null
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          status: string
          task_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          company_id?: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "war_rooms_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "war_rooms_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      workload_alerts: {
        Row: {
          alert_type: string
          board_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          profile_id: string
          task_id: string | null
        }
        Insert: {
          alert_type: string
          board_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          profile_id: string
          task_id?: string | null
        }
        Update: {
          alert_type?: string
          board_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          profile_id?: string
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workload_alerts_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "task_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workload_alerts_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_profiles_full: {
        Args: never
        Returns: {
          address: string | null
          autonomy_level: string
          avatar_url: string | null
          birth_date: string | null
          company: string | null
          company_id: string
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          name: string
          phone: string | null
          profile_type: string
          registration_number: string | null
          sector_id: string | null
          updated_at: string
          user_id: string
          user_status: string | null
          work_period: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      can_edit_note: { Args: { _note_id: string }; Returns: boolean }
      can_view_calendar_event: {
        Args: { _created_by: string; _event_id: string }
        Returns: boolean
      }
      can_view_meeting_participants: {
        Args: { _event_id: string }
        Returns: boolean
      }
      can_view_note: { Args: { _note_id: string }; Returns: boolean }
      check_user_is_active: { Args: never; Returns: boolean }
      create_user_notification: {
        Args: {
          _message: string
          _reference_id?: string
          _target_user_id: string
          _title: string
          _type: string
        }
        Returns: string
      }
      current_company_id: { Args: never; Returns: string }
      get_board_task_details_fast: {
        Args: { _board_id: string }
        Returns: Json
      }
      get_board_tasks_fast: {
        Args: { _board_id: string }
        Returns: {
          assigned_to: string
          assignee: Json
          board_id: string
          completed_at: string
          completed_late: boolean
          cover_image: string
          created_at: string
          created_by: string
          delay_days: number
          description: string
          due_date: string
          id: string
          is_archived: boolean
          is_emergency: boolean
          is_template: boolean
          position: number
          priority: string
          sector_id: string
          status: string
          task_number: number
          title: string
          updated_at: string
        }[]
      }
      get_current_autonomy_level: { Args: never; Returns: string }
      get_current_profile_id: { Args: never; Returns: string }
      get_current_sector_id: { Args: never; Returns: string }
      get_my_full_profile: {
        Args: never
        Returns: {
          address: string | null
          autonomy_level: string
          avatar_url: string | null
          birth_date: string | null
          company: string | null
          company_id: string
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_active: boolean
          last_seen_at: string | null
          name: string
          phone: string | null
          profile_type: string
          registration_number: string | null
          sector_id: string | null
          updated_at: string
          user_id: string
          user_status: string | null
          work_period: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_profiles_registration: {
        Args: { _ids: string[] }
        Returns: {
          id: string
          registration_number: string
        }[]
      }
      has_autonomy_level: { Args: { required_level: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_board_admin_or_owner: {
        Args: { check_board_id: string }
        Returns: boolean
      }
      is_board_member: { Args: { check_board_id: string }; Returns: boolean }
      is_board_owner: { Args: { check_board_id: string }; Returns: boolean }
      is_group_admin: { Args: { check_group_id: string }; Returns: boolean }
      is_group_empty: { Args: { check_group_id: string }; Returns: boolean }
      is_group_member: { Args: { check_group_id: string }; Returns: boolean }
      is_note_owner: { Args: { _note_id: string }; Returns: boolean }
      is_note_shared_with_me: { Args: { _note_id: string }; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_war_room_member: { Args: { _war_room_id: string }; Returns: boolean }
      log_task_activity_secure: {
        Args: {
          _action_type: string
          _description: string
          _metadata?: Json
          _task_id: string
        }
        Returns: string
      }
      refresh_board_monthly_scores: {
        Args: { _board_id: string }
        Returns: undefined
      }
      resolve_board_share_link: {
        Args: { _token: string }
        Returns: {
          board_description: string
          board_id: string
          board_name: string
          is_active: boolean
        }[]
      }
      same_company: { Args: { _company_id: string }; Returns: boolean }
      update_profile_sensitive: {
        Args: {
          _address: string
          _company: string
          _phone: string
          _registration_number: string
          _user_id: string
        }
        Returns: undefined
      }
      user_has_sector_access: {
        Args: { check_sector_id: string; check_user_id: string }
        Returns: boolean
      }
      user_is_member_of_group: {
        Args: { check_group_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "gerente"
        | "supervisor"
        | "colaborador"
        | "gestor"
        | "diretoria"
        | "super_admin"
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
      app_role: [
        "admin",
        "gerente",
        "supervisor",
        "colaborador",
        "gestor",
        "diretoria",
        "super_admin",
      ],
    },
  },
} as const
