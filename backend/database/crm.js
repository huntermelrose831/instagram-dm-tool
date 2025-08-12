const db = require("./db");

// Contact operations
function createContact(username) {
  const stmt = db.prepare(`
    INSERT INTO crm_contacts (username)
    VALUES (?)
    ON CONFLICT(username) DO UPDATE SET
    updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `);
  return stmt.get(username);
}

function getContacts(filters = {}) {
  let query = `
    SELECT 
      c.*,
      GROUP_CONCAT(DISTINCT t.name) as tags
    FROM crm_contacts c
    LEFT JOIN crm_contact_tags ct ON c.id = ct.contact_id
    LEFT JOIN crm_tags t ON ct.tag_id = t.id
  `;
  const whereConditions = [];
  const params = [];

  if (filters.id) {
    whereConditions.push("c.id = ?");
    params.push(filters.id);
  }

  if (filters.status) {
    whereConditions.push("c.status = ?");
    params.push(filters.status);
  }

  if (filters.tag) {
    whereConditions.push("t.name LIKE ?");
    params.push(`%${filters.tag}%`);
  }

  if (whereConditions.length > 0) {
    query += " WHERE " + whereConditions.join(" AND ");
  }

  query += " GROUP BY c.id ORDER BY c.last_interaction DESC NULLS LAST";
  const contacts = db.prepare(query).all(params);
  
  // Get notes separately to avoid JSON concatenation issues
  const getNotesStmt = db.prepare(`
    SELECT id, content, created_at 
    FROM crm_notes 
    WHERE contact_id = ? 
    ORDER BY created_at DESC
  `);
  
  return contacts.map((contact) => ({
    ...contact,
    tags: contact.tags ? contact.tags.split(",") : [],
    notes: getNotesStmt.all(contact.id) || [],
  }));
}

function updateContactStatus(contactId, status) {
  // Validate the status against allowed values
  const validStatuses = ["lead", "prospect", "customer", "inactive"];
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Invalid status: ${status}. Must be one of: ${validStatuses.join(", ")}`
    );
  }

  try {
    // Get the contact with all relationships before update
    const contact = getContacts({ id: parseInt(contactId, 10) })[0];
    if (!contact) {
      throw new Error("Contact not found");
    }

    // Update the status
    const stmt = db.prepare(`
      UPDATE crm_contacts
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    stmt.run(status, contactId);

    // Return the updated contact with all relationships
    return getContacts({ id: parseInt(contactId, 10) })[0];
  } catch (error) {
    console.error("Error updating contact status:", error);
    throw error;
  }
}

// Note operations
function addNote(contactId, content) {
  const stmt = db.prepare(`
    INSERT INTO crm_notes (contact_id, content)
    VALUES (?, ?)
    RETURNING *
  `);
  return stmt.get(contactId, content);
}

// Tag operations
function createTag(name) {
  const stmt = db.prepare(`
    INSERT INTO crm_tags (name)
    VALUES (?)
    ON CONFLICT(name) DO UPDATE SET
    name = excluded.name
    RETURNING *
  `);
  return stmt.get(name);
}

function addTagToContact(contactId, tagName) {
  const tag = createTag(tagName);
  const stmt = db.prepare(`
    INSERT INTO crm_contact_tags (contact_id, tag_id)
    VALUES (?, ?)
    ON CONFLICT(contact_id, tag_id) DO NOTHING
  `);
  stmt.run(contactId, tag.id);
}

function removeTagFromContact(contactId, tagName) {
  const stmt = db.prepare(`
    DELETE FROM crm_contact_tags
    WHERE contact_id = ? AND tag_id IN (
      SELECT id FROM crm_tags WHERE name = ?
    )
  `);
  stmt.run(contactId, tagName);
}

// Interaction tracking
function recordInteraction(contactId, type, content, campaignId = null) {
  const stmt = db.prepare(`
    INSERT INTO crm_interactions (contact_id, type, content, campaign_id)
    VALUES (?, ?, ?, ?)
  `);

  const updateContact = db.prepare(`
    UPDATE crm_contacts
    SET last_interaction = CURRENT_TIMESTAMP,
        messages_sent = CASE WHEN ? = 'dm_sent' THEN messages_sent + 1 ELSE messages_sent END,
        responses_received = CASE WHEN ? = 'dm_received' THEN responses_received + 1 ELSE responses_received END
    WHERE id = ?
  `);

  db.transaction(() => {
    stmt.run(contactId, type, content, campaignId);
    updateContact.run(type, type, contactId);
  })();
}

module.exports = {
  createContact,
  getContacts,
  updateContactStatus,
  addNote,
  createTag,
  addTagToContact,
  removeTagFromContact,
  recordInteraction,
};
