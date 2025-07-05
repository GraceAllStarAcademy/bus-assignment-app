import express from 'express';
import session from 'express-session';
import fs from 'fs/promises';
const app = express();
app.use(express.json());
app.use(session({ secret: 'replace-with-strong-key', resave: false, saveUninitialized: true }));
const DATA_FILE = './data.json';

async function readData() { return JSON.parse(await fs.readFile(DATA_FILE)); }
async function writeData(data) { await fs.writeFile(DATA_FILE, JSON.stringify(data, null,2)); }

// 1) LOGIN
app.post('/api/login', async (req, res) => {
    const { id, passcode } = req.body;
    const data = await readData();
    const student = data.students.find(s => s.id === id && s.passcode === passcode);
    if (!student) return res.status(401).json({ error: 'Invalid credentials' });
    req.session.studentId = student.id;
    res.json({ success: true });
});

// 2) GET CURRENT STATE
app.get('/api/state', async (req, res) => {
  if (!req.session.studentId) return res.status(401).end();
  const data = await readData();
  // count assignments per bus:
  const counts = data.students.reduce((acc,s) => {
    if (s.busId) acc[s.busId] = (acc[s.busId]||0) + 1;
    return acc;
  }, {});
  res.json({ buses: data.buses.map(b => ({
      ...b,
      assigned: counts[b.id]||0,
      students: data.students.filter(s=>s.busId===b.id).map(s=>s.name)
    })),
    yourBusId: data.students.find(s=>s.id===req.session.studentId).busId
  });
});

// 3) ASSIGN / UNASSIGN
app.post('/api/assign', async (req, res) => {
  const { busId } = req.body;
  const studentId = req.session.studentId;
  if (!studentId) return res.status(401).end();
  const data = await readData();
  const targetBus = data.buses.find(b=>b.id===busId);
  if (!targetBus) return res.status(400).json({error:'No such bus'});
  // count current
  const count = data.students.filter(s=>s.busId===busId).length;
  if (count >= targetBus.capacity) return res.status(400).json({error:'Bus is full'});
  // update
  data.students = data.students.map(s => (
    s.id === studentId ? { ...s, busId } : s
  ));
  await writeData(data);
  res.json({ success: true });
});

// serve static UI
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => 
  console.log(`Server listening on port ${PORT}`)
);
