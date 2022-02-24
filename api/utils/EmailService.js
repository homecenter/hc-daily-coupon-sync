"use strict";
var nodemailer = require("nodemailer");
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;

exports.sendEmail = function (subject, body) {
  const myOAuth2Client = new OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_SECRET_ID
  );
  myOAuth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });
  const myAccessToken = myOAuth2Client.getAccessToken();
  var transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.GMAIL_EMAIL,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_SECRET_ID,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      myAccessToken: myAccessToken,
    },
  }); /*nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_EMAIL,
      pass: process.env.GMAIL_PASSWORD,
    },
  });*/
  var mailOptions = {
    from: process.env.GMAIL_EMAIL,
    to: process.env.EMAIL_TO_SEND,
    subject: subject,
    text: body,
  };
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log("error => " + error);
      console.log("info => " + info);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
};
