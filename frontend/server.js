var express = require("express");
var path = require("path");
var app = express();
var PORT = process.env.PORT || 3000;
var API_URL = process.env.API_URL || "http://localhost:3001";

app.use(express.json());

app.use("/api", function(req, res) {
  var url = API_URL + req.originalUrl;
  var headers = { "Content-Type": "application/json" };
  if (req.headers.authorization) headers["Authorization"] = req.headers.authorization;
  var opts = { method: req.method, headers: headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    opts.body = JSON.stringify(req.body || {});
  }
  fetch(url, opts)
    .then(function(r) { res.status(r.status); return r.text(); })
    .then(function(body) { try { res.json(JSON.parse(body)); } catch(e) { res.send(body); } })
    .catch(function(err) { res.status(502).json({ error: "Backend unavailable" }); });
});

app.use(express.static(path.join(__dirname, "build")));
app.get("*", function(req, res) {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.listen(PORT, function() {
  console.log("Frontend port " + PORT + " -> API: " + API_URL);
});
