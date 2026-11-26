// 공통 도구: 연결 · 서버 시계 · 실시간 구독(+자동 대비책) · 자동차 그리기
const C = window.APP_CONFIG;
const db = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const show = id => $$('.view').forEach(v => v.hidden = v.id !== id);

const CATS = { math: '🔢 수학', eng: '🔤 영어', kor: '📖 국어', sci: '🔬 과학·상식' };
const COLORS = ['#e8506c', '#ff9f1c', '#ffd23f', '#2ec4b6', '#3a86ff', '#8338ec', '#ff7eb6', '#6c757d'];
const carEl = c => { const d = el('span', 'carx'); d.style.setProperty('--c', /^#[0-9a-f]{6}$/i.test(c) ? c : '#e8506c'); return d; };

async function rpc(fn, args) {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

let offset = 0;                                   // 서버 시계와의 차이 = S - (t0+t1)/2
async function syncClock() {
  const t0 = Date.now(); const s = await rpc('server_time'); const t1 = Date.now();
  offset = new Date(s).getTime() - (t0 + t1) / 2;
}
const now = () => Date.now() + offset;
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

function throttle(fn, ms) {
  let last = 0, pend = null;
  return () => {
    const d = Date.now() - last;
    if (d >= ms) { last = Date.now(); fn(); }
    else if (!pend) pend = setTimeout(() => { pend = null; last = Date.now(); fn(); }, ms - d);
  };
}

// 구독 + 6초 안에 안 되면 1.5초마다 가져오기 + 10초마다 전체 다시 맞춤
function startSync(tables, refresh) {
  let ok = false; const t0 = Date.now(); const timers = [];
  const ch = db.channel('c' + Math.random().toString(36).slice(2));
  tables.forEach(t => ch.on('postgres_changes', { event: '*', schema: 'public', table: t.table, filter: t.filter }, () => refresh()));
  const badge = v => { const b = $('#sync'); if (b) { b.textContent = v ? '● 실시간 연결됨' : '● 자동 새로고침 중'; b.className = 'sync ' + (v ? 'on' : 'off'); } };
  badge(false);
  ch.subscribe(s => { ok = s === 'SUBSCRIBED'; badge(ok); });
  timers.push(setInterval(() => { if (!ok && Date.now() - t0 > 6000) refresh(); }, 1500));
  timers.push(setInterval(refresh, 10000));
  return { stop() { timers.forEach(clearInterval); db.removeChannel(ch); } };
}

const rankSort = a => a.sort((x, y) => y.dist - x.dist || y.correct - x.correct || new Date(x.joined_at) - new Date(y.joined_at));
const acc = p => p.solved ? Math.round(p.correct / p.solved * 100) : 0;
