// Database service for leads management
const db = require("./db");

class LeadsService {
  // Create a new lead
  static createLead(leadData) {
    const stmt = db.prepare(`
      INSERT INTO leads (
        username, full_name, followers_count, following_count, posts_count,
        engagement_rate, location, bio, is_verified, has_profile_pic, has_website,
        tags, source, source_details, scraping_job_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      leadData.username,
      leadData.fullName || null,
      leadData.followers || null,
      leadData.following || null,
      leadData.posts || null,
      leadData.engagementRate || null,
      leadData.location || null,
      leadData.bio || null,
      leadData.isVerified || 0,
      leadData.hasProfilePic || 1,
      leadData.hasWebsite || 0,
      JSON.stringify(leadData.tags || []),
      leadData.source || "manual",
      leadData.sourceDetails || null,
      leadData.scrapingJobId || null,
      leadData.status || "new"
    );

    return info.lastInsertRowid;
  }

  // Get all leads with filtering
  static getLeads(filters = {}) {
    let query = "SELECT * FROM leads WHERE 1=1";
    const params = [];

    if (filters.status) {
      query += " AND status = ?";
      params.push(filters.status);
    }

    if (filters.source) {
      query += " AND source = ?";
      params.push(filters.source);
    }

    if (filters.minFollowers) {
      query += " AND followers_count >= ?";
      params.push(filters.minFollowers);
    }

    if (filters.maxFollowers) {
      query += " AND followers_count <= ?";
      params.push(filters.maxFollowers);
    }

    if (filters.search) {
      query += " AND (username LIKE ? OR full_name LIKE ?)";
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += " ORDER BY created_at DESC";

    if (filters.limit) {
      query += " LIMIT ?";
      params.push(filters.limit);
    }

    const stmt = db.prepare(query);
    const leads = stmt.all(...params);

    return leads.map((lead) => ({
      ...lead,
      tags: JSON.parse(lead.tags || "[]"),
      isVerified: !!lead.is_verified,
      hasProfilePic: !!lead.has_profile_pic,
      hasWebsite: !!lead.has_website,
      addedToTargets: !!lead.added_to_targets,
    }));
  }

  // Update lead status
  static updateLeadStatus(id, status) {
    const stmt = db.prepare(
      "UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    );
    const info = stmt.run(status, id);
    return info.changes > 0;
  }

  // Mark lead as added to targets
  static markAsAddedToTargets(username) {
    const stmt = db.prepare(
      "UPDATE leads SET added_to_targets = 1, updated_at = CURRENT_TIMESTAMP WHERE username = ?"
    );
    const info = stmt.run(username);
    return info.changes > 0;
  }

  // Get leads by scraping job
  static getLeadsByScrapingJob(jobId) {
    const stmt = db.prepare(
      "SELECT * FROM leads WHERE scraping_job_id = ? ORDER BY created_at DESC"
    );
    const leads = stmt.all(jobId);

    return leads.map((lead) => ({
      ...lead,
      tags: JSON.parse(lead.tags || "[]"),
      isVerified: !!lead.is_verified,
      hasProfilePic: !!lead.has_profile_pic,
      hasWebsite: !!lead.has_website,
    }));
  }

  // Delete lead
  static deleteLead(id) {
    const stmt = db.prepare("DELETE FROM leads WHERE id = ?");
    const info = stmt.run(id);
    return info.changes > 0;
  }

  // Get lead statistics
  static getLeadStats() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as new_leads,
        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
        SUM(CASE WHEN status = 'responded' THEN 1 ELSE 0 END) as responded,
        SUM(CASE WHEN status = 'converted' THEN 1 ELSE 0 END) as converted,
        SUM(CASE WHEN added_to_targets = 1 THEN 1 ELSE 0 END) as added_to_targets
      FROM leads
    `);

    return stmt.get();
  }

