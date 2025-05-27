const fs = require("fs");
const path = require("path");

const TARGETS_FILE = path.join(__dirname, "targets.json");

function loadTargets() {
  if (!fs.existsSync(TARGETS_FILE)) return [];
  return JSON.parse(fs.readFileSync(TARGETS_FILE, "utf-8"));
}

function saveTargets(targets) {
  fs.writeFileSync(TARGETS_FILE, JSON.stringify(targets, null, 2));
}

function addTarget(username) {
  const targets = loadTargets();
  if (!targets.includes(username)) {
    targets.push(username);
    saveTargets(targets);
  }
  return targets;
}

function removeTarget(username) {
  const targets = loadTargets().filter((t) => t !== username);
  saveTargets(targets);
  return targets;
}

module.exports = {
  loadTargets,
  addTarget,
  removeTarget,
};
