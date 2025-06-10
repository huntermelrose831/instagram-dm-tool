const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// Read the schema file
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

// Connect to the database
const db = new Database(path.join(__dirname, "..", "dmautomation.db"));

// Split the schema into individual statements
const statements = schema.split(";").filter((stmt) => stmt.trim());

// Execute each statement
statements.forEach((statement) => {
  if (statement.trim()) {
    db.exec(statement);
  }
});

console.log("Database initialized successfully!");

// Close the database connection
db.close();
