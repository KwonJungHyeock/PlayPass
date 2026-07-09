// PlayPass user app — vanilla JS SPA logic.
const state = {
  meta: null,
  category: 'all',
  sort: 'rating',
  q: '',
  origin: null, // {lat,lng}
  ageGroup: '',
  zone: '', // 선택된 지역 코어 존
};

const $ = (sel) => document.querySelector(sel);
const api = async (path, opts) => {
  const res = await fetch(path, opts);
  return res.json();
};
const won = (n) => n.toLocaleString('ko-KR') + '원';

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

function catLabel(key) {
  const c = state.meta.categories.find((x) => x.key === key);
  return c ? `${c.emoji} ${c.label}` : key;
}

function occDot(ratio) {
  const cls = ratio < 0.5 ? 'low' : ratio < 0.8 ? 'mid' : 'high';
  const label = ratio < 0.5 ? '여유' : ratio < 0.8 ? '보통' : '혼잡';
  return `<span class="occ"><span class="dot ${cls}"></span>${label}</span>`;
}

function stars(rating) {
  return `<span class="stars">★</span> <b>${rating.toFixed(1)}</b>`;
}

// ---- Rendering ----
function renderChips() {
  const chips = $('#chips');
  const all = [{ key: 'all', emoji: '🏠', label: '전체' }, ...state.meta.categories];
  chips.innerHTML = all
    .map(
      (c) =>
        `<button class="chip ${state.category === c.key ? 'active' : ''}" data-cat="${c.key}">${c.emoji} ${c.label}</button>`,
    )
    .join('');
  chips.querySelectorAll('.chip').forEach((el) =>
    el.addEventListener('click', () => {
      state.category = el.dataset.cat;
      renderChips();
      loadFacilities();
      loadRecommendations();
    }),
  );
}

function facilityCard(f) {
  const dist = f.distanceKm != null ? `<span>📍 ${f.distanceKm}km</span>` : '';
  const tags = (f.tags || []).slice(0, 3).map((t) => `<span class="tag">#${t}</span>`).join('');
  return `
    <div class="card" data-id="${f.id}">
      <div class="card-top">
        <span class="card-cat">${catLabel(f.category)}</span>
        ${f.emoji}
      </div>
      <div class="card-body">
        <h3>${f.name}</h3>
        <div class="addr">${f.address}</div>
        <div class="card-meta">
          <span>${stars(f.rating)} <small>(${f.reviewCount})</small></span>
          ${occDot(f.occupancyRatio)}
          ${dist}
        </div>
        <div class="price-tag">${f.minPrice ? won(f.minPrice) + ' <small>~</small>' : '무료 체험'}</div>
        <div class="tagrow">${tags}</div>
      </div>
    </div>`;
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
  const { facilities } = await api('/api/facilities?' + params.toString());
  const grid = $('#grid');
  if (!facilities.length) {
    grid.innerHTML = `<div class="empty">조건에 맞는 시설이 없어요. 필터를 바꿔보세요.</div>`;
    return;
  }
  grid.innerHTML = facilities.map(facilityCard).join('');
  grid.querySelectorAll('.card').forEach((el) =>
    el.addEventListener('click', () => openDetail(el.dataset.id)),
  );
}

async function loadRecommendations() {
  const sec = $('#recoSection');
  if (!state.ageGroup && state.category === 'all' && !state.zone) {
    sec.hidden = true;
    return;
  }
  const params = new URLSearchParams();
  if (state.ageGroup) params.set('ageGroup', state.ageGroup);
  if (state.category !== 'all') params.set('categories', state.category);
  if (state.zone) params.set('zone', state.zone);
  if (state.origin) {
    params.set('lat', state.origin.lat);
    params.set('lng', state.origin.lng);
  }
  const { recommendations } = await api('/api/recommend?' + params.toString());
  if (!recommendations.length) {
    sec.hidden = true;
    return;
  }
  const zoneLabel = state.zone ? findZone(state.zone)?.label : null;
  const ageLabel = state.ageGroup
    ? state.meta.ageGroups.find((a) => a.key === state.ageGroup)?.label
    : null;
  $('#recoTitle').textContent = zoneLabel
    ? `${zoneLabel} 맞춤 추천`
    : ageLabel
      ? `${ageLabel} 맞춤 추천`
      : '이런 곳은 어때요?';
  $('#recoScroll').innerHTML = recommendations
    .map(
      (f) => `
      <div class="reco-card" data-id="${f.id}">
        <div class="emoji">${f.emoji}</div>
        <div class="name">${f.name}</div>
        <div class="card-meta">${stars(f.rating)} · ${f.minPrice ? won(f.minPrice) : '무료'}${f.distanceKm != null ? ' · ' + f.distanceKm + 'km' : ''}</div>
        <div class="why">${(f.reasons || []).map((r) => `<span class="badge">${r}</span>`).join('')}</div>
      </div>`,
    )
    .join('');
  sec.hidden = false;
  $('#recoScroll')
    .querySelectorAll('.reco-card')
    .forEach((el) => el.addEventListener('click', () => openDetail(el.dataset.id)));
}

