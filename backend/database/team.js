const { db, initializeDatabase } = require("./db");

// Initialize team tables
const initTeam = async () => {
  await initializeDatabase();

  const tables = [
    `CREATE TABLE IF NOT EXISTS team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'Member',
      avatar TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS team_roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS team_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS team_workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS team_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user TEXT NOT NULL,
      action TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now'))
    )`,
  ];

  for (const sql of tables) {
    await new Promise((resolve, reject) => {
      db.run(sql, (err) => (err ? reject(err) : resolve()));
    });
  }

  // Seed default roles if empty
  const roleCount = await new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM team_roles", [], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.count : 0);
    });
  });
  if (roleCount === 0) {
    const roles = [
      ["admin", "Admin", "Full access to all features."],
      ["manager", "Manager", "Can manage campaigns and view reports."],
      ["member", "Member", "Can view campaigns and basic data."],
    ];
    for (const r of roles) {
      await new Promise((resolve, reject) => {
        db.run(
          "INSERT OR IGNORE INTO team_roles (id, name, description) VALUES (?, ?, ?)",
          r,
          (err) => (err ? reject(err) : resolve()),
        );
      });
    }
  }

  // Seed default workspace if empty
  const wsCount = await new Promise((resolve, reject) => {
    db.get("SELECT COUNT(*) as count FROM team_workspaces", [], (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.count : 0);
    });
  });
  if (wsCount === 0) {
    await new Promise((resolve, reject) => {
      db.run(
        "INSERT INTO team_workspaces (name) VALUES (?)",
        ["Default Workspace"],
        (err) => (err ? reject(err) : resolve()),
      );
    });
  }
};

initTeam().catch((err) =>
  console.error("Failed to initialize team tables:", err),
);

const TeamService = {
  async getMembers() {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM team_members ORDER BY created_at DESC",
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        },
      );
    });
  },

  async addMember(memberData) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      db.run(
        "INSERT INTO team_members (name, email, role, avatar, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        [
          memberData.name || memberData.email.split("@")[0],
          memberData.email,
          memberData.role || "Member",
          memberData.avatar || null,
          now,
          now,
        ],
        function (err) {
          if (err) return reject(err);
          resolve({
            id: this.lastID,
            name: memberData.name || memberData.email.split("@")[0],
            email: memberData.email,
            role: memberData.role || "Member",
            avatar: memberData.avatar,
            created_at: now,
          });
        },
      );
    });
  },

  async removeMember(id) {
    return new Promise((resolve, reject) => {
      db.run("DELETE FROM team_members WHERE id = ?", [id], (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  },

  async updateMemberRole(id, role) {
    return new Promise((resolve, reject) => {
      db.run(
        "UPDATE team_members SET role = ?, updated_at = ? WHERE id = ?",
        [role, new Date().toISOString(), id],
        (err) => {
          if (err) return reject(err);
          resolve(true);
        },
      );
    });
  },

  async getRoles() {
    return new Promise((resolve, reject) => {
      db.all("SELECT * FROM team_roles", [], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  },

  async getTemplates() {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM team_templates ORDER BY created_at DESC",
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        },
      );
    });
  },

  async addTemplate(templateData) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      db.run(
        "INSERT INTO team_templates (name, content, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        [
          templateData.name,
          templateData.content,
          templateData.created_by || null,
          now,
          now,
        ],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, ...templateData, created_at: now });
        },
      );
    });
  },

  async deleteTemplate(id) {
    return new Promise((resolve, reject) => {
      db.run("DELETE FROM team_templates WHERE id = ?", [id], (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  },

  async getWorkspaces() {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM team_workspaces ORDER BY created_at DESC",
        [],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        },
      );
    });
  },

  async getActivity(limit = 50) {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM team_activity ORDER BY timestamp DESC LIMIT ?",
        [limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        },
      );
    });
  },

  async logActivity(user, action) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      db.run(
        "INSERT INTO team_activity (user, action, timestamp) VALUES (?, ?, ?)",
        [user, action, now],
        function (err) {
          if (err) return reject(err);
          resolve({ id: this.lastID, user, action, timestamp: now });
        },
      );
    });
  },
};

module.exports = TeamService;
