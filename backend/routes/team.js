const express = require("express");
const router = express.Router();

// --- Mock Data ---
const mockTeamMembers = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@example.com",
    role: "Admin",
    avatar: "/avatars/avatar1.svg",
  },
  {
    id: 2,
    name: "Manager User",
    email: "manager@example.com",
    role: "Manager",
    avatar: "/avatars/avatar2.svg",
  },
  {
    id: 3,
    name: "Member User",
    email: "member@example.com",
    role: "Member",
    avatar: "/avatars/avatar3.svg",
  },
];

const mockRoles = [
  { id: "admin", name: "Admin", description: "Full access to all features." },
  {
    id: "manager",
    name: "Manager",
    description: "Can manage campaigns and view reports.",
  },
  {
    id: "member",
    name: "Member",
    description: "Can view campaigns and basic data.",
  },
];

const mockSharedTemplates = [
  { id: 1, name: "Welcome Message", content: "Hey {{username}}, welcome!" },
  { id: 2, name: "Follow-Up", content: "Just checking in, {{username}}." },
];

const mockWorkspaces = [{ id: 1, name: "Default Workspace" }];

const mockActivity = [
  {
    id: 1,
    user: "Admin User",
    action: "Invited manager@example.com",
    timestamp: "2023-10-27T10:00:00Z",
  },
];

// --- GET Endpoints ---

router.get("/members", (req, res) => {
  res.json({ members: mockTeamMembers });
});

router.get("/roles", (req, res) => {
  res.json({ roles: mockRoles });
});

router.get("/templates", (req, res) => {
  res.json({ templates: mockSharedTemplates });
});

router.get("/workspaces", (req, res) => {
  res.json({ workspaces: mockWorkspaces });
});

router.get("/activity", (req, res) => {
  res.json({ activities: mockActivity });
});

// --- POST/PUT Endpoints ---

router.post("/invite", (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ message: "Missing request body." });
  }
  const { email, role } = req.body;
  if (!email || !role) {
    return res.status(400).json({ message: "Email and role are required." });
  }
  console.log(`Inviting ${email} as ${role}`);
  res.status(200).json({
    status: "success",
    message: `Invitation sent to ${email}.`,
  });
});

module.exports = router;
