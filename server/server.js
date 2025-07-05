// server/server.js
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fs from 'fs/promises';

const app = express();

// 1) Trust Render’s proxy (needed for secure cookies)
app.set('trust proxy', 1);

// 2) CORS: allow only your GH Pages origin, and allow cookies
const FRONTEND = 'https://graceallstaracademy.github.io';
app.use(cors({
  origin: FRONTEND,
  credentials: true
}));
// preflight for all routes
app.options('*', cors({
  origin: FRONTEND,
  credentials: true
}));

// 3) Body parser
app.use(express.json());

// 4) Session (with secure, cross-site cookies)
app.use(session({
  secret: 'replace-with-strong-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: true,      // HTTPS only
    sameSite: 'none'   // allow cross-site
  }
}));

const DATA_FILE = './data.json';
async function readData() {
  return JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
}
async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// —— Your API endpoints —— //

// LOGIN
app.post('/api/login', async (req, res) => {
  const { id, passcode } = req.body;
  const data = await readData();
  const student = data.students.find(s => s.id === id && s.passcode === passcode);
  if (!student) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.studentId = student.id;
  res.json({ success: true });
});

// STATE
app.get('/api/state', async (req, res) => {
  if (!req.session.studentId) return res.status(401).end();
  const data = await readData();
  const counts = data.students.reduce((acc, s) => {
    if (s.busId) acc[s.busId] = (acc[s.busId]||0) + 1;
    return acc;
  }, {});
  res.json({
    buses: data.buses.map(b => ({
      ...b,
      assigned: counts[b.id] || 0,
      students: data.students
        .filter(s => s.busId === b.id)
        .map(s => s.name)
    })),
    yourBusId: data.students.find(s => s.id === req.session.studentId).busId
  });
});

// ASSIGN
app.post('/api/assign', async (req, res) => {
  const studentId = req.session.studentId;
  if (!studentId) return res.status(401).end();
  const { busId } = req.body;
  const data = await readData();
  const bus = data.buses.find(b => b.id === busId);
  if (!bus) return res.status(400).json({ error: 'No such bus' });
  const current = data.students.filter(s => s.busId === busId).length;
  if (current >= bus.capacity) return res.status(400).json({ error: 'Bus is full' });

  data.students = data.students.map(s =>
    s.id === studentId ? { ...s, busId } : s
  );
  await writeData(data);
  res.json({ success: true });
});

// (Optional) serve static if you still need it
// app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
