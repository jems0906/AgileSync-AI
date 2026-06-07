import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";

const roles = ["PM", "BA", "SCRUM_MASTER", "DEVELOPER"];
const workflow = ["backlog", "selected", "in-progress", "review", "done"];
const aiActions = [
  { value: "story-draft", label: "Generate user story draft" },
  { value: "acceptance-criteria", label: "Generate acceptance criteria" },
  { value: "sprint-summary", label: "Generate sprint summary" },
  { value: "retro-notes", label: "Generate retrospective notes" },
  { value: "meeting-action-items", label: "Generate meeting action items" },
  { value: "standup-summary", label: "Generate standup summary" }
];

const roleFocus = {
  PM: {
    title: "Portfolio and delivery focus",
    note: "Track scope, prioritization, and sprint progress at a glance.",
    bullets: ["Review backlog score ordering", "Watch sprint progress and comment volume", "Use AI to summarize delivery risk"]
  },
  BA: {
    title: "Requirements refinement focus",
    note: "Shape stories, acceptance criteria, and meeting-to-requirement conversion.",
    bullets: ["Polish story drafts and acceptance criteria", "Convert meeting notes into actionable work", "Capture dependencies and risks early"]
  },
  SCRUM_MASTER: {
    title: "Ceremony and flow focus",
    note: "Keep the board moving and make blockers visible to the team.",
    bullets: ["Move tasks through the workflow", "Generate retrospectives and standups", "Surface blockers before the next ceremony"]
  },
  DEVELOPER: {
    title: "Execution focus",
    note: "See task state, assignees, and ready-to-pick-up work quickly.",
    bullets: ["Check tasks assigned to the team", "Update workflow status from the board", "Use AI summaries to stay aligned"]
  }
};

function Card({ title, value, subtitle }) {
  return (
    <article className="card rounded-3xl border border-white/60 bg-white/85 p-4 shadow-card backdrop-blur-sm md:p-5">
      <div className="card-label">{title}</div>
      <div className="card-value">{value}</div>
      <div className="card-subtitle">{subtitle}</div>
    </article>
  );
}

function Section({ title, children, right }) {
  return (
    <section className="panel rounded-3xl border border-white/60 bg-white/85 p-4 shadow-card backdrop-blur-sm md:p-5">
      <div className="panel-head flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }) {
  return <div className="empty-state mt-3 rounded-2xl border border-dashed border-slate-300/80 bg-slate-50/70 p-4 text-sm text-slate-500">{children}</div>;
}

function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="presentation" onClick={onClose}>
      <div className={`modal${wide ? " modal-wide" : ""} w-full max-w-4xl rounded-3xl border border-white/70 bg-white p-5 shadow-2xl`} role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <button className="button button-ghost button-small" type="button" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel = "Delete", onCancel, onConfirm }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="confirm-copy">{message}</p>
      <div className="modal-actions">
        <button className="button button-ghost" type="button" onClick={onCancel}>Cancel</button>
        <button className="button button-danger" type="button" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

function HelpModal({ onClose }) {
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} wide>
      <div className="shortcut-grid">
        <div className="shortcut-card"><kbd>/</kbd><span>Focus board search</span></div>
        <div className="shortcut-card"><kbd>b</kbd><span>Focus backlog search</span></div>
        <div className="shortcut-card"><kbd>c</kbd><span>Focus comment box</span></div>
        <div className="shortcut-card"><kbd>m</kbd><span>Focus meeting notes</span></div>
        <div className="shortcut-card"><kbd>?</kbd><span>Open this help</span></div>
        <div className="shortcut-card"><kbd>Esc</kbd><span>Close dialogs</span></div>
      </div>
    </Modal>
  );
}

