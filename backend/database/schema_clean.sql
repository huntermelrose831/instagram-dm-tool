-- Clean database schema for Instagram DM Automation Tool

-- Campaigns table
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

-- CRM Contacts table
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

-- CRM Contact Tags table
CREATE TABLE IF NOT EXISTS crm_contact_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    tag TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
    UNIQUE(contact_id, tag)
);

-- CRM Notes table
CREATE TABLE IF NOT EXISTS crm_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
);

-- CRM Interactions table
CREATE TABLE IF NOT EXISTS crm_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('dm_sent', 'response_received', 'call', 'email', 'meeting')),
    content TEXT,
    campaign_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

-- DM Rate Limits table
CREATE TABLE IF NOT EXISTS dm_rate_limits (
    username TEXT PRIMARY KEY,
    daily_dm_count INTEGER DEFAULT 0,
    last_dm_time DATETIME,
    last_reset_date DATE,
    total_dm_sent INTEGER DEFAULT 0
);

-- Scheduled DMs table
CREATE TABLE IF NOT EXISTS scheduled_dms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_username TEXT NOT NULL,
    target_usernames TEXT NOT NULL,
    message TEXT NOT NULL,
    scheduled_time DATETIME NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    executed_at DATETIME,
    error_message TEXT,
    campaign_id INTEGER,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

-- Message Analytics table
CREATE TABLE IF NOT EXISTS message_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    username TEXT NOT NULL,
    message_sent_at DATETIME NOT NULL,
    response_received_at DATETIME,
    response_time_minutes INTEGER,
    message_variation_id INTEGER,
    success BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

-- Account Limits table
CREATE TABLE IF NOT EXISTS account_limits (
    username TEXT PRIMARY KEY,
    daily_dm_limit INTEGER DEFAULT 50,
    hourly_dm_limit INTEGER DEFAULT 10,
    current_daily_count INTEGER DEFAULT 0,
    current_hourly_count INTEGER DEFAULT 0,
    last_reset_date DATE,
    last_reset_hour INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Follow Up Schedules table
CREATE TABLE IF NOT EXISTS follow_up_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    campaign_id INTEGER,
    scheduled_time DATETIME NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

-- Activity Logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    action_type TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Triggers to update timestamps
CREATE TRIGGER IF NOT EXISTS update_crm_contacts_timestamp 
AFTER UPDATE ON crm_contacts
FOR EACH ROW
BEGIN
    UPDATE crm_contacts SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_crm_notes_timestamp
AFTER UPDATE ON crm_notes
FOR EACH ROW
BEGIN
    UPDATE crm_notes SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_message_analytics_timestamp
AFTER UPDATE ON message_analytics
FOR EACH ROW
BEGIN
    UPDATE message_analytics SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_account_limits_timestamp
AFTER UPDATE ON account_limits
FOR EACH ROW
BEGIN
    UPDATE account_limits SET updated_at = CURRENT_TIMESTAMP
    WHERE username = NEW.username;
END;

CREATE TRIGGER IF NOT EXISTS update_follow_up_schedules_timestamp
AFTER UPDATE ON follow_up_schedules
FOR EACH ROW
BEGIN
    UPDATE follow_up_schedules SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;
