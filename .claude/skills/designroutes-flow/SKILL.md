---
name: designroutes-flow
description: The DesignRoutes .flow diagram language, complete, with how to lay every shape out at fixed positions, split drawings across pages and animate them step by step for presenting. Use whenever writing, editing, reading, explaining, reviewing or converting a .flow file or snippet (flowcharts, swimlanes, ER/database diagrams, UI wireframes, dashboards and charts, mind maps, org charts, UML, BPMN, sequence and C4 diagrams), when the user asks for a DesignRoutes diagram, flow or walkthrough of something, or wants a process, system or piece of code explained as a diagram, even if they don't say .flow.
---

# The `.flow` language

A `.flow` file is a whole DesignRoutes drawing as plain text: every page, shape, connection and key, one statement per
line. The editor saves it, shows it in its text pane, and rebuilds the canvas from it on every change, so the text is
the drawing.

This file is the language. Animation, the long lists and the layout method are kept apart from it; look in them
when needed:

- [references/shapes.md](references/shapes.md): every shape type by palette group, with what it is, its default label
  (which shows its label format), sample chart values and default size. Open it when choosing a type you're not sure
  of, or reading one you don't recognise.
- [references/aliases.md](references/aliases.md): the other names a type can be written as (`rect`, `diamond`, `db`...).
- [references/placement.md](references/placement.md): how to give every shape a fixed position on a grid without
  overlaps. Open it whenever you write or extend a flow.
- [references/animation.md](references/animation.md): the `@animation` block, which steps through a flow by lighting
  up, moving, adding or hiding shapes. Open it whenever a flow explains something that happens in order.
- [references/examples.md](references/examples.md): complete real files (swimlanes, kanban, mind map, org chart,
  every connection type, every UI pattern, a whole app wireframe). Open one when building something similar. The
  README examples leave positions out to show automatic layout; when adapting one, add positions as in placement.md.

<!-- skill-only -->
Check any flow you write with the editor's own parser, bundled in this skill (needs Node 18+, nothing to install;
the path is relative to this skill's folder):

```
node scripts/check-flow.mjs file.flow     # or - to read stdin
```

If Node isn't available, check by hand against the rules below instead.

If the user has attached an editor export (`DesignRoutes-editor.html`) and Python has Playwright with Chromium, also
render the flow in the real editor and look at the pictures before handing it over, including a few animation
steps if it has any:

```
python3 scripts/render-flow.py DesignRoutes-editor.html file.flow out/ --steps 1,5,9
```
<!-- /skill-only -->

## A whole file

```
flow 1
page "Orders" size 304x163 direction LR

# Comments start with # at the start of a line or after a space.

start: terminator "Order placed" @ 15,20
check: decision "In stock?" @ 75,15 40x24
pick: process "Pick and pack" @ 145,20 [fill=#DCE3EB]
wait: process "Back-order" @ 145,60
ship: terminator "Shipped" @ 215,20
sales: bar "Orders per day" { 3, 5, 2, 7 } @ 15,60 50x34
orders: table "orders" { id; customer_id; placed_at } @ 75,60 40x30
customers: table "customers" { id; name; email } @ 15,105 40x30

start -> check
check -> pick : "yes"
check -alt-> wait [weight=1.5] : "no"
wait ..> pick : "when it arrives"
pick -> ship
customers ||--o{ orders

key "Key" @ 145,95
```

## Statements

| Statement  | Looks like                                    | Where                                                                    |
|------------|-----------------------------------------------|--------------------------------------------------------------------------|
| Header     | `flow 1`                                      | Optional. If present it's the first statement and the version must be 1. |
| Icon       | `icon server "data:image/svg+xml;base64,..."` | After the header, before any page.                                       |
| Page       | `page "Orders" size 297x210 direction LR`     | Starts a page; everything up to the next page line is on it.             |
| Shape      | `pick: process "Pick and pack" @ 145,20`      | On a page.                                                               |
| Connection | `pick -> ship : "next"`                       | On a page.                                                               |
| Key        | `key "Key" @ 145,95`                          | On a page; at most one per page.                                         |
| Animation  | `@animation start` ... `@animation end`       | Optional; last in the file. See references/animation.md.                 |

