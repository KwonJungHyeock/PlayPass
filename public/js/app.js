// 비빔핏 — 사용자 앱 (홈 / 탐색 / 허브 / 마이)
const state = {
  tab: 'home',
  meta: null,
  category: 'all',
  group: 'indoor', // 홈 실내/야외 세그먼트
  sort: 'rating',
  q: '',
  zone: '',
  origin: null,
};

const $ = (s) => document.querySelector(s);
const api = async (p, o) => (await fetch(p, o)).json();
const won = (n) => n.toLocaleString('ko-KR') + '원';
const USER_KEY = 'bibimUser';

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}
function getUser() {
  return localStorage.getItem(USER_KEY) || '';
}
function ensureUser() {
  let u = getUser();
  if (!u) {
    u = (prompt('닉네임을 입력하세요 (예약·결제에 사용돼요)', '') || '').trim();
    if (u) localStorage.setItem(USER_KEY, u);
  }
  return u || '게스트';
}
function catMeta(key) {
  return state.meta.categories.find((c) => c.key === key);
}
function catLabel(key) {
  const c = catMeta(key);
  return c ? `${c.emoji} ${c.label}` : key;
}
function occClass(r) {
  return r < 0.5 ? 'low' : r < 0.8 ? 'mid' : 'high';
}
function occText(r) {
  return r < 0.5 ? '여유' : r < 0.8 ? '보통' : '혼잡';
}
function findZone(id) {
  for (const d of state.meta.regions.districts) {
    const z = d.zones.find((x) => x.id === id);
    if (z) return z;
  }
  return null;
}

// ---------- Tabs ----------
function showTab(name) {
  state.tab = name;
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  $('#screen-' + name).classList.add('active');
  document.querySelectorAll('.tabbar .tab').forEach((t) =>
    t.classList.toggle('active', t.dataset.tab === name),
  );
  // 홈에서는 오렌지 히어로가 상단바를 대신 → 공용 appbar 숨김
  $('#app').classList.toggle('home-active', name === 'home');
  window.scrollTo(0, 0);
  if (name === 'explore') loadFacilities();
  if (name === 'hub') loadHub();
  if (name === 'my') renderMy();
  if (name === 'community') renderCommunity();
}

// ---------- Location (zone picker sheet) ----------
function updateLocLabels() {
  const z = state.zone ? findZone(state.zone) : null;
  const label = z ? z.label : '전주 전체';
  document.querySelectorAll('.heroLocLabel, .barLocLabel').forEach((el) => (el.textContent = label));
}
function openZonePicker() {
  const zones = state.meta.regions.districts.flatMap((d) => d.zones);
  const rows = [{ id: '', emoji: '🗺️', label: '전주 전체', tagline: '모든 지역 보기' }, ...zones];
  const html = rows
    .map(
      (z) =>
        `<button class="zpick ${state.zone === (z.id || '') ? 'on' : ''}" data-zone="${z.id || ''}">
          <span class="zpe">${z.emoji}</span>
          <span class="zpt"><b>${z.label}</b><span>${z.tagline || ''}</span></span>
          ${state.zone === (z.id || '') ? '<span class="zpck">✓</span>' : ''}
        </button>`,
    )
    .join('');
  openSheet(`<div class="sheet-body"><h1 style="margin-bottom:14px">📍 지역 선택</h1>${html}</div>`, 'auto');
  $('#sheet').querySelectorAll('.zpick').forEach((b) =>
    b.addEventListener('click', () => {
      setZone(b.dataset.zone);
      closeSheet();
    }),
  );
}
function setZone(zoneId) {
  state.zone = zoneId;
  updateLocLabels();
  renderZoneBanner();
  loadDeals();
  loadReco();
  if (state.tab === 'explore') loadFacilities();
}

