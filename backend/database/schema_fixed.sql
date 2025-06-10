-- Clean Database Schema for Instagram DM Automation Tool
-- Created: June 2025
-- Fixed: Proper SQL execution order

-- ====================================
-- SECTION 1: CREATE ALL TABLES FIRST
-- ====================================

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    account_username TEXT NOT NULL,
    message_variations TEXT NOT NULL,
    target_usernames TEXT NOT NULL DEFAULT '[]',
    schedule_time DATETIME,
    is_scheduled BOOLEAN DEFAULT 0,
    status TEXT CHECK(status IN ('active', 'paused', 'pending', 'completed', 'failed')) DEFAULT 'pending',
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
    full_name TEXT,
    email TEXT,
    phone TEXT,
    first_contact DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_interaction DATETIME,
    status TEXT CHECK(status IN ('lead', 'prospect', 'customer', 'inactive')) DEFAULT 'lead',
    messages_sent INTEGER DEFAULT 0,
    responses_received INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]', -- JSON array of tags
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    type TEXT NOT NULL CHECK(type IN ('dm_sent', 'response_received', 'call', 'email', 'meeting', 'note_added')),
    content TEXT,
    campaign_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

-- Proxy Management table
CREATE TABLE IF NOT EXISTS proxies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    username TEXT,
    password_encrypted TEXT,
    type TEXT CHECK(type IN ('http', 'https', 'socks4', 'socks5')) DEFAULT 'http',
    is_active BOOLEAN DEFAULT 1,
    location TEXT,
    response_time INTEGER, -- in milliseconds
    success_rate REAL DEFAULT 100.0,
    connected_accounts INTEGER DEFAULT 0,
    last_tested DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Instagram Accounts table
CREATE TABLE IF NOT EXISTS instagram_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT,
    password_encrypted TEXT, -- Store encrypted password
    cookies TEXT, -- JSON string of saved cookies
    proxy_id INTEGER,
    daily_dm_limit INTEGER DEFAULT 100,
    hourly_dm_limit INTEGER DEFAULT 20,
    daily_follow_limit INTEGER DEFAULT 50,
    hourly_follow_limit INTEGER DEFAULT 10,
    status TEXT CHECK(status IN ('active', 'suspended', 'limited', 'inactive')) DEFAULT 'active',
    last_active DATETIME,
    risk_score INTEGER DEFAULT 0,
    warnings_count INTEGER DEFAULT 0,
    rotation_enabled BOOLEAN DEFAULT 0,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rate Limits tracking
CREATE TABLE IF NOT EXISTS dm_rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    daily_dm_count INTEGER DEFAULT 0,
    hourly_dm_count INTEGER DEFAULT 0,
    daily_follow_count INTEGER DEFAULT 0,
    hourly_follow_count INTEGER DEFAULT 0,
    last_dm_time DATETIME,
    last_follow_time DATETIME,
    last_reset_date DATE,
    total_dm_sent INTEGER DEFAULT 0,
    total_follows INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled Jobs table
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type TEXT CHECK(job_type IN ('dm', 'follow', 'scraping')) DEFAULT 'dm',
    from_username TEXT NOT NULL,
    target_usernames TEXT NOT NULL, -- JSON array
    message_variations TEXT, -- JSON array for DM jobs
    schedule_time DATETIME NOT NULL,
    campaign_id INTEGER,
    status TEXT CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    is_recurring BOOLEAN DEFAULT 0,
    recurring_interval TEXT,
    progress INTEGER DEFAULT 0, -- percentage completed
    results TEXT, -- JSON string with results
    error_log TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    executed_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
);

-- Lead/Target Management table
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
    tags TEXT DEFAULT '[]', -- JSON array
    source TEXT, -- 'manual', 'scraping', 'import'
    source_details TEXT, -- details about how lead was found
    scraping_job_id INTEGER,
    status TEXT CHECK(status IN ('new', 'contacted', 'responded', 'converted', 'inactive')) DEFAULT 'new',
    added_to_targets BOOLEAN DEFAULT 0,
    last_contacted DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scraping Jobs table