A file with no `page` line still works: everything goes on one page called `Page-1`.

**Rules for every line**

- **Comments:** `#` starts a comment at the start of a line or after a space, to the end of the line. A `#` inside
  quotes, or straight after `=` (`fill=#1F6F78`), is not a comment. So a list with spaces must be quoted:
  `colours="#AA3377 #228833"`.
- **Ids:** a letter or `_`, then letters, digits, `_` or `-` (`order_2`, `pick-and-pack`). Unique on their page
  (other pages can reuse them). Ids are case-sensitive; keywords and type names aren't (`PROCESS`, `Direction lr`).
- **Quoted text:** `\"` for a quote, `\\` for a backslash, `\n` for a new line:
  `"Delete this file?\nThis can't be undone."`.
- **Units:** positions and sizes in millimetres from the page's top left. Text `size` and line `weight` in points.
  Colours are `#` and six hex digits.
- **Order matters for drawing:** shapes later in the file are drawn on top of earlier ones, so put backgrounds
  (frames, panels, device screens) first. A connection is drawn just above the later of its two shapes.

## Pages

```
page "Name" size WxH direction LR
```

- `"Name"`: required; shown on the page's tab.
- `size WxH`: optional, mm, each side 50 to 5000 (`297x210` is A4 landscape, `420x297` A3). Without it the page grows
  with its content, from A4 landscape up. With it the page stays that size; anything past the edge shows on grey and
  is cut from PNG/PDF exports.
- `direction`: optional; which way shapes with no position are laid out: `TB` (default; `TD` is the same), `LR`,
  `BT`, `RL`.

Pages are independent: connections and `in=` only refer to shapes on the same page.

## Shapes

```
id: type "label" { list } @ x,y WxH [settings]
```

Only `id: type` is required; the other parts can come in any order.

| Part             | Meaning                                                                                                                                |
|------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| `type`           | The shape type, or an alias. All of them: [references/shapes.md](references/shapes.md).                                                |
| `"label"`        | The shape's text. Without one it has none. Many shapes read structure from it (below).                                                 |
| `{ list }`       | Data, for tables, grids and charts only (below).                                                                                       |
| `@ x,y`          | Top-left corner, mm. Without it the shape is placed automatically, following the page's direction.                                     |
| `WxH` after `@`  | Width and height in mm (2 to 2000). Without it the shape is sized to fit its text. Tables and grids take their height from their rows. |
| `WxH` on its own | A size with no position: placed automatically, at that size (`40x20`).                                                                 |
| `[settings]`     | Look and behaviour, separated by spaces.                                                                                               |

### Shape types at a glance

Canonical names by group (full table with meanings and label formats in [references/shapes.md](references/shapes.md)):

- **Flowchart:** process decision terminator data subprocess document multidoc manualInput manualOp preparation delay
  offPage ellipse text
- **Database:** database table
- **Systems / C4 / network:** server cloud user api c4person c4system c4container c4component c4external firewall router
  loadbalancer queue cache bucket phone service
- **Containers:** container pool lane c4boundary scroll
- **UI wireframe:** browser mobile tablet smartwatch appwindow field button dropdown checkbox radio progress progressbar
  switch slider password numberinput segmented search textarea datepicker timepicker colourpicker upload otp togglechips
  rangeslider formfield spinner skeleton toast emptystate inlineerror dropdownmenu contextmenu menubar tabbar fab
  backheader divider footer hero splitpane scrollbar navbar modal card alert tooltip avatar badge rating glyph tabs
  breadcrumb pagination stepper pills list sidebar accordion image video carousel codeblock chatbubble commentthread
  bell usermenu mapview satellite streetview mappin directions captcha imagecaptcha textcaptcha grid
- **Charts / BI:** bar hbar stackedbar stackedhbar percentbar percenthbar histogram waterfall funnel line area
  stackedarea percentarea radar radararea polar spiral pie donut scatter bubble candlestick boxplot heatmap gantt
  treemap wordcloud sankey chord tilemap worldmap countrymap routemap sparkline bullet dial kpi legend legendrow
