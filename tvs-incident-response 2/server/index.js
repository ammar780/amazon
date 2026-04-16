require("dotenv").config();
var express = require("express");
var cors = require("cors");
var helmet = require("helmet");
var path = require("path");
var cron = require("node-cron");
var migrate = require("./db/migrate");
var pool = require("./db/pool");

var app = express();
var PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// API routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api", require("./routes/api"));

// Health check
app.get("/api/health", function (req, res) {
  res.json({
    status: "operational",
    service: "TVS Incident Response System",
    version: "2.0.0",
    timestamp: new Date().toISOString(),
  });
});

// Serve React frontend
var clientBuild = path.join(__dirname, "..", "client", "build");
app.use(express.static(clientBuild));
app.get("*", function (req, res) {
  res.sendFile(path.join(clientBuild, "index.html"));
});

// Cron: check overdue notifications every 15 min
cron.schedule("*/15 * * * *", async function () {
  try {
    var r = await pool.query(
      "SELECT incident_id, title FROM incidents WHERE involves_amazon_data = true " +
        "AND amazon_notified_at IS NULL AND amazon_notification_deadline < NOW() " +
        "AND status NOT IN ('resolved','closed')"
    );
    if (r.rows.length > 0) {
      console.log(r.rows.length + " incident(s) with OVERDUE Amazon notifications!");
    }
  } catch (e) { /* silent */ }
});

// Start
async function start() {
  try {
    await migrate();
    app.listen(PORT, function () {
      console.log("");
      console.log("TVS Incident Response System v2.0");
      console.log("Port: " + PORT);
      console.log("Env:  " + (process.env.NODE_ENV || "development"));
      console.log("");
    });
  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
}

start();
