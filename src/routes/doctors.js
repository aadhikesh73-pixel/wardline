import { Router } from 'express'
import { query } from '../db.js'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const doctors = await query(
      `SELECT u.id, u.name, u.email, dp.specialty, dp.qualification
       FROM users u JOIN doctor_profiles dp ON dp.user_id = u.id
       WHERE u.role = 'doctor'
       ORDER BY dp.specialty, u.name`
    )
    res.json({ doctors })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load doctors' })
  }
})

export default router
