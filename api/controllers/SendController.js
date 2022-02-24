"use strict";

var mongoose = require("mongoose"),
  Request = mongoose.model("Requests"),
  authS = require("../utils/SalesForceAuth"),
  axios = require("axios"),
  emailService = require("../utils/EmailService"),
  fs = require("fs-extra"),
  clientSFTP = require("../utils/ftpUtil/connection"); //require("socksftp");
const httpproxyurl = process.env.QUOTAGUARDSTATIC_URL;
exports.runJob = (requestId) => {
  Request.findById(requestId, function (err, requestObject) {
    if (err) console.log(err);
    //console.log(requestObject);

    if (requestObject.Direction.includes("inbound")) {
      sendToSalesForce(requestObject);
    }
    if (requestObject.Direction.includes("outbound")) {
      console.log("run");
      saveFileInM3(requestObject);
    }
  });
};

var sendToSalesForce = function (requestObject) {
  console.log(requestObject);
  try {
    authS
      .login(requestObject.params.isSandbox)
      .then((response) => {
        if (requestObject.params.saveFile) {
          saveFile(requestObject);
        } else {
          saveOrder(requestObject);
        }
      })
      .catch((error) => {
        console.log(error);
        if (error.response && error.response.status >= 500) {
          sendToSalesForce(requestObject);
        } else {
          emailService.sendEmail(
            "Cannot Login To Salesforce",
            JSON.stringify(error) +
              "\n Request :\n " +
              JSON.stringify(requestObject)
          );
          removeRequest(requestObject);
        }
      });
  } catch (e) {
    sendToSalesForce(requestObject);
  }
};

var saveFileInM3 = function (requestObject, attempts) {
  console.log(requestObject);
  try {
    if (!attempts) attempts = 1;
    const localFolder = "temp/" + makeid(10);
    const localPath = localFolder + "/" + requestObject.params.filename;
    fs.outputFile(localPath, requestObject.Body, (err) => {
      if (err) {
        emailService.sendEmail(
          "Cannot create file locally",
          JSON.stringify(error) +
            "\n Request :\n " +
            JSON.stringify(requestObject)
        );
        removeRequest(requestObject);
        return;
      } else {
        fs.readFile(localPath, "utf8", function (err, data) {
          if (err) console.log(err);
          console.log(data);
        });
      }
      var socksproxyurl = httpproxyurl.replace(":9293", ":1080");
      var server = {
        host: process.env.FTP_HOSTNAME,
        user: process.env.FTP_USERNAME,
        password: process.env.FTP_PASSWORD,
        port: 21,
        socksproxy: socksproxyurl,
      };
      var c = new clientSFTP();
      c.on("ready", function () {
        c.put(
          localPath,
          requestObject.params.path + "/" + requestObject.params.filename,
          (err, res) => {
            if (err) {
              removeFile(localFolder);
              removeRequest(requestObject);
              c.end();
              console.log(err.code);
              emailService.sendEmail(
                "Cannot save file in ftp",
                JSON.stringify(err) +
                  "\n Request :\n " +
                  JSON.stringify(requestObject)
              );
            } else {
              removeFile(localFolder);
              removeRequest(requestObject);
              c.end();
              console.log(res);
            }
          }
        );
      });
      c.on("error", function (err) {
        console.error("socksftp error: " + err);
        removeFile(localPath);
        removeRequest(requestObject);
        c.end();
        console.log(err.code);
        emailService.sendEmail(
          "Problems with ftp connection",
          JSON.stringify(err) +
            "\n Request :\n " +
            JSON.stringify(requestObject)
        );
        return;
      });
      c.connect(server, (e) => {
        console.log(e);
        if (attempts < 6) {
          console.log("attempts ===>> " + attempts);
          saveFileInM3(requestObject, ++attempts);
        } else {
          removeRequest(requestObject);
          c.end();
          emailService.sendEmail(
            "Problems with ftp connection",
            JSON.stringify(e) +
              "\n Request :\n " +
              JSON.stringify(requestObject)
          );
        }
      });
    });
  } catch (e) {
    console.log("eeerr2r");
  }
  return;
};

