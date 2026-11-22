// Checks the rules that decide what the panel shows. Run: node test.js (build.js runs it too).
// The bookmarklet is one closed function, so we lift its plain helpers out of the source text.
const assert = require('assert');
const src = require('fs').readFileSync(__dirname + '/taxila-marks.js', 'utf8');

// Release check: VERSION in the code must match version.txt, or users never see (or keep seeing) the Update button.
assert.strictEqual(src.match(/var VERSION = (\d+);/)[1], require('fs').readFileSync(__dirname + '/version.txt', 'utf8').trim(), 'bump VERSION and version.txt together');
// The update bar links to CHANGELOG.md, so every release needs its entry there.
// GitHub Pages renders README.md and CHANGELOG.md with Jekyll, where {{ or {% would break the page.
for (const f of ['README.md', 'CHANGELOG.md']) assert(!/\{\{|\{%/.test(require('fs').readFileSync(__dirname + '/' + f, 'utf8')), f + ' must not contain {{ or {%');
assert(require('fs').readFileSync(__dirname + '/CHANGELOG.md', 'utf8').includes('## Version ' + src.match(/var VERSION = (\d+);/)[1] + '\n'), 'add a "## Version N" entry to CHANGELOG.md');
const code = src.match(/ {2}var C = [^\n]*\n/)[0] + src.slice(src.indexOf('  function esc'), src.indexOf('  async function upcoming'));
const f = new Function('BASE', code + 'return { isSubmitted, isPast, countdown, eventStatus, tidy, byKind, parseGrades, semOf, semKey };')('https://taxila.test');

// Semester tabs: code from the course name, S2-25 before S1-26, no code → Other (last)
assert.strictEqual(f.semOf('Machine Learning (S2-25_AIMLZG565)'), 'S2-25');
assert.strictEqual(f.semOf('Introduction to Python(NSP3_S2-25)'), 'S2-25');
assert.strictEqual(f.semOf('Labware_Deep Neural Networks'), 'Other');
assert.deepStrictEqual(['Other', 'S1-26', 'S2-25'].sort((a, b) => f.semKey(a) - f.semKey(b)), ['S2-25', 'S1-26', 'Other']);

// Submission status
assert(f.isSubmitted('Submitted for grading'));
assert(!f.isSubmitted('No submission'));
assert(!f.isSubmitted('Draft (not submitted)'));

// Taxila date text: past / future / unreadable
assert(f.isPast('Sunday, 23 August 2020, 11:59 PM'));
assert(!f.isPast('Sunday, 23 August 2099, 11:59 PM'));
assert(!f.isPast('') && !f.isPast('not a date'));

// Countdown wording
assert.strictEqual(f.countdown(30 * 60000), 'in 30 min');
assert.strictEqual(f.countdown(13 * 3600000), 'in 13 h');
assert.strictEqual(f.countdown(4 * 86400000), 'in 4 days');

// Calendar event status: quiz with no action = attempted; actionable = to do; not open yet = neither
const H = 3600000;
assert.deepStrictEqual([f.eventStatus({ modulename: 'quiz' }, null, H).done, f.eventStatus({ modulename: 'quiz' }, null, H).todo], [true, false]);
assert(f.eventStatus({ modulename: 'quiz', action: { actionable: true, name: 'Attempt quiz now' } }, null, H).todo);
const notOpen = f.eventStatus({ modulename: 'quiz', action: { actionable: false } }, null, H);
assert(!notOpen.todo && !notOpen.done);
assert(f.eventStatus({ modulename: 'assign' }, { kind: 'assign', sub: 'Submitted for grading' }, H).done);
assert(f.eventStatus({ modulename: 'assign' }, { kind: 'assign', sub: 'No submission' }, H).todo);

// Question-set grade items: keep only your set; collapse when none is yours; drop totals
const sets = ['Assignment-1: Set-1', 'Assignment-1: Set-5', 'Assignment-1: Set-9'].map(n => ({ name: n, type: 'Assignment', grade: null, max: 10 }));
const total = { name: 'Course total', grade: 5, max: 5, total: true };
assert.deepStrictEqual(f.tidy(sets.concat(total), { 'assignment-1: set-5': {} }).map(r => r.name), ['Assignment-1: Set-5']);
assert.deepStrictEqual(f.tidy(sets, {}).map(r => r.name), ['Assignment-1']);

// Order: quizzes, other, assignments; numbers in numeric order
const rows = [{ name: 'Assignment 2', type: 'Assignment' }, { name: 'Mid-sem', type: 'Manual item' }, { name: 'Quiz 10', type: 'Quiz' }, { name: 'Quiz 2', type: 'Quiz' }];
assert.deepStrictEqual(rows.sort(f.byKind).map(r => r.name), ['Quiz 2', 'Quiz 10', 'Mid-sem', 'Assignment 2']);

// A grade report that failed to load gives no rows instead of crashing
assert.deepStrictEqual(f.parseGrades(null), []);

console.log('all tests passed');
