export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      game_rounds: {
        Row: {
          bet: number;
          created_at: string;
          details: Json;
          game_slug: string;
          id: string;
          multiplier: number;
          payout: number;
          user_id: string;
        };
        Insert: {
          bet: number;
          created_at?: string;
          details?: Json;
          game_slug: string;
          id?: string;
          multiplier?: number;
          payout?: number;
          user_id: string;
        };
        Update: {
          bet?: number;
          created_at?: string;
          details?: Json;
          game_slug?: string;
          id?: string;
          multiplier?: number;
          payout?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      players: {
        Row: {
          balance: number;
          created_at: string;
          id: string;
          last_bonus_at: string | null;
          total_wagered: number;
          total_won: number;
          updated_at: string;
          username: string;
        };
        Insert: {
          balance?: number;
          created_at?: string;
          id: string;
          last_bonus_at?: string | null;
          total_wagered?: number;
          total_won?: number;
          updated_at?: string;
          username: string;
        };
        Update: {
          balance?: number;
          created_at?: string;
          id?: string;
          last_bonus_at?: string | null;
          total_wagered?: number;
          total_won?: number;
          updated_at?: string;
          username?: string;
        };
        Relationships: [];
      };
      public_wins: {
        Row: {
          created_at: string;
          game_slug: string;
          id: string;
          masked_player: string;
          multiplier: number;
        };
        Insert: {
          created_at?: string;
          game_slug: string;
          id?: string;
          masked_player: string;
          multiplier: number;
        };
        Update: {
          created_at?: string;
          game_slug?: string;
          id?: string;
          masked_player?: string;
          multiplier?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_daily_bonus: {
        Args: never;
        Returns: {
          balance: number;
          created_at: string;
          id: string;
          last_bonus_at: string | null;
          total_wagered: number;
          total_won: number;
          updated_at: string;
          username: string;
        };
        SetofOptions: {
          from: "*";
          to: "players";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ensure_player: {
        Args: { _username?: string };
        Returns: {
          balance: number;
          created_at: string;
          id: string;
          last_bonus_at: string | null;
          total_wagered: number;
          total_won: number;
          updated_at: string;
          username: string;
        };
        SetofOptions: {
          from: "*";
          to: "players";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      play_round: {
        Args: {
          _bet: number;
          _details?: Json;
          _game_slug: string;
          _multiplier: number;
        };
        Returns: {
          balance: number;
          created_at: string;
          id: string;
          last_bonus_at: string | null;
          total_wagered: number;
          total_won: number;
          updated_at: string;
          username: string;
        };
        SetofOptions: {
          from: "*";
          to: "players";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
