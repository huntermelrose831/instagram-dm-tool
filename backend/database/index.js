const db = require("./db");
const crmFunctions = require("./crm");
const messagingFunctions = require("./messaging");
const LeadsService = require("./leads");
const AccountsService = require("./accounts");
const ScrapingService = require("./scraping");
const ProxyService = require("./proxies");
const { RateLimitService } = require("./ratelimits");
const ReportsService = require("./reports");

module.exports = {
  db,
  ...crmFunctions,
  ...messagingFunctions,
  LeadsService,
  AccountsService,
  ScrapingService,
  ProxyService,
  RateLimitService,
  ReportsService,
};
