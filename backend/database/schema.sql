-- Messaging and Campaign Tables

-- Table for tracking DM activities
CREATE TABLE IF NOT EXISTS dm_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_username TEXT NOT NULL,
    to_username TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT 0,
    sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Table for scheduled DM jobs
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_username TEXT NOT NULL,
    target_usernames TEXT NOT NULL,
    message_variations TEXT NOT NULL,
    schedule_time DATETIME NOT NULL,
    campaign_id INTEGER,
    status TEXT DEFAULT 'pending',
    is_recurring BOOLEAN DEFAULT 0,
    recurring_interval TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_run DATETIME,
    error_log TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- ...existing code...
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    account_username TEXT NOT NULL,
    message_variations TEXT NOT NULL,
    target_usernames TEXT NOT NULL DEFAULT '[]',
    schedule_time DATETIME,
    is_scheduled BOOLEAN DEFAULT 0,
    status TEXT CHECK(status IN ('active', 'paused', 'pending')) DEFAULT 'pending',
    success_count INTEGER DEFAULT 0,
    response_count INTEGER DEFAULT 0,
    target_count INTEGER DEFAULT 0,
    variation_stats TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
-- ...existing code...

-- Table for DM rate limits
CREATE TABLE IF NOT EXISTS dm_rate_limits (
    username TEXT PRIMARY KEY,
    daily_dm_count INTEGER DEFAULT 0,
    last_dm_time DATETIME,
    last_reset_date DATE,
    total_dm_sent INTEGER DEFAULT 0
);

-- CRM Tables

-- Contacts table to store lead/customer information
CREATE TABLE IF NOT EXISTS crm_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    first_contact DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_interaction DATETIME,
    status TEXT CHECK(status IN ('lead', 'prospect', 'customer', 'inactive')) DEFAULT 'lead',
    messages_sent INTEGER DEFAULT 0,
    responses_received INTEGER DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Notes table for contact notes/comments
CREATE TABLE IF NOT EXISTS crm_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
);

-- Interactions table to track all contact touchpoints
CREATE TABLE IF NOT EXISTS crm_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('dm_sent', 'dm_received', 'status_change', 'note_added')),
    content TEXT,
    campaign_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

-- Tags table for categorizing contacts
CREATE TABLE IF NOT EXISTS crm_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Contact-Tag relationship table
CREATE TABLE IF NOT EXISTS crm_contact_tags (
    contact_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (contact_id, tag_id),
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES crm_tags(id) ON DELETE CASCADE
);

-- Triggers to update timestamps
CREATE TRIGGER IF NOT EXISTS update_crm_contacts_timestamp 
AFTER UPDATE ON crm_contacts
BEGIN
    UPDATE crm_contacts SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_crm_notes_timestamp
AFTER UPDATE ON crm_notes
BEGIN
    UPDATE crm_notes SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;
