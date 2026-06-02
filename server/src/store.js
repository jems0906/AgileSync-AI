import { WORKFLOW } from "./constants.js";

const now = new Date().toISOString();

const state = {
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

const idOf = (prefix) => `${prefix}-${counters[prefix]++}`;

const backlogScore = (story) => {
  // Weighted-shortest-job-first style score tuned for backlog sorting.
  const numerator = story.businessValue * 2 + story.risk;
  const denominator = Math.max(1, story.effort);
  return Number((numerator / denominator).toFixed(2));
};

export const store = {
  getArtifacts(role = "PM") {
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
  },

  createEpic(payload) {
    const epic = {
      id: idOf("epic"),
      title: payload.title,
      description: payload.description || "",
      priority: Number(payload.priority || 5),
      createdAt: new Date().toISOString()
    };
    state.epics.unshift(epic);
    return epic;
  },

  createStory(payload) {
    const story = {
      id: idOf("story"),
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
  },

  createTask(payload) {
    const task = {
      id: idOf("task"),
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
  },

  createComment(payload) {
    const comment = {
      id: idOf("comment"),
      itemType: payload.itemType,
      itemId: payload.itemId,
      author: payload.author || "Unknown",
      role: payload.role || "DEVELOPER",
      content: payload.content,
      createdAt: new Date().toISOString()
    };
    state.comments.unshift(comment);
    return comment;
  },

  updateTaskStatus(taskId, status) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) {
      return null;
    }
    if (!WORKFLOW.includes(status)) {
      return null;
    }
    task.status = status;
    return task;
  },

  getPrioritizedBacklog() {
    return state.stories
      .map((story) => ({ ...story, score: backlogScore(story) }))
      .sort((a, b) => b.score - a.score);
  },

  getDashboard() {
    const storyCount = state.stories.length;
    const taskCount = state.tasks.length;
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
        stories: storyCount,
        tasks: taskCount,
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
  },

  saveMeeting(payload) {
    const meeting = {
      id: idOf("meeting"),
      title: payload.title || "Sprint Meeting",
      notes: payload.notes || "",
      uploadedAt: new Date().toISOString()
    };
    state.meetings.unshift(meeting);
    return meeting;
  }
};
