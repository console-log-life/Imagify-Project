// Small in-memory, fixed-window rate limiter keyed by user id (or IP when the
// request is not authenticated). Good enough for a single server instance; use
// a shared store such as Redis if the API runs on several instances.
const rateLimit = ({ windowMs, max, message }) => {
  const hits = new Map();

  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now - entry.start >= windowMs) {
      hits.set(key, { start: now, count: 1 });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.start + windowMs - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ success: false, message });
    }
    return next();
  };
};

export default rateLimit;
