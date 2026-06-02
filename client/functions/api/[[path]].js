const WORKFLOW = ["backlog", "selected", "in-progress", "review", "done"];
const DB_STATE_ID = 1;

const now = new Date().toISOString();

const defaultState = {
  epics: [
    {
      id: "epic-1",
      title: "Sprint Planning Experience",
      description: "Enable teams to plan and commit sprint work with confidence.",
      priority: 9,
      createdAt: now
    },
    {
      id: "epic-2",
      title: "AI Documentation Assistant",
      description: "Use AI to reduce ceremony overhead and improve documentation quality.",
      priority: 8,
      createdAt: now
    }
  ],
  stories: [
    {
      id: "story-1",
      epicId: "epic-1",
      title: "As a PM, I want a sprint board overview",
      description: "Display selected stories grouped by workflow column.",
      acceptanceCriteria: [
        "Board shows all workflow columns",
        "Cards show assignee and status",
        "Users can quickly identify blocked work"
      ],
      points: 5,
      businessValue: 9,
      effort: 4,
      risk: 2,
      status: "selected",
      createdAt: now
    },
    {
      id: "story-2",
      epicId: "epic-2",
      title: "As a Scrum Master, I want retro note generation",
      description: "Generate draft retrospective notes from sprint outcomes.",
      acceptanceCriteria: [
        "Draft includes what went well",
        "Draft includes improvement items",
        "Draft proposes owners for next steps"
      ],
      points: 3,
      businessValue: 8,
      effort: 3,
      risk: 3,
      status: "backlog",
      createdAt: now
    }
  ],
  tasks: [
    {
      id: "task-1",
      storyId: "story-1",
      title: "Create board column component",
      assignee: "Nia",
      role: "DEVELOPER",
      status: "in-progress",
      dueDate: now,
      blocked: false,
      createdAt: now
    },
    {
      id: "task-2",
      storyId: "story-2",
      title: "Draft retro prompt templates",
      assignee: "Luis",
      role: "BA",
      status: "review",
      dueDate: now,
      blocked: false,
      createdAt: now
    }
  ],
  sprints: [
    {
      id: "sprint-14",
      name: "Sprint 14",
      goal: "Stabilize planning flow and accelerate note automation",
      startDate: now,
      endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      storyIds: ["story-1"],
      taskIds: ["task-1"],
      createdAt: now
    }
  ],
  comments: [
    {
      id: "comment-1",
      itemType: "story",
      itemId: "story-1",
      author: "Marta",
      role: "PM",
      content: "Please ensure the board has clear sprint health indicators.",
      createdAt: now
    }
  ],
  meetings: []
};

const defaultCounters = {
  epic: 3,
  story: 3,
  task: 3,
  meeting: 1,
  comment: 2
};

let state = JSON.parse(JSON.stringify(defaultState));
let counters = { ...defaultCounters };

const resetToDefaultState = () => {
  state = JSON.parse(JSON.stringify(defaultState));
  counters = { ...defaultCounters };
};

const ensureD1StateTable = async (env) => {
  if (!env?.DB) {
    return;
  }

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state_json TEXT NOT NULL,
      counters_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
};

const loadStateFromD1 = async (env) => {
  if (!env?.DB) {
    return false;
  }

  await ensureD1StateTable(env);
  const row = await env.DB.prepare("SELECT state_json, counters_json FROM app_state WHERE id = ?")
    .bind(DB_STATE_ID)
    .first();

  if (!row) {
    resetToDefaultState();
    await persistStateToD1(env);
    return true;
  }

  state = JSON.parse(row.state_json);
  counters = JSON.parse(row.counters_json);
  return true;
};

const persistStateToD1 = async (env) => {
  if (!env?.DB) {
    return;
  }

  await ensureD1StateTable(env);
  await env.DB.prepare(
    `INSERT INTO app_state (id, state_json, counters_json, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      state_json = excluded.state_json,
      counters_json = excluded.counters_json,
      updated_at = excluded.updated_at`
  )
    .bind(DB_STATE_ID, JSON.stringify(state), JSON.stringify(counters), new Date().toISOString())
    .run();
};

const json = (data, init = {}) => {
  const headers = new Headers(init.headers || {});
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
};

