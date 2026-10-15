// Tests for the pure icon decisions: the rule table that picks a glyph (and a
// brand slug) for a window, the helpers that turn a class into a slug or a user
// override into something drawable, and the matching of a Chromium web-app
// class back to the URL its desktop entry launches.
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

test('fileName keeps slugs while folding anything unsafe out of a path', () => {
  // Plain slugs, rule-table logos and mixed case pass straight through.
  assert.equal(Logic.fileName('github'), 'github')
  assert.equal(Logic.fileName('facebook-messenger'), 'facebook-messenger')
  assert.equal(Logic.fileName('Vivaldi'), 'Vivaldi')
  // Slashes become dashes, so nothing can escape the cache directory.
  assert.equal(Logic.fileName('../etc/passwd'), 'etc-passwd')
  assert.equal(Logic.fileName('..'), 'logo')
  assert.equal(Logic.fileName('.'), 'logo')
  // A leading dot no longer hides the entry, and empties fall back.
  assert.equal(Logic.fileName('.cache'), 'cache')
  assert.equal(Logic.fileName(''), 'logo')
  assert.equal(Logic.fileName(null), 'logo')
  assert.equal(Logic.fileName(undefined), 'logo')
  // Dots and hyphens survive only inside the one component.
  assert.equal(Logic.fileName('io.github.ehlxr'), 'io.github.ehlxr')
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

// --- Chromium web apps ------------------------------------------------------

test('webAppName is the host, an underscore, then the path with slashes folded', () => {
  assert.equal(Logic.webAppName('https://discord.com/channels/@me'), 'discord.com__channels_@me')
  // A bare origin has the path "/", hence the double underscore.
  assert.equal(Logic.webAppName('https://www.notion.so'), 'www.notion.so__')
  assert.equal(Logic.webAppName('https://www.notion.so/'), 'www.notion.so__')
  assert.equal(Logic.webAppName('https://cakeagency.teamwork.com/app/home'),
    'cakeagency.teamwork.com__app_home')
  // The query, fragment, port and user info never reach the class.
  assert.equal(Logic.webAppName('https://me@Mail.Example.com:8443/inbox?tab=1#top'),
    'mail.example.com__inbox')
  assert.equal(Logic.webAppName('file:///home/me/page.html'), '')
  assert.equal(Logic.webAppName('discord.com'), '')
  assert.equal(Logic.webAppName(''), '')
  assert.equal(Logic.webAppName(null), '')
})

test('webAppUrl reads omarchy-launch-webapp and --app= launchers', () => {
  assert.equal(Logic.webAppUrl('omarchy-launch-webapp https://discord.com/channels/@me'),
    'https://discord.com/channels/@me')
  assert.equal(Logic.webAppUrl(
    'omarchy-launch-webapp "https://cakeagency.teamwork.com/app/home" --profile-directory="Profile 1"'),
    'https://cakeagency.teamwork.com/app/home')
  assert.equal(Logic.webAppUrl('/usr/bin/omarchy-launch-webapp https://www.notion.so'),
    'https://www.notion.so')
  assert.equal(Logic.webAppUrl('chromium --app=https://www.notion.so --profile-directory=Default'),
    'https://www.notion.so')
  assert.equal(Logic.webAppUrl('chromium --app="https://discord.com/channels/@me" %U'),
    'https://discord.com/channels/@me')
  assert.equal(Logic.webAppUrl("brave '--app=https://x.com/home'"), 'https://x.com/home')
  // DesktopEntry.command is already split, with the quotes gone.
  assert.equal(Logic.webAppUrl(['chromium', '--app=https://discord.com/channels/@me']),
    'https://discord.com/channels/@me')
  assert.equal(Logic.webAppUrl(['omarchy-launch-webapp', 'https://www.notion.so']),
    'https://www.notion.so')
  // Not a web app.
  assert.equal(Logic.webAppUrl('chromium %U'), '')
  assert.equal(Logic.webAppUrl('omarchy-launch-webapp'), '')
  assert.equal(Logic.webAppUrl(''), '')
  assert.equal(Logic.webAppUrl(null), '')
})

test('a web-app class matches the URL that opened it', () => {
  assert.equal(Logic.webAppClassMatches('chrome-discord.com__channels_@me-Default',
    'https://discord.com/channels/@me'), true)
  assert.equal(Logic.webAppClassMatches('chrome-www.notion.so__-Default', 'https://www.notion.so'), true)
  // Another profile, another browser, and the lowercased class the rules see.
  assert.equal(Logic.webAppClassMatches('chromium-cakeagency.teamwork.com__app_home-Profile_1',
    'https://cakeagency.teamwork.com/app/home'), true)
  assert.equal(Logic.webAppClassMatches('brave-x.com__home-Default', 'https://x.com/home'), true)
  assert.equal(Logic.webAppClassMatches('chrome-discord.com__channels_@me-default',
    'https://discord.com/channels/@me'), true)
  // A dash inside the host is part of the app name, not a boundary.
  assert.equal(Logic.webAppClassMatches('chrome-my-site.com__-Default', 'https://my-site.com/'), true)
})

test('a web-app class does not match a different URL', () => {
  // Same host, different path: the app name is the whole thing, not a prefix.
  assert.equal(Logic.webAppClassMatches('chrome-discord.com__-Default',
    'https://discord.com/channels/@me'), false)
  assert.equal(Logic.webAppClassMatches('chrome-discord.com__channels_@me-Default',
    'https://discord.com/'), false)
  // x.com is not foo-x.com, even though "-x.com__-" sits in that class.
  assert.equal(Logic.webAppClassMatches('chrome-foo-x.com__-Default', 'https://x.com/'), false)
  assert.equal(Logic.webAppClassMatches('chrome-www.notion.so__-Default', 'https://notion.so'), false)
  // Ordinary classes are not web apps at all.
  assert.equal(Logic.webAppClassMatches('google-chrome', 'https://www.notion.so'), false)
  assert.equal(Logic.webAppClassMatches('discord', 'https://discord.com/channels/@me'), false)
  assert.equal(Logic.webAppClassMatches('chrome-www.notion.so__-Default', ''), false)
})

test('isWebAppClass spots the browser-app-profile shape', () => {
  assert.equal(Logic.isWebAppClass('chrome-discord.com__channels_@me-Default'), true)
  assert.equal(Logic.isWebAppClass('vivaldi-chatgpt.com__-default'), true)
  assert.equal(Logic.isWebAppClass('google-chrome'), false)
  assert.equal(Logic.isWebAppClass('com.mitchellh.ghostty'), false)
  assert.equal(Logic.isWebAppClass('vivaldi-stable'), false)
  assert.equal(Logic.isWebAppClass(''), false)
})

// --- the rule table ---------------------------------------------------------

test('a browser tab on a named site keeps the site, not the browser', () => {
  const github = plain(Rules.match('vivaldi-stable', 'pull request - github'))
  assert.equal(github.site, true)
  assert.equal(github.logo, 'github')
})

test('a site rule matches the tab segment that names it', () => {
  const cases = [
    ['收件箱 (3) - me@gmail.com - gmail', 'gmail'],
    ['gmail', 'gmail'],
    ['Inbox | Gmail', 'gmail'],
    ['Inbox — Gmail', 'gmail'],
    ['pull request · GitHub', 'github'],
    ['Some Song - YouTube', 'youtube']
  ]
  for (const [title, logo] of cases) {
    const rule = plain(Rules.match('vivaldi-stable', title.toLowerCase()))
    assert.equal(rule.site, true, `expected a site match for "${title}"`)
    assert.equal(rule.logo, logo, `wrong logo for "${title}"`)
  }
})

test('a page that merely mentions a brand does not wear its logo', () => {
  // The case that prompted this: a project page whose description names Gmail,
  // open in a browser. It is not Gmail.
  const mentioned = plain(Rules.match('vivaldi-stable',
    'huacnlee/omamail: omarchy mail plugin with gmail, hey and imap support'))
  assert.equal(mentioned.site, false)
  assert.equal(mentioned.logo, '')

  const buried = plain(Rules.match('vivaldi-stable', 'my youtube subscription list backup'))
  assert.equal(buried.site, false)
  assert.equal(buried.logo, '')
})

test('non-site rules still match anywhere in the title', () => {
  // Picture-in-Picture is an application rule, not a site, so a substring match
  // is still the right answer for it.
  const pip = plain(Rules.match('firefox', 'video - picture-in-picture'))
  assert.equal(pip.site, false)
  assert.notEqual(pip.icon, Rules.fallback)
})

test('a web-app window still matches on its own class', () => {
  // A Chromium PWA reports a class of its own, and that is a site even when the
  // title says nothing about it.
  const pwa = plain(Rules.match('vivaldi-chatgpt.com__-default', 'sign in - google account'))
  assert.equal(pwa.site, true)
  assert.notEqual(pwa.icon, Rules.fallback)
})

test('a web app with no site rule is not a site, so its desktop icon can win', () => {
  // The widget only looks up a local icon when the rule is not a site; these
  // classes fall through to the browser glyph, which the entry's Icon= replaces.
  for (const cls of ['chrome-discord.com__channels_@me-default', 'chrome-www.notion.so__-default']) {
    assert.equal(plain(Rules.match(cls, '')).site, false, cls)
  }
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
