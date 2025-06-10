-- Instagram DM Automation Tool - Complete Database Schema
-- This file contains all the database tables needed for the application

-- ================== USER MANAGEMENT & AUTHENTICATION ==================

-- Users table for team collaboration
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    status TEXT DEFAULT 'active', -- active, inactive, invited, suspended
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME,
    settings JSON, -- User preferences and settings
    permissions JSON -- User-specific permissions override
);

-- Roles and permissions
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    permissions JSON NOT NULL, -- Array of permission strings
    color TEXT DEFAULT '#3B82F6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    is_system_role BOOLEAN DEFAULT FALSE
);

-- Workspaces for team organization
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    settings JSON, -- Workspace-specific settings
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    is_default BOOLEAN DEFAULT FALSE
);

-- User workspace memberships
CREATE TABLE IF NOT EXISTS workspace_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT REFERENCES workspaces(id),
    user_id INTEGER REFERENCES users(id),
    role TEXT DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    permissions JSON, -- Workspace-specific permissions
    UNIQUE(workspace_id, user_id)
);

-- Team invitations
CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    workspace_ids JSON, -- Array of workspace IDs
    message TEXT,
    token TEXT UNIQUE NOT NULL,
    invited_by INTEGER REFERENCES users(id),
    invited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    accepted_at DATETIME,
    status TEXT DEFAULT 'pending' -- pending, accepted, expired, revoked
);

-- ================== INSTAGRAM ACCOUNTS MANAGEMENT ==================

-- Instagram accounts
CREATE TABLE IF NOT EXISTS instagram_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Encrypted
    email TEXT,
    phone TEXT,
    full_name TEXT,
    bio TEXT,
    profile_pic_url TEXT,
    follower_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    posts_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    is_business BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active', -- active, suspended, blocked, rate_limited
    proxy_id INTEGER REFERENCES proxies(id),
    user_id INTEGER REFERENCES users(id),
    workspace_id TEXT REFERENCES workspaces(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    session_data JSON, -- Browser session storage
    settings JSON, -- Account-specific settings
    health_score INTEGER DEFAULT 100 -- Account health (0-100)
);

-- Proxy servers
CREATE TABLE IF NOT EXISTS proxies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    username TEXT,
    password TEXT, -- Encrypted
    protocol TEXT DEFAULT 'http', -- http, https, socks4, socks5
    country TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_used DATETIME,
    success_rate REAL DEFAULT 100.0,
    response_time INTEGER, -- Average response time in ms
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    settings JSON
);

-- Account health monitoring
CREATE TABLE IF NOT EXISTS account_health (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES instagram_accounts(id),
    check_type TEXT NOT NULL, -- login, actions, restrictions, warnings
    status TEXT NOT NULL, -- healthy, warning, error, blocked
    message TEXT,
    details JSON,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Rate limiting configuration
CREATE TABLE IF NOT EXISTS rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES instagram_accounts(id),
    action_type TEXT NOT NULL, -- dm, follow, like, comment, etc.
    hourly_limit INTEGER NOT NULL,
    daily_limit INTEGER NOT NULL,
    current_hourly INTEGER DEFAULT 0,
    current_daily INTEGER DEFAULT 0,
    last_reset_hour DATETIME,
    last_reset_day DATETIME,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ================== MESSAGING & CAMPAIGNS ==================

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'dm', -- dm, comment, story_reply
    status TEXT DEFAULT 'draft', -- draft, active, paused, completed, cancelled
    account_id INTEGER REFERENCES instagram_accounts(id),
    user_id INTEGER REFERENCES users(id),
    workspace_id TEXT REFERENCES workspaces(id),
    target_list_id INTEGER REFERENCES target_lists(id),
    message_template_id INTEGER REFERENCES message_templates(id),
    automation_workflow_id INTEGER REFERENCES automation_workflows(id),
    settings JSON, -- Campaign-specific settings
    schedule JSON, -- Scheduling configuration
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    stats JSON -- Campaign statistics cache
);

