var jwt = require("jsonwebtoken");

module.exports = function (req, res, next) {
  var authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Authentication required" });

  var token = authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    var decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};
