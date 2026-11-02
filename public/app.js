let CONFIG = null;
const state = { completed: JSON.parse(localStorage.getItem('duniamu_missions') || '[]') };

async function loadConfig() {
  try {
    const r = await fetch('/api/config');
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    CONFIG = j.data;
    renderAll();
  } catch (e) {
    document.getElementById('siteSubtitle').textContent = 'Gagal load: ' + e.message;
  }
}

function renderAll() {
  document.getElementById('siteSubtitle').textContent = CONFIG.slogan || 'Selesaikan Misi, Hasilkan';
  document.getElementById('footer').textContent = '© ' + new Date().getFullYear() + ' ' + CONFIG.siteName;

  const listEl = document.getElementById('missionList');
  listEl.innerHTML = '';
  CONFIG.missions.forEach(m => {
    const done = state.completed.includes(m.id);
    const el = document.createElement('div');
    el.className = 'mission' + (done ? ' done' : '');
    el.innerHTML = '<div class="mission-info"><div class="mission-title">' + m.title + '</div>' +
                   '<div class="mission-reward">+' + m.reward + ' poin</div></div>' +
                   '<button class="btn-do" ' + (done ? 'disabled' : '') + '>' +
                   (done ? 'Selesai' : (m.link ? 'Kerjakan →' : 'Kerjakan')) + '</button>';
    const btn = el.querySelector('button');
    btn.onclick = () => {
      if (m.link) window.open(m.link, '_blank');
      completeMission(m.id);
    };
    listEl.appendChild(el);
  });

  const paySel = document.getElementById('claimPayment');
  paySel.innerHTML = '<option value="">Pilih metode pembayaran</option>' +
    CONFIG.payments.map(p => '<option value="' + p.id + '">' + p.name + ' — ' + p.holder + '</option>').join('');
  updateStats();
}

function completeMission(id) {
  if (state.completed.includes(id)) return;
  state.completed.push(id);
  localStorage.setItem('duniamu_missions', JSON.stringify(state.completed));
  showToast('Misi selesai! +poin');
  setTimeout(() => renderAll(), 300);
}

function updateStats() {
  const totalPoin = state.completed.reduce((s, id) => {
    const m = CONFIG.missions.find(x => x.id === id);
    return s + (m ? m.reward : 0);
  }, 0);
  document.getElementById('totalMissions').textContent = CONFIG.missions.length;
  document.getElementById('doneMissions').textContent = state.completed.length;
  document.getElementById('totalReward').textContent = totalPoin;
  document.getElementById('claimBtn').disabled = state.completed.length !== CONFIG.missions.length;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

document.getElementById('claimBtn').onclick = () => {
  document.getElementById('claimForm').style.display = 'flex';
  document.getElementById('claimBtn').style.display = 'none';
  document.getElementById('claimForm').scrollIntoView({ behavior: 'smooth' });
};

document.getElementById('submitClaim').onclick = async () => {
  const name = document.getElementById('claimName').value.trim();
  const contact = document.getElementById('claimContact').value.trim();
  const paymentMethod = document.getElementById('claimPayment').value;
  if (!name || !contact || !paymentMethod) { showToast('Lengkapi data dulu'); return; }
  const missions = CONFIG.missions
    .filter(m => state.completed.includes(m.id))
    .map(m => ({ title: m.title, reward: m.reward }));
  try {
    const r = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contact, paymentMethod, missions }),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    showToast('Klaim terkirim! ID: ' + j.data.id);
    localStorage.removeItem('duniamu_missions');
    state.completed = [];
    setTimeout(() => location.reload(), 2000);
  } catch (e) { showToast('Error: ' + e.message); }
};

loadConfig();
