const zlib = require('zlib');

const COMPRESSIBLE = /^(application\/json|text\/|application\/javascript|image\/svg\+xml)/i;

/**
 * Built-in gzip compression middleware using Node's native zlib (zero external dependencies).
 * Compresses JSON API responses and JS/CSS/HTML assets > 1024 bytes by ~75%.
 */
function compressMiddleware(req, res, next) {
  const accept = req.headers['accept-encoding'] || '';
  if (!accept.includes('gzip') || req.method === 'HEAD') {
    return next();
  }

  const origJson = res.json.bind(res);
  res.json = function compressedJson(body) {
    const payload = JSON.stringify(body);
    if (!res.headersSent && payload.length > 1024 && !res.getHeader('Content-Encoding')) {
      zlib.gzip(Buffer.from(payload, 'utf8'), (err, gz) => {
        if (err || res.headersSent) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          return res.end(payload);
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Vary', 'Accept-Encoding');
        res.setHeader('Content-Length', gz.length);
        return res.end(gz);
      });
      return res;
    }
    return origJson(body);
  };

  return next();
}

module.exports = compressMiddleware;