export default function App() {
  const [role, setRole] = useState("PM");
  const [artifacts, setArtifacts] = useState({ epics: [], stories: [], tasks: [], comments: [], sprints: [] });
  const [dashboard, setDashboard] = useState(null);
  const [backlog, setBacklog] = useState([]);
  const [boardQuery, setBoardQuery] = useState("");
  const [boardStatusFilter, setBoardStatusFilter] = useState("all");
  const [backlogQuery, setBacklogQuery] = useState("");
  const [aiAction, setAiAction] = useState("sprint-summary");
  const [aiInput, setAiInput] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [selectedStoryId, setSelectedStoryId] = useState("");
  const [commentText, setCommentText] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("Sprint planning notes");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [meetingFile, setMeetingFile] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const boardSearchRef = useRef(null);
  const backlogSearchRef = useRef(null);
  const commentRef = useRef(null);
  const meetingRef = useRef(null);
  const [modal, setModal] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [epicDraft, setEpicDraft] = useState({ title: "", description: "", priority: 5 });
  const [storyDraft, setStoryDraft] = useState({ epicId: "", title: "", description: "", points: 3, businessValue: 5, effort: 3, risk: 2, criteria: "" });
  const [taskDraft, setTaskDraft] = useState({ storyId: "", title: "", assignee: "", role: "DEVELOPER", status: "backlog" });

  const showToast = (message, tone = "success") => setToast({ message, tone });

  async function load() {
    const [a, d, b] = await Promise.all([api.artifacts(role), api.dashboard(role), api.prioritizedBacklog(role)]);
    setArtifacts(a);
    setDashboard(d);
    setBacklog(b.items || []);
    setSelectedStoryId((current) => (a.stories.some((story) => story.id === current) ? current : (a.stories[0]?.id || "")));
    setStoryDraft((current) => ({ ...current, epicId: current.epicId || a.epics[0]?.id || "" }));
    setTaskDraft((current) => ({ ...current, storyId: current.storyId || a.stories[0]?.id || "" }));
  }

  useEffect(() => {
    load().catch((error) => setAiOutput(`Error loading data: ${error.message}`));
  }, [role]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const tag = event.target?.tagName;
      const isTypingTarget = ["INPUT", "TEXTAREA", "SELECT"].includes(tag);
      if (event.key === "?" && !isTypingTarget) {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (event.key === "/" && !isTypingTarget) {
        event.preventDefault();
        boardSearchRef.current?.focus();
        return;
      }
      if ((event.key === "b" || event.key === "B") && !isTypingTarget) {
        event.preventDefault();
        backlogSearchRef.current?.focus();
        return;
      }
      if ((event.key === "c" || event.key === "C") && !isTypingTarget) {
        event.preventDefault();
        commentRef.current?.focus();
        return;
      }
      if ((event.key === "m" || event.key === "M") && !isTypingTarget) {
        event.preventDefault();
        meetingRef.current?.focus();
        return;
      }
      if (event.key === "Escape") {
        setModal(null);
        setConfirmModal(null);
        setHelpOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  const board = useMemo(() => {
    const grouped = Object.fromEntries(workflow.map((status) => [status, []]));
    const query = boardQuery.trim().toLowerCase();
    artifacts.tasks.forEach((task) => {
      const matchesQuery = !query || [task.title, task.assignee, task.role, task.status].some((value) => String(value || "").toLowerCase().includes(query));
      const matchesStatus = boardStatusFilter === "all" || task.status === boardStatusFilter;
      if (grouped[task.status] && matchesQuery && matchesStatus) grouped[task.status].push(task);
    });
    return grouped;
  }, [artifacts.tasks, boardQuery, boardStatusFilter]);

  const visibleTaskCount = workflow.reduce((total, status) => total + board[status].length, 0);
  const filteredBacklog = useMemo(() => {
    const query = backlogQuery.trim().toLowerCase();
    return backlog.filter((story) => {
      if (!query) return true;
      return [story.title, story.description, story.epicTitle].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [backlog, backlogQuery]);

  const focus = roleFocus[role];
  const totals = dashboard?.totals || { epics: 0, stories: 0, tasks: 0, comments: 0 };
  const sprintProgress = dashboard?.sprint?.progress || 0;
  const sprintName = dashboard?.sprint?.name || "No active sprint";
  const selectedComments = artifacts.comments.filter((comment) => comment.itemId === selectedStoryId);
  const selectedStory = artifacts.stories.find((story) => story.id === selectedStoryId);

  const openEdit = (type, item) => setModal({ type, item });

  const saveEdit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { type, item } = modal;

    if (type === "epic") {
      await api.updateEpic(item.id, {
        title: String(form.get("title") || "").trim(),
        description: String(form.get("description") || "").trim(),
        priority: Number(form.get("priority") || 5)
      }, role);
      showToast("Epic saved.");
    }

    if (type === "story") {
      await api.updateStory(item.id, {
        title: String(form.get("title") || "").trim(),
        description: String(form.get("description") || "").trim(),
        epicId: String(form.get("epicId") || "").trim(),
        acceptanceCriteria: String(form.get("acceptanceCriteria") || "").split("\n").map((line) => line.trim()).filter(Boolean),
        points: Number(form.get("points") || 1),
        businessValue: Number(form.get("businessValue") || 5),
        effort: Number(form.get("effort") || 3),
        risk: Number(form.get("risk") || 2),
        status: String(form.get("status") || "backlog")
      }, role);
      showToast("Story saved.");
    }

    if (type === "task") {
      await api.updateTask(item.id, {
        title: String(form.get("title") || "").trim(),
        storyId: String(form.get("storyId") || "").trim(),
        assignee: String(form.get("assignee") || "").trim(),
        role: String(form.get("role") || "DEVELOPER").trim() || "DEVELOPER",
        status: String(form.get("status") || "backlog")
      }, role);
      showToast("Task saved.");
    }

    setModal(null);
    await load();
  };

  const createEpic = async () => {
    if (!epicDraft.title.trim()) return;
    await api.createEpic({ title: epicDraft.title.trim(), description: epicDraft.description.trim(), priority: Number(epicDraft.priority || 5) }, role);
    setEpicDraft({ title: "", description: "", priority: 5 });
    showToast("Epic created.");
    await load();
  };

  const createStory = async () => {
    if (!storyDraft.title.trim() || !storyDraft.epicId) return;
    await api.createStory({
      title: storyDraft.title.trim(),
      description: storyDraft.description.trim(),
      epicId: storyDraft.epicId,
      acceptanceCriteria: storyDraft.criteria.split("\n").map((line) => line.trim()).filter(Boolean),
      points: Number(storyDraft.points || 1),
      businessValue: Number(storyDraft.businessValue || 5),
      effort: Number(storyDraft.effort || 3),
      risk: Number(storyDraft.risk || 2)
    }, role);
    setStoryDraft((current) => ({ ...current, title: "", description: "", criteria: "" }));
    showToast("Story created.");
    await load();
  };

  const createTask = async () => {
    if (!taskDraft.title.trim() || !taskDraft.storyId) return;
    await api.createTask({
      title: taskDraft.title.trim(),
      storyId: taskDraft.storyId,
      assignee: taskDraft.assignee.trim(),
      role: taskDraft.role.trim() || "DEVELOPER",
      status: taskDraft.status
    }, role);
    setTaskDraft((current) => ({ ...current, title: "", assignee: "" }));
    showToast("Task created.");
    await load();
  };

  const deleteItem = async (kind, item) => {
    const config = {
      epic: { title: "Delete Epic", message: `Delete \"${item.title}\" and its dependent stories and tasks?`, confirmLabel: "Delete Epic", run: () => api.deleteEpic(item.id, role), toast: "Epic deleted." },
      story: { title: "Delete Story", message: `Delete \"${item.title}\" and its tasks?`, confirmLabel: "Delete Story", run: () => api.deleteStory(item.id, role), toast: "Story deleted." },
      task: { title: "Delete Task", message: `Delete \"${item.title}\"?`, confirmLabel: "Delete Task", run: () => api.deleteTask(item.id, role), toast: "Task deleted." }
    }[kind];

    setConfirmModal({
      ...config,
      onConfirm: async () => {
        await config.run();
        setConfirmModal(null);
        showToast(config.toast);
        await load();
      }
    });
  };

  const runAi = async () => {
    const bodyByAction = {
      "story-draft": { feature: aiInput || "Backlog refinement assistant", userType: role, goal: "Write a clear story with value focus" },
      "acceptance-criteria": { storyTitle: aiInput || "Sprint board role-aware views", context: "Generate criteria for cross-functional team usage" },
      "sprint-summary": { completed: aiInput || "Completed board updates and comment workflow", blocked: "Pending dependency mapping from external API", carryOver: "Bulk edit and swimlane analytics" },
      "retro-notes": { wentWell: aiInput || "Faster refinement sessions", improve: "Definition of ready for dependencies", actions: "Automate risk capture" },
      "meeting-action-items": { meetingNotes: aiInput || "Need BA to confirm acceptance criteria; devs to split large stories; Scrum Master to monitor blockers" },
      "standup-summary": { updates: aiInput || "Dev A finished API tests. Dev B blocked by env config. BA reviewed 3 stories. Scrum Master scheduled risk review." }
    };
    const result = await api.ai(aiAction, bodyByAction[aiAction], role);
    setAiOutput(result.text || result.analysis?.text || "No AI response");
  };

  const processMeeting = async () => {
    const formData = new FormData();
    formData.append("title", meetingTitle);
    formData.append("notes", meetingNotes);
    if (meetingFile) formData.append("file", meetingFile);
    const result = await api.meetingNotesToWork(formData, role);
    setAiOutput(result.analysis?.text || JSON.stringify(result, null, 2));
    showToast("Meeting notes processed.");
  };

  const addComment = async () => {
    if (!selectedStoryId || !commentText.trim()) return;
    await api.addComment({
      itemType: "story",
      itemId: selectedStoryId,
      content: commentText.trim(),
      author: role
    }, role);
    setCommentText("");
    showToast("Comment added.");
    await load();
  };

  return (
    <div className="page min-h-screen">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="shell mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6">
        <header className="hero rounded-[30px] p-7 shadow-card md:p-8">
          <p className="kicker">Agile Team Workspace</p>
          <div className="hero-grid grid grid-cols-1 items-end gap-4 lg:grid-cols-[1fr_auto]">
            <div>
              <h1 className="title">AgileSync AI</h1>
              <p className="lede">Plan sprints, refine backlog, capture meetings, and generate delivery artifacts with AI support.</p>
            </div>
            <div className="role-box rounded-2xl border border-white/15 bg-white/5 p-3 backdrop-blur-sm">
              <label className="label" htmlFor="roleSelect">Role view</label>
              <div className="role-actions mt-2 flex flex-wrap items-center gap-2">
                <select id="roleSelect" className="select" value={role} onChange={(event) => setRole(event.target.value)}>
                  {roles.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <button className="button button-ghost" type="button" onClick={() => setHelpOpen(true)}>Keyboard shortcuts</button>
              </div>
            </div>
          </div>
        </header>

        <main id="main-content">

        <div className="cards mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Epics" value={totals.epics} subtitle="Business initiatives" />
          <Card title="Stories" value={totals.stories} subtitle="Backlog and sprint scope" />
          <Card title="Tasks" value={totals.tasks} subtitle="Execution work items" />
          <Card title="Sprint progress" value={`${sprintProgress}%`} subtitle={sprintName} />
        </div>

        <section className="panel role-panel mt-4 rounded-3xl border border-white/60 bg-white/85 p-4 shadow-card backdrop-blur-sm md:p-5">
          <div className="panel-head">
            <div>
              <div className="eyebrow">Current role lens</div>
              <h2>{role} view</h2>
            </div>
            <span className="pill">{role}</span>
          </div>
          <p className="role-note">{focus.note}</p>
          <div className="role-grid">
            <div>
              <h3>{focus.title}</h3>
              <ul className="role-list">
                {focus.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            </div>
            <div className="role-summary">
              <span>Epics</span><strong>{artifacts.epics.length}</strong>
              <span>Stories</span><strong>{artifacts.stories.length}</strong>
              <span>Tasks</span><strong>{artifacts.tasks.length}</strong>
              <span>Comments</span><strong>{artifacts.comments.length}</strong>
            </div>
          </div>
        </section>

        <div className="layout mt-4">
          <div className="stack">
            <Section title="Epics">
              {artifacts.epics.length ? (
                <div className="list-stack">
                  {artifacts.epics.map((epic) => (
                    <div key={epic.id} className="note">
                      <div className="note-head">
                        <h4>{epic.title}</h4>
                        <div className="inline-actions">
                          <button className="button button-small" type="button" onClick={() => openEdit("epic", epic)}>Edit</button>
                          <button className="button button-small button-danger" type="button" onClick={() => deleteItem("epic", epic)}>Delete</button>
                        </div>
                      </div>
                      <div className="small">{epic.description || "No description"}</div>
                    </div>
                  ))}
                </div>
              ) : <EmptyState>No epics yet. Create one below.</EmptyState>}
            </Section>

            <Section
              title="Jira-like Sprint Workflow"
              right={(
                <div className="panel-filters">
                  <input ref={boardSearchRef} className="input" aria-label="Search workflow tasks" placeholder="Search tasks, assignees, roles" value={boardQuery} onChange={(event) => setBoardQuery(event.target.value)} />
                  <select className="select" aria-label="Filter workflow by status" value={boardStatusFilter} onChange={(event) => setBoardStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    {workflow.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <button className="button button-ghost button-small" type="button" onClick={() => { setBoardQuery(""); setBoardStatusFilter("all"); }}>Clear</button>
                </div>
              )}
            >
              {boardQuery || boardStatusFilter !== "all" ? (
                <div className="small">Showing {visibleTaskCount} task{visibleTaskCount === 1 ? "" : "s"}{boardQuery ? ` matching \"${boardQuery}\"` : ""}{boardStatusFilter !== "all" ? ` in ${boardStatusFilter}` : ""}</div>
              ) : null}
              <div className="board">
                {workflow.map((status) => (
                  <div key={status} className="column">
                    <h3>{status}</h3>
                    <div className="column-items">
                      {board[status].map((task) => (
                        <div key={task.id} className="task">
                          <p className="task-title">{task.title}</p>
                          <p className="task-meta">{task.assignee || "Unassigned"}</p>
                          <select className="select" aria-label={`Set status for task ${task.title}`} value={task.status} onChange={async (event) => { await api.updateTaskStatus(task.id, event.target.value, role); showToast("Task status updated."); await load(); }}>
                            {workflow.map((next) => <option key={next} value={next}>{next}</option>)}
                          </select>
                          <div className="inline-actions">
                            <button className="button button-small" type="button" onClick={() => openEdit("task", task)}>Edit</button>
                            <button className="button button-small button-danger" type="button" onClick={() => deleteItem("task", task)}>Delete</button>
                          </div>
                        </div>
                      ))}
                      {board[status].length === 0 ? <div className="small">No items</div> : null}
                    </div>
                  </div>
                ))}
              </div>
              {visibleTaskCount === 0 ? <EmptyState>No tasks match the current board filters.</EmptyState> : null}
            </Section>

            <Section title="Backlog Prioritization" right={<span className="small">Sorted by weighted value / effort</span>}>
              <div className="panel-filters panel-filters-tight">
                <input ref={backlogSearchRef} className="input" aria-label="Search backlog stories" placeholder="Search backlog stories" value={backlogQuery} onChange={(event) => setBacklogQuery(event.target.value)} />
                <button className="button button-ghost button-small" type="button" onClick={() => setBacklogQuery("")}>Clear</button>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Story</th>
                      <th>Business Value</th>
                      <th>Effort</th>
                      <th>Risk</th>
                      <th>Score</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBacklog.map((story) => (
                      <tr key={story.id}>
                        <td><strong>{story.title}</strong></td>
                        <td>{story.businessValue}</td>
                        <td>{story.effort}</td>
                        <td>{story.risk}</td>
                        <td className="score">{story.score}</td>
                        <td>
                          <div className="inline-actions">
                            <button className="button button-small" type="button" onClick={() => openEdit("story", story)}>Edit</button>
                            <button className="button button-small button-danger" type="button" onClick={() => deleteItem("story", story)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredBacklog.length === 0 ? <EmptyState>No stories match the current backlog search.</EmptyState> : null}
            </Section>

            <Section title="Create Work Item">
              <div className="create-grid">
                <div className="note">
                  <h4>Epic</h4>
                  <div className="stack">
                    <input className="input" aria-label="Epic title" placeholder="Epic title" value={epicDraft.title} onChange={(event) => setEpicDraft((current) => ({ ...current, title: event.target.value }))} />
                    <textarea className="textarea" aria-label="Epic description" placeholder="Epic description" value={epicDraft.description} onChange={(event) => setEpicDraft((current) => ({ ...current, description: event.target.value }))} />
                    <input className="input" aria-label="Epic priority" type="number" min="1" max="10" value={epicDraft.priority} onChange={(event) => setEpicDraft((current) => ({ ...current, priority: event.target.value }))} />
                    <button className="button" type="button" onClick={createEpic}>Create Epic</button>
                  </div>
                </div>
                <div className="note">
                  <h4>Story</h4>
                  <div className="stack">
                    <select className="select" aria-label="Select epic for story" value={storyDraft.epicId} onChange={(event) => setStoryDraft((current) => ({ ...current, epicId: event.target.value }))}>
                      <option value="">Select epic</option>
                      {artifacts.epics.map((epic) => <option key={epic.id} value={epic.id}>{epic.title}</option>)}
                    </select>
                    <input className="input" aria-label="Story title" placeholder="Story title" value={storyDraft.title} onChange={(event) => setStoryDraft((current) => ({ ...current, title: event.target.value }))} />
                    <textarea className="textarea" aria-label="Story description" placeholder="Story description" value={storyDraft.description} onChange={(event) => setStoryDraft((current) => ({ ...current, description: event.target.value }))} />
                    <input className="input" aria-label="Story points" type="number" min="1" max="13" value={storyDraft.points} onChange={(event) => setStoryDraft((current) => ({ ...current, points: event.target.value }))} />
                    <input className="input" aria-label="Story business value" type="number" min="1" max="10" value={storyDraft.businessValue} onChange={(event) => setStoryDraft((current) => ({ ...current, businessValue: event.target.value }))} />
                    <input className="input" aria-label="Story effort" type="number" min="1" max="13" value={storyDraft.effort} onChange={(event) => setStoryDraft((current) => ({ ...current, effort: event.target.value }))} />
                    <input className="input" aria-label="Story risk" type="number" min="1" max="10" value={storyDraft.risk} onChange={(event) => setStoryDraft((current) => ({ ...current, risk: event.target.value }))} />
                    <textarea className="textarea" aria-label="Story acceptance criteria" placeholder="Acceptance criteria, one per line" value={storyDraft.criteria} onChange={(event) => setStoryDraft((current) => ({ ...current, criteria: event.target.value }))} />
                    <button className="button" type="button" onClick={createStory}>Create Story</button>
                  </div>
                </div>
                <div className="note">
                  <h4>Task</h4>
                  <div className="stack">
                    <select className="select" aria-label="Select story for task" value={taskDraft.storyId} onChange={(event) => setTaskDraft((current) => ({ ...current, storyId: event.target.value }))}>
                      <option value="">Select story</option>
                      {artifacts.stories.map((story) => <option key={story.id} value={story.id}>{story.title}</option>)}
                    </select>
                    <input className="input" aria-label="Task title" placeholder="Task title" value={taskDraft.title} onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))} />
                    <input className="input" aria-label="Task assignee" placeholder="Assignee" value={taskDraft.assignee} onChange={(event) => setTaskDraft((current) => ({ ...current, assignee: event.target.value }))} />
                    <input className="input" aria-label="Task role" placeholder="Role" value={taskDraft.role} onChange={(event) => setTaskDraft((current) => ({ ...current, role: event.target.value }))} />
                    <select className="select" aria-label="Task status" value={taskDraft.status} onChange={(event) => setTaskDraft((current) => ({ ...current, status: event.target.value }))}>
                      {workflow.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <button className="button" type="button" onClick={createTask}>Create Task</button>
                  </div>
                </div>
              </div>
            </Section>
          </div>

          <div className="stack">
            <Section title="AI Workspace">
              <div className="stack">
                <select className="select" aria-label="AI action" value={aiAction} onChange={(event) => setAiAction(event.target.value)}>
                  {aiActions.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}
                </select>
                <textarea className="textarea" aria-label="AI input context" placeholder="Paste context, sprint outcomes, or meeting notes" value={aiInput} onChange={(event) => setAiInput(event.target.value)} />
                <button className="button" type="button" onClick={runAi}>Run AI</button>
                <pre className="response">{aiOutput || "Run an AI workflow to generate the selected artifact."}</pre>
              </div>
            </Section>

            <Section title="Meeting Notes Upload">
              <div className="stack">
                <input className="input" aria-label="Meeting title" value={meetingTitle} onChange={(event) => setMeetingTitle(event.target.value)} placeholder="Meeting title" />
                <textarea ref={meetingRef} className="textarea" aria-label="Meeting notes" value={meetingNotes} onChange={(event) => setMeetingNotes(event.target.value)} placeholder="Paste notes here for extraction into requirements, tasks, risks, and dependencies" />
                <input className="input" aria-label="Upload meeting notes file" type="file" accept=".txt,.md,.json,.doc,.docx" onChange={(event) => setMeetingFile(event.target.files?.[0] || null)} />
                <button className="button button-secondary" type="button" onClick={processMeeting}>Convert meeting notes</button>
              </div>
            </Section>

            <Section title="Collaboration Comments">
              <div className="stack">
                <select className="select" aria-label="Select story for comments" value={selectedStoryId} onChange={(event) => setSelectedStoryId(event.target.value)}>
                  {artifacts.stories.map((story) => <option key={story.id} value={story.id}>{story.id}: {story.title}</option>)}
                </select>
                <textarea ref={commentRef} className="textarea" aria-label="Comment text" value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Add an update, risk, or action" />
                <button className="button button-secondary" type="button" onClick={addComment}>Add Comment</button>
                <div className="comment-list">
                  {selectedComments.length ? selectedComments.map((comment) => (
                    <div key={comment.id} className="note">
                      <h4>{comment.role}: {comment.author}</h4>
                      <div className="small">{comment.content}</div>
                    </div>
                  )) : <EmptyState>{selectedStory ? `No comments yet for ${selectedStory.title}.` : "No comments yet for this story."}</EmptyState>}
                </div>
              </div>
            </Section>

            <Section title="Top Prioritized Stories">
              <div className="story-list">
                {backlog.slice(0, 4).map((story) => (
                  <div key={story.id} className="note">
                    <div className="pill">Score {story.score}</div>
                    <h4>{story.title}</h4>
                    <div className="small">Business value {story.businessValue} · effort {story.effort} · risk {story.risk}</div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
        </main>
      </div>

      {toast ? (
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          <div className={`toast ${toast.tone}`}>{toast.message}</div>
        </div>
      ) : null}

      {modal ? (
        <Modal title={modal.type === "epic" ? "Edit Epic" : modal.type === "story" ? "Edit Story" : "Edit Task"} onClose={() => setModal(null)} wide={modal.type !== "epic"}>
          <form className="modal-form" onSubmit={saveEdit}>
            {modal.type === "epic" ? (
              <>
                <label className="field"><span>Title</span><input className="input" name="title" defaultValue={modal.item.title} required /></label>
                <label className="field"><span>Description</span><textarea className="textarea" name="description" defaultValue={modal.item.description || ""} /></label>
                <label className="field"><span>Priority</span><input className="input" name="priority" type="number" min="1" max="10" defaultValue={modal.item.priority ?? 5} /></label>
              </>
            ) : null}

            {modal.type === "story" ? (
              <div className="modal-grid">
                <label className="field"><span>Title</span><input className="input" name="title" defaultValue={modal.item.title} required /></label>
                <label className="field"><span>Epic</span><select className="select" name="epicId" defaultValue={modal.item.epicId || artifacts.epics[0]?.id || ""}>{artifacts.epics.map((epic) => <option key={epic.id} value={epic.id}>{epic.title}</option>)}</select></label>
                <label className="field span-2"><span>Description</span><textarea className="textarea" name="description" defaultValue={modal.item.description || ""} /></label>
                <label className="field"><span>Points</span><input className="input" name="points" type="number" min="1" max="13" defaultValue={modal.item.points ?? 1} /></label>
                <label className="field"><span>Business value</span><input className="input" name="businessValue" type="number" min="1" max="10" defaultValue={modal.item.businessValue ?? 5} /></label>
                <label className="field"><span>Effort</span><input className="input" name="effort" type="number" min="1" max="13" defaultValue={modal.item.effort ?? 3} /></label>
                <label className="field"><span>Risk</span><input className="input" name="risk" type="number" min="1" max="10" defaultValue={modal.item.risk ?? 2} /></label>
                <label className="field"><span>Status</span><select className="select" name="status" defaultValue={modal.item.status || "backlog"}>{workflow.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
                <label className="field span-2"><span>Acceptance criteria</span><textarea className="textarea" name="acceptanceCriteria" defaultValue={(modal.item.acceptanceCriteria || []).join("\n")} /></label>
              </div>
            ) : null}

            {modal.type === "task" ? (
              <div className="modal-grid">
                <label className="field span-2"><span>Title</span><input className="input" name="title" defaultValue={modal.item.title} required /></label>
                <label className="field"><span>Story</span><select className="select" name="storyId" defaultValue={modal.item.storyId || artifacts.stories[0]?.id || ""}>{artifacts.stories.map((story) => <option key={story.id} value={story.id}>{story.title}</option>)}</select></label>
                <label className="field"><span>Assignee</span><input className="input" name="assignee" defaultValue={modal.item.assignee || ""} /></label>
                <label className="field"><span>Role</span><input className="input" name="role" defaultValue={modal.item.role || "DEVELOPER"} /></label>
                <label className="field"><span>Status</span><select className="select" name="status" defaultValue={modal.item.status || "backlog"}>{workflow.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
              </div>
            ) : null}

            <div className="modal-actions">
              <button className="button button-ghost" type="button" onClick={() => setModal(null)}>Cancel</button>
              <button className="button" type="submit">Save</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {confirmModal ? (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onCancel={() => setConfirmModal(null)}
          onConfirm={confirmModal.onConfirm}
        />
      ) : null}

      {helpOpen ? <HelpModal onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}
