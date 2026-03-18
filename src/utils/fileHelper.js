const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function saveUserData(userId, data) {
  const usersDir = path.join(__dirname, "../..", "data/users");
  ensureDir(usersDir);
  const filePath = path.join(usersDir, `${userId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getUserData(userId) {
  const usersDir = path.join(__dirname, "../..", "data/users");
  const filePath = path.join(usersDir, `${userId}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error("User data not found");
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

module.exports = { saveUserData, getUserData };
