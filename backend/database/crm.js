const { db, initializeDatabase } = require("./db");
const logger = require("../utils/logger");

const CONTACTS_TABLE = "crm_contacts";
const NOTES_TABLE = "crm_notes";
const TAGS_TABLE = "crm_tags";
const INTERACTIONS_TABLE = "crm_interactions";

// Initialize tables
const init = async () => {
  try {
    await initializeDatabase();

    // Create CRM tables after main database is initialized
    const tables = [
      `CREATE TABLE IF NOT EXISTS ${CONTACTS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'lead',
        tags TEXT,
        notes TEXT,
        messages_sent INTEGER DEFAULT 0,
        responses_received INTEGER DEFAULT 0,
        last_interaction DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS ${NOTES_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES ${CONTACTS_TABLE}(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS ${TAGS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS ${INTERACTIONS_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        content TEXT,
        campaign_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES ${CONTACTS_TABLE}(id) ON DELETE CASCADE
      )`,
    ];

    // Create tables synchronously
    for (const tableSql of tables) {
      await new Promise((resolve, reject) => {
        db.run(tableSql, (err) => {
          if (err) {
            logger.error("CRM table creation failed:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    // Create indexes
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_crm_contacts_username ON ${CONTACTS_TABLE}(username)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON ${CONTACTS_TABLE}(status)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_notes_contact_id ON ${NOTES_TABLE}(contact_id)`,
      `CREATE INDEX IF NOT EXISTS idx_crm_interactions_contact_id ON ${INTERACTIONS_TABLE}(contact_id)`,
    ];

    for (const indexSql of indexes) {
      await new Promise((resolve, reject) => {
        db.run(indexSql, (err) => {
          if (err) {
            logger.error("CRM index creation failed:", err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }

    logger.info("CRM tables initialized");
  } catch (error) {
    logger.error("Error initializing CRM tables:", error);
  }
};

// Contact operations
async function createContact(username) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM ${CONTACTS_TABLE} WHERE username = ?`,
      [username],
      (err, existingContact) => {
        if (err) return reject(err);

        if (existingContact) {
          // Update existing contact
          db.run(
            `UPDATE ${CONTACTS_TABLE} SET updated_at = ? WHERE username = ?`,
            [new Date().toISOString(), username],
            (updateErr) => {
              if (updateErr) return reject(updateErr);
              resolve({ id: existingContact.id, ...existingContact });
            },
          );
          return;
        }

        const now = new Date().toISOString();
        db.run(
          `INSERT INTO ${CONTACTS_TABLE} (username, status, tags, notes, messages_sent, responses_received, last_interaction, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            username,
            "lead",
            JSON.stringify([]),
            JSON.stringify([]),
            0,
            0,
            null,
            now,
            now,
          ],
          function (insertErr) {
            if (insertErr) return reject(insertErr);
            resolve({
              id: this.lastID,
              username,
              status: "lead",
              tags: JSON.stringify([]),
              notes: JSON.stringify([]),
              messages_sent: 0,
              responses_received: 0,
              last_interaction: null,
              created_at: now,
              updated_at: now,
            });
          },
        );
      },
    );
  });
}

async function getContacts(filters = {}) {
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM ${CONTACTS_TABLE}`;
    const conditions = [];
    const params = [];

    if (filters.id) {
      conditions.push("id = ?");
      params.push(filters.id);
    }

    if (filters.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }

    if (filters.tag) {
      conditions.push("tags LIKE ?");
      params.push(`%${filters.tag}%`);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY last_interaction DESC, created_at DESC";

    db.all(query, params, (err, contacts) => {
      if (err) return reject(err);
      if (!contacts) return resolve([]);

      // Get notes for each contact
      let completed = 0;
      if (contacts.length === 0) return resolve([]);

      const results = [];
      contacts.forEach((contact, idx) => {
        db.all(
          `SELECT * FROM ${NOTES_TABLE} WHERE contact_id = ? ORDER BY created_at DESC`,
          [contact.id],
          (noteErr, notes) => {
            results[idx] = {
              ...contact,
              id: contact.id,
              tags: JSON.parse(contact.tags || "[]"),
              notes: noteErr ? [] : notes || [],
            };
            completed++;
            if (completed === contacts.length) {
              resolve(results);
            }
          },
        );
      });
    });
  });
}

async function updateContactStatus(contactId, status) {
  const validStatuses = ["lead", "prospect", "customer", "inactive"];
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}`,
    );
  }

  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE ${CONTACTS_TABLE} SET status = ?, updated_at = ? WHERE id = ?`,
      [status, new Date().toISOString(), contactId],
      (err) => {
        if (err) return reject(err);
        getContacts({ id: contactId })
          .then((contacts) => resolve(contacts[0]))
          .catch(reject);
      },
    );
  });
}

// Note operations
async function addNote(contactId, content) {
  const now = new Date().toISOString();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO ${NOTES_TABLE} (contact_id, content, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      [contactId, content, now, now],
      function (err) {
        if (err) return reject(err);
        resolve({
          id: this.lastID,
          contact_id: contactId,
          content,
          created_at: now,
          updated_at: now,
        });
      },
    );
  });
}

// Tag operations
async function createTag(name) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM ${TAGS_TABLE} WHERE name = ?`,
      [name],
      (err, existing) => {
        if (err) return reject(err);
        if (existing) return resolve(existing);

        const now = new Date().toISOString();
        db.run(
          `INSERT INTO ${TAGS_TABLE} (name, created_at, updated_at) VALUES (?, ?, ?)`,
          [name, now, now],
          function (insertErr) {
            if (insertErr) return reject(insertErr);
            resolve({
              id: this.lastID,
              name,
              created_at: now,
              updated_at: now,
            });
          },
        );
      },
    );
  });
}

async function addTagToContact(contactId, tagName) {
  await createTag(tagName);
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT tags FROM ${CONTACTS_TABLE} WHERE id = ?`,
      [contactId],
      (err, contact) => {
        if (err) return reject(err);
        if (!contact) return resolve();

        const tags = JSON.parse(contact.tags || "[]");
        if (!tags.includes(tagName)) {
          tags.push(tagName);
          db.run(
            `UPDATE ${CONTACTS_TABLE} SET tags = ?, updated_at = ? WHERE id = ?`,
            [JSON.stringify(tags), new Date().toISOString(), contactId],
            (updateErr) => {
              if (updateErr) return reject(updateErr);
              resolve();
            },
          );
        } else {
          resolve();
        }
      },
    );
  });
}

