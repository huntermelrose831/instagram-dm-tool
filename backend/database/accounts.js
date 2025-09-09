const { db, initializeDatabase } = require("./db");
const logger = require("../utils/logger");

const TABLE_NAME = "accounts";

const init = async () => {
  try {
    await initializeDatabase();
    logger.info("Accounts service initialized");
  } catch (error) {
    logger.error("Error initializing accounts service:", error);
  }
};

const AccountsService = {
  // Add a new account
  async addAccount(accountData) {
    try {
      const account = {
        ...accountData,
        status: accountData.status || "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = db.run(
        `INSERT INTO ${TABLE_NAME} (username, password, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          account.username,
          account.password,
          account.status,
          account.created_at,
          account.updated_at,
        ]
      );

      return { id: result.lastInsertRowid, ...account };
    } catch (error) {
      if (error.message.includes("UNIQUE constraint failed")) {
        // Duplicate key error
        throw new Error("Account with this username already exists");
      }
      console.error("Error adding account:", error);
      throw error;
    }
  },

  // Get all accounts
  async getAccounts() {
    try {
      return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ${TABLE_NAME}`, [], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });
    } catch (error) {
      console.error("Error getting accounts:", error);
      throw error;
    }
  },

  // Get account by ID
  async getAccountById(id) {
    try {
      return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM ${TABLE_NAME} WHERE id = ?`, [id], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        });
      });
    } catch (error) {
      console.error("Error getting account by ID:", error);
      throw error;
    }
  },

  // Get account by username
  async getAccountByUsername(username) {
    try {
      return new Promise((resolve, reject) => {
        db.get(
          `SELECT * FROM ${TABLE_NAME} WHERE username = ?`,
          [username],
          (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error getting account by username:", error);
      throw error;
    }
  },

  // Get account by email
  async getAccountByEmail(email) {
    try {
      return new Promise((resolve, reject) => {
        db.get(
          `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
          [email],
          (err, row) => {
            if (err) {
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error getting account by email:", error);
      throw error;
    }
  },

  // Get account by username or email
  async getAccountByUsernameOrEmail(identifier) {
    try {
      return new Promise((resolve, reject) => {
        // First try username
        db.get(
          `SELECT * FROM ${TABLE_NAME} WHERE username = ?`,
          [identifier],
          (err, row) => {
            if (err) {
              reject(err);
              return;
            }
            if (row) {
              resolve(row);
              return;
            }
            // If not found by username, try email
            db.get(
              `SELECT * FROM ${TABLE_NAME} WHERE email = ?`,
              [identifier],
              (err2, row2) => {
                if (err2) {
                  reject(err2);
                  return;
                }
                resolve(row2);
              }
            );
          }
        );
      });
    } catch (error) {
      console.error("Error getting account by username or email:", error);
      throw error;
    }
  },

  // Update account
  async updateAccount(username, updateData) {
    try {
      const result = db.run(
        `UPDATE ${TABLE_NAME} SET password = ?, status = ?, updated_at = ? WHERE username = ?`,
        [
          updateData.password,
          updateData.status,
          new Date().toISOString(),
          username,
        ]
      );
      return result.changes > 0;
    } catch (error) {
      console.error("Error updating account:", error);
      throw error;
    }
  },

  // Update account cookies
  async updateAccountCookies(username, cookies) {
    try {
      const result = db.run(
        `UPDATE ${TABLE_NAME} SET cookies = ?, updated_at = ? WHERE username = ?`,
        [cookies, new Date().toISOString(), username]
      );
      return result.changes > 0;
    } catch (error) {
      console.error("Error updating account cookies:", error);
      throw error;
    }
  },

  // Update account status
  async updateAccountStatus(username, status) {
    try {
      const result = db.run(
        `UPDATE ${TABLE_NAME} SET status = ?, updated_at = ? WHERE username = ?`,
        [status, new Date().toISOString(), username]
      );
      return result.changes > 0;
    } catch (error) {
      console.error("Error updating account status:", error);
      throw error;
    }
  },

  // Update last login
  async updateLastLogin(username) {
    try {
      const result = db.run(
        `UPDATE ${TABLE_NAME} SET last_login = ?, updated_at = ? WHERE username = ?`,
        [new Date().toISOString(), new Date().toISOString(), username]
      );
      return result.changes > 0;
    } catch (error) {
      console.error("Error updating last login:", error);
      throw error;
    }
  },

  // Delete account
  async deleteAccount(username) {
    try {
      const result = db.run(`DELETE FROM ${TABLE_NAME} WHERE username = ?`, [
        username,
      ]);
      return result.changes > 0;
    } catch (error) {
      console.error("Error deleting account:", error);
      throw error;
    }
  },

  // Delete account by ID
  async deleteAccountById(id) {
    try {
      const result = db.run(`DELETE FROM ${TABLE_NAME} WHERE id = ?`, [id]);
      return result.changes > 0;
    } catch (error) {
      console.error("Error deleting account by ID:", error);
      throw error;
    }
  },

  // Get accounts by status
  async getAccountsByStatus(status) {
    try {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM ${TABLE_NAME} WHERE status = ? ORDER BY created_at DESC`,
          [status],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error getting accounts by status:", error);
      throw error;
    }
  },

  // Get active accounts
  async getActiveAccounts() {
    try {
      return new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM ${TABLE_NAME} WHERE status = 'active' ORDER BY created_at DESC`,
          [],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });
    } catch (error) {
      console.error("Error getting active accounts:", error);
      throw error;
    }
  },

  // Upsert account (insert or update)
  async upsertAccount(accountData) {
    try {
      // Check if account exists
      const existingAccount = await this.getAccountByUsername(
        accountData.username
      );

      if (existingAccount) {
        // Update existing account
        const updateFields = [];
        const updateValues = [];

        if (accountData.email !== undefined) {
          updateFields.push("email = ?");
          updateValues.push(accountData.email);
        }
        if (accountData.password !== undefined) {
          updateFields.push("password = ?");
          updateValues.push(accountData.password);
        }
        if (accountData.cookies !== undefined) {
          updateFields.push("cookies = ?");
          updateValues.push(accountData.cookies);
        }
        if (accountData.status !== undefined) {
          updateFields.push("status = ?");
          updateValues.push(accountData.status);
        }
        if (accountData.lastLogin !== undefined) {
          updateFields.push("last_login = ?");
          updateValues.push(accountData.lastLogin);
        }

        updateFields.push("updated_at = ?");
        updateValues.push(new Date().toISOString());
        updateValues.push(accountData.username);

        const result = db.run(
          `UPDATE ${TABLE_NAME} SET ${updateFields.join(", ")} WHERE username = ?`,
          updateValues
        );

        return { id: existingAccount.id, ...accountData };
      } else {
        // Insert new account
        const account = {
          ...accountData,
          status: accountData.status || "active",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const result = db.run(
          `INSERT INTO ${TABLE_NAME} (username, email, password, cookies, status, last_login, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            account.username,
            account.email,
            account.password,
            account.cookies,
            account.status,
            account.lastLogin,
            account.created_at,
            account.updated_at,
          ]
        );

        return { id: result.lastInsertRowid, ...account };
      }
    } catch (error) {
      console.error("Error upserting account:", error);
      throw error;
    }
  },
};

// Initialize the collection when the module is loaded
init().catch((err) => {
  logger.error("Failed to initialize accounts:", err);
});

module.exports = AccountsService;
