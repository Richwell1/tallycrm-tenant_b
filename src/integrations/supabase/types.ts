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
      activities: {
        Row: {
          contact_id: string | null
          created_at: string
          deal_id: string | null
          due_at: string | null
          duration_minutes: number | null
          id: string
          last_modified_by: string | null
          locked_at: string | null
          notes: string | null
          origin_node_id: string | null
          outcome: string | null
          owner_id: string | null
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          due_at?: string | null
          duration_minutes?: number | null
          id?: string
          last_modified_by?: string | null
          locked_at?: string | null
          notes?: string | null
          origin_node_id?: string | null
          outcome?: string | null
          owner_id?: string | null
          title: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          due_at?: string | null
          duration_minutes?: number | null
          id?: string
          last_modified_by?: string | null
          locked_at?: string | null
          notes?: string | null
          origin_node_id?: string | null
          outcome?: string | null
          owner_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          assignment_strategy: string
          company_address: string | null
          company_email: string | null
          company_name: string
          company_phone: string | null
          created_at: string
          crm_name: string
          date_format: string
          default_currency: string
          email_api_key_masked: string
          email_provider: string
          from_email: string
          from_name: string
          id: string
          invoice_default_due_days: number
          invoice_number_prefix: string
          invoice_payment_terms: string | null
          landing_api_key: string
          landing_last_test_at: string | null
          landing_last_test_status: string | null
          landing_response_log: Json
          language: string
          logo_url: string | null
          notif_deal_stage_app: boolean
          notif_deal_stage_email: boolean
          notif_digest_app: boolean
          notif_digest_email: boolean
          notif_new_lead_app: boolean
          notif_new_lead_email: boolean
          notif_sla_app: boolean
          notif_sla_email: boolean
          quote_default_tax_rate: number
          quote_default_validity_days: number
          quote_footer_note: string | null
          quote_number_node_prefix: string | null
          quote_number_prefix: string
          quote_terms: string | null
          receipt_number_prefix: string
          time_zone: string
          timezone: string
          updated_at: string
        }
        Insert: {
          assignment_strategy?: string
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          created_at?: string
          crm_name?: string
          date_format?: string
          default_currency?: string
          email_api_key_masked?: string
          email_provider?: string
          from_email?: string
          from_name?: string
          id?: string
          invoice_default_due_days?: number
          invoice_number_prefix?: string
          invoice_payment_terms?: string | null
          landing_api_key?: string
          landing_last_test_at?: string | null
          landing_last_test_status?: string | null
          landing_response_log?: Json
          language?: string
          logo_url?: string | null
          notif_deal_stage_app?: boolean
          notif_deal_stage_email?: boolean
          notif_digest_app?: boolean
          notif_digest_email?: boolean
          notif_new_lead_app?: boolean
          notif_new_lead_email?: boolean
          notif_sla_app?: boolean
          notif_sla_email?: boolean
          quote_default_tax_rate?: number
          quote_default_validity_days?: number
          quote_footer_note?: string | null
          quote_number_node_prefix?: string | null
          quote_number_prefix?: string
          quote_terms?: string | null
          receipt_number_prefix?: string
          time_zone?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          assignment_strategy?: string
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          created_at?: string
          crm_name?: string
          date_format?: string
          default_currency?: string
          email_api_key_masked?: string
          email_provider?: string
          from_email?: string
          from_name?: string
          id?: string
          invoice_default_due_days?: number
          invoice_number_prefix?: string
          invoice_payment_terms?: string | null
          landing_api_key?: string
          landing_last_test_at?: string | null
          landing_last_test_status?: string | null
          landing_response_log?: Json
          language?: string
          logo_url?: string | null
          notif_deal_stage_app?: boolean
          notif_deal_stage_email?: boolean
          notif_digest_app?: boolean
          notif_digest_email?: boolean
          notif_new_lead_app?: boolean
          notif_new_lead_email?: boolean
          notif_sla_app?: boolean
          notif_sla_email?: boolean
          quote_default_tax_rate?: number
          quote_default_validity_days?: number
          quote_footer_note?: string | null
          quote_number_node_prefix?: string | null
          quote_number_prefix?: string
          quote_terms?: string | null
          receipt_number_prefix?: string
          time_zone?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          entity_name: string | null
          id: string
          ip: string | null
          metadata: Json | null
          origin_node_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          entity_name?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          origin_node_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          entity_name?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          origin_node_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions: Json
          audit_logged: boolean
          condition: string
          config: Json
          created_at: string
          description: string
          enabled: boolean
          id: string
          is_default: boolean
          last_run_at: string | null
          name: string
          object: string
          owner: string
          status: string
          success_rate: number
          trigger_icon: string
          trigger_label: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          actions?: Json
          audit_logged?: boolean
          condition?: string
          config?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          id: string
          is_default?: boolean
          last_run_at?: string | null
          name: string
          object: string
          owner?: string
          status?: string
          success_rate?: number
          trigger_icon?: string
          trigger_label?: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          actions?: Json
          audit_logged?: boolean
          condition?: string
          config?: Json
          created_at?: string
          description?: string
          enabled?: boolean
          id?: string
          is_default?: boolean
          last_run_at?: string | null
          name?: string
          object?: string
          owner?: string
          status?: string
          success_rate?: number
          trigger_icon?: string
          trigger_label?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          action_taken: string
          created_at: string
          duration_ms: number
          id: string
          message: string | null
          record_id: string | null
          record_name: string
          record_type: string
          result: string
          rule_id: string | null
        }
        Insert: {
          action_taken: string
          created_at?: string
          duration_ms?: number
          id?: string
          message?: string | null
          record_id?: string | null
          record_name?: string
          record_type?: string
          result?: string
          rule_id?: string | null
        }
        Update: {
          action_taken?: string
          created_at?: string
          duration_ms?: number
          id?: string
          message?: string | null
          record_id?: string | null
          record_name?: string
          record_type?: string
          result?: string
          rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          account_manager_id: string | null
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          industry: string | null
          last_modified_by: string | null
          linkedin: string | null
          logo_url: string | null
          name: string
          notes: string | null
          origin_node_id: string | null
          phone: string | null
          rating: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          account_manager_id?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          last_modified_by?: string | null
          linkedin?: string | null
          logo_url?: string | null
          name: string
          notes?: string | null
          origin_node_id?: string | null
          phone?: string | null
          rating?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          account_manager_id?: string | null
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          last_modified_by?: string | null
          linkedin?: string | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          origin_node_id?: string | null
          phone?: string | null
          rating?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          assigned_to: string | null
          company_id: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          first_name: string
          id: string
          job_title: string | null
          last_modified_by: string | null
          last_name: string
          notes: string | null
          origin_node_id: string | null
          phone: string | null
          source: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          job_title?: string | null
          last_modified_by?: string | null
          last_name: string
          notes?: string | null
          origin_node_id?: string | null
          phone?: string | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          job_title?: string | null
          last_modified_by?: string | null
          last_name?: string
          notes?: string | null
          origin_node_id?: string | null
          phone?: string | null
          source?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_stage_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          deal_id: string
          from_stage: string | null
          id: string
          to_stage: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          deal_id: string
          from_stage?: string | null
          id?: string
          to_stage: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          deal_id?: string
          from_stage?: string | null
          id?: string
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_stage_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_from_stage_fkey"
            columns: ["from_stage"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_stage_history_to_stage_fkey"
            columns: ["to_stage"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_value_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          deal_id: string
          id: string
          new_value: number | null
          old_value: number | null
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          deal_id: string
          id?: string
          new_value?: number | null
          old_value?: number | null
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          deal_id?: string
          id?: string
          new_value?: number | null
          old_value?: number | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_value_history_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          actual_close_date: string | null
          actual_value: number | null
          assigned_to: string | null
          company_id: string | null
          created_at: string
          currency: string
          deleted_at: string | null
          description: string | null
          expected_close_date: string | null
          id: string
          last_modified_by: string | null
          last_stage_change_at: string | null
          lost_reason: string | null
          name: string
          origin_node_id: string | null
          overdue_at: string | null
          primary_contact_id: string | null
          probability: number
          stage_id: string
          tags: string[] | null
          updated_at: string
          value: number
        }
        Insert: {
          actual_close_date?: string | null
          actual_value?: number | null
          assigned_to?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          last_modified_by?: string | null
          last_stage_change_at?: string | null
          lost_reason?: string | null
          name: string
          origin_node_id?: string | null
          overdue_at?: string | null
          primary_contact_id?: string | null
          probability?: number
          stage_id: string
          tags?: string[] | null
          updated_at?: string
          value?: number
        }
        Update: {
          actual_close_date?: string | null
          actual_value?: number | null
          assigned_to?: string | null
          company_id?: string | null
          created_at?: string
          currency?: string
          deleted_at?: string | null
          description?: string | null
          expected_close_date?: string | null
          id?: string
          last_modified_by?: string | null
          last_stage_change_at?: string | null
          lost_reason?: string | null
          name?: string
          origin_node_id?: string | null
          overdue_at?: string | null
          primary_contact_id?: string | null
          probability?: number
          stage_id?: string
          tags?: string[] | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_primary_contact_id_fkey"
            columns: ["primary_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      email_queue: {
        Row: {
          attempts: number
          created_at: string
          id: string
          idempotency_key: string | null
          last_error: string | null
          origin_node_id: string | null
          payload: Json
          recipient: string
          related_entity: string | null
          related_entity_id: string | null
          sent_at: string | null
          status: string
          subject: string
          template: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          origin_node_id?: string | null
          payload?: Json
          recipient: string
          related_entity?: string | null
          related_entity_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string | null
          last_error?: string | null
          origin_node_id?: string | null
          payload?: Json
          recipient?: string
          related_entity?: string | null
          related_entity_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_queue_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          catalog_item_id: string | null
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          invoice_id: string
          last_modified_by: string | null
          line_discount: number
          line_gross: number
          line_net: number
          line_tax: number
          line_total: number
          name: string
          origin_node_id: string | null
          position: number
          quantity: number
          tax_rate: number
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          catalog_item_id?: string | null
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          invoice_id: string
          last_modified_by?: string | null
          line_discount?: number
          line_gross?: number
          line_net?: number
          line_tax?: number
          line_total?: number
          name: string
          origin_node_id?: string | null
          position?: number
          quantity?: number
          tax_rate?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          catalog_item_id?: string | null
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          invoice_id?: string
          last_modified_by?: string | null
          line_discount?: number
          line_gross?: number
          line_net?: number
          line_tax?: number
          line_total?: number
          name?: string
          origin_node_id?: string | null
          position?: number
          quantity?: number
          tax_rate?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "quote_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["invoice_status"] | null
          id: string
          invoice_id: string
          note: string | null
          to_status: Database["public"]["Enums"]["invoice_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["invoice_status"] | null
          id?: string
          invoice_id: string
          note?: string | null
          to_status: Database["public"]["Enums"]["invoice_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["invoice_status"] | null
          id?: string
          invoice_id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["invoice_status"]
        }
        Relationships: [
          {
            foreignKeyName: "invoice_status_history_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          assigned_to: string | null
          cancelled_at: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          deleted_at: string | null
          discount_amount: number
          discount_type: Database["public"]["Enums"]["quote_discount_type"]
          discount_value: number
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          last_modified_by: string | null
          notes: string | null
          origin_node_id: string | null
          paid_at: string | null
          payment_terms: string | null
          quote_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          title: string
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          assigned_to?: string | null
          cancelled_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          deleted_at?: string | null
          discount_amount?: number
          discount_type?: Database["public"]["Enums"]["quote_discount_type"]
          discount_value?: number
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          last_modified_by?: string | null
          notes?: string | null
          origin_node_id?: string | null
          paid_at?: string | null
          payment_terms?: string | null
          quote_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          title?: string
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          assigned_to?: string | null
          cancelled_at?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          deleted_at?: string | null
          discount_amount?: number
          discount_type?: Database["public"]["Enums"]["quote_discount_type"]
          discount_value?: number
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          last_modified_by?: string | null
          notes?: string | null
          origin_node_id?: string | null
          paid_at?: string | null
          payment_terms?: string | null
          quote_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          title?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
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
      lead_assignment_queue: {
        Row: {
          active: boolean
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          position: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["lead_status"] | null
          id: string
          lead_id: string
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id: string
          to_status: Database["public"]["Enums"]["lead_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["lead_status"] | null
          id?: string
          lead_id?: string
          to_status?: Database["public"]["Enums"]["lead_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          company_name: string | null
          converted_deal_id: string | null
          created_at: string
          currency: string | null
          deleted_at: string | null
          disqualify_reason: string | null
          email: string
          email_status: string | null
          expected_close_date: string | null
          first_name: string
          id: string
          ip_country: string | null
          last_modified_by: string | null
          last_name: string
          last_status_change_at: string | null
          message: string | null
          origin_node_id: string | null
          overdue_at: string | null
          phone: string | null
          qualified: boolean
          source: string
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          company_name?: string | null
          converted_deal_id?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          disqualify_reason?: string | null
          email: string
          email_status?: string | null
          expected_close_date?: string | null
          first_name: string
          id?: string
          ip_country?: string | null
          last_modified_by?: string | null
          last_name: string
          last_status_change_at?: string | null
          message?: string | null
          origin_node_id?: string | null
          overdue_at?: string | null
          phone?: string | null
          qualified?: boolean
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          company_name?: string | null
          converted_deal_id?: string | null
          created_at?: string
          currency?: string | null
          deleted_at?: string | null
          disqualify_reason?: string | null
          email?: string
          email_status?: string | null
          expected_close_date?: string | null
          first_name?: string
          id?: string
          ip_country?: string | null
          last_modified_by?: string | null
          last_name?: string
          last_status_change_at?: string | null
          message?: string | null
          origin_node_id?: string | null
          overdue_at?: string | null
          phone?: string | null
          qualified?: boolean
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      loss_reasons: {
        Row: {
          created_at: string
          id: string
          label: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          position: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          deleted_at: string | null
          entity: string | null
          entity_id: string | null
          id: string
          origin_node_id: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          origin_node_id?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          deleted_at?: string | null
          entity?: string | null
          entity_id?: string | null
          id?: string
          origin_node_id?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string
          default_probability: number
          id: string
          is_closed: boolean
          is_won: boolean
          name: string
          position: number
          sla_days: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          default_probability?: number
          id?: string
          is_closed?: boolean
          is_won?: boolean
          name: string
          position: number
          sla_days?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          default_probability?: number
          id?: string
          is_closed?: boolean
          is_won?: boolean
          name?: string
          position?: number
          sla_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          last_login_at: string | null
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          last_login_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          last_login_at?: string | null
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      quote_catalog_items: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          tax_rate: number
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          tax_rate?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          tax_rate?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      quote_line_items: {
        Row: {
          catalog_item_id: string | null
          created_at: string
          description: string | null
          discount_percent: number
          id: string
          last_modified_by: string | null
          line_discount: number
          line_gross: number
          line_net: number
          line_tax: number
          line_total: number
          name: string
          origin_node_id: string | null
          position: number
          quantity: number
          quote_id: string
          tax_rate: number
          unit: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          catalog_item_id?: string | null
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          last_modified_by?: string | null
          line_discount?: number
          line_gross?: number
          line_net?: number
          line_tax?: number
          line_total?: number
          name: string
          origin_node_id?: string | null
          position?: number
          quantity?: number
          quote_id: string
          tax_rate?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          catalog_item_id?: string | null
          created_at?: string
          description?: string | null
          discount_percent?: number
          id?: string
          last_modified_by?: string | null
          line_discount?: number
          line_gross?: number
          line_net?: number
          line_tax?: number
          line_total?: number
          name?: string
          origin_node_id?: string | null
          position?: number
          quantity?: number
          quote_id?: string
          tax_rate?: number
          unit?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "quote_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status: Database["public"]["Enums"]["quote_status"] | null
          id: string
          note: string | null
          quote_id: string
          to_status: Database["public"]["Enums"]["quote_status"]
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["quote_status"] | null
          id?: string
          note?: string | null
          quote_id: string
          to_status: Database["public"]["Enums"]["quote_status"]
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status?: Database["public"]["Enums"]["quote_status"] | null
          id?: string
          note?: string | null
          quote_id?: string
          to_status?: Database["public"]["Enums"]["quote_status"]
        }
        Relationships: [
          {
            foreignKeyName: "quote_status_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          assigned_to: string | null
          company_id: string | null
          contact_id: string | null
          converted_deal_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          deal_id: string | null
          decision_note: string | null
          deleted_at: string | null
          discount_amount: number
          discount_type: Database["public"]["Enums"]["quote_discount_type"]
          discount_value: number
          id: string
          issue_date: string
          last_modified_by: string | null
          notes: string | null
          origin_node_id: string | null
          quote_number: string
          rejected_at: string | null
          root_quote_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["quote_status"]
          subtotal: number
          supersedes_quote_id: string | null
          tax_amount: number
          terms: string | null
          title: string
          total: number
          updated_at: string
          valid_until: string | null
          version: number
        }
        Insert: {
          accepted_at?: string | null
          assigned_to?: string | null
          company_id?: string | null
          contact_id?: string | null
          converted_deal_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          decision_note?: string | null
          deleted_at?: string | null
          discount_amount?: number
          discount_type?: Database["public"]["Enums"]["quote_discount_type"]
          discount_value?: number
          id?: string
          issue_date?: string
          last_modified_by?: string | null
          notes?: string | null
          origin_node_id?: string | null
          quote_number: string
          rejected_at?: string | null
          root_quote_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          supersedes_quote_id?: string | null
          tax_amount?: number
          terms?: string | null
          title: string
          total?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Update: {
          accepted_at?: string | null
          assigned_to?: string | null
          company_id?: string | null
          contact_id?: string | null
          converted_deal_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deal_id?: string | null
          decision_note?: string | null
          deleted_at?: string | null
          discount_amount?: number
          discount_type?: Database["public"]["Enums"]["quote_discount_type"]
          discount_value?: number
          id?: string
          issue_date?: string
          last_modified_by?: string | null
          notes?: string | null
          origin_node_id?: string | null
          quote_number?: string
          rejected_at?: string | null
          root_quote_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"]
          subtotal?: number
          supersedes_quote_id?: string | null
          tax_amount?: number
          terms?: string | null
          title?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_deal_id_fkey"
            columns: ["converted_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_root_quote_id_fkey"
            columns: ["root_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_supersedes_quote_id_fkey"
            columns: ["supersedes_quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount: number
          assigned_to: string | null
          company_id: string | null
          contact_id: string | null
          created_at: string
          currency: string
          deal_id: string | null
          deleted_at: string | null
          id: string
          invoice_id: string
          issued_at: string
          issued_by: string | null
          last_modified_by: string | null
          notes: string | null
          origin_node_id: string | null
          payment_date: string
          payment_method: string
          quote_id: string | null
          receipt_number: string
          reference: string | null
          status: Database["public"]["Enums"]["receipt_status"]
          updated_at: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          assigned_to?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          deleted_at?: string | null
          id?: string
          invoice_id: string
          issued_at?: string
          issued_by?: string | null
          last_modified_by?: string | null
          notes?: string | null
          origin_node_id?: string | null
          payment_date?: string
          payment_method?: string
          quote_id?: string | null
          receipt_number?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          company_id?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          deleted_at?: string | null
          id?: string
          invoice_id?: string
          issued_at?: string
          issued_by?: string | null
          last_modified_by?: string | null
          notes?: string | null
          origin_node_id?: string | null
          payment_date?: string
          payment_method?: string
          quote_id?: string | null
          receipt_number?: string
          reference?: string | null
          status?: Database["public"]["Enums"]["receipt_status"]
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "receipts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_checkpoints: {
        Row: {
          created_at: string
          id: string
          last_pulled_at: string | null
          last_pushed_at: string | null
          local_node_id: string
          remote_node_id: string
          table_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_pulled_at?: string | null
          last_pushed_at?: string | null
          local_node_id: string
          remote_node_id: string
          table_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_pulled_at?: string | null
          last_pushed_at?: string | null
          local_node_id?: string
          remote_node_id?: string
          table_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_checkpoints_local_node_id_fkey"
            columns: ["local_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_checkpoints_remote_node_id_fkey"
            columns: ["remote_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_conflicts: {
        Row: {
          conflict_type: string
          created_at: string
          id: string
          local_node_id: string | null
          local_payload: Json | null
          remote_node_id: string | null
          remote_payload: Json | null
          resolution: string
          resolved_payload: Json | null
          row_pk: string
          table_name: string
        }
        Insert: {
          conflict_type: string
          created_at?: string
          id?: string
          local_node_id?: string | null
          local_payload?: Json | null
          remote_node_id?: string | null
          remote_payload?: Json | null
          resolution: string
          resolved_payload?: Json | null
          row_pk: string
          table_name: string
        }
        Update: {
          conflict_type?: string
          created_at?: string
          id?: string
          local_node_id?: string | null
          local_payload?: Json | null
          remote_node_id?: string | null
          remote_payload?: Json | null
          resolution?: string
          resolved_payload?: Json | null
          row_pk?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_conflicts_local_node_id_fkey"
            columns: ["local_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_conflicts_remote_node_id_fkey"
            columns: ["remote_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_nodes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          last_seen_at: string | null
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          last_seen_at?: string | null
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          last_seen_at?: string | null
          name?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          direction: string
          error_message: string | null
          finished_at: string | null
          id: string
          local_node_id: string | null
          remote_node_id: string | null
          rows_changed: number
          rows_processed: number
          started_at: string
          status: string
          tables_processed: string[]
        }
        Insert: {
          direction: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          local_node_id?: string | null
          remote_node_id?: string | null
          rows_changed?: number
          rows_processed?: number
          started_at?: string
          status: string
          tables_processed?: string[]
        }
        Update: {
          direction?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          local_node_id?: string | null
          remote_node_id?: string | null
          rows_changed?: number
          rows_processed?: number
          started_at?: string
          status?: string
          tables_processed?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_local_node_id_fkey"
            columns: ["local_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_runs_remote_node_id_fkey"
            columns: ["remote_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          due_at: string | null
          id: string
          last_modified_by: string | null
          notes: string | null
          origin_node_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          reminder_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          type: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          due_at?: string | null
          id?: string
          last_modified_by?: string | null
          notes?: string | null
          origin_node_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          reminder_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          due_at?: string | null
          id?: string
          last_modified_by?: string | null
          notes?: string | null
          origin_node_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          reminder_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_origin_node_id_fkey"
            columns: ["origin_node_id"]
            isOneToOne: false
            referencedRelation: "sync_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invites: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      automation_rule_config: { Args: { _rule_id: string }; Returns: Json }
      automation_rule_enabled: { Args: { _rule_id: string }; Returns: boolean }
      can_access_invoice: { Args: { _invoice_id: string }; Returns: boolean }
      can_access_quote: { Args: { _quote_id: string }; Returns: boolean }
      can_assign_owner: { Args: { _target: string }; Returns: boolean }
      capture_landing_lead: {
        Args: {
          p_company_name: string
          p_email: string
          p_first_name: string
          p_ip_country: string
          p_last_name: string
          p_message: string
          p_phone: string
        }
        Returns: string
      }
      convert_lead_to_deal: {
        Args: {
          _deal_name: string
          _lead_id: string
          _stage_id?: string
          _value?: number
        }
        Returns: string
      }
      create_auto_task: {
        Args: {
          _assigned_to: string
          _contact_id?: string
          _deal_id?: string
          _due_in_days: number
          _priority?: Database["public"]["Enums"]["task_priority"]
          _reminder_in_days?: number
          _title: string
          _type: string
        }
        Returns: string
      }
      create_invoice_from_quote: {
        Args: { _quote_id: string }
        Returns: string
      }
      cron_daily_digest: { Args: never; Returns: number }
      cron_reengagement_sweep: { Args: never; Returns: number }
      cron_reminder_dispatch: { Args: never; Returns: number }
      cron_sla_monitor: { Args: never; Returns: number }
      current_role_label: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      expire_stale_quotes: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit_system: {
        Args: {
          _action: string
          _entity: string
          _entity_id: string
          _entity_name: string
          _metadata?: Json
        }
        Returns: undefined
      }
      log_automation_run: {
        Args: {
          _action: string
          _message?: string
          _record_id: string
          _record_name: string
          _record_type: string
          _result?: string
          _rule_id: string
        }
        Returns: undefined
      }
      next_invoice_number: { Args: never; Returns: string }
      next_quote_number: { Args: never; Returns: string }
      next_receipt_number: { Args: never; Returns: string }
      notify_user: {
        Args: {
          _body: string
          _entity?: string
          _entity_id?: string
          _title: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      queue_email: {
        Args: {
          _entity?: string
          _entity_id?: string
          _payload: Json
          _recipient: string
          _subject: string
          _template: string
        }
        Returns: string
      }
      recalculate_invoice_totals: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      recalculate_invoice_payments: {
        Args: { _invoice_id: string }
        Returns: undefined
      }
      recalculate_quote_totals: {
        Args: { _quote_id: string }
        Returns: undefined
      }
      revise_quote: { Args: { _quote_id: string }; Returns: string }
      set_user_role: {
        Args: {
          target_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      update_deal_value: {
        Args: { _deal_id: string; _new_value: number; _reason: string }
        Returns: undefined
      }
    }
    Enums: {
      activity_type: "call" | "email" | "meeting" | "demo" | "proposal" | "note"
      app_role: "admin" | "manager" | "rep"
      invoice_status:
        | "draft"
        | "sent"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "converted"
        | "disqualified"
      quote_discount_type: "none" | "percent" | "amount"
      quote_status: "draft" | "sent" | "accepted" | "rejected" | "expired"
      receipt_status: "issued" | "void"
      task_priority: "low" | "medium" | "high"
      task_status: "pending" | "in_progress" | "done" | "cancelled"
      user_status: "active" | "inactive" | "invited"
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
      activity_type: ["call", "email", "meeting", "demo", "proposal", "note"],
      app_role: ["admin", "manager", "rep"],
      invoice_status: [
        "draft",
        "sent",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "converted",
        "disqualified",
      ],
      quote_discount_type: ["none", "percent", "amount"],
      quote_status: ["draft", "sent", "accepted", "rejected", "expired"],
      receipt_status: ["issued", "void"],
      task_priority: ["low", "medium", "high"],
      task_status: ["pending", "in_progress", "done", "cancelled"],
      user_status: ["active", "inactive", "invited"],
    },
  },
} as const