-- Message templates
CREATE TABLE IF NOT EXISTS message_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    variables JSON, -- Available variables for substitution
    category TEXT,
    is_shared BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    user_id INTEGER REFERENCES users(id),
    workspace_id TEXT REFERENCES workspaces(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Direct messages
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER REFERENCES campaigns(id),
    account_id INTEGER REFERENCES instagram_accounts(id),
    target_username TEXT NOT NULL,
    target_user_id TEXT,
    message_content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text', -- text, image, video, link
    status TEXT DEFAULT 'pending', -- pending, sent, delivered, read, replied, failed
    sent_at DATETIME,
    delivered_at DATETIME,
    read_at DATETIME,
    replied_at DATETIME,
    error_message TEXT,
    thread_id TEXT, -- Instagram thread ID
    message_id TEXT, -- Instagram message ID
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata JSON -- Additional message metadata
);

-- Message threads (conversations)
CREATE TABLE IF NOT EXISTS message_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES instagram_accounts(id),
    target_username TEXT NOT NULL,
    target_user_id TEXT,
    thread_id TEXT UNIQUE, -- Instagram thread ID
    status TEXT DEFAULT 'active', -- active, archived, blocked
    last_message_at DATETIME,
    message_count INTEGER DEFAULT 0,
    is_unread BOOLEAN DEFAULT FALSE,
    tags JSON, -- Array of tags
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scheduled messages
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER REFERENCES campaigns(id),
    account_id INTEGER REFERENCES instagram_accounts(id),
    target_username TEXT NOT NULL,
    message_content TEXT NOT NULL,
    scheduled_for DATETIME NOT NULL,
    status TEXT DEFAULT 'scheduled', -- scheduled, sent, cancelled, failed
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    sent_at DATETIME,
    error_message TEXT
);

-- ================== TARGETING & LEAD GENERATION ==================

-- Target lists
CREATE TABLE IF NOT EXISTS target_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- manual, scraped, imported
    source TEXT, -- competitor_followers, hashtag, location, etc.
    source_params JSON, -- Parameters used for scraping/generation
    total_count INTEGER DEFAULT 0,
    active_count INTEGER DEFAULT 0,
    user_id INTEGER REFERENCES users(id),
    workspace_id TEXT REFERENCES workspaces(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Target users
CREATE TABLE IF NOT EXISTS targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_list_id INTEGER REFERENCES target_lists(id),
    username TEXT NOT NULL,
    user_id TEXT, -- Instagram user ID
    full_name TEXT,
    bio TEXT,
    profile_pic_url TEXT,
    follower_count INTEGER,
    following_count INTEGER,
    posts_count INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    is_business BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT FALSE,
    engagement_rate REAL,
    last_post_date DATETIME,
    location TEXT,
    category TEXT,
    status TEXT DEFAULT 'active', -- active, contacted, converted, excluded
    lead_score INTEGER DEFAULT 0,
    custom_fields JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(target_list_id, username)
);

-- Scraping jobs
CREATE TABLE IF NOT EXISTS scraping_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- competitor_followers, hashtag_users, location_users
    source TEXT NOT NULL, -- Username, hashtag, or location
    parameters JSON, -- Scraping parameters and filters
    target_list_id INTEGER REFERENCES target_lists(id),
    status TEXT DEFAULT 'pending', -- pending, running, completed, failed, cancelled
    progress INTEGER DEFAULT 0,
    total_estimated INTEGER,
    results_count INTEGER DEFAULT 0,
    user_id INTEGER REFERENCES users(id),
    workspace_id TEXT REFERENCES workspaces(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    error_message TEXT,
    settings JSON
);

-- ================== CRM & LEAD MANAGEMENT ==================

-- Contacts (leads/prospects)
CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    user_id TEXT, -- Instagram user ID
    full_name TEXT,
    email TEXT,
    phone TEXT,
    bio TEXT,
    profile_pic_url TEXT,
    follower_count INTEGER,
    following_count INTEGER,
    posts_count INTEGER,
    engagement_rate REAL,
    lead_score INTEGER DEFAULT 0,
    lead_source TEXT, -- organic, scraping, referral, etc.
    status TEXT DEFAULT 'new', -- new, contacted, qualified, unqualified, converted, lost
    stage TEXT DEFAULT 'prospect', -- prospect, lead, opportunity, customer
    assigned_to INTEGER REFERENCES users(id),
    workspace_id TEXT REFERENCES workspaces(id),
    tags JSON,
    custom_fields JSON,
    notes TEXT,
    last_contact DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(username)
);

