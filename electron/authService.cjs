/**
 * TurboDM Authentication Service (Electron Main Process)
 *
 * Handles login, verify, logout against https://turbodm.pro/api/desktop/*
 * Stores tokens securely via keytar (OS credential manager).
 * Tracks lastSuccessfulVerify for 72-hour offline grace period.
 */

const keytar = require("keytar");
const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Constants ──────────────────────────────────────────────────────────────
const BASE_URL = "https://turbodm.pro";
const KEYTAR_SERVICE = "TurboDM";
const KEYTAR_ACCOUNT_META = "__meta__"; // stores JSON { email, lastSuccessfulVerify }
const REQUEST_TIMEOUT_MS = 10_000;
const OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000; // 72 hours

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Small promise-based HTTPS JSON requester (no external deps).
 * Returns { status, body } where body is the parsed JSON.
 */
function request(method, urlPath, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);

    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const payload = body ? JSON.stringify(body) : undefined;
    if (payload) headers["Content-Length"] = Buffer.byteLength(payload);

    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method,
        headers,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data || "{}") });
          } catch {
            resolve({ status: res.statusCode, body: {} });
          }
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("NETWORK_TIMEOUT"));
    });
    req.on("error", (err) => reject(err));

    if (payload) req.write(payload);
    req.end();
  });
}

function isNetworkOrServerError(err, status) {
  if (err) return true;
  if (status && status >= 500) return true;
  return false;
}

// ── Persistent metadata (email + lastSuccessfulVerify) ─────────────────────

let _metaCache = null;

async function readMeta() {
  if (_metaCache) return _metaCache;
  try {
    const raw = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_META);
    if (raw) {
      _metaCache = JSON.parse(raw);
      return _metaCache;
    }
  } catch {}
  return {};
}

async function writeMeta(obj) {
  _metaCache = { ...(await readMeta()), ...obj };
  await keytar.setPassword(
    KEYTAR_SERVICE,
    KEYTAR_ACCOUNT_META,
    JSON.stringify(_metaCache),
  );
}

async function clearMeta() {
  _metaCache = null;
  try {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_META);
  } catch {}
}

// ── Token storage ──────────────────────────────────────────────────────────

async function storeToken(email, token) {
  await keytar.setPassword(KEYTAR_SERVICE, email, token);
  await writeMeta({ email, lastSuccessfulVerify: Date.now() });
}

async function getStoredCredentials() {
  const meta = await readMeta();
  if (!meta.email) return null;
  const token = await keytar.getPassword(KEYTAR_SERVICE, meta.email);
  if (!token) return null;
  return {
    email: meta.email,
    token,
    lastSuccessfulVerify: meta.lastSuccessfulVerify || 0,
  };
}

async function deleteStoredCredentials() {
  const meta = await readMeta();
  if (meta.email) {
    try {
      await keytar.deletePassword(KEYTAR_SERVICE, meta.email);
    } catch {}
  }
  await clearMeta();
}

// ── Error-code → user-friendly message mapping ────────────────────────────

const LOGIN_ERROR_MESSAGES = {
  MISSING_CREDENTIALS: "Please enter your email and password.",
  INVALID_CREDENTIALS: "Incorrect email or password.",
  EMAIL_NOT_CONFIRMED: "Please confirm your email address. Check your inbox.",
  NO_PASSWORD_SET:
    "This account uses Google sign-in. Set a password at turbodm.pro first.",
  NO_ACTIVE_SUBSCRIPTION:
    "No active subscription found. Visit turbodm.pro to subscribe.",
  RATE_LIMITED: "Too many attempts. Please wait 15 minutes and try again.",
};

function subscriptionMessage(subscriptionStatus) {
  if (subscriptionStatus === "past_due") {
    return "Payment failed. Visit turbodm.pro to update your billing.";
  }
  return "Your subscription has been canceled. Visit turbodm.pro to resubscribe.";
}

// ── Public API (called via IPC from renderer) ──────────────────────────────

/**
 * Login → POST /api/desktop/login
 * Returns { success, user, error }
 */
async function login(email, password) {
  const os = require("os");
  const machineName = os.hostname();
  try {
    const { status, body } = await request("POST", "/api/desktop/login", {
      body: { email, password, machineName },
    });

    if (status === 200 && body.token) {
      await storeToken(email, body.token);
      return { success: true, user: body.user };
    }

    // Known error codes
    const code = body.code || "";
    const message =
      LOGIN_ERROR_MESSAGES[code] ||
      body.message ||
      "Login failed. Please try again.";
    return { success: false, error: message };
  } catch (err) {
    return {
      success: false,
      error: "Could not reach the server. Check your internet connection.",
    };
  }
}

/**
 * Verify → GET /api/desktop/verify
 * Returns { success, user, error, offline, locked }
 */
async function verify() {
  const creds = await getStoredCredentials();
  if (!creds) return { success: false, locked: true, error: "NO_TOKEN" };

  let networkError = false;
  try {
    const { status, body } = await request("GET", "/api/desktop/verify", {
      token: creds.token,
    });

    if (status === 200 && body.valid) {
      await writeMeta({ lastSuccessfulVerify: Date.now() });
      return { success: true, user: body.user };
    }

    // HTTP 401 — token invalid / user deleted
    if (status === 401) {
      await deleteStoredCredentials();
      return {
        success: false,
        locked: true,
        error: "Session expired. Please sign in again.",
      };
    }

    // HTTP 403 — subscription inactive
    if (status === 403) {
      const subStatus =
        body.subscriptionStatus || body.user?.subscriptionStatus || "canceled";
      await deleteStoredCredentials();
      return {
        success: false,
        locked: true,
        error: subscriptionMessage(subStatus),
      };
    }

    // 5xx → treat as network error (fall through)
    if (status >= 500) {
      networkError = true;
    }
  } catch {
    networkError = true;
  }

  // Network / 5xx → offline grace period
  if (networkError) {
    const elapsed = Date.now() - (creds.lastSuccessfulVerify || 0);
    if (elapsed < OFFLINE_GRACE_MS) {
      return { success: true, offline: true, user: null };
    }
    return {
      success: false,
      locked: true,
      error: "Cannot verify license — please connect to the internet.",
    };
  }

  // Unexpected state
  return { success: false, locked: true, error: "Verification failed." };
}

/**
 * Logout → POST /api/desktop/logout
 */
async function logout() {
  const creds = await getStoredCredentials();
  if (creds) {
    try {
      await request("POST", "/api/desktop/logout", { token: creds.token });
    } catch {
      // Best-effort; clear local creds regardless
    }
  }
  await deleteStoredCredentials();
  return { success: true };
}

/**
 * Check whether we have a stored token (quick sync-ish check for startup).
 */
async function hasStoredToken() {
  const creds = await getStoredCredentials();
  return !!creds;
}

module.exports = {
  login,
  verify,
  logout,
  hasStoredToken,
  getStoredCredentials,
  deleteStoredCredentials,
};
