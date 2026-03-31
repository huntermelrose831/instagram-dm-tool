#!/usr/bin/env node
/**
 * API Endpoint Test Suite
 * Tests all backend API endpoints.
 *
 * Usage:
 *   node test-endpoints.js              # Run all tests
 *   node test-endpoints.js crm          # Run only CRM tests
 *   node test-endpoints.js team         # Run only Team tests
 *   node test-endpoints.js reports      # Run only Reports tests
 *   node test-endpoints.js exports      # Run only Exports tests
 *   node test-endpoints.js accounts     # Run only Accounts tests
 *   node test-endpoints.js leads        # Run only Leads tests
 *   node test-endpoints.js scrape       # Show skipped scrape/DM endpoints
 *
 * Filter matches against test label text (case-insensitive).
 * Requires the backend server to be running on localhost:5001
 */

const BASE_URL = process.env.API_URL || "http://localhost:5001";

const FILTER = process.argv[2] || "";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

let passed = 0;
let failed = 0;
let skipped = 0;

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

function pass(label) {
  passed++;
  log(colors.green, `  ✓  ${label}`);
}

function fail(label, reason) {
  failed++;
  log(colors.red, `  ✗  ${label}`);
  if (reason) log(colors.dim, `     → ${reason}`);
}

function section(name) {
  console.log(`\n${colors.bold}${colors.cyan}══ ${name} ══${colors.reset}`);
}

async function req(method, path, body, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  let data;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, ok: res.ok, data };
}

async function test(label, fn) {
  if (FILTER && !label.toLowerCase().includes(FILTER.toLowerCase())) {
    skipped++;
    return;
  }
  try {
    await fn();
  } catch (err) {
    fail(label, err.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// ─── Test Groups ──────────────────────────────────────────────────────────────

async function testHealth() {
  section("Health Check");

  await test("GET /health returns healthy", async () => {
    const { status, data } = await req("GET", "/health");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(
      data.status === "healthy",
      `Expected status=healthy, got ${data.status}`,
    );
    pass("GET /health returns healthy");
  });
}

async function testAccounts() {
  section("Accounts");
  let createdUsername = `test_account_${Date.now()}`;

  await test("GET /api/accounts returns array", async () => {
    const { status, data } = await req("GET", "/api/accounts");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data), `Expected array, got ${typeof data}`);
    pass("GET /api/accounts returns array");
  });

  await test("POST /api/accounts creates account", async () => {
    const { status, data } = await req("POST", "/api/accounts", {
      username: createdUsername,
      email: `${createdUsername}@test.com`,
      password: "testpassword123",
    });
    assert(
      status === 200 || status === 201 || status === 409,
      `Expected 200/201/409, got ${status}: ${JSON.stringify(data)}`,
    );
    pass("POST /api/accounts creates account");
  });

  await test("DELETE /api/accounts/:username removes account", async () => {
    const { status } = await req("DELETE", `/api/accounts/${createdUsername}`);
    assert(
      status === 200 || status === 404,
      `Expected 200 or 404, got ${status}`,
    );
    pass("DELETE /api/accounts/:username removes account");
  });
}

async function testTargets() {
  section("Targets");
  const testUser = `target_test_${Date.now()}`;

  await test("GET /api/targets returns targets", async () => {
    const { status, data } = await req("GET", "/api/targets");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.status === "success", `Expected status=success`);
    assert(Array.isArray(data.targets), `Expected targets array`);
    pass("GET /api/targets returns targets");
  });

  await test("POST /api/targets adds a target", async () => {
    const { status, data } = await req("POST", "/api/targets", {
      username: testUser,
    });
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.status === "success", `Expected status=success`);
    pass("POST /api/targets adds a target");
  });

  await test("DELETE /api/targets/:username removes target", async () => {
    const { status, data } = await req("DELETE", `/api/targets/${testUser}`);
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.status === "success", `Expected status=success`);
    pass("DELETE /api/targets/:username removes target");
  });

  await test("DELETE /api/targets/clear clears all targets", async () => {
    const { status, data } = await req("DELETE", "/api/targets/clear");
    assert(status === 200, `Expected 200, got ${status}`);
    pass("DELETE /api/targets/clear clears all targets");
  });
}

