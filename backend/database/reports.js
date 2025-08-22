const path = require("path");
const fs = require("fs");
const db = require("./db");

// Initialize tables if not present
function init() {
  db.exec(`CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT DEFAULT 'standard',
    metrics_json TEXT NOT NULL,
    date_range TEXT DEFAULT 'last_30_days',
    visualization TEXT DEFAULT 'table',
    format TEXT DEFAULT 'pdf',
    filters_json TEXT DEFAULT '{}',
    schedule_frequency TEXT DEFAULT 'manual',
    schedule_time TEXT DEFAULT '09:00',
    schedule_days_json TEXT DEFAULT '[]',
    status TEXT DEFAULT 'active',
    last_generated DATETIME,
    next_run DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`);

  db.exec(`CREATE TRIGGER IF NOT EXISTS trg_reports_updated
  AFTER UPDATE ON reports
  FOR EACH ROW BEGIN
    UPDATE reports SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
  END;`);

  db.exec(`CREATE TABLE IF NOT EXISTS report_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_json TEXT NOT NULL,
    FOREIGN KEY(report_id) REFERENCES reports(id) ON DELETE CASCADE
  );`);

  db.exec(`CREATE TABLE IF NOT EXISTS export_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    filters_json TEXT DEFAULT '{}',
    format TEXT DEFAULT 'csv',
    record_count INTEGER,
    file_path TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME
  );`);

  const exportsDir = path.join(__dirname, "..", "exports");
  if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
}

function computeNextRun(freq, time, days) {
  if (!freq || freq === "manual") return null;
  try {
    const now = new Date();
    const [hh, mm] = (time || "09:00").split(":").map(Number);
    const base = new Date(now);
    base.setHours(hh, mm, 0, 0);
    if (freq === "daily") {
      if (base <= now) base.setDate(base.getDate() + 1);
      return base.toISOString();
    }
    if (freq === "weekly") {
      const dayList =
        Array.isArray(days) && days.length ? days.map(Number) : [1];
      for (let i = 0; i < 14; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        if (dayList.includes(d.getDay())) {
          d.setHours(hh, mm, 0, 0);
          if (d > now) return d.toISOString();
        }
      }
      base.setDate(base.getDate() + 7);
      return base.toISOString();
    }
    if (freq === "monthly") {
      if (base <= now) base.setMonth(base.getMonth() + 1);
      return base.toISOString();
    }
  } catch (e) {
    return null;
  }
  return null;
}

function hydrateReport(r) {
  return {
    ...r,
    metrics: JSON.parse(r.metrics_json || "[]"),
    filters: JSON.parse(r.filters_json || "{}"),
    schedule_days: JSON.parse(r.schedule_days_json || "[]"),
  };
}