var removeRequest = function (requestObject) {
  try {
    Request.remove({ _id: requestObject._id }, function (err, task) {
      if (err) console.log(err);
      console.log("Done!!");
    });
  } catch (e) {}
};
var getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};
var makeid = (length) => {
  var result = "";
  var characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

var removeFile = (path) => {
  fs.remove(path);
};

var saveOrder = (requestObject) => {
  var authObject = authS.getOAuthObject(
    requestObject.params.isSandbox ? "sandbox" : "prod"
  );
  axios
    .post(
      authObject.instance_url + requestObject.params.endPoint,
      '<?xml version="1.0" encoding="UTF-8"?><request>' +
        requestObject.Body +
        "</request>",
      {
        headers: {
          Authorization: "Bearer " + authObject.access_token,
          "Content-Type": "application/xml",
          Accept: "application/xml",
        },
      }
    )
    .then((response) => {
      console.log(response.data);
      removeRequest(requestObject);
    })
    .catch((error) => {
      console.log(error);
      if (error.response && error.response.status >= 500) {
        sendToSalesForce(requestObject);
      } else {
        console.log(
          "response ===> " +
            JSON.stringify(error.response, getCircularReplacer())
        );
        emailService.sendEmail(
          "Cannot send request To Salesforce",
          JSON.stringify(error) +
            "\n Request :\n " +
            JSON.stringify(requestObject)
        );
        removeRequest(requestObject);
      }
    });
};

var saveFile = (requestObject, attempts) => {
  try {
    if (!attempts) attempts = 1;
    var socksproxyurl = httpproxyurl.replace(":9293", ":1080");
    var server = {
      host: process.env.FTP_HOSTNAME,
      user: process.env.FTP_USERNAME,
      password: process.env.FTP_PASSWORD,
      port: 21,
      socksproxy: socksproxyurl,
    };
    var path = requestObject.params.Path;
    var filename = requestObject.params.FileName;
    console.log(path + "/" + filename);
    var c = new clientSFTP();
    c.on("ready", function () {
      c.get(path + "/" + filename, (err, fileStream) => {
        if (err) {
          //removeFile(localFolder);
          removeRequest(requestObject);
          c.end();
          console.log(err.code);
          emailService.sendEmail(
            "Cannot get file from ftp",
            JSON.stringify(err) +
              "\n Request :\n " +
              JSON.stringify(requestObject)
          );
        } else {
          var content = new Buffer(0);

          fileStream.on("data", (chunk) => {
            content = Buffer.concat([content, chunk]);
          });
          fileStream.on("end", () => {
            console.log("content : " + content.toString("base64"));
            var authObject = authS.getOAuthObject(
              requestObject.params.isSandbox ? "sandbox" : "prod"
            );
            console.log(authObject.access_token);
            let url =
              authObject.instance_url +
              "/services/data/v20.0/query/?q=SELECT+ID+FROM+HC_Order__c+WHERE+Order_Number__c+='" +
              requestObject.params.OrderNumber +
              "'";
            axios
              .get(url, {
                headers: {
                  Authorization: "Bearer " + authObject.access_token,
                  "Content-Type": "application/json",
                },
              })
              .then((response) => {
                console.log("Order Id == " + response.data);
                let orderId = response.data.records[0].Id;
                let requestBody = {};
                requestBody.VersionData = content.toString("base64");
                requestBody.Title =
                  "Order - " + requestObject.params.OrderNumber;
                requestBody.PathOnClient = filename;
                requestBody.FirstPublishLocationId = orderId;
                axios
                  .post(
                    authObject.instance_url +
                      "/services/data/v23.0/sobjects/ContentVersion",
                    requestBody,
                    {
                      headers: {
                        Authorization: "Bearer " + authObject.access_token,
                        "Content-Type": "application/json",
                      },
                    }
                  )
                  .then((response) => {
                    console.log("data == " + response.data);
                    removeRequest(requestObject);
                    c.end();
                  })
                  .catch((error) => {
                    removeRequest(requestObject);
                    c.end();
                    console.log(error);
                    emailService.sendEmail(
                      "Problems with save file",
                      error + "\n Request :\n " + JSON.stringify(requestObject)
                    );
                  });
              })
              .catch((error) => {
                removeRequest(requestObject);
                c.end();
                console.log(error);
                emailService.sendEmail(
                  "Problems with obtain order",
                  error + "\n Request :\n " + JSON.stringify(requestObject)
                );
              });
          });
        }
      });
    });
    c.on("error", function (err) {
      console.error("socksftp error: " + err);
      //removeFile(localPath);
      removeRequest(requestObject);
      c.end();
      console.log(err.code);
      emailService.sendEmail(
        "Problems with ftp connection",
        JSON.stringify(err) + "\n Request :\n " + JSON.stringify(requestObject)
      );
      return;
    });
    c.connect(server, (e) => {
      console.log(e);
      if (attempts < 6) {
        console.log("attempts ===>> " + attempts);
        saveFile(requestObject);
      } else {
        removeRequest(requestObject);
        c.end();
        emailService.sendEmail(
          "Problems with ftp connection",
          JSON.stringify(e) + "\n Request :\n " + JSON.stringify(requestObject)
        );
      }
    });
  } catch (e) {
    console.log("eeerrr2");
  }
};
