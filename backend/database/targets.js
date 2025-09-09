const { db, initializeDatabase } = require("./db");
const logger = require("../utils/logger");

const init = async () => {
  try {
    await initializeDatabase();

    // Create indexes after ensuring tables exist
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_targets_username ON targets(username)`,
      `CREATE INDEX IF NOT EXISTS idx_targets_created_at ON targets(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_targets_is_target ON targets(is_target)`,
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

    logger.info("Targets table initialized");
  } catch (error) {
    logger.error("Error initializing targets table:", error);
  }
};

class TargetsService {
  // Load all targets
  static async loadTargets() {
    try {
      return new Promise((resolve, reject) => {
        db.all(
          "SELECT * FROM targets WHERE is_target = 1 ORDER BY created_at DESC",
          [],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows.map((row) => row.username));
            }
          }
        );
      });
    } catch (error) {
      console.error("Error loading targets:", error);
      throw error;
    }
  }

  // Get all targets with metadata
  static async getAllTargets() {
    try {
      return new Promise((resolve, reject) => {
        db.all(
          "SELECT * FROM targets WHERE is_target = 1 ORDER BY created_at DESC",
          [],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(
                rows.map((row) => ({
                  username: row.username,
                  source: row.source,
                  created_at: row.created_at,
                  updated_at: row.updated_at,
                  id: row.id,
                }))
              );
            }
          }
        );
      });
    } catch (error) {
      console.error("Error getting all targets:", error);
      throw error;
    }
  }

  // Add a target
  static async addTarget(username) {
    try {
      if (!username || typeof username !== "string") {
        throw new Error("Username is required and must be a string");
      }

      return new Promise((resolve, reject) => {
        // Check if target already exists
        db.get(
          "SELECT * FROM targets WHERE username = ?",
          [username],
          (err, existingTarget) => {
            if (err) {
              reject(err);
              return;
            }

            if (existingTarget) {
              if (!existingTarget.is_target) {
                // Reactivate if it was previously deactivated
                db.run(
                  "UPDATE targets SET is_target = 1, updated_at = CURRENT_TIMESTAMP WHERE username = ?",
                  [username],
                  (updateErr) => {
                    if (updateErr) {
                      reject(updateErr);
                    } else {
                      this.loadTargets().then(resolve).catch(reject);
                    }
                  }
                );
              } else {
                this.loadTargets().then(resolve).catch(reject);
              }
            } else {
              // Create new target
              db.run(
                "INSERT INTO targets (username, source, is_target, added_to_targets) VALUES (?, ?, ?, ?)",
                [username.trim().toLowerCase(), "manual", 1, 1],
                (insertErr) => {
                  if (insertErr) {
                    reject(insertErr);
                  } else {
                    this.loadTargets().then(resolve).catch(reject);
                  }
                }
              );
            }
          }
        );
      });
    } catch (error) {
      console.error("Error adding target:", error);
      throw error;
    }
  }

  // Remove a target
  static async removeTarget(username) {
    try {
      if (!username || typeof username !== "string") {
        throw new Error("Username is required and must be a string");
      }

      return new Promise((resolve, reject) => {
        db.run(
          "UPDATE targets SET is_target = 0, updated_at = CURRENT_TIMESTAMP WHERE username = ?",
          [username],
          (err) => {
            if (err) {
              reject(err);
            } else {
              this.loadTargets().then(resolve).catch(reject);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error removing target:", error);
      throw error;
    }
  }

  // Clear all targets
  static async clearTargets() {
    try {
      return new Promise((resolve, reject) => {
        db.run(
          "UPDATE targets SET is_target = 0, updated_at = CURRENT_TIMESTAMP",
          [],
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve([]);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error clearing targets:", error);
      throw error;
    }
  }

  // Import targets from array
  static async importTargets(usernames) {
    try {
      if (!Array.isArray(usernames)) {
        throw new Error("Usernames must be an array");
      }

      return new Promise((resolve, reject) => {
        const stmt = db.prepare(
          "INSERT OR IGNORE INTO targets (username, source, is_target, added_to_targets) VALUES (?, ?, ?, ?)"
        );

        db.serialize(() => {
          db.run("BEGIN TRANSACTION");

          let completed = 0;
          let hasError = false;

          for (const username of usernames) {
            if (hasError) break;

            stmt.run([username.trim().toLowerCase(), "import", 1, 1], (err) => {
              if (err && !hasError) {
                hasError = true;
                db.run("ROLLBACK");
                stmt.finalize();
                reject(err);
                return;
              }

              completed++;
              if (completed === usernames.length) {
                db.run("COMMIT", (commitErr) => {
                  stmt.finalize();
                  if (commitErr) {
                    reject(commitErr);
                  } else {
                    this.loadTargets().then(resolve).catch(reject);
                  }
                });
              }
            });
          }
        });
      });
    } catch (error) {
      console.error("Error importing targets:", error);
      throw error;
    }
  }

  // Get targets count
  static async getTargetsCount() {
    try {
      return new Promise((resolve, reject) => {
        db.get(
          "SELECT COUNT(*) as count FROM targets WHERE is_target = 1",
          [],
          (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve(row.count);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error getting targets count:", error);
      throw error;
    }
  }

  // Search targets
  static async searchTargets(query) {
    try {
      return new Promise((resolve, reject) => {
        db.all(
          "SELECT * FROM targets WHERE is_target = 1 AND username LIKE ? ORDER BY created_at DESC",
          [`%${query}%`],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(
                rows.map((row) => ({
                  username: row.username,
                  source: row.source,
                  created_at: row.created_at,
                  updated_at: row.updated_at,
                  id: row.id,
                }))
              );
            }
          }
        );
      });
    } catch (error) {
      console.error("Error searching targets:", error);
      throw error;
    }
  }
}

// Initialize on module load
init().catch((err) => {
  logger.error("Failed to initialize targets:", err);
});

module.exports = TargetsService;