- **Planning:** centraltopic topic sticky callout milestone timeline phases mood personcard
- **UML:** umlclass state initial final lifeline activation (actor = `user`, use case = `ellipse`)
- **BPMN:** startevent endevent timerevent messageevent intermediateevent gateway parallelgateway inclusivegateway
  eventgateway task usertask servicetask bpmnsubprocess dataobject

Common aliases: `rect`/`box`/`step` = process, `diamond` = decision, `start`/`end` = terminator, `db` = database,
`actor`/`person` = user, `note`/`label` = text, `frame` = container, `swimlane` = lane. Saved files always use the
canonical name.

### What a label can hold

The label is plain text for most shapes, but many read structure from it:

- **Parts, separated by `|`:** one slot per part. The first is the current one where that means something (open tab,
  current step, current page). `tabs "Home | Profile | Settings"`, `stepper "Cart | Details | Payment | Done"`,
  `navbar "Brand | Home | About"`, `breadcrumb`, `pagination "‹ | 1 | 2 | 3 | ›"`, `pills`, `list`, `sidebar`,
  `accordion`, `segmented`, `menubar`, `tabbar`, `footer`, `splitpane "Files | Preview"`, `timeline "Q1 | Q2 | Q3"`,
  `phases`, `legend`, `legendrow`, `otp "4 | 7 | 1 | 9"`.
    - `dropdownmenu "Sort by | Newest | Oldest"`: the field, then its options, the first lit.
    - `contextmenu "Cut | Copy | Paste | Delete"`: the first lit, the last set apart with a line.
    - `formfield "Email | sam@example.com | Required"`: name, what's typed, the message under it.
    - `togglechips "✓ Wi-Fi | Parking | ✓ Pool"`: a chip is on when its name starts with a tick.
    - `umlclass "User | id: int\nname: text | login()\nlogout()"`: name | attributes | operations, `\n` between lines.
    - `commentthread "Ana: Can we...? | Ben: Done | Reply…"`, `usermenu "Ana Smith | Profile | Sign out"`,
      `directions "From: Leeds | To: York | Turn left..."`.
    - Named chart parts, in the same order as the values: `treemap`, `wordcloud`, `sankey`, `chord`, `tilemap`,
      `worldmap`, `countrymap`, `routemap` (below).
- **Lines, separated by `\n`:** a headline then a caption: `kpi "£12.4k\nRevenue"`, `card "Title\nA line about it"`,
  `hero "A big headline\nWhy it matters"`, `modal "Delete this file?\nThis can't be undone."`,
  `personcard "Ana Silva\nHead of design"`, `c4system "Shop\n[Software system]"`, `codeblock`.
- **A number:** `progress "40%"`, `progressbar "60%"`, `slider "30%"`, `dial "72%"` fill to the percentage;
  `rangeslider "20–70%"` reads two; `rating "4/5"` a score; `bell "3"` a badge count.
- **A word:** `mood` is a smile for happy/great/good/love/`:)`, a frown for sad/angry/frustrated/worried/`:(`, and a
  straight mouth otherwise.

### Data in `{ }`

- **table**: its columns, separated by `;` or `,`: `orders: table "orders" { id; customer_id; placed_at }`.
- **grid**: rows separated by `;`, cells by `,`, the first row the header; `""` is an empty cell, and a cell holding
  `,` or `;` is quoted: `g1: grid { Name, Email; Ann, ann@example.com; Bob, "" }`.
