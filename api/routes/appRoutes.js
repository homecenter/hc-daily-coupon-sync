"use strict";
var basicAuth = require("express-basic-auth");
module.exports = function (app) {
  var salesforceAction = require("../controllers/salesforceController");
  var m3Action = require("../controllers/m3Controller");
  const creds = new Object();
  creds[process.env.USERNAME] = process.env.PASSWORD;
  //basicAuth
  // todoList Routes

  app.route("/M3TOSalesforce").post(m3Action.sendToSalesforce);
  app
    .use(
      basicAuth({
        users: creds,
      })
    )
    .route("/salesforceTOM3")
    .post(salesforceAction.sendToM3);
};
