import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { query, queryOne, transaction } from '../db.js'
import pool from '../db.js'

const ADMIN_EMAIL = 'admin@wardline.local'
const ADMIN_PASSWORD = 'ChangeMe123!'
const DOCTOR_PASSWORD = 'Doctor123!'

const DOCTORS = [
  { name: 'Dr. Anita Rao',    email: 'anita.rao@wardline.local',   specialty: 'Cardiology'    },
  { name: 'Dr. Vikram Shah',  email: 'vikram.shah@wardline.local',  specialty: 'Neurology'     },
  { name: 'Dr. Meera Pillai', email: 'meera.pillai@wardline.local', specialty: 'Orthopedics'   },
  { name: 'Dr. Arjun Nair',   email: 'arjun.nair@wardline.local',   specialty: 'Pediatrics'    },
  { name: 'Dr. Kavya Menon',  email: 'kavya.menon@wardline.local',  specialty: 'Ophthalmology' },
]

async function seed() {
  // Admin
  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [ADMIN_EMAIL])
  if (!existing) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12)
    await query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
      ['Hospital Admin', ADMIN_EMAIL, hash]
    )
    console.log('Created admin account:')
    console.log(`  email:    ${ADMIN_EMAIL}`)
    console.log(`  password: ${ADMIN_PASSWORD}`)
    console.log('  ⚠️  Change this password after first login.')
  } else {
    console.log('Admin already exists, skipping.')
  }

  // Doctors
  const doctorHash = await bcrypt.hash(DOCTOR_PASSWORD, 12)
  let createdAny = false
  for (const doc of DOCTORS) {
    const already = await queryOne('SELECT id FROM users WHERE email = $1', [doc.email])
    if (already) continue
    await transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'doctor') RETURNING id`,
        [doc.name, doc.email, doctorHash]
      )
      await client.query(
        'INSERT INTO doctor_profiles (user_id, specialty) VALUES ($1, $2)',
        [rows[0].id, doc.specialty]
      )
    })
    createdAny = true
  }
  if (createdAny) {
    console.log('\nCreated doctor accounts:')
    DOCTORS.forEach(d => console.log(`  ${d.email}`))
    console.log(`  password: ${DOCTOR_PASSWORD}`)
  } else {
    console.log('Doctor accounts already exist, skipping.')
  }

  await pool.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