const corsHeaders = (env, req) => {
  const configured = env?.CORS_ORIGIN || "*";
  const reqOrigin = req.headers.get("origin");
  const allowOrigin = configured === "*" ? "*" : reqOrigin && reqOrigin === configured ? reqOrigin : configured;

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,x-role",
    "access-control-max-age": "86400"
  };
};

const withCors = (response, env, req) => {
  const headers = new Headers(response.headers);
  const cors = corsHeaders(env, req);
  Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { ...response, headers });
};

const backlogScore = (story) => {
  const numerator = story.businessValue * 2 + story.risk;
  const denominator = Math.max(1, story.effort);
  return Number((numerator / denominator).toFixed(2));
};

const getRole = (req) => {
  const role = (req.headers.get("x-role") || "PM").toUpperCase();
  if (role === "SCRUM_MASTER" || role === "BA" || role === "PM" || role === "DEVELOPER") {
    return role;
  }
  return "PM";
};

const parseBody = async (req) => {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await req.json();
  }
  if (contentType.includes("multipart/form-data")) {
    return await req.formData();
  }
  return {};
};

const getArtifacts = (role) => {
  const tasks = role === "DEVELOPER"
    ? state.tasks.filter((t) => t.role === "DEVELOPER" || t.assignee)
    : state.tasks;

  return {
    epics: state.epics,
    stories: state.stories,
    tasks,
    sprints: state.sprints,
    comments: state.comments
  };
};

const getDashboard = () => {
  const doneTasks = state.tasks.filter((t) => t.status === "done").length;
  const inProgressTasks = state.tasks.filter((t) => t.status === "in-progress").length;
  const reviewTasks = state.tasks.filter((t) => t.status === "review").length;
  const blockedTasks = state.tasks.filter((t) => t.blocked).length;

  const sprint = state.sprints[0] || null;
  const sprintTasks = sprint ? state.tasks.filter((t) => sprint.taskIds.includes(t.id)) : [];
  const sprintDone = sprintTasks.filter((t) => t.status === "done").length;

  return {
    totals: {
      epics: state.epics.length,
      stories: state.stories.length,
      tasks: state.tasks.length,
      comments: state.comments.length
    },
    sprint: sprint
      ? {
          id: sprint.id,
          name: sprint.name,
          goal: sprint.goal,
          progress: sprintTasks.length ? Number(((sprintDone / sprintTasks.length) * 100).toFixed(0)) : 0
        }
      : null,
    flow: {
      doneTasks,
      inProgressTasks,
      reviewTasks,
      blockedTasks
    }
  };
};

const createEpic = (payload) => {
  const epic = {
    id: `epic-${counters.epic++}`,
    title: payload.title,
    description: payload.description || "",
    priority: Number(payload.priority || 5),
    createdAt: new Date().toISOString()
  };
  state.epics.unshift(epic);
  return epic;
};

const createStory = (payload) => {
  const story = {
    id: `story-${counters.story++}`,
    epicId: payload.epicId,
    title: payload.title,
    description: payload.description || "",
    acceptanceCriteria: payload.acceptanceCriteria || [],
    points: Number(payload.points || 1),
    businessValue: Number(payload.businessValue || 5),
    effort: Number(payload.effort || 3),
    risk: Number(payload.risk || 2),
    status: WORKFLOW.includes(payload.status) ? payload.status : "backlog",
    createdAt: new Date().toISOString()
  };
  state.stories.unshift(story);
  return story;
};

const createTask = (payload) => {
  const task = {
    id: `task-${counters.task++}`,
    storyId: payload.storyId,
    title: payload.title,
    assignee: payload.assignee || "Unassigned",
    role: payload.role || "DEVELOPER",
    status: WORKFLOW.includes(payload.status) ? payload.status : "backlog",
    dueDate: payload.dueDate || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
    blocked: Boolean(payload.blocked),
    createdAt: new Date().toISOString()
  };
  state.tasks.unshift(task);
  return task;
};

const createComment = (payload, role) => {
  const comment = {
    id: `comment-${counters.comment++}`,
    itemType: payload.itemType,
    itemId: payload.itemId,
    author: payload.author || "Unknown",
    role,
    content: payload.content,
    createdAt: new Date().toISOString()
  };
  state.comments.unshift(comment);
  return comment;
};

