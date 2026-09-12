> Fork of [Decent Workspaces](https://github.com/TheTrueFerret/omarchy-decent-workspaces)
> by TheTrueFerret. The difference: every window is drawn with its real app
> logo — resolved from the system icon theme, or fetched once and cached —
> instead of only a Nerd Font glyph, with the upstream glyph table kept as the
> fallback. See [Logos](#logos).

AI Generated, didn't even look at the code, but does the job.
I actually created this manually for waybar in the past... ain't doing that again ;)

# Advanced Workspaces

![Three bars stacked: the default showing only workspaces 1, 3, 4, 5 and 8 with app icons plus a scratchpad pill; the same bar with showEmpty filling in every number to 10; and again with maxIcons collapsing extra windows into +N](preview.png)

A bar widget for Omarchy Quattro that shows workspaces the way you actually use
them:

- **Only workspaces in use.** Empty workspaces are hidden, except the one you
  are on, so the bar never goes blank underneath you.
- **Only this monitor's workspaces.** Each bar filters to its own monitor and
  highlights *that monitor's* active workspace, softer where keyboard focus
  isn't, so you can tell at a glance where you are.
- **App icons beside the number.** Every open window contributes a Nerd Font
  glyph.
- **The scratchpad, when it holds something.** Windows stashed with
  `SUPER + ALT + S` get their own pill instead of vanishing until you toggle
  the stash open.

Click a workspace to focus it.

## Install

```bash
omarchy plugin add https://github.com/ehlxr/advanced-workspaces.git --enable
omarchy bar put io.github.ehlxr.advanced-workspaces --section left --index 1
```

You probably want to drop the stock widget at the same time, since two workspace
indicators side by side is rarely what you want:

```bash
omarchy plugin disable omarchy.workspaces
```

## Settings

Set these on the widget's entry in `~/.config/omarchy/shell.json`, or with
`omarchy bar set io.github.ehlxr.advanced-workspaces <key> <value> --json`:

| Key | Default | Meaning |
| --- | --- | --- |
| `perMonitor` | `true` | Show only workspaces belonging to this bar's monitor. Set `false` to show all of them on every bar. |
| `showEmpty` | `false` | Keep every workspace number on the bar up to `maxWorkspaceId`, occupied or not. Set `true` for stock-like behaviour. |
| `showIcons` | `true` | Draw an app icon per open window. |
| `maxIcons` | `0` | Cap icons per workspace, collapsing the rest to `+N`. `0` means no cap. |
| `iconSize` | 80% of the bar's icon canvas | Logo size in px (minimum 6). 13 px on the stock theme — a hair smaller than the number beside it. |
| `iconGap` | `4` | Space in px between two entries in a pill, so logos never touch. |
| `systemIcons` | `true` | Draw each window's real logo from its desktop entry and the system icon theme. Set `false` to always use Nerd Font glyphs. |
| `remoteIcons` | `false` | Fetch brand logos over the network when nothing local resolves. See [Logos](#logos). |
| `remoteIconSource` | dashboard-icons via jsDelivr | URL template for the logo fetch; `{slug}` is replaced with the brand slug. |
| `iconOverrides` | `{}` | Per-app icon overrides, keyed by window class or `title:`. See [When a logo is wrong](#when-a-logo-is-wrong). |
| `maxWorkspaceId` | `10` | Highest workspace id to consider. |
| `localWorkspaceNumbers` | `false` | Label each monitor's bank from 1 instead of using the global Hyprland id. |
| `workspacesPerMonitor` | `10` | Size of a bank when local numbering is on. |
| `showScratchpad` | `true` | Show a pill for the scratchpad while it holds windows. |
| `scratchpadName` | `special:scratchpad` | Which special workspace that pill tracks. |
| `scratchpadLabel` | `S` | Text on the scratchpad pill. Set `""` for icons only. |

```bash
omarchy bar set io.github.ehlxr.advanced-workspaces maxIcons 4 --json
omarchy bar set io.github.ehlxr.advanced-workspaces showEmpty true --json
```

Defaults match the behaviour above, so an existing install keeps working
untouched. The one default that changes what you see is `systemIcons`: windows
now draw their real logo where one resolves and fall back to the Nerd Font
glyph where none does. `remoteIcons` is the only setting that reaches the
network, and it stays off until you turn it on.

## Logos

Every window's icon comes from the most specific source that resolves:

1. **Your override**, if you set one for that window's class (or exact title).
   An override is an instruction, so it outranks everything below.
2. **A site rule.** A browser tab whose title matches one of the site patterns
   (a GitHub tab, a YouTube tab) shows that site's logo rather than the
   browser's.
3. **The application's own icon.** A desktop entry whose id matches the window
   class exactly wins outright; failing that the class goes through
   `heuristicLookup`. Either way the entry's `Icon=` is resolved against the
   system icon theme. This is what gets VS Code (`code` → `vscode`) and Vivaldi
   (`vivaldi-stable` → `vivaldi`) right, and it covers most apps.
4. **The Nerd Font glyph** the rule table picked, when a fetch is not an option.

Steps 1 to 3 are entirely offline and are what `systemIcons` turns on. The
exact-id match in step 3 matters for short, generic classes: the heuristic
scores entries by name and exec similarity, so a class like `zen` can lose to a
worse entry even when its own desktop entry is sitting right there.

Whichever source wins, the artwork is drawn into a fixed rounded tile with the
image clipped to it. Icons arrive in every shape and with their own padding
baked in, so a bare circle sitting next to a full-bleed square would otherwise
read as two different sizes; the tile gives every window the same footprint.
A logo that fails to decode falls back to the glyph rather than leaving an
empty tile behind.

The tile is `iconSize` px square with `iconGap` px between neighbours. Like the
rest of this widget's settings they only take effect after a shell restart —
editing `shell.json` alone leaves a running bar on its old values:

```bash
omarchy bar set io.github.ehlxr.advanced-workspaces iconSize 16 --json
omarchy restart shell
```

### When a logo is wrong

Set `iconOverrides` on this widget's entry to pin a window down by hand. Keys
are window classes (any case), or `title:<exact title>` for one window when the
class is too broad. Values are an icon-theme name, a path to an image, or a
literal glyph to draw as text:

```bash
omarchy bar set io.github.ehlxr.advanced-workspaces iconOverrides '{
  "zen": "zen-browser",
  "title:LibrePods": "me.kavishdevar.librepods",
  "code": "󰨞",
  "steam": "/home/me/.local/share/steam.png"
}' --json
```

A value the icon theme does not have is drawn as text rather than showing
nothing, which is what makes a glyph or an emoji work. Overridden windows are
skipped by the network fetch, so nothing is downloaded for them. To find a
window's class, run `hyprctl clients -j | jq -r '.[] | "\(.class)\t\(.title)"'`.

### Fetching logos over the network

`remoteIcons` adds a fourth source: when a window has no local icon, or is a
browser tab on a site whose logo is worth having, the logo is downloaded once
and cached on disk under `~/.cache/advanced-workspaces/icons/`. One request per
brand, ever — a restart reuses the cache.

```bash
omarchy bar set io.github.ehlxr.advanced-workspaces remoteIcons true --json
```

It is off by default, and it is the only part of the widget that touches the
network. What is sent is a brand slug — `github`, `openai`, `vivaldi` — never a
window title or a class: titles are matched against the site patterns locally,
and only the slug of a match is requested. Fetches default to
[homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons)
over jsDelivr; `remoteIconSource` points `{slug}` at any other host that serves
an image:

```bash
omarchy bar set io.github.ehlxr.advanced-workspaces remoteIconSource \
  'https://example.com/logos/{slug}.png' --json
```

A slug the host does not have is remembered as a miss and falls back to the
glyph instead of retrying on every render.

### Keeping every workspace on the bar

`showEmpty: true` pins all of `1..maxWorkspaceId` so the pills never move under
the pointer. Hyprland only reports workspaces that exist, so the missing numbers
are synthesised, and with `perMonitor: true` each one lands on a bar by asking,
in order: where that workspace lives right now, what your Hyprland workspace
rules say, then the nearest live workspace below it — sequential banks (`1-5` /
`6-10`) and interleaved ones (odds / evens) both work. Clicking an empty number
creates it, the same as a keybind would.

### Local numbers per monitor

Hyprland workspace ids are global. If your setup pins fixed banks such as
`1-10`, `11-20` and `21-30`, the widget can show every bank as `1-10`:

```bash
omarchy bar set io.github.ehlxr.advanced-workspaces localWorkspaceNumbers true --json
omarchy bar set io.github.ehlxr.advanced-workspaces workspacesPerMonitor 10 --json
omarchy bar set io.github.ehlxr.advanced-workspaces maxWorkspaceId 20 --json
```

Labels only — pinning the banks stays your Hyprland config's job.

### The scratchpad

`SUPER + ALT + S` stashes a window in `special:scratchpad`, `SUPER + S` brings it
back. The pill appears while the stash holds windows, shows an icon per stashed
window, lights up on the monitor currently displaying it, and toggles the stash
on click. It shows on every bar, because the scratchpad is one global stash
rather than something a monitor owns.

## Adding an app icon

Icons live in `IconRules.js` as an ordered list of `{ pattern, icon }`. The
pattern is a case-insensitive regex tested against the window title first and
the window class second, and the **first match wins** — so title-specific rules
have to sit above generic class rules, or an Amazon tab in Firefox would render
the Firefox icon.

To find the class of a window you want to add:

```bash
hyprctl clients -j | jq -r '.[] | "\(.class)\t\(.title)"'
```

This table decides the glyph, which is what gets drawn when no logo resolves
for the window (see [Logos](#logos) for the order the sources are tried in).

### Adding a site logo

Brand slugs for the logo fetch live in `siteLogos`, just below the glyph table,
and are matched against the window title the same way:

```js
{ pattern: ".*github.*", logo: "github" }
```

The slug is whatever the host serves — with the default source that is
`https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/png/<slug>.png`. Add
`cls: true` when the pattern is a window class rather than a title, as the
dedicated Chromium PWAs are (`twitter-x`, `brave-x.com`).

## Uninstall

```bash
omarchy plugin remove io.github.ehlxr.advanced-workspaces
```

## Development

The icon decisions live in `IconRules.js` (the rule table) and `IconLogic.js`
(slugs, overrides) as plain functions with no Quickshell dependency, so they run
under Node:

```bash
npm test        # node --test
```

The QML itself needs a running desktop. Editing a bar widget needs a shell
restart — the "local plugin changed, reloading" hot reload does not rebuild bar
surfaces:

```bash
omarchy plugin validate ~/.config/omarchy/plugins/io.github.ehlxr.advanced-workspaces
/usr/lib/qt6/bin/qmllint -I "${OMARCHY_PATH:-/usr/share/omarchy}/shell" Workspaces.qml
omarchy-restart-shell
qs log -i "$(qs list --all | awk '/^Instance/ {print substr($2, 1, length($2)-1); exit}')"
```

CI runs `npm test` only; the widget is verified by hand against a real session.

## Credits

Forked from [Decent Workspaces](https://github.com/TheTrueFerret/omarchy-decent-workspaces)
by [@TheTrueFerret](https://github.com/TheTrueFerret) (MIT), which is where the
workspace, scratchpad, and glyph work below all comes from.

The icon map is adapted from the `saif.workspaces` plugin by Saif Omar (MIT).

`showEmpty` was fixed by [@roddutra](https://github.com/roddutra) (#2), local
workspace numbering added by [@jorgeccastro](https://github.com/jorgeccastro)
(#3), and the scratchpad pill suggested by
[@sirfrank0](https://github.com/sirfrank0) (#4).

## License

MIT
