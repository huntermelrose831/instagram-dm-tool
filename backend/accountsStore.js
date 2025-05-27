const fs = require("fs");
const path = require("path");

const ACCOUNTS_FILE = path.join(__dirname, "accounts.json");

function loadAccounts() {
  if (!fs.existsSync(ACCOUNTS_FILE)) return [];
  return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf-8"));
}

function saveAccounts(accounts) {
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2));
}

function getAccountByUsername(username) {
  const accounts = loadAccounts();
  return accounts.find((acc) => acc.username === username);
}

function upsertAccount(account) {
  const accounts = loadAccounts();
  const idx = accounts.findIndex((a) => a.username === account.username);
  if (idx >= 0) {
    accounts[idx] = account;
  } else {
    accounts.push(account);
  }
  saveAccounts(accounts);
}

function removeAccount(username) {
  const accounts = loadAccounts().filter((a) => a.username !== username);
  saveAccounts(accounts);
}

module.exports = {
  loadAccounts,
  saveAccounts,
  getAccountByUsername,
  upsertAccount,
  removeAccount,
};