function createReport(cfg) {
  const {
    name,
    type = "standard",
    metrics = [],
    dateRange = "last_30_days",
    visualization = "table",
    format = "pdf",
    filters = {},
    schedule = { frequency: "manual", time: "09:00", days: [] },
    status = "active",
  } = cfg;
  if (!name || !metrics.length)
    throw new Error("Name & at least one metric required");
  const nextRun = computeNextRun(
    schedule.frequency,
    schedule.time,
    schedule.days
  );
  const info = db
    .prepare(
      `INSERT INTO reports (name,type,metrics_json,date_range,visualization,format,filters_json,schedule_frequency,schedule_time,schedule_days_json,status,next_run) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      name,
      type,
      JSON.stringify(metrics),
      dateRange,
      visualization,
      format,
      JSON.stringify(filters),
      schedule.frequency || "manual",
      schedule.time || "09:00",
      JSON.stringify(schedule.days || []),
      status,
      nextRun
    );
  return getReport(info.lastInsertRowid);
}

function listReports() {
  return db
    .prepare(`SELECT * FROM reports ORDER BY created_at DESC`)
    .all()
    .map(hydrateReport);
}

function getReport(id) {
  const r = db.prepare(`SELECT * FROM reports WHERE id=?`).get(id);
  return r ? hydrateReport(r) : null;
}

function updateReport(id, fields) {
  const current = getReport(id);
  if (!current) return null;
  const merged = {
    ...current,
    ...fields,
    metrics: fields.metrics || current.metrics,
    filters: fields.filters || current.filters,
    schedule: fields.schedule || {
      frequency: current.schedule_frequency,
      time: current.schedule_time,
      days: current.schedule_days,
    },
  };
  const nextRun = computeNextRun(
    merged.schedule.frequency,
    merged.schedule.time,
    merged.schedule.days
  );
  db.prepare(
    `UPDATE reports SET name=?, type=?, metrics_json=?, date_range=?, visualization=?, format=?, filters_json=?, schedule_frequency=?, schedule_time=?, schedule_days_json=?, status=?, next_run=? WHERE id=?`
  ).run(
    merged.name,
    merged.type,
    JSON.stringify(merged.metrics),
    merged.dateRange || merged.date_range,
    merged.visualization,
    merged.format,
    JSON.stringify(merged.filters),
    merged.schedule.frequency,
    merged.schedule.time,
    JSON.stringify(merged.schedule.days),
    merged.status,
    nextRun,
    id
  );
  return getReport(id);
}

function deleteReport(id) {
  db.prepare(`DELETE FROM reports WHERE id=?`).run(id);
  return true;
}

function saveReportResult(reportId, data) {
  db.prepare(
    `INSERT INTO report_results (report_id,data_json) VALUES (?,?)`
  ).run(reportId, JSON.stringify(data));
  db.prepare(
    `UPDATE reports SET last_generated=CURRENT_TIMESTAMP WHERE id=?`
  ).run(reportId);
  return latestResult(reportId);
}

function latestResult(reportId) {
  const row = db
    .prepare(
      `SELECT * FROM report_results WHERE report_id=? ORDER BY generated_at DESC LIMIT 1`
    )
    .get(reportId);
  return row ? { ...row, data: JSON.parse(row.data_json) } : null;
}

function listScheduledDue(nowISO = new Date().toISOString()) {
  return db
    .prepare(
      `SELECT * FROM reports WHERE schedule_frequency != 'manual' AND next_run IS NOT NULL AND next_run <= ? AND status='active'`
    )
    .all(nowISO)
    .map(hydrateReport);
}

function resolveDateRange(token) {
  const now = new Date();
  let start;
  if (token === "last_7_days") {
    start = new Date(now);
    start.setDate(start.getDate() - 7);
  } else if (token === "last_90_days") {
    start = new Date(now);
    start.setDate(start.getDate() - 90);
  } else {
    start = new Date(now);
    start.setDate(start.getDate() - 30);
  }
  return { start: start.toISOString(), end: now.toISOString() };
}

function scalar(sql, range) {
  const row = db.prepare(sql).get(range.start, range.end);
  return row ? row.c : 0;
}

function computeMetrics(report) {
  const metrics = {};
  const range = resolveDateRange(report.date_range || report.dateRange);
  for (const m of report.metrics) {
    try {
      switch (m) {
        case "messages_sent":
          metrics[m] = scalar(
            `SELECT COUNT(*) c FROM message_history WHERE sent_at BETWEEN ? AND ?`,
            range
          );
          break;
        case "leads_generated":
          metrics[m] = scalar(
            `SELECT COUNT(*) c FROM leads WHERE created_at BETWEEN ? AND ?`,
            range
          );
          break;
        case "conversion_rate":
          const sent = metrics["messages_sent"] ?? 0;
          const leads = metrics["leads_generated"] ?? 0;
          metrics[m] = sent ? +(leads / sent).toFixed(4) : 0;
          break;
        default:
          metrics[m] = null;
      }
    } catch (e) {
      metrics[m] = null;
    }
  }
  return { generated_at: new Date().toISOString(), range, metrics };
}

// Export jobs
function createExportJob({ type, filters = {}, format = "csv" }) {
  const info = db
    .prepare(
      `INSERT INTO export_jobs (type,filters_json,format) VALUES (?,?,?)`
    )
    .run(type, JSON.stringify(filters), format);
  return getExportJob(info.lastInsertRowid);
}
function listExportJobs() {
  return db
    .prepare(`SELECT * FROM export_jobs ORDER BY created_at DESC LIMIT 100`)
    .all()
    .map((j) => ({ ...j, filters: JSON.parse(j.filters_json || "{}") }));
}
function getExportJob(id) {
  const j = db.prepare(`SELECT * FROM export_jobs WHERE id=?`).get(id);
  return j ? { ...j, filters: JSON.parse(j.filters_json || "{}") } : null;
}
function markExportStarted(id) {
  db.prepare(
    `UPDATE export_jobs SET status='processing', started_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(id);
}
function updateExportProgress(id, progress) {
  db.prepare(`UPDATE export_jobs SET progress=? WHERE id=?`).run(progress, id);
}
function completeExport(id, filePath, recordCount) {
  db.prepare(
    `UPDATE export_jobs SET status='completed', progress=100, file_path=?, record_count=?, completed_at=CURRENT_TIMESTAMP WHERE id=?`
  ).run(filePath, recordCount, id);
}
function failExport(id, error) {
  db.prepare(`UPDATE export_jobs SET status='error', error=? WHERE id=?`).run(
    error,
    id
  );
}

init();

module.exports = {
  createReport,
  listReports,
  getReport,
  updateReport,
  deleteReport,
  saveReportResult,
  latestResult,
  listScheduledDue,
  computeMetrics,
  createExportJob,
  listExportJobs,
  getExportJob,
  markExportStarted,
  updateExportProgress,
  completeExport,
  failExport,
};
