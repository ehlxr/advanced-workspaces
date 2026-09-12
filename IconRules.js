.pragma library

// Nerd Font glyph lookup for Hyprland toplevels, matched against the window
// class first and the window title second.
//
// ORDER MATTERS. Title-specific rules have to sit above the generic browser
// class rules, otherwise an Amazon or YouTube tab in Firefox resolves to the
// Firefox icon instead of its own.
//
// Rules marked `browserOnly: true` are generic site patterns (.*amazon.* and
// friends) that must only match inside a real browser window. Without the flag
// a VSCode file or a file-manager window whose path happens to contain
// "github" would claim the GitHub icon.
//
// Rules marked `classOnly: true` skip the title entirely: tokens like the
// VSCode `code|Code` would otherwise win on any window whose title merely
// contains the word "code".
//
// Icon map adapted from the `saif.workspaces` plugin by Saif Omar (MIT).
var rules = [
  // herdr (agent runtime) / tmux (terminal multiplexer): launched with their
  // own app-id, so match the dedicated org.omarchy.* window classes.
  { pattern: "org.omarchy.herdr|herdr",                                       icon: "󰧑" },
  { pattern: "org.omarchy.tmux|tmux",                                          icon: "󰆍" },
  { pattern: "windows",                                                       icon: "" },
  { pattern: "ai.opencode.desktop|opencode",                                  icon: "" },
  { pattern: "org.jellyfin.JellyfinDesktop|jellyfin",                         icon: "󰼁" },
  { pattern: "chrome-claude.ai__-default|claude",                             icon: "󰭹" },
  { pattern: ".*amazon.*",                                 browserOnly: true, icon: "󰸩" },
  { pattern: ".*github.*",                                 browserOnly: true, icon: "󰊤" },
  { pattern: ".*figma.*",                                  browserOnly: true, icon: "󰣙" },
  { pattern: ".*jira.*",                                   browserOnly: true, icon: "󰗃" },
  { pattern: ".*youtube.*",                                browserOnly: true, icon: "󰗃" },
  { pattern: ".*reddit.*",                                 browserOnly: true, icon: "󰑍" },
  { pattern: ".*facebook.*",                               browserOnly: true, icon: "󰈎" },
  { pattern: ".*messenger.*",                              browserOnly: true, icon: "󰈎" },
  { pattern: ".*whatsapp.*",                               browserOnly: true, icon: "󰖣" },
  { pattern: ".*zapzap.*",                                 browserOnly: true, icon: "󰖣" },
  { pattern: ".*gmail.*",                                  browserOnly: true, icon: "󰊫" },
  { pattern: ".*proton.*mail.*",                           browserOnly: true, icon: "󰊫" },
  { pattern: ".*ChatGPT.*",                                browserOnly: true, icon: "󰭹" },
  { pattern: ".*deepseek.*",                               browserOnly: true, icon: "󰭹" },
  { pattern: ".*qwen.*",                                   browserOnly: true, icon: "󰭹" },
  { pattern: ".*Monkeytype.*",                             browserOnly: true, icon: "󰌌" },
  { pattern: ".*Picture-in-Picture.*",                                        icon: "󰐹" },
  { pattern: "brave-x.com.*",                                                 icon: "󰕄" },
  { pattern: "brave-mail.proton.me.*",                                        icon: "󰊫" },
  { pattern: "twitter-x",                                                     icon: "󰕄" },

  // Browsers
  { pattern: "firefox|org.mozilla.firefox|librewolf|floorp|mercury-browser|[Cc]achy-browser", icon: "󰈹" },
  { pattern: "zen",                                                           icon: "󰈹" },
  { pattern: "waterfox|waterfox-bin",                                         icon: "󰈹" },
  { pattern: "microsoft-edge",                                                icon: "󰇩" },
  { pattern: "brave-browser|Brave-browser|Brave|brave",                       icon: "" },
  { pattern: "tor browser",                                                   icon: "󰖂" },
  { pattern: "Chromium|Thorium|[Cc]hrome",                                    icon: "󰊯" },
  { pattern: "vivaldi",                                                       icon: "󰖟" },

  // Chat & mail
  { pattern: "signal",                                                        icon: "󰍡" },
  { pattern: "[Tt]elegram-desktop|org.telegram.desktop|io.github.tdesktop_x64.TDesktop", icon: "󰘦" },
  { pattern: "discord|[Ww]ebcord|Vesktop",                                    icon: "󰙯" },
  { pattern: "slack",                                                         icon: "󰒱" },
  { pattern: "[Tt]hunderbird|[Tt]hunderbird-esr",                             icon: "󰇮" },
  { pattern: "eu.betterbird.Betterbird",                                      icon: "󰇮" },
  { pattern: "claws-mail",                                                    icon: "󰇮" },
  { pattern: "org.gnome.Evolution",                                           icon: "󰊫" },
  { pattern: "org.gnome.Geary",                                               icon: "󰊫" },
  { pattern: "Zoom",                                                          icon: "󰕧" },

  // Terminals & editors
  { pattern: ".*n?vim.*",                                                     icon: "" },
  { pattern: "konsole",                                                       icon: "󰆍" },
  { pattern: "foot",                                                          icon: "󰆍" },
  { pattern: "kitty",                                                         icon: "󰆍" },
  { pattern: "alacritty",                                                     icon: "󰆍" },
  { pattern: "com.mitchellh.ghostty",                                         icon: "󰊠" },
  { pattern: "org.wezfurlong.wezterm",                                        icon: "󰆍" },
  { pattern: "VSCode|code-url-handler|code-oss|codium|codium-url-handler|VSCodium|code|Code", classOnly: true, icon: "󰨞" },
  { pattern: "dev.zed.Zed|dev.zed.Zed-Preview",                               icon: "󱓞" },
  { pattern: "subl",                                                          icon: "󰅳" },
  { pattern: "codeblocks",                                                    icon: "󰅩" },
  { pattern: "geany",                                                         icon: "󰅩" },
  { pattern: "jetbrains-idea",                                                icon: "󰅩" },
  { pattern: "android-studio",                                                icon: "󰀴" },
  { pattern: "mousepad",                                                      icon: "󰇾" },
  { pattern: "ghostwriter|org.kde.ghostwriter",                               icon: "󰷈" },
  { pattern: "org.gnome.TextEditor",                                          icon: "󰷈" },

  // Office & docs
  { pattern: "libreoffice-writer",                                            icon: "󰈙" },
  { pattern: "libreoffice-calc",                                              icon: "󰧷" },
  { pattern: "libreoffice-startcenter",                                       icon: "󰏆" },
  { pattern: "org.pwmt.zathura",                                              icon: "󰈦" },
  { pattern: "org.gnome.Contacts",                                            icon: "󰀉" },
  { pattern: "anytype",                                                      icon: "󰠮" },

  // Media
  { pattern: "mpv",                                                           icon: "󰐹" },
  { pattern: "celluloid",                                                     icon: "󰐹" },
  { pattern: "vlc",                                                           icon: "󰕼" },
  { pattern: ".*cmus.*",                                                      icon: "󰝚" },
  { pattern: "[Ss]potify",                                                    icon: "󰓇" },
  { pattern: "org.kde.elisa",                                                 icon: "󰝚" },
  { pattern: "org.gnome.Lollypop",                                            icon: "󰝚" },
  { pattern: "org.gnome.[Mm]usic",                                            icon: "󰝚" },
  { pattern: "rhythmbox",                                                     icon: "󰝚" },
  { pattern: "Cider",                                                         icon: "󰎆" },
  { pattern: "obs|com.obsproject.Studio",                                     icon: "󰐍" },
  { pattern: "gimp",                                                          icon: "󰏘" },

  // System & tools
  { pattern: "cake_wallet",                                                   icon: "󰠓" },
  { pattern: "feather",                                                       icon: "󰠓" },
  { pattern: "Exodus|exodus",                                                 icon: "󰠓" },
  { pattern: "com.transmissionbt.transmission.*",                             icon: "󰄠" },
  { pattern: "de.haeckerfelix.Fragments",                                     icon: "󰄠" },
  { pattern: "virt-manager|.virt-manager-wrapped|virtualbox manager|virtualbox", icon: "󰍺" },
  { pattern: "remmina",                                                       icon: "󰢹" },
  { pattern: "polkit-gnome-authentication-agent-1",                           icon: "󰒃" },
  { pattern: "nwg-look",                                                      icon: "󰔡" },
  { pattern: "[Pp]avucontrol|org.pulseaudio.pavucontrol",                     icon: "󰓃" },
  { pattern: "org.pipewire.Helvum",                                           icon: "󰓃" },
  { pattern: "Gparted",                                                       icon: "󰋊" },
  { pattern: "thunar|nemo|io.github.lgse.Strata|strata",                         icon: "󰝰" },
  { pattern: "org.gnome.Nautilus|nautilus",                                   icon: "󰝰" },
  { pattern: "steam",                                                         icon: "󰓓" },
  { pattern: "emulator",                                                      icon: "󰄭" },
  { pattern: "PrusaSlicer|UltiMaker-Cura|OrcaSlicer",                         icon: "󰐫" }
]

