const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

console.log("Initializing database with clean schema...");

// Create or open database
const db = new Database(path.join(__dirname, "..", "dmautomation.db"));

try {
  // Read and execute the clean schema
  const schema = fs.readFileSync(
    path.join(__dirname, "schema_clean.sql"),
    "utf8"
  );

  // Split by semicolon and execute each statement
  const statements = schema.split(";").filter((stmt) => stmt.trim());

  statements.forEach((statement, index) => {
    const trimmed = statement.trim();
    if (trimmed) {
      try {
        db.exec(trimmed);
        console.log(`✓ Executed statement ${index + 1}`);
      } catch (error) {
        console.error(`✗ Error in statement ${index + 1}:`, error.message);
        console.error("Statement:", trimmed);
      }
    }
  });

  console.log("✅ Database initialized successfully!");
} catch (error) {
  console.error("❌ Database initialization failed:", error);
} finally {
  db.close();
}
