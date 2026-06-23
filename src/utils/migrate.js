import 'dotenv/config'
import pool from '../db.js'

const SQL = `
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  phone       TEXT,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','doctor','receptionist','patient')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctor_profiles (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  specialty   TEXT,
  department  TEXT,
  qualification TEXT
);

CREATE TABLE IF NOT EXISTS patient_profiles (
  user_id           INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dob               TEXT,
  gender            TEXT,
  blood_group       TEXT,
  address           TEXT,
  emergency_contact TEXT,
  qr_code_id        TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS appointments (
  id               SERIAL PRIMARY KEY,
  patient_id       INTEGER NOT NULL REFERENCES users(id),
  doctor_id        INTEGER NOT NULL REFERENCES users(id),
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  reason           TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','completed','cancelled')),
  reminder_sent    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS beds (
  id             SERIAL PRIMARY KEY,
  ward           TEXT NOT NULL,
  bed_number     TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available','occupied','maintenance')),
  patient_id     INTEGER REFERENCES users(id),
  occupied_since TIMESTAMPTZ,
  UNIQUE(ward, bed_number)
);

CREATE TABLE IF NOT EXISTS medicines (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL UNIQUE,
  unit              TEXT NOT NULL DEFAULT 'units',
  stock_quantity    INTEGER NOT NULL DEFAULT 0,
  reorder_threshold INTEGER NOT NULL DEFAULT 10,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id             SERIAL PRIMARY KEY,
  patient_id     INTEGER NOT NULL REFERENCES users(id),
  doctor_id      INTEGER NOT NULL REFERENCES users(id),
  appointment_id INTEGER REFERENCES appointments(id),
  diagnosis      TEXT,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id              SERIAL PRIMARY KEY,
  prescription_id INTEGER NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_name   TEXT NOT NULL,
  dosage          TEXT,
  frequency       TEXT,
  duration        TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
  id         SERIAL PRIMARY KEY,
  staff_id   INTEGER NOT NULL REFERENCES users(id),
  date       TEXT NOT NULL,
  check_in   TEXT,
  check_out  TEXT,
  status     TEXT NOT NULL DEFAULT 'present'
               CHECK (status IN ('present','absent','leave')),
  UNIQUE(staff_id, date)
);
`

async function migrate() {
  console.log('Running database migrations...')
  await pool.query(SQL)
  console.log('Migration complete — all tables ready.')
  await pool.end()
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message)
  process.exit(1)
})
