import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './client';
import type { Database, Json } from './types';

// Supplement the generated schema with the repository's existing runtime ledger.
// Keep client.ts and types.ts generated; this adapter reuses their authenticated
// client/session and changes no request, permission, or runtime configuration.
// Schema source: 20260725225100_restore_hermes_runtime_ledger.sql.
type HermesTelemetryDatabase = Database & {
  public: Database['public'] & {
    Tables: Database['public']['Tables'] & {
      // Schema from 20260725225100_restore_hermes_runtime_ledger.sql.
      hermes_runs: {
        Row: {
          agent_name: string
          cost_usd: number | null
          created_at: string
          duration_ms: number | null
          ended_at: string | null
          error_detail: string | null
          exit_status: string | null
          finished_at: string | null
          id: string
          output: Json | null
          output_snapshot: Json | null
          run_number: number
          started_at: string
          status: string
          task_id: string
          tokens_used: number | null
        }
        Insert: {
          agent_name: string
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          ended_at?: string | null
          error_detail?: string | null
          exit_status?: string | null
          finished_at?: string | null
          id?: string
          output?: Json | null
          output_snapshot?: Json | null
          run_number?: number
          started_at?: string
          status?: string
          task_id: string
          tokens_used?: number | null
        }
        Update: {
          agent_name?: string
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          ended_at?: string | null
          error_detail?: string | null
          exit_status?: string | null
          finished_at?: string | null
          id?: string
          output?: Json | null
          output_snapshot?: Json | null
          run_number?: number
          started_at?: string
          status?: string
          task_id?: string
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hermes_runs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "hermes_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
  }
};

export const hermesTelemetry = supabase as SupabaseClient<HermesTelemetryDatabase>;
