import { Router } from 'express'
import { query, queryOne, transaction } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

// Doctor: write prescription
router.post('/', requireAuth, requireRole('doctor'), async (req, res) => {
  try {
    const { patient_id, appointment_id, diagnosis, notes, items } = req.body
    if (!patient_id || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ error: 'patient_id and at least one medicine item are required' })
    if (items.some(i => !i.medicine_name?.trim()))
      return res.status(400).json({ error: 'Every item needs a medicine name' })

    const patient = await queryOne(`SELECT id FROM users WHERE id = $1 AND role = 'patient'`, [patient_id])
    if (!patient) return res.status(404).json({ error: 'No such patient' })

    const prescriptionId = await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO prescriptions (patient_id, doctor_id, appointment_id, diagnosis, notes)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [patient_id, req.user.id, appointment_id || null, diagnosis || null, notes || null]
      )
      const pid = rows[0].id
      for (const item of items) {
        await client.query(
          `INSERT INTO prescription_items (prescription_id, medicine_name, dosage, frequency, duration)
           VALUES ($1,$2,$3,$4,$5)`,
          [pid, item.medicine_name.trim(), item.dosage || null, item.frequency || null, item.duration || null]
        )
      }
      return pid
    })

    const prescription = await queryOne(
      `SELECT p.*, pu.name AS patient_name, du.name AS doctor_name FROM prescriptions p
       JOIN users pu ON pu.id = p.patient_id JOIN users du ON du.id = p.doctor_id
       WHERE p.id = $1`,
      [prescriptionId]
    )
    prescription.items = await query(
      'SELECT id, medicine_name, dosage, frequency, duration FROM prescription_items WHERE prescription_id = $1',
      [prescriptionId]
    )
    res.status(201).json({ prescription })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not save prescription' })
  }
})

// Patient: view own
router.get('/me', requireAuth, requireRole('patient'), async (req, res) => {
  try {
    const prescriptions = await query(
      `SELECT p.*, du.name AS doctor_name FROM prescriptions p
       JOIN users du ON du.id = p.doctor_id
       WHERE p.patient_id = $1 ORDER BY p.created_at DESC`,
      [req.user.id]
    )
    for (const p of prescriptions) {
      p.items = await query(
        'SELECT id, medicine_name, dosage, frequency, duration FROM prescription_items WHERE prescription_id = $1',
        [p.id]
      )
    }
    res.json({ prescriptions })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load prescriptions' })
  }
})

export default router
