import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// Public: patient self-registration
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, dob, gender, blood_group, address } = req.body
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email and password are required' })
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' })

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email])
    if (existing) return res.status(409).json({ error: 'An account with that email already exists' })

    const password_hash = await bcrypt.hash(password, 12)
    const qr_code_id = crypto.randomUUID()

    const { rows } = await query(
      `INSERT INTO users (name, email, phone, password_hash, role) VALUES ($1,$2,$3,$4,'patient') RETURNING id`,
      [name, email, phone || null, password_hash]
    )
    const userId = rows[0]?.id ?? rows[0]
    await query(
      `INSERT INTO patient_profiles (user_id, dob, gender, blood_group, address, qr_code_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, dob || null, gender || null, blood_group || null, address || null, qr_code_id]
    )

    const user = { id: userId, name, email, role: 'patient', qr_code_id }
    res.status(201).json({ token: signToken(user), user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' })

    const user = await queryOne(
      `SELECT u.*, pp.qr_code_id, pp.dob, pp.gender, pp.blood_group
       FROM users u LEFT JOIN patient_profiles pp ON pp.user_id = u.id
       WHERE u.email = $1`,
      [email]
    )
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Incorrect email or password' })

    const { password_hash, ...safeUser } = user
    res.json({ token: signToken(user), user: safeUser })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Login failed' })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
              pp.qr_code_id, pp.dob, pp.gender, pp.blood_group
       FROM users u LEFT JOIN patient_profiles pp ON pp.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    )
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ user })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load user' })
  }
})

export default router
