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
  try {
    const existingContact = db.get(
      `SELECT * FROM ${CONTACTS_TABLE} WHERE username = ?`,
      [username]
    );
    if (existingContact) {
      // Update existing contact
      db.run(`UPDATE ${CONTACTS_TABLE} SET updated_at = ? WHERE username = ?`, [
        new Date().toISOString(),
        username,
      ]);
      return { id: existingContact.id, ...existingContact };
    }

    const contactData = {
      username,
      status: "lead",
      tags: JSON.stringify([]),
      notes: JSON.stringify([]),
      messages_sent: 0,
      responses_received: 0,
      last_interaction: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = db.run(
      `
      INSERT INTO ${CONTACTS_TABLE} (username, status, tags, notes, messages_sent, responses_received, last_interaction, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        contactData.username,
        contactData.status,
        contactData.tags,
        contactData.notes,
        contactData.messages_sent,
        contactData.responses_received,
        contactData.last_interaction,
        contactData.created_at,
        contactData.updated_at,
      ]
    );

    return { id: result.lastInsertRowid, ...contactData };
  } catch (error) {
    console.error("Error creating contact:", error);
    throw error;
  }
}

async function getContacts(filters = {}) {
  try {
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

    const contacts = db.all(query, params);

    // Get notes for each contact
    const contactsWithNotes = contacts.map((contact) => {
      const notes = db.all(
        `SELECT * FROM ${NOTES_TABLE} WHERE contact_id = ? ORDER BY created_at DESC`,
        [contact.id]
      );
      return {
        ...contact,
        id: contact.id,
        tags: JSON.parse(contact.tags || "[]"),
        notes: notes || [],
      };
    });

    return contactsWithNotes;
  } catch (error) {
    console.error("Error getting contacts:", error);
    throw error;
  }
}

async function updateContactStatus(contactId, status) {
  const validStatuses = ["lead", "prospect", "customer", "inactive"];
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}`
    );
  }

  try {
    db.run(
      `
      UPDATE ${CONTACTS_TABLE}
      SET status = ?, updated_at = ?
      WHERE id = ?
    `,
      [status, new Date().toISOString(), contactId]
    );

    // Return updated contact
    const contacts = await getContacts({ id: contactId });
    return contacts[0];
  } catch (error) {
    console.error("Error updating contact status:", error);
    throw error;
  }
}