// ---- Zone curation ----
function findZone(id) {
  for (const d of state.meta.regions.districts) {
    const z = d.zones.find((x) => x.id === id);
    if (z) return z;
  }
  return null;
}

function renderZones() {
  const el = $('#zoneGroups');
  el.innerHTML = state.meta.regions.districts
    .map(
      (d) => `
      <div class="zone-district">
        <div class="dlabel">${d.district}</div>
        <div class="zone-chips">
          ${d.zones
            .map(
              (z) => `<button class="zone-chip ${state.zone === z.id ? 'active' : ''}" data-zone="${z.id}">
                <span class="zt">${z.emoji} ${z.label}</span>
                <span class="zp">${z.tagline}</span>
              </button>`,
            )
            .join('')}
        </div>
      </div>`,
    )
    .join('');
  el.querySelectorAll('.zone-chip').forEach((b) =>
    b.addEventListener('click', () => selectZone(b.dataset.zone)),
  );
}

function selectZone(zoneId) {
  state.zone = state.zone === zoneId ? '' : zoneId; // toggle off if same
  renderZones();
  renderZoneBanner();
  loadDeals();
  loadFacilities();
  loadRecommendations();
}

function renderZoneBanner() {
  const banner = $('#zoneBanner');
  if (!state.zone) {
    banner.hidden = true;
    return;
  }
  const z = findZone(state.zone);
  const cats = z.categories.map((c) => `<span>${catLabel(c)}</span>`).join('');
  banner.className = `zone-banner ${z.theme}`;
  banner.innerHTML = `
    <div class="zb-emoji">${z.emoji}</div>
    <div>
      <div class="zb-title">${z.label} · ${z.personaLabel}</div>
      <div class="zb-note">${z.tagline}</div>
      <div class="zb-cats">${cats}</div>
    </div>
    <button class="zb-clear" id="clearZone">전체 지역 보기</button>`;
  banner.hidden = false;
  $('#clearZone').addEventListener('click', () => selectZone(state.zone));
}

// ---- 마감 임박 특가 ----
async function loadDeals() {
  const sec = $('#dealsSection');
  const params = new URLSearchParams();
  if (state.zone) params.set('zone', state.zone);
  const { deals } = await api('/api/deals?' + params.toString());
  if (!deals.length) {
    sec.hidden = true;
    return;
  }
  $('#dealsScroll').innerHTML = deals
    .map(
      (d) => `
      <div class="deal-card" data-id="${d.facilityId}">
        <span class="dc-badge">${d.discountPct}%↓</span>
        <div class="dc-emoji">${d.emoji}</div>
        <div class="dc-name">${d.facilityName}</div>
        <div class="dc-cls">${d.className} · ${d.day} ${d.time}</div>
        <div class="dc-price">${won(d.dealPrice)} <s>${won(d.originalPrice)}</s></div>
        <div class="dc-left">⏱ 잔여 ${d.spotsLeft}자리</div>
      </div>`,
    )
    .join('');
  sec.hidden = false;
  $('#dealsScroll')
    .querySelectorAll('.deal-card')
    .forEach((el) => el.addEventListener('click', () => openDetail(el.dataset.id)));
}

