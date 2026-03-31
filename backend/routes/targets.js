const express = require("express");
const router = express.Router();
const TargetsService = require("../database/targets");
const LeadsService = require("../database/leads");

// ── Targets ──────────────────────────────────────────────────────────────────

// GET /api/targets
router.get("/targets", async (req, res) => {
  try {
    const targets = await TargetsService.loadTargets();
    res.json({ status: "success", targets });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// POST /api/targets
router.post("/targets", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) {
      return res
        .status(400)
        .json({ status: "error", message: "Username is required" });
    }
    const targets = await TargetsService.addTarget(username.trim());
    res.json({ status: "success", targets });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// DELETE /api/targets/clear  (must be before /:username)
router.delete("/targets/clear", async (req, res) => {
  try {
    await TargetsService.clearTargets();
    res.json({ status: "success", targets: [] });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// DELETE /api/targets/:username
router.delete("/targets/:username", async (req, res) => {
  try {
    const targets = await TargetsService.removeTarget(req.params.username);
    res.json({ status: "success", targets });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ── Leads ─────────────────────────────────────────────────────────────────────

// POST /api/leads/batch
router.post("/leads/batch", async (req, res) => {
  try {
    const { leads } = req.body;
    if (!leads || !Array.isArray(leads)) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Invalid leads data. Expected an array of leads.",
        });
    }

    let savedCount = 0;
    const errors = [];

    for (const lead of leads) {
      try {
        const {
          username,
          source = "manual",
          status = "new",
          isTarget = true,
        } = lead;
        if (!username) {
          errors.push("Username is required for each lead");
          continue;
        }

        const result = await LeadsService.createLeadOrIgnore({
          username: username.replace("@", ""),
          source,
          status,
          is_target: isTarget ? 1 : 0,
        });

        if (result.inserted) {
          savedCount++;
        } else {
          const existing = await LeadsService.getLeadByUsername(
            username.replace("@", ""),
          );
          if (existing) {
            await LeadsService.updateLead(existing.id, {
              is_target: isTarget ? 1 : 0,
              status: status || existing.status,
            });
          }
        }

        if (isTarget) {
          await TargetsService.addTarget(username.replace("@", ""));
        }
      } catch (leadError) {
        errors.push(`Failed to save ${lead.username}: ${leadError.message}`);
      }
    }

    res.json({
      status: "success",
      savedCount,
      totalRequested: leads.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully saved ${savedCount} out of ${leads.length} leads`,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

module.exports = router;