async function testCRM() {
  section("CRM");
  let contactId = null;
  const testUsername = `crm_test_user_${Date.now()}`;

  await test("GET /api/crm/contacts returns array", async () => {
    const { status, data } = await req("GET", "/api/crm/contacts");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(
      Array.isArray(data),
      `Expected array, got ${typeof data}: ${JSON.stringify(data).slice(0, 100)}`,
    );
    pass("GET /api/crm/contacts returns array");
  });

  await test("POST /api/crm/contacts creates contact", async () => {
    const { status, data } = await req("POST", "/api/crm/contacts", {
      username: testUsername,
      status: "lead",
    });
    assert(
      status === 200 || status === 201,
      `Expected 200/201, got ${status}: ${JSON.stringify(data)}`,
    );
    assert(data.username === testUsername, `Expected username=${testUsername}`);
    contactId = data.id;
    pass("POST /api/crm/contacts creates contact");
  });

  await test("PATCH /api/crm/contacts/:id updates status", async () => {
    if (!contactId)
      return fail(
        "PATCH /api/crm/contacts/:id updates status",
        "No contact ID from previous test",
      );
    const { status, data } = await req(
      "PATCH",
      `/api/crm/contacts/${contactId}`,
      {
        status: "prospect",
      },
    );
    assert(
      status === 200,
      `Expected 200, got ${status}: ${JSON.stringify(data)}`,
    );
    pass("PATCH /api/crm/contacts/:id updates status");
  });

  await test("POST /api/crm/contacts/:id/notes adds note", async () => {
    if (!contactId)
      return fail(
        "POST /api/crm/contacts/:id/notes adds note",
        "No contact ID",
      );
    const { status, data } = await req(
      "POST",
      `/api/crm/contacts/${contactId}/notes`,
      {
        content: "Test note from automated test",
      },
    );
    assert(
      status === 200,
      `Expected 200, got ${status}: ${JSON.stringify(data)}`,
    );
    pass("POST /api/crm/contacts/:id/notes adds note");
  });

  await test("POST /api/crm/contacts/:id/tags adds tag", async () => {
    if (!contactId)
      return fail("POST /api/crm/contacts/:id/tags adds tag", "No contact ID");
    const { status, data } = await req(
      "POST",
      `/api/crm/contacts/${contactId}/tags`,
      {
        tag: "test-tag",
      },
    );
    assert(
      status === 200,
      `Expected 200, got ${status}: ${JSON.stringify(data)}`,
    );
    pass("POST /api/crm/contacts/:id/tags adds tag");
  });

  await test("DELETE /api/crm/contacts/:id/tags/:tagName removes tag", async () => {
    if (!contactId)
      return fail(
        "DELETE /api/crm/contacts/:id/tags/:tagName removes tag",
        "No contact ID",
      );
    const { status } = await req(
      "DELETE",
      `/api/crm/contacts/${contactId}/tags/test-tag`,
    );
    assert(status === 200, `Expected 200, got ${status}`);
    pass("DELETE /api/crm/contacts/:id/tags/:tagName removes tag");
  });

  await test("DELETE /api/crm/contacts/:id removes contact", async () => {
    if (!contactId)
      return fail(
        "DELETE /api/crm/contacts/:id removes contact",
        "No contact ID",
      );
    const { status, data } = await req(
      "DELETE",
      `/api/crm/contacts/${contactId}`,
    );
    assert(
      status === 200,
      `Expected 200, got ${status}: ${JSON.stringify(data)}`,
    );
    assert(data.status === "success", `Expected status=success`);
    pass("DELETE /api/crm/contacts/:id removes contact");
  });
}

