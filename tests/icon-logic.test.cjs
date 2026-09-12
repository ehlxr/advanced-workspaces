// Tests for the pure icon decisions: the rule table that picks a glyph (and a
// brand slug) for a window, and the helpers that turn a class into a slug or a
// user override into something drawable.
//
// Both modules are QML libraries, so `.pragma library` is stripped before the
// file runs under Node's vm. Their top-level functions then land on the context
// object, which is all the assertions need.

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const vm = require('node:vm')

function load(file) {
  const context = {}
  vm.createContext(context)
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/^\.pragma library\s*/, ''),
    context,
    { filename: file })
  return context
}

const Logic = load('IconLogic.js')
const Rules = load('IconRules.js')
const plain = value => JSON.parse(JSON.stringify(value))

// --- slugs ------------------------------------------------------------------

test('slugify takes the last dot segment and drops the .desktop suffix', () => {
  assert.equal(Logic.slugify('io.anytype.anytype'), 'anytype')
  assert.equal(Logic.slugify('org.omarchy.herdr'), 'herdr')
  assert.equal(Logic.slugify('vivaldi-stable.desktop'), 'vivaldi-stable')
  assert.equal(Logic.slugify('code.desktop'), 'code')
  assert.equal(Logic.slugify('My App! v2'), 'my-app-v2')
  assert.equal(Logic.slugify(''), '')
  assert.equal(Logic.slugify(null), '')
  assert.equal(Logic.slugify('.foo.'), '')
})

test('remoteCandidates keeps order, drops empties and dedupes', () => {
  assert.deepEqual(plain(Logic.remoteCandidates(['vscode', 'code.desktop', 'code'])),
    ['vscode', 'code'])
  assert.deepEqual(plain(Logic.remoteCandidates(['io.anytype.anytype', 'anytype'])), ['anytype'])
  assert.deepEqual(plain(Logic.remoteCandidates(['', null, 'github'])), ['github'])
  assert.deepEqual(plain(Logic.remoteCandidates(null)), [])
})

// --- overrides --------------------------------------------------------------

test('lookupOverride matches a class in any case and a title exactly', () => {
  const overrides = { Code: 'vscode', 'title:LibrePods': 'me.kavishdevar.librepods' }
  assert.equal(Logic.lookupOverride(overrides, 'Code', ''), 'vscode')
  // Hyprland reports lowercase classes; the key is written however the user likes.
  assert.equal(Logic.lookupOverride(overrides, 'code', ''), 'vscode')
  assert.equal(Logic.lookupOverride({ code: 'vscode' }, 'CODE', ''), 'vscode')
  assert.equal(Logic.lookupOverride(overrides, 'Thing', 'LibrePods'), 'me.kavishdevar.librepods')
  assert.equal(Logic.lookupOverride(overrides, 'Thing', 'librepods'), '')
  assert.equal(Logic.lookupOverride(overrides, '', ''), '')
  assert.equal(Logic.lookupOverride(null, 'Code', ''), '')
  assert.equal(Logic.lookupOverride('nonsense', 'Code', ''), '')
})

test('an exact class key wins over a differently cased one', () => {
  assert.equal(Logic.lookupOverride({ code: 'lower', Code: 'exact' }, 'code', ''), 'lower')
  assert.equal(Logic.lookupOverride({ code: 'lower', Code: 'exact' }, 'Code', ''), 'exact')
})

test('a title key is never matched as a class', () => {
  // The class scan skips title: keys, so a window class that happens to share
  // the name does not pick up an override meant for one window.
  assert.equal(Logic.lookupOverride({ 'title:LibrePods': 'custom' }, 'LibrePods', ''), '')
  assert.equal(Logic.lookupOverride({ 'title:LibrePods': 'custom' }, 'x', 'LibrePods'), 'custom')
  // ...and the title lookup itself stays exact.
  assert.equal(Logic.lookupOverride({ 'title:LibrePods': 'custom' }, 'x', 'LIBREPODS'), '')
})

test('lookupOverride ignores keys whose value is null', () => {
  assert.equal(Logic.lookupOverride({ code: null }, 'code', ''), '')
})

test('classifyOverride reads images, and falls back to drawing the text', () => {
  assert.deepEqual(plain(Logic.classifyOverride('file:///x.png', null)),
    { kind: 'image', source: 'file:///x.png' })
  assert.deepEqual(plain(Logic.classifyOverride('image://icon/x', null)),
    { kind: 'image', source: 'image://icon/x' })
  assert.deepEqual(plain(Logic.classifyOverride('/home/me/x.png', null)),
    { kind: 'image', source: 'file:///home/me/x.png' })
  assert.deepEqual(plain(Logic.classifyOverride('vivaldi', () => 'image://icon/vivaldi')),
    { kind: 'image', source: 'image://icon/vivaldi' })
  // A name the theme does not have is a glyph to draw, not a broken image.
  assert.deepEqual(plain(Logic.classifyOverride('🦊', () => '')), { kind: 'text', value: '🦊' })
  assert.deepEqual(plain(Logic.classifyOverride('code', null)), { kind: 'text', value: 'code' })
  assert.equal(Logic.classifyOverride('   ', () => 'image://icon/x'), null)
  assert.equal(Logic.classifyOverride('', null), null)
})

// --- the rule table ---------------------------------------------------------

test('a browser tab on a named site keeps the site, not the browser', () => {
  const github = plain(Rules.match('vivaldi-stable', 'pull request - github'))
  assert.equal(github.site, true)
  assert.equal(github.logo, 'github')
})

test('a plain browser window falls through to the browser', () => {
  const plainPage = plain(Rules.match('vivaldi-stable', 'some article'))
  assert.equal(plainPage.site, false)
  assert.equal(plainPage.logo, '')
  assert.notEqual(plainPage.icon, '')
})

test('a generic site pattern never matches outside a browser window', () => {
  const folder = plain(Rules.match('thunar', 'my github folder'))
  assert.equal(folder.site, false)
  assert.equal(folder.logo, '')
})

test('a dedicated web-app class counts as a site', () => {
  assert.equal(plain(Rules.match('twitter-x', '')).logo, 'x')
  assert.equal(plain(Rules.match('twitter-x', '')).site, true)
})

test('class-only rules bind to the class, not a word in the title', () => {
  const editor = plain(Rules.match('code', 'notes about code'))
  assert.equal(editor.site, false)
  assert.notEqual(editor.icon, '')
  // The same word in an unrelated window's title must not claim VS Code.
  assert.notEqual(plain(Rules.match('thunar', 'notes about code')).icon, editor.icon)
})

test('an unknown window resolves to the fallback glyph', () => {
  const unknown = plain(Rules.match('totally-unknown-app', 'nothing to see'))
  assert.equal(unknown.site, false)
  assert.equal(unknown.logo, '')
  assert.equal(unknown.icon, Rules.fallback)
})

test('resolve returns the glyph alone', () => {
  assert.equal(Rules.resolve('thunar', ''), Rules.match('thunar', '').icon)
  assert.equal(typeof Rules.resolve('vivaldi-stable', 'x'), 'string')
})
