import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// QR lookup
router.get('/by-qr/:qrCodeId', requireAuth, requireRole('admin', 'doctor', 'receptionist'), async (req, res) => {
  try {
    const patient = await queryOne(
      `SELECT u.id, u.name FROM patient_profiles pp JOIN users u ON u.id = pp.user_id
       WHERE pp.qr_code_id = $1`,
      [req.params.qrCodeId.trim()]
    )
    if (!patient) return res.status(404).json({ error: 'No patient matches that code' })
    res.json({ patient })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'QR lookup failed' })
  }
})

// Staff: list all patients
router.get('/', requireAuth, requireRole('admin', 'doctor', 'receptionist'), async (req, res) => {
  try {
    const patients = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at,
              pp.dob, pp.gender, pp.blood_group, pp.address, pp.qr_code_id,
              (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = u.id)::int AS appointment_count
       FROM users u LEFT JOIN patient_profiles pp ON pp.user_id = u.id
       WHERE u.role = 'patient' ORDER BY u.created_at DESC`
    )
    res.json({ patients })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load patients' })
  }
})

// Staff: patient history
router.get('/:id/history', requireAuth, requireRole('admin', 'doctor', 'receptionist'), async (req, res) => {
  try {
    const patient = await queryOne(
      `SELECT u.id, u.name, u.email, u.phone, u.created_at,
              pp.dob, pp.gender, pp.blood_group, pp.address, pp.qr_code_id
       FROM users u LEFT JOIN patient_profiles pp ON pp.user_id = u.id
       WHERE u.id = $1 AND u.role = 'patient'`,
      [req.params.id]
    )
    if (!patient) return res.status(404).json({ error: 'Patient not found' })

    const appointments = await query(
      `SELECT a.*, u.name AS doctor_name, dp.specialty FROM appointments a
       JOIN users u ON u.id = a.doctor_id LEFT JOIN doctor_profiles dp ON dp.user_id = u.id
       WHERE a.patient_id = $1 ORDER BY a.appointment_date DESC, a.appointment_time DESC`,
      [patient.id]
    )
    const prescriptions = await query(
      `SELECT p.*, u.name AS doctor_name FROM prescriptions p
       JOIN users u ON u.id = p.doctor_id
       WHERE p.patient_id = $1 ORDER BY p.created_at DESC`,
      [patient.id]
    )
    for (const p of prescriptions) {
      p.items = await query(
        'SELECT id, medicine_name, dosage, frequency, duration FROM prescription_items WHERE prescription_id = $1',
        [p.id]
      )
    }
    res.json({ patient, appointments, prescriptions })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load patient history' })
  }
})

export default router
