.pragma library

// Pure icon decisions, kept out of the QML so they can run under plain Node in
// tests (see tests/icon-logic.test.cjs). Anything that needs a Quickshell
// singleton - iconPath, DesktopEntries - is passed in by the widget as a
// callback or as plain data.

// A brand slug: the last dot segment of a value, lowercased and reduced to
// [a-z0-9-]. Desktop ids are the usual input, so `.desktop` is dropped first or
// every id would slug to "desktop". "io.anytype.anytype" -> "anytype".
function slugify(value) {
  var text = String(value || "")
  if (text.slice(-8) === ".desktop") text = text.slice(0, -8)
  var parts = text.split(".")
  var candidate = parts[parts.length - 1].toLowerCase()
  return candidate.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

// A slug reduced to characters that are safe in a file name. Slugify already
// narrows most inputs to [a-z0-9-], but the rule table's site logos skip
// slugify, and every cache file name is derived here, so any leftover
// punctuation is folded defensively rather than trusted. Slashes always become
// dashes, so a slug can never walk out of the cache directory; a leading dot
// (and the bare "." / "..") cannot survive, so a slug never becomes a hidden
// entry or a parent reference.
function fileName(slug) {
  var name = String(slug || "").replace(/[^A-Za-z0-9._-]+/g, "-")
                               .replace(/^[-.]+|[-.]+$/g, "")
  return name === "" ? "logo" : name
}

// The slugs worth trying for a window with no local icon, best guess first.
// Duplicates and empties drop out, so passing the desktop entry's Icon=, its id
// and the window class together cannot ask for the same slug twice.
function remoteCandidates(values) {
  var list = Array.isArray(values) ? values : []
  var out = []
  for (var i = 0; i < list.length; i++) {
    var slug = slugify(list[i])
    if (slug !== "" && out.indexOf(slug) === -1) out.push(slug)
  }
  return out
}

// The user's override for a window as written, or "". A `title:<exact title>`
// key addresses one window when the class is too broad to pin down; otherwise
// keys are classes and match in any case, so a class Hyprland reports as "code"
// still finds a "Code" key. An exact key wins over a case-insensitive one.
function lookupOverride(overrides, cls, title) {
  if (!overrides || typeof overrides !== "object") return ""
  var exactTitle = String(title || "")
  var titled = overrides["title:" + exactTitle]
  if (exactTitle !== "" && titled !== undefined && titled !== null) return String(titled)

  var name = String(cls || "")
  if (name === "") return ""
  var direct = overrides[name]
  if (direct !== undefined && direct !== null) return String(direct)

  var wanted = name.toLowerCase()
  var keys = Object.keys(overrides)
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].slice(0, 6) === "title:") continue
    if (keys[i].toLowerCase() !== wanted) continue
    var value = overrides[keys[i]]
    return value === undefined || value === null ? "" : String(value)
  }
  return ""
}

// What an override value means: an explicit image when it names one - a
// file:// URL, an image:// provider URL, an absolute path or an icon-theme name
// that resolves - and otherwise the text itself, so "code": "󰨞" and
// "firefox": "🦊" do the obvious thing. Null when there is nothing to draw.
function classifyOverride(value, iconPathLookup) {
  var text = String(value || "").trim()
  if (text === "") return null
  if (text.indexOf("file://") === 0 || text.indexOf("image://") === 0)
    return { kind: "image", source: text }
  if (text.charAt(0) === "/") return { kind: "image", source: "file://" + text }
  var themed = iconPathLookup ? String(iconPathLookup(text) || "") : ""
  if (themed !== "") return { kind: "image", source: themed }
  return { kind: "text", value: text }
}