// ---- 플레이패스 허브 (플러그인) ----
async function loadHub() {
  const { plugins } = await api('/api/hub');
  $('#hubGrid').innerHTML = plugins
    .map(
      (p) => `
      <div class="hub-card ${p.status}" data-id="${p.id}" data-status="${p.status}">
        <span class="hc-kind ${p.status}">${p.status === 'active' ? '이용 가능' : '오픈 예정'}</span>
        <div class="hc-icon">${p.icon}</div>
        <div class="hc-name">${p.name}</div>
        <div class="hc-sum">${p.summary}</div>
      </div>`,
    )
    .join('');
  $('#hubGrid')
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
  const btnLabel = { oneday: '예약', crew: '가입', rental: '대여' }[pluginId] || '신청';

  const rows = items.length
    ? items
        .map((it) => {
          const meta =
            pluginId === 'oneday'
              ? `${it.host} · ${it.when} · 잔여 ${it.spotsLeft}`
              : pluginId === 'crew'
                ? `${it.neighborhood} · 멤버 ${it.members}명 · ${it.level} · ${it.meetup}`
                : `${won(it.pricePerDay)}/일 · 보증금 ${won(it.deposit)} · 재고 ${it.stock}`;
          const price =
            pluginId === 'oneday' ? (it.price ? won(it.price) : '무료') : '';
          return `
          <div class="hub-item">
            <div>
              <div class="hi-title">${it.title} ${price ? `<small style="color:var(--brand);font-weight:700">${price}</small>` : ''}</div>
              <div class="hi-meta">${meta}</div>
            </div>
            <button data-action="${action}" data-item="${it.id}">${btnLabel}</button>
          </div>`;
        })
        .join('')
    : `<div class="empty">${state.zone ? '이 지역에는 해당 상품이 없어요.' : '준비된 상품이 없어요.'}</div>`;

  $('#modal').innerHTML = `
    <div class="modal-hero">${plugin.icon}<button class="modal-close" id="closeModal">✕</button></div>
    <div class="modal-body">
      <h2>${plugin.name}</h2>
      <div class="section">${rows}</div>
    </div>`;
  $('#modalBackdrop').classList.add('open');
  $('#closeModal').addEventListener('click', closeDetail);
  $('#modal')
    .querySelectorAll('.hub-item button')
    .forEach((b) =>
      b.addEventListener('click', () => hubAction(pluginId, b.dataset.action, b.dataset.item)),
    );
}