-- Contact interactions
CREATE TABLE IF NOT EXISTS contact_interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contact_id INTEGER REFERENCES contacts(id),
    type TEXT NOT NULL, -- message, call, email, meeting, note
    direction TEXT DEFAULT 'outbound', -- outbound, inbound
    subject TEXT,
    content TEXT,
    outcome TEXT,
    user_id INTEGER REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    scheduled_for DATETIME,
    completed_at DATETIME
);

-- Lead scoring rules
CREATE TABLE IF NOT EXISTS lead_scoring_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    condition_type TEXT NOT NULL, -- follower_count, engagement_rate, bio_keywords, etc.
    condition_operator TEXT NOT NULL, -- greater_than, less_than, contains, etc.
    condition_value TEXT NOT NULL,
    score_adjustment INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    workspace_id TEXT REFERENCES workspaces(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ================== AUTOMATION & WORKFLOWS ==================

-- Automation workflows
CREATE TABLE IF NOT EXISTS automation_workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- auto_responder, follow_up, lead_qualification
    triggers JSON NOT NULL, -- Array of trigger conditions
    actions JSON NOT NULL, -- Array of actions to execute
    conditions JSON, -- Additional conditions/filters
    is_active BOOLEAN DEFAULT TRUE,
    user_id INTEGER REFERENCES users(id),
    workspace_id TEXT REFERENCES workspaces(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    stats JSON -- Workflow execution statistics
);

-- Automation executions
CREATE TABLE IF NOT EXISTS automation_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER REFERENCES automation_workflows(id),
    trigger_data JSON, -- Data that triggered the execution
    status TEXT DEFAULT 'pending', -- pending, running, completed, failed
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    result JSON, -- Execution results
    error_message TEXT
);

-- Auto-responders
CREATE TABLE IF NOT EXISTS auto_responders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    trigger_keywords JSON, -- Keywords that trigger the response
    response_message TEXT NOT NULL,
    response_delay INTEGER DEFAULT 0, -- Delay in minutes
    is_active BOOLEAN DEFAULT TRUE,
    account_id INTEGER REFERENCES instagram_accounts(id),
    user_id INTEGER REFERENCES users(id),
    workspace_id TEXT REFERENCES workspaces(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    stats JSON -- Usage statistics
);

-- Follow-up sequences
CREATE TABLE IF NOT EXISTS follow_up_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    steps JSON NOT NULL, -- Array of follow-up steps
    trigger_condition TEXT, -- When to start the sequence
    is_active BOOLEAN DEFAULT TRUE,
    user_id INTEGER REFERENCES users(id),
    workspace_id TEXT REFERENCES workspaces(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    stats JSON
);

-- ================== ANALYTICS & REPORTING ==================

-- Analytics events
CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL, -- message_sent, message_received, lead_generated, etc.
    event_data JSON NOT NULL,
    account_id INTEGER REFERENCES instagram_accounts(id),
    campaign_id INTEGER REFERENCES campaigns(id),
    user_id INTEGER REFERENCES users(id),
    workspace_id TEXT REFERENCES workspaces(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- standard, custom, scheduled
    config JSON NOT NULL, -- Report configuration (metrics, filters, etc.)
    schedule JSON, -- Scheduling configuration for automated reports
    recipients JSON, -- Email recipients for scheduled reports
    is_active BOOLEAN DEFAULT TRUE,
    user_id INTEGER REFERENCES users(id),
    workspace_id TEXT REFERENCES workspaces(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_generated DATETIME
);

-- Report generations
CREATE TABLE IF NOT EXISTS report_generations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER REFERENCES reports(id),
    status TEXT DEFAULT 'pending', -- pending, generating, completed, failed
    file_path TEXT,
    file_size INTEGER,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    parameters JSON, -- Generation parameters
    error_message TEXT
);

