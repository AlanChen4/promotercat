export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      agent_api_quotas: {
        Row: {
          account_id: string;
          day_count: number;
          day_start: string;
          minute_count: number;
          minute_start: string;
        };
        Insert: {
          account_id: string;
          day_count?: number;
          day_start?: string;
          minute_count?: number;
          minute_start?: string;
        };
        Update: {
          account_id?: string;
          day_count?: number;
          day_start?: string;
          minute_count?: number;
          minute_start?: string;
        };
        Relationships: [];
      };
      subreddit_descriptions: {
        Row: {
          created_at: string;
          description: string | null;
          description_embedding: string | null;
          subreddit_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          description_embedding?: string | null;
          subreddit_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          description_embedding?: string | null;
          subreddit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subreddit_descriptions_subreddit_id_fkey";
            columns: ["subreddit_id"];
            isOneToOne: false;
            referencedRelation: "current_subreddits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subreddit_descriptions_subreddit_id_fkey";
            columns: ["subreddit_id"];
            isOneToOne: false;
            referencedRelation: "subreddits";
            referencedColumns: ["id"];
          },
        ];
      };
      subreddit_members: {
        Row: {
          created_at: string;
          subreddit_id: string;
          weekly_active_users: number | null;
        };
        Insert: {
          created_at?: string;
          subreddit_id: string;
          weekly_active_users?: number | null;
        };
        Update: {
          created_at?: string;
          subreddit_id?: string;
          weekly_active_users?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "subreddit_members_subreddit_id_fkey";
            columns: ["subreddit_id"];
            isOneToOne: false;
            referencedRelation: "current_subreddits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subreddit_members_subreddit_id_fkey";
            columns: ["subreddit_id"];
            isOneToOne: false;
            referencedRelation: "subreddits";
            referencedColumns: ["id"];
          },
        ];
      };
      subreddit_rules: {
        Row: {
          created_at: string;
          description: string | null;
          position: number;
          subreddit_id: string;
          title: string;
        };
        Insert: {
          created_at: string;
          description?: string | null;
          position: number;
          subreddit_id: string;
          title: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          position?: number;
          subreddit_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subreddit_rules_subreddit_id_created_at_fkey";
            columns: ["subreddit_id", "created_at"];
            isOneToOne: false;
            referencedRelation: "subreddit_self_promotion_details";
            referencedColumns: ["subreddit_id", "created_at"];
          },
        ];
      };
      subreddit_self_promotion_details: {
        Row: {
          created_at: string;
          self_promotion: Database["public"]["Enums"]["self_promotion_status"];
          self_promotion_confidence: number | null;
          self_promotion_detail: string;
          subreddit_id: string;
        };
        Insert: {
          created_at?: string;
          self_promotion: Database["public"]["Enums"]["self_promotion_status"];
          self_promotion_confidence?: number | null;
          self_promotion_detail: string;
          subreddit_id: string;
        };
        Update: {
          created_at?: string;
          self_promotion?: Database["public"]["Enums"]["self_promotion_status"];
          self_promotion_confidence?: number | null;
          self_promotion_detail?: string;
          subreddit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subreddit_self_promotion_details_subreddit_id_fkey";
            columns: ["subreddit_id"];
            isOneToOne: false;
            referencedRelation: "current_subreddits";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subreddit_self_promotion_details_subreddit_id_fkey";
            columns: ["subreddit_id"];
            isOneToOne: false;
            referencedRelation: "subreddits";
            referencedColumns: ["id"];
          },
        ];
      };
      subreddits: {
        Row: {
          id: string;
          is_banned: boolean;
          is_restricted: boolean;
          last_refreshed_at: string | null;
          name: string;
        };
        Insert: {
          id?: string;
          is_banned?: boolean;
          is_restricted?: boolean;
          last_refreshed_at?: string | null;
          name: string;
        };
        Update: {
          id?: string;
          is_banned?: boolean;
          is_restricted?: boolean;
          last_refreshed_at?: string | null;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      current_subreddits: {
        Row: {
          description: string | null;
          description_embedding: string | null;
          id: string | null;
          is_banned: boolean | null;
          is_restricted: boolean | null;
          name: string | null;
          self_promotion:
            | Database["public"]["Enums"]["self_promotion_status"]
            | null;
          self_promotion_confidence: number | null;
          self_promotion_detail: string | null;
          weekly_active_users: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      admit_agent_request: { Args: { p_account_id: string }; Returns: Json };
      get_subreddits_due_for_refresh: {
        Args: { p_limit?: number };
        Returns: {
          name: string;
        }[];
      };
      mark_subreddit_banned: { Args: { p_name: string }; Returns: string };
      match_subreddits_by_description: {
        Args: {
          match_count: number;
          match_threshold: number;
          name_terms?: string[];
          query_embedding: string;
        };
        Returns: {
          name: string;
          self_promotion: Database["public"]["Enums"]["self_promotion_status"];
          self_promotion_detail: string;
          weekly_active_users: number;
        }[];
      };
      save_subreddit_snapshot: {
        Args: { p_mode: string; p_rules: Json; p_snapshot: Json };
        Returns: {
          outcome: string;
          subreddit_id: string;
        }[];
      };
    };
    Enums: {
      self_promotion_status:
        | "not_allowed"
        | "unspecified"
        | "allowed_full"
        | "allowed_limited";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      self_promotion_status: [
        "not_allowed",
        "unspecified",
        "allowed_full",
        "allowed_limited",
      ],
    },
  },
} as const;
