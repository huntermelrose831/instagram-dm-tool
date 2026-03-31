const express = require("express");
const router = express.Router();
const logger = require("../utils/logger");
const { AccountsService } = require("../database");

// GET /api/accounts
router.get("/", async (req, res) => {
  try {
    let accounts = (await AccountsService.getAccounts()) || [];
    accounts = accounts.map((acc) => {
      let parsedCookies = null;
      if (acc.cookies) {
        try {
          parsedCookies =
            typeof acc.cookies === "string"
              ? JSON.parse(acc.cookies)
              : acc.cookies;
        } catch {
          parsedCookies = null;
        }
      }
      return {
        ...acc,
        email: acc.email || acc.username,
        cookies: parsedCookies,
      };
    });
    res.json(accounts);
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// POST /api/accounts
router.post("/", async (req, res) => {
  try {
    const { username, email, password, proxy } = req.body;
    const accountData = {
      username,
      email,
      passwordHash: password,
      proxyId: proxy ? parseInt(proxy) : null,
      isActive: true,
    };
    const account = await AccountsService.addAccount(accountData);
    res.json({
      status: "success",
      message: "Account created successfully",
      account,
    });
  } catch (error) {
    if (error.code === "DUPLICATE") {
      return res.status(409).json({ status: "error", message: error.message });
    }
    res.status(500).json({ status: "error", message: error.message });
  }
});

// POST /api/accounts/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res
        .status(400)
        .json({
          status: "error",
          message: "Username and password are required",
        });
    }
    const account = await AccountsService.getAccountByUsername(username);
    if (!account) {
      return res.status(404).json({
        status: "error",
        message: "Account not found. Please add the account first.",
      });
    }
    const { loginAndSaveCookies } = require("../login");
    const result = await loginAndSaveCookies(username, password);
    if (result.success) {
      res.json({
        status: "success",
        message: "Successfully logged in and saved cookies",
      });
    } else {
      res
        .status(500)
        .json({
          status: "error",
          message: "Login failed — check your credentials",
        });
    }
  } catch (error) {
    res
      .status(500)
      .json({
        status: "error",
        message: error.message || "Login process failed",
      });
  }
});

// PUT /api/accounts/:username
router.put("/:username", async (req, res) => {
  try {
    const { username: originalUsername } = req.params;
    const updates = req.body;
    const account =
      AccountsService.getAccountByUsernameOrEmail(originalUsername);
    if (!account) {
      return res
        .status(404)
        .json({ status: "error", message: "Account not found" });
    }
    const updatedAccountData = {
      ...account,
      username: updates.username || account.username,
      email: updates.email !== undefined ? updates.email : account.email,
      passwordHash:
        updates.password !== undefined
          ? updates.password
          : account.passwordHash,
      proxyId: updates.proxy ? parseInt(updates.proxy) : account.proxyId,
      isActive:
        updates.isActive !== undefined ? updates.isActive : account.isActive,
    };
    if (updatedAccountData.username !== account.username) {
      AccountsService.deleteAccount(account.username);
    }
    const updatedAccount = AccountsService.upsertAccount(updatedAccountData);
    res.json({
      status: "success",
      message: "Account updated successfully",
      account: updatedAccount,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// DELETE /api/accounts/id/:id  (must be before /:username)
router.delete("/id/:id", async (req, res) => {
  try {
    const accountId = parseInt(req.params.id);
    const accounts = await AccountsService.getAccounts();
    const target = accounts.find((a) => a.id === accountId);
    if (!target) {
      return res
        .status(404)
        .json({ status: "error", message: "Account not found" });
    }
    const success = AccountsService.deleteAccount(target.username);
    if (success) {
      res.json({ status: "success", message: "Account deleted successfully" });
    } else {
      res.status(404).json({ status: "error", message: "Account not found" });
    }
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// DELETE /api/accounts/:username
router.delete("/:username", async (req, res) => {
  try {
    const success = AccountsService.deleteAccount(req.params.username);
    if (success) {
      res.json({ status: "success", message: "Account deleted successfully" });
    } else {
      res.status(404).json({ status: "error", message: "Account not found" });
    }
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

module.exports = router;
