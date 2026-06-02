const API_BASE = "/api";
const roles = ["PM", "BA", "SCRUM_MASTER", "DEVELOPER"];
const workflow = ["backlog", "selected", "in-progress", "review", "done"];
const storyCommentCache = new Map();

const state = {
  role: "PM",
  artifacts: { epics: [], stories: [], tasks: [], comments: [], sprints: [] },
  dashboard: null,
  backlog: [],
  aiAction: "sprint-summary",
  aiOutput: "",
  selectedStoryId: "story-1",
  aiInput: "",
  meetingNotes: "",
  meetingFile: null,
  draggedTaskId: null,
  boardQuery: "",
  backlogQuery: "",
  boardStatusFilter: "all",
  editModal: null,
  confirmModal: null,
  helpModal: false,
  toast: null
};

let keyboardBound = false;
let toastTimer = null;

const app = document.getElementById("app");

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function openEditModal(type, item) {
  state.editModal = { type, item };
  render();
}

function closeEditModal() {
  state.editModal = null;
  render();
}

function openConfirmModal(config) {
  state.confirmModal = config;
  render();
}

function closeConfirmModal() {
  state.confirmModal = null;
  render();
}

function openHelpModal() {
  state.helpModal = true;
  render();
}

function closeHelpModal() {
  state.helpModal = false;
  render();
}

function showToast(message, tone = "success") {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }

  state.toast = { message, tone };
  render();

  toastTimer = setTimeout(() => {
    state.toast = null;
    toastTimer = null;
    render();
  }, 3000);
}

function modalOptions(options, selectedValue) {
  return options.map((value) => `<option value="${esc(value)}" ${value === selectedValue ? "selected" : ""}>${esc(value)}</option>`).join("");
}

