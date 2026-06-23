import jwt from 'jsonwebtoken'

// Verifies the Bearer token on incoming requests and attaches the
// decoded user (id, role, name, email) to req.user.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' })
  }

  const token = header.slice(7)
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

// Use after requireAuth to restrict a route to specific roles, e.g.
// router.post('/beds', requireAuth, requireRole('admin', 'receptionist'), ...)
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that' })
    }
    next()
  }
}
