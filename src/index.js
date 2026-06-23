import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import pool from './db.js'
import authRoutes from './routes/auth.js'
import doctorsRoutes from './routes/doctors.js'
import appointmentsRoutes from './routes/appointments.js'
import patientsRoutes from './routes/patients.js'
import prescriptionsRoutes from './routes/prescriptions.js'

const app = express()

// Allow requests from the patient portal (Vercel) and the Electron app
const ALLOWED_ORIGINS = [
  process.env.PATIENT_PORTAL_URL,   // e.g. https://wardline.vercel.app
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Electron (no origin) and allowed origins are let through
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin ${origin} not allowed`))
  },
}))
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

app.use('/api/auth', authRoutes)
app.use('/api/doctors', doctorsRoutes)
app.use('/api/appointments', appointmentsRoutes)
app.use('/api/patients', patientsRoutes)
app.use('/api/prescriptions', prescriptionsRoutes)

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong on the server' })
})

const PORT = process.env.PORT || 4000

// Test DB connection before starting
pool.query('SELECT 1').then(() => {
  app.listen(PORT, () => console.log(`Wardline API listening on port ${PORT}`))
}).catch((err) => {
  console.error('Cannot connect to database:', err.message)
  process.exit(1)
})
