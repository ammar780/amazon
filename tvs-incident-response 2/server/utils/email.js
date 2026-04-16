var nodemailer = require("nodemailer");

function getTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function buildNotification(incident, type) {
  var org = process.env.ORG_NAME || "The Vitamin Shots";
  var contact = process.env.ORG_CONTACT_EMAIL || "support@thevitaminshots.com";
  var domain = process.env.ORG_DOMAIN || "thevitaminshots.com";

  var subject =
    type === "update"
      ? "[UPDATE] " + org + " - Incident " + incident.incident_id
      : "[SECURITY INCIDENT] " + org + " - Incident " + incident.incident_id;

  var body = [
    "SECURITY INCIDENT " + (type === "update" ? "UPDATE" : "NOTIFICATION"),
    "=".repeat(50),
    "",
    "Organization:      " + org,
    "Website:           " + domain,
    "Incident ID:       " + incident.incident_id,
    "Detection Time:    " + new Date(incident.detected_at).toISOString(),
    "Notification Time: " + new Date().toISOString(),
    "Severity:          " + (incident.severity || "medium").toUpperCase(),
    "",
    "-".repeat(50),
    "INCIDENT DESCRIPTION",
    "-".repeat(50),
    "",
    incident.title,
    "",
    incident.description,
    "",
    "-".repeat(50),
    "AMAZON INFORMATION IMPACT",
    "-".repeat(50),
    "",
    "Amazon Data Involved:  " + (incident.involves_amazon_data ? "YES" : "NO"),
    "Data Types Affected:   " + (incident.amazon_data_types || "Under investigation"),
    "Affected Systems:      " + (incident.affected_systems || "Under investigation"),
    "Detection Method:      " + (incident.detection_method || "Internal monitoring"),
    "",
    "-".repeat(50),
    "CONTAINMENT & REMEDIATION",
    "-".repeat(50),
    "",
    "Current Status: " + incident.status,
    "Current Phase:  " + incident.phase,
    "",
    incident.containment_actions
      ? "Containment Actions:\n" + incident.containment_actions
      : "Containment measures are being implemented.",
    "",
    "-".repeat(50),
    "POINT OF CONTACT",
    "-".repeat(50),
    "",
    "Organization:  " + org,
    "Email:         " + contact,
    "Website:       https://" + domain,
    "",
    "This notification is sent in compliance with Amazon's SP-API",
    "Data Protection Policy (24-hour incident reporting requirement).",
    "Follow-up reports will be provided as the investigation progresses.",
  ].join("\n");

  return { subject: subject, body: body };
}

async function sendAmazonNotification(incident, type) {
  type = type || "initial";
  var result = buildNotification(incident, type);
  var transporter = getTransporter();
  var amazonEmail = process.env.AMAZON_SECURITY_EMAIL || "security@amazon.com";
  var org = process.env.ORG_NAME || "The Vitamin Shots";
  var contact = process.env.ORG_CONTACT_EMAIL || "support@thevitaminshots.com";

  if (!transporter) {
    console.log("SMTP not configured - notification logged but not emailed");
    return {
      sent: false,
      logged: true,
      reason: "SMTP not configured",
      subject: result.subject,
      body: result.body,
      to: amazonEmail,
    };
  }

  try {
    var info = await transporter.sendMail({
      from: '"' + org + ' Security" <' + process.env.SMTP_USER + ">",
      to: amazonEmail,
      cc: contact,
      subject: result.subject,
      text: result.body,
    });
    console.log("Amazon notification sent: " + info.messageId);
    return {
      sent: true,
      messageId: info.messageId,
      subject: result.subject,
      body: result.body,
      to: amazonEmail,
    };
  } catch (err) {
    console.error("Email send failed:", err.message);
    return {
      sent: false,
      logged: true,
      reason: err.message,
      subject: result.subject,
      body: result.body,
      to: amazonEmail,
    };
  }
}

module.exports = { sendAmazonNotification: sendAmazonNotification, buildNotification: buildNotification };
