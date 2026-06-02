import { Router } from "express";
import multer from "multer";
import { generateWithAi } from "../ai.js";
import { store } from "../storeDb.js";

const upload = multer({ storage: multer.memoryStorage() });

export const aiRouter = Router();

async function run(res, system, user, title) {
  try {
    const output = await generateWithAi(system, user, title);
    return res.json(output);
  } catch (error) {
    return res.status(500).json({
      error: "AI generation failed",
      details: error.message
    });
  }
}

aiRouter.post("/ai/story-draft", async (req, res) => {
  const { feature, userType, goal } = req.body;
  const prompt = `Feature: ${feature}\nUser: ${userType}\nGoal: ${goal}\nReturn a user story draft.`;
  return run(
    res,
    "You are an Agile BA assistant creating crisp user story drafts.",
    prompt,
    "User Story Draft"
  );
});

aiRouter.post("/ai/acceptance-criteria", async (req, res) => {
  const { storyTitle, context } = req.body;
  const prompt = `Story: ${storyTitle}\nContext: ${context}\nReturn numbered acceptance criteria.`;
  return run(
    res,
    "You are an Agile quality coach creating testable acceptance criteria.",
    prompt,
    "Acceptance Criteria"
  );
});

aiRouter.post("/ai/sprint-summary", async (req, res) => {
  const { completed, blocked, carryOver } = req.body;
  const prompt = `Completed: ${completed}\nBlocked: ${blocked}\nCarry over: ${carryOver}\nCreate sprint summary for stakeholders.`;
  return run(
    res,
    "You summarize sprint outcomes clearly for cross-functional stakeholders.",
    prompt,
    "Sprint Summary"
  );
});

aiRouter.post("/ai/retro-notes", async (req, res) => {
  const { wentWell, improve, actions } = req.body;
  const prompt = `Went well: ${wentWell}\nTo improve: ${improve}\nCandidate actions: ${actions}\nCreate retrospective notes.`;
  return run(
    res,
    "You produce balanced retrospective notes with actionable follow-up.",
    prompt,
    "Retrospective Notes"
  );
});

aiRouter.post("/ai/meeting-action-items", async (req, res) => {
  const { meetingNotes } = req.body;
  const prompt = `Meeting notes:\n${meetingNotes}\nExtract action items with owner and due date suggestions.`;
  return run(
    res,
    "You convert meeting notes into concrete action items for Agile teams.",
    prompt,
    "Meeting Action Items"
  );
});

aiRouter.post("/ai/standup-summary", async (req, res) => {
  const { updates } = req.body;
  const prompt = `Team updates:\n${updates}\nGenerate concise daily standup summary with blockers and asks.`;
  return run(
    res,
    "You summarize daily standup updates into concise report format.",
    prompt,
    "Standup Summary"
  );
});

aiRouter.post("/ai/meeting-notes-to-work", upload.single("file"), async (req, res) => {
  let notes = req.body.notes || "";

  if (req.file) {
    notes = req.file.buffer.toString("utf8");
  }

  const meeting = await store.saveMeeting({
    title: req.body.title || "Uploaded Meeting Notes",
    notes
  });

  const prompt = `Meeting notes:\n${notes}\nReturn four sections:\n1) Requirements\n2) Tasks\n3) Risks\n4) Dependencies`;

  try {
    const output = await generateWithAi(
      "You are a senior BA translating raw meeting notes into structured Agile execution input.",
      prompt,
      "Meeting Notes to Work Breakdown"
    );

    return res.json({
      meeting,
      analysis: output
    });
  } catch (error) {
    return res.status(500).json({
      error: "Meeting note analysis failed",
      details: error.message
    });
  }
});
