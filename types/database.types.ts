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
      rules: {
        Row: {
          description: string | null;
          id: string;
          subreddit_id: string;
          title: string;
        };
        Insert: {
          description?: string | null;
          id?: string;
          subreddit_id: string;
          title: string;
        };
        Update: {
          description?: string | null;
          id?: string;
          subreddit_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rules_subreddit_id_fkey";
            columns: ["subreddit_id"];
            isOneToOne: false;
            referencedRelation: "subreddits";
            referencedColumns: ["id"];
          },
        ];
      };
      subreddit_history: {
        Row: {
          observed_at: string;
          rules: Json | null;
          subreddit_id: string;
          weekly_active_users: number | null;
        };
        Insert: {
          observed_at?: string;
          rules?: Json | null;
          subreddit_id: string;
          weekly_active_users?: number | null;
        };
        Update: {
          observed_at?: string;
          rules?: Json | null;
          subreddit_id?: string;
          weekly_active_users?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "subreddit_history_subreddit_id_fkey";
            columns: ["subreddit_id"];
            isOneToOne: false;
            referencedRelation: "subreddits";
            referencedColumns: ["id"];
          },
        ];
      };
      subreddits: {
        Row: {
          description: string | null;
          description_embedding: string | null;
          id: string;
          last_scraped_at: string | null;
          members_count: number | null;
          name: string;
          self_promotion: Database["public"]["Enums"]["self_promotion_status"];
          self_promotion_confidence: number | null;
          self_promotion_detail: string;
          weekly_active_users: number | null;
        };
        Insert: {
          description?: string | null;
          description_embedding?: string | null;
          id?: string;
          last_scraped_at?: string | null;
          members_count?: number | null;
          name: string;
          self_promotion: Database["public"]["Enums"]["self_promotion_status"];
          self_promotion_confidence?: number | null;
          self_promotion_detail: string;
          weekly_active_users?: number | null;
        };
        Update: {
          description?: string | null;
          description_embedding?: string | null;
          id?: string;
          last_scraped_at?: string | null;
          members_count?: number | null;
          name?: string;
          self_promotion?: Database["public"]["Enums"]["self_promotion_status"];
          self_promotion_confidence?: number | null;
          self_promotion_detail?: string;
          weekly_active_users?: number | null;
        };
        Relationships: [];
      };
      users: {
        Row: {
          created_at: string | null;
          email: string;
          id: string;
          is_premium: boolean | null;
          stripe_customer_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          email: string;
          id?: string;
          is_premium?: boolean | null;
          stripe_customer_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          email?: string;
          id?: string;
          is_premium?: boolean | null;
          stripe_customer_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      match_subreddits_by_description: {
        Args: {
          match_count: number;
          match_threshold: number;
          query_embedding: string;
        };
        Returns: {
          description: string | null;
          description_embedding: string | null;
          id: string;
          last_scraped_at: string | null;
          members_count: number | null;
          name: string;
          self_promotion: Database["public"]["Enums"]["self_promotion_status"];
          self_promotion_confidence: number | null;
          self_promotion_detail: string;
          weekly_active_users: number | null;
        }[];
        SetofOptions: {
          from: "*";
          to: "subreddits";
          isOneToOne: false;
          isSetofReturn: true;
        };
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
