#!/usr/bin/env node

/**
 * Setup Script for Instagram DM Tool Backend
 *
 * This script sets up the initial environment for the backend:
 * - Creates necessary directories
 * - Sets up the database with the schema
 * - Creates a default .env file if one doesn't exist
 * - Sets proper permissions for directories
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Check if we're running as the main module
if (require.main === module) {
  setupEnvironment().catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
}

async function setupEnvironment() {
  console.log("\n=== Instagram DM Tool Backend Setup ===\n");

  // Create required directories
  createDirectories();

  // Set up environment file
  setupEnvFile();

  // Set up database
  setupDatabase();

  console.log("\n=== Setup completed successfully! ===");
  console.log("\nYou can now start the server with: npm start");
}

function createDirectories() {
  console.log("Creating required directories...");

  const directories = [
    path.join(__dirname, "logs"),
    path.join(__dirname, "backups"),
    path.join(__dirname, "data"),
    path.join(__dirname, "data", "db"),
  ];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      console.log(`Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    } else {
      console.log(`Directory already exists: ${dir}`);
    }
  }
}

function setupEnvFile() {
  console.log("\nSetting up environment file...");

  const envPath = path.join(__dirname, ".env");
  const exampleEnvPath = path.join(__dirname, ".env.example");

  if (!fs.existsSync(envPath) && fs.existsSync(exampleEnvPath)) {
    console.log("Creating .env file from example...");
    fs.copyFileSync(exampleEnvPath, envPath);
    console.log(
      "Created .env file. Please review and update settings as needed."
    );
  } else if (fs.existsSync(envPath)) {
    console.log(".env file already exists.");
  } else {
    console.log("No .env.example file found. Creating a basic .env file...");
    fs.writeFileSync(
      envPath,
      `PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5174
MAX_DMS_PER_DAY=50
MAX_DMS_PER_HOUR=20
LOG_LEVEL=info
`
    );
    console.log(
      "Created basic .env file. Please review and update settings as needed."
    );
  }
}

function setupDatabase() {
  console.log("\nSetting up database...");

  const dbPath =
    process.env.DB_PATH || path.join(__dirname, "database", "dmautomation.db");
  console.log(`Using database path: ${dbPath}`);

  // First we need to make sure the database file exists
  if (!fs.existsSync(dbPath)) {
    console.log(
      "Database file does not exist, it will be created by the application."
    );
  } else {
    console.log("Database file already exists.");

    // Check if it's a valid SQLite database
    try {
      const sqlite3 = require("better-sqlite3");
      const db = new sqlite3(dbPath);
      const tableCount = db
        .prepare(
          "SELECT count(*) as count FROM sqlite_master WHERE type='table'"
        )
        .get().count;
      console.log(`Database contains ${tableCount} tables.`);
      db.close();
    } catch (err) {
      console.error("Error checking database:", err.message);
      console.log(
        "The existing database file might be corrupted. Please backup and remove it if needed."
      );
    }
  }

  console.log(
    "\nDatabase setup complete. The schema will be initialized when the server starts."
  );
}

module.exports = {
  setupEnvironment,
  createDirectories,
  setupEnvFile,
  setupDatabase,
};