// Brand slugs for the logo fetch, keyed to the same title patterns the glyph
// table above uses. They are kept apart from `rules` on purpose: a slug only
// means something for a page (a GitHub tab) or a dedicated web-app window, and
// leaving them here keeps the glyph table the single source of truth for
// matching. `cls: true` marks the entries that are a window class rather than
// a title, so a class match on those counts as a site match too.
var siteLogos = [
  { pattern: ".*amazon.*",                   logo: "amazon" },
  { pattern: ".*github.*",                   logo: "github" },
  { pattern: ".*figma.*",                    logo: "figma" },
  { pattern: ".*jira.*",                     logo: "jira" },
  { pattern: ".*youtube.*",                  logo: "youtube" },
  { pattern: ".*reddit.*",                   logo: "reddit" },
  { pattern: ".*facebook.*",                 logo: "facebook" },
  { pattern: ".*messenger.*",                logo: "facebook-messenger" },
  { pattern: ".*whatsapp.*",                 logo: "whatsapp" },
  { pattern: ".*zapzap.*",                   logo: "whatsapp" },
  { pattern: ".*gmail.*",                    logo: "gmail" },
  { pattern: ".*proton.*mail.*",             logo: "proton-mail" },
  { pattern: ".*ChatGPT.*",                  logo: "openai" },
  { pattern: ".*deepseek.*",                 logo: "deepseek" },
  { pattern: ".*qwen.*",                     logo: "qwen" },
  { pattern: ".*Monkeytype.*",               logo: "monkeytype" },
  { pattern: "twitter-x|brave-x\\.com.*",    logo: "x", cls: true },
  { pattern: "brave-mail\\.proton\\.me.*",   logo: "proton-mail", cls: true }
]