// --- Chromium web apps ------------------------------------------------------
// A window opened with `chromium --app=URL` (which is all omarchy-launch-webapp
// does) gets a Wayland app id Chromium derives from the URL, not from any
// desktop entry: `<browser>-<app name>-<profile>`, where the app name is the
// host, "_", then the path, and every character that is illegal in a file name
// - "/" above all - becomes "_". So https://discord.com/channels/@me opens as
// `chrome-discord.com__channels_@me-Default`, and a bare https://www.notion.so
// (whose path is "/") as `chrome-www.notion.so__-Default`. The .desktop file
// that launched it has no StartupWMClass, so neither byId nor heuristicLookup
// can find it; matching the URL back to the class is the only way to its Icon=.

// Chromium's app name for a web-app URL, or "" when it is not an http(s) URL.
// Only the host (lowercased, without user info or port) and the path take
// part; the query and fragment never reach the window class.
function webAppName(url) {
  var parts = /^\s*(https?):\/\/([^\/?#]*)([^?#]*)/i.exec(String(url || ""))
  if (!parts) return ""
  var host = parts[2].replace(/^.*@/, "").replace(/:\d*$/, "").toLowerCase()
  if (host === "") return ""
  var path = parts[3] === "" ? "/" : parts[3]
  return (host + "_" + path).replace(/[\/\\:*?"<>|\s]/g, "_")
}

// An Exec line split into arguments the way a desktop entry quotes them:
// whitespace separates, double or single quotes group, a backslash escapes the
// next character inside double quotes.
function splitExec(exec) {
  var text = String(exec || "")
  var args = []
  var current = ""
  var quote = ""
  var started = false
  for (var i = 0; i < text.length; i++) {
    var c = text.charAt(i)
    if (quote !== "") {
      if (c === quote) quote = ""
      else if (c === "\\" && quote === "\"" && i + 1 < text.length) current += text.charAt(++i)
      else current += c
    } else if (c === "\"" || c === "'") {
      quote = c
      started = true
    } else if (/\s/.test(c)) {
      if (started) args.push(current)
      current = ""
      started = false
    } else {
      current += c
      started = true
    }
  }
  if (started) args.push(current)
  return args
}

// The URL a desktop entry opens as a web app, or "". Takes the entry's parsed
// argument list (DesktopEntry.command) or its raw Exec string, and knows both
// launchers: a Chromium-family browser given `--app=URL`, and
// omarchy-launch-webapp, whose first argument is the URL.
function webAppUrl(exec) {
  var args = Array.isArray(exec) ? exec : splitExec(exec)
  for (var i = 0; i < args.length; i++) {
    var arg = String(args[i] || "")
    if (arg.indexOf("--app=") === 0) return arg.slice(6)
    var base = arg.slice(arg.lastIndexOf("/") + 1)
    if (base === "omarchy-launch-webapp" && i + 1 < args.length) return String(args[i + 1] || "")
  }
  return ""
}

// The class split into browser, app name and profile, or null when it cannot
// be a web-app class. Neither the browser (`chrome`, `brave`, `vivaldi`, ...)
// nor the profile directory (`Default`, `Profile_1`) contains a dash, while
// the app name may (`my-site.com_`), so the first and last dashes are the
// boundaries. Every app name carries the "_" between host and path, which
// keeps ordinary dashed classes like `google-chrome` out.
function splitWebAppClass(cls) {
  var parts = /^([^-]+)-(.+)-([^-]+)$/.exec(String(cls || ""))
  if (!parts || parts[2].indexOf("_") === -1) return null
  return { browser: parts[1], app: parts[2], profile: parts[3] }
}

function isWebAppClass(cls) {
  return splitWebAppClass(cls) !== null
}

// Whether a window class is the web app for this URL. The whole app name has
// to sit between the browser and the profile, so discord.com/channels/@me does
// not claim a bare discord.com window, nor x.com a window on foo-x.com. Case
// is ignored: Hyprland reports the class as Chromium wrote it, and the plugin
// lowercases classes elsewhere.
function webAppClassMatches(cls, url) {
  var parsed = splitWebAppClass(cls)
  var app = webAppName(url)
  if (!parsed || app === "") return false
  return parsed.app.toLowerCase() === app.toLowerCase()
}
