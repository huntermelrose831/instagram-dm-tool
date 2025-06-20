const Database = require("better-sqlite3");
const path = require("path");

// Add all missing tables to the database
async function addMissingTables() {
  const dbPath = path.join(__dirname, "..", "database", "dmautomation.db");
  const db = new Database(dbPath);

  console.log("Adding missing tables to database...");

  try {
    // Add all missing tables at once
    db.exec(`
            -- Campaign targets table
            CREATE TABLE IF NOT EXISTS campaign_targets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'contacted', 'responded', 'skipped')),
                contacted_at DATETIME,
                response_received_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(campaign_id, username),
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
            );

            -- Campaign replies table
            CREATE TABLE IF NOT EXISTS campaign_replies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                campaign_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                message_content TEXT NOT NULL,
                reply_content TEXT NOT NULL,
                sentiment TEXT CHECK(sentiment IN ('positive', 'negative', 'neutral')),
                is_read BOOLEAN DEFAULT 0,
                received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
            );

            -- Automation rules table
            CREATE TABLE IF NOT EXISTS automation_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                trigger_type TEXT NOT NULL CHECK(trigger_type IN ('response_received', 'time_delay', 'engagement_threshold', 'profile_update')),
                trigger_conditions TEXT DEFAULT '{}',
                action_type TEXT NOT NULL CHECK(action_type IN ('send_message', 'tag_contact', 'move_to_sequence', 'schedule_followup')),
                action_parameters TEXT DEFAULT '{}',
                is_active BOOLEAN DEFAULT 1,
                priority INTEGER DEFAULT 1,
                execution_count INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Automation sequences table
            CREATE TABLE IF NOT EXISTS automation_sequences (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                trigger_conditions TEXT DEFAULT '{}',
                steps TEXT NOT NULL DEFAULT '[]',
                is_active BOOLEAN DEFAULT 1,
                enrollment_count INTEGER DEFAULT 0,
                completion_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Automation executions table
            CREATE TABLE IF NOT EXISTS automation_executions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                rule_id INTEGER,
                sequence_id INTEGER,
                contact_username TEXT NOT NULL,
                trigger_event TEXT NOT NULL,
                execution_status TEXT DEFAULT 'pending' CHECK(execution_status IN ('pending', 'running', 'completed', 'failed')),
                result_data TEXT DEFAULT '{}',
                error_message TEXT,
                executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                completed_at DATETIME,
                FOREIGN KEY (rule_id) REFERENCES automation_rules(id) ON DELETE CASCADE,
                FOREIGN KEY (sequence_id) REFERENCES automation_sequences(id) ON DELETE CASCADE
            );

            -- Lead scores table
            CREATE TABLE IF NOT EXISTS lead_scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                engagement_score INTEGER DEFAULT 0,
                response_probability REAL DEFAULT 0.0,
                conversion_score INTEGER DEFAULT 0,
                last_activity DATETIME,
                score_factors TEXT DEFAULT '{}',
                calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- Triggers for automatic timestamp updates
            CREATE TRIGGER IF NOT EXISTS update_automation_rules_timestamp
            AFTER UPDATE ON automation_rules
            FOR EACH ROW
            BEGIN
                UPDATE automation_rules SET updated_at = CURRENT_TIMESTAMP
                WHERE id = NEW.id;
            END;

            CREATE TRIGGER IF NOT EXISTS update_automation_sequences_timestamp
            AFTER UPDATE ON automation_sequences
            FOR EACH ROW
            BEGIN
                UPDATE automation_sequences SET updated_at = CURRENT_TIMESTAMP
                WHERE id = NEW.id;
            END;

            CREATE TRIGGER IF NOT EXISTS update_lead_scores_timestamp
            AFTER UPDATE ON lead_scores
            FOR EACH ROW
            BEGIN
                UPDATE lead_scores SET updated_at = CURRENT_TIMESTAMP
                WHERE id = NEW.id;
            END;
        `);

    console.log("✓ All missing tables created successfully");

    // Verify tables were created
    const tables = db
      .prepare(
        `
            SELECT name FROM sqlite_master 
            WHERE type='table' 
            AND name IN ('campaign_targets', 'campaign_replies', 'automation_rules', 'automation_sequences', 'automation_executions', 'lead_scores')
        `
      )
      .all();

    console.log("Created tables:", tables.map((t) => t.name).join(", "));

    if (tables.length === 6) {
      console.log("✓ All 6 tables created successfully");
    } else {
      console.warn(`⚠ Only ${tables.length}/6 tables created`);
    }
  } catch (error) {
    console.error("Error creating tables:", error.message);
  } finally {
    db.close();
  }
}

if (require.main === module) {
  addMissingTables().catch(console.error);
}

module.exports = { addMissingTables };
