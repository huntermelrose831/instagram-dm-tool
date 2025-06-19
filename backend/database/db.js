const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Initialize database connection - use the database with correct clean schema
const db = new Database(path.join(__dirname, "dmautomation.db"));

// Initialize tables from schema
const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");

// Function to split SQL while preserving triggers and handling PRAGMA
function splitSQLStatements(sql) {
  const statements = [];
  let currentStatement = "";
  let inTrigger = false;

  sql.split("\n").forEach((line) => {
    const trimmedLine = line.trim();

    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith("--")) {
      return;
    }

    if (trimmedLine.toUpperCase().includes("CREATE TRIGGER")) {
      inTrigger = true;
    }

    currentStatement += line + "\n";

    // Handle PRAGMA statements (single line)
    if (
      trimmedLine.toUpperCase().startsWith("PRAGMA") &&
      trimmedLine.endsWith(";")
    ) {
      statements.push(currentStatement.trim());
      currentStatement = "";
    }
    // Handle normal statements
    else if (!inTrigger && trimmedLine.endsWith(";")) {
      statements.push(currentStatement.trim());
      currentStatement = "";
    }
    // Handle trigger end
    else if (inTrigger && trimmedLine === "END;") {
      inTrigger = false;
      statements.push(currentStatement.trim());
      currentStatement = "";
    }
  });

  return statements.filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));
}

// Execute each statement separately
const statements = splitSQLStatements(schema);
console.log(
  `Initializing database with ${statements.length} SQL statements...`
);

statements.forEach((statement, index) => {
  try {
    db.exec(statement);
  } catch (error) {
    console.error(`Error executing SQL statement ${index + 1}:`, error.message);
    console.error("Failed statement:", statement);
    throw error;
  }
});

console.log("✅ Database initialized successfully");

module.exports = db;