var fallback = "󰘔"

// Rules are compiled once per QML engine rather than per render. `.pragma
// library` means one shared copy across all three bar instances.
var compiled = null

// Browser classes the generic site rules are allowed to match. A Chromium
// PWA keeps an app class of its own (brave-x.com, twitter-x, ...), so those
// dedicated rules are not gated and still work in the window manager.
var browsers = /firefox|zen|waterfox|librewolf|floorp|mercury|cachy|microsoft-edge|brave|chromium|thorium|chrome|vivaldi|edge|browser/

function patterns() {
  if (compiled) return compiled
  compiled = []
  for (var i = 0; i < rules.length; i++) {
    compiled.push({
      re: new RegExp(rules[i].pattern, "i"),
      icon: rules[i].icon,
      browserOnly: rules[i].browserOnly === true,
      classOnly: rules[i].classOnly === true
    })
  }
  return compiled
}

var compiledLogos = null

function logoPatterns() {
  if (compiledLogos) return compiledLogos
  compiledLogos = []
  for (var i = 0; i < siteLogos.length; i++) {
    compiledLogos.push({
      re: new RegExp(siteLogos[i].pattern, "i"),
      logo: siteLogos[i].logo,
      cls: siteLogos[i].cls === true
    })
  }
  return compiledLogos
}

// Browser titles churn constantly, so the cache is capped and dropped wholesale
// once it grows past the limit instead of tracking per-entry age. The separator
// is a control character rather than "|" so a title containing a pipe cannot
// collide with a class.
var cache = {}
var cacheCount = 0
var cacheLimit = 500
var cacheSeparator = "\u0001"

// Resolve a window to the glyph to draw, the brand slug its logo can be
// fetched under, and whether the match belongs to the page rather than to the
// application. A site match (a GitHub tab) is what the caller lets outrank the
// browser's own logo; everything else is the app.
function match(cls, title) {
  var key = cls + cacheSeparator + title
  var hit = cache[key]
  if (hit !== undefined) return hit

  var set = patterns()
  var icon = fallback
  var site = false
  for (var i = 0; i < set.length; i++) {
    var entry = set[i]
    if (entry.browserOnly && !browsers.test(cls)) continue
    if (entry.classOnly) {
      if (entry.re.test(cls)) { icon = entry.icon; break }
      continue
    }
    if (entry.re.test(title) || entry.re.test(cls)) {
      icon = entry.icon
      site = entry.browserOnly
      break
    }
  }

  // A generic site pattern only counts inside a real browser window, or a file
  // manager sitting on ~/github would claim the GitHub logo. A pattern marked
  // `cls` is a window class of its own (a Chromium PWA), so it needs no gate.
  var logo = ""
  var logos = logoPatterns()
  for (var j = 0; j < logos.length; j++) {
    var candidate = logos[j]
    if (candidate.re.test(title) && browsers.test(cls)) {
      logo = candidate.logo
      site = true
      break
    }
    if (candidate.cls && candidate.re.test(cls)) {
      logo = candidate.logo
      site = true
      break
    }
  }

  var result = { icon: icon, logo: logo, site: site }
  if (cacheCount >= cacheLimit) {
    cache = {}
    cacheCount = 0
  }
  cache[key] = result
  cacheCount++
  return result
}

// The glyph alone, for callers that do not care about logos.
function resolve(cls, title) {
  return match(cls, title).icon
}
