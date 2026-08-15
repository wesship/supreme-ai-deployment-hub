import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  callLLM,
  getSupabaseClient,
  recordCheckpoint,
  recordTaskEvent,
  requireServiceRole,
} from "../_shared/utils.ts";

const jsonHeaders = { "Content-Type": "application/json" };

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: jsonHeaders,
      });
    }
    if (!requireServiceRole(req)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: jsonHeaders,
      });
    }

    const supabase = getSupabaseClient();
    const { task } = await req.json();
    if (!task?.id || !task?.goal_id) {
      return new Response(JSON.stringify({ error: "Invalid task" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    await supabase
      .from("hermes_tasks")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("id", task.id);

    const { data: goal, error: goalError } = await supabase
      .from("hermes_goals")
      .select("*")
      .eq("id", task.goal_id)
      .single();
    if (goalError || !goal) {
      throw new Error(`Failed to fetch goal: ${goalError?.message || "Goal not found"}`);
    }

    await recordTaskEvent(supabase, task.id, task.goal_id, "plan_started", {
      goal_title: goal.title,
      goal_description: goal.description,
    });

    const systemPrompt =
      "You are Hermes TARS.plan. Break the user's goal into 3 to 7 coherent research/execution tasks. Allowed task kinds are tars.research and tars.summarize. Return valid JSON only with keys tasks and reasoning. Each task must include kind, title, description and payload containing queries and urls.";
    const userPrompt = `Goal Title: ${goal.title}\nGoal Description: ${goal.description || "No description provided."}\nReturn {"tasks":[{"kind":"tars.research","title":"...","description":"...","payload":{"queries":[],"urls":[]}}],"reasoning":"..."}`;

    const llmResult = await callLLM(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { response_format: { type: "json_object" }, temperature: 0.2 },
    );
    const parsedPlan = JSON.parse(llmResult);
    const plannedTasks = Array.isArray(parsedPlan.tasks) ? parsedPlan.tasks.slice(0, 7) : [];
    const tasksToInsert = plannedTasks.map((t: any, index: number) => ({
      goal_id: task.goal_id,
      parent_task_id: task.id,
      kind: t.kind,
      title: t.title,
      description: t.description,
      payload: t.payload || {},
      status: "pending",
      depth: (task.depth || 0) + 1,
      max_depth: task.max_depth || 3,
      sequence_number: index + 1,
    }));

    if (tasksToInsert.length) {
      const { error } = await supabase.from("hermes_tasks").insert(tasksToInsert);
      if (error) throw new Error(`Failed to enqueue child tasks: ${error.message}`);
    }

    const content = `### Goal Decomposition Plan\n\n**Reasoning:** ${parsedPlan.reasoning || ""}\n\n${plannedTasks
      .map((t: any, i: number) => `${i + 1}. **${t.title}** (${t.kind})`)
      .join("\n")}`;
    await recordCheckpoint(
      supabase,
      task.id,
      task.goal_id,
      "Goal Decomposition Plan",
      content,
      { planned_task_count: plannedTasks.length, reasoning: parsedPlan.reasoning },
    );
    await recordTaskEvent(supabase, task.id, task.goal_id, "plan_completed", {
      child_task_count: plannedTasks.length,
    });
    await supabase
      .from("hermes_tasks")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        result: parsedPlan,
      })
      .eq("id", task.id);

    return new Response(JSON.stringify({ success: true, planned: plannedTasks.length }), {
      headers: jsonHeaders,
    });
  } catch (error) {
    console.error("tars-plan", error);
    return new Response(JSON.stringify({ error: "Execution failed" }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});
