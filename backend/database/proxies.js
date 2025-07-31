const db = require("./db");

class ProxyService {
  // Create a new proxy
  static createProxy(proxyData) {
    const stmt = db.prepare(`
      INSERT INTO proxies (
        host, port, username, password, type, location, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      proxyData.host,
      proxyData.port,
      proxyData.username || null,
      proxyData.password || null,
      proxyData.type || "http",
      proxyData.location || null,
      proxyData.isActive !== undefined ? proxyData.isActive : 1
    );

    return info.lastInsertRowid;
  }

  // Get all proxies
  static getProxies(filters = {}) {
    let query = "SELECT * FROM proxies WHERE 1=1";
    const params = [];

    if (filters.isActive !== undefined) {
      query += " AND is_active = ?";
      params.push(filters.isActive ? 1 : 0);
    }

    if (filters.type) {
      query += " AND type = ?";
      params.push(filters.type);
    }

    if (filters.location) {
      query += " AND location LIKE ?";
      params.push(`%${filters.location}%`);
    }

    query += " ORDER BY created_at DESC";

    const stmt = db.prepare(query);
    const proxies = stmt.all(...params);

    return proxies.map((proxy) => ({
      ...proxy,
      isActive: !!proxy.is_active,
    }));
  }

  // Get proxy by ID
  static getProxyById(id) {
    const stmt = db.prepare("SELECT * FROM proxies WHERE id = ?");
    const proxy = stmt.get(id);

    if (proxy) {
      return {
        ...proxy,
        isActive: !!proxy.is_active,
      };
    }

    return null;
  }

  // Update proxy status
  static updateProxyStatus(id, isActive) {
    const stmt = db.prepare(`
      UPDATE proxies 
      SET is_active = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    const info = stmt.run(isActive ? 1 : 0, id);
    return info.changes > 0;
  }

  // Update proxy health metrics
  static updateProxyHealth(id, healthData) {
    const stmt = db.prepare(`
      UPDATE proxies 
      SET 
        response_time = ?,
        success_rate = ?,
        last_checked = CURRENT_TIMESTAMP,
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const info = stmt.run(
      healthData.responseTime || null,
      healthData.successRate || null,
      healthData.isActive !== undefined ? healthData.isActive : 1,
      id
    );

    return info.changes > 0;
  }

  // Delete proxy
  static deleteProxy(id) {
    const stmt = db.prepare("DELETE FROM proxies WHERE id = ?");
    const info = stmt.run(id);
    return info.changes > 0;
  }

  // Get proxy statistics
  static getProxyStats() {
    const stmt = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        AVG(response_time) as avg_response_time,
        AVG(success_rate) as avg_success_rate
      FROM proxies
    `);

    return stmt.get();
  }

  // Get available proxies for assignment
  static getAvailableProxies() {
    const stmt = db.prepare(`
      SELECT p.*, 
        COUNT(a.username) as assigned_accounts
      FROM proxies p
      LEFT JOIN accounts a ON p.id = a.proxy_id
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY assigned_accounts ASC, p.success_rate DESC
    `);

    const proxies = stmt.all();

    return proxies.map((proxy) => ({
      ...proxy,
      isActive: !!proxy.is_active,
      assignedAccounts: proxy.assigned_accounts || 0,
    }));
  }

  // Test proxy connection (placeholder for actual implementation)
  static async testProxy(id) {
    // This would contain actual proxy testing logic
    // For now, return a mock result
    const proxy = this.getProxyById(id);
    if (!proxy) {
      return { success: false, error: "Proxy not found" };
    }

    // Mock test results
    const responseTime = Math.random() * 1000 + 100; // 100-1100ms
    const successRate = Math.random() * 30 + 70; // 70-100%

    // Update proxy health
    this.updateProxyHealth(id, {
      responseTime: Math.round(responseTime),
      successRate: Math.round(successRate * 10) / 10,
      isActive: successRate > 80,
    });

    return {
      success: successRate > 80,
      responseTime: Math.round(responseTime),
      successRate: Math.round(successRate * 10) / 10,
    };
  }

  // Get proxy usage statistics
  static getProxyUsage(id) {
    const stmt = db.prepare(`
      SELECT 
        COUNT(a.username) as accounts_using,
        p.*
      FROM proxies p
      LEFT JOIN accounts a ON p.id = a.proxy_id
      WHERE p.id = ?
      GROUP BY p.id
    `);

    const result = stmt.get(id);

    if (result) {
      return {
        ...result,
        isActive: !!result.is_active,
        accountsUsing: result.accounts_using || 0,
      };
    }

    return null;
  }

  // Alias for backward compatibility
  static getAllProxies() {
    return this.getProxies();
  }
}

module.exports = ProxyService;