  // Bulk insert leads (for scraping jobs)
  static bulkInsertLeads(leadsArray) {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO leads (
        username, full_name, followers_count, following_count, posts_count,
        engagement_rate, location, bio, is_verified, has_profile_pic, has_website,
        tags, source, source_details, scraping_job_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((leads) => {
      for (const lead of leads) {
        stmt.run(
          lead.username,
          lead.fullName || null,
          lead.followers || null,
          lead.following || null,
          lead.posts || null,
          lead.engagementRate || null,
          lead.location || null,
          lead.bio || null,
          lead.isVerified || 0,
          lead.hasProfilePic || 1,
          lead.hasWebsite || 0,
          JSON.stringify(lead.tags || []),
          lead.source || "scraping",
          lead.sourceDetails || null,
          lead.scrapingJobId || null
        );
      }
    });

    insertMany(leadsArray);
    return leadsArray.length;
  }

  // Get lead by username
  static getLeadByUsername(username) {
    const stmt = db.prepare(`
      SELECT * FROM leads 
      WHERE username = ?
    `);
    return stmt.get(username);
  }

  // Add/create a lead (alias for createLead with simpler interface)
  static addLead(leadData) {
    try {
      return this.createLead(leadData);
    } catch (error) {
      // If lead already exists, return existing lead
      if (error.message.includes("UNIQUE constraint failed")) {
        return this.getLeadByUsername(leadData.username);
      }
      throw error;
    }
  }

  // Update a lead
  static updateLead(id, updateData) {
    const fields = [];
    const values = [];

    // Build dynamic update query based on provided fields
    if (updateData.fullName !== undefined) {
      fields.push("full_name = ?");
      values.push(updateData.fullName);
    }
    if (updateData.followers !== undefined) {
      fields.push("followers_count = ?");
      values.push(updateData.followers);
    }
    if (updateData.following !== undefined) {
      fields.push("following_count = ?");
      values.push(updateData.following);
    }
    if (updateData.posts !== undefined) {
      fields.push("posts_count = ?");
      values.push(updateData.posts);
    }
    if (updateData.engagementRate !== undefined) {
      fields.push("engagement_rate = ?");
      values.push(updateData.engagementRate);
    }
    if (updateData.location !== undefined) {
      fields.push("location = ?");
      values.push(updateData.location);
    }
    if (updateData.bio !== undefined) {
      fields.push("bio = ?");
      values.push(updateData.bio);
    }
    if (updateData.isVerified !== undefined) {
      fields.push("is_verified = ?");
      values.push(updateData.isVerified ? 1 : 0);
    }
    if (updateData.hasProfilePic !== undefined) {
      fields.push("has_profile_pic = ?");
      values.push(updateData.hasProfilePic ? 1 : 0);
    }
    if (updateData.hasWebsite !== undefined) {
      fields.push("has_website = ?");
      values.push(updateData.hasWebsite ? 1 : 0);
    }
    if (updateData.tags !== undefined) {
      fields.push("tags = ?");
      values.push(JSON.stringify(updateData.tags));
    }
    if (updateData.status !== undefined) {
      fields.push("status = ?");
      values.push(updateData.status);
    }
    if (updateData.isTarget !== undefined) {
      fields.push("is_target = ?");
      values.push(updateData.isTarget ? 1 : 0);
    }

    if (fields.length === 0) {
      return false; // No fields to update
    }

    // Add updated_at timestamp
    fields.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    const stmt = db.prepare(`
      UPDATE leads 
      SET ${fields.join(", ")}
      WHERE id = ?
    `);

    const result = stmt.run(...values);
    return result.changes > 0;
  }

  // Get scraped leads (alias for getLeads with source filter)
  static getScrapedLeads(filters = {}) {
    // Default to scraped leads only unless explicitly requesting all
    if (!filters.source) {
      filters.source = "scraping";
    }
    return this.getLeads(filters);
  }
}

module.exports = LeadsService;
