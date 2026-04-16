const pool = require("./pool");
const bcrypt = require("bcryptjs");

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS team_members (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        irt_role VARCHAR(100) NOT NULL,
        job_title VARCHAR(255),
        phone VARCHAR(50),
        responsibilities TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS incidents (
        id SERIAL PRIMARY KEY,
        incident_id VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        severity VARCHAR(20) NOT NULL DEFAULT 'medium',
        status VARCHAR(30) NOT NULL DEFAULT 'detected',
        phase VARCHAR(30) NOT NULL DEFAULT 'detection',
        involves_amazon_data BOOLEAN DEFAULT false,
        amazon_data_types TEXT,
        affected_systems TEXT,
        detection_method VARCHAR(100),
        detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        contained_at TIMESTAMPTZ,
        eradicated_at TIMESTAMPTZ,
        resolved_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ,
        amazon_notified_at TIMESTAMPTZ,
        amazon_notification_deadline TIMESTAMPTZ,
        notification_sent BOOLEAN DEFAULT false,
        root_cause TEXT,
        containment_actions TEXT,
        eradication_actions TEXT,
        recovery_actions TEXT,
        lessons_learned TEXT,
        reported_by INTEGER REFERENCES team_members(id),
        incident_commander INTEGER REFERENCES team_members(id),
        security_lead INTEGER REFERENCES team_members(id),
        communications_lead INTEGER REFERENCES team_members(id),
        post_review_completed BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS incident_timeline (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
        phase VARCHAR(30),
        action VARCHAR(500) NOT NULL,
        details TEXT,
        performed_by INTEGER REFERENCES team_members(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS amazon_notifications (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
        notification_type VARCHAR(50) DEFAULT 'initial',
        sent_to VARCHAR(255) NOT NULL DEFAULT 'security@amazon.com',
        subject VARCHAR(500) NOT NULL,
        body TEXT NOT NULL,
        sent_at TIMESTAMPTZ DEFAULT NOW(),
        delivery_status VARCHAR(50) DEFAULT 'sent'
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS encryption_audits (
        id SERIAL PRIMARY KEY,
        endpoint VARCHAR(500) NOT NULL,
        tls_version VARCHAR(20),
        cipher_suite VARCHAR(255),
        cipher_bits INTEGER,
        certificate_issuer VARCHAR(255),
        certificate_subject VARCHAR(255),
        certificate_expiry TIMESTAMPTZ,
        is_compliant BOOLEAN DEFAULT false,
        issues TEXT,
        audited_at TIMESTAMPTZ DEFAULT NOW(),
        audited_by VARCHAR(255)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS plan_reviews (
        id SERIAL PRIMARY KEY,
        review_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        next_review_date TIMESTAMPTZ NOT NULL,
        plan_version VARCHAR(20) NOT NULL,
        reviewer_name VARCHAR(255),
        approver_name VARCHAR(255),
        changes_summary TEXT,
        roles_current BOOLEAN DEFAULT false,
        encryption_verified BOOLEAN DEFAULT false,
        notification_tested BOOLEAN DEFAULT false,
        amazon_policy_checked BOOLEAN DEFAULT false,
        incidents_reviewed BOOLEAN DEFAULT false,
        training_completed BOOLEAN DEFAULT false,
        sign_off_notes TEXT,
        status VARCHAR(30) DEFAULT 'completed',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS compliance_items (
        id SERIAL PRIMARY KEY,
        requirement TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        amazon_reference VARCHAR(100),
        plan_section VARCHAR(50),
        is_met BOOLEAN DEFAULT false,
        evidence TEXT,
        last_verified TIMESTAMPTZ,
        verified_by VARCHAR(255),
        priority VARCHAR(20) DEFAULT 'high',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY,
        action VARCHAR(255) NOT NULL,
        category VARCHAR(50) NOT NULL,
        details TEXT,
        user_name VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Seed admin
    var adminEmail = process.env.ADMIN_EMAIL || "admin@thevitaminshots.com";
    var adminPass = process.env.ADMIN_PASSWORD || "changeme123";
    var adminName = process.env.ADMIN_NAME || "Admin";
    var hash = await bcrypt.hash(adminPass, 12);

    await client.query(
      "INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) ON CONFLICT (email) DO UPDATE SET password_hash = $2, name = $3",
      [adminEmail, hash, adminName]
    );

    // Seed compliance items (only if table is empty)
    var countResult = await client.query("SELECT COUNT(*) FROM compliance_items");
    if (parseInt(countResult.rows[0].count) === 0) {
      var items = [
        ["Report security incidents involving Amazon Information to security@amazon.com within 24 hours of detection", "Incident Notification", "Data Protection Policy", "Section 7", true, "critical"],
        ["Encrypt Amazon Information in transit using TLS 1.2 or higher", "Encryption", "Data Protection Policy", "Section 5", true, "critical"],
        ["Maintain incident response plan with defined IRT roles", "IRT Roles", "Data Protection Policy", "Section 4", false, "critical"],
        ["Conduct semi-annual (6-month) plan reviews", "Plan Review", "Data Protection Policy", "Section 8", false, "critical"],
        ["Maintain 24-hour incident notification procedures", "Incident Notification", "Data Protection Policy", "Section 7", true, "critical"],
        ["Disable weak cipher suites (RC4, DES, 3DES, MD5, SHA-1)", "Encryption", "Data Protection Policy", "Section 5.1", false, "high"],
        ["Transmit SP-API tokens exclusively over encrypted channels", "Encryption", "Data Protection Policy", "Section 5.2", true, "critical"],
        ["Enforce HTTPS with HTTP-to-HTTPS redirect on all endpoints", "Encryption", "Data Protection Policy", "Section 5.1", false, "high"],
        ["Maintain incident timeline and evidence logs", "Documentation", "Data Protection Policy", "Section 6", true, "high"],
        ["Conduct post-incident review within 5 business days", "Process", "Data Protection Policy", "Section 6.4", false, "medium"],
        ["Rotate SP-API credentials after any security incident", "Credentials", "Data Protection Policy", "Section 6.3", true, "high"],
        ["Maintain version-controlled incident response plan document", "Documentation", "Data Protection Policy", "Section 2", true, "high"],
      ];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        await client.query(
          "INSERT INTO compliance_items (requirement, category, amazon_reference, plan_section, is_met, priority) VALUES ($1,$2,$3,$4,$5,$6)",
          [it[0], it[1], it[2], it[3], it[4], it[5]]
        );
      }
    }

    await client.query("COMMIT");
    console.log("Database migration completed successfully");
    console.log("Admin account: " + adminEmail);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = migrate;