- **charts**: numbers of 0 or more (only `waterfall` takes negatives). Without values a chart draws sample numbers.
    - One series: `sales: bar "Monthly sales" { 3, 5, 2, 7 }`.
    - Several series, a row each, rows the same length: `{ 3, 5, 2; 4, 1, 6 }`. For bar, hbar, line, area, radar,
      radararea and the stacked/percent kinds (stackedbar, stackedhbar, stackedarea, percentbar, percenthbar,
      percentarea). Other charts show one series.
    - Grouped points, groups separated by `;`: `scatter` x, y · `bubble` x, y, size · `candlestick` open, high, low,
      close · `boxplot` min, q1, median, q3, max · `gantt` start, length (a bar per task, top down).
    - Exactly two: `bullet "Sales vs target" { 60, 80 }` (value, target).
    - Named in the label: `treemap "Rent | Food | Fun" { 900, 400, 150 }`, `wordcloud "Fast | Simple" { 9, 5 }`,
      `tilemap "North | South" { 3, 9 }`, `worldmap "France | Brazil | USA" { 3, 9, 5 }` (countries by name, long name
      or
      ISO code), `countrymap "Scotland | Wales | London" { 4, 7, 9 }`,
      `routemap "West Yorkshire | North Yorkshire" { 9, 4 }`.
    - `sankey "Visits | Signed up | Left" { 1, 2, 60; 1, 3, 40 }`: a from, to, amount three per flow; from and to are
      the names' places counting from 1.
    - `chord "UK | France | Spain" { 0, 5, 3; 4, 0, 1; 2, 1, 0 }`: a square table, a row per group of what it sends
      to each.
    - `heatmap "Load" { 1, 5, 8; 9, 3, 2 }`: a row per row of cells, shaded pale to the fill.
    - `spiral`: twelve values per turn. `sparkline "Sales" { 3, 9, 4, 6 }`: a small frameless line.
    - Per-chart sample values are in [references/shapes.md](references/shapes.md).

### Shape settings

Inside `[ ]`, separated by spaces: `[fill=#DCE3EB stroke=#2B3A47 weight=1.5]`.

| Setting   | Values                                                                                              | Meaning                                                                                                                    |
|-----------|-----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| `fill`    | a colour like `#DCE3EB`                                                                             | Fill colour.                                                                                                               |
| `stroke`  | a colour                                                                                            | Line colour.                                                                                                               |
| `text`    | a colour                                                                                            | Text colour.                                                                                                               |
| `weight`  | 0.25 to 12                                                                                          | Line thickness, points.                                                                                                    |
| `size`    | 4 to 96                                                                                             | Text size, points.                                                                                                         |
| `icon`    | an icon's name                                                                                      | Draw the shape with that picture (see Icons).                                                                              |
| `state`   | `on` / `off`                                                                                        | Switches, checkboxes, radio buttons: ticked/selected/on. Off is the default, never written.                                |
| `side`    | `left` / `right`                                                                                    | Chat bubbles: right is a message from me, mirrored. Left is the default.                                                   |
| `bg`      | `on` / `off`                                                                                        | Charts and framed wireframe shapes (nav bar, menu bar, tab bar, back header, hero, split pane, carousel, user menu, dropdown menu, KPI card): whether the backdrop is filled. On is the default, never written.           |
| `bgfill`  | a colour                                                                                             | ... the backdrop's colour. White is the default, never written.                                                                                                            |
| `map`     | `uk`, `france`; `yorkshire`, `lancashire`, `greatermanchester`, `merseyside`, `cheshire`, `cumbria` | `countrymap`: which country (UK default). `routemap`: which area (Yorkshire default).                                      |
| `lang`    | `py`, `js`, `jsx`, `ts`, `tsx`, `cs`, `php`, `html`, `css`, `sql`, `java`, `go`, `rb`, `rs`, `swift`, `kt`, `cpp`, `c`, `sh`, `bat`, `ps1`, `pl`, `yaml`, `json`, `xml`, `xsd` (full names like `python`, `javascript`, `typescript`, `csharp`, `ruby`, `rust`, `kotlin`, `shell`, `batch`/`cmd`, `powershell`, `perl`, `yml` also accepted, normalised to the short code) | `script`: which language's extension shows in its corner, e.g. `.py` (`py` default). `jsx`/`tsx` are distinct from `js`/`ts`. |
| `colours` | `#AA3377,#228833` (or quoted with spaces)                                                           | Charts and legends: a colour per series in order, the first replacing the fill. Give a chart and its legend the same list. |
| `in`      | a container's id                                                                                    | The container, pool, lane or scroll area the shape is inside.                                                              |
| `flow`    | `row` / `column`                                                                                    | Containers only: line up the members in the order of their lines.                                                          |
| `gap`     | 0 to 200                                                                                            | With `flow`: mm between members (4 if left out).                                                                           |
| `align`   | `start`, `center`, `end`, `stretch`                                                                 | With `flow`: how members sit across it. `stretch` (default) makes them full width/height.                                  |
| `scroll`  | 0 to 10000                                                                                          | A scroll area: mm scrolled along its bar (0 if left out).                                                                  |