async function removeTagFromContact(contactId, tagName) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT tags FROM ${CONTACTS_TABLE} WHERE id = ?`,
      [contactId],
      (err, contact) => {
        if (err) return reject(err);
        if (!contact) return resolve();

        const tags = JSON.parse(contact.tags || "[]");
        const filteredTags = tags.filter((tag) => tag !== tagName);

        db.run(
          `UPDATE ${CONTACTS_TABLE} SET tags = ?, updated_at = ? WHERE id = ?`,
          [JSON.stringify(filteredTags), new Date().toISOString(), contactId],
          (updateErr) => {
            if (updateErr) return reject(updateErr);
            resolve();
          },
        );
      },
    );
  });
}

// Interaction tracking
async function recordInteraction(contactId, type, content, campaignId = null) {
  const now = new Date().toISOString();
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO ${INTERACTIONS_TABLE} (contact_id, type, content, campaign_id, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [contactId, type, content, campaignId, now],
      (insertErr) => {
        if (insertErr) return reject(insertErr);

        const updateFields = ["last_interaction = ?", "updated_at = ?"];
        const values = [now, now];

        if (type === "dm_sent") {
          updateFields.push("messages_sent = messages_sent + 1");
        } else if (type === "dm_received") {
          updateFields.push("responses_received = responses_received + 1");
        }

        values.push(contactId);

        db.run(
          `UPDATE ${CONTACTS_TABLE} SET ${updateFields.join(", ")} WHERE id = ?`,
          values,
          (updateErr) => {
            if (updateErr) return reject(updateErr);
            resolve();
          },
        );
      },
    );
  });
}

async function deleteContact(contactId) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM ${CONTACTS_TABLE} WHERE id = ?`,
      [contactId],
      (err, existing) => {
        if (err) return reject(err);
        if (!existing) return resolve({ deleted: false });

        db.run(
          `DELETE FROM ${NOTES_TABLE} WHERE contact_id = ?`,
          [contactId],
          () => {
            db.run(
              `DELETE FROM ${INTERACTIONS_TABLE} WHERE contact_id = ?`,
              [contactId],
              () => {
                db.run(
                  `DELETE FROM ${CONTACTS_TABLE} WHERE id = ?`,
                  [contactId],
                  (delErr) => {
                    if (delErr) return reject(delErr);
                    resolve({
                      deleted: true,
                      contact: { ...existing, id: existing.id },
                    });
                  },
                );
              },
            );
          },
        );
      },
    );
  });
}

async function deleteContactByUsername(username) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM ${CONTACTS_TABLE} WHERE username = ?`,
      [username],
      (err, contact) => {
        if (err) return reject(err);
        if (!contact) return resolve({ deleted: false });

        db.run(
          `DELETE FROM ${NOTES_TABLE} WHERE contact_id = ?`,
          [contact.id],
          () => {
            db.run(
              `DELETE FROM ${INTERACTIONS_TABLE} WHERE contact_id = ?`,
              [contact.id],
              () => {
                db.run(
                  `DELETE FROM ${CONTACTS_TABLE} WHERE username = ?`,
                  [username],
                  (delErr) => {
                    if (delErr) return reject(delErr);
                    resolve({
                      deleted: true,
                      contact: { ...contact, id: contact.id },
                    });
                  },
                );
              },
            );
          },
        );
      },
    );
  });
}

// Initialize on module load
init().catch((err) => {
  logger.error("Failed to initialize CRM:", err);
});

module.exports = {
  createContact,
  getContacts,
  updateContactStatus,
  addNote,
  createTag,
  addTagToContact,
  removeTagFromContact,
  recordInteraction,
  deleteContact,
  deleteContactByUsername,
};
