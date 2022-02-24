"use strict";

var mongoose = require("mongoose"),
  Request = mongoose.model("Requests"),
  ResponseModel = require("../models/ResponseModel"),
  sendController = require("../controllers/SendController"),
  xml = require("x2js");

exports.sendToSalesforce = function (req, res) {
  var x2js = new xml();
  var response = new ResponseModel(); //Object.create(ResponseModel.Response);
  console.log(response);
  //console.log(req);
  const ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  console.log(ip);
  var availableIPs = process.env.M3_IPs.split(",");
  if (!availableIPs.includes(ip)) {
    response.Response.message = "Bad ip";
    res.set("Content-Type", "application/xml");
    res.send(x2js.js2xml(response));
    return;
  }

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
    var requestToSalesforce = buildRequest(req);
    var errors = validateRequest(requestToSalesforce);
    if (errors) {
      response.Response.message = errors;
      res.set("Content-Type", "application/xml");
      res.send(x2js.js2xml(response));
      return;
    }
    requestToSalesforce.save(function (err, requestObject) {
      if (err) {
        response.Response.message = err;
      } else {
        response.Response.success = true;
        response.Response.message = "Job is run";
      }
      res.set("Content-Type", "application/xml");
      res.send(x2js.js2xml(response));
      sendController.runJob(requestObject._id);
    });
    return;
  });
};

var buildRequest = function (req) {
  console.log(req.headers);
  console.log(req.body);
  var x2js = new xml();
  var parsedRequest = x2js.xml2js(req.body);
  console.log(parsedRequest);
  var requestToSalesforce = new Request();

  requestToSalesforce.Direction = "inbound";
  requestToSalesforce.params = {};
  if (
    !!parsedRequest &&
    !!parsedRequest.Envelope &&
    !!parsedRequest.Envelope.Header
  ) {
    if (!!parsedRequest.Envelope.Header.isSandbox) {
      requestToSalesforce.params.isSandbox =
        parsedRequest.Envelope.Header.isSandbox === "true" ? true : false;
    }
    if (!!parsedRequest.Envelope.Header.Endpoint) {
      requestToSalesforce.params.endPoint =
        parsedRequest.Envelope.Header.Endpoint;
    }
    if (!!parsedRequest.Envelope.Header.saveFile) {
      requestToSalesforce.params.saveFile =
        parsedRequest.Envelope.Header.saveFile === "true" ? true : false;
      console.log("==> " + !!parsedRequest.Envelope.Body);
      console.log("==> " + !!parsedRequest.Envelope.Body.OrderNumber);

      if (!!parsedRequest.Envelope.Body) {
        console.log("==> " + !!parsedRequest.Envelope.Body.OrderNumber);
        if (!!parsedRequest.Envelope.Body.OrderNumber) {
          requestToSalesforce.params.OrderNumber =
            parsedRequest.Envelope.Body.OrderNumber;
        }
        if (!!parsedRequest.Envelope.Body.Path) {
          requestToSalesforce.params.Path = parsedRequest.Envelope.Body.Path;
        }
        if (!!parsedRequest.Envelope.Body.FileName) {
          requestToSalesforce.params.FileName =
            parsedRequest.Envelope.Body.FileName;
        }
        requestToSalesforce.Body = JSON.stringify(parsedRequest.Envelope.Body);
      }
    } else {
      var parsedBody = "";
      if (
        !!parsedRequest &&
        !!parsedRequest.Envelope &&
        !!parsedRequest.Envelope.Body
      ) {
        try {
          parsedBody = x2js.js2xml(parsedRequest.Envelope.Body);
        } catch (e) {}
        requestToSalesforce.Body = parsedBody; //req.body;
      }
    }
  }
  return requestToSalesforce;
};

var validateRequest = function (request) {
  console.log(request);
  if (!request.params) {
    return "Request params is not defined!";
  }
  if (request.params.saveFile) {
    if (!request.params.OrderNumber) {
      return "Order number is not defined!";
    }
    if (!request.params.Path) {
      return "Path is not defined!";
    }
    if (!request.params.FileName) {
      return "FileName is not defined!";
    }
  } else {
    if (!request.Body) {
      return "Body is required!";
    }
    if (!request.params.endPoint) {
      return "Endpoint is not defined!";
    }
  }

  return;
};
