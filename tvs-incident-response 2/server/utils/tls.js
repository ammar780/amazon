var https = require("https");

function auditEndpoint(hostname, port) {
  port = port || 443;
  return new Promise(function (resolve) {
    var timer = setTimeout(function () {
      resolve({
        endpoint: hostname + ":" + port,
        is_compliant: false,
        tls_version: null,
        cipher_suite: null,
        cipher_bits: null,
        certificate_issuer: null,
        certificate_subject: null,
        certificate_expiry: null,
        issues: "Connection timed out",
      });
    }, 10000);

    try {
      var req = https.request(
        {
          host: hostname,
          port: port,
          method: "HEAD",
          rejectUnauthorized: false,
          timeout: 8000,
        },
        function (res) {
          clearTimeout(timer);
          var sock = res.socket;
          var cert = sock.getPeerCertificate();
          var proto = sock.getProtocol();
          var cipher = sock.getCipher();
          var issues = [];

          if (proto && proto !== "TLSv1.2" && proto !== "TLSv1.3") {
            issues.push("Weak TLS: " + proto + " (requires 1.2+)");
          }

          var weakCiphers = ["RC4", "DES", "3DES", "MD5", "NULL", "EXPORT"];
          if (cipher && cipher.name) {
            for (var i = 0; i < weakCiphers.length; i++) {
              if (cipher.name.toUpperCase().indexOf(weakCiphers[i]) !== -1) {
                issues.push("Weak cipher: " + cipher.name);
                break;
              }
            }
          }

          var expiry = null;
          if (cert && cert.valid_to) {
            expiry = new Date(cert.valid_to);
            var days = (expiry - new Date()) / 86400000;
            if (days < 30) issues.push("Cert expires in " + Math.round(days) + " days");
            if (days < 0) issues.push("Certificate EXPIRED");
          }

          resolve({
            endpoint: hostname + ":" + port,
            tls_version: proto || "Unknown",
            cipher_suite: cipher ? cipher.name : "Unknown",
            cipher_bits: cipher ? cipher.bits : null,
            certificate_issuer: cert ? cert.issuer ? cert.issuer.O || cert.issuer.CN || "Unknown" : "Unknown" : "Unknown",
            certificate_subject: cert ? cert.subject ? cert.subject.CN || "Unknown" : "Unknown" : "Unknown",
            certificate_expiry: expiry ? expiry.toISOString() : null,
            is_compliant: issues.length === 0,
            issues: issues.length > 0 ? issues.join("; ") : null,
          });
          res.resume();
        }
      );

      req.on("error", function (err) {
        clearTimeout(timer);
        resolve({
          endpoint: hostname + ":" + port,
          is_compliant: false,
          issues: "Connection error: " + err.message,
        });
      });

      req.end();
    } catch (err) {
      clearTimeout(timer);
      resolve({
        endpoint: hostname + ":" + port,
        is_compliant: false,
        issues: "Error: " + err.message,
      });
    }
  });
}

module.exports = { auditEndpoint: auditEndpoint };