const updateTaskStatus = (taskId, status) => {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task || !WORKFLOW.includes(status)) {
    return null;
  }
  task.status = status;
  return task;
};

const updateEpic = (epicId, payload) => {
  const epic = state.epics.find((item) => item.id === epicId);
  if (!epic) return null;

  if (payload.title !== undefined) epic.title = payload.title;
  if (payload.description !== undefined) epic.description = payload.description;
  if (payload.priority !== undefined) epic.priority = Number(payload.priority);
  return epic;
};

const deleteEpic = (epicId) => {
  const epicIndex = state.epics.findIndex((item) => item.id === epicId);
  if (epicIndex === -1) return false;

  const storyIds = new Set(state.stories.filter((story) => story.epicId === epicId).map((story) => story.id));
  const taskIds = new Set(state.tasks.filter((task) => storyIds.has(task.storyId)).map((task) => task.id));

  state.epics.splice(epicIndex, 1);
  state.stories = state.stories.filter((story) => story.epicId !== epicId);
  state.tasks = state.tasks.filter((task) => !storyIds.has(task.storyId));
  state.comments = state.comments.filter((comment) => {
    if (comment.itemType === "epic" && comment.itemId === epicId) return false;
    if (comment.itemType === "story" && storyIds.has(comment.itemId)) return false;
    if (comment.itemType === "task" && taskIds.has(comment.itemId)) return false;
    return true;
  });

  return true;
};

const updateStory = (storyId, payload) => {
  const story = state.stories.find((item) => item.id === storyId);
  if (!story) return null;

  if (payload.epicId !== undefined) story.epicId = payload.epicId;
  if (payload.title !== undefined) story.title = payload.title;
  if (payload.description !== undefined) story.description = payload.description;
  if (payload.acceptanceCriteria !== undefined) story.acceptanceCriteria = payload.acceptanceCriteria;
  if (payload.points !== undefined) story.points = Number(payload.points);
  if (payload.businessValue !== undefined) story.businessValue = Number(payload.businessValue);
  if (payload.effort !== undefined) story.effort = Number(payload.effort);
  if (payload.risk !== undefined) story.risk = Number(payload.risk);
  if (payload.status !== undefined && WORKFLOW.includes(payload.status)) story.status = payload.status;
  return story;
};

const deleteStory = (storyId) => {
  const storyIndex = state.stories.findIndex((item) => item.id === storyId);
  if (storyIndex === -1) return false;

  const taskIds = new Set(state.tasks.filter((task) => task.storyId === storyId).map((task) => task.id));
  state.stories.splice(storyIndex, 1);
  state.tasks = state.tasks.filter((task) => task.storyId !== storyId);
  state.comments = state.comments.filter((comment) => {
    if (comment.itemType === "story" && comment.itemId === storyId) return false;
    if (comment.itemType === "task" && taskIds.has(comment.itemId)) return false;
    return true;
  });

  return true;
};

const updateTask = (taskId, payload) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return null;

  if (payload.storyId !== undefined) task.storyId = payload.storyId;
  if (payload.title !== undefined) task.title = payload.title;
  if (payload.assignee !== undefined) task.assignee = payload.assignee;
  if (payload.role !== undefined) task.role = payload.role;
  if (payload.status !== undefined && WORKFLOW.includes(payload.status)) task.status = payload.status;
  if (payload.dueDate !== undefined) task.dueDate = payload.dueDate;
  if (payload.blocked !== undefined) task.blocked = Boolean(payload.blocked);

  return task;
};

const deleteTask = (taskId) => {
  const taskIndex = state.tasks.findIndex((item) => item.id === taskId);
  if (taskIndex === -1) return false;

  state.tasks.splice(taskIndex, 1);
  state.comments = state.comments.filter((comment) => !(comment.itemType === "task" && comment.itemId === taskId));
  return true;
};

const saveMeeting = (payload) => {
  const meeting = {
    id: `meeting-${counters.meeting++}`,
    title: payload.title || "Sprint Meeting",
    notes: payload.notes || "",
    uploadedAt: new Date().toISOString()
  };
  state.meetings.unshift(meeting);
  return meeting;
};

const aiFallback = (title, input) => ({
  title,
  generatedAt: new Date().toISOString(),
  content: [
    "AI key not configured. Using deterministic fallback output.",
    "",
    "Input Summary:",
    input.trim().slice(0, 800),
    "",
    "Recommended Next Steps:",
    "1) Confirm scope and constraints.",
    "2) Break work into small backlog items.",
    "3) Define acceptance criteria and owner."
  ].join("\n")
});

