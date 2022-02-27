var express = require("express"),
  app = express(),
  port = process.env.PORT || 3000,
  mongoose = require("mongoose"),
  Request = require("./api/models/requestModel"), //created model loading here
  bodyParser = require("body-parser"),
  dotenv = require("dotenv");
// authS = require("./api/utils/SalesForceAuth");
console.log(`Your port is ${process.env.PORT}`);

dotenv.config();
console.log(`Your client_id_prod is ${process.env.client_id_prod}`);
// mongoose instance connection url connection
mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost/ProxyServer");
const credentials = new Object();
credentials[process.env.USERNAME] = process.env.PASSWORD;
// app.use(
//   basicAuth({
//     users: credentials,
//   })
// );
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var routes = require("./api/routes/appRoutes"); //importing routed
routes(app); //register the route
app.use(function (req, res) {
  res.status(404).send({ error: req.originalUrl + " not found" });
});
app.listen(port);

console.log("Proxy Server: RESTful API server started on: " + port);
