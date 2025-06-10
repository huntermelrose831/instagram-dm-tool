const db = require("./db");
const crmFunctions = require("./crm");
const messagingFunctions = require("./messaging");
const LeadsService = require("./leads");
const AccountsService = require("./accounts");
const ScrapingService = require("./scraping");
const ProxyService = require("./proxies");
const { AnalyticsService } = require("./analytics");
const { RateLimitService } = require("./ratelimits");

module.exports = {
  db,
  ...crmFunctions,
  ...messagingFunctions,
  LeadsService,
  AccountsService,
  ScrapingService,
  ProxyService,
  AnalyticsService,
  RateLimitService,
};
