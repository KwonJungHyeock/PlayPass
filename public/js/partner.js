// PlayPass partner dashboard — vanilla JS.
const $ = (s) => document.querySelector(s);
const api = async (p, o) => (await fetch(p, o)).json();
const won = (n) => n.toLocaleString('ko-KR') + '원';
let currentFacility = null;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

async function loadFacilityList() {
  const { facilities } = await api('/api/facilities');
  const sel = $('#facilitySelect');
  sel.innerHTML = facilities
    .map((f) => `<option value="${f.id}">${f.emoji} ${f.name}</option>`)
    .join('');
  sel.addEventListener('change', () => loadDashboard(sel.value));
  currentFacility = facilities[0].id;
  loadDashboard(currentFacility);
}

function statCard(k, v, sub) {
  return `<div class="stat"><div class="k">${k}</div><div class="v">${v}${sub ? ` <small>${sub}</small>` : ''}</div></div>`;
}

function barChart(data, container, unit) {
  const entries = Object.entries(data);
  const max = Math.max(1, ...entries.map(([, v]) => (typeof v === 'object' ? v.booked : v)));
  container.innerHTML = entries
    .map(([label, val]) => {
      const n = typeof val === 'object' ? val.booked : val;
      const pct = Math.round((n / max) * 100);
      return `
      <div class="bar-row">
        <span class="lab">${label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(pct, n ? 8 : 0)}%"></div></div>
        <span class="num">${n}${unit || ''}</span>
      </div>`;
    })
    .join('');
}

async function loadDashboard(facilityId) {
  currentFacility = facilityId;
  const data = await api(`/api/partner/${facilityId}/dashboard`);
  const { facility, reservations, stats, promotions, passes, revenue } = data;

  $('#facilityHint').textContent = `${facility.district} · ${facility.address}`;

  const occPct = Math.round(stats.occupancyRatio * 100);
  $('#statGrid').innerHTML = [
    statCard('오늘 예약', stats.totalReservations, '건'),
    statCard('출석 완료', stats.checkedIn, '명'),
    statCard('현재 수용률', occPct + '%', `${facility.currentOccupancy}/${facility.capacityMax}`),
    statCard('누적 매출', won(revenue), ''),
    statCard('판매 수강권', passes.length, '건'),
  ].join('');

  barChart(stats.byDay, $('#dayChart'), '건');
  barChart(stats.bySlot, $('#slotChart'), '건');

  // Reservations table
  $('#resBody').innerHTML = reservations.length
    ? reservations
        .map(
          (r) => `
        <tr>
          <td>${r.userName}</td>
          <td>${r.className}</td>
          <td>${r.classDay} ${r.classTime}</td>
          <td><span class="pill ${r.checkedIn ? 'in' : 'out'}">${r.checkedIn ? '출석' : '대기'}</span></td>
          <td><button class="checkbtn ${r.checkedIn ? 'on' : ''}" data-id="${r.id}">${r.checkedIn ? '출석취소' : '출석체크'}</button></td>
        </tr>`,
        )
        .join('')
    : `<tr><td colspan="5" style="color:var(--muted);padding:18px 8px">예약이 없습니다.</td></tr>`;

  $('#resBody')
    .querySelectorAll('.checkbtn')
    .forEach((b) =>
      b.addEventListener('click', async () => {
        await api('/api/partner/checkin', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reservationId: b.dataset.id }),
        });
        loadDashboard(facilityId);
      }),
    );

  // Promotions
  $('#promoList').innerHTML = promotions.length
    ? promotions
        .map(
          (p) => `
        <div class="promo-item">
          <div class="pt">
            <b>${p.title}</b> ${p.discountPct ? `<span class="badge">${p.discountPct}%</span>` : ''}
            <div>${p.desc}</div>
          </div>
          <button class="toggle ${p.active ? 'on' : ''}" data-id="${p.id}">${p.active ? '진행중' : '중지'}</button>
        </div>`,
        )
        .join('')
    : `<div style="color:var(--muted);padding:8px 0">등록된 프로모션이 없습니다.</div>`;

  $('#promoList')
    .querySelectorAll('.toggle')
    .forEach((b) =>
      b.addEventListener('click', async () => {
        await api(`/api/partner/promotions/${b.dataset.id}/toggle`, { method: 'POST' });
        loadDashboard(facilityId);
      }),
    );
}

$('#addPromo').addEventListener('click', async () => {
  const title = $('#promoTitle').value.trim();
  if (!title) return toast('프로모션 제목을 입력하세요');
  const body = {
    facilityId: currentFacility,
    type: $('#promoType').value,
    title,
    desc: $('#promoDesc').value.trim(),
    discountPct: $('#promoPct').value.trim(),
  };
  const { error } = await api('/api/partner/promotions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (error) return toast('⚠ ' + error);
  $('#promoTitle').value = '';
  $('#promoDesc').value = '';
  $('#promoPct').value = '';
  toast('✅ 프로모션이 등록되었습니다');
  loadDashboard(currentFacility);
});

loadFacilityList();