// ---------- Home ----------
function renderHomeCats() {
  const cats = state.meta.categories.filter((c) => c.group === state.group);
  $('#homeCats').innerHTML = cats
    .map(
      (c) =>
        `<button class="cat-tile" data-cat="${c.key}"><span class="cat-ic">${c.emoji}</span><span class="lb">${c.label}</span></button>`,
    )
    .join('');
  $('#homeCats')
    .querySelectorAll('.cat-tile')
    .forEach((b) =>
      b.addEventListener('click', () => {
        setCategory(b.dataset.cat);
        showTab('explore');
      }),
    );
}
async function loadHubShortcut() {
  const { plugins } = await api('/api/hub');
  $('#hubShortcut').innerHTML = plugins
    .filter((p) => p.status === 'active')
    .map(
      (p) => `<button class="acard" data-id="${p.id}"><span class="ae">${p.icon}</span><span class="an">${p.name}</span></button>`,
    )
    .join('');
  $('#hubShortcut')
    .querySelectorAll('.acard')
    .forEach((b) => b.addEventListener('click', () => openHub(b.dataset.id)));
}

async function loadDeals() {
  const sec = $('#homeDeals');
  const { deals } = await api('/api/deals?' + new URLSearchParams(state.zone ? { zone: state.zone } : {}));
  if (!deals.length) {
    sec.hidden = true;
    return;
  }
  $('#dealScroll').innerHTML = deals
    .map(
      (d) => `
      <div class="deal" data-id="${d.facilityId}">
        <div class="thumb">${d.emoji}<span class="badge">${d.discountPct}%↓</span></div>
        <div class="db">
          <div class="dn">${d.facilityName}</div>
          <div class="dc">${d.className} · ${d.day} ${d.time}</div>
          <div class="dp">${won(d.dealPrice)} <s>${won(d.originalPrice)}</s></div>
          <div class="dl">⏱ 잔여 ${d.spotsLeft}자리</div>
        </div>
      </div>`,
    )
    .join('');
  sec.hidden = false;
  $('#dealScroll')
    .querySelectorAll('.deal')
    .forEach((el) => el.addEventListener('click', () => openDetail(el.dataset.id)));
}

async function loadReco() {
  const params = new URLSearchParams();
  if (state.zone) params.set('zone', state.zone);
  if (state.origin) {
    params.set('lat', state.origin.lat);
    params.set('lng', state.origin.lng);
  }
  const { recommendations } = await api('/api/recommend?' + params.toString());
  const z = state.zone ? findZone(state.zone) : null;
  $('#recoHead').textContent = z ? `🔥 ${z.label} 추천` : '🔥 우리 동네 추천';
  $('#recoScroll').innerHTML = recommendations
    .map(
      (f) => `
      <div class="rc" data-id="${f.id}">
        <div class="thumb">${f.emoji}</div>
        <div class="rn">${f.name}</div>
        <div class="rm"><span class="star">★</span> ${f.rating.toFixed(1)} · ${f.minPrice ? won(f.minPrice) : '무료'}</div>
        <div class="why">${(f.reasons || []).slice(0, 1).map((r) => `<span class="tagpill">${r}</span>`).join('')}</div>
      </div>`,
    )
    .join('');
  $('#recoScroll')
    .querySelectorAll('.rc')
    .forEach((el) => el.addEventListener('click', () => openDetail(el.dataset.id)));
}

