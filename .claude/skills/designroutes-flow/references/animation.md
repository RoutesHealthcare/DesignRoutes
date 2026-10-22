# Animation

A flow can step through a process: each step changes some shapes (lights them up, moves them, relabels them, adds
or hides them), and the editor plays the steps in order. Use it whenever a flow explains something that happens in
order: a request through systems, a process, an algorithm, a before-and-after.

The rules here were confirmed against the bundled parser (`scripts/check-flow.mjs` reports the step count and any
problems) and, for playback, in the editor's presentation mode; the language reference itself doesn't cover
animation yet.

## The block

```
@animation start
step 1
   $check [fill=#FFE38A stroke=#E69138]
   $about "Check the stock."
step 2
   $check [fill=#FFFFFF stroke=#2B3A47]
   $pick [fill=#FFE38A stroke=#E69138]
   $about "In stock, so pick and pack."
@animation end
```

- One block per file, and it's the last thing in the file: nothing may come after `@animation end`.
- `step N` starts a step; numbers must be unique and play in number order. Every change line belongs to the step
  above it, so the block must start with a step line.
- Indenting the change lines is the house style, not a rule.

## Change lines

| Line                  | Does                                                                                         |
|-----------------------|----------------------------------------------------------------------------------------------|
| `$id ...`             | Changes shape `id`. Anything a shape line has can follow: a new type, `"label"`, `{ list }`, `@ x,y WxH` to move or resize it, `[settings]`. |
| `+id: type ...`       | Adds a new shape at this step, written like a shape line. The id must not exist already.    |
| `-$id`                | Hides the shape.                                                                              |
| `+$id`                | Shows a hidden shape again.                                                                   |

- Changes carry forward: a shape keeps what a step gave it until a later step changes it again. So to light a
  shape for one step only, set it back in the next step.
- Settings you write replace only those settings; others stay.
- A hidden shape can't be changed: show it with `+$id` first.
- If the same id comes up twice in one step, only the later line counts (the checker warns).
- Changing a shape's type drops anything the new type can't keep, such as a table's columns (the checker notes it).
- Only shapes can be animated, not connections. A shape added with `+id:` exists only in the animation, so no
  connection outside the block can use it.

## How it plays

The editor's **Present** button plays the animation full screen. A bar at the bottom has Back, a step list (`Start`,
then `Step 1`, `Step 2`...), Next and Exit; → , space or a click go forward, ← goes back, Esc stops. `Start` is the
drawing as written, before any step.

- **On one page, changes glide.** Moving to a step tweens what changed over about half a second, so a shape given a
  new `@ x,y` slides there. That's what makes a moving marker work (below).
- **The player follows the steps between pages.** A step "touches" the pages of the shapes it changes. If the page
  on screen is one of them, the player stays and tweens; if not, it switches to the first page the step touches,
  without a tween. So a step that changes only a caption on page 3 takes the audience to page 3, and the next step
  that changes page 1 takes them back.
- **An add needs company.** A step whose only change is `+id:` (with no `in=`) is counted as touching page 1, so on
  any other page, pair the add with a `$` change to a shape on the page it belongs on (its caption, say), or give it
  `in=` a container there.
- **Going back uses the step being undone.** Back from step 14 to 13 shows the page step 14 touched, so after a page
  jump, Back stays on the jumped-to page for one press before returning. Forward play is unaffected; mention it if
  someone will present by going back and forth.

## Ids across pages

The block covers the whole file, so `$id` finds a shape on any page, and one step may change shapes on more than one
page. That only works when the id is unique across all pages: an id used on two pages is an error inside the
animation ("can't tell which one it means"). When a file has several pages, give each page its own ids (a prefix
per page, such as `sq_client` on a sequence page) for any shape you mean to animate.

## The pattern to use

The palette's own animations all follow one pattern, and it reads well:

1. Put a caption text shape on the page (`about: text "..."`), placed like any other shape, wide enough for a
   sentence.
2. In each step, light up the shapes taking part with `[fill=#FFE38A stroke=#E69138]` (or the user's brand
   highlight), set the previous step's shapes back to their normal fill and `stroke=#2B3A47`, and rewrite the
   caption to say what's happening in one sentence.
3. In the last step, set everything back to normal and make the caption a one-sentence summary of the whole thing.

### A moving marker

To show something travelling (a request between systems, a parcel between depots, a form between teams), add a
small pill in step 1 and move it in later steps:

```
step 1
   +token: terminator "GET /orders" @ 20.5,96 30x9 [fill=#FA4616 stroke=#FA4616 text=#FFFFFF size=8]
   $about "The client app wants a list of orders."
step 2
   $token "where?" @ 20.5,39 30x9
   $about "It asks DNS where the API is."
```

Place it inside the box it's visiting, low and centred (box x + (box width − 30) / 2, box y + 17 for a 28 mm box),
so it doesn't hide the box's label. 30x9 at 8 pt is the smallest that reads well when presenting. Relabel it as it
goes ("200 OK", "401") and recolour it to show trouble. Don't hide and re-show it: a show and a change in the same
step collide (only the later line counts), so keep it visible and change it instead.

### A walkthrough across pages

Plan the story page by page: the main walkthrough on the overview page, a step that changes only a caption on a
detail or reference page to take the audience there, then a step back on the overview for the next part. Give each
page that takes part a caption shape of its own (`about`, `fail_about`...), since `$about` can only name one page's
shape.

Step numbers that match numbers already on the drawing (connection labels, step boxes) make the animation and the
static drawing easy to read together. Run the checker afterwards: it reports how many steps it read.
