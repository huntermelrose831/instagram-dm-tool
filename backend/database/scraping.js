const db = require("./db");

class ScrapingService {
  // Create a new scraping job
  static createScrapingJob(jobData) {
    const stmt = db.prepare(`
      INSERT INTO scraping_jobs (
        name, type, targets, filters, max_leads, is_active, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      jobData.name,
      jobData.type,
      JSON.stringify(jobData.targets || []),
      JSON.stringify(jobData.filters || {}),
      jobData.maxLeads || 1000,
      jobData.isActive !== undefined ? jobData.isActive : 1,
      jobData.status || "pending"
    );

    return info.lastInsertRowid;
  }

  // Get all scraping jobs
  static getScrapingJobs(filters = {}) {
    let query = "SELECT * FROM scraping_jobs WHERE 1=1";
    const params = [];

    if (filters.type) {
      query += " AND type = ?";
      params.push(filters.type);
    }

    if (filters.status) {
      query += " AND status = ?";
      params.push(filters.status);
    }

    if (filters.isActive !== undefined) {
      query += " AND is_active = ?";
      params.push(filters.isActive ? 1 : 0);
    }

    query += " ORDER BY created_at DESC";

    const stmt = db.prepare(query);
    const jobs = stmt.all(...params);

    return jobs.map((job) => ({
      ...job,
      targets: JSON.parse(job.targets || "[]"),
      filters: JSON.parse(job.filters || "{}"),
      isActive: !!job.is_active,
    }));
  }

  // Get scraping job by ID
  static getScrapingJobById(id) {
    const stmt = db.prepare("SELECT * FROM scraping_jobs WHERE id = ?");
    const job = stmt.get(id);

    if (job) {
      return {
        ...job,
        targets: JSON.parse(job.targets || "[]"),
        filters: JSON.parse(job.filters || "{}"),
        isActive: !!job.is_active,
      };
    }

    return null;
  }

  // Update scraping job status
  static updateJobStatus(id, status, completedLeads = null) {
    const stmt = db.prepare(`
      UPDATE scraping_jobs 
      SET 
        status = ?, 
        completed_leads = COALESCE(?, completed_leads),
        updated_at = CURRENT_TIMESTAMP,
        completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
      WHERE id = ?
    `);

    const info = stmt.run(status, completedLeads, status, id);
    return info.changes > 0;
  }

  // Update job progress
  static updateJobProgress(id, progress, currentProgress = null) {
    const stmt = db.prepare(`
      UPDATE scraping_jobs 
      SET 
        progress = ?,
        current_progress = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const info = stmt.run(progress, currentProgress, id);
    return info.changes > 0;
  }

  // Delete scraping job
  static deleteScrapingJob(id) {
    const stmt = db.prepare("DELETE FROM scraping_jobs WHERE id = ?");
    const info = stmt.run(id);
    return info.changes > 0;
  }

  // Toggle job active status
  static toggleJobStatus(id) {
    const stmt = db.prepare(`
      UPDATE scraping_jobs 
      SET 
        is_active = NOT is_active,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const info = stmt.run(id);
    return info.changes > 0;
  }

  // Get job statistics
  static getJobStats() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(completed_leads) as total_leads_found
      FROM scraping_jobs
    `);

    return stmt.get();
  }

  // Get recent completed jobs
  static getRecentCompletedJobs(limit = 5) {
    const stmt = db.prepare(`
      SELECT * FROM scraping_jobs 
      WHERE status = 'completed' 
      ORDER BY completed_at DESC 
      LIMIT ?
    `);

    const jobs = stmt.all(limit);

    return jobs.map((job) => ({
      ...job,
      targets: JSON.parse(job.targets || "[]"),
      filters: JSON.parse(job.filters || "{}"),
      isActive: !!job.is_active,
    }));
  }

  // Update job error log
  static updateJobError(id, errorMessage) {
    const stmt = db.prepare(`
      UPDATE scraping_jobs 
      SET 
        status = 'failed',
        error_log = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const info = stmt.run(errorMessage, id);
    return info.changes > 0;
  }
}

module.exports = ScrapingService;
