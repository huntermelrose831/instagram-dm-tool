// Database service for leads management
const { db, initializeDatabase } = require("./db");
const logger = require("../utils/logger");

const init = async () => {
  try {
    await initializeDatabase();

    // Create indexes after ensuring tables exist
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_leads_username ON leads(username)`,
      `CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`,
      `CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(source)`,
      `CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_leads_is_target ON leads(is_target)`,
    ];

    for (const indexSql of indexes) {
      await new Promise((resolve, reject) => {
        db.run(indexSql, (err) => {
          if (err) {
            logger.error("Index creation failed:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    logger.info("Leads table initialized");
  } catch (error) {
    logger.error("Error initializing leads table:", error);
  }
};

class LeadsService {
  static async createLead(leadData) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = db.prepare(`
          INSERT INTO leads (
            username, full_name, profile_url, status, source, is_target
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          leadData.username,
          leadData.fullName || null,
          leadData.profileUrl || `https://instagram.com/${leadData.username}`,
          leadData.status || "new",
          leadData.source || "manual",
          leadData.is_target || leadData.isTarget ? 1 : 0,
          function (err) {
            if (err) {
              console.error("Error creating lead:", err);
              reject(err);
            } else {
              resolve(this.lastID);
            }
          }
        );
      } catch (error) {
        console.error("Error creating lead:", error);
        reject(error);
      }
    });
  }

  // Create lead with duplicate handling (ignore if username already exists)
  static async createLeadOrIgnore(leadData) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO leads (
            username, full_name, profile_url, status, source, is_target
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
          leadData.username,
          leadData.fullName || null,
          leadData.profileUrl || `https://instagram.com/${leadData.username}`,
          leadData.status || "new",
          leadData.source || "manual",
          leadData.is_target || leadData.isTarget ? 1 : 0,
          function (err) {
            if (err) {
              console.error("Error creating lead:", err);
              reject(err);
            } else {
              // this.lastID will be 0 if the insert was ignored due to duplicate
              resolve({
                lastID: this.lastID,
                changes: this.changes,
                inserted: this.changes > 0,
              });
            }
          }
        );
      } catch (error) {
        console.error("Error creating lead:", error);
        reject(error);
      }
    });
  }

  static async getLeads(filters = {}) {
    return new Promise((resolve, reject) => {
      try {
        let query = "SELECT * FROM leads WHERE 1=1";
        let params = [];

        if (filters.status) {
          query += " AND status = ?";
          params.push(filters.status);
        }

        if (filters.source) {
          query += " AND source = ?";
          params.push(filters.source);
        }

        if (filters.minFollowers) {
          query += " AND 1=1"; // Remove follower filtering since column doesn't exist
          // params.push(filters.minFollowers);
        }

        if (filters.maxFollowers) {
          query += " AND 1=1"; // Remove follower filtering since column doesn't exist
          // params.push(filters.maxFollowers);
        }

        if (filters.search) {
          query += " AND (username LIKE ? OR full_name LIKE ?)";
          const searchTerm = `%${filters.search}%`;
          params.push(searchTerm, searchTerm);
        }

        query += " ORDER BY created_at DESC";

        if (filters.limit) {
          query += " LIMIT ?";
          params.push(filters.limit);
        }

        db.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          const leads = rows.map((lead) => ({
            ...lead,
            id: lead.id,
            isVerified: Boolean(lead.is_verified),
            hasProfilePic: Boolean(lead.has_profile_pic),
            hasWebsite: Boolean(lead.has_website),
            addedToTargets: Boolean(lead.added_to_targets),
            isTarget: Boolean(lead.is_target),
            tags: lead.tags ? JSON.parse(lead.tags) : [],
          }));

          resolve(leads);
        });
      } catch (error) {
        console.error("Error getting leads:", error);
        reject(error);
      }
    });
  }

  // Get lead by username
  static async getLeadByUsername(username) {
    return new Promise((resolve, reject) => {
      try {
        db.get(
          "SELECT * FROM leads WHERE username = ?",
          [username],
          (err, row) => {
            if (err) {
              reject(err);
              return;
            }

            if (row) {
              const lead = {
                ...row,
                id: row.id,
                isVerified: Boolean(row.is_verified),
                hasProfilePic: Boolean(row.has_profile_pic),
                hasWebsite: Boolean(row.has_website),
                addedToTargets: Boolean(row.added_to_targets),
                isTarget: Boolean(row.is_target),
                tags: row.tags ? JSON.parse(row.tags) : [],
              };
              resolve(lead);
            } else {
              resolve(null);
            }
          }
        );
      } catch (error) {
        console.error("Error getting lead by username:", error);
        reject(error);
      }
    });
  }

  // Update lead
  static async updateLead(leadId, updateData) {
    return new Promise((resolve, reject) => {
      try {
        let setParts = ["updated_at = CURRENT_TIMESTAMP"];
        let params = [];

        // Map frontend field names to database field names
        if (updateData.isTarget !== undefined) {
          setParts.push("is_target = ?");
          params.push(updateData.isTarget ? 1 : 0);
        }

        if (updateData.addedToTargets !== undefined) {
          setParts.push("added_to_targets = ?");
          params.push(updateData.addedToTargets ? 1 : 0);
        }

        if (updateData.status !== undefined) {
          setParts.push("status = ?");
          params.push(updateData.status);
        }

        if (updateData.tags !== undefined) {
          setParts.push("tags = ?");
          params.push(JSON.stringify(updateData.tags));
        }

        params.push(leadId);

        const query = `UPDATE leads SET ${setParts.join(", ")} WHERE id = ?`;

        db.run(query, params, function (err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes > 0);
        });
      } catch (error) {
        console.error("Error updating lead:", error);
        reject(error);
      }
    });
  }

  // Update all leads with certain criteria
  static async updateAllLeads(updateData, filter = {}) {
    return new Promise((resolve, reject) => {
      try {
        let setParts = ["updated_at = CURRENT_TIMESTAMP"];
        let params = [];

        // Map frontend field names to database field names
        if (updateData.isTarget !== undefined) {
          setParts.push("is_target = ?");
          params.push(updateData.isTarget ? 1 : 0);
        }

        if (updateData.addedToTargets !== undefined) {
          setParts.push("added_to_targets = ?");
          params.push(updateData.addedToTargets ? 1 : 0);
        }

        if (updateData.status !== undefined) {
          setParts.push("status = ?");
          params.push(updateData.status);
        }

        let whereClause = "WHERE 1=1";
        if (filter.status) {
          whereClause += " AND status = ?";
          params.push(filter.status);
        }

        const query = `UPDATE leads SET ${setParts.join(", ")} ${whereClause}`;

        db.run(query, params, function (err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes);
        });
      } catch (error) {
        console.error("Error updating all leads:", error);
        reject(error);
      }
    });
  }

  // Delete lead
  static async deleteLead(leadId) {
    return new Promise((resolve, reject) => {
      try {
        db.run("DELETE FROM leads WHERE id = ?", [leadId], function (err) {
          if (err) {
            reject(err);
            return;
          }
          resolve(this.changes > 0);
        });
      } catch (error) {
        console.error("Error deleting lead:", error);
        reject(error);
      }
    });
  }

  static async getScrapedLeads(filters = {}) {
    if (!filters.source) {
      filters.source = "scraping";
    }
    return this.getLeads(filters);
  }

  // Batch insert leads
  static async batchInsertLeads(leadsArray) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = db.prepare(`
          INSERT OR IGNORE INTO leads (
            username, full_name, profile_url, status, source, is_target
          ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        let insertedCount = 0;

        db.serialize(() => {
          db.run("BEGIN TRANSACTION");

          leadsArray.forEach((leadData) => {
            try {
              const result = stmt.run(
                leadData.username,
                leadData.fullName || null,
                leadData.profileUrl ||
                  `https://instagram.com/${leadData.username}`,
                leadData.status || "new",
                leadData.source || "manual",
                leadData.is_target || leadData.isTarget ? 1 : 0
              );
              if (result.changes > 0) insertedCount++;
            } catch (error) {
              console.warn(
                `Failed to insert lead ${leadData.username}:`,
                error.message
              );
            }
          });

          db.run("COMMIT", (err) => {
            if (err) {
              reject(err);
            } else {
              resolve({ insertedCount, totalCount: leadsArray.length });
            }
          });
        });
      } catch (error) {
        console.error("Error batch inserting leads:", error);
        reject(error);
      }
    });
  }
}

// Initialize on module load
init().catch((err) => {
  logger.error("Failed to initialize leads:", err);
});

module.exports = LeadsService;