// Note operations
async function addNote(contactId, content) {
  try {
    const noteData = {
      contact_id: contactId,
      content,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = db.run(
      `
      INSERT INTO ${NOTES_TABLE} (contact_id, content, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `,
      [
        noteData.contact_id,
        noteData.content,
        noteData.created_at,
        noteData.updated_at,
      ]
    );

    return { id: result.lastInsertRowid, ...noteData };
  } catch (error) {
    console.error("Error adding note:", error);
    throw error;
  }
}

// Tag operations
async function createTag(name) {
  try {
    const existingTag = db.get(`SELECT * FROM ${TAGS_TABLE} WHERE name = ?`, [
      name,
    ]);
    if (existingTag) {
      return existingTag;
    }

    const tagData = {
      name,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const result = db.run(
      `
      INSERT INTO ${TAGS_TABLE} (name, created_at, updated_at)
      VALUES (?, ?, ?)
    `,
      [tagData.name, tagData.created_at, tagData.updated_at]
    );

    return { id: result.lastInsertRowid, ...tagData };
  } catch (error) {
    console.error("Error creating tag:", error);
    throw error;
  }
}

async function addTagToContact(contactId, tagName) {
  try {
    await createTag(tagName); // Ensure tag exists

    const contact = db.get(`SELECT tags FROM ${CONTACTS_TABLE} WHERE id = ?`, [
      contactId,
    ]);
    if (!contact) return;

    const tags = JSON.parse(contact.tags || "[]");
    if (!tags.includes(tagName)) {
      tags.push(tagName);
      db.run(
        `
        UPDATE ${CONTACTS_TABLE}
        SET tags = ?, updated_at = ?
        WHERE id = ?
      `,
        [JSON.stringify(tags), new Date().toISOString(), contactId]
      );
    }
  } catch (error) {
    console.error("Error adding tag to contact:", error);
    throw error;
  }
}

async function removeTagFromContact(contactId, tagName) {
  try {
    const contact = db.get(`SELECT tags FROM ${CONTACTS_TABLE} WHERE id = ?`, [
      contactId,
    ]);
    if (!contact) return;

    const tags = JSON.parse(contact.tags || "[]");
    const filteredTags = tags.filter((tag) => tag !== tagName);

    db.run(
      `
      UPDATE ${CONTACTS_TABLE}
      SET tags = ?, updated_at = ?
      WHERE id = ?
    `,
      [JSON.stringify(filteredTags), new Date().toISOString(), contactId]
    );
  } catch (error) {
    console.error("Error removing tag from contact:", error);
    throw error;
  }
}

// Interaction tracking
async function recordInteraction(contactId, type, content, campaignId = null) {
  try {
    const interactionData = {
      contact_id: contactId,
      type,
      content,
      campaign_id: campaignId,
      created_at: new Date().toISOString(),
    };

    db.run(
      `
      INSERT INTO ${INTERACTIONS_TABLE} (contact_id, type, content, campaign_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `,
      [
        interactionData.contact_id,
        interactionData.type,
        interactionData.content,
        interactionData.campaign_id,
        interactionData.created_at,
      ]
    );

    // Update contact interaction counters
    const updateFields = ["last_interaction = ?", "updated_at = ?"];
    const values = [new Date().toISOString(), new Date().toISOString()];

    if (type === "dm_sent") {
      updateFields.push("messages_sent = messages_sent + 1");
    } else if (type === "dm_received") {
      updateFields.push("responses_received = responses_received + 1");
    }

    values.push(contactId);

    db.run(
      `
      UPDATE ${CONTACTS_TABLE}
      SET ${updateFields.join(", ")}
      WHERE id = ?
    `,
      values
    );
  } catch (error) {
    console.error("Error recording interaction:", error);
    throw error;
  }
}

async function deleteContact(contactId) {
  try {
    // Get contact before deletion
    const existing = db.get(`SELECT * FROM ${CONTACTS_TABLE} WHERE id = ?`, [
      contactId,
    ]);
    if (!existing) {
      return { deleted: false };
    }

    // Delete related data (foreign keys will handle cascade)
    db.run(`DELETE FROM ${NOTES_TABLE} WHERE contact_id = ?`, [contactId]);
    db.run(`DELETE FROM ${INTERACTIONS_TABLE} WHERE contact_id = ?`, [
      contactId,
    ]);

    // Delete contact
    db.run(`DELETE FROM ${CONTACTS_TABLE} WHERE id = ?`, [contactId]);

    return {
      deleted: true,
      contact: { ...existing, id: existing.id },
    };
  } catch (error) {
    console.error("Error deleting contact:", error);
    throw error;
  }
}

async function deleteContactByUsername(username) {
  try {
    const contact = db.get(
      `SELECT * FROM ${CONTACTS_TABLE} WHERE username = ?`,
      [username]
    );
    if (!contact) {
      return { deleted: false };
    }

    // Delete related data
    db.run(`DELETE FROM ${NOTES_TABLE} WHERE contact_id = ?`, [contact.id]);
    db.run(`DELETE FROM ${INTERACTIONS_TABLE} WHERE contact_id = ?`, [
      contact.id,
    ]);

    // Delete contact
    db.run(`DELETE FROM ${CONTACTS_TABLE} WHERE username = ?`, [username]);

    return {
      deleted: true,
      contact: { ...contact, id: contact.id },
    };
  } catch (error) {
    console.error("Error deleting contact by username:", error);
    throw error;
  }
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
