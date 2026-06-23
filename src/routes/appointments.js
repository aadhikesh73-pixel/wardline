import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

// Patient: book
router.post('/', requireAuth, requireRole('patient'), async (req, res) => {
  try {
    const { doctor_id, appointment_date, appointment_time, reason } = req.body
    if (!doctor_id || !appointment_date || !appointment_time)
      return res.status(400).json({ error: 'doctor_id, appointment_date and appointment_time are required' })
    if (!DATE_RE.test(appointment_date) || !TIME_RE.test(appointment_time))
      return res.status(400).json({ error: 'Use date format YYYY-MM-DD and time HH:MM' })

    const doctor = await queryOne(`SELECT id FROM users WHERE id = $1 AND role = 'doctor'`, [doctor_id])
    if (!doctor) return res.status(404).json({ error: 'No such doctor' })

    const clash = await queryOne(
      `SELECT id FROM appointments WHERE doctor_id=$1 AND appointment_date=$2 AND appointment_time=$3
       AND status IN ('pending','confirmed')`,
      [doctor_id, appointment_date, appointment_time]
    )
    if (clash) return res.status(409).json({ error: 'That slot is already booked. Please choose another time.' })

    const rows = await query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status)
       VALUES ($1,$2,$3,$4,$5,'pending') RETURNING id`,
      [req.user.id, doctor_id, appointment_date, appointment_time, reason || null]
    )
    const appointment = await queryOne(
      `SELECT a.*, u.name AS doctor_name, dp.specialty FROM appointments a
       JOIN users u ON u.id = a.doctor_id LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
       WHERE a.id = $1`,
      [rows[0].id]
    )
    res.status(201).json({ appointment })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not book appointment' })
  }
})

// Patient: view own
router.get('/me', requireAuth, requireRole('patient'), async (req, res) => {
  try {
    const appointments = await query(
      `SELECT a.*, u.name AS doctor_name, dp.specialty FROM appointments a
       JOIN users u ON u.id = a.doctor_id LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
       WHERE a.patient_id = $1 ORDER BY a.appointment_date, a.appointment_time`,
      [req.user.id]
    )
    res.json({ appointments })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load appointments' })
  }
})

// Patient: cancel own
router.delete('/:id', requireAuth, requireRole('patient'), async (req, res) => {
  try {
    const appt = await queryOne('SELECT * FROM appointments WHERE id = $1', [req.params.id])
    if (!appt || appt.patient_id !== req.user.id)
      return res.status(404).json({ error: 'Appointment not found' })
    if (!['pending', 'confirmed'].includes(appt.status))
      return res.status(400).json({ error: 'This appointment can no longer be cancelled' })
    await query(`UPDATE appointments SET status = 'cancelled' WHERE id = $1`, [req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not cancel appointment' })
  }
})

// Staff: list all (doctors see own only)
router.get('/', requireAuth, requireRole('admin', 'doctor', 'receptionist'), async (req, res) => {
  try {
    const base = `SELECT a.*, pu.name AS patient_name, du.name AS doctor_name, dp.specialty
                  FROM appointments a
                  JOIN users pu ON pu.id = a.patient_id
                  JOIN users du ON du.id = a.doctor_id
                  LEFT JOIN doctor_profiles dp ON dp.user_id = du.id`
    const appointments = req.user.role === 'doctor'
      ? await query(base + ' WHERE a.doctor_id = $1 ORDER BY a.appointment_date, a.appointment_time', [req.user.id])
      : await query(base + ' ORDER BY a.appointment_date, a.appointment_time')
    res.json({ appointments })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load appointments' })
  }
})

// Staff: update status
router.patch('/:id/status', requireAuth, requireRole('admin', 'doctor', 'receptionist'), async (req, res) => {
  try {
    const { status } = req.body
    if (!['confirmed', 'completed', 'cancelled'].includes(status))
      return res.status(400).json({ error: "status must be 'confirmed', 'completed' or 'cancelled'" })
    const appt = await queryOne('SELECT * FROM appointments WHERE id = $1', [req.params.id])
    if (!appt) return res.status(404).json({ error: 'Appointment not found' })
    if (req.user.role === 'doctor' && appt.doctor_id !== req.user.id)
      return res.status(403).json({ error: 'You can only update your own appointments' })
    await query('UPDATE appointments SET status = $1 WHERE id = $2', [status, req.params.id])
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not update appointment' })
  }
})

export default router