### Containers and swimlanes

`container` is a labelled frame; `pool` and `lane` have their label down the left (swimlanes); `c4boundary` is a
dashed C4 boundary. A shape goes inside with `in=`, on its own line, so moving a shape between containers changes
only that line:

```
orders: pool "Order process"
customer: lane "Customer" [in=orders]
shop: lane "Shop" [in=orders]
order: terminator "Order placed" [in=customer]
check: decision "In stock?" [in=shop]
order -> check
```

- Containers nest (lanes in a pool, boxes in a lane). Two containers can't each be inside the other, and `in` must
  name a container on the same page (otherwise: error, and the shape is drawn outside).
- A container with no `@` is placed with its members laid out inside it; without `WxH` it's made big enough. With no
  `@` of its own it goes round any members that have one.
- A pool stacks lanes with no place of their own, one under the other, each as wide as the pool.
- Deleting a container leaves its members, no longer inside anything.

### Flexi containers

A container with `flow` lines its members up itself, like a flexbox, in the order of their lines:

```
board: container "Sprint 12" [flow=row gap=6]
todo: container "To do" [flow=column in=board]
done: container "Done" [flow=column in=board]
c1: process "Password reset" [in=todo]
c2: process "Login page" 40x20 [in=done]
```

- Members have no position. A member can have its own size, `WxH` with no `@`; an `@ x,y` on a member is read as its
  size only.
- `align=stretch` (default) stretches members with no size of their own; tables and grids keep their height.
- Without `WxH` a flexi container fits round its members; with one, members that don't fit stick out past the end.
- The palette's patterns (login form, dashboard, kanban...) are flexi containers; see examples.md.

### Scroll areas

`scroll` (also `scrollarea`, `scrollpane`, `scrollview`) is a container that keeps its size and cuts off what
doesn't fit, with a scrollbar down the right (along the bottom with `flow=row`) whose thumb shows how much fits.
With `flow` it lines members up too:

```
results: scroll "Search results" @ 15,15 80x70 [flow=column gap=3]
r1: process "Flow editor: diagrams as text" [in=results]
r2: process "Swimlanes in five minutes" [in=results]
```

`scroll=40` shows it scrolled 40 mm along (kept to the end of its contents); a placed member's `@ x,y` is where it
would be unscrolled. What's cut off is still in the text and in Visio/draw.io/Mermaid exports; PNG and PDF cut it off
as on the page.

### Mind maps

A `centraltopic` (also `mindmap`, `centralidea`) starts a mind map. The `topic` lines (also `branch`, `subtopic`)
after it, up to the next central topic, are its topics. Indentation is the hierarchy: a topic hangs off the nearest
topic above it that's indented less; an unindented one hangs off the central topic. Branch lines are drawn for you,
with no connections written:

```
idea: centraltopic "New website" @ 20,20
goals: topic "Goals"
  signups: topic "More sign-ups"
  speed: topic "Faster pages"
users: topic "Users"
```

- Only the central topic takes a place; the map spreads topics on both sides and moves with it. A topic's `WxH` is
  kept as its size, but a topic with `@ x,y` leaves the map and stands on its own.
- Any amount of indent works, as long as children are indented more than their parent (a tab counts as 4 spaces).
- A map written with connections instead (`idea -> goals`) still works; those topics keep the connections instead of
  branch lines.

### Sequence diagrams

The first `lifeline` (also `participant`) on a page that isn't in a container starts a sequence diagram, and every
later lifeline with no `@` and no `in=` joins it. Connections between its lifelines are messages:

```
client: lifeline "Client"
server: lifeline "Server"
db: lifeline "Database"
client -> server : "GET /orders"
server -> db : "query"
db -data-> server : "rows"
server -data-> client : "200 OK"
```

- Lifelines stand side by side in line order; each message is a level arrow, one under another in line order. The
  lifelines are as long as the messages need. Only the first lifeline takes a place; moving it moves the sequence.
