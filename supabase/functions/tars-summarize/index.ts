import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { callLLM, getSupabaseClient, recordCheckpoint, recordTaskEvent, requireServiceRole } from "../_shared/utils.ts";
const jsonHeaders = { "Content-Type": "application/json" };
serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
    if (!requireServiceRole(req)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: jsonHeaders });
    const supabase = getSupabaseClient();
    const { task } = await req.json();
    if (!task?.id || !task?.goal_id) return new Response(JSON.stringify({ error: "Invalid task" }), { status: 400, headers: jsonHeaders });
    await supabase.from("hermes_tasks").update({ status: "processing", started_at: new Date().toISOString() }).eq("id", task.id);
    const { data: goal, error: goalError } = await supabase.from("hermes_goals").select("*").eq("id", task.goal_id).single();
    if (goalError || !goal) throw new Error(`Failed to fetch goal: ${goalError?.message || "Goal not found"}`);
    await recordTaskEvent(supabase, task.id, task.goal_id, "summarize_started", { goal_title: goal.title });
    const { data: siblings, error: siblingError } = await supabase.from("hermes_tasks").select("id,title,description,kind,result,status").eq("goal_id", task.goal_id).neq("id", task.id);
    if (siblingError) throw new Error(`Failed to fetch sibling tasks: ${siblingError.message}`);
    const completed = (siblings || []).filter((t: any) => t.status === "completed");
    if (!completed.length) {
      await recordCheckpoint(supabase, task.id, task.goal_id, "Research Synthesis (Draft)", "No completed sibling tasks were found to synthesize yet.");
      await supabase.from("hermes_tasks").update({ status: "completed", completed_at: new Date().toISOString(), result: { brief: "No tasks to synthesize." } }).eq("id", task.id);
      return new Response(JSON.stringify({ success: true, synthesized: 0 }), { headers: jsonHeaders });
    }
    const taskData = completed.map((t: any, i: number) => `Task ${i + 1}: ${t.title} (${t.kind})\nDescription: ${t.description || ""}\nResult: ${JSON.stringify(t.result)}`).join("\n\n---\n\n");
    const brief = await callLLM([{ role: "system", content: "You are Hermes TARS.summarize. Produce a concise authoritative consolidated research brief from completed sibling task outputs. Use Markdown headings, highlight overlaps or contradictions, include key findings and remaining knowledge gaps." }, { role: "user", content: `Goal: ${goal.title}\nGoal Description: ${goal.description || ""}\n\nCompleted Tasks:\n${taskData}` }], { temperature: 0.3 });
    await recordCheckpoint(supabase, task.id, task.goal_id, `Consolidated Brief: ${goal.title}`, brief, { synthesized_task_ids: completed.map((t: any) => t.id) });
    await recordTaskEvent(supabase, task.id, task.goal_id, "summarize_completed", { synthesized_task_count: completed.length });
    await supabase.from("hermes_tasks").update({ status: "completed", completed_at: new Date().toISOString(), result: { brief, synthesized_tasks: completed.length } }).eq("id", task.id);
    return new Response(JSON.stringify({ success: true, synthesized: completed.length }), { headers: jsonHeaders });
  } catch (error) {
    console.error("tars-summarize", error);
    return new Response(JSON.stringify({ error: "Execution failed" }), { status: 500, headers: jsonHeaders });
  }
});
