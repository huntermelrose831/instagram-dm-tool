const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

// Initialize database connection
const db = new Database(path.join(__dirname, "..", "dmautomation.db"), {
  verbose: console.log,
});

// Initialize tables from schema
const schema = fs.readFileSync(
  path.join(__dirname, "schema_fixed.sql"),
  "utf8"
);

// Function to split SQL while preserving triggers
function splitSQLStatements(sql) {
  const statements = [];
  let currentStatement = "";
  let inTrigger = false;

  sql.split("\n").forEach((line) => {
    const trimmedLine = line.trim();

    if (trimmedLine.toUpperCase().includes("CREATE TRIGGER")) {
      inTrigger = true;
    }

    currentStatement += line + "\n";

    if (!inTrigger && trimmedLine.endsWith(";")) {
      statements.push(currentStatement.trim());
      currentStatement = "";
    } else if (inTrigger && trimmedLine === "END;") {
      inTrigger = false;
      statements.push(currentStatement.trim());
      currentStatement = "";
    }
  });

  return statements.filter((stmt) => stmt.length > 0 && !stmt.startsWith("--"));
}

// Execute each statement separately
const statements = splitSQLStatements(schema);
statements.forEach((statement) => {
  try {
    db.exec(statement);
  } catch (error) {
    console.error("Error executing SQL statement:", error.message);
    console.error("Failed statement:", statement);
    throw error;
  }
});

module.exports = db;