- A later lifeline with `@` stands on its own. A message with its own `beginpt`, `endpt` or `route=elbow` is drawn as
  those say. A message from a lifeline to itself isn't drawn yet (it stays in the text).
- Use `->` for calls and `-data->` for replies: a key lists `..>` as "Dependency", which misdescribes a reply.
  `activation` is an activation bar shape.

### Automatic layout

Shapes with no `@` are laid out automatically in the page's direction, following the connections (a layered graph).
Mixing placed and unplaced shapes works, and that's how flows written by others may arrive.

**When writing a flow, give every shape a fixed place, `@ x,y WxH`**, so the drawing opens exactly as written and
looks the same for everyone. The exceptions are shapes whose place belongs to something else, where an `@` would
break the diagram: members of a flexi container (size only, `WxH` with no `@`), topics under a central topic (an `@`
detaches them from the map) and every lifeline after the first in a sequence (an `@` stands it on its own). Place
the container, central topic or first lifeline instead. How to work out coordinates without overlaps:
[references/placement.md](references/placement.md); read it before placing anything.

## Connections

```
from TYPE to [settings] : "label"
```

`from` and `to` are shape ids on the same page. Settings must come **before** the label. Quotes round the label are
optional: everything after the colon is the label. Each connection is its own line (`a -> b -> c` is an error). A
connection naming an id that no shape has makes that shape: a `process` with the id as its text.

### Connection types

Each type has a line, ends, and a meaning that the page's key shows.

| Type             | Write           | Line and ends                                   | Means                                                                      |
|------------------|-----------------|-------------------------------------------------|----------------------------------------------------------------------------|
| Sequence         | `->`            | solid, arrow                                    | This step happens next.                                                    |
| Data flow        | `-data->`       | dashed, arrow                                   | Information passes from one to the other.                                  |
| Message          | `-msg->`        | dashed, circle to hollow triangle               | One notifies the other, often across teams or systems (BPMN message flow). |
| Alternative path | `-alt->`        | dotted, arrow                                   | Only taken if something goes wrong or a condition is not met.              |
| Two-way          | `<->`           | solid, arrows at both ends                      | Exchange or sync in both directions.                                       |
| Annotation       | `..`            | dotted, no ends                                 | Related to, or see note. No flow is implied.                               |
| Dependency       | `..>`           | dashed, open arrow                              | Uses or depends on.                                                        |
| Association      | `--`            | solid, no ends                                  | Connected to.                                                              |
| Generalisation   | `--\|>`         | solid, hollow triangle                          | Is a type of.                                                              |
| Realisation      | `..\|>`         | dashed, hollow triangle                         | Implements.                                                                |
| Aggregation      | `o--`           | solid, hollow diamond at the start              | Has; the part can exist on its own.                                        |
| Composition      | `*--`           | solid, filled diamond at the start              | Owns; the part cannot exist without it.                                    |
| Crow's foot      | `\|\|--o{` etc. | solid `--` or dashed `..`, how many at each end | Each `from` has ... `to`; each `to` belongs to ... `from`.                 |

**Crow's foot:** start end, then `--` (solid) or `..` (dashed), then finish end.

| How many     | Start end | Finish end |
|--------------|-----------|------------|
| Exactly one  | `\|\|`    | `\|\|`     |
| Zero or one  | `\|o`     | `o\|`      |
| One or many  | `}\|`     | `\|{`      |
| Zero or many | `}o`      | `o{`       |

`customers ||--o{ orders` reads "each customer has zero or many orders; each order belongs to exactly one customer".
`team }o..|{ member` is a dashed many-to-many.

### Connection settings

