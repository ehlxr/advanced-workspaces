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