const generateWithAi = async (env, systemPrompt, userPrompt, fallbackTitle) => {
  if (!env?.OPENAI_API_KEY) {
    return aiFallback(fallbackTitle, userPrompt);
  }

  const model = env.OPENAI_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("Empty AI response payload");
  }

  return {
    title: fallbackTitle,
    generatedAt: new Date().toISOString(),
    model,
    content
  };
};

const runAi = async (env, req, system, prompt, title) => {
  try {
    return json(await generateWithAi(env, system, prompt, title));
  } catch (error) {
    return json({ error: "AI generation failed", details: error.message }, { status: 500 });
  }
};

async function handleApi(req, env) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api/, "") || "/";
  const method = req.method.toUpperCase();
  const role = getRole(req);

  if (env?.DB) {
    await loadStateFromD1(env);
  }

  if (method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (path === "/health" && method === "GET") {
    return json({
      ok: true,
      service: "agilesync-ai-cloudflare",
      persistence: env?.DB ? "d1" : "memory"
    });
  }

  if (path === "/artifacts" && method === "GET") {
    return json(getArtifacts(role));
  }

  if (path === "/dashboard" && method === "GET") {
    return json(getDashboard());
  }

  if (path === "/backlog/prioritized" && method === "GET") {
    const items = state.stories
      .map((story) => ({ ...story, score: backlogScore(story) }))
      .sort((a, b) => b.score - a.score);
    return json({ items });
  }

  if (path === "/epics" && method === "POST") {
    const body = await parseBody(req);
    if (!body.title) return json({ error: "title is required" }, { status: 400 });
    const epic = createEpic(body);
    await persistStateToD1(env);
    return json(epic, { status: 201 });
  }

  if (path.startsWith("/epics/") && method === "PATCH") {
    const body = await parseBody(req);
    const id = path.split("/")[2];
    const epic = updateEpic(id, body);
    if (!epic) return json({ error: "Epic not found" }, { status: 404 });
    await persistStateToD1(env);
    return json(epic);
  }

  if (path.startsWith("/epics/") && method === "DELETE") {
    const id = path.split("/")[2];
    const deleted = deleteEpic(id);
    if (deleted) {
      await persistStateToD1(env);
    }
    return deleted ? new Response(null, { status: 204 }) : json({ error: "Epic not found" }, { status: 404 });
  }

  if (path === "/stories" && method === "POST") {
    const body = await parseBody(req);
    if (!body.title || !body.epicId) return json({ error: "title and epicId are required" }, { status: 400 });
    const story = createStory(body);
    await persistStateToD1(env);
    return json(story, { status: 201 });
  }

  if (path.startsWith("/stories/") && method === "PATCH") {
    const body = await parseBody(req);
    const id = path.split("/")[2];
    const story = updateStory(id, body);
    if (!story) return json({ error: "Story not found" }, { status: 404 });
    await persistStateToD1(env);
    return json(story);
  }

  if (path.startsWith("/stories/") && method === "DELETE") {
    const id = path.split("/")[2];
    const deleted = deleteStory(id);
    if (deleted) {
      await persistStateToD1(env);
    }
    return deleted ? new Response(null, { status: 204 }) : json({ error: "Story not found" }, { status: 404 });
  }

  if (path === "/tasks" && method === "POST") {
    const body = await parseBody(req);
    if (!body.title || !body.storyId) return json({ error: "title and storyId are required" }, { status: 400 });
    const task = createTask(body);
    await persistStateToD1(env);
    return json(task, { status: 201 });
  }

  if (path.startsWith("/tasks/") && path.endsWith("/status") && method === "PATCH") {
    const body = await parseBody(req);
    const id = path.split("/")[2];
    const updated = updateTaskStatus(id, body.status);
    if (!updated) return json({ error: "Invalid task id or status" }, { status: 400 });
    await persistStateToD1(env);
    return json(updated);
  }

  if (path.startsWith("/tasks/") && method === "PATCH") {
    const body = await parseBody(req);
    const id = path.split("/")[2];
    const task = updateTask(id, body);
    if (!task) return json({ error: "Task not found" }, { status: 404 });
    await persistStateToD1(env);
    return json(task);
  }

  if (path.startsWith("/tasks/") && method === "DELETE") {
    const id = path.split("/")[2];
    const deleted = deleteTask(id);
    if (deleted) {
      await persistStateToD1(env);
    }
    return deleted ? new Response(null, { status: 204 }) : json({ error: "Task not found" }, { status: 404 });
  }

  if (path === "/comments" && method === "POST") {
    const body = await parseBody(req);
    if (!body.itemType || !body.itemId || !body.content) {
      return json({ error: "itemType, itemId and content are required" }, { status: 400 });
    }
    const comment = createComment(body, role);
    await persistStateToD1(env);
    return json(comment, { status: 201 });
  }

  if (path === "/ai/story-draft" && method === "POST") {
    const body = await parseBody(req);
    const prompt = `Feature: ${body.feature}\nUser: ${body.userType}\nGoal: ${body.goal}\nReturn a user story draft.`;
    return runAi(env, req, "You are an Agile BA assistant creating crisp user story drafts.", prompt, "User Story Draft");
  }

  if (path === "/ai/acceptance-criteria" && method === "POST") {
    const body = await parseBody(req);
    const prompt = `Story: ${body.storyTitle}\nContext: ${body.context}\nReturn numbered acceptance criteria.`;
    return runAi(env, req, "You are an Agile quality coach creating testable acceptance criteria.", prompt, "Acceptance Criteria");
  }

  if (path === "/ai/sprint-summary" && method === "POST") {
    const body = await parseBody(req);
    const prompt = `Completed: ${body.completed}\nBlocked: ${body.blocked}\nCarry over: ${body.carryOver}\nCreate sprint summary for stakeholders.`;
    return runAi(env, req, "You summarize sprint outcomes clearly for cross-functional stakeholders.", prompt, "Sprint Summary");
  }

  if (path === "/ai/retro-notes" && method === "POST") {
    const body = await parseBody(req);
    const prompt = `Went well: ${body.wentWell}\nTo improve: ${body.improve}\nCandidate actions: ${body.actions}\nCreate retrospective notes.`;
    return runAi(env, req, "You produce balanced retrospective notes with actionable follow-up.", prompt, "Retrospective Notes");
  }

  if (path === "/ai/meeting-action-items" && method === "POST") {
    const body = await parseBody(req);
    const prompt = `Meeting notes:\n${body.meetingNotes}\nExtract action items with owner and due date suggestions.`;
    return runAi(env, req, "You convert meeting notes into concrete action items for Agile teams.", prompt, "Meeting Action Items");
  }

  if (path === "/ai/standup-summary" && method === "POST") {
    const body = await parseBody(req);
    const prompt = `Team updates:\n${body.updates}\nGenerate concise daily standup summary with blockers and asks.`;
    return runAi(env, req, "You summarize daily standup updates into concise report format.", prompt, "Standup Summary");
  }

  if (path === "/ai/meeting-notes-to-work" && method === "POST") {
    const contentType = req.headers.get("content-type") || "";
    let notes = "";
    let title = "Uploaded Meeting Notes";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const uploaded = form.get("file");
      title = String(form.get("title") || title);
      notes = String(form.get("notes") || "");
      if (uploaded && typeof uploaded === "object" && "text" in uploaded) {
        notes = await uploaded.text();
      }
    } else {
      const body = await parseBody(req);
      notes = body.notes || "";
      title = body.title || title;
    }

    const meeting = saveMeeting({ title, notes });
    await persistStateToD1(env);
    const prompt = `Meeting notes:\n${notes}\nReturn four sections:\n1) Requirements\n2) Tasks\n3) Risks\n4) Dependencies`;

    try {
      const analysis = await generateWithAi(
        env,
        "You are a senior BA translating raw meeting notes into structured Agile execution input.",
        prompt,
        "Meeting Notes to Work Breakdown"
      );
      return json({ meeting, analysis });
    } catch (error) {
      return json({ error: "Meeting note analysis failed", details: error.message }, { status: 500 });
    }
  }

  return json({ error: "Not found" }, { status: 404 });
}

export async function onRequest(context) {
  const { request, env } = context;
  const response = await handleApi(request, env);
  return withCors(response, env, request);
}
