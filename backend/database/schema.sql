-- Schema definition for the Instagram DM Tool database

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT,
    proxy_id INTEGER,
    health_score INTEGER DEFAULT 100,
    risk_level TEXT DEFAULT 'low',
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proxy_id) REFERENCES proxies (id) ON DELETE SET NULL
);

-- Proxies table
CREATE TABLE IF NOT EXISTS proxies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    username TEXT,
    password TEXT,
    type TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_used TIMESTAMP,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rate limits table
CREATE TABLE IF NOT EXISTS rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    daily_limit INTEGER DEFAULT 50,
    hourly_limit INTEGER DEFAULT 20,
    messages_sent_today INTEGER DEFAULT 0,
    messages_sent_hour INTEGER DEFAULT 0,
    follow_daily_limit INTEGER DEFAULT 100,
    follow_hourly_limit INTEGER DEFAULT 25,
    follows_today INTEGER DEFAULT 0,
    follows_hour INTEGER DEFAULT 0,
    last_message_time TIMESTAMP,
    last_follow_time TIMESTAMP,
    last_reset_day TIMESTAMP,
    last_reset_hour TIMESTAMP,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    profile_url TEXT,
    source TEXT,
    source_url TEXT,
    is_target INTEGER DEFAULT 0,
    notes TEXT,
    scraped_at TIMESTAMP,
    engagement_count INTEGER DEFAULT 0,
    engagement_rate REAL,
    followers_count INTEGER,
    following_count INTEGER,
    location TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled jobs table
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_username TEXT NOT NULL,
    target_usernames TEXT NOT NULL,
    message_variations TEXT NOT NULL,
    schedule_time TIMESTAMP NOT NULL,
    is_recurring INTEGER DEFAULT 0,
    recurring_interval TEXT,
    status TEXT DEFAULT 'pending',
    last_run_time TIMESTAMP,
    next_run_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message history table
CREATE TABLE IF NOT EXISTS message_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_username TEXT NOT NULL,
    to_username TEXT NOT NULL,
    message_content TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scheduled_job_id INTEGER,
    status TEXT DEFAULT 'sent',
    error_message TEXT,
    FOREIGN KEY (scheduled_job_id) REFERENCES scheduled_jobs (id) ON DELETE SET NULL
);

-- CRM contacts table
CREATE TABLE IF NOT EXISTS crm_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'lead',
    lifecycle_stage TEXT,
    last_interaction TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CRM notes table
CREATE TABLE IF NOT EXISTS crm_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts (id) ON DELETE CASCADE
);

-- CRM tags table
CREATE TABLE IF NOT EXISTS crm_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CRM contact tags junction table
CREATE TABLE IF NOT EXISTS crm_contact_tags (
    contact_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (contact_id, tag_id),
    FOREIGN KEY (contact_id) REFERENCES crm_contacts (id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES crm_tags (id) ON DELETE CASCADE
);

-- CRM interactions table
CREATE TABLE IF NOT EXISTS crm_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT,
    campaign_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES crm_contacts (id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_username ON leads(username);
CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);
CREATE INDEX IF NOT EXISTS idx_message_history_from_to ON message_history(from_username, to_username);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);

-- Create triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS accounts_updated_at
AFTER UPDATE ON accounts
BEGIN
    UPDATE accounts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS leads_updated_at
AFTER UPDATE ON leads
BEGIN
    UPDATE leads SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS scheduled_jobs_updated_at
AFTER UPDATE ON scheduled_jobs
BEGIN
    UPDATE scheduled_jobs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS crm_contacts_updated_at
AFTER UPDATE ON crm_contacts
BEGIN
    UPDATE crm_contacts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS crm_notes_updated_at
AFTER UPDATE ON crm_notes
BEGIN
    UPDATE crm_notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS proxies_updated_at
AFTER UPDATE ON proxies
BEGIN
    UPDATE proxies SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
