/* Taxila Marks: bookmarklet showing marks, deadlines and submission status across all Taxila (Moodle) courses.
   The bookmark runs a copy saved in the browser and offers an Update button when version.txt on GitHub main is newer.
   To release: bump VERSION below AND version.txt (test.js checks they match), run `node test.js`, push.
   Run `node build.js` only if the loader in build.js changes. */
(async function taxilaMarks() {
  var BASE = 'https://taxila-aws.bits-pilani.ac.in';
  var VERSION = 1;
  var REPO = 'https://raw.githubusercontent.com/ashutosh486/taxila-marks/main/';
  if (location.origin !== BASE) {
    if (confirm('Taxila Marks only works on a Taxila page. Open Taxila now? (Click the bookmark again once it loads.)')) {
      location.href = BASE + '/grade/report/overview/index.php';
    }
    return;
  }
  var old = document.getElementById('tm-overlay');
  if (old) { document.documentElement.style.overflow = old.dataset.prevOverflow; old.remove(); }

  var C = { ink: '#1c1c1a', muted: '#6b6b66', line: '#e4e3df', soft: '#f5f4f1', good: '#1f7a4d', mid: '#a86b00', low: '#b3261e', lowBg: '#fdecea', midBg: '#fff6e0' };
  var ov = document.createElement('div');
  ov.id = 'tm-overlay';
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(20,20,18,.55);overflow:auto;overscroll-behavior:contain;padding:32px 16px;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:' + C.ink;
  var box = document.createElement('div');
  box.style.cssText = 'background:#fff;max-width:820px;margin:0 auto;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,.35);padding:22px 26px 26px;position:relative';
  // Only ✕ closes the panel. It sits in the panel's top-right corner and sticks there while you scroll
  // (zero-height sticky bar, so it takes no space). It also covers the loading and error states.
  var bar = document.createElement('div');
  bar.style.cssText = 'position:sticky;top:22px;height:0;display:flex;justify-content:flex-end;z-index:1';
  var x = document.createElement('button');
  x.textContent = '✕';
  x.title = 'Close';
  x.setAttribute('aria-label', 'Close');
  x.style.cssText = 'margin:-10px -14px 0 0;border:0;background:#fff;width:36px;height:36px;border-radius:10px;font-size:16px;cursor:pointer;color:' + C.ink + ';box-shadow:0 1px 6px rgba(0,0,0,.25)';
  bar.appendChild(x);
  // "New version" notice; kept outside `content` so re-rendering the panel doesn't wipe it.
  var upd = document.createElement('div');
  upd.style.cssText = 'display:none;margin:0 40px 14px 0;padding:8px 12px;border-radius:8px;background:' + C.midBg;
  var content = document.createElement('div');
  content.innerHTML = '<div style="color:' + C.muted + '">Loading your marks and deadlines…</div>';
  box.append(bar, upd, content);
  ov.appendChild(box);
  // Scroll the panel, not the Taxila page behind it.
  ov.dataset.prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  document.body.appendChild(ov);

  function close() { document.documentElement.style.overflow = ov.dataset.prevOverflow; ov.remove(); }
  x.onclick = close;

  // Update check: fetch only the tiny version.txt; download the code only when the user clicks Update.
  fetch(REPO + 'version.txt', { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (v) {
    if (!(Number(v) > VERSION)) return;
    upd.innerHTML = 'A new version of Taxila Marks is available. <button style="margin-left:8px;padding:4px 12px;border:1px solid ' + C.line + ';border-radius:6px;background:#fff;font:inherit;font-weight:600;cursor:pointer">Update</button>';
    upd.style.display = '';
    var b = upd.querySelector('button');
    b.onclick = function () {
      b.disabled = true;
      b.textContent = 'Updating…';
      fetch(REPO + 'taxila-marks.js', { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      }).then(function (code) {
        localStorage.setItem('tm-code', code); // the bookmark runs this saved copy from now on
        (0, eval)(code); // reopens the panel on the new version (it removes this one)
      }).catch(function () { b.disabled = false; b.textContent = 'Update failed, try again'; });
    };
  }).catch(function () {}); // offline or GitHub unreachable: skip the check quietly

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(n) { return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''); }
  function colour(g, m) { var p = m ? g / m : 1; return p >= 0.8 ? C.good : p >= 0.5 ? C.mid : C.low; }
  function norm(s) { return String(s).toLowerCase().replace(/\s+/g, ' ').trim(); }
  function shortDate(s) { return s.replace(/^[A-Za-z]+day,\s*/, '').replace(new RegExp(' ' + new Date().getFullYear() + ','), ','); }
  function span(colour, text, bold) { return '<span style="color:' + colour + (bold ? ';font-weight:600' : '') + '">' + text + '</span>'; }
  function isSubmitted(sub) { return /submitted for grading|^submitted/.test(norm(sub || '')); }
  // Chrome parses Taxila's "Sunday, 23 August 2026, 11:59 PM"; if a browser can't, NaN < now is false → treated as not past.
  function isPast(s) { return new Date(s) < Date.now(); }
  function countdown(ms) {
    if (ms < 0) return 'overdue';
    var h = ms / 3600000;
    if (h < 1) return 'in ' + Math.max(1, Math.round(ms / 60000)) + ' min';
    if (h < 48) return 'in ' + Math.round(h) + ' h';
    return 'in ' + Math.round(h / 24) + ' days';
  }
  function cmidOf(href) { try { return new URL(href, BASE).searchParams.get('id'); } catch (e) { return null; } }

  async function get(path) {
    var r = await fetch(BASE + path, { credentials: 'include' });
    if (r.url.indexOf('/login/') !== -1) throw new Error('You seem to be logged out. Log in to Taxila and click the bookmark again.');
    return new DOMParser().parseFromString(await r.text(), 'text/html');
  }

  function parseGrades(doc) {
    var out = [];
    if (!doc) return out; // grade report failed to load; the course still shows its quizzes/assignments
    doc.querySelectorAll('table.user-grade tr').forEach(function (r) {
      var th = r.querySelector('th.column-itemname'), g = r.querySelector('td.column-grade');
      if (!th || !g) return;
      var h = th.querySelector('.gradeitemheader') || th.querySelector('.rowtitle') || th;
      var name = h.textContent.replace(/\s+/g, ' ').trim();
      var typeEl = th.querySelector('.dimmed_text');
      var gm = g.textContent.trim().match(/^-?\d+(\.\d+)?/);
      var rangeEl = r.querySelector('td.column-range');
      var rm = rangeEl ? rangeEl.textContent.trim().match(/([\d.]+)\s*$/) : null;
      var isTotal = /category|baggt|courseitem/.test(th.className) || /total/i.test(name);
      out.push({ name: name, type: typeEl ? typeEl.textContent.trim() : '', grade: gm ? parseFloat(gm[0]) : null, max: rm ? parseFloat(rm[1]) : null, total: isTotal });
    });
    return out;
  }

  /* Reads /mod/assign/index.php or /mod/quiz/index.php: activity name, due/close date, submission status. */
  function parseActivities(doc, kind, map) {
    var t = doc && doc.querySelector('table.generaltable');
    if (!t) return;
    var heads = Array.prototype.map.call(t.querySelectorAll('thead th'), function (th) { return norm(th.textContent); });
    function col(re) { for (var i = 0; i < heads.length; i++) if (re.test(heads[i])) return i; return -1; }
    var iDue = col(/due|closes/), iSub = col(/submission/), iGrade = col(/\bgrade$/);
    t.querySelectorAll('tbody tr').forEach(function (tr) {
      var a = tr.querySelector('a[href*="view.php"]');
      if (!a) return;
      var cells = tr.querySelectorAll('td, th');
      function cell(i) { return i >= 0 && cells[i] ? cells[i].textContent.replace(/\s+/g, ' ').trim() : ''; }
      var due = cell(iDue);
      // Grade column reads like "10.00 / 10.00", "10.00/10.00" or "-".
      var gm = cell(iGrade).match(/^(-?\d+(?:\.\d+)?)(?:\s*(?:\/|out of)\s*(\d+(?:\.\d+)?))?/);
      var name = a.textContent.replace(/\s+/g, ' ').trim();
      map[norm(name)] = { kind: kind, name: name, due: due === '-' ? '' : due, sub: cell(iSub), grade: gm ? parseFloat(gm[1]) : null, max: gm && gm[2] ? parseFloat(gm[2]) : null,
        // The quiz list links are relative ("view.php?id=…"), so resolve them against the list page, not the site root.
        cmid: cmidOf(a.getAttribute('href')), href: new URL(a.getAttribute('href'), BASE + '/mod/' + kind + '/index.php').href };
    });
  }

  function subBadge(info, msLeft) {
    if (!info || info.kind !== 'assign' || !info.sub) return '';
    var s = norm(info.sub);
    if (isSubmitted(s)) return span(C.good, '✅ Submitted');
    if (/draft/.test(s)) return span(C.mid, '📝 Draft, not submitted');
    if (/no submission|not submitted/.test(s)) {
      var urgent = msLeft !== undefined && msLeft < 48 * 3600000;
      return span(urgent ? C.low : C.mid, '⚠️ Not submitted', true);
    }
    return span(C.muted, esc(info.sub));
  }

  /* Status of a calendar event: { todo, done, html }. Moodle drops an event's action once you've submitted/attempted it. */
  function eventStatus(e, info, left) {
    var a = e.action, warn = left < 48 * 3600000 ? C.low : C.mid;
    if (info && info.kind === 'assign' && info.sub) return { todo: !isSubmitted(info.sub), done: isSubmitted(info.sub), html: subBadge(info, left) };
    // shortcut: "no action" on a quiz is read as attempted (mod_quiz behaviour); fetch quiz view.php if this ever lies.
    if (!a) return e.modulename === 'quiz' ? { todo: false, done: true, html: span(C.good, '✅ Attempted') } : { todo: false, html: '' };
    if (!a.actionable) return { todo: false, html: span(C.muted, 'Not open yet') };
    return { todo: true, html: span(warn, '⚠️ ' + (e.modulename === 'quiz' ? 'Not attempted' : esc(a.name)), true) };
  }

  /* NLP-style courses list one grade item per question set (Set-1 … Set-15); you only do one.
     Keep sets that are graded or visible to you; otherwise collapse the group into one "pending" row. */
  function tidy(items, acts) {
    var groups = {}, order = [];
    items.forEach(function (it) {
      if (it.total) return;
      var base = it.name.replace(/\s*[:\-–]\s*set[\s\-]*\d+\s*$/i, '').trim();
      if (!groups[base]) { groups[base] = []; order.push(base); }
      groups[base].push(it);
    });
    var rows = [];
    order.forEach(function (base) {
      var list = groups[base];
      if (list.length === 1) { rows.push(list[0]); return; }
      var keep = list.filter(function (i) { return i.grade !== null || acts[norm(i.name)]; });
      if (keep.length) rows = rows.concat(keep);
      else rows.push({ name: base, type: list[0].type, grade: null, max: list[0].max });
    });
    return rows;
  }

  /* Course rows: quizzes first, other graded items, then assignments; numeric order within each. */
  function kindOf(r) { var s = norm(r.type + ' ' + r.name); return /quiz/.test(s) ? 0 : /assign/.test(s) ? 2 : 1; }
  function byKind(a, b) { return kindOf(a) - kindOf(b) || a.name.localeCompare(b.name, undefined, { numeric: true }); }

  /* Semester code from a course name, e.g. "Machine Learning (S2-25_AIMLZG565)" → "S2-25". S<term>-<year>, so S2-25 comes before S1-26. */
  function semOf(name) { var m = String(name).match(/S[12]-\d{2}/); return m ? m[0] : 'Other'; }
  function semKey(s) { var m = s.match(/S(\d)-(\d+)/); return m ? +m[2] * 10 + +m[1] : Infinity; }

  async function upcoming() {
    var key = window.M && M.cfg && M.cfg.sesskey;
    if (!key) return null;
    try {
      var r = await fetch(BASE + '/lib/ajax/service.php?sesskey=' + encodeURIComponent(key) + '&info=core_calendar_get_calendar_upcoming_view', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ index: 0, methodname: 'core_calendar_get_calendar_upcoming_view', args: { courseid: 1, categoryid: 0 } }])
      });
      var j = await r.json();
      return j && j[0] && !j[0].error ? j[0].data.events : null;
    } catch (e) { return null; }
  }

  try {
    var ovDoc = await get('/grade/report/overview/index.php');
    var seen = {}, courses = [];
    ovDoc.querySelectorAll('a[href*="mode=grade"]').forEach(function (a) {
      var id = cmidOf(a.getAttribute('href'));
      if (id && !seen[id]) { seen[id] = 1; courses.push({ id: id, name: a.textContent.trim() }); }
    });
    function soft(p) { return get(p).catch(function (e) { if (/logged out/.test(e.message)) throw e; return null; }); }

    var eventsP = upcoming();
    var data = await Promise.all(courses.map(async function (c) {
      var docs = await Promise.all([soft('/grade/report/user/index.php?id=' + c.id), soft('/mod/assign/index.php?id=' + c.id), soft('/mod/quiz/index.php?id=' + c.id)]);
      var acts = {};
      parseActivities(docs[1], 'assign', acts);
      parseActivities(docs[2], 'quiz', acts);
      var rows = tidy(parseGrades(docs[0]), acts), have = {};
      rows.forEach(function (r) {
        have[norm(r.name)] = 1;
        var i = acts[norm(r.name)];
        if (r.grade === null && i && i.grade !== null) { r.grade = i.grade; if (r.max === null) r.max = i.max; }
      });
      // Some quizzes/assignments are hidden from the grade report; add them from the activity lists.
      Object.keys(acts).forEach(function (k) {
        var i = acts[k];
        if (!have[k]) rows.push({ name: i.name, type: i.kind === 'quiz' ? 'Quiz' : 'Assignment', grade: i.grade, max: i.max });
      });
      return { id: c.id, name: c.name, acts: acts, rows: rows.sort(byKind) };
    }));
    var events = await eventsP;

    var byCmid = {}, courseName = {};
    data.forEach(function (c) {
      courseName[c.id] = c.name;
      Object.keys(c.acts).forEach(function (k) { if (c.acts[k].cmid) byCmid[c.acts[k].cmid] = c.acts[k]; });
    });

    var now = Date.now();
    var html = '<div style="font-size:20px;font-weight:650;margin:0 0 2px">My marks</div>'
      + '<div style="color:' + C.muted + ';margin-bottom:18px">Updated ' + esc(new Date().toLocaleString()) + ' · straight from Taxila</div>';

    /* ---- Due soon / Completed (upcoming deadlines, split by whether you've already done them) ---- */
    function heading(t) { return '<div style="font-weight:650;margin:0 0 8px">' + t + '</div>'; }
    function note(t) { return '<div style="color:' + C.muted + ';margin-bottom:18px">' + t + '</div>'; }
    function eventList(list) {
      return '<div style="border:1px solid ' + C.line + ';border-radius:10px;overflow:hidden;margin-bottom:22px">' + list.map(function (x, idx) {
        var e = x.e, st = x.st, info = x.info, left = x.t - now;
        var urgent = st.todo && left < 48 * 3600000;
        var bg = urgent ? C.lowBg : st.todo ? C.midBg : '#fff';
        var cname = (e.course && (courseName[e.course.id] || e.course.fullname)) || '';
        // A quiz has an "opens" event too; info.due is its close date, so don't use it there.
        var opens = e.eventtype === 'open';
        /* Prefer Taxila's own wording of the date (Taxila's timezone), so it matches what the course page says. */
        var when = info && info.due && !opens ? shortDate(info.due)
          : new Date(x.t).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
        return '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:10px 16px;background:' + bg + (idx ? ';border-top:1px solid ' + C.line : '') + '">'
          + '<div style="min-width:0"><a href="' + esc(e.url || '#') + '" style="font-weight:600;color:' + C.ink + ';text-decoration:none">' + esc(opens ? e.name : e.activityname || e.name) + '</a>'
          + '<div style="color:' + C.muted + ';font-size:12.5px">' + esc(cname) + '</div></div>'
          + '<div style="text-align:right;white-space:nowrap"><div><b style="color:' + (urgent ? C.low : C.ink) + '">' + esc(countdown(left)) + '</b>'
          + '<span style="color:' + C.muted + '"> · ' + esc(when) + '</span></div>'
          + '<div style="font-size:12.5px">' + st.html + '</div></div></div>';
      }).join('') + '</div>';
    }
    if (events === null) {
      html += heading('Due soon') + note('Couldn\'t load the calendar. Deadlines are still shown per course below.');
    } else {
      var due = [], done = [];
      events.slice().sort(function (a, b) { return a.timesort - b.timesort; }).forEach(function (e) {
        var t = (e.timesort || e.timestart) * 1000;
        var info = e.url ? byCmid[cmidOf(e.url)] : null;
        var st = eventStatus(e, info, t - now);
        (st.done ? done : due).push({ e: e, t: t, info: info, st: st });
      });
      html += heading('Due soon') + (due.length ? eventList(due) : note(done.length ? 'All caught up 🎉' : 'Nothing due in the coming weeks 🎉'));
      if (done.length) html += heading('Completed') + eventList(done);
    }

    /* ---- Per course, grouped into one tab per semester ---- */
    var groups = {};
    data.forEach(function (c) {
      var sem = semOf(c.name), grp = groups[sem] || (groups[sem] = { html: '', empty: [] });
      if (!c.rows.length) { grp.empty.push(c.name); return; }
      var got = 0, out = 0, todo = 0, missed = 0, waiting = 0, other = 0;
      c.rows.forEach(function (r) {
        if (r.grade !== null) { got += r.grade; out += r.max || 0; return; }
        var i = c.acts[norm(r.name)];
        if (i && i.kind === 'assign' && i.sub) { if (isSubmitted(i.sub)) waiting++; else if (isPast(i.due)) missed++; else todo++; } else other++;
      });
      var counts = [];
      if (todo) counts.push(span(C.low, todo + ' to do', true));
      if (missed) counts.push(missed + ' missed');
      if (waiting) counts.push(waiting + ' awaiting grade');
      if (other) counts.push(other + ' pending');
      grp.html += '<div style="border:1px solid ' + C.line + ';border-radius:10px;margin-bottom:14px;overflow:hidden">'
        + '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;padding:12px 16px;background:' + C.soft + '">'
        + '<a href="' + BASE + '/grade/report/user/index.php?id=' + c.id + '" style="font-weight:650;color:' + C.ink + ';text-decoration:none">' + esc(c.name) + '</a>'
        + '<span style="white-space:nowrap"><b style="font-size:16px;color:' + (out ? colour(got, out) : C.muted) + '">' + fmt(got) + ' / ' + fmt(out) + '</b>'
        + (counts.length ? '<span style="color:' + C.muted + '"> · ' + counts.join(' · ') + '</span>' : '') + '</span></div>'
        + '<table style="width:100%;border-collapse:collapse">';
      c.rows.forEach(function (r) {
        var info = c.acts[norm(r.name)];
        var meta = r.type ? [esc(r.type)] : [];
        // Dates and status only matter until it's graded.
        if (r.grade === null) {
          if (info && info.due) {
            var past = isPast(info.due);
            meta.push((info.kind === 'quiz' ? (past ? 'Closed ' : 'Closes ') : (past ? 'Was due ' : 'Due ')) + esc(shortDate(info.due)));
          }
          var badge = subBadge(info);
          if (badge) meta.push(badge);
        }
        var g = r.grade === null
          ? '<span style="color:' + C.muted + '">–' + (r.max !== null ? ' / ' + fmt(r.max) : '') + '</span>'
          : '<b style="color:' + colour(r.grade, r.max) + '">' + fmt(r.grade) + '</b>' + (r.max !== null ? '<span style="color:' + C.muted + '"> / ' + fmt(r.max) + '</span>' : '');
        var label = info ? '<a href="' + esc(info.href) + '" style="color:' + C.ink + ';text-decoration:none">' + esc(r.name) + '</a>' : esc(r.name);
        grp.html += '<tr style="border-top:1px solid ' + C.line + '">'
          + '<td style="padding:8px 16px">' + label
          + (meta.length ? '<div style="color:' + C.muted + ';font-size:12.5px">' + meta.join(' · ') + '</div>' : '') + '</td>'
          + '<td style="padding:8px 16px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;vertical-align:top">' + g + '</td></tr>';
      });
      grp.html += '</table></div>';
    });
    var all = Object.keys(groups).sort(function (a, b) { return semKey(a) - semKey(b); });
    // A semester with nothing graded gets no tab; its "No graded items" names go to the default tab.
    var sems = all.filter(function (s) { return groups[s].html; });
    if (!sems.length) sems = all;
    var pick = sems.filter(function (s) { return s !== 'Other'; }).pop() || sems[0]; // open on the latest semester
    all.forEach(function (s) { if (sems.indexOf(s) < 0) groups[pick].empty = groups[pick].empty.concat(groups[s].empty); });
    if (sems.length > 1) html += '<div role="tablist" style="display:flex;gap:4px;border-bottom:1px solid ' + C.line + ';margin-bottom:14px;overflow-x:auto">'
      + sems.map(function (s) {
        return '<button role="tab" data-sem="' + s + '" style="border:0;border-bottom:2px solid transparent;margin-bottom:-1px;background:none;padding:8px 12px;font:inherit;font-weight:600;white-space:nowrap;cursor:pointer">'
          + (s === 'Other' ? 'Other' : 'Semester ' + (all.indexOf(s) + 1) + ' (' + s + ')') + '</button>';
      }).join('') + '</div>';
    sems.forEach(function (s) {
      var e = groups[s].empty;
      html += '<div role="tabpanel" data-panel="' + s + '">' + groups[s].html
        + (e.length ? '<div style="color:' + C.muted + ';font-size:13px">No graded items in: ' + e.map(esc).join(', ') + '</div>' : '') + '</div>';
    });
    content.innerHTML = html;
    function show(s) {
      box.querySelectorAll('[data-sem]').forEach(function (b) {
        var on = b.dataset.sem === s;
        b.setAttribute('aria-selected', on);
        b.style.color = on ? C.ink : C.muted;
        b.style.borderBottomColor = on ? C.ink : 'transparent';
      });
      box.querySelectorAll('[data-panel]').forEach(function (p) { p.style.display = p.dataset.panel === s ? '' : 'none'; });
    }
    box.querySelectorAll('[data-sem]').forEach(function (b) { b.onclick = function () { show(b.dataset.sem); }; });
    show(pick);
    // Open links in a new tab: navigating this tab would destroy the panel (a bookmarklet can't come back after Back).
    box.querySelectorAll('a').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener'; });
  } catch (e) {
    content.innerHTML = '<div style="color:' + C.low + '">' + esc(e.message || e) + '</div>';
  }
})();