// ---------- Explore ----------
function renderCatChips() {
  const chips = [{ key: 'all', emoji: '', label: '전체' }, ...state.meta.categories];
  $('#catChips').innerHTML = chips
    .map(
      (c) =>
        `<button class="chip ${state.category === c.key ? 'on' : ''}" data-cat="${c.key}">${c.emoji ? c.emoji + ' ' : ''}${c.label}</button>`,
    )
    .join('');
  $('#catChips')
    .querySelectorAll('.chip')
    .forEach((b) => b.addEventListener('click', () => setCategory(b.dataset.cat)));
}
function setCategory(cat) {
  state.category = cat;
  renderCatChips();
  if (state.tab === 'explore') loadFacilities();
}
function renderZoneBanner() {
  const el = $('#zoneBanner');
  if (!state.zone) {
    el.hidden = true;
    return;
  }
  const z = findZone(state.zone);
  el.className = 'zone-banner ' + z.theme;
  el.innerHTML = `
    <span class="zbe">${z.emoji}</span>
    <div><div class="zbt">${z.label} · ${z.personaLabel}</div><div class="zbn">${z.tagline}</div></div>
    <button class="zbx" id="zbClear">전체</button>`;
  el.hidden = false;
  $('#zbClear').addEventListener('click', () => setZone(''));
}
async function loadFacilities() {
  const params = new URLSearchParams();
  if (state.category !== 'all') params.set('category', state.category);
  if (state.zone) params.set('zone', state.zone);
  params.set('sort', state.sort);
  if (state.q) params.set('q', state.q);
  if (state.origin) {
    params.set('lat', state.origin.lat);
    params.set('lng', state.origin.lng);
  }
  renderZoneBanner();
  const { facilities } = await api('/api/facilities?' + params.toString());
  const list = $('#flist');
  if (!facilities.length) {
    list.innerHTML = `<div class="empty"><div class="big">🔍</div>조건에 맞는 시설이 없어요.<br>필터를 바꿔보세요.</div>`;
    return;
  }
  list.innerHTML = facilities.map(fcard).join('');
  list.querySelectorAll('.fcard').forEach((el) => el.addEventListener('click', () => openDetail(el.dataset.id)));
}
function fcard(f) {
  const dist = f.distanceKm != null ? `<span>📍${f.distanceKm}km</span>` : '';
  return `
    <div class="fcard" data-id="${f.id}">
      <div class="fthumb">${f.emoji}<span class="fcat">${catMeta(f.category)?.label || ''}</span></div>
      <div class="fbody">
        <div class="fn">${f.name}</div>
        <div class="fa">${f.address}</div>
        <div class="fmeta">
          <span><span class="star">★</span> ${f.rating.toFixed(1)} <small style="color:var(--muted)">(${f.reviewCount})</small></span>
          <span><span class="dotmini ${occClass(f.occupancyRatio)}"></span> ${occText(f.occupancyRatio)}</span>
          ${dist}
        </div>
        <div class="fprice">${f.minPrice ? won(f.minPrice) + ' <small>~</small>' : '무료 체험'}</div>
      </div>
    </div>`;
}

// ---------- Detail sheet ----------
function openSheet(html, size) {
  const s = $('#sheet');
  s.classList.toggle('auto', size === 'auto');
  s.innerHTML = `<div class="sheet-grab"></div><button class="sheet-close" id="sheetClose">✕</button>` + html;
  $('#sheetBack').classList.add('open');
  s.classList.add('open');
  s.scrollTop = 0;
  $('#sheetClose').addEventListener('click', closeSheet);
}
function closeSheet() {
  $('#sheetBack').classList.remove('open');
  $('#sheet').classList.remove('open');
}

async function openDetail(id) {
  const { facility: f, promotions } = await api('/api/facilities/' + id);
  const ratio = f.capacityMax ? f.currentOccupancy / f.capacityMax : 0;
  const promoHtml = promotions
    .map((p) => `<div class="promo-note">🎉 <b>${p.title}</b> — ${p.desc}${p.discountPct ? ` <b>(${p.discountPct}%↓)</b>` : ''}</div>`)
    .join('');
  const plans = f.priceTable
    .map(
      (p) => `<div class="plan"><div><div class="pn">${p.name}</div><div class="pd">${p.period}${p.desc ? ' · ' + p.desc : ''}</div></div>
      <div style="display:flex;align-items:center;gap:10px"><span class="pp">${p.price ? won(p.price) : '무료'}</span><button data-plan="${p.name}">${p.price ? '결제' : '신청'}</button></div></div>`,
    )
    .join('');
  const tutors = f.instructors
    .map((i) => `<div class="tut"><div class="av">🧑‍🏫</div><div><div class="tn">${i.name} <small style="color:var(--muted);font-weight:500">· ${i.specialty}</small></div><div class="tc">${i.career}</div><div class="tc">"${i.bio}"</div></div></div>`)
    .join('');
  const classes = f.schedule
    .map((c) => {
      const full = c.spots <= 0;
      return `<div class="cls ${full ? 'full' : ''}"><div><b>${c.class}</b><div class="csub">${c.day} ${c.time} · ${full ? '마감' : '잔여 ' + c.spots + '석'}</div></div>
      <button ${full ? 'disabled' : ''} data-cls='${JSON.stringify({ className: c.class, classDay: c.day, classTime: c.time })}'>${full ? '마감' : '예약'}</button></div>`;
    })
    .join('');
  openSheet(`
    <div class="sheet-hero">${f.emoji}</div>
    <div class="sheet-body">
      <span class="cat-badge">${catLabel(f.category)}</span>
      <h1 style="margin-top:8px">${f.name}</h1>
      <div class="detail-meta">
        <span><span class="star">★</span> ${f.rating.toFixed(1)} (${f.reviewCount})</span>
        <span><span class="dotmini ${occClass(ratio)}"></span> ${occText(ratio)} ${f.currentOccupancy}/${f.capacityMax}</span>
      </div>
      <div class="detail-meta" style="margin-top:6px"><span>📍 ${f.address}</span><span>☎ ${f.phone}</span></div>
      ${promoHtml}
      <p style="color:var(--sub);margin-top:14px;font-size:14px">${f.description}</p>
      <div class="blk"><h4>요금제 · 수강권</h4>${plans}</div>
      <div class="blk"><h4>강사 프로필</h4>${tutors}</div>
      <div class="blk"><h4>실시간 클래스 예약</h4>${classes}</div>
    </div>`);
  $('#sheet').querySelectorAll('.plan button').forEach((b) => b.addEventListener('click', () => checkout(f.id, b.dataset.plan)));
  $('#sheet').querySelectorAll('.cls button:not([disabled])').forEach((b) => b.addEventListener('click', () => reserve(f.id, JSON.parse(b.dataset.cls))));
}

