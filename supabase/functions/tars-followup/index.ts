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
    const currentDepth = Number(task.depth || 0);
    const maxDepth = Number(task.max_depth || 3);
    if (currentDepth >= maxDepth) {
      await recordCheckpoint(supabase, task.id, task.goal_id, "Followup Cap Reached", `Auto-followup halted at depth ${currentDepth}/${maxDepth}.`);
      await recordTaskEvent(supabase, task.id, task.goal_id, "followup_depth_capped", { current_depth: currentDepth, max_depth: maxDepth });
      await supabase.from("hermes_tasks").update({ status: "completed", completed_at: new Date().toISOString(), result: { message: "Max depth reached", depth_capped: true } }).eq("id", task.id);
      return new Response(JSON.stringify({ success: true, followups: 0, depth_capped: true }), { headers: jsonHeaders });
    }
    const { data: siblings, error: siblingError } = await supabase.from("hermes_tasks").select("id,title,kind,result,status").eq("goal_id", task.goal_id).neq("id", task.id);
    if (siblingError) throw new Error(`Failed to fetch sibling tasks: ${siblingError.message}`);
    const summary = (siblings || []).find((t: any) => t.kind === "tars.summarize" && t.status === "completed");
    const completed = (siblings || []).filter((t: any) => t.status === "completed");
    const content = summary?.result?.brief ? String(summary.result.brief) : completed.map((t: any) => `${t.title}: ${JSON.stringify(t.result)}`).join("\n\n");
    if (!content) throw new Error("No completed sibling material available");
    const llmResult = await callLLM([{ role: "system", content: "You are Hermes TARS.followup. Identify critical remaining knowledge gaps and propose 1 to 3 focused tars.research follow-up tasks. Return valid JSON only with gaps_identified, followups, and reasoning. Each followup must include kind, title, description and payload with queries and urls." }, { role: "user", content: `Current findings:\n${content}\n\nReturn {"gaps_identified":[],"followups":[{"kind":"tars.research","title":"...","description":"...","payload":{"queries":[],"urls":[]}}],"reasoning":"..."}` }], { response_format: { type: "json_object" }, temperature: 0.3 });
    const parsed = JSON.parse(llmResult);
    const followups = Array.isArray(parsed.followups) ? parsed.followups.slice(0, 3) : [];
    const rows = followups.map((t: any, i: number) => ({ goal_id: task.goal_id, parent_task_id: task.id, kind: "tars.research", title: t.title, description: t.description, payload: t.payload || {}, status: "pending", depth: currentDepth + 1, max_depth: maxDepth, sequence_number: i + 1 }));
    if (rows.length) {
      const { error } = await supabase.from("hermes_tasks").insert(rows);
      if (error) throw new Error(`Failed to enqueue followups: ${error.message}`);
    }
    await recordCheckpoint(supabase, task.id, task.goal_id, `Self-Directed Followups Proposed (Depth ${currentDepth + 1})`, JSON.stringify(parsed, null, 2), { gaps: parsed.gaps_identified || [], followups_count: followups.length, depth: currentDepth + 1 });
    await recordTaskEvent(supabase, task.id, task.goal_id, "followup_enqueued", { enqueued_count: followups.length, next_depth: currentDepth + 1 });
    await supabase.from("hermes_tasks").update({ status: "completed", completed_at: new Date().toISOString(), result: parsed }).eq("id", task.id);
    return new Response(JSON.stringify({ success: true, followups: followups.length }), { headers: jsonHeaders });
  } catch (error) {
    console.error("tars-followup", error);
    return new Response(JSON.stringify({ error: "Execution failed" }), { status: 500, headers: jsonHeaders });
  }
});
