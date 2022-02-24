"use strict";
const axios = require("axios");
var mappings = {};
exports.login = (isSandbox) => {
  let loginUrl = "";
  if (isSandbox) {
    loginUrl =
      `${process.env.SALESFORCEURL_SANDBOX}/services/oauth2/token?grant_type=password` +
      `&client_id=${process.env.CLIENT_ID_SANDBOX}` +
      `&client_secret=${process.env.CLIENT_SECRET_SANDBOX}` +
      `&username=${process.env.USERNAME_SANDBOX}` +
      `&password=${process.env.PASSWORD_SANDBOX}`;
  } else {
    loginUrl =
      `${process.env.SALESFORCEURL_PROD}/services/oauth2/token?grant_type=password` +
      `&client_id=${process.env.CLIENT_ID_PROD}` +
      `&client_secret=${process.env.CLIENT_SECRET_PROD}` +
      `&username=${process.env.USERNAME_PROD}` +
      `&password=${process.env.PASSWORD_PROD}`;
  }
  console.log(loginUrl);
  return new Promise((resolve, reject) => {
    console.log(loginUrl);
    axios
      .post(
        loginUrl, //"https://login.salesforce.com/services/oauth2/token?grant_type=password&client_id=3MVG9oNqAtcJCF.H7GH652oKyDzxdandS3RQNbYJabGLNecWSmhfusLr5U3rn2lgEbUBzPV7NOx37odJLQFvC&client_secret=72780B0B050A92BA222878335C2ABEAD78DE340F09A7B14E5D905F2D54B41A79&username=zhutenko_trailhead@synebo.io&password=Synebo2020dqf75fANDv8dXTL6BNac9GAvb",
        {}
      )
      .then((res) => {
        console.log(`Status: ${res.status}`);
        //console.log("Body: ", res.data);
        mappings[isSandbox ? "sandbox" : "prod"] = res.data;
        resolve("result");
      })
      .catch((err) => {
        //console.error(err);
        reject(err);
      });
  });
};

exports.getOAuthObject = (envirement) => mappings[envirement];
