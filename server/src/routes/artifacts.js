import { Router } from "express";
import { store } from "../storeDb.js";

export const artifactsRouter = Router();

artifactsRouter.get("/artifacts", async (req, res) => {
  const data = await store.getArtifacts(req.role);
  res.json(data);
});

artifactsRouter.post("/epics", async (req, res) => {
  if (!req.body.title) {
    return res.status(400).json({ error: "title is required" });
  }
  const epic = await store.createEpic(req.body);
  return res.status(201).json(epic);
});

artifactsRouter.patch("/epics/:id", async (req, res) => {
  const epic = await store.updateEpic(req.params.id, req.body);
  if (!epic) {
    return res.status(404).json({ error: "Epic not found" });
  }
  return res.json(epic);
});

artifactsRouter.delete("/epics/:id", async (req, res) => {
  const deleted = await store.deleteEpic(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Epic not found" });
  }
  return res.status(204).send();
});

artifactsRouter.post("/stories", async (req, res) => {
  if (!req.body.title || !req.body.epicId) {
    return res.status(400).json({ error: "title and epicId are required" });
  }
  const story = await store.createStory(req.body);
  return res.status(201).json(story);
});

artifactsRouter.patch("/stories/:id", async (req, res) => {
  const story = await store.updateStory(req.params.id, req.body);
  if (!story) {
    return res.status(404).json({ error: "Story not found" });
  }
  return res.json(story);
});

artifactsRouter.delete("/stories/:id", async (req, res) => {
  const deleted = await store.deleteStory(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Story not found" });
  }
  return res.status(204).send();
});

artifactsRouter.post("/tasks", async (req, res) => {
  if (!req.body.title || !req.body.storyId) {
    return res.status(400).json({ error: "title and storyId are required" });
  }
  const task = await store.createTask(req.body);
  return res.status(201).json(task);
});

artifactsRouter.patch("/tasks/:id", async (req, res) => {
  const task = await store.updateTask(req.params.id, req.body);
  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }
  return res.json(task);
});

artifactsRouter.delete("/tasks/:id", async (req, res) => {
  const deleted = await store.deleteTask(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Task not found" });
  }
  return res.status(204).send();
});

artifactsRouter.post("/comments", async (req, res) => {
  if (!req.body.itemType || !req.body.itemId || !req.body.content) {
    return res.status(400).json({ error: "itemType, itemId and content are required" });
  }
  const comment = await store.createComment({ ...req.body, role: req.role });
  return res.status(201).json(comment);
});

artifactsRouter.patch("/tasks/:id/status", async (req, res) => {
  const updated = await store.updateTaskStatus(req.params.id, req.body.status);
  if (!updated) {
    return res.status(400).json({ error: "Invalid task id or status" });
  }
  return res.json(updated);
});

artifactsRouter.get("/backlog/prioritized", async (req, res) => {
  res.json({ items: await store.getPrioritizedBacklog() });
});

artifactsRouter.get("/dashboard", async (req, res) => {
  res.json(await store.getDashboard());
});