| Setting            | Values                                                                                                        | Meaning                                                                                                                          |
|--------------------|---------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| `style`            | `solid`, `dashed`, `dotted`                                                                                   | Line pattern.                                                                                                                    |
| `start`, `end`     | `none`, `arrow`, `open`, `triangle`, `diamond`, `fdiamond`, `circle`, `one`, `zeroOne`, `oneMany`, `zeroMany` | The ends. `arrow` filled, `open` open arrow, `triangle`/`diamond` hollow, `fdiamond` filled; the last four are crow's foot ends. |
| `means`            | quoted text                                                                                                   | What the key says this line means.                                                                                               |
| `stroke`           | a colour                                                                                                      | Line colour.                                                                                                                     |
| `text`             | a colour                                                                                                      | Label colour.                                                                                                                    |
| `weight`           | 0.25 to 12                                                                                                    | Line thickness, points.                                                                                                          |
| `size`             | 4 to 96                                                                                                       | Label text size, points.                                                                                                         |
| `route`            | `straight`, `elbow`                                                                                           | Direct, or right angles routed round shapes.                                                                                     |
| `via`              | `"x,y x,y ..."`                                                                                               | An elbow line's bend points, mm from the page's top left.                                                                        |
| `beginpt`, `endpt` | `n`, `e`, `s`, `w`, or a side and a point along it from 0 to 1: `e@0.3`                                       | Pin an end to that side's middle (or that far along it: down for e/w, across for n/s) instead of facing the other shape.         |

Setting `style`, `start` or `end` makes a **custom line**, listed in the key with its own meaning:
`a -- b [style=dashed start=circle end=fdiamond means="Escalates to"]`. When the editor writes a line back it picks
the matching type: `a -- b [style=solid start=none end=arrow]` becomes `a -> b`.

## The key

```
key "Title" @ x,y
```

A key on the page: one row per connection type the page uses, each with a sample line and its meaning (or the
`means=` text). Title optional (`Key`), position optional (to the right of everything). It updates itself.

## Icons

```
icon name "data:image/svg+xml;base64,..."
```

A picture defined once at the top (SVG, PNG or JPEG data URI, up to 2 million characters), used by any shape with
`[icon=name]`. Image shapes and Visio imports keep their pictures this way. Never invent base64; when reading a
file, skip icon lines: they carry no meaning beyond the name.

## Errors

A line that can't be read is reported with its line number, and the rest is still drawn. Typical messages:

- `Unknown shape type "proces". Try: process, decision, ...`
- `"->>" is not a connection. Try -> for a sequence, -data-> for data flow, ..> for a dependency or ||--o{ for one to many.`
- `fill needs a colour like #1F6F78.`
- `Unexpected "[bad]" after the connection.`: settings written after the label.
- `There is no container "lane3" on this page.`: the shape is still drawn, just not inside anything.
- `A chart's values are numbers of 0 or more, like { 3, 5, 2, 7 }.`

## Grammar

```
file        = [ "flow 1" ] { icon } { page-block } [ animation ]
icon        = "icon" name "\"data:image/...;base64,...\""
page-block  = [ "page" "\"name\"" [ "size" W "x" H ] [ "direction" (TB|TD|LR|BT|RL) ] ] { shape | connection | key }
shape       = id ":" type { "\"label\"" | "{" list "}" | "@" x "," y [ W "x" H ] | W "x" H | "[" settings "]" }
connection  = id TYPE id [ "[" settings "]" ] [ ":" ( "\"label\"" | text ) ]
key         = "key" [ "\"title\"" ] [ "@" x "," y ]
settings    = { name "=" ( value | "\"text\"" ) }
comment     = "#" ... to the end of the line, at the start of a line or after a space
animation   = "@animation start" { "step" N { change } } "@animation end"
change      = "$" id [ type ] parts | "+" id ":" type parts | "-$" id | "+$" id
parts       = what a shape line has after its type, in any order (label, list, place, size, settings)
```

## Writing a flow

1. Pick the diagram kind and its shapes: flowchart (terminator → process/decision), swimlanes (pool + lanes + `in=`),
   ER (`table` + crow's foot), architecture (systems/C4 shapes + `-data->`, `..>`), wireframe (a device frame,
   then placed UI shapes on top), dashboard (charts + `kpi` + `legend`, often in flexi containers), mind map,
   org chart (`personcard` + `->`), sequence (lifelines + messages), UML class (`umlclass` + `--|>`, `o--`, `*--`),
   BPMN (events, tasks, gateways, `-msg->` between pools).
