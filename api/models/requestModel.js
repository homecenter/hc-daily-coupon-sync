"use strict";
var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var RequestSchema = new Schema({
  Body: {
    type: String,
    required: "Body is required",
  },
  Created_date: {
    type: Date,
    default: Date.now,
  },
  Direction: {
    type: [
      {
        type: String,
        enum: ["inbound", "outbound"],
      },
    ],
    required: "Direction is required",
  },
  params: Object,
});

module.exports = mongoose.model("Requests", RequestSchema);
