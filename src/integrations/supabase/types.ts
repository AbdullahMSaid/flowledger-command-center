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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      alert_history: {
        Row: {
          condition_type: string
          created_at: string
          flow_id: string | null
          flow_name: string | null
          id: string
          rule_id: string | null
          rule_name: string
          status: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          condition_type: string
          created_at?: string
          flow_id?: string | null
          flow_name?: string | null
          id?: string
          rule_id?: string | null
          rule_name: string
          status?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          condition_type?: string
          created_at?: string
          flow_id?: string | null
          flow_name?: string | null
          id?: string
          rule_id?: string | null
          rule_name?: string
          status?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_history_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          condition_type: string
          created_at: string
          enabled: boolean
          flow_id: string | null
          id: string
          name: string
          notify_email: boolean
          scope: string
          slack_webhook_url: string | null
          threshold: number
          user_id: string
          workspace_id: string
        }
        Insert: {
          condition_type: string
          created_at?: string
          enabled?: boolean
          flow_id?: string | null
          id?: string
          name: string
          notify_email?: boolean
          scope?: string
          slack_webhook_url?: string | null
          threshold: number
          user_id: string
          workspace_id: string
        }
        Update: {
          condition_type?: string
          created_at?: string
          enabled?: boolean
          flow_id?: string | null
          id?: string
          name?: string
          notify_email?: boolean
          scope?: string
          slack_webhook_url?: string | null
          threshold?: number
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flows: {
        Row: {
          accountable_owner_member_id: string | null
          approval_status: string
          archived_at: string | null
          business_purpose: string | null
          budget_limit: number | null
          budget_owner_member_id: string | null
          control_state: string
          created_at: string
          created_by: string
          daily_budget_limit: number | null
          description: string | null
          emergency_stop_reason: string | null
          emergency_stopped_at: string | null
          emergency_stopped_by: string | null
          environment: string
          expected_monthly_value_usd: number | null
          expected_outcome: string | null
          experiment_ended_at: string | null
          experiment_started_at: string | null
          flow_enabled: boolean
          id: string
          model: string
          next_review_at: string | null
          name: string
          platform: string
          protection_mode: string
          reviewed_by: string | null
          last_reviewed_at: string | null
          team_label: string | null
          target_quantity: number | null
          user_id: string
          value_assumptions: string | null
          value_currency: string
          value_per_unit_usd: number | null
          value_source: string | null
          workspace_id: string
        }
        Insert: {
          accountable_owner_member_id?: string | null
          approval_status?: string
          archived_at?: string | null
          business_purpose?: string | null
          budget_limit?: number | null
          budget_owner_member_id?: string | null
          control_state?: string
          created_at?: string
          created_by?: string
          daily_budget_limit?: number | null
          description?: string | null
          emergency_stop_reason?: string | null
          emergency_stopped_at?: string | null
          emergency_stopped_by?: string | null
          environment?: string
          expected_monthly_value_usd?: number | null
          expected_outcome?: string | null
          experiment_ended_at?: string | null
          experiment_started_at?: string | null
          flow_enabled?: boolean
          id?: string
          model: string
          next_review_at?: string | null
          name: string
          platform: string
          protection_mode?: string
          reviewed_by?: string | null
          last_reviewed_at?: string | null
          team_label?: string | null
          target_quantity?: number | null
          user_id: string
          value_assumptions?: string | null
          value_currency?: string
          value_per_unit_usd?: number | null
          value_source?: string | null
          workspace_id?: string
        }
        Update: {
          accountable_owner_member_id?: string | null
          approval_status?: string
          archived_at?: string | null
          business_purpose?: string | null
          budget_limit?: number | null
          budget_owner_member_id?: string | null
          control_state?: string
          created_at?: string
          created_by?: string
          daily_budget_limit?: number | null
          description?: string | null
          emergency_stop_reason?: string | null
          emergency_stopped_at?: string | null
          emergency_stopped_by?: string | null
          environment?: string
          expected_monthly_value_usd?: number | null
          expected_outcome?: string | null
          experiment_ended_at?: string | null
          experiment_started_at?: string | null
          flow_enabled?: boolean
          id?: string
          model?: string
          next_review_at?: string | null
          name?: string
          platform?: string
          protection_mode?: string
          reviewed_by?: string | null
          last_reviewed_at?: string | null
          team_label?: string | null
          target_quantity?: number | null
          user_id?: string
          value_assumptions?: string | null
          value_currency?: string
          value_per_unit_usd?: number | null
          value_source?: string | null
          workspace_id?: string
        }
        Relationships: []
      }
      runs: {
        Row: {
          bound_violation: boolean
          cost_usd: number
          created_at: string
          duration_ms: number
          event_id: string | null
          error_message: string | null
          flow_id: string
          id: string
          reservation_id: string | null
          source: string
          status: string
          token_count: number
        }
        Insert: {
          bound_violation?: boolean
          cost_usd: number
          created_at?: string
          duration_ms: number
          event_id?: string | null
          error_message?: string | null
          flow_id: string
          id?: string
          reservation_id?: string | null
          source?: string
          status: string
          token_count: number
        }
        Update: {
          bound_violation?: boolean
          cost_usd?: number
          created_at?: string
          duration_ms?: number
          event_id?: string | null
          error_message?: string | null
          flow_id?: string
          id?: string
          reservation_id?: string | null
          source?: string
          status?: string
          token_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "runs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "flows"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: { id: string; owner_user_id: string; name: string; created_at: string }
        Insert: { id?: string; owner_user_id: string; name: string; created_at?: string }
        Update: { id?: string; owner_user_id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      workspace_members: {
        Row: { id: string; workspace_id: string; user_id: string; role: string; created_at: string }
        Insert: { id?: string; workspace_id: string; user_id: string; role?: string; created_at?: string }
        Update: { id?: string; workspace_id?: string; user_id?: string; role?: string; created_at?: string }
        Relationships: []
      }
      guard_reservations: {
        Row: { id: string; flow_id: string; request_id: string; max_cost_usd: number; actual_cost_usd: number | null; status: string; allowed: boolean; reason: string; bound_violation: boolean; created_at: string; settled_at: string | null }
        Insert: { id?: string; flow_id: string; request_id: string; max_cost_usd: number; actual_cost_usd?: number | null; status?: string; allowed: boolean; reason: string; bound_violation?: boolean; created_at?: string; settled_at?: string | null }
        Update: { id?: string; flow_id?: string; request_id?: string; max_cost_usd?: number; actual_cost_usd?: number | null; status?: string; allowed?: boolean; reason?: string; bound_violation?: boolean; created_at?: string; settled_at?: string | null }
        Relationships: []
      }
      incidents: {
        Row: { id: string; workspace_id: string; flow_id: string | null; severity: string; status: string; reason: string; baseline_rate: number | null; current_rate: number | null; threshold: number | null; observed_cost_usd: number; blocked_request_count: number; evidence: Json; detected_at: string; resolved_at: string | null; resolution_note: string | null; resolved_by: string | null }
        Insert: { id?: string; workspace_id: string; flow_id?: string | null; severity: string; status?: string; reason: string; baseline_rate?: number | null; current_rate?: number | null; threshold?: number | null; observed_cost_usd?: number; blocked_request_count?: number; evidence?: Json; detected_at?: string; resolved_at?: string | null; resolution_note?: string | null; resolved_by?: string | null }
        Update: { id?: string; workspace_id?: string; flow_id?: string | null; severity?: string; status?: string; reason?: string; baseline_rate?: number | null; current_rate?: number | null; threshold?: number | null; observed_cost_usd?: number; blocked_request_count?: number; evidence?: Json; detected_at?: string; resolved_at?: string | null; resolution_note?: string | null; resolved_by?: string | null }
        Relationships: []
      }
      audit_log: {
        Row: { id: string; workspace_id: string; actor_user_id: string; entity_type: string; entity_id: string | null; action: string; reason: string | null; old_values: Json | null; new_values: Json | null; created_at: string }
        Insert: { id?: string; workspace_id: string; actor_user_id: string; entity_type: string; entity_id?: string | null; action: string; reason?: string | null; old_values?: Json | null; new_values?: Json | null; created_at?: string }
        Update: { id?: string; workspace_id?: string; actor_user_id?: string; entity_type?: string; entity_id?: string | null; action?: string; reason?: string | null; old_values?: Json | null; new_values?: Json | null; created_at?: string }
        Relationships: []
      }
      flow_credentials: {
        Row: { id: string; flow_id: string; secret_hash: string; created_by: string; created_at: string; revoked_at: string | null }
        Insert: { id?: string; flow_id: string; secret_hash: string; created_by: string; created_at?: string; revoked_at?: string | null }
        Update: { id?: string; flow_id?: string; secret_hash?: string; created_by?: string; created_at?: string; revoked_at?: string | null }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authorize_guard_request: {
        Args: { p_flow_id: string; p_request_id: string; p_max_cost_usd: number }
        Returns: { allowed: boolean; reason: string; reservation_id: string; remaining_budget_usd: number | null }[]
      }
      record_ingest_run: {
        Args: { p_flow_id: string; p_event_id: string; p_status: string; p_duration_ms: number; p_token_count: number; p_cost_usd: number; p_error_message?: string | null; p_source?: string }
        Returns: { recorded: boolean; run_id: string; duplicate: boolean; control_allow_next: boolean; control_reason: string }[]
      }
      set_flow_control: {
        Args: { p_flow_id: string; p_action: string; p_reason?: string | null }
        Returns: { flow_enabled: boolean; control_state: string }[]
      }
      get_workspace_summary: {
        Args: { p_workspace_id: string; p_period_start: string; p_period_end: string }
        Returns: Json
      }
      review_flow: {
        Args: { p_flow_id: string; p_approval_status: string; p_environment: string; p_next_review_at: string | null; p_reason?: string | null }
        Returns: { approval_status: string; environment: string; last_reviewed_at: string }[]
      }
      get_workspace_inventory: {
        Args: { p_workspace_id: string; p_period_start: string; p_period_end: string; p_limit?: number; p_offset?: number }
        Returns: {
          flow_id: string
          name: string
          description: string | null
          business_purpose: string | null
          expected_outcome: string | null
          target_quantity: number | null
          value_per_unit_usd: number | null
          value_assumptions: string | null
          platform: string
          model: string
          team_label: string | null
          environment: string
          approval_status: string
          protection_mode: string
          control_state: string
          flow_enabled: boolean
          accountable_owner_member_id: string | null
          expected_monthly_value_usd: number | null
          value_currency: string
          value_source: string | null
          today_cost_usd: number
          period_cost_usd: number
          period_run_count: number
          period_token_count: number
          last_run_at: string | null
          archived_at: string | null
        }[]
      }
      resolve_incident: {
        Args: { p_incident_id: string; p_resolution_note: string }
        Returns: { status: string; resolved_at: string }[]
      }
      set_flow_policy: {
        Args: { p_flow_id: string; p_budget_limit: number | null; p_daily_budget_limit: number | null; p_protection_mode: string; p_reason?: string | null }
        Returns: { budget_limit: number | null; daily_budget_limit: number | null; protection_mode: string }[]
      }
      get_flow_detail_summary: {
        Args: { p_flow_id: string }
        Returns: Json
      }
      set_flow_value: {
        Args: { p_flow_id: string; p_expected_outcome: string | null; p_target_quantity: number | null; p_value_per_unit_usd: number | null; p_expected_monthly_value_usd: number | null; p_value_source: string | null; p_value_assumptions: string | null; p_reason?: string | null }
        Returns: { expected_monthly_value_usd: number | null; value_source: string | null }[]
      }
      set_flow_governance: {
        Args: { p_flow_id: string; p_accountable_owner_member_id: string | null; p_budget_owner_member_id: string | null; p_team_label: string | null; p_business_purpose: string | null; p_reason?: string | null }
        Returns: { accountable_owner_member_id: string | null; budget_owner_member_id: string | null; team_label: string | null; business_purpose: string | null }[]
      }
      archive_flow: {
        Args: { p_flow_id: string; p_reason?: string | null }
        Returns: { archived_at: string; flow_enabled: boolean; control_state: string }[]
      }
      seed_workflow_sample_activity: {
        Args: { p_flow_id: string }
        Returns: { run_count: number; token_count: number; cost_usd: number }[]
      }
      get_workspace_members: {
        Args: { p_workspace_id: string }
        Returns: { member_id: string; user_id: string; role: string }[]
      }
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
    Enums: {},
  },
} as const