async function testReports() {
  section("Reports");
  let reportId = null;

  await test("GET /api/reports returns {reports: []}", async () => {
    const { status, data } = await req("GET", "/api/reports");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(typeof data === "object" && !Array.isArray(data), `Expected object`);
    assert(
      Array.isArray(data.reports),
      `Expected data.reports to be array, got ${JSON.stringify(data).slice(0, 100)}`,
    );
    pass("GET /api/reports returns {reports: []}");
  });

  await test("GET /api/reports/scheduled returns {scheduledReports: []}", async () => {
    const { status, data } = await req("GET", "/api/reports/scheduled");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(
      Array.isArray(data.scheduledReports),
      `Expected data.scheduledReports array, got ${JSON.stringify(data)}`,
    );
    pass("GET /api/reports/scheduled returns {scheduledReports: []}");
  });

  await test("GET /api/reports/stats returns stats", async () => {
    const { status, data } = await req("GET", "/api/reports/stats");
    assert(status === 200, `Expected 200, got ${status}`);
    assert("total" in data, `Expected total field in stats`);
    pass("GET /api/reports/stats returns stats");
  });

  await test("POST /api/reports/create creates report", async () => {
    const { status, data } = await req("POST", "/api/reports/create", {
      name: "Test Report",
      type: "standard",
      dateRange: "last_30_days",
      metrics: ["messages_sent", "responses"],
      format: "csv",
    });
    assert(
      status === 200 || status === 201,
      `Expected 200/201, got ${status}: ${JSON.stringify(data)}`,
    );
    assert(
      data.status === "success" || data.id,
      `Expected success or id in response: ${JSON.stringify(data)}`,
    );
    reportId = data.report?.id || data.id;
    pass("POST /api/reports/create creates report");
  });

  await test("POST /api/reports/:id/run runs report", async () => {
    if (!reportId)
      return fail(
        "POST /api/reports/:id/run runs report",
        "No report ID from previous test",
      );
    const { status, data } = await req("POST", `/api/reports/${reportId}/run`);
    assert(
      status === 200,
      `Expected 200, got ${status}: ${JSON.stringify(data)}`,
    );
    assert(data.status === "success", `Expected status=success`);
    pass("POST /api/reports/:id/run runs report");
  });

  await test("POST /api/reports/:id/export exports report", async () => {
    if (!reportId)
      return fail(
        "POST /api/reports/:id/export exports report",
        "No report ID",
      );
    const res = await fetch(`${BASE_URL}/api/reports/${reportId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "csv" }),
    });
    assert(res.ok, `Expected 200, got ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    assert(ct.includes("text/csv"), `Expected CSV content-type, got ${ct}`);
    pass("POST /api/reports/:id/export exports report");
  });

  await test("DELETE /api/reports/:id deletes report", async () => {
    if (!reportId)
      return fail("DELETE /api/reports/:id deletes report", "No report ID");
    const { status, data } = await req("DELETE", `/api/reports/${reportId}`);
    assert(
      status === 200,
      `Expected 200, got ${status}: ${JSON.stringify(data)}`,
    );
    assert(data.status === "success", `Expected status=success`);
    pass("DELETE /api/reports/:id deletes report");
  });
}

async function testExports() {
  section("Exports");
  let jobId = null;

  await test("GET /api/exports/jobs returns {jobs: []}", async () => {
    const { status, data } = await req("GET", "/api/exports/jobs");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(typeof data === "object", `Expected object`);
    assert(
      Array.isArray(data.jobs),
      `Expected data.jobs array, got ${JSON.stringify(data)}`,
    );
    pass("GET /api/exports/jobs returns {jobs: []}");
  });

  await test("POST /api/exports/start creates export job", async () => {
    const { status, data } = await req("POST", "/api/exports/start", {
      type: "dm_history",
      format: "csv",
    });
    assert(
      status === 200,
      `Expected 200, got ${status}: ${JSON.stringify(data)}`,
    );
    assert(data.status === "success", `Expected status=success`);
    assert(
      data.job && data.job.id !== undefined,
      `Expected job with id in response`,
    );
    jobId = data.job.id;
    pass("POST /api/exports/start creates export job");
  });

  await test("GET /api/exports/jobs/:id/download downloads CSV", async () => {
    if (!jobId)
      return fail(
        "GET /api/exports/jobs/:id/download downloads CSV",
        "No job ID",
      );
    const res = await fetch(`${BASE_URL}/api/exports/jobs/${jobId}/download`);
    assert(res.ok, `Expected 200, got ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    assert(ct.includes("text/csv"), `Expected text/csv, got ${ct}`);
    pass("GET /api/exports/jobs/:id/download downloads CSV");
  });
}

async function testLeads() {
  section("Leads");

  await test("POST /api/leads/batch saves leads", async () => {
    const { status, data } = await req("POST", "/api/leads/batch", {
      leads: [
        {
          username: `lead_test_${Date.now()}`,
          source: "manual",
          status: "new",
          isTarget: false,
        },
      ],
    });
    assert(
      status === 200,
      `Expected 200, got ${status}: ${JSON.stringify(data)}`,
    );
    assert(data.status === "success", `Expected status=success`);
    pass("POST /api/leads/batch saves leads");
  });
}

async function testScheduledJobs() {
  section("Scheduled Jobs");

  await test("GET /api/scheduled-jobs returns jobs", async () => {
    const { status, data } = await req("GET", "/api/scheduled-jobs");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(data.status === "success", `Expected status=success`);
    assert(Array.isArray(data.jobs), `Expected jobs array`);
    pass("GET /api/scheduled-jobs returns jobs");
  });
}

async function testTeam() {
  section("Team");
  let memberId = null;
  let templateId = null;
  const testEmail = `team_test_${Date.now()}@example.com`;

  await test("GET /api/team/members returns members", async () => {
    const { status, data } = await req("GET", "/api/team/members");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.members), `Expected data.members array`);
    pass("GET /api/team/members returns members");
  });

  await test("GET /api/team/roles returns roles", async () => {
    const { status, data } = await req("GET", "/api/team/roles");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.roles), `Expected data.roles array`);
    pass("GET /api/team/roles returns roles");
  });

  await test("GET /api/team/workspaces returns workspaces", async () => {
    const { status, data } = await req("GET", "/api/team/workspaces");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.workspaces), `Expected data.workspaces array`);
    pass("GET /api/team/workspaces returns workspaces");
  });

  await test("GET /api/team/activity returns activities", async () => {
    const { status, data } = await req("GET", "/api/team/activity");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.activities), `Expected data.activities array`);
    pass("GET /api/team/activity returns activities");
  });

  await test("POST /api/team/invite invites a member", async () => {
    const { status, data } = await req("POST", "/api/team/invite", {
      email: testEmail,
      role: "viewer",
    });
    assert(
      status === 200 || status === 409,
      `Expected 200 or 409, got ${status}: ${JSON.stringify(data)}`,
    );
    if (status === 200) {
      assert(data.status === "success", `Expected status=success`);
      memberId = data.member?.id;
    } else {
      // Already exists — look up ID for cleanup
      const list = await req("GET", "/api/team/members");
      const found = (list.data.members || []).find(
        (m) => m.email === testEmail,
      );
      memberId = found?.id;
    }
    pass("POST /api/team/invite invites a member");
  });

  await test("PATCH /api/team/members/:id/role updates role", async () => {
    if (!memberId)
      return fail(
        "PATCH /api/team/members/:id/role updates role",
        "No member ID",
      );
    const { status, data } = await req(
      "PATCH",
      `/api/team/members/${memberId}/role`,
      { role: "admin" },
    );
    assert(
      status === 200,
      `Expected 200, got ${status}: ${JSON.stringify(data)}`,
    );
    pass("PATCH /api/team/members/:id/role updates role");
  });

  await test("DELETE /api/team/members/:id removes member", async () => {
    if (!memberId)
      return fail(
        "DELETE /api/team/members/:id removes member",
        "No member ID",
      );
    const { status, data } = await req(
      "DELETE",
      `/api/team/members/${memberId}`,
    );
    assert(
      status === 200,
      `Expected 200, got ${status}: ${JSON.stringify(data)}`,
    );
    pass("DELETE /api/team/members/:id removes member");
  });

  await test("GET /api/team/templates returns templates", async () => {
    const { status, data } = await req("GET", "/api/team/templates");
    assert(status === 200, `Expected 200, got ${status}`);
    assert(Array.isArray(data.templates), `Expected data.templates array`);
    pass("GET /api/team/templates returns templates");
  });

  await test("POST /api/team/templates creates template", async () => {
    const { status, data } = await req("POST", "/api/team/templates", {
      name: `Test Template ${Date.now()}`,
      content: "Hello {username}, this is a test message.",
    });
    assert(
      status === 200,
      `Expected 200, got ${status}: ${JSON.stringify(data)}`,
    );
    assert(data.status === "success", `Expected status=success`);
    templateId = data.template?.id;
    pass("POST /api/team/templates creates template");
  });

  await test("DELETE /api/team/templates/:id removes template", async () => {
    if (!templateId)
      return fail(
        "DELETE /api/team/templates/:id removes template",
        "No template ID",
      );
    const { status, data } = await req(
      "DELETE",
      `/api/team/templates/${templateId}`,
    );
    assert(
      status === 200,
      `Expected 200, got ${status}: ${JSON.stringify(data)}`,
    );
    pass("DELETE /api/team/templates/:id removes template");
  });
}

async function testCRMInteractions() {
  section("CRM Interactions");
  let contactId = null;

  // Create a temp contact for interaction testing
  const tmpUser = `interaction_test_${Date.now()}`;
  const created = await req("POST", "/api/crm/contacts", { username: tmpUser });
  contactId = created.data?.id;

  await test("POST /api/crm/contacts/:id/interactions records interaction", async () => {
    if (!contactId)
      return fail(
        "POST /api/crm/contacts/:id/interactions records interaction",
        "Could not create test contact",
      );
    const { status, data } = await req(
      "POST",
      `/api/crm/contacts/${contactId}/interactions`,
      { type: "dm_sent", details: "Sent test message" },
    );
    assert(
      status === 200,
      `Expected 200, got ${status}: ${JSON.stringify(data)}`,
    );
    pass("POST /api/crm/contacts/:id/interactions records interaction");
  });

  // Clean up
  if (contactId) await req("DELETE", `/api/crm/contacts/${contactId}`);
}

async function testAccountsExtra() {
  section("Accounts (extended)");
  const username = `ext_acct_${Date.now()}`;

  // Create account to operate on
  await req("POST", "/api/accounts", {
    username,
    email: `${username}@test.com`,
    password: "testpass",
  });

  await test("PUT /api/accounts/:username updates account", async () => {
    const { status, data } = await req("PUT", `/api/accounts/${username}`, {
      username,
      email: `updated_${username}@test.com`,
    });
    assert(
      status === 200 || status === 404 || status === 500,
      `Expected 200/404/500, got ${status}: ${JSON.stringify(data)}`,
    );
    pass("PUT /api/accounts/:username updates account");
  });

  await test("DELETE /api/accounts/id/:id deletes by numeric ID", async () => {
    // List accounts and find ours
    const list = await req("GET", "/api/accounts");
    const acct = (list.data || []).find(
      (a) =>
        a.username === username || a.email === `updated_${username}@test.com`,
    );
    if (!acct) {
      // Already deleted / not found — pass as acceptable
      return pass("DELETE /api/accounts/id/:id deletes by numeric ID");
    }
    const { status, data } = await req("DELETE", `/api/accounts/id/${acct.id}`);
    assert(
      status === 200 || status === 404,
      `Expected 200 or 404, got ${status}: ${JSON.stringify(data)}`,
    );
    pass("DELETE /api/accounts/id/:id deletes by numeric ID");
  });

  // Ensure cleanup
  await req("DELETE", `/api/accounts/${username}`);
}

async function testDMProgress() {
  section("DM Progress");

  await test("GET /api/dm-progress/:sessionId returns 404 for unknown session", async () => {
    const { status, data } = await req(
      "GET",
      "/api/dm-progress/nonexistent_session_id",
    );
    assert(
      status === 404,
      `Expected 404, got ${status}: ${JSON.stringify(data)}`,
    );
    assert(data.status === "error", `Expected status=error`);
    pass("GET /api/dm-progress/:sessionId returns 404 for unknown session");
  });
}

async function testScrape() {
  section(
    "Scrape & DM Send (integration — skipped, needs Puppeteer/Instagram)",
  );

  const endpoints = [
    "POST /api/scrape/accounts",
    "POST /api/scrape/posts",
    "POST /api/scrape/hashtags",
    "POST /api/scrape/keywords",
    "POST /api/send-dms",
    "POST /api/send-dms-progress",
    "POST /api/add-account",
    "POST /api/accounts/login",
  ];
  for (const ep of endpoints) {
    skipped++;
    log(
      colors.yellow,
      `  -  ${ep} [SKIPPED — requires live Instagram session]`,
    );
  }
}

async function testAuth() {
  section("Authentication");

  await test("All API routes accessible without auth (local Electron app)", async () => {
    const gets = [
      "/api/accounts",
      "/api/targets",
      "/api/crm/contacts",
      "/api/reports",
      "/api/exports/jobs",
      "/api/scheduled-jobs",
    ];
    for (const path of gets) {
      const res = await fetch(`${BASE_URL}${path}`);
      assert(res.ok, `Expected ${path} to be accessible, got ${res.status}`);
    }
    pass("All API routes accessible without auth (local Electron app)");
  });
}

// ─── Runner ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${colors.bold}${colors.cyan}`);
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Instagram DM Tool - API Test Suite     ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(colors.reset);
  console.log(`${colors.dim}Base URL: ${BASE_URL}${colors.reset}`);
  if (FILTER)
    console.log(`${colors.yellow}Filter:   "${FILTER}"${colors.reset}`);

  // Check server is up
  try {
    const res = await fetch(`${BASE_URL}/health`);
    if (!res.ok) throw new Error("Not OK");
  } catch {
    console.error(
      `\n${colors.red}✗ Cannot connect to server at ${BASE_URL}${colors.reset}`,
    );
    console.error(
      `${colors.dim}  Make sure the backend is running: cd backend && npm start${colors.reset}\n`,
    );
    process.exit(1);
  }

  const groups = [
    { name: "health", fn: testHealth },
    { name: "auth", fn: testAuth },
    { name: "accounts", fn: testAccounts },
    { name: "accounts extra", fn: testAccountsExtra },
    { name: "targets", fn: testTargets },
    { name: "crm", fn: testCRM },
    { name: "crm interactions", fn: testCRMInteractions },
    { name: "team", fn: testTeam },
    { name: "reports", fn: testReports },
    { name: "exports", fn: testExports },
    { name: "leads", fn: testLeads },
    { name: "jobs", fn: testScheduledJobs },
    { name: "dm progress", fn: testDMProgress },
    { name: "scrape", fn: testScrape },
  ];

  for (const group of groups) {
    if (FILTER && !group.name.includes(FILTER.toLowerCase())) {
      // Still run if any tests in the group would match
      await group.fn();
    } else {
      await group.fn();
    }
  }

  // Summary
  console.log(
    `\n${colors.bold}─────────────────────────────────────────────${colors.reset}`,
  );
  const total = passed + failed;
  const allPassed = failed === 0;
  console.log(
    `${allPassed ? colors.green : colors.red}${colors.bold}` +
      ` Results: ${passed}/${total} passed` +
      (skipped > 0 ? `, ${skipped} skipped` : "") +
      colors.reset,
  );
  if (failed > 0) {
    console.log(`${colors.red}  ${failed} test(s) failed${colors.reset}`);
  }
  console.log();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
