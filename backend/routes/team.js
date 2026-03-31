const express = require("express");
const router = express.Router();
const TeamService = require("../database/team");

// --- GET Endpoints ---

router.get("/members", async (req, res) => {
  try {
    const members = await TeamService.getMembers();
    res.json({ members });
  } catch (err) {
    console.error("Error getting team members:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/roles", async (req, res) => {
  try {
    const roles = await TeamService.getRoles();
    res.json({ roles });
  } catch (err) {
    console.error("Error getting roles:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/templates", async (req, res) => {
  try {
    const templates = await TeamService.getTemplates();
    res.json({ templates });
  } catch (err) {
    console.error("Error getting templates:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/workspaces", async (req, res) => {
  try {
    const workspaces = await TeamService.getWorkspaces();
    res.json({ workspaces });
  } catch (err) {
    console.error("Error getting workspaces:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/activity", async (req, res) => {
  try {
    const activities = await TeamService.getActivity();
    res.json({ activities });
  } catch (err) {
    console.error("Error getting activity:", err);
    res.status(500).json({ message: err.message });
  }
});

// --- POST/PUT/DELETE Endpoints ---

router.post("/invite", async (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ message: "Missing request body." });
  }
  const { email, role } = req.body;
  if (!email || !role) {
    return res.status(400).json({ message: "Email and role are required." });
  }
  try {
    const member = await TeamService.addMember({ email, role });
    await TeamService.logActivity("System", `Invited ${email} as ${role}`);
    res.status(200).json({
      status: "success",
      message: `Invitation sent to ${email}.`,
      member,
    });
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE constraint")) {
      return res
        .status(409)
        .json({ message: "Member with that email already exists." });
    }
    console.error("Error inviting member:", err);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/members/:id", async (req, res) => {
  try {
    await TeamService.removeMember(parseInt(req.params.id));
    res.json({ status: "success" });
  } catch (err) {
    console.error("Error removing member:", err);
    res.status(500).json({ message: err.message });
  }
});

router.patch("/members/:id/role", async (req, res) => {
  try {
    const { role } = req.body;
    if (!role) return res.status(400).json({ message: "Role is required." });
    await TeamService.updateMemberRole(parseInt(req.params.id), role);
    res.json({ status: "success" });
  } catch (err) {
    console.error("Error updating member role:", err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/templates", async (req, res) => {
  try {
    const { name, content } = req.body;
    if (!name || !content)
      return res
        .status(400)
        .json({ message: "Name and content are required." });
    const template = await TeamService.addTemplate({ name, content });
    res.json({ status: "success", template });
  } catch (err) {
    console.error("Error adding template:", err);
    res.status(500).json({ message: err.message });
  }
});

router.delete("/templates/:id", async (req, res) => {
  try {
    await TeamService.deleteTemplate(parseInt(req.params.id));
    res.json({ status: "success" });
  } catch (err) {
    console.error("Error deleting template:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
