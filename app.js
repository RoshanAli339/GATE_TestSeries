(function () {
  const tests = window.TEST_DATA.tests;
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  const providers = Array.from(new Set(tests.map(function (test) { return test.provider; })));
  const years = Array.from(new Set(tests.map(function (test) { return test.year; }))).sort();
  const sectionOrder = ['Full Mock Tests', 'Multi Subject Tests', 'Subject Wise Tests', 'Topic Wise Tests', 'PYQ Tests'];
  const sectionRank = { 'Full Mock Tests': 0, 'Multi Subject Tests': 1, 'Subject Wise Tests': 2, 'Topic Wise Tests': 3, 'PYQ Tests': 4 };
  const sections = sectionOrder.filter(function (section) { return tests.some(function (test) { return test.section === section; }); });
  const subjects = Array.from(new Set(tests.map(function (test) { return test.subject; }).filter(Boolean))).sort(collator.compare);

  const state = {
    provider: 'All',
    year: 'All',
    section: 'All',
    subject: 'All',
    sort: 'default',
    hideCompleted: false,
    q: ''
  };

  const els = {
    grid: document.getElementById('testGrid'),
    empty: document.getElementById('emptyState'),
    count: document.getElementById('resultCount'),
    search: document.getElementById('searchInput'),
    providerChips: document.getElementById('providerChips'),
    clear: document.getElementById('clearFilters'),
    emptyClear: document.getElementById('emptyClear'),
    year: document.getElementById('yearFilter'),
    section: document.getElementById('sectionFilter'),
    subject: document.getElementById('subjectFilter'),
    sort: document.getElementById('sortBy'),
    hide: document.getElementById('hideCompleted'),
    completion: document.getElementById('completionText')
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function slug(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function formatDuration(minutes) {
    if (!minutes) return 'Untimed';
    if (minutes < 60) return minutes + ' min';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? hours + 'h ' + rest + 'm' : hours + (hours === 1 ? ' hr' : ' hrs');
  }

  function formatClock(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return hours + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }
    return String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function testUrl(test, mode) {
    return 'test.html?id=' + encodeURIComponent(test.id) + '&mode=' + mode;
  }

  function buildSelect(select, values, allLabel, selected) {
    select.innerHTML = '';
    const all = document.createElement('option');
    all.value = 'All';
    all.textContent = allLabel;
    select.appendChild(all);
    values.forEach(function (value) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    });
    select.value = values.indexOf(selected) >= 0 || selected === 'All' ? selected : 'All';
  }

  function buildProviders() {
    const counts = {};
    tests.forEach(function (test) { counts[test.provider] = (counts[test.provider] || 0) + 1; });
    const values = ['All'].concat(providers);
    els.providerChips.innerHTML = '';
    values.forEach(function (provider) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip';
      button.dataset.provider = provider;
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = '<span>' + escapeHtml(provider === 'All' ? 'All providers' : provider) + '</span><span class="chip-count">' + (provider === 'All' ? tests.length : counts[provider]) + '</span>';
      button.addEventListener('click', function () {
        state.provider = provider;
        render();
        syncUrl();
      });
      els.providerChips.appendChild(button);
    });
  }

  function readUrlState() {
    const params = new URLSearchParams(location.search);
    const provider = params.get('provider');
    const year = params.get('year');
    const section = params.get('section');
    const subject = params.get('subject');
    const sort = params.get('sort');
    if (providers.indexOf(provider) >= 0) state.provider = provider;
    if (years.indexOf(year) >= 0) state.year = year;
    if (sections.indexOf(section) >= 0) state.section = section;
    if (subjects.indexOf(subject) >= 0) state.subject = subject;
    if (['newest', 'name', 'duration-asc', 'duration-desc'].indexOf(sort) >= 0) state.sort = sort;
    state.hideCompleted = params.get('hide') === '1';
    state.q = params.get('q') || '';
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (state.provider !== 'All') params.set('provider', state.provider);
    if (state.year !== 'All') params.set('year', state.year);
    if (state.section !== 'All') params.set('section', state.section);
    if (state.subject !== 'All') params.set('subject', state.subject);
    if (state.sort !== 'default') params.set('sort', state.sort);
    if (state.hideCompleted) params.set('hide', '1');
    if (state.q.trim()) params.set('q', state.q.trim());
    const next = location.pathname + (params.toString() ? '?' + params.toString() : '');
    history.replaceState(null, '', next);
  }

  function statusFor(test) {
    const saved = window.TestStore.get(test.id);
    if (!saved) return null;
    if (saved.status === 'completed') return { key: 'completed', label: 'Completed' };
    if (saved.status === 'active') {
      if (!saved.endsAt) return { key: 'active', label: 'In progress' };
      const remaining = saved.endsAt - Date.now();
      if (remaining > 0) return { key: 'active', label: formatClock(remaining / 1000) + ' left' };
      return { key: 'expired', label: 'Time up' };
    }
    return null;
  }

  function cardHtml(test) {
    const saved = window.TestStore.get(test.id);
    const status = statusFor(test);
    const startText = saved && saved.status === 'active' ? (status && status.key === 'expired' ? 'Review' : 'Resume') : saved && saved.status === 'completed' ? 'Retake' : 'Start';
    const meta = test.section === 'PYQ Tests'
      ? 'GATE previous year papers'
      : test.section + (test.category ? ' · ' + test.category : '');
    const statusHtml = status
      ? '<span class="status-badge status-' + status.key + '">' +
          (status.key === 'completed' ? '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' : '<i class="status-dot"></i>') +
          escapeHtml(status.label) + '</span>'
      : '';
    return '<article class="test-card">' +
      '<div class="card-head">' +
        '<span class="provider-badge provider-' + slug(test.provider) + '">' + escapeHtml(test.provider) + '</span>' +
        '<span class="year-badge">' + escapeHtml(test.year) + '</span>' +
        statusHtml +
      '</div>' +
      '<h3 class="card-title">' + escapeHtml(test.name) + '</h3>' +
      '<p class="card-meta">' + escapeHtml(meta) + '</p>' +
      '<div class="card-footer">' +
        '<span class="duration-badge"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 6v4.5l3 1.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' + escapeHtml(formatDuration(test.duration)) + '</span>' +
        '<div class="card-actions">' +
          '<a class="btn btn-primary btn-small" href="' + testUrl(test, 'test') + '">' + startText + '</a>' +
          '<a class="btn btn-ghost btn-small" href="' + testUrl(test, 'solution') + '">Solutions</a>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function applyFilters() {
    const terms = state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const progress = window.TestStore.all();
    let rows = tests.filter(function (test) {
      if (state.provider !== 'All' && test.provider !== state.provider) return false;
      if (state.year !== 'All' && test.year !== state.year) return false;
      if (state.section !== 'All' && test.section !== state.section) return false;
      if (state.subject !== 'All' && test.subject !== state.subject) return false;
      if (state.hideCompleted && progress[test.id] && progress[test.id].status === 'completed') return false;
      if (!terms.length) return true;
      const haystack = [test.name, test.provider, test.year, test.section, test.category, test.subject].join(' ').toLowerCase();
      return terms.every(function (term) { return haystack.indexOf(term) >= 0; });
    });

    if (state.sort === 'default') {
      rows = rows.slice().sort(function (a, b) {
        return collator.compare(a.provider, b.provider) || collator.compare(a.year, b.year) || (sectionRank[a.section] - sectionRank[b.section]) || collator.compare(a.category, b.category) || collator.compare(a.name, b.name);
      });
    } else if (state.sort === 'newest') {
      rows = rows.slice().sort(function (a, b) {
        return b.year.localeCompare(a.year) || collator.compare(a.provider, b.provider) || collator.compare(a.name, b.name);
      });
    } else if (state.sort === 'name') {
      rows = rows.slice().sort(function (a, b) { return collator.compare(a.name, b.name); });
    } else if (state.sort === 'duration-asc') {
      rows = rows.slice().sort(function (a, b) { return a.duration - b.duration || collator.compare(a.name, b.name); });
    } else if (state.sort === 'duration-desc') {
      rows = rows.slice().sort(function (a, b) { return b.duration - a.duration || collator.compare(a.name, b.name); });
    }
    return rows;
  }

  function render() {
    const rows = applyFilters();
    els.grid.innerHTML = rows.map(cardHtml).join('');
    els.count.textContent = rows.length === 1 ? 'Showing 1 test' : 'Showing ' + rows.length + ' of ' + tests.length + ' tests';
    els.empty.hidden = rows.length !== 0;
    els.grid.hidden = rows.length === 0;

    Array.from(els.providerChips.children).forEach(function (button) {
      const active = button.dataset.provider === state.provider;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });

    els.year.value = state.year;
    els.section.value = state.section;
    els.subject.value = state.subject;
    els.sort.value = state.sort;
    els.hide.checked = state.hideCompleted;
    if (document.activeElement !== els.search) els.search.value = state.q;
    els.completion.textContent = window.TestStore.completedCount() + ' completed';
  }

  function resetFilters() {
    state.provider = 'All';
    state.year = 'All';
    state.section = 'All';
    state.subject = 'All';
    state.sort = 'default';
    state.hideCompleted = false;
    state.q = '';
    render();
    syncUrl();
    els.search.focus();
  }

  let searchTimer = null;
  els.search.addEventListener('input', function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(function () {
      state.q = els.search.value;
      render();
      syncUrl();
    }, 120);
  });

  els.year.addEventListener('change', function () { state.year = els.year.value; render(); syncUrl(); });
  els.section.addEventListener('change', function () { state.section = els.section.value; render(); syncUrl(); });
  els.subject.addEventListener('change', function () { state.subject = els.subject.value; render(); syncUrl(); });
  els.sort.addEventListener('change', function () { state.sort = els.sort.value; render(); syncUrl(); });
  els.hide.addEventListener('change', function () { state.hideCompleted = els.hide.checked; render(); syncUrl(); });
  els.clear.addEventListener('click', resetFilters);
  els.emptyClear.addEventListener('click', resetFilters);

  document.addEventListener('keydown', function (event) {
    const tag = document.activeElement && document.activeElement.tagName;
    if (event.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
      event.preventDefault();
      els.search.focus();
    }
  });

  window.addEventListener('storage', render);
  window.addEventListener('pageshow', function (event) { if (event.persisted) render(); });
  setInterval(function () {
    const active = Object.keys(window.TestStore.all()).some(function (id) {
      const saved = window.TestStore.get(id);
      return saved && saved.status === 'active';
    });
    if (active) render();
  }, 30000);

  readUrlState();
  buildProviders();
  buildSelect(els.year, years, 'All years', state.year);
  buildSelect(els.section, sections, 'All test types', state.section);
  buildSelect(els.subject, subjects, 'All subjects', state.subject);
  render();
  syncUrl();
})();
