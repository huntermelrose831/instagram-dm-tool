const db = require("./db");

class AccountsService {
  // Create or update an account
  static upsertAccount(accountData) {
    const stmt = db.prepare(`
      INSERT INTO accounts (username, email, password_hash, proxy_id, is_active, cookies)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(username) DO UPDATE SET
        email = excluded.email,
        password_hash = excluded.password_hash,
        proxy_id = excluded.proxy_id,
        is_active = excluded.is_active,
        cookies = excluded.cookies,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `);

    return stmt.get(
      accountData.username,
      accountData.email || null,
      accountData.passwordHash || null,
      accountData.proxyId || null,
      accountData.isActive !== undefined ? accountData.isActive : 1,
      accountData.cookies ? JSON.stringify(accountData.cookies) : null
    );
  }

  // Get all accounts
  static getAccounts(filters = {}) {
    let query = "SELECT * FROM accounts WHERE 1=1";
    const params = [];

    if (filters.isActive !== undefined) {
      query += " AND is_active = ?";
      params.push(filters.isActive ? 1 : 0);
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
      isActive: !!account.is_active,
    }));
  }

  // Get account by username
  static getAccountByUsername(username) {
    const stmt = db.prepare("SELECT * FROM accounts WHERE username = ?");
    const account = stmt.get(username);

    if (account) {
      return {
        ...account,
        cookies: account.cookies ? JSON.parse(account.cookies) : null,
        isActive: !!account.is_active,
      };
    }

    return null;
  }

  // Update account status
  static updateAccountStatus(username, isActive) {
    const stmt = db.prepare(`
      UPDATE accounts 
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE username = ?
    `);
    const info = stmt.run(isActive ? 1 : 0, username);
    return info.changes > 0;
  }

  // Delete account
  static deleteAccount(username) {
    const stmt = db.prepare("DELETE FROM accounts WHERE username = ?");
    const info = stmt.run(username);
    return info.changes > 0;
  }

  // Update account cookies
  static updateAccountCookies(username, cookies) {
    const stmt = db.prepare(`
      UPDATE accounts 
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
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN cookies IS NOT NULL THEN 1 ELSE 0 END) as logged_in
      FROM accounts
    `);

    return stmt.get();
  }

  // Update account health metrics
  static updateAccountHealth(username, healthData) {
    const stmt = db.prepare(`
      UPDATE accounts 
      SET 
        health_score = ?,
        last_health_check = CURRENT_TIMESTAMP,
        risk_level = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE username = ?
    `);

    const info = stmt.run(
      healthData.healthScore || null,
      healthData.riskLevel || "low",
      username
    );

    return info.changes > 0;
  }

  // Get accounts with health data
  static getAccountsWithHealth() {
    const stmt = db.prepare(`
      SELECT 
        username,
        email,
        is_active,
        health_score,
        risk_level,
        last_health_check,
        created_at,
        updated_at
      FROM accounts 
      ORDER BY health_score DESC NULLS LAST
    `);

    const accounts = stmt.all();

    return accounts.map((account) => ({
      ...account,
      isActive: !!account.is_active,
      healthScore: account.health_score || 100,
      riskLevel: account.risk_level || "low",
    }));
  }
}

module.exports = AccountsService;
