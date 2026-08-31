export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      chat_messages: {
        Row: {
          content: string;
          created_at: string;
          display_name: string;
          id: string;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string;
          display_name?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          display_name?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      flood_reports: {
        Row: {
          cep: string | null;
          created_at: string;
          hidden_at: string | null;
          id: string;
          lat: number;
          lng: number;
          photo_url: string;
          trafficability: string;
          user_id: string;
          water_level: string;
          weight: number;
        };
        Insert: {
          cep?: string | null;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
          lat: number;
          lng: number;
          photo_url: string;
          trafficability: string;
          user_id: string;
          water_level: string;
          weight?: number;
        };
        Update: {
          cep?: string | null;
          created_at?: string;
          hidden_at?: string | null;
          id?: string;
          lat?: number;
          lng?: number;
          photo_url?: string;
          trafficability?: string;
          user_id?: string;
          water_level?: string;
          weight?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          is_admin: boolean;
          points: number;
          reports_count: number;
        };
        Insert: {
          created_at?: string;
          display_name?: string;
          id: string;
          is_admin?: boolean;
          points?: number;
          reports_count?: number;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          id?: string;
          is_admin?: boolean;
          points?: number;
          reports_count?: number;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      purge_old_flood_reports: { Args: never; Returns: undefined };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type DefaultSchema = Database["public"];

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"];
