"use strict";

var mongoose = require("mongoose"),
  Request = mongoose.model("Requests"),
  ResponseModel = require("../models/ResponseModel"),
  sendController = require("../controllers/SendController"),
  xml = require("x2js");

exports.sendToM3 = function (req, res) {
  var x2js = new xml();
  var response = new ResponseModel();
  var body = "";
  req.on("data", function (data) {
    body += data;
    // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
    if (body.length > 1e6) {
      // FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST
      req.connection.destroy();
    }
  });

  req.on("end", function () {
    req.body = body;
    var requestToM3 = buildRequest(req);
    var errors = validateRequest(requestToM3);
    if (errors) {
      response.Response.message = errors;
      //res.json(response);

      res.set("Content-Type", "application/xml");
      res.send(x2js.js2xml(response));
      return;
    }
    requestToM3.save(function (err, requestObject) {
      if (err) {
        response.message = err;
      } else {
        response.Response.success = true;
        response.Response.message = "Job is run";
      }
      //res.json(response);
      res.set("Content-Type", "application/xml");
      console.log(response);
      res.send(x2js.js2xml(response));
      sendController.runJob(requestObject._id);
    });
    return;
  });

  // res.json({
  //   success: req.headers,
  //   body: req.body,
  //   ip: req.connection.remoteAddress,
  //   ip2:
  //     (
  //       req.headers["X-Forwarded-For"] ||
  //       req.headers["x-forwarded-for"] ||
  //       ""
  //     ).split(",")[0] || req.client.remoteAddress,
  // });
};

var buildRequest = function (req) {
  console.log(req.headers);
  var requestToSalesforce = new Request();
  requestToSalesforce.Body = req.body;
  requestToSalesforce.Direction = "outbound";
  requestToSalesforce.params = {};
  requestToSalesforce.params.path = req.headers["path"];
  requestToSalesforce.params.filename = req.headers["filename"];
  return requestToSalesforce;
};

var validateRequest = function (request) {
  if (!request.Body) {
    return "Body is required!";
  }
  if (!request.params) {
    return "Request params is not defined!";
  }
  if (!request.params.path) {
    return "Path is not defined!";
  }
  if (!request.params.filename) {
    return "File Name is not defined!";
  }
  return;
};
