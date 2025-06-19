const db = require("./db");

class AccountsService {
  // Create or update an account
  static upsertAccount(accountData) {
    const stmt = db.prepare(`
      INSERT INTO instagram_accounts (username, email, password_encrypted, proxy_id, status, cookies)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        email = excluded.email,
        password_encrypted = excluded.password_encrypted,
        proxy_id = excluded.proxy_id,
        status = excluded.status,
        cookies = excluded.cookies,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `);

    return stmt.get(
      accountData.username,
      accountData.email || null,
      accountData.passwordHash || null,
      accountData.proxyId || null,
      accountData.isActive !== undefined
        ? accountData.isActive
          ? "active"
          : "inactive"
        : "active",
      accountData.cookies ? JSON.stringify(accountData.cookies) : null
    );
  }

  // Get all accounts
  static getAccounts(filters = {}) {
    let query = "SELECT * FROM instagram_accounts WHERE 1=1";
    const params = [];

    if (filters.isActive !== undefined) {
      query += " AND status = ?";
      params.push(filters.isActive ? "active" : "inactive");
    }

    if (filters.search) {
      query += " AND (username LIKE ? OR email LIKE ?)";
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += " ORDER BY created_at DESC";

    const stmt = db.prepare(query);
    const accounts = stmt.all(...params);
    return accounts.map((account) => ({
      ...account,
      cookies: account.cookies ? JSON.parse(account.cookies) : null,
      isActive: account.status === "active",
    }));
  }

  // Get account by username
  static getAccountByUsername(username) {
    const stmt = db.prepare(
      "SELECT * FROM instagram_accounts WHERE username = ?"
    );
    const account = stmt.get(username);

    if (account) {
      return {
        ...account,
        cookies: account.cookies ? JSON.parse(account.cookies) : null,
        isActive: account.status === "active",
      };
    }

    return null;
  }

  // Update account status
  static updateAccountStatus(username, isActive) {
    const stmt = db.prepare(`
      UPDATE instagram_accounts 
      SET status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE username = ?
    `);
    const info = stmt.run(isActive ? "active" : "inactive", username);
    return info.changes > 0;
  }

  // Delete account
  static deleteAccount(username) {
    const stmt = db.prepare(
      "DELETE FROM instagram_accounts WHERE username = ?"
    );
    const info = stmt.run(username);
    return info.changes > 0;
  }

  // Update account cookies
  static updateAccountCookies(username, cookies) {
    const stmt = db.prepare(`
      UPDATE instagram_accounts 
      SET cookies = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE username = ?
    `);
    const info = stmt.run(JSON.stringify(cookies), username);
    return info.changes > 0;
  }

  // Get account statistics
  static getAccountStats() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN cookies IS NOT NULL THEN 1 ELSE 0 END) as logged_in
      FROM instagram_accounts
    `);

    return stmt.get();
  }

  // Update account health metrics
  static updateAccountHealth(username, healthData) {
    const stmt = db.prepare(`
      UPDATE instagram_accounts 
      SET 
        risk_score = ?,
        last_active = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `);

    const info = stmt.run(healthData.riskScore || 0, username);

    return info.changes > 0;
  }

  // Get accounts with health data
  static getAccountsWithHealth() {
    const stmt = db.prepare(`
      SELECT 
        username,
        email,
        status,
        risk_score,
        warnings_count,
        last_active,
        created_at,
        updated_at
      FROM instagram_accounts 
      ORDER BY risk_score ASC
    `);

    const accounts = stmt.all();

    return accounts.map((account) => ({
      ...account,
      isActive: account.status === "active",
      riskScore: account.risk_score || 0,
      riskLevel:
        account.risk_score > 50
          ? "high"
          : account.risk_score > 20
            ? "medium"
            : "low",
    }));
  }
}

module.exports = AccountsService;
