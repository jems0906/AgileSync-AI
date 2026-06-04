const API_BASE = process.env.API_BASE_URL || "http://localhost:4000/api";
const ROLE = process.env.API_ROLE || "PM";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "x-role": ROLE,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

let createdEpicId = null;

try {
  const health = await request("/health");
  assert(health.response.ok, `GET /health failed with ${health.response.status}`);
  assert(health.body?.ok === true, "GET /health did not return ok=true");
  assert(typeof health.body?.service === "string", "GET /health missing service string");

  const artifacts = await request("/artifacts");
  assert(artifacts.response.ok, `GET /artifacts failed with ${artifacts.response.status}`);
  assert(isObject(artifacts.body), "GET /artifacts did not return an object");
  for (const key of ["epics", "stories", "tasks", "comments", "sprints"]) {
    assert(Array.isArray(artifacts.body[key]), `GET /artifacts missing array '${key}'`);
  }

  const epicPayload = {
    title: "Contract test epic",
    description: "Contract validation",
    priority: 5
  };
  const createEpic = await request("/epics", {
    method: "POST",
    body: JSON.stringify(epicPayload)
  });
  assert(createEpic.response.status === 201, `POST /epics expected 201, got ${createEpic.response.status}`);
  assert(typeof createEpic.body?.id === "string", "POST /epics missing id");
  assert(createEpic.body?.title === epicPayload.title, "POST /epics returned unexpected title");
  createdEpicId = createEpic.body.id;

  const createStory = await request("/stories", {
    method: "POST",
    body: JSON.stringify({
      title: "Contract test story",
      description: "Story from contract test",
      epicId: createdEpicId,
      points: 3,
      businessValue: 5,
      effort: 3,
      risk: 2
    })
  });
  assert(createStory.response.status === 201, `POST /stories expected 201, got ${createStory.response.status}`);
  assert(typeof createStory.body?.id === "string", "POST /stories missing id");

  const createTask = await request("/tasks", {
    method: "POST",
    body: JSON.stringify({
      title: "Contract test task",
      storyId: createStory.body.id,
      assignee: "CI",
      role: "DEVELOPER",
      status: "backlog"
    })
  });
  assert(createTask.response.status === 201, `POST /tasks expected 201, got ${createTask.response.status}`);
  assert(typeof createTask.body?.id === "string", "POST /tasks missing id");

  const updateStatus = await request(`/tasks/${createTask.body.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "in-progress" })
  });
  assert(updateStatus.response.ok, `PATCH /tasks/:id/status failed with ${updateStatus.response.status}`);
  assert(updateStatus.body?.status === "in-progress", "PATCH /tasks/:id/status did not persist status");

  const backlog = await request("/backlog/prioritized");
  assert(backlog.response.ok, `GET /backlog/prioritized failed with ${backlog.response.status}`);
  assert(Array.isArray(backlog.body?.items), "GET /backlog/prioritized missing items array");

  const dashboard = await request("/dashboard");
  assert(dashboard.response.ok, `GET /dashboard failed with ${dashboard.response.status}`);
  assert(isObject(dashboard.body?.totals), "GET /dashboard missing totals object");
  for (const key of ["epics", "stories", "tasks", "comments"]) {
    assert(typeof dashboard.body.totals[key] === "number", `GET /dashboard totals.${key} is not a number`);
  }

  const ai = await request("/ai/sprint-summary", {
    method: "POST",
    body: JSON.stringify({
      completed: "Completed contract tests",
      blocked: "None",
      carryOver: "None"
    })
  });
  assert(ai.response.ok, `POST /ai/sprint-summary failed with ${ai.response.status}`);
  assert(typeof ai.body?.text === "string", "POST /ai/sprint-summary missing text output");

  console.log(
    JSON.stringify(
      {
        status: "passed",
        apiBase: API_BASE,
        role: ROLE,
        checks: [
          "health",
          "artifacts",
          "create-epic",
          "create-story",
          "create-task",
          "update-task-status",
          "backlog",
          "dashboard",
          "ai-sprint-summary"
        ]
      },
      null,
      2
    )
  );
} finally {
  if (createdEpicId) {
    await request(`/epics/${createdEpicId}`, { method: "DELETE" });
  }
}