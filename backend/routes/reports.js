const express = require("express");
const router = express.Router();
const { ReportsService, getContacts } = require("../database");
const LeadsService = require("../database/leads");
const TargetsService = require("../database/targets");
const { AccountsService } = require("../database");

// ── In-memory export job store ────────────────────────────────────────────────
const exportJobs = new Map();
let exportJobIdCounter = 1;

// ── Reports ───────────────────────────────────────────────────────────────────

// GET /api/reports
router.get("/reports", async (req, res) => {
  try {
    const { type, account } = req.query;
    let reports;
    if (type) {
      reports = await ReportsService.getReportsByType(type);
    } else if (account) {
      reports = await ReportsService.getReportsByAccount(account);
    } else {
      reports = await ReportsService.getAllReports();
    }
    res.json({ reports: reports || [] });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// GET /api/reports/stats
router.get("/reports/stats", async (req, res) => {
  try {
    const stats = await ReportsService.getReportStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// GET /api/reports/scheduled
router.get("/reports/scheduled", async (req, res) => {
  res.json({ scheduledReports: [] });
});

// POST /api/reports/create
router.post("/reports/create", async (req, res) => {
  try {
    const {
      name,
      type = "standard",
      dateRange,
      metrics,
      filters,
      visualization,
      format,
      schedule,
    } = req.body;
    const reportData = {
      type: type || "standard",
      account_username: req.body.account_username || null,
      data: {
        name,
        dateRange,
        metrics,
        filters,
        visualization,
        format,
        schedule,
      },
    };
    const report = await ReportsService.createReport(reportData);
    res.json({ status: "success", report });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// POST /api/reports/:id/run
router.post("/reports/:id/run", async (req, res) => {
  try {
    const report = await ReportsService.getReportById(parseInt(req.params.id));
    if (!report) {
      return res
        .status(404)
        .json({ status: "error", message: "Report not found" });
    }
    let resultData = [];
    try {
      resultData = await ReportsService.getAllReports();
    } catch {
      resultData = [];
    }
    await ReportsService.updateReport(report.id, {
      data: {
        ...report.data,
        last_run: new Date().toISOString(),
        row_count: resultData.length,
      },
    });
    res.json({ status: "success", report, results: resultData });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// POST /api/reports/:id/export  — download a single report as CSV
router.post("/reports/:id/export", async (req, res) => {
  try {
    const report = await ReportsService.getReportById(parseInt(req.params.id));
    if (!report) {
      return res
        .status(404)
        .json({ status: "error", message: "Report not found" });
    }
    const rows = Array.isArray(report.data) ? report.data : [report];
    const headers = Object.keys(
      rows[0] || { id: "", type: "", created_at: "" },
    ).join(",");
    const csvRows = rows.map((r) =>
      Object.values(r)
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [headers, ...csvRows].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="report-${report.id}.csv"`,
    );
    res.send(csv);
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// DELETE /api/reports/:id
router.delete("/reports/:id", async (req, res) => {
  try {
    await ReportsService.deleteReport(parseInt(req.params.id));
    res.json({ status: "success" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// ── Exports ───────────────────────────────────────────────────────────────────

// GET /api/exports/jobs
router.get("/exports/jobs", (req, res) => {
  res.json({ jobs: Array.from(exportJobs.values()) });
});

/**
 * POST /api/exports/start
 *
 * Supported `type` values:
 *   leads       → leads table
 *   targets     → targets table
 *   accounts    → accounts table (sensitive fields stripped)
 *   contacts / crm  → CRM contacts
 *   dm_history / messages  → reports table (closest to message history)
 */
router.post("/exports/start", async (req, res) => {
  try {
    const { type = "leads", format = "csv" } = req.body;
    const id = exportJobIdCounter++;
    const now = new Date().toISOString();

    let data = [];
    try {
      if (type === "leads") {
        data = await LeadsService.getLeads();
      } else if (type === "targets") {
        const raw = await TargetsService.loadTargets();
        // loadTargets may return strings or objects — normalise to objects
        data = raw.map((t) => (typeof t === "string" ? { username: t } : t));
      } else if (type === "accounts") {
        const accounts = await AccountsService.getAccounts();
        // Strip cookies / password hashes before exporting
        data = accounts.map(
          ({ username, email, isActive, created_at, daily_dm_count }) => ({
            username,
            email: email || "",
            isActive: isActive ? "yes" : "no",
            created_at: created_at || "",
            daily_dm_count: daily_dm_count || 0,
          }),
        );
      } else if (type === "contacts" || type === "crm") {
        data = await getContacts();
      } else {
        // dm_history / messages / anything else: use reports table
        data = await ReportsService.getAllReports();
      }
    } catch (dataErr) {
      console.warn(`Export data fetch warning: ${dataErr.message}`);
      data = [];
    }

    let csvContent = "";
    if (data.length > 0) {
      const headers = Object.keys(data[0]).join(",");
      const rows = data.map((row) =>
        Object.values(row)
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
      csvContent = [headers, ...rows].join("\n");
    } else {
      // Empty result — still produce a valid CSV with headers describing the export
      csvContent = `type,exported_at,row_count\n${type},${now},0`;
    }

    const job = {
      id,
      type,
      format,
      status: "completed",
      created_at: now,
      completed_at: now,
      file_path: `${type}-export-${id}.${format}`,
      row_count: data.length,
      csv_content: csvContent,
    };
    exportJobs.set(id, job);

    // Keep at most 50 jobs in memory
    if (exportJobs.size > 50) {
      exportJobs.delete(exportJobs.keys().next().value);
    }

    res.json({ status: "success", job });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// GET /api/exports/jobs/:id/download
router.get("/exports/jobs/:id/download", (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const job = exportJobs.get(id);
    if (!job) {
      return res
        .status(404)
        .json({ status: "error", error: "Export job not found" });
    }
    if (job.status !== "completed") {
      return res
        .status(400)
        .json({ status: "error", error: "Export not ready" });
    }
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${job.file_path || `export-${id}.csv`}"`,
    );
    res.send(job.csv_content || "");
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

module.exports = router;