async function checkout(facilityId, planName) {
  const userName = ensureUser();
  const { pass, error } = await api('/api/checkout', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ facilityId, planName, userName }),
  });
  if (error) return toast('⚠ ' + error);
  toast(`✅ ${pass.planName} 등록 완료${pass.discountPct ? ` (${pass.discountPct}%↓ → ${won(pass.paid)})` : ''}`);
}
async function reserve(facilityId, cls) {
  const userName = ensureUser();
  const { reservation, error } = await api('/api/reservations', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ facilityId, ...cls, userName }),
  });
  if (error) return toast('⚠ ' + error);
  toast(`✅ ${reservation.className} 예약 완료 (${reservation.classDay} ${reservation.classTime})`);
  openDetail(facilityId);
}

// ---------- Hub ----------
async function loadHub() {
  const { plugins } = await api('/api/hub');
  $('#hubList').innerHTML = plugins
    .map(
      (p) => `
      <div class="hub-card ${p.status}" data-id="${p.id}" data-status="${p.status}">
        <div class="hic">${p.icon}</div>
        <div class="htext"><div class="hn">${p.name} <span class="tag-status ${p.status}">${p.status === 'active' ? '이용 가능' : '오픈 예정'}</span></div><div class="hs">${p.summary}</div></div>
        <div class="hgo">${p.status === 'active' ? '›' : ''}</div>
      </div>`,
    )
    .join('');
  $('#hubList')
    .querySelectorAll('.hub-card')
    .forEach((el) =>
      el.addEventListener('click', () => {
        if (el.dataset.status === 'active') openHub(el.dataset.id);
        else toast('🚧 곧 만나요! 오픈 예정 서비스입니다.');
      }),
    );
}
async function openHub(pluginId) {
  const params = new URLSearchParams();
  if (state.zone) params.set('zone', state.zone);
  const { plugin, items } = await api(`/api/hub/${pluginId}/catalog?` + params.toString());
  const action = { oneday: 'book', crew: 'join', rental: 'rent' }[pluginId];
  const label = { oneday: '예약', crew: '가입', rental: '대여' }[pluginId] || '신청';
  const rows = items.length
    ? items
        .map((it) => {
          const meta =
            pluginId === 'oneday' ? `${it.host} · ${it.when} · 잔여 ${it.spotsLeft}` :
            pluginId === 'crew' ? `${it.neighborhood} · 멤버 ${it.members}명 · ${it.level} · ${it.meetup}` :
            `${won(it.pricePerDay)}/일 · 보증금 ${won(it.deposit)} · 재고 ${it.stock}`;
          const price = pluginId === 'oneday' ? (it.price ? won(it.price) : '무료') : '';
          return `<div class="hub-item"><div><div class="hit">${it.title} ${price ? `<small style="color:var(--brand);font-weight:800">${price}</small>` : ''}</div><div class="him">${meta}</div></div>
          <button data-action="${action}" data-item="${it.id}">${label}</button></div>`;
        })
        .join('')
    : `<div class="empty"><div class="big">📦</div>${state.zone ? '이 지역엔 해당 상품이 없어요.' : '준비된 상품이 없어요.'}</div>`;
  openSheet(`<div class="sheet-hero">${plugin.icon}</div><div class="sheet-body"><h1>${plugin.name}</h1><div class="blk">${rows}</div></div>`);
  $('#sheet').querySelectorAll('.hub-item button').forEach((b) => b.addEventListener('click', () => hubAction(pluginId, b.dataset.action, b.dataset.item)));
}
async function hubAction(pluginId, action, itemId) {
  const userName = ensureUser();
  const payload = { itemId, userName };
  if (pluginId === 'rental') payload.days = Number(prompt('대여 일수', '1')) || 1;
  const res = await api(`/api/hub/${pluginId}/${action}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  if (res.error) return toast('⚠ ' + res.error);
  const msg = { oneday: '✅ 원데이 클래스 예약 완료', crew: '✅ 크루 가입 완료', rental: `✅ 대여 신청 완료 (${res.order ? won(res.order.total) : ''})` }[pluginId];
  toast(msg);
}

// ---------- My ----------
async function renderMy() {
  const user = getUser();
  const el = $('#myContent');
  if (!user) {
    el.innerHTML = `
      <div class="my-hero"><div class="mh-name">👋 반가워요!</div><div class="mh-sub">닉네임을 설정하고 나의 수강권·예약을 관리하세요.</div>
      <button class="mh-edit" id="setNick">닉네임 설정</button></div>
      <div class="empty"><div class="big">🥗</div>아직 이용 내역이 없어요.<br>홈에서 시설을 둘러보세요!</div>`;
    $('#setNick').addEventListener('click', () => { ensureUser(); renderMy(); });
    return;
  }
  const { passes, reservations, crew } = await api('/api/my?user=' + encodeURIComponent(user));
  const passHtml = passes.length
    ? passes.map((p) => `<div class="mi"><span class="mic">🎫</span><div class="mt"><b>${p.facilityName}</b><div>${p.planName} · ${new Date(p.purchasedAt).toLocaleDateString('ko-KR')}</div></div><span class="mv">${won(p.paid)}</span></div>`).join('')
    : `<div class="sec-sub" style="padding:4px 2px">등록한 수강권이 없어요.</div>`;
  const resHtml = reservations.length
    ? reservations.map((r) => `<div class="mi"><span class="mic">${r.emoji}</span><div class="mt"><b>${r.facilityName}</b><div>${r.className} · ${r.classDay} ${r.classTime}</div></div><span class="mstat">${r.checkedIn ? '출석' : '예약됨'}</span></div>`).join('')
    : `<div class="sec-sub" style="padding:4px 2px">예약 내역이 없어요.</div>`;
  const crewHtml = crew.length
    ? crew.map((c) => `<div class="mi"><span class="mic">🤝</span><div class="mt"><b>${c.crewTitle}</b><div>가입일 ${new Date(c.joinedAt).toLocaleDateString('ko-KR')}</div></div></div>`).join('')
    : `<div class="sec-sub" style="padding:4px 2px">가입한 크루가 없어요.</div>`;
  el.innerHTML = `
    <div class="my-hero"><div class="mh-name">${user}님</div><div class="mh-sub">비빔핏과 함께 건강한 라이프스타일 🥗</div>
    <button class="mh-edit" id="setNick">닉네임 변경</button></div>
    <div class="my-block"><h3>🎫 내 수강권</h3>${passHtml}</div>
    <div class="my-block"><h3>📅 내 예약</h3>${resHtml}</div>
    <div class="my-block"><h3>🤝 내 크루</h3>${crewHtml}</div>
    <a class="partner-link" href="/partner">🏢 파트너 센터 (시설 관리자) <span>›</span></a>`;
  $('#setNick').addEventListener('click', () => {
    const n = (prompt('닉네임 변경', user) || '').trim();
    if (n) { localStorage.setItem(USER_KEY, n); renderMy(); }
  });
}

// ---------- Community ----------
const cmState = { tab: 'all', period: 'week' };

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${Math.max(1, m)}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}일 전` : `${Math.floor(d / 7)}주 전`;
}
function stars(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function postCard(p, rank) {
  const badge = p.type === 'review'
    ? `<span class="cm-tag review">⭐ 후기</span>`
    : `<span class="cm-tag post">✍️ 자유글</span>`;
  const ref = p.facilityName ? `<span class="cm-ref">📍 ${p.facilityName}</span>` : '';
  const rk = rank ? `<span class="cm-rank ${rank <= 3 ? 'top' : ''}">${rank}</span>` : '';
  return `
    <button class="cm-card" data-id="${p.id}">
      ${rk}
      <div class="cm-cbody">
        <div class="cm-crow">${badge}${p.type === 'review' ? `<span class="cm-stars">${stars(p.rating || 5)}</span>` : ''}</div>
        <div class="cm-title">${p.title}</div>
        <div class="cm-snip">${p.body.split('\n')[0]}</div>
        <div class="cm-meta">${ref}<span>🧡 ${p.likes}</span><span>💬 ${p.comments}</span><span>${p.author} · ${timeAgo(p.createdAt)}</span></div>
      </div>
    </button>`;
}

async function loadHomePopular() {
  const { posts } = await api('/api/community/popular?period=week');
  $('#homePopList').innerHTML = posts
    .slice(0, 3)
    .map((p, i) => postCard(p, i + 1))
    .join('');
  bindPostCards($('#homePopList'));
}

async function renderCommunity() {
  const pop = await api('/api/community/popular?period=' + cmState.period);
  $('#cmPopList').innerHTML = pop.posts.map((p, i) => postCard(p, i + 1)).join('');
  bindPostCards($('#cmPopList'));

  const { posts } = await api('/api/community?tab=' + cmState.tab + '&sort=recent');
  $('#cmList').innerHTML = posts.length
    ? posts.map((p) => postCard(p)).join('')
    : `<div class="empty"><div class="big">🥣</div>아직 글이 없어요.<br>첫 글의 주인공이 되어보세요!</div>`;
  bindPostCards($('#cmList'));
}

function bindPostCards(root) {
  root.querySelectorAll('.cm-card').forEach((el) => el.addEventListener('click', () => openPost(el.dataset.id)));
}

async function openPost(id) {
  const { posts } = await api('/api/community');
  const p = posts.find((x) => x.id === id);
  if (!p) return;
  const ref = p.facilityName
    ? `<button class="cm-refbtn" data-fac="${p.facilityId}">📍 ${p.facilityName} 보러가기 ›</button>`
    : '';
  openSheet(`
    <div class="sheet-body">
      <div class="cm-crow" style="margin-bottom:8px">
        ${p.type === 'review' ? `<span class="cm-tag review">⭐ 후기</span><span class="cm-stars">${stars(p.rating || 5)}</span>` : `<span class="cm-tag post">✍️ 자유글</span>`}
      </div>
      <h1>${p.title}</h1>
      <div class="cm-meta" style="margin:6px 0 16px">${p.author} · ${timeAgo(p.createdAt)} · 🧡 <span id="likeCount">${p.likes}</span></div>
      ${ref}
      <p style="white-space:pre-line;font-size:15px;color:var(--sub);line-height:1.7;margin-top:14px">${p.body}</p>
      <button class="like-btn" id="likeBtn">🧡 좋아요 <b id="likeCount2">${p.likes}</b></button>
    </div>`);
  $('#likeBtn').addEventListener('click', async () => {
    const r = await api('/api/community/' + id + '/like', { method: 'POST' });
    if (r.likes != null) {
      $('#likeCount').textContent = r.likes;
      $('#likeCount2').textContent = r.likes;
      $('#likeBtn').classList.add('liked');
      toast('🧡 좋아요!');
    }
  });
  const rb = $('#sheet').querySelector('.cm-refbtn');
  if (rb) rb.addEventListener('click', () => { closeSheet(); openDetail(rb.dataset.fac); });
}

function openWrite() {
  openSheet(`
    <div class="sheet-body">
      <h1 style="margin-bottom:16px">✏️ 글쓰기</h1>
      <div class="seg" id="wType" style="margin-bottom:14px">
        <button data-t="post" class="on">✍️ 자유글</button>
        <button data-t="review">⭐ 업체후기</button>
      </div>
      <div id="wFacWrap" style="display:none;margin-bottom:12px">
        <select id="wFac" class="w-input"></select>
        <div id="wStars" class="w-stars">${[1,2,3,4,5].map((n)=>`<button data-s="${n}" class="on">★</button>`).join('')}</div>
      </div>
      <input id="wTitle" class="w-input" placeholder="제목" style="margin-bottom:10px" />
      <textarea id="wBody" class="w-input" rows="6" placeholder="내용을 입력하세요 :)" style="margin-bottom:14px"></textarea>
      <button class="like-btn solid" id="wSubmit">등록하기</button>
    </div>`, 'auto');

  let wType = 'post', wRating = 5;
  // 후기용 시설 목록 로드(1회 캐시)
  const fillFacs = (facs) => {
    $('#wFac').innerHTML = facs.map((f) => `<option value="${f.id}">${f.emoji} ${f.name}</option>`).join('');
  };
  if (state._facs) fillFacs(state._facs);
  else api('/api/facilities').then(({ facilities }) => { state._facs = facilities; fillFacs(facilities); });
  $('#wType').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      wType = b.dataset.t;
      $('#wType').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      $('#wFacWrap').style.display = wType === 'review' ? 'block' : 'none';
    }),
  );
  $('#wStars').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      wRating = +b.dataset.s;
      $('#wStars').querySelectorAll('button').forEach((x) => x.classList.toggle('on', +x.dataset.s <= wRating));
    }),
  );
  $('#wSubmit').addEventListener('click', async () => {
    const title = $('#wTitle').value.trim();
    const body = $('#wBody').value.trim();
    if (!title || !body) return toast('제목과 내용을 입력하세요');
    const author = ensureUser();
    const payload = { type: wType, title, body, author };
    if (wType === 'review') { payload.facilityId = $('#wFac').value; payload.rating = wRating; }
    const r = await api('/api/community', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    if (r.error) return toast('⚠ ' + r.error);
    closeSheet();
    toast('✅ 글이 등록되었어요!');
    renderCommunity();
    loadHomePopular();
  });
}

