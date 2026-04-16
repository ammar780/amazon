var express = require("express");
var bcrypt = require("bcryptjs");
var jwt = require("jsonwebtoken");
var pool = require("../db/pool");
var auth = require("../middleware/auth");
var router = express.Router();

router.post("/login", async function (req, res) {
  try {
    var email = (req.body.email || "").toLowerCase().trim();
    var password = req.body.password || "";
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }

    var result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    var user = result.rows[0];
    var valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    var token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    await pool.query(
      "INSERT INTO activity_log (action, category, details, user_name) VALUES ($1, $2, $3, $4)",
      ["Login", "auth", "Logged in", user.name]
    );

    res.json({
      token: token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/me", auth, function (req, res) {
  res.json(req.user);
});

module.exports = router;