async function hubAction(pluginId, action, itemId) {
  const userName = prompt('이름을 입력하세요', '게스트') || '게스트';
  const payload = { itemId, userName };
  if (pluginId === 'rental') payload.days = Number(prompt('대여 일수', '1')) || 1;
  const res = await api(`/api/hub/${pluginId}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.error) return toast('⚠ ' + res.error);
  const msg = {
    oneday: '✅ 원데이 클래스 예약 완료',
    crew: '✅ 크루 가입 완료',
    rental: `✅ 대여 신청 완료 (${res.order ? won(res.order.total) : ''})`,
  }[pluginId];
  toast(msg);
}

// ---- Detail modal ----
async function openDetail(id) {
  const { facility: f, promotions } = await api('/api/facilities/' + id);
  const promoHtml = promotions.length
    ? promotions
        .map(
          (p) =>
            `<div class="promo-banner">🎉 <b>${p.title}</b> — ${p.desc}${p.discountPct ? ` <b>(${p.discountPct}% 할인)</b>` : ''}</div>`,
        )
        .join('')
    : '';

  const plans = f.priceTable
    .map(
      (p) => `
      <div class="plan">
        <div>
          <div class="pname">${p.name}</div>
          <div class="pdesc">${p.period}${p.desc ? ' · ' + p.desc : ''}</div>
        </div>
        <div style="display:flex;align-items:center">
          <span class="pprice">${p.price ? won(p.price) : '무료'}</span>
          <button data-plan="${p.name}">${p.price ? '결제' : '신청'}</button>
        </div>
      </div>`,
    )
    .join('');

  const instructors = f.instructors
    .map(
      (i) => `
      <div class="instructor">
        <div class="avatar">🧑‍🏫</div>
        <div>
          <div class="iname">${i.name} <small style="color:var(--muted)">· ${i.specialty}</small></div>
          <div class="icareer">${i.career}</div>
          <div class="icareer">"${i.bio}"</div>
        </div>
      </div>`,
    )
    .join('');

  const classes = f.schedule
    .map((c) => {
      const full = c.spots <= 0;
      return `
      <div class="classrow ${full ? 'full' : ''}">
        <div>
          <b>${c.class}</b>
          <div class="spots">${c.day} ${c.time} · ${full ? '마감' : '잔여 ' + c.spots + '석'}</div>
        </div>
        <button ${full ? 'disabled' : ''} data-cls='${JSON.stringify({ className: c.class, classDay: c.day, classTime: c.time })}'>${full ? '마감' : '예약'}</button>
      </div>`;
    })
    .join('');

  const ratio = f.capacityMax ? f.currentOccupancy / f.capacityMax : 0;
  $('#modal').innerHTML = `
    <div class="modal-hero">
      ${f.emoji}
      <button class="modal-close" id="closeModal">✕</button>
    </div>
    <div class="modal-body">
      <div class="card-cat" style="position:static;display:inline-block;margin-bottom:8px">${catLabel(f.category)}</div>
      <h2>${f.name}</h2>
      <div class="card-meta">
        <span>${stars(f.rating)} <small>(${f.reviewCount} 후기)</small></span>
        ${occDot(ratio)} <small>${f.currentOccupancy}/${f.capacityMax}명</small>
        <span>📍 ${f.address}</span>
        <span>☎ ${f.phone}</span>
      </div>
      ${promoHtml}
      <p style="color:var(--muted);margin-top:14px">${f.description}</p>

      <div class="section">
        <h4>요금제 · 수강권</h4>
        ${plans}
      </div>
      <div class="section">
        <h4>강사 프로필</h4>
        ${instructors}
      </div>
      <div class="section">
        <h4>실시간 클래스 예약</h4>
        ${classes}
      </div>
    </div>`;

  $('#modalBackdrop').classList.add('open');
  $('#closeModal').addEventListener('click', closeDetail);

  $('#modal')
    .querySelectorAll('.plan button')
    .forEach((b) =>
      b.addEventListener('click', () => checkout(f.id, b.dataset.plan)),
    );
  $('#modal')
    .querySelectorAll('.classrow button:not([disabled])')
    .forEach((b) =>
      b.addEventListener('click', () => reserve(f.id, JSON.parse(b.dataset.cls))),
    );
}

function closeDetail() {
  $('#modalBackdrop').classList.remove('open');
}

async function checkout(facilityId, planName) {
  const userName = prompt('결제자 이름을 입력하세요', '게스트') || '게스트';
  const { pass, error } = await api('/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ facilityId, planName, userName }),
  });
  if (error) return toast('⚠ ' + error);
  const saved = pass.discountPct
    ? ` (프로모션 ${pass.discountPct}% 적용 → ${won(pass.paid)})`
    : '';
  toast(`✅ ${pass.planName} 등록 완료${saved}`);
}

async function reserve(facilityId, cls) {
  const userName = prompt('예약자 이름을 입력하세요', '게스트') || '게스트';
  const { reservation, error } = await api('/api/reservations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ facilityId, ...cls, userName }),
  });
  if (error) return toast('⚠ ' + error);
  toast(`✅ ${reservation.className} 예약 완료 (${reservation.classDay} ${reservation.classTime})`);
  openDetail(facilityId); // refresh remaining spots
}

// ---- Init ----
async function init() {
  state.meta = await api('/api/meta');
  const ageSel = $('#ageSelect');
  state.meta.ageGroups.forEach((a) => {
    const o = document.createElement('option');
    o.value = a.key;
    o.textContent = a.label;
    ageSel.appendChild(o);
  });

  // 공유 가능한 지역 링크 지원: /?zone=jbnu
  const urlZone = new URLSearchParams(location.search).get('zone');
  if (urlZone && findZone(urlZone)) state.zone = urlZone;

  renderChips();
  renderZones();
  renderZoneBanner();
  loadDeals();
  loadHub();

  ageSel.addEventListener('change', () => {
    state.ageGroup = ageSel.value;
    loadRecommendations();
  });

  $('#locSelect').addEventListener('change', (e) => {
    if (!e.target.value) {
      state.origin = null;
    } else {
      const [lat, lng] = e.target.value.split(',').map(Number);
      state.origin = { lat, lng };
    }
    loadFacilities();
    loadRecommendations();
  });

  $('#geoBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('브라우저가 위치를 지원하지 않아요');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.origin = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        $('#locSelect').value = '';
        toast('📍 현재 위치를 적용했어요');
        loadFacilities();
        loadRecommendations();
      },
      () => toast('위치를 가져오지 못했어요'),
    );
  });

  let searchTimer;
  $('#searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.q = e.target.value.trim();
      loadFacilities();
    }, 250);
  });

  $('#sortbtns')
    .querySelectorAll('.sortbtn')
    .forEach((b) =>
      b.addEventListener('click', () => {
        state.sort = b.dataset.sort;
        $('#sortbtns').querySelectorAll('.sortbtn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        if (state.sort === 'distance' && !state.origin) toast('거리순 정렬을 위해 위치를 설정하세요');
        loadFacilities();
      }),
    );

  $('#modalBackdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modalBackdrop') closeDetail();
  });

  loadFacilities();
}

init();
