import type { Database, Json } from '@/integrations/supabase/types';

// Migration-backed extension for the runtime ledger omitted from the generated
// snapshot. Keep the generated file intact; use the existing authenticated client.
// Schema: 20260529_hermes_brain.sql and
// 20260725225100_restore_hermes_runtime_ledger.sql.
export type HermesRuntimeDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Tables'> & {
    Tables: Database['public']['Tables'] & {
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
          input_snapshot: Json | null
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
          input_snapshot?: Json | null
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
          input_snapshot?: Json | null
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
    };
  };
};
