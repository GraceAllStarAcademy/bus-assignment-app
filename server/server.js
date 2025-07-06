import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const app = express();
// trust proxy if behind proxy (e.g., Render)
app.set('trust proxy', 1);

// CORS: allow only your frontend origin
const FRONTEND = process.env.FRONTEND_URL || 'https://graceallstaracademy.github.io';
app.use(cors({ origin: FRONTEND }));

// JSON body parser
app.use(express.json());

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('⚠️ Missing JWT_SECRET environment variable');
  process.exit(1);
}

// Data helpers
const DATA_FILE = './data.json';
async function readData() {
  return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
}
async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.studentId = payload.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ---- Routes ---- //

// 1) LOGIN: returns a JWT token
app.post('/api/login', async (req, res) => {
  const { id, passcode } = req.body;
  const data = await readData();
  const student = data.students.find(s => s.id === id && s.passcode === passcode);
  if (!student) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: student.id }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ success: true, token });
});

// 2) GET CURRENT STATE (protected)
app.get('/api/state', authenticate, async (req, res) => {
  const data = await readData();
  const counts = data.students.reduce((acc, s) => {
    if (s.busId) acc[s.busId] = (acc[s.busId] || 0) + 1;
    return acc;
  }, {});
  res.json({
    buses: data.buses.map(b => ({
      ...b,
      assigned: counts[b.id] || 0,
      students: data.students.filter(s => s.busId === b.id).map(s => s.name)
    })),
    yourBusId: data.students.find(s => s.id === req.studentId).busId
  });
});

// 3) ASSIGN / UNASSIGN (protected)
app.post('/api/assign', authenticate, async (req, res) => {
  const studentId = req.studentId;
  const { busId } = req.body;
  const data = await readData();
  const bus = data.buses.find(b => b.id === busId);
  if (!bus) {
    return res.status(400).json({ error: 'No such bus' });
  }
  const current = data.students.filter(s => s.busId === busId).length;
  if (current >= bus.capacity) {
    return res.status(400).json({ error: 'Bus is full' });
  }
  data.students = data.students.map(s =>
    s.id === studentId ? { ...s, busId } : s
  );
  await writeData(data);
  res.json({ success: true });
});

// 4) ADMIN DATA (optional, returns full dataset)
app.get('/api/admin/data', async (req, res) => {
  const data = await readData();
  res.json(data);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
