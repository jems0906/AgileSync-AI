const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function request(path, options = {}, role = "PM") {
  const headers = new Headers(options.headers || {});
  headers.set("x-role", role);
  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Request failed");
  }

  return response.json();
}

export const api = {
  artifacts: (role) => request("/artifacts", {}, role),
  dashboard: (role) => request("/dashboard", {}, role),
  prioritizedBacklog: (role) => request("/backlog/prioritized", {}, role),
  addComment: (body, role) => request("/comments", { method: "POST", body: JSON.stringify(body) }, role),
  updateTaskStatus: (id, status, role) =>
    request(`/tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, role),
  ai: (endpoint, body, role) => request(`/ai/${endpoint}`, { method: "POST", body: JSON.stringify(body) }, role),
  meetingNotesToWork: (body, role) => request("/ai/meeting-notes-to-work", { method: "POST", body }, role),
  createEpic: (body, role) => request("/epics", { method: "POST", body: JSON.stringify(body) }, role),
  updateEpic: (id, body, role) => request(`/epics/${id}`, { method: "PATCH", body: JSON.stringify(body) }, role),
  deleteEpic: (id, role) => request(`/epics/${id}`, { method: "DELETE" }, role),
  createStory: (body, role) => request("/stories", { method: "POST", body: JSON.stringify(body) }, role),
  updateStory: (id, body, role) => request(`/stories/${id}`, { method: "PATCH", body: JSON.stringify(body) }, role),
  deleteStory: (id, role) => request(`/stories/${id}`, { method: "DELETE" }, role),
  createTask: (body, role) => request("/tasks", { method: "POST", body: JSON.stringify(body) }, role),
  updateTask: (id, body, role) => request(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }, role),
  deleteTask: (id, role) => request(`/tasks/${id}`, { method: "DELETE" }, role)
};
