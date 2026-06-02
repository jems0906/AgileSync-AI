import { WORKFLOW } from "./constants.js";
import { db } from "./db/index.js";

const now = new Date().toISOString();

const seed = {
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

const counters = {
  epic: 3,
  story: 3,
  task: 3,
  sprint: 15,
  comment: 2,
  meeting: 1
};

const backlogScore = (story) => {
  const numerator = story.businessValue * 2 + story.risk;
  const denominator = Math.max(1, story.effort);
  return Number((numerator / denominator).toFixed(2));
};

const toIso = (value) => (value ? new Date(value).toISOString() : null);

const parseJson = (value, fallback) => {
  if (value == null) {
    return fallback;
  }
  if (Array.isArray(value) || typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const toArtifact = (row) => ({
  id: row.id,
  epicId: row.epic_id ?? undefined,
  storyId: row.story_id ?? undefined,
  itemType: row.item_type ?? undefined,
  itemId: row.item_id ?? undefined,
  title: row.title,
  description: row.description ?? undefined,
  acceptanceCriteria: parseJson(row.acceptance_criteria, []),
  points: row.points ?? undefined,
  businessValue: row.business_value ?? undefined,
  effort: row.effort ?? undefined,
  risk: row.risk ?? undefined,
  priority: row.priority ?? undefined,
  assignee: row.assignee ?? undefined,
  role: row.role ?? undefined,
  status: row.status ?? undefined,
  blocked: row.blocked ?? undefined,
  dueDate: toIso(row.due_date),
  storyIds: parseJson(row.story_ids, []),
  taskIds: parseJson(row.task_ids, []),
  goal: row.goal ?? undefined,
  startDate: toIso(row.start_date),
  endDate: toIso(row.end_date),
  notes: row.notes ?? undefined,
  author: row.author ?? undefined,
  content: row.content ?? undefined,
  createdAt: toIso(row.created_at) ?? undefined,
  uploadedAt: toIso(row.uploaded_at) ?? undefined
});

const fromRows = (rows) => rows.map(toArtifact);

async function ensureSeedData() {
  if (!db.enabled) {
    return;
  }

  const counts = await db.query(
    "SELECT (SELECT COUNT(*)::int FROM epics) AS epics, (SELECT COUNT(*)::int FROM stories) AS stories, (SELECT COUNT(*)::int FROM tasks) AS tasks, (SELECT COUNT(*)::int FROM sprints) AS sprints, (SELECT COUNT(*)::int FROM comments) AS comments, (SELECT COUNT(*)::int FROM meetings) AS meetings"
  );

  const row = counts.rows[0];
  if (row.epics > 0 || row.stories > 0 || row.tasks > 0 || row.sprints > 0 || row.comments > 0 || row.meetings > 0) {
    return;
  }

  for (const epic of seed.epics) {
    await db.query("INSERT INTO epics (id, title, description, priority, created_at) VALUES ($1, $2, $3, $4, $5)", [epic.id, epic.title, epic.description, epic.priority, epic.createdAt]);
  }

  for (const story of seed.stories) {
    await db.query(
      "INSERT INTO stories (id, epic_id, title, description, acceptance_criteria, points, business_value, effort, risk, status, created_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)",
      [story.id, story.epicId, story.title, story.description, JSON.stringify(story.acceptanceCriteria), story.points, story.businessValue, story.effort, story.risk, story.status, story.createdAt]
    );
  }

  for (const task of seed.tasks) {
    await db.query("INSERT INTO tasks (id, story_id, title, assignee, role, status, due_date, blocked, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [task.id, task.storyId, task.title, task.assignee, task.role, task.status, task.dueDate, task.blocked, task.createdAt]);
  }

  for (const sprint of seed.sprints) {
    await db.query(
      "INSERT INTO sprints (id, name, goal, start_date, end_date, story_ids, task_ids, created_at) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)",
      [sprint.id, sprint.name, sprint.goal, sprint.startDate, sprint.endDate, JSON.stringify(sprint.storyIds), JSON.stringify(sprint.taskIds), sprint.createdAt]
    );
  }

  for (const comment of seed.comments) {
    await db.query("INSERT INTO comments (id, item_type, item_id, author, role, content, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)", [comment.id, comment.itemType, comment.itemId, comment.author, comment.role, comment.content, comment.createdAt]);
  }
}

async function fetchArtifacts() {
  if (!db.enabled) {
    return seed;
  }

  await ensureSeedData();
  const [epics, stories, tasks, sprints, comments, meetings] = await Promise.all([
    db.query("SELECT * FROM epics ORDER BY created_at DESC"),
    db.query("SELECT * FROM stories ORDER BY created_at DESC"),
    db.query("SELECT * FROM tasks ORDER BY created_at DESC"),
    db.query("SELECT * FROM sprints ORDER BY created_at DESC"),
    db.query("SELECT * FROM comments ORDER BY created_at DESC"),
    db.query("SELECT * FROM meetings ORDER BY uploaded_at DESC")
  ]);

  return {
    epics: fromRows(epics.rows),
    stories: fromRows(stories.rows),
    tasks: fromRows(tasks.rows),
    sprints: fromRows(sprints.rows),
    comments: fromRows(comments.rows),
    meetings: fromRows(meetings.rows)
  };
}

function createMemoryEpic(payload) {
  const epic = {
    id: `epic-${counters.epic++}`,
    title: payload.title,
    description: payload.description || "",
    priority: Number(payload.priority || 5),
    createdAt: new Date().toISOString()
  };
  seed.epics.unshift(epic);
  return epic;
}

function createMemoryStory(payload) {
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
  seed.stories.unshift(story);
  return story;
}

function createMemoryTask(payload) {
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
  seed.tasks.unshift(task);
  return task;
}

function createMemoryComment(payload) {
  const comment = {
    id: `comment-${counters.comment++}`,
    itemType: payload.itemType,
    itemId: payload.itemId,
    author: payload.author || "Unknown",
    role: payload.role || "DEVELOPER",
    content: payload.content,
    createdAt: new Date().toISOString()
  };
  seed.comments.unshift(comment);
  return comment;
}

function updateMemoryTask(taskId, status) {
  const task = seed.tasks.find((item) => item.id === taskId);
  if (!task || !WORKFLOW.includes(status)) {
    return null;
  }
  task.status = status;
  return task;
}

function saveMemoryMeeting(payload) {
  const meeting = {
    id: `meeting-${counters.meeting++}`,
    title: payload.title || "Sprint Meeting",
    notes: payload.notes || "",
    uploadedAt: new Date().toISOString()
  };
  seed.meetings.unshift(meeting);
  return meeting;
}

function updateMemoryEpic(epicId, payload) {
  const epic = seed.epics.find((item) => item.id === epicId);
  if (!epic) {
    return null;
  }

  if (payload.title !== undefined) epic.title = payload.title;
  if (payload.description !== undefined) epic.description = payload.description;
  if (payload.priority !== undefined) epic.priority = Number(payload.priority);
  return epic;
}

function deleteMemoryEpic(epicId) {
  const epicIndex = seed.epics.findIndex((item) => item.id === epicId);
  if (epicIndex === -1) {
    return false;
  }

  const storyIds = new Set(seed.stories.filter((story) => story.epicId === epicId).map((story) => story.id));
  const taskIds = new Set(seed.tasks.filter((task) => storyIds.has(task.storyId)).map((task) => task.id));
  seed.epics.splice(epicIndex, 1);
  seed.stories = seed.stories.filter((story) => story.epicId !== epicId);
  seed.tasks = seed.tasks.filter((task) => !storyIds.has(task.storyId));
  seed.comments = seed.comments.filter((comment) => {
    if (comment.itemType === "epic" && comment.itemId === epicId) return false;
    if (comment.itemType === "story" && storyIds.has(comment.itemId)) return false;
    if (comment.itemType === "task" && taskIds.has(comment.itemId)) return false;
    return true;
  });
  return true;
}

function updateMemoryStory(storyId, payload) {
  const story = seed.stories.find((item) => item.id === storyId);
  if (!story) {
    return null;
  }

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
}

function deleteMemoryStory(storyId) {
  const storyIndex = seed.stories.findIndex((item) => item.id === storyId);
  if (storyIndex === -1) {
    return false;
  }

  const taskIds = new Set(seed.tasks.filter((task) => task.storyId === storyId).map((task) => task.id));
  seed.stories.splice(storyIndex, 1);
  seed.tasks = seed.tasks.filter((task) => task.storyId !== storyId);
  seed.comments = seed.comments.filter((comment) => {
    if (comment.itemType === "story" && comment.itemId === storyId) return false;
    if (comment.itemType === "task" && taskIds.has(comment.itemId)) return false;
    return true;
  });
  return true;
}

function updateMemoryTaskDetails(taskId, payload) {
  const task = seed.tasks.find((item) => item.id === taskId);
  if (!task) {
    return null;
  }

  if (payload.storyId !== undefined) task.storyId = payload.storyId;
  if (payload.title !== undefined) task.title = payload.title;
  if (payload.assignee !== undefined) task.assignee = payload.assignee;
  if (payload.role !== undefined) task.role = payload.role;
  if (payload.status !== undefined && WORKFLOW.includes(payload.status)) task.status = payload.status;
  if (payload.dueDate !== undefined) task.dueDate = payload.dueDate;
  if (payload.blocked !== undefined) task.blocked = Boolean(payload.blocked);
  return task;
}

function deleteMemoryTask(taskId) {
  const taskIndex = seed.tasks.findIndex((item) => item.id === taskId);
  if (taskIndex === -1) {
    return false;
  }

  seed.tasks.splice(taskIndex, 1);
  seed.comments = seed.comments.filter((comment) => !(comment.itemType === "task" && comment.itemId === taskId));
  return true;
}

export const store = {
  async getArtifacts(role = "PM") {
    const data = await fetchArtifacts();
    const tasks = role === "DEVELOPER"
      ? data.tasks.filter((task) => task.role === "DEVELOPER" || task.assignee)
      : data.tasks;

    return { ...data, tasks };
  },

  async createEpic(payload) {
    if (!db.enabled) {
      return createMemoryEpic(payload);
    }

    const epic = {
      id: `epic-${counters.epic++}`,
      title: payload.title,
      description: payload.description || "",
      priority: Number(payload.priority || 5),
      createdAt: new Date().toISOString()
    };

    await db.query("INSERT INTO epics (id, title, description, priority, created_at) VALUES ($1, $2, $3, $4, $5)", [epic.id, epic.title, epic.description, epic.priority, epic.createdAt]);
    return epic;
  },

  async updateEpic(epicId, payload) {
    if (!db.enabled) {
      return updateMemoryEpic(epicId, payload);
    }

    const result = await db.query(
      "UPDATE epics SET title = COALESCE($2, title), description = COALESCE($3, description), priority = COALESCE($4, priority) WHERE id = $1 RETURNING *",
      [epicId, payload.title ?? null, payload.description ?? null, payload.priority ?? null]
    );

    return result.rowCount ? toArtifact(result.rows[0]) : null;
  },

  async deleteEpic(epicId) {
    if (!db.enabled) {
      return deleteMemoryEpic(epicId);
    }

    const storyIdsResult = await db.query("SELECT id FROM stories WHERE epic_id = $1", [epicId]);
    const storyIds = storyIdsResult.rows.map((row) => row.id);
    const taskIdsResult = storyIds.length
      ? await db.query("SELECT id FROM tasks WHERE story_id = ANY($1::text[])", [storyIds])
      : { rows: [] };
    const taskIds = taskIdsResult.rows.map((row) => row.id);

    await db.query("DELETE FROM comments WHERE item_type = 'epic' AND item_id = $1", [epicId]);
    if (storyIds.length) {
      await db.query("DELETE FROM comments WHERE item_type = 'story' AND item_id = ANY($1::text[])", [storyIds]);
    }
    if (taskIds.length) {
      await db.query("DELETE FROM comments WHERE item_type = 'task' AND item_id = ANY($1::text[])", [taskIds]);
    }
    await db.query("DELETE FROM tasks WHERE story_id = ANY($1::text[])", [storyIds]);
    await db.query("DELETE FROM stories WHERE epic_id = $1", [epicId]);
    const result = await db.query("DELETE FROM epics WHERE id = $1", [epicId]);
    return result.rowCount > 0;
  },

  async createStory(payload) {
    if (!db.enabled) {
      return createMemoryStory(payload);
    }

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

    await db.query("INSERT INTO stories (id, epic_id, title, description, acceptance_criteria, points, business_value, effort, risk, status, created_at) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)", [story.id, story.epicId, story.title, story.description, JSON.stringify(story.acceptanceCriteria), story.points, story.businessValue, story.effort, story.risk, story.status, story.createdAt]);
    return story;
  },

  async updateStory(storyId, payload) {
    if (!db.enabled) {
      return updateMemoryStory(storyId, payload);
    }

    const result = await db.query(
      "UPDATE stories SET epic_id = COALESCE($2, epic_id), title = COALESCE($3, title), description = COALESCE($4, description), acceptance_criteria = COALESCE($5::jsonb, acceptance_criteria), points = COALESCE($6, points), business_value = COALESCE($7, business_value), effort = COALESCE($8, effort), risk = COALESCE($9, risk), status = COALESCE($10, status) WHERE id = $1 RETURNING *",
      [
        storyId,
        payload.epicId ?? null,
        payload.title ?? null,
        payload.description ?? null,
        payload.acceptanceCriteria ? JSON.stringify(payload.acceptanceCriteria) : null,
        payload.points ?? null,
        payload.businessValue ?? null,
        payload.effort ?? null,
        payload.risk ?? null,
        payload.status && WORKFLOW.includes(payload.status) ? payload.status : null
      ]
    );

    return result.rowCount ? toArtifact(result.rows[0]) : null;
  },

  async deleteStory(storyId) {
    if (!db.enabled) {
      return deleteMemoryStory(storyId);
    }

    const taskIdsResult = await db.query("SELECT id FROM tasks WHERE story_id = $1", [storyId]);
    const taskIds = taskIdsResult.rows.map((row) => row.id);
    await db.query("DELETE FROM comments WHERE item_type = 'story' AND item_id = $1", [storyId]);
    if (taskIds.length) {
      await db.query("DELETE FROM comments WHERE item_type = 'task' AND item_id = ANY($1::text[])", [taskIds]);
    }
    await db.query("DELETE FROM tasks WHERE story_id = $1", [storyId]);
    const result = await db.query("DELETE FROM stories WHERE id = $1", [storyId]);
    return result.rowCount > 0;
  },

  async createTask(payload) {
    if (!db.enabled) {
      return createMemoryTask(payload);
    }

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

    await db.query("INSERT INTO tasks (id, story_id, title, assignee, role, status, due_date, blocked, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [task.id, task.storyId, task.title, task.assignee, task.role, task.status, task.dueDate, task.blocked, task.createdAt]);
    return task;
  },

  async updateTask(taskId, payload) {
    if (!db.enabled) {
      return updateMemoryTaskDetails(taskId, payload);
    }

    const result = await db.query(
      "UPDATE tasks SET story_id = COALESCE($2, story_id), title = COALESCE($3, title), assignee = COALESCE($4, assignee), role = COALESCE($5, role), status = COALESCE($6, status), due_date = COALESCE($7, due_date), blocked = COALESCE($8, blocked) WHERE id = $1 RETURNING *",
      [
        taskId,
        payload.storyId ?? null,
        payload.title ?? null,
        payload.assignee ?? null,
        payload.role ?? null,
        payload.status && WORKFLOW.includes(payload.status) ? payload.status : null,
        payload.dueDate ?? null,
        payload.blocked ?? null
      ]
    );

    return result.rowCount ? toArtifact(result.rows[0]) : null;
  },

  async deleteTask(taskId) {
    if (!db.enabled) {
      return deleteMemoryTask(taskId);
    }

    await db.query("DELETE FROM comments WHERE item_type = 'task' AND item_id = $1", [taskId]);
    const result = await db.query("DELETE FROM tasks WHERE id = $1", [taskId]);
    return result.rowCount > 0;
  },

  async createComment(payload) {
    if (!db.enabled) {
      return createMemoryComment(payload);
    }

    const comment = {
      id: `comment-${counters.comment++}`,
      itemType: payload.itemType,
      itemId: payload.itemId,
      author: payload.author || "Unknown",
      role: payload.role || "DEVELOPER",
      content: payload.content,
      createdAt: new Date().toISOString()
    };

    await db.query("INSERT INTO comments (id, item_type, item_id, author, role, content, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)", [comment.id, comment.itemType, comment.itemId, comment.author, comment.role, comment.content, comment.createdAt]);
    return comment;
  },

  async updateTaskStatus(taskId, status) {
    if (!WORKFLOW.includes(status)) {
      return null;
    }

    if (!db.enabled) {
      return updateMemoryTask(taskId, status);
    }

    const result = await db.query("UPDATE tasks SET status = $2 WHERE id = $1 RETURNING *", [taskId, status]);
    return result.rowCount ? toArtifact(result.rows[0]) : null;
  },

  async getPrioritizedBacklog() {
    const data = await fetchArtifacts();
    return data.stories
      .map((story) => ({ ...story, score: backlogScore(story) }))
      .sort((a, b) => b.score - a.score);
  },

  async getDashboard() {
    const data = await fetchArtifacts();
    const sprint = data.sprints[0] || null;
    const sprintTasks = sprint ? data.tasks.filter((task) => sprint.taskIds.includes(task.id)) : [];
    const sprintDone = sprintTasks.filter((task) => task.status === "done").length;

    return {
      totals: {
        epics: data.epics.length,
        stories: data.stories.length,
        tasks: data.tasks.length,
        comments: data.comments.length
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
        doneTasks: data.tasks.filter((task) => task.status === "done").length,
        inProgressTasks: data.tasks.filter((task) => task.status === "in-progress").length,
        reviewTasks: data.tasks.filter((task) => task.status === "review").length,
        blockedTasks: data.tasks.filter((task) => task.blocked).length
      }
    };
  },

  async saveMeeting(payload) {
    if (!db.enabled) {
      return saveMemoryMeeting(payload);
    }

    const meeting = {
      id: `meeting-${counters.meeting++}`,
      title: payload.title || "Sprint Meeting",
      notes: payload.notes || "",
      uploadedAt: new Date().toISOString()
    };

    await db.query("INSERT INTO meetings (id, title, notes, uploaded_at) VALUES ($1, $2, $3, $4)", [meeting.id, meeting.title, meeting.notes, meeting.uploadedAt]);
    return meeting;
  }
};
