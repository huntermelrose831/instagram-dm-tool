const express = require("express");
const router = express.Router();
const logger = require("../utils/logger");
const {
  getContacts,
  createContact,
  updateContactStatus,
  deleteContact,
  addNote,
  addTagToContact,
  removeTagFromContact,
  recordInteraction,
} = require("../database");

// GET /api/crm/contacts
router.get("/contacts", async (req, res) => {
  try {
    const contacts = await getContacts();
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// POST /api/crm/contacts
router.post("/contacts", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res
        .status(400)
        .json({ status: "error", message: "Username is required" });
    }
    const contact = await createContact(username);
    res.json(contact);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// PATCH /api/crm/contacts/:id
router.patch("/contacts/:id", async (req, res) => {
  try {
    const result = await updateContactStatus(
      parseInt(req.params.id),
      req.body.status,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// DELETE /api/crm/contacts/:id
router.delete("/contacts/:id", async (req, res) => {
  try {
    await deleteContact(parseInt(req.params.id));
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// POST /api/crm/contacts/:id/notes
router.post("/contacts/:id/notes", async (req, res) => {
  try {
    const note = await addNote(parseInt(req.params.id), req.body.content);
    res.json(note);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// POST /api/crm/contacts/:id/tags
router.post("/contacts/:id/tags", async (req, res) => {
  try {
    await addTagToContact(parseInt(req.params.id), req.body.tag);
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// DELETE /api/crm/contacts/:id/tags/:tagName
router.delete("/contacts/:id/tags/:tagName", async (req, res) => {
  try {
    await removeTagFromContact(
      parseInt(req.params.id),
      decodeURIComponent(req.params.tagName),
    );
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// POST /api/crm/contacts/:id/interactions
router.post("/contacts/:id/interactions", async (req, res) => {
  try {
    const interaction = await recordInteraction(
      parseInt(req.params.id),
      req.body.type,
      req.body.details,
    );
    res.json(interaction || { status: "success" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
