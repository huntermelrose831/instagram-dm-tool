-- Clean schema without duplicates

-- Instagram accounts table
CREATE TABLE IF NOT EXISTS instagram_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    password_encrypted TEXT,
    proxy_id INTEGER,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
    cookies TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

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

-- CRM contacts table
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

-- CRM notes table
CREATE TABLE IF NOT EXISTS crm_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE
);

-- CRM interactions table
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

-- DM rate limits table with proper constraints
CREATE TABLE IF NOT EXISTS dm_rate_limits (
    username TEXT PRIMARY KEY,
    daily_dm_count INTEGER DEFAULT 0,
    last_dm_time DATETIME,
    last_reset_date DATE,
    total_dm_sent INTEGER DEFAULT 0
);

-- Scheduled jobs table
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_username TEXT NOT NULL,
    target_usernames TEXT NOT NULL,
    message_variations TEXT NOT NULL,
    schedule_time DATETIME NOT NULL,
    campaign_id INTEGER,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    is_recurring BOOLEAN DEFAULT 0,
    recurring_interval TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_run DATETIME,
    error_log TEXT,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    full_name TEXT,
    followers_count INTEGER,
    following_count INTEGER,
    posts_count INTEGER,
    engagement_rate REAL,
    location TEXT,
    bio TEXT,
    is_verified BOOLEAN DEFAULT 0,
    has_profile_pic BOOLEAN DEFAULT 1,
    has_website BOOLEAN DEFAULT 0,
    tags TEXT DEFAULT '[]',
    source TEXT DEFAULT 'manual',
    source_details TEXT,
    scraping_job_id INTEGER,
    status TEXT DEFAULT 'new' CHECK(status IN ('new', 'contacted', 'responded', 'converted', 'ignored')),
    is_target BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DM logs table
CREATE TABLE IF NOT EXISTS dm_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_username TEXT NOT NULL,
    to_username TEXT NOT NULL,
    message_text TEXT,
    success BOOLEAN DEFAULT 0,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CRM tags table
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

-- Analytics tables
CREATE TABLE IF NOT EXISTS message_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER,
    message_variation TEXT NOT NULL,
    sent_count INTEGER DEFAULT 0,
    response_count INTEGER DEFAULT 0,
    success_rate REAL DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
);

-- Account limits table
CREATE TABLE IF NOT EXISTS account_limits (
    username TEXT PRIMARY KEY,
    daily_limit INTEGER DEFAULT 50,
    hourly_limit INTEGER DEFAULT 20,
    messages_sent_today INTEGER DEFAULT 0,
    messages_sent_hour INTEGER DEFAULT 0,
    last_message_time DATETIME,
    cooldown_until DATETIME,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Follow up schedules table
CREATE TABLE IF NOT EXISTS follow_up_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    campaign_id INTEGER,
    message_template TEXT NOT NULL,
    scheduled_time DATETIME NOT NULL,
    conditions TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

-- Activity logs table
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
CREATE TRIGGER IF NOT EXISTS update_instagram_accounts_timestamp 
AFTER UPDATE ON instagram_accounts
FOR EACH ROW
BEGIN
    UPDATE instagram_accounts SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

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

CREATE TRIGGER IF NOT EXISTS update_leads_timestamp
AFTER UPDATE ON leads
FOR EACH ROW
BEGIN
    UPDATE leads SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;
