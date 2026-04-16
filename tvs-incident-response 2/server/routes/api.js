var express = require("express");
var pool = require("../db/pool");
var auth = require("../middleware/auth");
var emailUtil = require("../utils/email");
var tlsUtil = require("../utils/tls");
var router = express.Router();

// Helper: generate incident ID
function genId() {
  var d = new Date();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  var r = Math.random().toString(36).substring(2, 6).toUpperCase();
  return "INC-" + d.getFullYear() + m + day + "-" + r;
}

// Helper: log activity
async function logActivity(action, category, details, userName) {
  try {
    await pool.query(
      "INSERT INTO activity_log (action, category, details, user_name) VALUES ($1,$2,$3,$4)",
      [action, category, details, userName || "System"]
    );
  } catch (e) {
    console.error("Activity log error:", e.message);
  }
}

// ==============================================
// DASHBOARD STATS
// ==============================================
router.get("/stats", auth, async function (req, res) {
  try {
    var totalR = await pool.query("SELECT COUNT(*) FROM incidents");
    var openR = await pool.query(
      "SELECT COUNT(*) FROM incidents WHERE status NOT IN ('resolved','closed')"
    );
    var amazonR = await pool.query(
      "SELECT COUNT(*) FROM incidents WHERE involves_amazon_data = true"
    );
    var overdueR = await pool.query(
      "SELECT COUNT(*) FROM incidents WHERE involves_amazon_data = true AND amazon_notified_at IS NULL AND amazon_notification_deadline < NOW() AND status NOT IN ('resolved','closed')"
    );
    var notifiedR = await pool.query(
      "SELECT COUNT(*) FROM incidents WHERE notification_sent = true"
    );
    var compR = await pool.query(
      "SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_met = true) as met FROM compliance_items"
    );
    var teamR = await pool.query(
      "SELECT COUNT(*) FROM team_members WHERE is_active = true"
    );
    var reviewR = await pool.query(
      "SELECT next_review_date FROM plan_reviews ORDER BY review_date DESC LIMIT 1"
    );
    var auditR = await pool.query(
      "SELECT COUNT(*) FILTER (WHERE is_compliant = true) as pass, COUNT(*) as total FROM encryption_audits WHERE audited_at > NOW() - INTERVAL '90 days'"
    );
    var activityR = await pool.query(
      "SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10"
    );

    var c = compR.rows[0];
    var a = auditR.rows[0];
    var met = parseInt(c.met) || 0;
    var total = parseInt(c.total) || 0;

    res.json({
      incidents: {
        total: parseInt(totalR.rows[0].count),
        open: parseInt(openR.rows[0].count),
        amazon: parseInt(amazonR.rows[0].count),
        overdue: parseInt(overdueR.rows[0].count),
        notified: parseInt(notifiedR.rows[0].count),
      },
      compliance: {
        met: met,
        total: total,
        score: total > 0 ? Math.round((met / total) * 100) : 0,
      },
      team: { count: parseInt(teamR.rows[0].count) },
      nextReview: reviewR.rows.length > 0 ? reviewR.rows[0].next_review_date : null,
      encryption: {
        pass: parseInt(a.pass) || 0,
        total: parseInt(a.total) || 0,
      },
      activity: activityR.rows,
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// INCIDENTS
// ==============================================
router.get("/incidents", auth, async function (req, res) {
  try {
    var r = await pool.query(
      "SELECT i.*, t1.name as commander_name, t2.name as security_lead_name, t3.name as reported_by_name " +
        "FROM incidents i " +
        "LEFT JOIN team_members t1 ON i.incident_commander = t1.id " +
        "LEFT JOIN team_members t2 ON i.security_lead = t2.id " +
        "LEFT JOIN team_members t3 ON i.reported_by = t3.id " +
        "ORDER BY i.detected_at DESC"
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/incidents/:id", auth, async function (req, res) {
  try {
    var incR = await pool.query(
      "SELECT i.*, t1.name as commander_name, t2.name as security_lead_name, " +
        "t3.name as reported_by_name, t4.name as comms_lead_name " +
        "FROM incidents i " +
        "LEFT JOIN team_members t1 ON i.incident_commander = t1.id " +
        "LEFT JOIN team_members t2 ON i.security_lead = t2.id " +
        "LEFT JOIN team_members t3 ON i.reported_by = t3.id " +
        "LEFT JOIN team_members t4 ON i.communications_lead = t4.id " +
        "WHERE i.id = $1",
      [req.params.id]
    );
    if (incR.rows.length === 0) return res.status(404).json({ error: "Not found" });

    var timelineR = await pool.query(
      "SELECT it.*, tm.name as by_name FROM incident_timeline it " +
        "LEFT JOIN team_members tm ON it.performed_by = tm.id " +
        "WHERE it.incident_id = $1 ORDER BY it.created_at ASC",
      [req.params.id]
    );
    var notifsR = await pool.query(
      "SELECT * FROM amazon_notifications WHERE incident_id = $1 ORDER BY sent_at DESC",
      [req.params.id]
    );

    var result = incR.rows[0];
    result.timeline = timelineR.rows;
    result.notifications = notifsR.rows;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/incidents", auth, async function (req, res) {
  try {
    var b = req.body;
    var iid = genId();
    var now = new Date();
    var deadline = b.involves_amazon_data ? new Date(now.getTime() + 24 * 3600000) : null;

    var r = await pool.query(
      "INSERT INTO incidents (incident_id, title, description, severity, involves_amazon_data, " +
        "amazon_data_types, affected_systems, detection_method, detected_at, amazon_notification_deadline, " +
        "reported_by, incident_commander, security_lead, communications_lead) " +
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *",
      [
        iid, b.title, b.description, b.severity || "medium",
        b.involves_amazon_data || false, b.amazon_data_types || null,
        b.affected_systems || null, b.detection_method || null,
        now, deadline,
        b.reported_by || null, b.incident_commander || null,
        b.security_lead || null, b.communications_lead || null,
      ]
    );

    await pool.query(
      "INSERT INTO incident_timeline (incident_id, phase, action, details) VALUES ($1,$2,$3,$4)",
      [r.rows[0].id, "detection", "Incident Created",
        "Severity: " + (b.severity || "medium") + " | Amazon data: " + (b.involves_amazon_data ? "YES" : "NO")]
    );

    await logActivity("Incident Created", "incident", iid + ": " + b.title, req.user.name);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    console.error("Create incident error:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put("/incidents/:id", auth, async function (req, res) {
  try {
    var b = req.body;
    var r = await pool.query(
      "UPDATE incidents SET title=COALESCE($2,title), description=COALESCE($3,description), " +
        "severity=COALESCE($4,severity), involves_amazon_data=COALESCE($5,involves_amazon_data), " +
        "amazon_data_types=COALESCE($6,amazon_data_types), affected_systems=COALESCE($7,affected_systems), " +
        "root_cause=COALESCE($8,root_cause), containment_actions=COALESCE($9,containment_actions), " +
        "eradication_actions=COALESCE($10,eradication_actions), recovery_actions=COALESCE($11,recovery_actions), " +
        "lessons_learned=COALESCE($12,lessons_learned), updated_at=NOW() WHERE id=$1 RETURNING *",
      [
        req.params.id, b.title, b.description, b.severity,
        b.involves_amazon_data, b.amazon_data_types, b.affected_systems,
        b.root_cause, b.containment_actions, b.eradication_actions,
        b.recovery_actions, b.lessons_learned,
      ]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/incidents/:id/phase", auth, async function (req, res) {
  try {
    var phase = req.body.phase;
    var notes = req.body.notes || "";
    var statusMap = {
      containment: "contained",
      eradication: "eradicated",
      recovery: "recovering",
      resolved: "resolved",
      closed: "closed",
    };

    var newStatus = statusMap[phase];
    if (!newStatus) return res.status(400).json({ error: "Invalid phase" });

    var timeField = "";
    if (phase === "containment") timeField = ", contained_at=NOW()";
    if (phase === "eradication") timeField = ", eradicated_at=NOW()";
    if (phase === "resolved") timeField = ", resolved_at=NOW()";
    if (phase === "closed") timeField = ", closed_at=NOW()";

    var r = await pool.query(
      "UPDATE incidents SET phase=$2, status=$3, updated_at=NOW()" +
        timeField +
        " WHERE id=$1 RETURNING *",
      [req.params.id, phase, newStatus]
    );

    await pool.query(
      "INSERT INTO incident_timeline (incident_id, phase, action, details) VALUES ($1,$2,$3,$4)",
      [req.params.id, phase, "Phase changed to: " + phase, notes || "Moved to " + phase]
    );

    await logActivity("Phase: " + phase, "incident", r.rows[0].incident_id, req.user.name);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/incidents/:id/timeline", auth, async function (req, res) {
  try {
    var b = req.body;
    var r = await pool.query(
      "INSERT INTO incident_timeline (incident_id, phase, action, details, performed_by) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [req.params.id, b.phase || null, b.action, b.details || null, b.performed_by || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === AMAZON NOTIFICATION ===
router.post("/incidents/:id/notify", auth, async function (req, res) {
  try {
    var incR = await pool.query("SELECT * FROM incidents WHERE id = $1", [req.params.id]);
    if (incR.rows.length === 0) return res.status(404).json({ error: "Not found" });

    var type = req.body.type || "initial";
    var result = await emailUtil.sendAmazonNotification(incR.rows[0], type);

    await pool.query(
      "INSERT INTO amazon_notifications (incident_id, notification_type, sent_to, subject, body, delivery_status) " +
        "VALUES ($1,$2,$3,$4,$5,$6)",
      [req.params.id, type, result.to, result.subject, result.body, result.sent ? "delivered" : "logged"]
    );

    await pool.query(
      "UPDATE incidents SET amazon_notified_at=NOW(), notification_sent=$2, updated_at=NOW() WHERE id=$1",
      [req.params.id, result.sent]
    );

    await pool.query(
      "INSERT INTO incident_timeline (incident_id, phase, action, details) VALUES ($1,$2,$3,$4)",
      [req.params.id, "notification", "Amazon Notified",
        result.sent ? "Email sent to " + result.to : "Notification logged (SMTP: " + result.reason + ")"]
    );

    await logActivity("Amazon Notification", "incident", incR.rows[0].incident_id, req.user.name);
    res.json(result);
  } catch (err) {
    console.error("Notify error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// TEAM (IRT ROLES)
// ==============================================
router.get("/team", auth, async function (req, res) {
  try {
    var r = await pool.query(
      "SELECT * FROM team_members WHERE is_active = true ORDER BY irt_role, name"
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/team", auth, async function (req, res) {
  try {
    var b = req.body;
    var r = await pool.query(
      "INSERT INTO team_members (name, email, irt_role, job_title, phone, responsibilities) " +
        "VALUES ($1,$2,$3,$4,$5,$6) RETURNING *",
      [b.name, b.email, b.irt_role, b.job_title || null, b.phone || null, b.responsibilities || null]
    );
    await logActivity("Team Member Added", "team", b.name + " as " + b.irt_role, req.user.name);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    if (err.code === "23505") return res.status(400).json({ error: "Email already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.put("/team/:id", auth, async function (req, res) {
  try {
    var b = req.body;
    var r = await pool.query(
      "UPDATE team_members SET name=COALESCE($2,name), email=COALESCE($3,email), " +
        "irt_role=COALESCE($4,irt_role), job_title=COALESCE($5,job_title), " +
        "phone=COALESCE($6,phone), responsibilities=COALESCE($7,responsibilities), " +
        "updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id, b.name, b.email, b.irt_role, b.job_title, b.phone, b.responsibilities]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/team/:id", auth, async function (req, res) {
  try {
    await pool.query(
      "UPDATE team_members SET is_active = false, updated_at = NOW() WHERE id = $1",
      [req.params.id]
    );
    await logActivity("Team Member Removed", "team", "ID: " + req.params.id, req.user.name);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// ENCRYPTION AUDITS
// ==============================================
router.get("/audits", auth, async function (req, res) {
  try {
    var r = await pool.query(
      "SELECT * FROM encryption_audits ORDER BY audited_at DESC LIMIT 100"
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/audits/scan", auth, async function (req, res) {
  try {
    var hostname = (req.body.hostname || "").replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
    if (!hostname) return res.status(400).json({ error: "Hostname required" });

    var result = await tlsUtil.auditEndpoint(hostname);

    await pool.query(
      "INSERT INTO encryption_audits (endpoint, tls_version, cipher_suite, cipher_bits, " +
        "certificate_issuer, certificate_subject, certificate_expiry, is_compliant, issues, audited_by) " +
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        result.endpoint, result.tls_version, result.cipher_suite, result.cipher_bits,
        result.certificate_issuer, result.certificate_subject, result.certificate_expiry,
        result.is_compliant, result.issues, req.user.name,
      ]
    );

    await logActivity("TLS Scan", "audit", result.endpoint + ": " + (result.is_compliant ? "PASS" : "FAIL"), req.user.name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/audits/scan-all", auth, async function (req, res) {
  try {
    var endpoints = req.body.endpoints || [
      process.env.ORG_DOMAIN || "thevitaminshots.com",
      "sellingpartnerapi-na.amazon.com",
    ];
    var results = [];

    for (var i = 0; i < endpoints.length; i++) {
      var clean = endpoints[i].replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
      var r = await tlsUtil.auditEndpoint(clean);
      await pool.query(
        "INSERT INTO encryption_audits (endpoint, tls_version, cipher_suite, cipher_bits, " +
          "certificate_issuer, certificate_subject, certificate_expiry, is_compliant, issues, audited_by) " +
          "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          r.endpoint, r.tls_version, r.cipher_suite, r.cipher_bits,
          r.certificate_issuer, r.certificate_subject, r.certificate_expiry,
          r.is_compliant, r.issues, req.user.name,
        ]
      );
      results.push(r);
    }

    await logActivity("Full TLS Audit", "audit", results.length + " endpoints scanned", req.user.name);
    var allPass = true;
    for (var j = 0; j < results.length; j++) {
      if (!results[j].is_compliant) { allPass = false; break; }
    }
    res.json({ results: results, all_compliant: allPass });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// PLAN REVIEWS
// ==============================================
router.get("/reviews", auth, async function (req, res) {
  try {
    var r = await pool.query("SELECT * FROM plan_reviews ORDER BY review_date DESC");
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/reviews", auth, async function (req, res) {
  try {
    var b = req.body;
    var reviewDate = new Date();
    var nextDate = new Date(reviewDate);
    nextDate.setMonth(nextDate.getMonth() + 6);

    var r = await pool.query(
      "INSERT INTO plan_reviews (review_date, next_review_date, plan_version, reviewer_name, " +
        "approver_name, changes_summary, roles_current, encryption_verified, notification_tested, " +
        "amazon_policy_checked, incidents_reviewed, training_completed, sign_off_notes) " +
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *",
      [
        reviewDate, nextDate, b.plan_version, b.reviewer_name, b.approver_name,
        b.changes_summary, b.roles_current || false, b.encryption_verified || false,
        b.notification_tested || false, b.amazon_policy_checked || false,
        b.incidents_reviewed || false, b.training_completed || false, b.sign_off_notes,
      ]
    );
    await logActivity("Plan Review", "review", "Version " + b.plan_version, req.user.name);
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// COMPLIANCE
// ==============================================
router.get("/compliance", auth, async function (req, res) {
  try {
    var r = await pool.query(
      "SELECT * FROM compliance_items ORDER BY priority DESC, category, id"
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/compliance/:id", auth, async function (req, res) {
  try {
    var b = req.body;
    var r = await pool.query(
      "UPDATE compliance_items SET is_met=COALESCE($2,is_met), evidence=COALESCE($3,evidence), " +
        "last_verified=NOW(), verified_by=$4, updated_at=NOW() WHERE id=$1 RETURNING *",
      [req.params.id, b.is_met, b.evidence || null, req.user.name]
    );
    await logActivity("Compliance Updated", "compliance", "Item #" + req.params.id, req.user.name);
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// ACTIVITY LOG
// ==============================================
router.get("/activity", auth, async function (req, res) {
  try {
    var r = await pool.query("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 50");
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