CREATE TABLE IF NOT EXISTS scraping_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('competitor-followers', 'hashtag-users', 'post-engagers', 'location-based')) NOT NULL,
    targets TEXT NOT NULL, -- JSON array of targets (usernames, hashtags, etc.)
    filters TEXT, -- JSON object with filtering criteria
    max_leads INTEGER DEFAULT 1000,
    leads_found INTEGER DEFAULT 0,
    progress INTEGER DEFAULT 0, -- percentage
    success_rate REAL DEFAULT 0.0,
    is_active BOOLEAN DEFAULT 0,
    last_run DATETIME,
    next_run DATETIME,
    status TEXT CHECK(status IN ('pending', 'running', 'completed', 'failed', 'paused')) DEFAULT 'pending',
    error_log TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- DM Activity Logs
CREATE TABLE IF NOT EXISTS dm_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_username TEXT NOT NULL,
    to_username TEXT NOT NULL,
    message_text TEXT,
    campaign_id INTEGER,
    job_id INTEGER,
    success BOOLEAN DEFAULT 0,
    error_message TEXT,
    response_received BOOLEAN DEFAULT 0,
    response_text TEXT,
    response_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
    FOREIGN KEY (job_id) REFERENCES scheduled_jobs(id) ON DELETE SET NULL
);

-- Activity Logs for monitoring
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    action_type TEXT NOT NULL CHECK(action_type IN ('login', 'dm_sent', 'follow', 'unfollow', 'like', 'comment', 'scraping')),
    target_username TEXT,
    details TEXT,
    status TEXT CHECK(status IN ('success', 'failed', 'warning')) DEFAULT 'success',
    error_message TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Analytics aggregation table
CREATE TABLE IF NOT EXISTS analytics_daily (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL,
    username TEXT NOT NULL,
    dms_sent INTEGER DEFAULT 0,
    dms_successful INTEGER DEFAULT 0,
    responses_received INTEGER DEFAULT 0,
    follows_sent INTEGER DEFAULT 0,
    follows_successful INTEGER DEFAULT 0,
    leads_scraped INTEGER DEFAULT 0,
    campaigns_run INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(date, username)
);

-- =============================================
-- SECTION 2: ADD FOREIGN KEY CONSTRAINTS
-- =============================================

-- Add foreign key constraint to instagram_accounts (referencing proxies table)
-- Note: This needs to be done after proxies table is created

-- ====================================
-- SECTION 3: CREATE INDEXES
-- ====================================

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_campaigns_username ON campaigns(account_username);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_username ON crm_contacts(username);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX IF NOT EXISTS idx_leads_username ON leads(username);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_schedule_time ON scheduled_jobs(schedule_time);
CREATE INDEX IF NOT EXISTS idx_dm_logs_from_username ON dm_logs(from_username);
CREATE INDEX IF NOT EXISTS idx_dm_logs_to_username ON dm_logs(to_username);
CREATE INDEX IF NOT EXISTS idx_activity_logs_username ON activity_logs(username);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_daily(date);

-- ====================================
-- SECTION 4: CREATE TRIGGERS
-- ====================================

-- Create triggers for updating timestamps
CREATE TRIGGER IF NOT EXISTS update_campaigns_timestamp
AFTER UPDATE ON campaigns
FOR EACH ROW
BEGIN
    UPDATE campaigns SET updated_at = CURRENT_TIMESTAMP
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

CREATE TRIGGER IF NOT EXISTS update_instagram_accounts_timestamp
AFTER UPDATE ON instagram_accounts
FOR EACH ROW
BEGIN
    UPDATE instagram_accounts SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_proxies_timestamp
AFTER UPDATE ON proxies
FOR EACH ROW
BEGIN
    UPDATE proxies SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_dm_rate_limits_timestamp
AFTER UPDATE ON dm_rate_limits
FOR EACH ROW
BEGIN
    UPDATE dm_rate_limits SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_leads_timestamp
AFTER UPDATE ON leads
FOR EACH ROW
BEGIN
    UPDATE leads SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_scraping_jobs_timestamp
AFTER UPDATE ON scraping_jobs
FOR EACH ROW
BEGIN
    UPDATE scraping_jobs SET updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;