2. Give every shape a short meaningful id (`check_stock`, not `s7`) and a human label.
3. Choose connection types for their meaning: the key explains them, so `-alt->` for failure paths and `-data->` for
   data are worth using over plain `->`. Label every edge leaving a `decision`.
4. Place every shape with `@ x,y WxH` (exceptions and method above). Give the page a `size` that holds them all.
5. Add `key` when the page uses more than one connection type.
6. Use pages rather than crowding one: an overview first, then detail, reference tables or another view of the
   same thing on later pages, each named so its tab says what it holds ("1 Overview", "2 Step by step").
   Connections can't cross pages, so number steps and refer to them from page to page.
7. When the flow explains something that happens in order, add an `@animation` block that walks through it, with
   step numbers matching the drawing's (references/animation.md). Ids may repeat across pages, except on shapes
   the animation changes.
8. Check it against the review list under Reading a flow: every id connected is declared, settings come before
   labels, types are spelt as in the shape list.

<!-- skill-only -->

9. Run `check-flow.mjs` and fix anything it reports, including undeclared-id, unplaced and overlap warnings.
10. If an editor export is available, run `render-flow.py` and look at every page and a few animation steps.

<!-- /skill-only -->

## Reading a flow

1. **Pages** are separate diagrams. `direction` says which way it reads.
2. **Shapes are the nouns.** The label is what people see; the id is only a handle. The type gives the role:
   `terminator` start/end, `decision` a question, `process` a step, `database`/`table` stored data, `user`/`c4person`
   a person, `lane`/`pool` who does it. Unknown type: look it up in [references/shapes.md](references/shapes.md) or
   [references/aliases.md](references/aliases.md).
3. **Membership:** `in=x` puts a shape inside `x`; in swimlanes that's *who* does the step. Indented topics under a
   central topic are a hierarchy. Lifelines with connections are a sequence, top to bottom in line order.
4. **Connections are the verbs.** Follow `->` from the start terminator(s) for the main path; labels on edges from a
   `decision` are the conditions. `-alt->` is the unhappy path. `..>`, `--|>`, `..|>`, `o--`, `*--` and crow's feet
   are structure (uses, is-a, has), not steps in time. `-data->` and `-msg->` are things passing between parts.
5. **Settings are mostly presentation:** `@`, `WxH`, `fill`, `stroke`, `weight`, `size`, `route`, `via`,
   `beginpt`/`endpt` change the look, not the meaning. The ones that do mean something: `in=`, `state=on`,
   `side=right`, `means=`, `colours=` (pairs series with a legend), `map=`, `lang=`, `flow=` (order of lines = order shown).
6. **Comments** are the author's notes and often the best summary of intent.

A plain-English reading of the example at the top: *"When an order is placed, check stock. If it's in stock, pick and
pack it, then ship. If not, back-order it, and when stock arrives it goes to pick and pack. Each customer has zero or
many orders."*

**Things worth flagging in a review:** a connection to an id with no shape line (a typo the editor silently turns
into a process); a `decision` with one outgoing edge or unlabelled ones; unconnected shapes in a process flow; `in=`
naming something that isn't a container on that page; settings after a connection's label; `@` on flexi members or
mind-map topics (it's read as size, or pulls the topic out of the map); several connection types but no key.

## How much of a flow to read or ask for

- A flow of a few hundred lines is cheap: read or paste it whole, minus `icon` lines (base64, up to 2M chars each;
  replace them with `# icon name` if shapes use them).
- For one page of a multi-page file, only that `page` block is needed; pages don't refer to each other.
- For meaning only, coordinates (`@`, `WxH`, `via`, `beginpt`/`endpt`) can be stripped. For layout problems keep
  them, and look at the PNG if there is one.
- For a parse error, the message and the lines around it are enough, unless it's about ids or `in=`.

<!-- skill-only -->

- None of this needs the editor's source. Only changing the language itself does (in the DesignRoutes repo): start at
  `src/engine/flow/language.ts` (`parseFlow`, `shapeStmt`, `edgeStmt`), shape types in `src/shapes/<group>.ts`,
  aliases in `src/engine/flow/shape-kinds.ts`. After changing shapes, regenerate this skill's references with
  `node scripts/build-flow-skill.mjs`.

<!-- /skill-only -->
