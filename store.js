window.TestStore = (function () {
  const KEY = 'testVault.progress.v1';

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      const value = raw ? JSON.parse(raw) : {};
      return value && typeof value === 'object' ? value : {};
    } catch (error) {
      return {};
    }
  }

  function write(value) {
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch (error) {
      return false;
    }
    return true;
  }

  function get(id) {
    return read()[id] || null;
  }

  function all() {
    return read();
  }

  function start(id, duration) {
    const now = Date.now();
    const value = read();
    value[id] = {
      status: 'active',
      duration: duration || 0,
      startedAt: now,
      endsAt: duration > 0 ? now + duration * 60000 : null
    };
    write(value);
    return value[id];
  }

  function complete(id, elapsedSeconds) {
    const value = read();
    const current = value[id] || {};
    value[id] = Object.assign({}, current, {
      status: 'completed',
      completedAt: Date.now(),
      elapsedSeconds: Math.max(0, Math.round(elapsedSeconds || 0))
    });
    write(value);
    return value[id];
  }

  function completedCount() {
    const value = read();
    return Object.keys(value).filter(function (id) {
      return value[id].status === 'completed';
    }).length;
  }

  return { get: get, all: all, start: start, complete: complete, completedCount: completedCount };
})();