function editModal() {
  if (!state.editModal) return "";

  const { type, item } = state.editModal;
  if (type === "epic") {
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="editModalTitle" data-action="stop-propagation">
          <div class="modal-header">
            <h3 id="editModalTitle">Edit Epic</h3>
            <button class="button tiny ghost" data-action="close-modal" type="button">Close</button>
          </div>
          <form class="modal-form" data-form-type="epic" data-id="${esc(item.id)}">
            <label class="label">Title<input class="input" name="title" value="${esc(item.title)}" required /></label>
            <label class="label">Description<textarea class="textarea" name="description">${esc(item.description || "")}</textarea></label>
            <label class="label">Priority<input class="input" name="priority" type="number" min="1" max="10" value="${esc(item.priority ?? 5)}" /></label>
            <div class="modal-actions">
              <button class="button ghost" type="button" data-action="close-modal">Cancel</button>
              <button class="button" type="submit">Save Epic</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  if (type === "story") {
    const epicOptions = modalOptions(state.artifacts.epics.map((epic) => epic.id), item.epicId || state.artifacts.epics[0]?.id || "");
    const statusOptions = modalOptions(workflow, item.status || "backlog");
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="editModalTitle" data-action="stop-propagation">
          <div class="modal-header">
            <h3 id="editModalTitle">Edit Story</h3>
            <button class="button tiny ghost" data-action="close-modal" type="button">Close</button>
          </div>
          <form class="modal-form grid-two" data-form-type="story" data-id="${esc(item.id)}">
            <label class="label">Title<input class="input" name="title" value="${esc(item.title)}" required /></label>
            <label class="label">Epic<select class="select" name="epicId">${epicOptions}</select></label>
            <label class="label span-2">Description<textarea class="textarea" name="description">${esc(item.description || "")}</textarea></label>
            <label class="label">Points<input class="input" name="points" type="number" min="1" max="13" value="${esc(item.points ?? 1)}" /></label>
            <label class="label">Business value<input class="input" name="businessValue" type="number" min="1" max="10" value="${esc(item.businessValue ?? 5)}" /></label>
            <label class="label">Effort<input class="input" name="effort" type="number" min="1" max="13" value="${esc(item.effort ?? 3)}" /></label>
            <label class="label">Risk<input class="input" name="risk" type="number" min="1" max="10" value="${esc(item.risk ?? 2)}" /></label>
            <label class="label">Status<select class="select" name="status">${statusOptions}</select></label>
            <label class="label span-2">Acceptance criteria<textarea class="textarea" name="acceptanceCriteria">${esc((item.acceptanceCriteria || []).join("\n"))}</textarea></label>
            <div class="modal-actions span-2">
              <button class="button ghost" type="button" data-action="close-modal">Cancel</button>
              <button class="button" type="submit">Save Story</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  if (type === "task") {
    const storyOptions = modalOptions(state.artifacts.stories.map((story) => story.id), item.storyId || state.artifacts.stories[0]?.id || "");
    const statusOptions = modalOptions(workflow, item.status || "backlog");
    return `
      <div class="modal-backdrop" data-action="close-modal">
        <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="editModalTitle" data-action="stop-propagation">
          <div class="modal-header">
            <h3 id="editModalTitle">Edit Task</h3>
            <button class="button tiny ghost" data-action="close-modal" type="button">Close</button>
          </div>
          <form class="modal-form grid-two" data-form-type="task" data-id="${esc(item.id)}">
            <label class="label span-2">Title<input class="input" name="title" value="${esc(item.title)}" required /></label>
            <label class="label">Story<select class="select" name="storyId">${storyOptions}</select></label>
            <label class="label">Assignee<input class="input" name="assignee" value="${esc(item.assignee || "")}" /></label>
            <label class="label">Role<input class="input" name="role" value="${esc(item.role || "DEVELOPER")}" /></label>
            <label class="label">Status<select class="select" name="status">${statusOptions}</select></label>
            <label class="label">Due date<input class="input" name="dueDate" type="date" value="${esc(item.dueDate || "")}" /></label>
            <label class="label checkbox"><input type="checkbox" name="blocked" ${item.blocked ? "checked" : ""} /> Blocked</label>
            <div class="modal-actions span-2">
              <button class="button ghost" type="button" data-action="close-modal">Cancel</button>
              <button class="button" type="submit">Save Task</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  return "";
}

function confirmModal() {
  if (!state.confirmModal) return "";
  const { title, message, confirmLabel = "Delete", tone = "danger" } = state.confirmModal;

  return `
    <div class="modal-backdrop" data-action="close-confirm-modal">
      <div class="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirmModalTitle" data-action="stop-propagation">
        <div class="modal-header">
          <h3 id="confirmModalTitle">${esc(title)}</h3>
          <button class="button tiny ghost" data-action="close-confirm-modal" type="button">Close</button>
        </div>
        <p class="confirm-copy">${esc(message)}</p>
        <div class="modal-actions">
          <button class="button ghost" type="button" data-action="close-confirm-modal">Cancel</button>
          <button class="button ${tone === "danger" ? "danger" : ""}" type="button" data-action="confirm-modal">${esc(confirmLabel)}</button>
        </div>
      </div>
    </div>
  `;
}

function toastView() {
  if (!state.toast) return "";
  return `
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      <div class="toast ${esc(state.toast.tone)}">${esc(state.toast.message)}</div>
    </div>
  `;
}

function helpModal() {
  if (!state.helpModal) return "";

  return `
    <div class="modal-backdrop" data-action="close-help-modal">
      <div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="helpModalTitle" data-action="stop-propagation">
        <div class="modal-header">
          <h3 id="helpModalTitle">Keyboard shortcuts</h3>
          <button class="button tiny ghost" type="button" data-action="close-help-modal">Close</button>
        </div>
        <div class="shortcut-grid">
          <div class="shortcut-card"><kbd>/</kbd><span>Focus board search</span></div>
          <div class="shortcut-card"><kbd>b</kbd><span>Focus backlog search</span></div>
          <div class="shortcut-card"><kbd>c</kbd><span>Focus comment box</span></div>
          <div class="shortcut-card"><kbd>m</kbd><span>Focus meeting notes</span></div>
          <div class="shortcut-card"><kbd>?</kbd><span>Open this help</span></div>
          <div class="shortcut-card"><kbd>Esc</kbd><span>Close dialogs</span></div>
        </div>
      </div>
    </div>
  `;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("x-role", state.role);

  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function load() {
  const [artifacts, dashboard, backlog] = await Promise.all([
    request("/artifacts"),
    request("/dashboard"),
    request("/backlog/prioritized")
  ]);

  state.artifacts = artifacts;
  state.dashboard = dashboard;
  state.backlog = backlog.items || [];
  if (!state.artifacts.stories.find((story) => story.id === state.selectedStoryId)) {
    state.selectedStoryId = state.artifacts.stories[0]?.id || "";
  }
  render();
}

function getBoard() {
  const board = Object.fromEntries(workflow.map((status) => [status, []]));
  state.artifacts.tasks.forEach((task) => {
    const query = state.boardQuery.trim().toLowerCase();
    const matchesQuery = !query || [task.title, task.assignee, task.role, task.status].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = state.boardStatusFilter === "all" || task.status === state.boardStatusFilter;
    if (board[task.status] && matchesQuery && matchesStatus) board[task.status].push(task);
  });
  return board;
}

function metricCards() {
  const totals = state.dashboard?.totals || { epics: 0, stories: 0, tasks: 0, comments: 0 };
  const sprintProgress = state.dashboard?.sprint?.progress || 0;
  const sprintName = state.dashboard?.sprint?.name || "No active sprint";

  return `
    <div class="grid-cards">
      <article class="card"><div class="eyebrow">Epics</div><div class="metric">${totals.epics}</div><div class="sub">Business initiatives</div></article>
      <article class="card"><div class="eyebrow">Stories</div><div class="metric">${totals.stories}</div><div class="sub">Backlog and sprint scope</div></article>
      <article class="card"><div class="eyebrow">Tasks</div><div class="metric">${totals.tasks}</div><div class="sub">Execution work items</div></article>
      <article class="card"><div class="eyebrow">Sprint progress</div><div class="metric">${sprintProgress}%</div><div class="sub">${esc(sprintName)}</div></article>
    </div>
  `;
}

function roleFocusPanel() {
  const focus = {
    PM: {
      title: "Portfolio and delivery focus",
      note: "Use this lens to track scope, prioritization, and sprint progress at a glance.",
      bullets: ["Review backlog score ordering", "Watch sprint progress and comment volume", "Use AI to summarize delivery risk"]
    },
    BA: {
      title: "Requirements refinement focus",
      note: "Use this lens to shape stories, acceptance criteria, and meeting-to-requirement conversion.",
      bullets: ["Polish story drafts and acceptance criteria", "Convert meeting notes into actionable work", "Capture dependencies and risks early"]
    },
    SCRUM_MASTER: {
      title: "Ceremony and flow focus",
      note: "Use this lens to keep the board moving and make blockers visible to the team.",
      bullets: ["Move tasks through the workflow", "Generate retrospectives and standups", "Surface blockers before the next ceremony"]
    },
    DEVELOPER: {
      title: "Execution focus",
      note: "Use this lens to see task state, assignees, and ready-to-pick-up work quickly.",
      bullets: ["Check tasks assigned to the team", "Update workflow status with drag-and-drop", "Use AI summaries to stay aligned"]
    }
  }[state.role];

  return `
    <section class="panel role-panel role-${state.role.toLowerCase()}">
      <div class="role-panel-header">
        <div>
          <div class="eyebrow">Current role lens</div>
          <h2>${esc(state.role)} view</h2>
        </div>
        <div class="pill">${esc(state.role)}</div>
      </div>
      <p class="small role-note">${esc(focus.note)}</p>
      <div class="role-grid">
        <div>
          <h3>${esc(focus.title)}</h3>
          <ul class="role-list">
            ${focus.bullets.map((bullet) => `<li>${esc(bullet)}</li>`).join("")}
          </ul>
        </div>
        <div class="role-summary">
          <span>Epics</span><strong>${esc(state.artifacts.epics.length)}</strong>
          <span>Stories</span><strong>${esc(state.artifacts.stories.length)}</strong>
          <span>Tasks</span><strong>${esc(state.artifacts.tasks.length)}</strong>
          <span>Comments</span><strong>${esc(state.artifacts.comments.length)}</strong>
        </div>
      </div>
    </section>
  `;
}

function boardPanel() {
  const board = getBoard();
  const visibleTaskCount = workflow.reduce((total, status) => total + board[status].length, 0);
  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Jira-like Sprint Workflow</h2>
        <div class="panel-filters">
          <input class="input" id="boardQuery" placeholder="Search tasks, assignees, roles" value="${esc(state.boardQuery)}" />
          <select class="select" id="boardStatusFilter">
            <option value="all" ${state.boardStatusFilter === "all" ? "selected" : ""}>All statuses</option>
            ${workflow.map((status) => `<option value="${esc(status)}" ${state.boardStatusFilter === status ? "selected" : ""}>${esc(status)}</option>`).join("")}
          </select>
          <button class="button tiny ghost" type="button" data-action="clear-board-filters">Clear</button>
        </div>
      </div>
      ${state.boardQuery || state.boardStatusFilter !== "all" ? `<div class="small">Showing ${visibleTaskCount} task${visibleTaskCount === 1 ? "" : "s"}${state.boardQuery ? ` matching \"${esc(state.boardQuery)}\"` : ""}${state.boardStatusFilter !== "all" ? ` in ${esc(state.boardStatusFilter)}` : ""}</div>` : ""}
      <div class="board">
        ${workflow
          .map(
            (status) => `
              <div class="column" data-drop-status="${esc(status)}">
                <h3>${status}</h3>
                ${board[status]
                  .map(
                    (task) => `
                      <div class="task" draggable="true" data-task-id="${esc(task.id)}">
                        <p class="task-title">${esc(task.title)}</p>
                        <p class="task-meta">${esc(task.assignee || "Unassigned")}</p>
                        <select class="select" data-action="task-status" data-id="${esc(task.id)}">
                          ${workflow
                            .map(
                              (value) => `<option value="${esc(value)}" ${value === task.status ? "selected" : ""}>${esc(value)}</option>`
                            )
                            .join("")}
                        </select>
                        <div class="inline-actions">
                          <button class="button tiny" data-action="edit-task" data-id="${esc(task.id)}">Edit</button>
                          <button class="button tiny danger" data-action="delete-task" data-id="${esc(task.id)}">Delete</button>
                        </div>
                      </div>
                    `
                  )
                  .join("") || '<div class="small">No items</div>'}
              </div>
            `
          )
          .join("")}
      </div>
      ${visibleTaskCount === 0 ? '<div class="empty-state">No tasks match the current board filters.</div>' : ""}
    </section>
  `;
}

function backlogPanel() {
  const query = state.backlogQuery.trim().toLowerCase();
  const items = state.backlog.filter((story) => {
    if (!query) return true;
    return [story.title, story.description, story.epicTitle].some((value) => String(value || "").toLowerCase().includes(query));
  });

  return `
    <section class="panel">
      <div class="panel-head">
        <h2>Backlog Prioritization</h2>
        <div class="panel-filters">
          <input class="input" id="backlogQuery" placeholder="Search backlog stories" value="${esc(state.backlogQuery)}" />
          <button class="button tiny ghost" type="button" data-action="clear-backlog-filters">Clear</button>
        </div>
      </div>
      <div class="small">Sorted by weighted value / effort${query ? " · filtered" : ""}</div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Story</th><th>Business Value</th><th>Effort</th><th>Risk</th><th>Score</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${items
              .map(
                (story) => `
                  <tr>
                    <td><strong>${esc(story.title)}</strong></td>
                    <td>${esc(story.businessValue)}</td>
                    <td>${esc(story.effort)}</td>
                    <td>${esc(story.risk)}</td>
                    <td class="score">${esc(story.score)}</td>
                    <td>
                      <div class="inline-actions">
                        <button class="button tiny" data-action="edit-story" data-id="${esc(story.id)}">Edit</button>
                        <button class="button tiny danger" data-action="delete-story" data-id="${esc(story.id)}">Delete</button>
                      </div>
                    </td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${items.length === 0 ? '<div class="empty-state">No stories match the current backlog search.</div>' : ""}
    </section>
  `;
}

function epicsPanel() {
  return `
    <section class="panel">
      <h2>Epics</h2>
      <div class="story-list">
        ${state.artifacts.epics
          .map(
            (epic) => `
              <div class="note">
                <h4>${esc(epic.title)}</h4>
                <div class="small">${esc(epic.description || "No description")}</div>
                <div class="inline-actions">
                  <button class="button tiny" data-action="edit-epic" data-id="${esc(epic.id)}">Edit</button>
                  <button class="button tiny danger" data-action="delete-epic" data-id="${esc(epic.id)}">Delete</button>
                </div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

function createWorkItemPanel() {
  const epicOptions = state.artifacts.epics
    .map((epic) => `<option value="${esc(epic.id)}">${esc(epic.title)}</option>`)
    .join("");
  const storyOptions = state.artifacts.stories
    .map((story) => `<option value="${esc(story.id)}">${esc(story.title)}</option>`)
    .join("");

  return `
    <section class="panel">
      <h2>Create Work Item</h2>
      <div class="stack">
        <div class="note">
          <h4>Epic</h4>
          <div class="stack">
            <input class="input" id="epicTitle" placeholder="Epic title" />
            <textarea class="textarea" id="epicDescription" placeholder="Epic description"></textarea>
            <input class="input" id="epicPriority" type="number" min="1" max="10" value="5" />
            <button class="button ghost" id="createEpic">Create Epic</button>
          </div>
        </div>
        <div class="note">
          <h4>Story</h4>
          <div class="stack">
            <select class="select" id="storyEpicId">
              ${epicOptions || '<option value="">No epics yet</option>'}
            </select>
            <input class="input" id="storyTitle" placeholder="Story title" />
            <textarea class="textarea" id="storyDescription" placeholder="Story description"></textarea>
            <input class="input" id="storyPoints" type="number" min="1" max="13" value="3" />
            <input class="input" id="storyBusinessValue" type="number" min="1" max="10" value="5" />
            <input class="input" id="storyEffort" type="number" min="1" max="13" value="3" />
            <input class="input" id="storyRisk" type="number" min="1" max="10" value="2" />
            <textarea class="textarea" id="storyCriteria" placeholder="Acceptance criteria, one per line"></textarea>
            <button class="button ghost" id="createStory">Create Story</button>
          </div>
        </div>
        <div class="note">
          <h4>Task</h4>
          <div class="stack">
            <select class="select" id="taskStoryId">
              ${storyOptions || '<option value="">No stories yet</option>'}
            </select>
            <input class="input" id="taskTitle" placeholder="Task title" />
            <input class="input" id="taskAssignee" placeholder="Assignee" />
            <input class="input" id="taskRole" placeholder="Role" value="DEVELOPER" />
            <select class="select" id="taskStatus">
              ${workflow.map((value) => `<option value="${value}">${value}</option>`).join("")}
            </select>
            <button class="button ghost" id="createTask">Create Task</button>
          </div>
        </div>
      </div>
    </section>
  `;
}

function aiPanel() {
  const output = state.aiOutput || "Run an AI workflow to generate the selected artifact.";
  return `
    <section class="panel">
      <h2>AI Workspace</h2>
      <div class="stack">
        <select class="select" id="aiAction">
          <option value="story-draft" ${state.aiAction === "story-draft" ? "selected" : ""}>Generate user story draft</option>
          <option value="acceptance-criteria" ${state.aiAction === "acceptance-criteria" ? "selected" : ""}>Generate acceptance criteria</option>
          <option value="sprint-summary" ${state.aiAction === "sprint-summary" ? "selected" : ""}>Generate sprint summary</option>
          <option value="retro-notes" ${state.aiAction === "retro-notes" ? "selected" : ""}>Generate retrospective notes</option>
          <option value="meeting-action-items" ${state.aiAction === "meeting-action-items" ? "selected" : ""}>Generate meeting action items</option>
          <option value="standup-summary" ${state.aiAction === "standup-summary" ? "selected" : ""}>Generate standup summary</option>
        </select>
        <textarea class="textarea" id="aiInput" placeholder="Paste context, sprint outcomes, or meeting notes">${esc(state.aiInput)}</textarea>
        <button class="button" id="runAi">Run AI</button>
        <div class="response">${esc(output)}</div>
      </div>
    </section>
  `;
}

function commentsPanel() {
  const stories = state.artifacts.stories;
  const selectedComments = state.artifacts.comments.filter((comment) => comment.itemId === state.selectedStoryId);

  return `
    <section class="panel">
      <h2>Collaboration Comments</h2>
      <div class="stack">
        <select class="select" id="selectedStory">
          ${stories
            .map(
              (story) => `<option value="${esc(story.id)}" ${story.id === state.selectedStoryId ? "selected" : ""}>${esc(story.id)}: ${esc(story.title)}</option>`
            )
            .join("")}
        </select>
        <textarea class="textarea" id="commentText" placeholder="Add an update, risk, or action"></textarea>
        <button class="button secondary" id="addComment">Add Comment</button>
        <div class="comment-list">
          ${selectedComments
            .map(
              (comment) => `
                <div class="note">
                  <h4>${esc(comment.role)}: ${esc(comment.author)}</h4>
                  <div class="small">${esc(comment.content)}</div>
                </div>
              `
            )
            .join("") || '<div class="small">No comments yet for this story.</div>'}
        </div>
      </div>
    </section>
  `;
}

function meetingPanel() {
  return `
    <section class="panel">
      <h2>Meeting Notes Upload</h2>
      <div class="stack">
        <input class="input" id="meetingTitle" placeholder="Meeting title" value="Sprint planning notes" />
        <textarea class="textarea" id="meetingNotes" placeholder="Paste notes here for extraction into requirements, tasks, risks, and dependencies">${esc(state.meetingNotes)}</textarea>
        <input class="input" id="meetingFile" type="file" accept=".txt,.md,.json,.doc,.docx" />
        <button class="button ghost" id="processMeeting">Convert meeting notes</button>
      </div>
    </section>
  `;
}

function storiesPanel() {
  return `
    <section class="panel">
      <h2>Top Prioritized Stories</h2>
      <div class="story-list">
        ${state.backlog.slice(0, 4).map((story) => `
          <div class="note">
            <div class="pill">Score ${esc(story.score)}</div>
            <h4>${esc(story.title)}</h4>
            <div class="small">Business value ${esc(story.businessValue)} · effort ${esc(story.effort)} · risk ${esc(story.risk)}</div>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function layout() {
  return `
    <div class="shell">
      <header class="hero">
        <div class="kicker">Agile Team Workspace</div>
        <div class="hero-grid">
          <div>
            <h1 class="title">AgileSync AI</h1>
            <p class="lede">Plan sprints, refine backlog, capture meetings, and generate delivery artifacts with AI support.</p>
          </div>
          <div class="role-row">
            <label class="label" for="roleSelect">Role view</label>
            <select id="roleSelect" class="select">
              ${roles.map((role) => `<option value="${role}" ${role === state.role ? "selected" : ""}>${role}</option>`).join("")}
            </select>
            <button class="button tiny ghost" type="button" data-action="open-help">Keyboard shortcuts</button>
          </div>
        </div>
      </header>

      ${metricCards()}

      ${roleFocusPanel()}

      <div class="layout">
        <div class="stack">
          ${epicsPanel()}
          ${boardPanel()}
          ${backlogPanel()}
          ${createWorkItemPanel()}
        </div>
        <div class="stack">
          ${aiPanel()}
          ${meetingPanel()}
          ${commentsPanel()}
          ${storiesPanel()}
        </div>
      </div>
      ${toastView()}
      ${editModal()}
      ${confirmModal()}
      ${helpModal()}
    </div>
  `;
}

function wireEvents() {
  const roleSelect = document.getElementById("roleSelect");
  roleSelect?.addEventListener("change", async (event) => {
    state.role = event.target.value;
    await load();
  });

  document.getElementById("boardQuery")?.addEventListener("input", (event) => {
    state.boardQuery = event.target.value;
    render();
  });

  document.getElementById("boardStatusFilter")?.addEventListener("change", (event) => {
    state.boardStatusFilter = event.target.value;
    render();
  });

  document.getElementById("backlogQuery")?.addEventListener("input", (event) => {
    state.backlogQuery = event.target.value;
    render();
  });

  document.querySelector('[data-action="clear-board-filters"]')?.addEventListener("click", () => {
    state.boardQuery = "";
    state.boardStatusFilter = "all";
    render();
  });

  document.querySelector('[data-action="clear-backlog-filters"]')?.addEventListener("click", () => {
    state.backlogQuery = "";
    render();
  });

  document.querySelector('[data-action="open-help"]')?.addEventListener("click", (event) => {
    event.preventDefault();
    openHelpModal();
  });

  document.querySelectorAll('[data-action="task-status"]').forEach((select) => {
    select.addEventListener("change", async (event) => {
      const id = event.currentTarget.dataset.id;
      await request(`/tasks/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: event.target.value })
      });
      await load();
      showToast("Task status updated.");
    });
  });

  document.querySelectorAll(".task").forEach((taskCard) => {
    taskCard.addEventListener("dragstart", (event) => {
      state.draggedTaskId = event.currentTarget.dataset.taskId;
      event.currentTarget.classList.add("dragging");
    });

    taskCard.addEventListener("dragend", (event) => {
      state.draggedTaskId = null;
      event.currentTarget.classList.remove("dragging");
      document.querySelectorAll(".column.drop-target").forEach((column) => column.classList.remove("drop-target"));
    });
  });

  document.querySelectorAll(".column[data-drop-status]").forEach((column) => {
    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      column.classList.add("drop-target");
    });

    column.addEventListener("dragleave", () => {
      column.classList.remove("drop-target");
    });

    column.addEventListener("drop", async (event) => {
      event.preventDefault();
      column.classList.remove("drop-target");
      const taskId = state.draggedTaskId;
      const status = column.dataset.dropStatus;
      if (!taskId || !status) {
        return;
      }

      await request(`/tasks/${taskId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      state.draggedTaskId = null;
      await load();
      showToast(`Moved task to ${status}.`);
    });
  });

  document.querySelectorAll('button[data-action="edit-epic"], button[data-action="delete-epic"], button[data-action="edit-story"], button[data-action="delete-story"], button[data-action="edit-task"], button[data-action="delete-task"]').forEach((button) => {
    button.addEventListener("click", async (event) => {
      const action = event.currentTarget.dataset.action;
      const id = event.currentTarget.dataset.id;

      if (action === "edit-epic") {
        const epic = state.artifacts.epics.find((item) => item.id === id);
        if (!epic) return;
        openEditModal("epic", epic);
        return;
      }

      if (action === "delete-epic") {
        const epic = state.artifacts.epics.find((item) => item.id === id);
        if (!epic) return;
        openConfirmModal({
          title: "Delete Epic",
          message: `Delete \"${epic.title}\" and its dependent stories and tasks?`,
          confirmLabel: "Delete Epic",
          onConfirm: async () => {
            await request(`/epics/${id}`, { method: "DELETE" });
            await load();
            showToast("Epic deleted.");
          }
        });
        return;
      }

      if (action === "edit-story") {
        const story = state.artifacts.stories.find((item) => item.id === id);
        if (!story) return;
        openEditModal("story", story);
        return;
      }

      if (action === "delete-story") {
        const story = state.artifacts.stories.find((item) => item.id === id);
        if (!story) return;
        openConfirmModal({
          title: "Delete Story",
          message: `Delete \"${story.title}\" and its tasks?`,
          confirmLabel: "Delete Story",
          onConfirm: async () => {
            await request(`/stories/${id}`, { method: "DELETE" });
            await load();
            showToast("Story deleted.");
          }
        });
        return;
      }

      if (action === "edit-task") {
        const task = state.artifacts.tasks.find((item) => item.id === id);
        if (!task) return;
        openEditModal("task", task);
        return;
      }

      if (action === "delete-task") {
        const task = state.artifacts.tasks.find((item) => item.id === id);
        if (!task) return;
        openConfirmModal({
          title: "Delete Task",
          message: `Delete \"${task.title}\"?`,
          confirmLabel: "Delete Task",
          onConfirm: async () => {
            await request(`/tasks/${id}`, { method: "DELETE" });
            await load();
            showToast("Task deleted.");
          }
        });
      }
    });
  });

  document.querySelectorAll('[data-action="close-modal"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      closeEditModal();
    });
  });

  document.querySelectorAll('[data-action="stop-propagation"]').forEach((panel) => {
    panel.addEventListener("click", (event) => event.stopPropagation());
  });

  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        closeEditModal();
        closeConfirmModal();
      }
    });
  });

  document.querySelectorAll('[data-action="close-confirm-modal"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      closeConfirmModal();
    });
  });

  document.querySelectorAll('[data-action="confirm-modal"]').forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      const pending = state.confirmModal;
      if (!pending) return;
      await pending.onConfirm();
      state.confirmModal = null;
      render();
    });
  });

  document.querySelectorAll('[data-action="close-help-modal"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      closeHelpModal();
    });
  });

  if (!keyboardBound) {
    document.addEventListener("keydown", (event) => {
      const target = event.target;
      const isTypingTarget = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);

      if (event.key === "?" && !isTypingTarget) {
        event.preventDefault();
        openHelpModal();
        return;
      }

      if (event.key === "/" && !isTypingTarget) {
        event.preventDefault();
        document.getElementById("boardQuery")?.focus();
        return;
      }

      if ((event.key === "b" || event.key === "B") && !isTypingTarget) {
        event.preventDefault();
        document.getElementById("backlogQuery")?.focus();
        return;
      }

      if ((event.key === "c" || event.key === "C") && !isTypingTarget) {
        event.preventDefault();
        document.getElementById("commentText")?.focus();
        return;
      }

      if ((event.key === "m" || event.key === "M") && !isTypingTarget) {
        event.preventDefault();
        document.getElementById("meetingNotes")?.focus();
        return;
      }

      if (event.key !== "Escape") return;
      if (state.editModal) {
        closeEditModal();
        return;
      }
      if (state.confirmModal) {
        closeConfirmModal();
        return;
      }
      if (state.helpModal) {
        closeHelpModal();
      }
    });
    keyboardBound = true;
  }

  document.querySelectorAll("form[data-form-type]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const type = form.dataset.formType;
      const id = form.dataset.id;
      const data = new FormData(form);

      if (type === "epic") {
        await request(`/epics/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: String(data.get("title") || "").trim(),
            description: String(data.get("description") || "").trim(),
            priority: Number(data.get("priority") || 5)
          })
        });
      }

      if (type === "story") {
        await request(`/stories/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: String(data.get("title") || "").trim(),
            description: String(data.get("description") || "").trim(),
            epicId: String(data.get("epicId") || "").trim(),
            acceptanceCriteria: String(data.get("acceptanceCriteria") || "")
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
            points: Number(data.get("points") || 1),
            businessValue: Number(data.get("businessValue") || 5),
            effort: Number(data.get("effort") || 3),
            risk: Number(data.get("risk") || 2),
            status: String(data.get("status") || "backlog")
          })
        });
      }

      if (type === "task") {
        await request(`/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: String(data.get("title") || "").trim(),
            storyId: String(data.get("storyId") || "").trim(),
            assignee: String(data.get("assignee") || "").trim(),
            role: String(data.get("role") || "DEVELOPER").trim() || "DEVELOPER",
            status: String(data.get("status") || "backlog"),
            dueDate: String(data.get("dueDate") || "") || undefined,
            blocked: data.get("blocked") === "on"
          })
        });
      }

      state.editModal = null;
      await load();
      showToast(`${type === "epic" ? "Epic" : type === "story" ? "Story" : "Task"} saved.`);
    });
  });

  const aiAction = document.getElementById("aiAction");
  aiAction?.addEventListener("change", (event) => {
    state.aiAction = event.target.value;
  });

  const aiInput = document.getElementById("aiInput");
  aiInput?.addEventListener("input", (event) => {
    state.aiInput = event.target.value;
  });

  document.getElementById("runAi")?.addEventListener("click", async () => {
    const action = state.aiAction;
    const text = state.aiInput.trim();
    const bodies = {
      "story-draft": { feature: text || "Backlog refinement assistant", userType: state.role, goal: "Write a clear user story draft" },
      "acceptance-criteria": { storyTitle: text || "Sprint board role-aware views", context: "Generate testable acceptance criteria" },
      "sprint-summary": { completed: text || "Completed board updates and comment workflow", blocked: "Pending dependency mapping from external API", carryOver: "Bulk edit and swimlane analytics" },
      "retro-notes": { wentWell: text || "Faster refinement sessions", improve: "Definition of ready for dependencies", actions: "Automate risk capture" },
      "meeting-action-items": { meetingNotes: text || "Need BA to confirm acceptance criteria; devs to split large stories; Scrum Master to monitor blockers" },
      "standup-summary": { updates: text || "Dev A finished API tests. Dev B blocked by env config. BA reviewed stories." }
    };

    const result = await request(`/ai/${action}`, {
      method: "POST",
      body: JSON.stringify(bodies[action])
    });
    state.aiOutput = result.text || result.analysis?.text || JSON.stringify(result, null, 2);
    showToast("AI artifact generated.");
    render();
  });

  document.getElementById("selectedStory")?.addEventListener("change", (event) => {
    state.selectedStoryId = event.target.value;
    render();
  });

  document.getElementById("addComment")?.addEventListener("click", async () => {
    const textarea = document.getElementById("commentText");
    const content = textarea.value.trim();
    if (!content) return;
    await request("/comments", {
      method: "POST",
      body: JSON.stringify({ itemType: "story", itemId: state.selectedStoryId, author: state.role, content })
    });
    textarea.value = "";
    await load();
  });

  document.getElementById("createEpic")?.addEventListener("click", async () => {
    const title = document.getElementById("epicTitle").value.trim();
    if (!title) return;

    await request("/epics", {
      method: "POST",
      body: JSON.stringify({
        title,
        description: document.getElementById("epicDescription").value.trim(),
        priority: Number(document.getElementById("epicPriority").value || 5)
      })
    });

    await load();
    showToast("Epic created.");
  });

  document.getElementById("createStory")?.addEventListener("click", async () => {
    const title = document.getElementById("storyTitle").value.trim();
    const epicId = document.getElementById("storyEpicId").value;
    if (!title || !epicId) return;

    const acceptanceCriteria = document.getElementById("storyCriteria").value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    await request("/stories", {
      method: "POST",
      body: JSON.stringify({
        epicId,
        title,
        description: document.getElementById("storyDescription").value.trim(),
        acceptanceCriteria,
        points: Number(document.getElementById("storyPoints").value || 3),
        businessValue: Number(document.getElementById("storyBusinessValue").value || 5),
        effort: Number(document.getElementById("storyEffort").value || 3),
        risk: Number(document.getElementById("storyRisk").value || 2)
      })
    });

    await load();
    showToast("Story created.");
  });

  document.getElementById("createTask")?.addEventListener("click", async () => {
    const title = document.getElementById("taskTitle").value.trim();
    const storyId = document.getElementById("taskStoryId").value;
    if (!title || !storyId) return;

    await request("/tasks", {
      method: "POST",
      body: JSON.stringify({
        storyId,
        title,
        assignee: document.getElementById("taskAssignee").value.trim(),
        role: document.getElementById("taskRole").value.trim() || "DEVELOPER",
        status: document.getElementById("taskStatus").value
      })
    });

    await load();
    showToast("Task created.");
  });

  document.getElementById("processMeeting")?.addEventListener("click", async () => {
    const title = document.getElementById("meetingTitle").value.trim() || "Uploaded Meeting Notes";
    const notes = document.getElementById("meetingNotes").value.trim();
    const file = document.getElementById("meetingFile").files[0];
    const formData = new FormData();
    formData.append("title", title);
    formData.append("notes", notes);
    if (file) formData.append("file", file);

    const result = await request("/ai/meeting-notes-to-work", {
      method: "POST",
      body: formData
    });

    state.aiOutput = `${result.analysis?.text || "No AI output"}\n\nSaved meeting: ${result.meeting?.title || "Meeting"}`;
    showToast("Meeting notes converted.");
    render();
  });
}

function render() {
  app.innerHTML = layout();
  wireEvents();
}

render();
load().catch((error) => {
  state.aiOutput = `Failed to load app: ${error.message}`;
  render();
});
