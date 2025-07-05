// server/server.js
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import fs from 'fs/promises';

const app = express();

// —— 1) Trust Render’s proxy so secure cookies work ——
app.set('trust proxy', 1);

// —— 2) CORS: allow your GH Pages origin and cookies ——
app.use(cors({
  origin: 'https://graceallstaracademy.github.io',
  credentials: true
}));
// handle preflight
app.options('*', cors({
  origin: 'https://graceallstaracademy.github.io',
  credentials: true
}));

// —— 3) Body parser & session ——
app.use(express.json());
app.use(session({
  secret: 'replace-with-strong-key',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: true,     // only over HTTPS
    sameSite: 'none'  // allow cross-site
  }
}));

const DATA_FILE = './data.json';
async function readData() {
  const txt = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(txt);
}
async function writeData(data) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// —— 4) Endpoints ——

// Login
app.post('/api/login', async (req, res) => {
  const { id, passcode } = req.body;
  const data = await readData();
  const student = data.students.find(s => s.id === id && s.passcode === passcode);
  if (!student) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.studentId = student.id;
  res.json({ success: true });
});

// State
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

// Assign
app.post('/api/assign', async (req, res) => {
  const studentId = req.session.studentId;
  if (!studentId) return res.status(401).end();
  const { busId } = req.body;
  const data = await readData();
  const bus = data.buses.find(b => b.id === busId);
  if (!bus) return res.status(400).json({ error: 'No such bus' });
  const assignedCount = data.students.filter(s => s.busId === busId).length;
  if (assignedCount >= bus.capacity) return res.status(400).json({ error: 'Bus is full' });

  data.students = data.students.map(s =>
    s.id === studentId ? { ...s, busId } : s
  );
  await writeData(data);
  res.json({ success: true });
});

// // serve static UI
// app.use(express.static('public'));

// —— 5) Start up ——
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server listening on port ${PORT}`)
);
