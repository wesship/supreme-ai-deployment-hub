const byId = (id) => document.getElementById(id);

async function readJson(response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "request_failed");
  return payload;
}

async function health() {
  try {
    const payload = await readJson(await fetch("/health", { cache: "no-store" }));
    byId("status").textContent = payload.ok
      ? `Gateway ready · local inference · voice ${payload.voice_configured ? "configured" : "not configured"}`
      : "Gateway unavailable";
  } catch {
    byId("status").textContent = "Gateway unavailable";
  }
}

byId("send").addEventListener("click", async () => {
  const message = byId("message").value.trim();
  if (!message) return;
  byId("send").disabled = true;
  byId("answer").textContent = "Thinking locally…";
  try {
    const payload = await readJson(
      await fetch("/v1/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      }),
    );
    byId("answer").textContent = payload.message;
  } catch (error) {
    byId("answer").textContent = `Local request failed: ${error.message}`;
  } finally {
    byId("send").disabled = false;
  }
});

health();
