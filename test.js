(function () {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const mode = params.get('mode') === 'solution' ? 'solution' : 'test';
  const test = window.TEST_DATA.tests.find(function (item) { return item.id === id; });

  const els = {
    title: document.getElementById('testTitle'),
    meta: document.getElementById('testMeta'),
    timerBox: document.getElementById('timerBox'),
    timerLabel: document.getElementById('timerLabel'),
    timerValue: document.getElementById('timerValue'),
    timerTrack: document.getElementById('timerTrack'),
    timerFill: document.getElementById('timerFill'),
    finish: document.getElementById('finishBtn'),
    solution: document.getElementById('solutionBtn'),
    take: document.getElementById('takeBtn'),
    badge: document.getElementById('solutionBadge'),
    pdfLink: document.getElementById('pdfLink'),
    frame: document.getElementById('pdfFrame'),
    notFound: document.getElementById('notFound'),
    timeUp: document.getElementById('timeUpBanner'),
    timeUpSolutions: document.getElementById('timeUpSolutions'),
    toast: document.getElementById('toast')
  };

  function assetUrl(path) {
    return 'tests/' + path.split('/').map(encodeURIComponent).join('/');
  }

  function testUrl(targetMode) {
    return 'test.html?id=' + encodeURIComponent(test.id) + '&mode=' + targetMode;
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

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    setTimeout(function () { els.toast.hidden = true; }, 4200);
  }

  if (!test) {
    els.title.textContent = 'Test not found';
    els.meta.textContent = '';
    els.notFound.hidden = false;
    els.frame.hidden = true;
    document.querySelector('.viewer-actions').hidden = true;
    els.timeUp.hidden = true;
    return;
  }

  document.title = test.name + ' · Test Vault';
  els.title.textContent = test.name;
  els.frame.title = test.name + (mode === 'solution' ? ' solutions PDF' : ' question paper PDF');
  const metaParts = [test.provider, test.year, test.section];
  if (test.section !== 'PYQ Tests' && test.category) metaParts.push(test.category);
  if (test.combined) metaParts.push('Questions + solutions');
  els.meta.textContent = metaParts.filter(function (value, index, array) { return value && array.indexOf(value) === index; }).join(' · ');

  const questionUrl = assetUrl(test.q);
  const solutionUrl = assetUrl(test.s);
  const totalSeconds = Math.max(0, (test.duration || 0) * 60);
  let endAt = null;

  function elapsedSeconds() {
    if (!endAt || !totalSeconds) return 0;
    return Math.min(totalSeconds, Math.max(0, totalSeconds - (endAt - Date.now()) / 1000));
  }

  function completeAndOpenSolutions() {
    if (window.TestStore.get(test.id) && window.TestStore.get(test.id).status === 'active') {
      window.TestStore.complete(test.id, elapsedSeconds());
    }
    location.replace(testUrl('solution') + '&finished=1');
  }

  function openPdf(url) {
    els.frame.src = url + '#zoom=page-width&view=FitH';
    els.frame.hidden = false;
    els.pdfLink.href = url;
  }

  if (mode === 'solution') {
    els.badge.hidden = false;
    els.timerBox.hidden = true;
    els.timerTrack.hidden = true;
    els.finish.hidden = true;
    els.solution.hidden = true;
    els.take.hidden = false;
    els.take.href = testUrl('test');
    els.timeUp.hidden = true;
    openPdf(solutionUrl);

    const saved = window.TestStore.get(test.id);
    if (saved && saved.status === 'active') {
      endAt = saved.endsAt;
      window.TestStore.complete(test.id, elapsedSeconds());
    }
    if (params.get('finished') === '1') {
      showToast('Test finished. Solutions are ready.');
    }
    return;
  }

  els.finish.hidden = false;
  els.solution.hidden = false;
  els.take.hidden = true;
  els.badge.hidden = true;
  els.solution.href = testUrl('solution');
  openPdf(questionUrl);

  let saved = window.TestStore.get(test.id);
  if (!saved || saved.status !== 'active') {
    saved = window.TestStore.start(test.id, test.duration || 0);
  }
  endAt = saved.endsAt;

  if (!totalSeconds) {
    els.timerBox.hidden = false;
    els.timerLabel.textContent = 'Timer';
    els.timerValue.textContent = 'Untimed';
    els.timerTrack.hidden = true;
  } else {
    els.timerBox.hidden = false;
    els.timerTrack.hidden = false;
  }

  let flaggedTimeUp = false;

  function tick() {
    if (!totalSeconds || !endAt) return;
    const remaining = Math.max(0, (endAt - Date.now()) / 1000);
    const ratio = Math.max(0, Math.min(1, remaining / totalSeconds));
    els.timerValue.textContent = formatClock(remaining);
    els.timerLabel.textContent = remaining > 0 ? 'Time left' : 'Time up';
    els.timerFill.style.transform = 'scaleX(' + ratio + ')';
    els.timerBox.classList.toggle('timer-warning', remaining <= totalSeconds * 0.25 && remaining > totalSeconds * 0.1);
    els.timerBox.classList.toggle('timer-danger', remaining <= totalSeconds * 0.1);
    els.timerTrack.classList.toggle('timer-warning', remaining <= totalSeconds * 0.25 && remaining > totalSeconds * 0.1);
    els.timerTrack.classList.toggle('timer-danger', remaining <= totalSeconds * 0.1);
    document.title = (remaining > 0 ? formatClock(remaining) + ' · ' : 'Time up · ') + test.name;
    if (remaining <= 0 && !flaggedTimeUp) {
      flaggedTimeUp = true;
      els.timeUp.hidden = false;
    }
  }

  els.finish.addEventListener('click', function () {
    if (!window.confirm('Finish this test and open the solutions?')) return;
    completeAndOpenSolutions();
  });

  els.solution.addEventListener('click', function (event) {
    event.preventDefault();
    if (!window.confirm('Open the solutions now? This will end your timed attempt.')) return;
    completeAndOpenSolutions();
  });

  els.timeUpSolutions.addEventListener('click', completeAndOpenSolutions);
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('storage', function () {
    const latest = window.TestStore.get(test.id);
    if (latest && latest.status === 'completed') {
      location.replace(testUrl('solution'));
    }
  });

  tick();
  setInterval(tick, 250);
})();