// ---------- Init ----------
async function init() {
  state.meta = await api('/api/meta');
  $('#app').classList.add('home-active');
  renderHomeCats();
  renderCatChips();
  updateLocLabels();
  loadDeals();
  loadReco();
  loadHubShortcut();
  loadHomePopular();

  // 커뮤니티 컨트롤
  $('#cmWrite').addEventListener('click', openWrite);
  $('#cmSeg').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      cmState.tab = b.dataset.tab;
      $('#cmSeg').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      renderCommunity();
    }),
  );
  $('#cmPeriod').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      cmState.period = b.dataset.p;
      $('#cmPeriod').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      renderCommunity();
    }),
  );

  document.querySelectorAll('.tabbar .tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
  document.querySelectorAll('[data-goto]').forEach((el) => el.addEventListener('click', () => showTab(el.dataset.goto)));
  $('#heroLoc').addEventListener('click', openZonePicker);
  $('#barLoc').addEventListener('click', openZonePicker);

  // 실내/야외 세그먼트
  $('#groupSeg').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      state.group = b.dataset.g;
      $('#groupSeg').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      renderHomeCats();
    }),
  );

  // 홈 검색 → 탐색으로 이동해 검색
  $('#homeSearch').addEventListener('click', () => {
    showTab('explore');
    setTimeout(() => $('#exploreSearchInput').focus(), 60);
  });
  let timer;
  $('#exploreSearchInput').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => { state.q = e.target.value.trim(); loadFacilities(); }, 250);
  });
  $('#sortRow').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => {
      state.sort = b.dataset.sort;
      $('#sortRow').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      if (state.sort === 'distance' && !state.origin) toast('거리순은 위치 설정이 필요해요');
      loadFacilities();
    }),
  );
  $('#sheetBack').addEventListener('click', closeSheet);

  // URL 로 존/탭 지정 지원: /app?zone=jbnu&tab=explore
  const qp = new URLSearchParams(location.search);
  if (qp.get('zone') && findZone(qp.get('zone'))) setZone(qp.get('zone'));
  if (qp.get('tab')) showTab(qp.get('tab'));
}
init();
