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
          locked_at: string | null
          notes: string | null
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
          locked_at?: string | null
          notes?: string | null
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
          locked_at?: string | null
          notes?: string | null
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
        ]
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
        }
        Relationships: []
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
          linkedin: string | null
          logo_url: string | null
          name: string
          notes: string | null
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
          linkedin?: string | null
          logo_url?: string | null
          name: string
          notes?: string | null
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
          linkedin?: string | null
          logo_url?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          rating?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
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
          last_name: string
          notes: string | null
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
          last_name: string
          notes?: string | null
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
          last_name?: string
          notes?: string | null
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
          lost_reason: string | null
          name: string
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
          lost_reason?: string | null
          name: string
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
          lost_reason?: string | null
          name?: string
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
          last_name: string
          message: string | null
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
          last_name: string
          message?: string | null
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
          last_name?: string
          message?: string | null
          phone?: string | null
          qualified?: boolean
          source?: string
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          value?: number | null
        }
        Relationships: []
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
          entity: string | null
          entity_id: string | null
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
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
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          due_at: string | null
          id: string
          notes: string | null
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
          notes?: string | null
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
          notes?: string | null
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
      current_role_label: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      activity_type: "call" | "email" | "meeting" | "demo" | "proposal" | "note"
      app_role: "admin" | "manager" | "rep"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "converted"
        | "disqualified"
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
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "converted",
        "disqualified",
      ],
      task_priority: ["low", "medium", "high"],
      task_status: ["pending", "in_progress", "done", "cancelled"],
      user_status: ["active", "inactive", "invited"],
    },
  },
} as const