-- Data exports
CREATE TABLE IF NOT EXISTS data_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- leads, messages, analytics, etc.
    format TEXT DEFAULT 'csv', -- csv, excel, json, pdf
    filters JSON, -- Export filters
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    progress INTEGER DEFAULT 0,
    file_path TEXT,
    file_size INTEGER,
    record_count INTEGER,
    user_id INTEGER REFERENCES users(id),
    workspace_id TEXT REFERENCES workspaces(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    error_message TEXT
);

-- ================== ACTIVITY LOGGING ==================

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action TEXT NOT NULL,
    resource_type TEXT, -- user, campaign, message, etc.
    resource_id INTEGER,
    details JSON,
    ip_address TEXT,
    user_agent TEXT,
    workspace_id TEXT REFERENCES workspaces(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ================== SYSTEM CONFIGURATION ==================

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    data_type TEXT DEFAULT 'string', -- string, number, boolean, json
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id)
);

-- API keys and integrations
CREATE TABLE IF NOT EXISTS api_integrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- apify, webhook, crm, etc.
    config JSON NOT NULL, -- Integration configuration
    is_active BOOLEAN DEFAULT TRUE,
    workspace_id TEXT REFERENCES workspaces(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME
);

-- ================== INDEXES FOR PERFORMANCE ==================

-- User and authentication indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);

-- Instagram accounts indexes
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_username ON instagram_accounts(username);
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_status ON instagram_accounts(status);
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_user ON instagram_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_instagram_accounts_workspace ON instagram_accounts(workspace_id);

-- Messaging indexes
CREATE INDEX IF NOT EXISTS idx_messages_campaign ON messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_messages_account ON messages(account_id);
CREATE INDEX IF NOT EXISTS idx_messages_target ON messages(target_username);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_message_threads_account ON message_threads(account_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_target ON message_threads(target_username);

-- Campaigns indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_account ON campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns(workspace_id);

-- Targets indexes
CREATE INDEX IF NOT EXISTS idx_targets_list ON targets(target_list_id);
CREATE INDEX IF NOT EXISTS idx_targets_username ON targets(username);
CREATE INDEX IF NOT EXISTS idx_targets_status ON targets(status);

-- Contacts indexes
CREATE INDEX IF NOT EXISTS idx_contacts_username ON contacts(username);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned ON contacts(assigned_to);
CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_account ON analytics_events(account_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_campaign ON analytics_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);

-- Activity logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_workspace ON activity_logs(workspace_id);

-- ================== INITIAL DATA ==================

-- Insert default system roles
INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system_role) VALUES
('admin', 'Administrator', 'Full access to all features and settings', 
 '["view_dashboard", "send_messages", "manage_campaigns", "view_analytics", "export_data", "manage_leads", "manage_accounts", "team_admin", "billing_access", "api_access"]', 
 TRUE),
('manager', 'Manager', 'Can manage campaigns and view analytics', 
 '["view_dashboard", "send_messages", "manage_campaigns", "view_analytics", "manage_leads"]', 
 TRUE),
('member', 'Team Member', 'Basic access to messaging and lead management', 
 '["view_dashboard", "send_messages", "manage_leads"]', 
 TRUE);

-- Insert default system settings
INSERT OR IGNORE INTO system_settings (key, value, data_type, description, is_public) VALUES
('app_name', 'Instagram DM Tool', 'string', 'Application name', TRUE),
('app_version', '1.0.0', 'string', 'Application version', TRUE),
('max_accounts_per_user', '10', 'number', 'Maximum Instagram accounts per user', FALSE),
('default_rate_limit_dm_hourly', '60', 'number', 'Default hourly DM rate limit', FALSE),
('default_rate_limit_dm_daily', '500', 'number', 'Default daily DM rate limit', FALSE),
('scraping_timeout', '300', 'number', 'Scraping job timeout in seconds', FALSE),
('auto_delete_old_logs', '90', 'number', 'Auto-delete logs older than N days', FALSE);
