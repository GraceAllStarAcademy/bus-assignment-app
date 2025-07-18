// public/app.js
// const API_BASE = 'http://localhost:3000';
const API_BASE = 'https://bus-api-kmc2.onrender.com';

// 1) Define your 35 students (id must match data.json)
const students = [
  { id: 1,  name: '尤嘉豪' },
  { id: 2,  name: '王浩羲' },
  { id: 3,  name: '洪紹博' },
  { id: 4,  name: '林恩丞' },
  { id: 5,  name: '翁梓翔' },
  { id: 6,  name: '李榕濠' },
  { id: 7,  name: '翁仲禹' },
  { id: 8,  name: '陳孟喬' },
  { id: 9,  name: '陳以晨' },
  { id: 10, name: '林浩平' },
  { id: 11, name: '林孟祈' },
  { id: 12, name: '林侑辰' },
  { id: 13, name: '蕭楷唐' },
  { id: 14, name: '陳和謙' },
  { id: 15, name: '謝峻翔' },
  { id: 16, name: '施亮宇' },
  { id: 17, name: '柴沛辰' },
  { id: 18, name: '黃良育' },
  { id: 19, name: '鄒孟霖' },
  { id: 20, name: '李和謙' },
  { id: 21, name: '游幃婷' },
  { id: 22, name: '陳品慈' },
  { id: 23, name: '陳品妤' },
  { id: 24, name: '陳宥均' },
  { id: 25, name: '葉秉铖' },
  { id: 26, name: '赖柏宇' },
  { id: 27, name: '盧尹睿' },
  { id: 28, name: '游品妤' },
  { id: 29, name: '李芷棋' },
  { id: 30, name: '林孟緹' },
  { id: 31, name: '楊語彤' },
  { id: 32, name: '張宴滋' },
  { id: 33, name: '林孟鴻' },
  { id: 34, name: '謝天心' },
  { id: 35, name: '廖奕琁' }
];

document.addEventListener('DOMContentLoaded', () => {
  const listEl       = document.getElementById('studentList');
  const passcodeForm = document.getElementById('passcodeForm');
  const loginBtn     = document.getElementById('btnLogin');
  const welcomeEl    = document.getElementById('welcome');
  const errorEl      = document.getElementById('loginError');
  const logoutBtn     = document.getElementById('btnLogout');
  const loadingIndicator = document.getElementById('loadingIndicator');
  let selectedStudentId = null;
  let token = localStorage.getItem('token');

  // 0) If you already have a token, show the logout button
  if (token) {
    logoutBtn.style.display = '';
  }

  // Group & render student buttons
  function renderStudentButtons() {
    listEl.innerHTML = '';
    const groups = students.reduce((acc, s) => {
      const surname = s.name.charAt(0);
      (acc[surname] = acc[surname]||[]).push(s);
      return acc;
    }, {});
    Object.keys(groups)
      .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
      .forEach(surname => {
        const h3 = document.createElement('h3');
        h3.textContent = `Last Name (${surname})`;
        listEl.appendChild(h3);
        groups[surname]
          .sort((u, v) => u.name.localeCompare(v.name, 'zh-Hans-CN'))
          .forEach(student => {
            const btn = document.createElement('button');
            btn.textContent = student.name;
            btn.onclick = () => selectStudent(btn, student);
            listEl.appendChild(btn);
          });
      });
  }

  function selectStudent(btn, student) {
    listEl.querySelectorAll('button').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    passcodeForm.style.display = '';
    btn.insertAdjacentElement('afterend', passcodeForm);
    selectedStudentId = student.id;
    welcomeEl.textContent = `Hi, ${student.name}. Enter birthday:`;
    errorEl.textContent = '';
  }

  /////////////////////////
  // LOGOUT HANDLER
  logoutBtn.onclick = () => {
    // 1) Clear stored token
    localStorage.removeItem('token');
    token = null;

    // 2) Hide dashboard & logout button, show login & reset UI
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('login').style.display = '';
    logoutBtn.style.display = 'none';
    document.getElementById('passcode').value = '';
    selectedStudentId = null;
    errorEl.textContent = '';

    // 3) Re-render the student buttons in case any selection remains
    renderStudentButtons();
  };

  loginBtn.onclick = async () => {
    const passcode = document.getElementById('passcode').value;
    // clear any previous error
    errorEl.textContent = '';

    // validation
    if (!selectedStudentId || passcode.length !== 4) {
      errorEl.textContent = 'Select your name and enter 4 digits';
      return;
    }

    // show spinner & disable button
    loadingIndicator.style.display = '';
    loginBtn.disabled = true;

    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedStudentId, passcode })
      });
      const data = await res.json();

      if (!res.ok) {
        // show server-error message
        errorEl.textContent = data.error || 'Login failed';
        return;
      }

      // success: store token, show logout button, and go to dashboard
      token = data.token;
      localStorage.setItem('token', token);
      logoutBtn.style.display = '';
      await loadDashboard();

    } catch (err) {
      // network or unexpected error
      errorEl.textContent = err.message || 'Login failed';
    } finally {
      // hide spinner & re-enable button
      loadingIndicator.style.display = 'none';
      loginBtn.disabled = false;
    }
  };


  async function loadDashboard() {
    document.getElementById('login').style.display = 'none';
    document.getElementById('dashboard').style.display = '';
    const res = await fetch(`${API_BASE}/api/state`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      localStorage.removeItem('token');
      window.location.reload();
      return;
    }
    const { buses, yourBusId } = await res.json();
    const container = document.getElementById('buses');
    container.innerHTML = '';
    buses.forEach(b => {
      const div = document.createElement('div');
      div.innerHTML = `
        <h3>${b.name} (${b.assigned}/${b.capacity})</h3>
        <ul>${b.students.map(n => `<li>${n}</li>`).join('')}</ul>
        <button ${b.assigned>=b.capacity?'disabled':''}
          onclick="assign(${b.id})"
          ${b.id===yourBusId?'disabled':''}>
          ${b.id===yourBusId?'Joined':'Join'}
        </button>
      `;
      container.appendChild(div);
    });
  }

  window.assign = async busId => {
    const res = await fetch(`${API_BASE}/api/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ busId })
    });
    if (!res.ok) alert((await res.json()).error);
    else loadDashboard();
  };

  // Initialize
  renderStudentButtons();
  if (token) loadDashboard();
});
