import QtQuick
import QtQuick.Layouts
import Quickshell
import Quickshell.Hyprland
import Quickshell.Io
import Quickshell.Widgets
import qs.Commons
import qs.Ui
import "IconRules.js" as IconRules

// Workspace indicators that show only what is actually there: workspaces with
// windows on them, filtered to the monitor this bar instance lives on, each
// labelled with its number plus an icon per open window.
//
// Everything past that default is opt-in: `showEmpty` keeps every workspace
// number on the bar whether or not it holds windows, `localWorkspaceNumbers`
// relabels per-monitor banks so each bar counts from 1, and `showScratchpad`
// adds a pill for Hyprland's special:scratchpad while something is parked in
// it.
BarWidget {
  id: root
  moduleName: "io.github.ehlxr.advanced-workspaces"

  // --- settings, read from this widget's shell.json layout entry ------------
  readonly property bool perMonitor: root.setting("perMonitor", true)
  readonly property bool showEmpty: root.setting("showEmpty", false)
  readonly property bool showIcons: root.setting("showIcons", true)
  // 0 = show an icon for every window; otherwise overflow collapses to "+N".
  readonly property int maxIcons: root.setting("maxIcons", 0)
  // Draw each window's real logo from its desktop entry and the system icon
  // theme instead of the Nerd Font glyph. Falls back to the glyph whenever no
  // entry or no icon resolves, so the bar is never worse off for it.
  readonly property bool systemIcons: root.setting("systemIcons", true)
  // Fetch brand logos over the network when nothing local resolves, and for
  // browser tabs whose site has one. Off by default: it is the only part of
  // this widget that talks to the network. What leaves the machine is a brand
  // slug from the tables in IconRules.js — titles are matched locally.
  readonly property bool remoteIcons: root.setting("remoteIcons", false)
  // `{slug}` is replaced with the brand slug, so any host serving an image at
  // that URL works and a self-hosted mirror is one setting away.
  readonly property string remoteIconSource: root.setting("remoteIconSource",
    "https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/{slug}.png")
  readonly property int maxWorkspaceId: root.setting("maxWorkspaceId", 10)
  // Label each monitor's bank as 1..workspacesPerMonitor instead of using the
  // global Hyprland id. Display only; ids and dispatches stay global.
  readonly property bool localWorkspaceNumbers: root.setting("localWorkspaceNumbers", false)
  readonly property int workspacesPerMonitor: Math.max(1, root.setting("workspacesPerMonitor", 10))
  // The scratchpad pill appears only while the special workspace holds
  // windows, so it costs nothing on a bar that never uses it.
  readonly property bool showScratchpad: root.setting("showScratchpad", true)
  readonly property string scratchpadName: root.setting("scratchpadName", "special:scratchpad")
  readonly property string scratchpadLabel: root.setting("scratchpadLabel", "S")

  readonly property color fgColor: root.bar ? root.bar.barForeground : Color.foreground
  readonly property color bgColor: root.bar ? root.bar.background : Color.background
  readonly property color urgentColor: Color.urgent
  readonly property real trailingGap: root.vertical ? 0 : Style.spaceReal(15)

  // --- which monitor is this bar on ----------------------------------------
  // One bar surface exists per monitor, so the widget reads its own screen off
  // the window it was instantiated into rather than off any global focus state.
  readonly property var barWindow: root.QsWindow ? root.QsWindow.window : null
  readonly property string screenName: barWindow && barWindow.screen ? String(barWindow.screen.name || "") : ""

  readonly property var hyprMonitor: {
    var _ = root.revision
    if (root.screenName === "") return null
    var monitors = Hyprland.monitors.values
    for (var i = 0; i < monitors.length; i++) {
      if (String(monitors[i].name) === root.screenName) return monitors[i]
    }
    return null
  }

  // The workspace active *on this monitor*, which is not the same as the
  // globally focused workspace once a second monitor exists.
  readonly property int activeId: {
    if (root.hyprMonitor && root.hyprMonitor.activeWorkspace) return root.hyprMonitor.activeWorkspace.id
    return Hyprland.focusedWorkspace ? Hyprland.focusedWorkspace.id : -1
  }

  // Whether this monitor is the one holding keyboard focus, used to keep the
  // active pill on the other monitors visibly quieter.
  readonly property bool monitorFocused: {
    var _ = root.revision
    if (root.screenName === "" || !Hyprland.focusedMonitor) return true
    return String(Hyprland.focusedMonitor.name) === root.screenName
  }

  // --- keeping Hyprland's view fresh ---------------------------------------
  // Quickshell does not refetch toplevels or workspaces on its own, so window
  // and workspace events have to poke it or occupancy goes stale. `revision`
  // is bumped alongside so bindings below re-evaluate on events that change
  // nothing Quickshell exposes as a property (focusedmon, urgent).
  property int revision: 0

  readonly property var windowEvents: ["openwindow", "closewindow", "movewindow", "movewindowv2", "windowtitle", "windowtitlev2", "activewindow", "activewindowv2", "urgent"]
  readonly property var workspaceEvents: ["workspace", "workspacev2", "createworkspace", "createworkspacev2", "destroyworkspace", "destroyworkspacev2", "moveworkspace", "moveworkspacev2", "focusedmon", "configreloaded"]
  // Toggling the scratchpad open or shut changes which monitor is showing it,
  // which only the monitors payload carries.
  readonly property var specialEvents: ["activespecial", "activespecialv2"]

  Connections {
    target: Hyprland
    function onRawEvent(event) {
      var name = event.name
      if (root.windowEvents.indexOf(name) !== -1) {
        Hyprland.refreshToplevels()
        root.revision++
      } else if (root.workspaceEvents.indexOf(name) !== -1) {
        Hyprland.refreshWorkspaces()
        if (name === "configreloaded" && root.rulesNeeded) root.refreshRules()
        root.revision++
      } else if (root.specialEvents.indexOf(name) !== -1) {
        Hyprland.refreshWorkspaces()
        Hyprland.refreshMonitors()
        root.revision++
      }
    }
  }

  // --- model ---------------------------------------------------------------
  function hasWindows(workspace) {
    if (!workspace) return false
    var tops = workspace.toplevels ? workspace.toplevels.values : null
    return !!tops && tops.length > 0
  }

  // Hyprland reports the owning monitor as an object on the workspace and as a
  // bare name string in the raw IPC payload; either will do.
  function monitorNameOf(workspace) {
    if (!workspace) return ""
    if (workspace.monitor && workspace.monitor.name) return String(workspace.monitor.name)
    var ipc = workspace.lastIpcObject
    if (ipc && ipc.monitor) return String(ipc.monitor)
    return ""
  }

  function workspaceById(id) {
    var _ = root.revision
    var values = Hyprland.workspaces.values
    for (var i = 0; i < values.length; i++) {
      if (values[i].id === id) return values[i]
    }
    return null
  }

  // --- workspace rules, only needed to place empty numbers -----------------
  // Hyprland only reports workspaces that currently exist, so `showEmpty` has
  // to synthesise the missing ids rather than filter live objects — and then
  // decide which bar each synthesised id belongs on. Rules answer that for
  // both sequential (1-5 / 6-10) and interleaved (odds / evens) layouts; live
  // occupancy still wins wherever a workspace has already been created.
  property var workspaceRules: []
  property bool rulesPending: false
  property bool rulesLoaded: false
  readonly property bool rulesNeeded: root.showEmpty && root.perMonitor

  function refreshRules() {
    if (rulesProc.running) {
      root.rulesPending = true
      return
    }
    rulesProc.running = true
  }

  onRulesNeededChanged: if (root.rulesNeeded && !root.rulesLoaded) root.refreshRules()
  Component.onCompleted: {
    if (root.rulesNeeded) root.refreshRules()
    root.collectRemoteIcons()
  }

  function ruleMonitorMatches(spec, mine, mineDesc) {
    if (!spec) return false
    var value = String(spec)
    if (value === mine) return true
    if (value.indexOf("desc:") === 0) {
      var desc = value.slice(5)
      return mineDesc !== "" && desc === mineDesc
    }
    return false
  }

  function resolveRuleMonitor(spec) {
    var _ = root.revision
    if (!spec) return ""
    var monitors = Hyprland.monitors.values
    for (var i = 0; i < monitors.length; i++) {
      var name = String(monitors[i].name)
      var desc = ""
      var ipc = monitors[i].lastIpcObject
      if (ipc && ipc.description) desc = String(ipc.description)
      else if (monitors[i].description) desc = String(monitors[i].description)
      if (root.ruleMonitorMatches(spec, name, desc)) return name
    }
    return ""
  }

  function ruleOwnerById(maxId) {
    var rules = root.workspaceRules
    var map = {}
    for (var i = 0; i < rules.length; i++) {
      var id = rules[i].id
      if (id <= 0 || id > maxId) continue
      var name = root.resolveRuleMonitor(rules[i].monitor)
      if (name) map[id] = name
    }
    return map
  }

  Process {
    id: rulesProc
    command: ["hyprctl", "-j", "workspacerules"]
    onRunningChanged: {
      if (!running && root.rulesPending) {
        root.rulesPending = false
        root.refreshRules()
      }
    }
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var listed
        try {
          listed = JSON.parse(text || "[]")
        } catch (e) {
          return
        }
        if (!Array.isArray(listed)) return
        var parsed = []
        for (var i = 0; i < listed.length; i++) {
          var row = listed[i]
          if (!row || row.enabled === false) continue
          var id = parseInt(row.workspaceString, 10)
          if (!(id > 0)) continue
          parsed.push({ id: id, monitor: String(row.monitor || "") })
        }
        root.workspaceRules = parsed
        root.rulesLoaded = true
        root.revision++
      }
    }
  }

  // The pills, as ids. Ids rather than workspace objects, because a
  // synthesised empty number has no object behind it until it is focused.
  readonly property var visibleIds: {
    var _ = root.revision
    var __ = root.workspaceRules
    var ___ = root.rulesLoaded
    var mine = root.screenName
    var active = root.activeId
    var maxId = root.maxWorkspaceId
    var values = Hyprland.workspaces.values

    var mineIds = []
    var occupied = []
    var owners = {}
    var known = []

    for (var i = 0; i < values.length; i++) {
      var workspace = values[i]
      var id = workspace.id
      if (id <= 0 || id > maxId) continue

      var owner = root.monitorNameOf(workspace)
      if (owner !== "") {
        owners[id] = owner
        known.push(id)
      }

      // An unknown owner is kept rather than dropped: better a stray pill
      // than a workspace that silently vanishes from every bar.
      if (root.perMonitor && mine !== "" && owner !== "" && owner !== mine) continue
      mineIds.push(id)

      // The active workspace stays pinned even when empty, otherwise stepping
      // onto a fresh workspace leaves the bar with nothing to point at.
      if (root.hasWindows(workspace) || id === active) occupied.push(id)
    }
    known.sort(function(left, right) { return left - right })

    if (!root.showEmpty) {
      occupied.sort(function(left, right) { return left - right })
      return occupied
    }

    if (!root.perMonitor) {
      var all = []
      for (var n = 1; n <= maxId; n++) all.push(n)
      return all
    }

    if (mine === "") return []

    // Live-only until the first workspacerules read; [] means "not loaded"
    // and "no rules" otherwise, and fallback would flash the wrong layout.
    if (!root.rulesLoaded) {
      var pending = mineIds.slice()
      if (active > 0 && active <= maxId && pending.indexOf(active) === -1) {
        if (owners[active] === undefined || owners[active] === mine) pending.push(active)
      }
      pending.sort(function(left, right) { return left - right })
      return pending
    }

    var ruleOwners = root.ruleOwnerById(maxId)
    var firstOwner = known.length > 0 ? owners[known[0]] : ""
    var pred = 0
    var filled = []
    for (var id2 = 1; id2 <= maxId; id2++) {
      if (owners[id2]) pred = id2
      var owner2 = owners[id2] || ruleOwners[id2] || (pred > 0 ? owners[pred] : firstOwner)
      if (owner2 === mine) filled.push(id2)
    }
    if (filled.length === 0 && active > 0 && active <= maxId && (owners[active] === undefined || owners[active] === mine)) {
      return [active]
    }
    return filled
  }

  // --- scratchpad -----------------------------------------------------------
  // Hyprland keeps special:scratchpad in the workspace list for as long as it
  // holds windows, whether or not it is currently toggled open. It belongs to
  // no monitor in any lasting sense, so the pill shows up on every bar.
  readonly property var scratchpadWorkspace: {
    var _ = root.revision
    if (!root.showScratchpad) return null
    var values = Hyprland.workspaces.values
    for (var i = 0; i < values.length; i++) {
      if (String(values[i].name || "") === root.scratchpadName) return values[i]
    }
    return null
  }

  readonly property bool scratchpadVisible: root.showScratchpad && root.hasWindows(root.scratchpadWorkspace)

  // Open on *this* monitor, which is the only place the stash is reachable
  // from right now.
  readonly property bool scratchpadOpen: {
    var _ = root.revision
    if (!root.hyprMonitor) return false
    var ipc = root.hyprMonitor.lastIpcObject
    var special = ipc ? ipc.specialWorkspace : null
    return !!special && String(special.name || "") === root.scratchpadName
  }

  function toggleScratchpad() {
    if (!root.bar) return
    var name = root.scratchpadName.indexOf("special:") === 0 ? root.scratchpadName.slice(8) : root.scratchpadName
    root.bar.run("hyprctl dispatch " + Util.shellQuote('hl.dsp.workspace.toggle_special("' + name + '")'))
  }

  // --- icons ---------------------------------------------------------------
  function windowClass(toplevel) {
    var ipc = toplevel ? toplevel.lastIpcObject : null
    if (ipc && ipc.class) return ipc.class
    if (toplevel && toplevel.class) return toplevel.class
    if (toplevel && toplevel.appId) return toplevel.appId
    return ""
  }

  function windowTitle(toplevel) {
    if (toplevel && toplevel.title) return toplevel.title
    var ipc = toplevel ? toplevel.lastIpcObject : null
    if (ipc && ipc.title) return ipc.title
    return ""
  }

  // Physical pixels for the icon decode. A 16px logo asked for as 16px comes
  // back as a 16px bitmap and is upscaled by the compositor on a HiDPI screen,
  // so the source is requested at the physical size instead.
  readonly property real devicePixelRatio: {
    var screens = Quickshell.screens
    for (var i = 0; i < screens.length; i++) {
      if (String(screens[i].name) === root.screenName) return screens[i].devicePixelRatio || 1
    }
    return 1
  }

  // The square a logo is drawn in, and the corner every logo's tile shares.
  readonly property int iconCanvasSize: Style.bar.iconCanvas
  readonly property int iconTileRadius: Math.max(1, Math.round(Style.spaceReal(4)))

  // Desktop entries are scanned asynchronously and only land a second or two
  // after the shell starts, so an icon resolved before then must be discarded
  // rather than cached as "no logo exists". Swapping the map and bumping
  // desktopRevision re-runs the bindings that build the icon rows.
  property var systemIconCache: ({})
  property int desktopRevision: 0

  Connections {
    target: DesktopEntries
    function onApplicationsChanged() {
      root.systemIconCache = ({})
      root.desktopRevision++
    }
  }

  // The desktop entry is the only place that knows an application's icon name,
  // and the window class is not it: Vivaldi's class is `vivaldi-stable` while
  // its icon is `vivaldi`, and VS Code's class is `code` while its icon is
  // `vscode`. Quickshell.iconPath then resolves that name against the icon
  // theme, which also covers /usr/share/pixmaps and the GTK theme.
  function systemIconSource(cls) {
    if (!root.systemIcons || cls === "") return ""
    var cached = root.systemIconCache[cls]
    if (cached !== undefined) return cached

    var source = ""
    var entry = null
    try { entry = DesktopEntries.heuristicLookup(cls) } catch (e) { entry = null }
    if (entry && entry.icon) {
      var name = String(entry.icon)
      // An entry may name a file outright; there is nothing to theme-resolve.
      if (name.charAt(0) === "/") source = Util.fileUrl(name)
      else if (name.indexOf("file://") === 0 || name.indexOf("image://") === 0) source = name
      else source = Quickshell.iconPath(name, true)
    }

    root.systemIconCache[cls] = source
    return source
  }

  // --- brand logos over the network ----------------------------------------
  // Opt-in, and the only thing here that leaves the machine. What is sent is a
  // brand slug from the tables in IconRules.js — never a window title or a
  // class — and what comes back is cached on disk, so each slug is fetched once
  // and survives restarts.
  readonly property string remoteIconDir: {
    var base = Quickshell.env("XDG_CACHE_HOME")
    if (!base || base === "") {
      var home = Quickshell.env("HOME")
      base = (home && home !== "") ? home + "/.cache" : "/tmp"
    }
    return base + "/advanced-workspaces/icons"
  }

  // Slugs already on disk, slugs being fetched, and slugs that came back empty.
  // The last one keeps a slug the host does not have from being retried on
  // every render.
  property var remoteReady: ({})
  property var remotePending: ({})
  property var remoteFailed: ({})
  property var remoteQueue: []
  property bool remoteScanStarted: false
  property bool remoteScanDone: false
  property int remoteRevision: 0

  function remoteTarget(slug) {
    return root.remoteIconDir + "/" + slug + ".png"
  }

  // `ls` rather than a stat per slug: one process reports everything the last
  // run already downloaded, and the queue is held back until it answers so a
  // cached logo is never re-fetched.
  Process {
    id: remoteScan
    command: ["ls", "-1", root.remoteIconDir]
    stdout: SplitParser {
      onRead: function(line) {
        var name = String(line || "").trim()
        var dot = name.lastIndexOf(".")
        var slug = dot > 0 ? name.slice(0, dot) : name
        if (slug === "") return
        var ready = root.remoteReady
        ready[slug] = true
        root.remoteReady = ready
      }
    }
    onExited: {
      root.remoteScanDone = true
      root.remoteRevision++
    }
  }

  // Anything that changes which windows are on screen, or what is already in
  // the logo cache, is a cue to go looking for logos that still need fetching.
  // Kept off the model bindings on purpose.
  Connections {
    target: root
    function onRevisionChanged() { root.collectRemoteIcons() }
    function onDesktopRevisionChanged() { root.collectRemoteIcons() }
    function onRemoteRevisionChanged() { root.collectRemoteIcons() }
  }

  Process {
    id: remoteFetch
    property string slug: ""
    property var rest: []
    command: ["curl", "-fsSL", "--create-dirs", "--max-time", "10",
              "-o", root.remoteTarget(remoteFetch.slug),
              root.remoteIconSource.replace("{slug}", remoteFetch.slug)]
    onExited: function(exitCode) {
      var ready = root.remoteReady
      var failed = root.remoteFailed
      if (exitCode === 0) ready[remoteFetch.slug] = true
      else failed[remoteFetch.slug] = true
      root.remoteReady = ready
      root.remoteFailed = failed
      // Captured before pumping: starting the next queued slug overwrites it.
      var rest = remoteFetch.rest
      root.remoteRevision++
      root.pumpRemoteQueue()
      // A miss only means this guess was wrong, so the window's next candidate
      // is worth a try.
      if (exitCode !== 0 && rest.length > 0) root.requestRemoteIcon(rest)
    }
  }

  function ensureRemoteScan() {
    if (root.remoteScanStarted || !root.remoteIcons) return
    root.remoteScanStarted = true
    remoteScan.running = true
  }

  // One fetch at a time. There are only ever a handful of slugs and the glyph
  // stands in until the file lands, so a queue costs nothing where a burst of
  // curls on session restore would not.
  function pumpRemoteQueue() {
    if (remoteFetch.running) return
    var queue = root.remoteQueue
    if (queue.length === 0) return
    var next = queue[0]
    remoteFetch.slug = next.slug
    remoteFetch.rest = next.rest
    root.remoteQueue = queue.slice(1)
    remoteFetch.running = true
  }

  // Queues the first candidate that is not already settled, so a chain resumes
  // from wherever it stopped rather than retrying a slug that 404s.
  function requestRemoteIcon(candidates) {
    if (!root.remoteIcons || !candidates) return
    for (var i = 0; i < candidates.length; i++) {
      var slug = candidates[i]
      if (slug === "") continue
      if (root.remoteReady[slug] || root.remotePending[slug] || root.remoteFailed[slug]) continue
      var pending = root.remotePending
      pending[slug] = true
      root.remotePending = pending
      var queue = root.remoteQueue.slice()
      queue.push({ slug: slug, rest: candidates.slice(i + 1) })
      root.remoteQueue = queue
      root.pumpRemoteQueue()
      return
    }
  }

  function slugify(value) {
    var text = String(value || "")
    if (text.slice(-8) === ".desktop") text = text.slice(0, -8)
    var parts = text.split(".")
    var candidate = parts[parts.length - 1].toLowerCase()
    return candidate.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  }

  // Brand-slug guesses for a window, most likely first. The desktop entry's
  // `Icon=` is the closest thing to a brand name (`code` -> `vscode`,
  // `vivaldi-stable` -> `vivaldi`), its id is next, and the window class is the
  // last resort. A wrong guess only 404s, and is remembered rather than
  // retried.
  function remoteCandidates(cls, preferred) {
    var values = [preferred]
    var entry = null
    try { entry = DesktopEntries.heuristicLookup(cls) } catch (e) { entry = null }
    if (entry) values.push(entry.icon, entry.id)
    values.push(cls)

    var out = []
    for (var i = 0; i < values.length; i++) {
      var slug = root.slugify(values[i])
      if (slug !== "" && out.indexOf(slug) === -1) out.push(slug)
    }
    return out
  }

  // Whether a chain still has a candidate worth fetching. One that already
  // resolved has nothing to do, and one already queued would only duplicate the
  // request.
  function remoteCandidatesWanted(candidates) {
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] === "") continue
      if (root.remoteReady[candidates[i]] || root.remotePending[candidates[i]]) return false
    }
    return candidates.length > 0
  }

  function remoteCandidatesFor(cls, rule) {
    return rule.site || rule.logo !== "" ? [rule.logo] : root.remoteCandidates(cls, "")
  }

  // Downloads are requested from here rather than from the icon model. The
  // model runs inside bindings, and starting processes from there would make
  // the binding both read and write widget state, which QML reports as a
  // binding loop and then breaks.
  function collectRemoteIcons() {
    if (!root.remoteIcons) return
    root.ensureRemoteScan()
    // Hold off until the scan reports what is already on disk, or logos cached
    // by an earlier run would be fetched again.
    if (!root.remoteScanDone) return

    var workspaces = []
    var ids = root.visibleIds
    for (var i = 0; i < ids.length; i++) {
      var workspace = root.workspaceById(ids[i])
      if (workspace) workspaces.push(workspace)
    }
    if (root.scratchpadWorkspace) workspaces.push(root.scratchpadWorkspace)

    for (var w = 0; w < workspaces.length; w++) {
      var tops = workspaces[w].toplevels ? workspaces[w].toplevels.values : null
      if (!tops) continue
      for (var t = 0; t < tops.length; t++) {
        var cls = root.windowClass(tops[t])
        var title = root.windowTitle(tops[t])
        if (!cls && !title) continue
        var rule = IconRules.match(cls.toLowerCase(), title.toLowerCase())
        // A local icon, or a site rule with no brand behind it, means there is
        // nothing to fetch.
        if (rule.site && rule.logo === "") continue
        if (!rule.site && root.systemIconSource(cls) !== "") continue
        var candidates = root.remoteCandidatesFor(cls, rule)
        if (root.remoteCandidatesWanted(candidates)) root.requestRemoteIcon(candidates)
      }
    }
  }

  // The cached logo URL, or "" while it is still missing. Purely a read:
  // missing logos are queued by collectRemoteIcons and the glyph stands in
  // until the file lands.
  function remoteLogo(candidates) {
    var _ = root.remoteRevision
    if (!root.remoteIcons || !candidates) return ""
    for (var i = 0; i < candidates.length; i++) {
      if (root.remoteReady[candidates[i]]) return Util.fileUrl(root.remoteTarget(candidates[i]))
    }
    return ""
  }

  // One entry per visible window: a logo when one resolves, otherwise the glyph
  // the rule table picked. Purely a read — see collectRemoteIcons for what
  // actually goes and fetches.
  function iconEntryFor(toplevel) {
    var cls = root.windowClass(toplevel)
    var title = root.windowTitle(toplevel)
    if (!cls && !title) return { glyph: IconRules.fallback, source: "" }

    var rule = IconRules.match(cls.toLowerCase(), title.toLowerCase())

    // A site rule describes what the window is showing, so it outranks the
    // application: a GitHub tab is a GitHub tab, not a browser.
    if (!rule.site) {
      var local = root.systemIconSource(cls)
      if (local !== "") return { glyph: rule.icon, source: local }
    }

    return { glyph: rule.icon, source: root.remoteLogo(root.remoteCandidatesFor(cls, rule)) }
  }

  function iconEntriesFor(workspace) {
    var _ = root.desktopRevision
    var __ = root.remoteRevision
    if (!root.showIcons || !workspace) return []
    var tops = workspace.toplevels ? workspace.toplevels.values : null
    if (!tops || tops.length === 0) return []

    var shown = root.maxIcons > 0 ? Math.min(tops.length, root.maxIcons) : tops.length
    var entries = []
    for (var i = 0; i < shown; i++) entries.push(root.iconEntryFor(tops[i]))
    if (tops.length > shown) entries.push({ glyph: "+" + (tops.length - shown), source: "" })
    return entries
  }

  // Global ids are what Hyprland dispatches on; the label is the only thing
  // local numbering touches.
  function displayWorkspaceId(id) {
    return root.localWorkspaceNumbers ? ((id - 1) % root.workspacesPerMonitor) + 1 : id
  }

  function focusWorkspace(id) {
    var workspace = root.workspaceById(id)
    if (workspace) {
      workspace.activate()
      return
    }
    // A synthesised empty number has nothing to activate, so it goes out as a
    // dispatch, which creates the workspace the same way a keybind would.
    if (!root.bar) return
    root.bar.run("hyprctl dispatch " + Util.shellQuote('hl.dsp.focus({ workspace = "' + id + '" })'))
  }

  // --- layout --------------------------------------------------------------
  implicitWidth: root.vertical ? root.barSize : strip.implicitWidth + root.trailingGap
  implicitHeight: strip.implicitHeight

  // A single window's logo, or its Nerd Font glyph when no logo resolved.
  //
  // Logos arrive in every shape and with their own padding baked in, so a bare
  // circle next to a full-bleed square reads as two different sizes. Drawing
  // each into a fixed rounded tile and clipping the artwork to it gives every
  // window the same footprint whatever the source art does.
  component WindowIcon: Item {
    id: windowIcon
    required property var modelData
    property color tint: root.fgColor

    readonly property string imageSource: String(windowIcon.modelData.source || "")
    readonly property string glyphText: String(windowIcon.modelData.glyph || "")
    // A source that fails to decode falls back to the glyph rather than
    // leaving an empty tile behind.
    readonly property bool hasLogo: windowIcon.imageSource !== "" && logo.status !== Image.Error

    implicitWidth: windowIcon.hasLogo ? root.iconCanvasSize : glyph.implicitWidth
    implicitHeight: windowIcon.hasLogo ? root.iconCanvasSize : glyph.implicitHeight

    ClippingRectangle {
      visible: windowIcon.hasLogo
      anchors.centerIn: parent
      width: root.iconCanvasSize
      height: root.iconCanvasSize
      radius: root.iconTileRadius
      color: Util.alpha(root.fgColor, 0.12)

      Image {
        id: logo
        anchors.fill: parent
        source: windowIcon.imageSource
        fillMode: Image.PreserveAspectFit
        smooth: true
        mipmap: true
        // Decode at physical pixels: a logical-size decode leaves PNG icons
        // upscaled and blurry on HiDPI displays.
        sourceSize.width: Math.round(root.iconCanvasSize * root.devicePixelRatio)
        sourceSize.height: Math.round(root.iconCanvasSize * root.devicePixelRatio)
      }
    }

    Text {
      id: glyph
      visible: !windowIcon.hasLogo
      text: windowIcon.glyphText
      anchors.centerIn: parent
      color: windowIcon.tint
      font.family: root.bar ? root.bar.fontFamily : Style.font.family
      font.pixelSize: root.vertical ? Style.font.icon : Style.font.body
    }
  }

  Item {
    id: strip
    anchors.left: parent.left
    anchors.right: root.vertical ? parent.right : undefined
    anchors.top: parent.top
    anchors.bottom: root.vertical ? undefined : parent.bottom
    anchors.topMargin: root.vertical ? Style.spaceReal(80) : Style.spaceReal(4)
    anchors.bottomMargin: root.vertical ? 0 : Style.spaceReal(4)
    implicitWidth: grid.implicitWidth + Style.spaceReal(8)
    implicitHeight: grid.implicitHeight + Style.spaceReal(8)

    GridLayout {
      id: grid
      anchors.left: parent.left
      anchors.leftMargin: Style.spaceReal(4)
      anchors.right: parent.right
      anchors.rightMargin: Style.spaceReal(4)
      anchors.verticalCenter: parent.verticalCenter
      columns: root.vertical ? 1 : Math.max(1, root.visibleIds.length + (root.scratchpadVisible ? 1 : 0))
      columnSpacing: root.vertical ? 0 : Style.spaceReal(4)
      rowSpacing: root.vertical ? Style.spaceReal(4) : 0

      Repeater {
        model: root.visibleIds

        Rectangle {
          id: pill
          required property int modelData

          readonly property int workspaceId: pill.modelData
          readonly property var workspace: root.workspaceById(pill.workspaceId)
          readonly property bool active: pill.workspaceId === root.activeId
          readonly property bool urgent: pill.workspace !== null && pill.workspace.urgent === true
          property bool hovered: false

          radius: Style.spaceReal(8)
          color: pill.urgent ? root.urgentColor
            : pill.active ? Util.alpha(root.fgColor, root.monitorFocused ? 0.22 : 0.10)
            : pill.hovered ? Util.alpha(root.fgColor, 0.15)
            : "transparent"
          opacity: pill.active ? 1 : 0.7

          Layout.alignment: Qt.AlignVCenter
          Layout.fillHeight: true
          Layout.fillWidth: root.vertical
          implicitWidth: root.vertical ? (root.barSize - Style.spaceReal(8)) : content.implicitWidth + Style.spaceReal(16)
          implicitHeight: root.vertical ? content.implicitHeight + Style.spaceReal(10) : root.barSize - Style.spaceReal(8)

          Row {
            id: content
            anchors.centerIn: parent
            clip: true
            spacing: Style.spaceReal(3)

            Text {
              text: String(root.displayWorkspaceId(pill.workspaceId))
              color: pill.urgent ? root.bgColor : root.fgColor
              font.family: root.bar ? root.bar.fontFamily : Style.font.family
              font.pixelSize: root.vertical ? Style.font.icon : Style.font.body
            }

            Repeater {
              model: root.iconEntriesFor(pill.workspace)
              delegate: WindowIcon {
                tint: pill.urgent ? root.bgColor : root.fgColor
              }
            }
          }

          MouseArea {
            anchors.fill: parent
            hoverEnabled: true
            cursorShape: Qt.PointingHandCursor
            onEntered: pill.hovered = true
            onExited: pill.hovered = false
            onClicked: root.focusWorkspace(pill.workspaceId)
          }
        }
      }

      // The scratchpad sits after the numbers, as the place windows go when
      // they are not on any of them.
      Rectangle {
        id: scratchpad
        visible: root.scratchpadVisible
        property bool hovered: false

        radius: Style.spaceReal(8)
        color: scratchpad.hovered ? Util.alpha(root.fgColor, 0.15)
          : root.scratchpadOpen ? Util.alpha(root.fgColor, root.monitorFocused ? 0.22 : 0.10)
          : "transparent"
        opacity: root.scratchpadOpen ? 1 : 0.7

        Layout.alignment: Qt.AlignVCenter
        Layout.fillHeight: true
        Layout.fillWidth: root.vertical
        implicitWidth: !scratchpad.visible ? 0
          : root.vertical ? (root.barSize - Style.spaceReal(8))
          : scratchpadContent.implicitWidth + Style.spaceReal(16)
        implicitHeight: root.vertical ? scratchpadContent.implicitHeight + Style.spaceReal(10) : root.barSize - Style.spaceReal(8)

        Row {
          id: scratchpadContent
          anchors.centerIn: parent
          clip: true
          spacing: Style.spaceReal(3)

          Text {
            text: root.scratchpadLabel
            visible: text !== ""
            color: root.fgColor
            font.family: root.bar ? root.bar.fontFamily : Style.font.family
            font.pixelSize: root.vertical ? Style.font.icon : Style.font.body
          }

          Repeater {
            model: root.iconEntriesFor(root.scratchpadWorkspace)
            delegate: WindowIcon { }
          }
        }

        MouseArea {
          anchors.fill: parent
          hoverEnabled: true
          cursorShape: Qt.PointingHandCursor
          onEntered: scratchpad.hovered = true
          onExited: scratchpad.hovered = false
          onClicked: root.toggleScratchpad()
        }
      }
    }
  }
}
