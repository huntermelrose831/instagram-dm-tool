const { db, initializeDatabase } = require("./db");
const logger = require("../utils/logger");

const TABLE_NAME = "scraping_jobs";

const init = async () => {
  try {
    await initializeDatabase();

    // Create scraping_jobs table after main database is initialized
    await new Promise((resolve, reject) => {
      db.run(
        `
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          targets TEXT,
          filters TEXT,
          max_leads INTEGER DEFAULT 1000,
          is_active BOOLEAN DEFAULT 1,
          status TEXT DEFAULT 'pending',
          progress REAL DEFAULT 0,
          completed_leads INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `,
        (err) => {
          if (err) {
            logger.error("Scraping jobs table creation failed:", err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    // Create indexes for better performance
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_scraping_jobs_status ON ${TABLE_NAME}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_scraping_jobs_type ON ${TABLE_NAME}(type)`,
      `CREATE INDEX IF NOT EXISTS idx_scraping_jobs_created_at ON ${TABLE_NAME}(created_at DESC)`,
    ];

    for (const indexSql of indexes) {
      await new Promise((resolve, reject) => {
        db.run(indexSql, (err) => {
          if (err) {
            logger.error("Scraping jobs index creation failed:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    logger.info("Scraping jobs table initialized");
  } catch (error) {
    logger.error("Error initializing scraping jobs table:", error);
  }
};

class ScrapingService {
  static async createScrapingJob(jobData) {
    try {
      const job = {
        name: jobData.name,
        type: jobData.type,
        targets: JSON.stringify(jobData.targets || []),
        filters: JSON.stringify(jobData.filters || {}),
        max_leads: jobData.maxLeads || 1000,
        is_active: jobData.isActive !== undefined ? jobData.isActive : true,
        status: jobData.status || "pending",
        progress: 0,
        completed_leads: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = db.run(
        `
        INSERT INTO ${TABLE_NAME} (name, type, targets, filters, max_leads, is_active, status, progress, completed_leads, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        [
          job.name,
          job.type,
          job.targets,
          job.filters,
          job.max_leads,
          job.is_active,
          job.status,
          job.progress,
          job.completed_leads,
          job.created_at,
          job.updated_at,
        ]
      );

      return result.lastInsertRowid;
    } catch (error) {
      console.error("Error creating scraping job:", error);
      throw error;
    }
  }

  static async getAllJobs() {
    try {
      const jobs = db.all(`
        SELECT * FROM ${TABLE_NAME}
        ORDER BY created_at DESC
      `);

      return jobs.map((job) => ({
        ...job,
        id: job.id,
        targets: JSON.parse(job.targets || "[]"),
        filters: JSON.parse(job.filters || "{}"),
        isActive: job.is_active,
        maxLeads: job.max_leads,
        completedLeads: job.completed_leads,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      }));
    } catch (error) {
      console.error("Error getting scraping jobs:", error);
      throw error;
    }
  }

  static async getJobById(id) {
    try {
      const job = db.get(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [id]);
      if (!job) return null;

      return {
        ...job,
        id: job.id,
        targets: JSON.parse(job.targets || "[]"),
        filters: JSON.parse(job.filters || "{}"),
        isActive: job.is_active,
        maxLeads: job.max_leads,
        completedLeads: job.completed_leads,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      };
    } catch (error) {
      console.error("Error getting scraping job:", error);
      throw error;
    }
  }

  static async updateJob(id, updates) {
    try {
      const updateFields = [];
      const values = [];

      if (updates.status !== undefined) {
        updateFields.push("status = ?");
        values.push(updates.status);
      }
      if (updates.progress !== undefined) {
        updateFields.push("progress = ?");
        values.push(updates.progress);
      }
      if (updates.completedLeads !== undefined) {
        updateFields.push("completed_leads = ?");
        values.push(updates.completedLeads);
      }
      if (updates.isActive !== undefined) {
        updateFields.push("is_active = ?");
        values.push(updates.isActive);
      }

      updateFields.push("updated_at = ?");
      values.push(new Date().toISOString());
      values.push(id);

      db.run(
        `
        UPDATE ${TABLE_NAME}
        SET ${updateFields.join(", ")}
        WHERE id = ?
      `,
        values
      );

      return true;
    } catch (error) {
      console.error("Error updating scraping job:", error);
      throw error;
    }
  }

  static async deleteJob(id) {
    try {
      db.run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
      return true;
    } catch (error) {
      console.error("Error deleting scraping job:", error);
      throw error;
    }
  }
}

// Initialize on module load
init().catch((err) => {
  logger.error("Failed to initialize scraping:", err);
});

module.exports = ScrapingService;
