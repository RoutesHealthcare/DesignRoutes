# Placing every shape

Every flow written with this skill gives each shape a fixed place, `@ x,y WxH`, so it opens exactly as written.
This file is the method. All numbers are millimetres from the page's top-left corner.

## What gets a place and what doesn't

| Shape                                              | Write                    | Why                                                        |
|----------------------------------------------------|--------------------------|------------------------------------------------------------|
| Ordinary shapes, containers, pools, lanes, the key | `@ x,y WxH`              | Fixed where written.                                       |
| Members of a plain container, pool or lane (`in=`) | `@ x,y WxH`, inside it   | Coordinates are the page's, not the container's.           |
| Members of a flexi container (`flow=`)             | `WxH` only               | The container lines them up; an `@` is read as size only.  |
| Topics under a `centraltopic`                      | nothing, or `WxH`        | The map places them; an `@` detaches a topic from the map. |
| Lifelines after the first in a sequence            | nothing                  | The sequence places them; an `@` stands one on its own.    |
| A scroll area's members                            | `@ x,y WxH`, unscrolled  | Where the member would sit with `scroll=0`.                |

Place the flexi container, central topic or first lifeline itself; what's inside follows it.

## Sizes

Use the default size from [shapes.md](shapes.md) unless the label needs more room. Shapes grow to fit their text, so
a long label in a default-sized box can grow into its neighbour. Allow roughly 2 mm of width per character on a line
of 10 pt text and 6 mm of height per line, then round up to a whole number. That's an estimate, not a measurement,
so leave the spacing below as a margin for error. Tables take their height from their rows: the editor draws about
7.6 mm per column plus 9 mm for the title (12 columns come out at 100 mm), and a `grid` about 7.6 mm per row
including its header, so size them that way and the layout won't shift when the file is opened.

Measured in the editor:

- **Lane and pool titles** run up a band about 8 mm wide on the left, so start a lane's first column about 14 mm in.
- **Sequence diagrams:** 38 mm lifelines stand about 50 mm apart (left edge to left edge), and each message takes
  about 10 mm of height, so ten lifelines need about 515 mm of width.
- **The key** is about 117 mm wide (its longest meaning sets this) and about 12 mm tall plus 8 mm per connection
  type listed. Leave room for it inside the page; a key past the edge shows on grey and is cut from exports.
- **`api` boxes** have two component notches on the left that take about 5 mm, so a centred two-line label crowds
  them at 41 mm wide. Keep `api` labels to a short name, or make the box wider.
- **Text shapes** centre their text; there's no alignment setting.

## A grid

Work on a grid of columns and rows rather than placing shapes one by one:

1. Lay the steps out in order along the main direction: left to right for process flows, top to bottom for
   hierarchies and org charts. Each step of the main path gets the next column (or row).
2. Make every column as wide as its widest shape and every row as tall as its tallest, then centre each shape in
   its cell so connections run straight.
3. Leave a gap of at least 20 mm between columns and 15 mm between rows. Widen a gap to 30 mm where a connection
   carries a label, so the label has somewhere to sit.
4. Start the first cell at 15,15 so nothing touches the page edge.

Branches from a `decision` go in the rows next to the main path: the main ("yes") path carries straight on, the
other answer drops to the row below (or the column beside it in a top-to-bottom flow). A path that rejoins the main
line, such as a back-order that ends in picking, goes back to the column it rejoins.

Worked example, the order flow from SKILL.md on a left-to-right grid:

```
page "Orders" size 265x150 direction LR
start: terminator "Order placed" @ 15,20 38x15
check: decision "In stock?" @ 73,15 40x24
pick: process "Pick and pack" @ 143,18 38x19
wait: process "Back-order" @ 143,60 38x19
ship: terminator "Shipped" @ 211,20 38x15
start -> check
check -> pick : "yes"
check -alt-> wait [route=elbow beginpt=s endpt=w] : "no"
wait ..> pick : "when it arrives"
pick -> ship
key "Key" @ 15,95
```

Here the columns are 38–40 mm wide with 20–30 mm gaps (30 mm after the decision, whose connections are labelled),
and each shape's y is chosen so its centre lines up with the row's centre (row 1 centres on y = 27). The "no" branch
leaves the decision's bottom and turns into the back-order step, rather than running diagonally. The key goes
below the drawing: at about 117 mm wide it wouldn't fit beside it on this page.

## Containers, pools and lanes

Size the container first, then place its members inside it:

- Leave about 6 mm between the container's edge and its members, and about 16 mm at the top for its title (as in
  the `singleton` example in [examples.md](examples.md), where the container is at 10,10 and its first member at
  16,26).
- For swimlanes, give the pool a place and size, then stack the lanes inside it, each as wide as the pool and tall
  enough for its row of steps, with the first column clear of the 8 mm title band. Each step goes in its lane's
  row and in its column on the grid, so a step that moves from one lane to another is a column further along.
- A member's `@` must fall inside its container; one outside it is drawn outside the box.

## Wireframes and other screens

Place the device or browser frame first (it's drawn underneath), then each UI shape on top of it, inside the frame's
screen area. Line the UI shapes up on a column grid with a consistent margin (8–10 mm from the screen edge works for a
phone), as a designer would.

## Routing connections

Straight connections are fine along the main path, where shapes share a centre line. Anywhere else, especially from
a band of tables or source shapes above or below the pipeline, a straight line runs diagonally and crosses other
lines and shapes. For those:

- Use `route=elbow` and pin the end to the side facing the line's source: `endpt=n` when it comes from above,
  `endpt=s` from below (`beginpt` likewise for the start).
- Leave a horizontal channel of clear space between bands (at least 10 mm) and run long lines along it with `via`
  bend points, so several lines share one tidy route instead of fanning out: `[route=elbow via="212,35 212,122
  469,122" endpt=n]`.
- Spread a band's shapes out so each line has a clear drop to its target, rather than packing them edge to edge.

## When a page gets crowded

Notes, explanations and reference tables crowd a diagram and push its shapes apart. Put them on a page of their own
instead: keep page 1 to the shapes and numbered connections, and explain the numbers on page 2. A step-by-step
swimlane (one lane per system, one column per step) and a `grid` table for reference detail both work well as
later pages. Lay out each page on its own grid; positions on one page don't affect another.

## The page

Give the page a `size` big enough for everything plus a 15 mm margin: the right-most shape's x + width + 15, and the
bottom-most shape's y + height + 15. Each side must be 50 to 5000. Put the key in clear space, usually to the right of
or below the drawing; it has a place like any shape.

## Checking

`check-flow.mjs` warns about any shape that should have a place and has none, and about placed shapes that partly
overlap (one wholly on top of another, such as a button on a screen, or a member inside its own container, is
fine). Fix every warning, then reread the coordinates row by row: shapes in one row share a centre line, and
columns don't drift.

If the user has given you an editor export, also render the flow and look at it (`scripts/render-flow.py`, see
SKILL.md). It's the only way to catch crowded labels, a key past the page edge or text too small to read.
