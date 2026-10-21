# Shape types

Generated from `src/shapes/*.ts` by `scripts/build-flow-skill.mjs`; edits here are overwritten.

Every type you can write after `id:`, by palette group. **Default label** is what a shape added from the palette
starts with: it doubles as an example of the label format (`|` separates parts, `\n` is a new line). **Size** is
the default width x height in mm, used when the line gives no `WxH` (most shapes still grow to fit their text).
Aliases are in [aliases.md](aliases.md).

## Flowchart

| Type | Palette name | What it is | Default label | Size | Notes |
|---|---|---|---|---|---|
| `process` | Process | A step or action |  | 38x19 |  |
| `decision` | Decision | A question; its outgoing connections are the answers, named in their labels |  | 38x25 |  |
| `terminator` | Start / end | Where the flow starts or ends |  | 38x15 |  |
| `data` | Data | Input or output of data (parallelogram) |  | 38x19 |  |
| `subprocess` | Subprocess | A step defined elsewhere, in its own flow |  | 38x19 |  |
| `document` | Document | A document produced or used |  | 38x22 |  |
| `multidoc` | Documents | Several documents |  | 41x24 |  |
| `manualInput` | Manual input | Data typed in by hand |  | 38x19 |  |
| `manualOp` | Manual operation | A step done by hand, not by the system |  | 38x19 |  |
| `preparation` | Preparation | Setting up before a step (hexagon) |  | 38x19 |  |
| `delay` | Delay | A wait |  | 33x19 |  |
| `offPage` | Off-page link | Continues on another page |  | 20x20 |  |
| `ellipse` | Ellipse | A plain ellipse; also a UML use case |  | 30x20 |  |
| `text` | Text | Text box | `Text` | 38x10 |  |

## Database

| Type | Palette name | What it is | Default label | Size | Notes |
|---|---|---|---|---|---|
| `database` | Database | Stored data (cylinder) |  | 30x28 |  |
| `table` | Table | A database table: name in the label, columns in `{ }` |  | 51x32 | columns in `{ }` |

## Systems, C4 and network

| Type | Palette name | What it is | Default label | Size | Notes |
|---|---|---|---|---|---|
| `server` | Server | A server |  | 15x25 |  |
| `cloud` | Cloud | A cloud service or the internet |  | 41x25 |  |
| `user` | User | A person or role; also a UML actor |  | 15x20 |  |
| `api` | System / API | A system, service or API |  | 41x20 |  |
| `c4person` | C4 person | someone who uses the system, a head over a body | `Customer\n[Person]` | 41x38 |  |
| `c4system` | C4 system | C4 software system: the dark blue box at the top level | `Shop\n[Software system]` | 51x28 |  |
| `c4container` | C4 container | an app or data store inside a system (put it in a boundary) | `Web app\n[Container: React]` | 51x28 |  |
| `c4component` | C4 component | a part of a container, in the lightest blue | `Sign-in\n[Component]` | 51x28 |  |
| `c4external` | C4 external | C4 external system: one outside the system being drawn, in grey | `Payments\n[External system]` | 51x28 |  |
| `firewall` | Firewall | a brick wall, its name under it | `Firewall` | 18x15 | fixed size |
| `router` | Router | a disc with arrows out each side | `Router` | 15x15 | fixed size |
| `loadbalancer` | Load balancer | one line in, fanned out to three | `Load balancer` | 20x15 | fixed size |
| `queue` | Queue | Message queue: messages waiting in a row | `Queue` | 25x10 | fixed size |
| `cache` | Cache | a cylinder with a lightning flash | `Cache` | 15x18 | fixed size |
| `bucket` | Storage bucket | a pail for files and blobs | `Files` | 15x17 | fixed size |
| `phone` | Phone | a mobile device (the mobile wireframe is the screen to draw on) | `Phone` | 10x18 | fixed size |
| `service` | Service | a hexagon, for one service among many | `Service` | 18x15 | fixed size |
| `script` | Script | a file with its language's extension in the corner ([lang=py]) | `script` | 23x33 |  |

## Containers

| Type | Palette name | What it is | Default label | Size | Notes |
|---|---|---|---|---|---|
| `container` | Container | a labelled frame; shapes dropped on it move with it | `Container` | 76x51 |  |
| `pool` | Swimlanes | Pool with two swimlanes; drop more lanes on it | `Pool` | 152x64 |  |
| `lane` | Lane | Swimlane: a band for one team or role | `Lane` | 152x32 |  |
| `c4boundary` | C4 boundary | a dashed frame round the containers of one system | `Shop [Software system]` | 102x64 |  |
| `scroll` | Scroll area | a frame that cuts off what does not fit, with a scrollbar | `Scroll area` | 76x51 |  |

## UI wireframe

| Type | Palette name | What it is | Default label | Size | Notes |
|---|---|---|---|---|---|
| `browser` | Browser |  | `Page content` | 76x51 |  |
| `mobile` | Mobile screen |  | `Screen` | 25x48 |  |
| `tablet` | Tablet | a screen in an even bezel, with a camera dot | `Screen` | 66x48 |  |
| `smartwatch` | Smartwatch | a face between two straps, the time in its label | `10:09` | 25x38 |  |
| `appwindow` | App window | Desktop app window: the title in its label, with minimise, maximise and close | `My app` | 76x51 |  |
| `field` | Text field |  | `Text field` | 51x9 |  |
| `button` | Button |  | `Button` | 30x10 |  |
| `dropdown` | Dropdown |  | `Select…` | 51x9 |  |
| `checkbox` | Checkbox |  | `Checkbox` | 41x8 | `state=on` |
| `radio` | Radio button |  | `Option` | 41x8 | `state=on` |
| `progress` | Progress ring |  | `75%` | 25x25 |  |
| `progressbar` | Progress bar |  | `60%` | 51x8 |  |
| `switch` | Switch | Switch (turn it on or off in the properties) | `Switch` | 41x8 | `state=on` |
| `slider` | Slider | set to the percentage in its label | `40%` | 51x8 |  |
| `password` | Password | Password field: hidden text and a show / hide eye | `••••••••` | 51x9 |  |
| `numberinput` | Number input | the number between − and + buttons | `1` | 36x9 |  |
| `segmented` | Segmented | Segmented control / button group: options in the label, separated by \|, the first chosen | `Day \| Week \| Month` | 61x9 |  |
| `search` | Search box |  | `Search…` | 51x9 |  |
| `textarea` | Text area | a box for several lines | `Write a message…` | 51x25 |  |
| `datepicker` | Date picker |  | `dd/mm/yyyy` | 51x9 |  |
| `timepicker` | Time picker |  | `hh:mm` | 51x9 |  |
| `colourpicker` | Colour picker | a swatch in the fill, the colour named in the label | `#1F6F78` | 51x9 |  |
| `upload` | File upload | File upload / drop zone | `Drop files here or browse` | 61x30 |  |
| `otp` | Code boxes | One-time code: a box per character, separated by \| in the label | `4 \| 7 \| 1 \| 9 \| 2 \| 6` | 61x11 |  |
| `togglechips` | Toggle chips | options in the label, separated by \|; start one with ✓ to turn it on | `✓ Wi-Fi \| ✓ Parking \| Pool` | 66x8 |  |
| `rangeslider` | Range slider | two handles, at the percentages in its label (20–70%) | `20–70%` | 51x8 |  |
| `formfield` | Form field | its name, what's typed and a message, separated by \| | `Email \| name@example.com \| Enter a valid email address` | 61x23 |  |
| `spinner` | Spinner | Spinner / loader |  | 13x13 |  |
| `skeleton` | Skeleton | Skeleton loader: grey blocks where content will be |  | 61x20 |  |
| `toast` | Toast | Toast notification: a message with a tick and a close cross | `Message sent` | 66x11 |  |
| `emptystate` | Empty state | a picture, the message and a button | `Nothing here yet` | 61x41 |  |
| `inlineerror` | Inline error | a message in the error colour with a mark before it | `Enter a valid email address` | 56x8 |  |
| `dropdownmenu` | Open dropdown | Open dropdown menu: the field, then the options, in the label separated by \|; the first option lit | `Sort by \| Newest \| Oldest \| Most popular` | 51x36 |  |
| `contextmenu` | Context menu | commands in the label, separated by \|; the first lit, a line above the last | `Cut \| Copy \| Paste \| Delete` | 41x30 |  |
| `menubar` | Menu bar | menus in the label, separated by \|, the first open | `File \| Edit \| View \| Help` | 81x8 |  |
| `tabbar` | Bottom tab bar | Bottom tab bar (mobile): tabs in the label, separated by \|, the first open | `Home \| Search \| Profile` | 76x17 |  |
| `fab` | Action button | Floating action button: a round + button |  | 15x15 |  |
| `backheader` | Back header | Back header (mobile): a back arrow, the title and a ⋮ menu | `Settings` | 76x13 |  |
| `divider` | Divider | a line across, broken for its label ("or") if it has one | `or` | 76x6 |  |
| `footer` | Footer | Page footer: its parts in the label, separated by \| | `© Acme \| Privacy \| Terms \| Contact` | 102x11 |  |
| `hero` | Hero section | a headline, a button and a picture | `A big headline\nWhy it matters` | 102x51 |  |
| `splitpane` | Split pane | two panes, named in the label separated by \|, with a grip between | `Files \| Preview` | 81x41 |  |
| `scrollbar` | Scroll bar | down when it is taller than wide, across when wider |  | 5x51 |  |
| `navbar` | Nav bar | Header / nav bar: brand and links in the label, separated by \| | `Brand \| Home \| About \| Contact` | 102x11 |  |
| `modal` | Modal dialog |  | `Delete this file?\nThis can't be undone.` | 76x46 |  |
| `card` | Card | a picture with text under it | `Card title\nA line about it` | 46x51 |  |
| `alert` | Alert banner |  | `Your changes have been saved.` | 81x11 |  |
| `tooltip` | Tooltip |  | `More about this` | 41x13 |  |
| `avatar` | Avatar | initials in a circle | `AB` | 15x15 |  |
| `badge` | Badge | Badge / chip / tag | `New` | 20x7 |  |
| `rating` | Star rating | from a score like 4/5 in its label | `4/5` | 41x8 |  |
| `glyph` | Icon | Icon placeholder |  | 10x10 |  |
| `tabs` | Tabs | name them in the label, separated by \| | `Home \| Profile \| Settings` | 76x10 |  |
| `breadcrumb` | Breadcrumb | the path's parts in the label, separated by \| | `Home \| Products \| Shoes` | 61x8 |  |
| `pagination` | Pagination | pages in the label, separated by \| | `‹ \| 1 \| 2 \| 3 \| ›` | 61x9 |  |
| `stepper` | Stepper | steps in the label, separated by \|, the first current | `Cart \| Details \| Payment \| Done` | 81x15 |  |
| `pills` | Filter pills | filters in the label, separated by \| | `All \| Open \| Closed` | 61x8 |  |
| `list` | List | items in the label, separated by \| | `First item \| Second item \| Third item` | 51x23 |  |
| `sidebar` | Sidebar menu | items in the label, separated by \|, the first current | `Dashboard \| Reports \| Settings` | 41x30 |  |
| `accordion` | Accordion | sections in the label, separated by \|, the first open | `Section one \| Section two \| Section three` | 61x27 |  |
| `image` | Image | Image (drop a picture file on the page, or choose one in the properties) |  | 41x30 |  |
| `video` | Video | Video player: a play button and a seek bar, the title along the top | `Video title` | 61x38 |  |
| `carousel` | Carousel | Image carousel: a picture with arrows either side and a dot per slide |  | 61x38 |  |
| `codeblock` | Code block | the code is its label, a gutter and a copy button | `let n = sum(items)\nprint(n)` | 61x25 |  |
| `chatbubble` | Chat bubble | a message beside its sender's avatar; [side=right] for one from me | `See you at 3pm!` | 61x13 | `side=right` |
| `commentthread` | Comment thread | comments in the label, separated by \|, then a reply box (the last part) | `Ana: Can we make this bigger? \| Ben: Done, have a look \| Reply…` | 66x27 |  |
| `bell` | Notification bell | the count in its label goes in the badge | `3` | 13x13 |  |
| `usermenu` | User menu | User menu, open: the user's name, then the menu, in the label separated by \|; the first item lit | `Ana Smith \| Profile \| Settings \| Sign out` | 51x41 |  |
| `mapview` | Map view | streets, a park, a river, a pin and zoom buttons; the search text in its label | `Search the map` | 76x56 |  |
| `satellite` | Satellite view | fields, roads and a river from above, a map tile to switch back; the search text in its label | `Search the map` | 76x56 |  |
| `streetview` | Street view | a road to the horizon between buildings, a mini map and a compass; the street name in its label | `High Street` | 76x51 |  |
| `mappin` | Map pin | a teardrop marker to drop on any map |  | 10x15 |  |
| `directions` | Directions | from, to and then the steps in the label, separated by \|; each step’s arrow turns the way it says | `From: Leeds \| To: York \| Turn left onto the A64 \| Turn right at the roundabout \| Continue for 20 miles` | 66x38 |  |
| `captcha` | Robot check | Robot check (CAPTCHA): a box to tick beside its label, [state=on] for ticked | `I’m not a robot` | 66x18 | `state=on` |
| `imagecaptcha` | Picture check | Picture check (CAPTCHA): the instruction in its label over a 3 by 3 grid of pictures, two picked | `Select all squares with traffic lights` | 61x74 |  |
| `textcaptcha` | Text check | Text check (CAPTCHA): a code under squiggles (its label), a refresh arrow and a box to type it in | `x7Kp2` | 56x30 |  |
| `grid` | Grid table | A table of cells: rows in `{ }` separated by `;`, cells by `,`; the first row is the header |  | 69x23 | cells in `{ }` |

## BI / dashboards (charts)

| Type | Palette name | What it is | Default label | Sample values | Size | Notes |
|---|---|---|---|---|---|---|
| `bar` | Bar chart |  | `Bar chart` | `{ 4, 7, 5, 9, 6 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `hbar` | Horizontal bars | Horizontal bar chart | `Bar chart` | `{ 4, 7, 5, 9, 6 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `stackedbar` | Stacked bars | Stacked bar chart: a row of values per series, stacked | `Stacked bars` | `{ 4, 7, 5, 9; 3, 5, 6, 4; 2, 3, 2, 5 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `stackedhbar` | Stacked h-bars | Horizontal stacked bar chart: a row of values per series, stacked | `Stacked bars` | `{ 4, 7, 5, 9; 3, 5, 6, 4; 2, 3, 2, 5 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `percentbar` | 100% bars | 100% stacked bar chart: each bar the whole, split by series | `100% bars` | `{ 4, 7, 5, 9; 3, 5, 6, 4; 2, 3, 2, 5 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `percenthbar` | 100% h-bars | Horizontal 100% stacked bar chart: each bar the whole, split by series | `100% bars` | `{ 4, 7, 5, 9; 3, 5, 6, 4; 2, 3, 2, 5 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `histogram` | Histogram | how many fall in each range, bars touching | `Histogram` | `{ 1, 3, 6, 9, 7, 4, 2 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `waterfall` | Waterfall | a start, then steps up and down, falls outlined | `Waterfall` | `{ 10, 4, -3, 5, -2 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `funnel` | Funnel | stages, each band as wide as its value | `Funnel` | `{ 100, 70, 45, 25 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `line` | Line chart |  | `Line chart` | `{ 3, 5, 4, 7, 6, 9 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `area` | Area chart |  | `Area chart` | `{ 3, 5, 4, 7, 6, 9 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `stackedarea` | Stacked areas | Stacked area chart: a row of values per series, each band on the last | `Stacked areas` | `{ 4, 7, 5, 9; 3, 5, 6, 4; 2, 3, 2, 5 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `percentarea` | 100% areas | 100% stacked area chart: the whole at every point, split by series | `100% areas` | `{ 4, 7, 5, 9; 3, 5, 6, 4; 2, 3, 2, 5 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `radar` | Radar chart | a spoke per value, joined by a line | `Radar chart` | `{ 8, 5, 7, 4, 9, 6 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `radararea` | Radar area | Radar area chart: a spoke per value, the shape between them filled | `Radar chart` | `{ 8, 5, 7, 4, 9, 6 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `polar` | Polar chart | Polar (rose) chart: equal wedges, each reaching out by its value | `Polar chart` | `{ 9, 6, 8, 4, 7, 5, 3, 6 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `spiral` | Spiral chart | a long series wound outwards, twelve values a turn | `Spiral chart` | `{ 3, 4, 6, 8, 9, 10, 9, 8, 6, 5, 4, 3, 4, 5, 7, 9, 10, 10, 9, 7, 6, 5, 4, 4 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `pie` | Pie chart |  | `Pie chart` | `{ 40, 25, 20, 15 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `donut` | Donut chart |  | `Donut chart` | `{ 40, 25, 20, 15 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `scatter` | Scatter chart | x and y for each dot | `Scatter chart` | `{ 1, 2; 2, 4; 3, 3; 4, 6; 5, 5; 6, 8; 7, 7 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `bubble` | Bubble chart | x, y and size for each bubble | `Bubble chart` | `{ 2, 3, 4; 4, 7, 9; 6, 4, 2; 8, 8, 6 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `candlestick` | Candlestick | Candlestick chart: open, high, low and close for each candle; rises filled, falls outlined | `Candlestick chart` | `{ 5, 8, 4, 7; 7, 9, 6, 8; 8, 9, 5, 6; 6, 7, 3, 4; 4, 8, 4, 7 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `boxplot` | Box plot | min, lower quartile, median, upper quartile and max for each box | `Box plot` | `{ 2, 4, 5, 7, 9; 4, 6, 8, 9, 11; 1, 2, 4, 5, 8 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `heatmap` | Heatmap | a row of values per row of cells, each shaded by its value | `Heatmap` | `{ 1, 3, 5, 8, 6, 2; 2, 5, 8, 9, 7, 3; 1, 4, 6, 7, 4, 2; 0, 1, 3, 4, 2, 1 }` | 51x38 | chart: values in `{ }`, `colours=` |
| `gantt` | Gantt chart | a start and a length for each task, one bar per task down the chart | `Project plan` | `{ 0, 3; 2, 4; 5, 3; 7, 2 }` | 61x38 | chart: values in `{ }`, `colours=` |
| `treemap` | Treemap | a tile per value, as big as its share; name the tiles in the label, separated by \| | `Rent \| Food \| Travel \| Fun \| Other` | `{ 40, 25, 15, 12, 8 }` | 61x41 | chart: values in `{ }`, `colours=` |
| `wordcloud` | Word cloud | words in the label separated by \|, sized by their values | `Fast \| Simple \| Friendly \| Cheap \| Secure \| Reliable \| Modern \| Quiet` | `{ 10, 7, 6, 5, 4, 3, 3, 2 }` | 66x36 | chart: values in `{ }`, `colours=` |
| `sankey` | Sankey | name the nodes in the label; each flow is from, to (their places, from 1) and amount | `Visits \| Signed up \| Left \| Paid \| Free` | `{ 1, 2, 60; 1, 3, 40; 2, 4, 25; 2, 5, 35 }` | 76x41 | chart: values in `{ }`, `colours=` |
| `chord` | Chord diagram | a row of values per group, what it sends to each group; name the groups in the label | `UK \| France \| Spain \| Italy` | `{ 0, 5, 3, 2; 4, 0, 6, 1; 2, 3, 0, 4; 1, 2, 3, 0 }` | 56x56 | chart: values in `{ }`, `colours=` |
| `tilemap` | Tile map | Tile map (choropleth): a tile per region named in the label, shaded by its value | `North \| Midlands \| East \| Wales \| South \| London \| West \| Scotland \| Ireland` | `{ 8, 5, 3, 9, 6, 2, 4, 7, 1 }` | 56x56 | chart: values in `{ }` |
| `worldmap` | World map | World map (choropleth): the countries named in the label, separated by \|, shaded by their values | `USA \| Brazil \| France \| India \| China \| Australia` | `{ 9, 6, 4, 7, 8, 3 }` | 81x36 | chart: values in `{ }` |
| `countrymap` | Country map | Country map (choropleth): a country's regions (the UK's, or France's with map=france); name them in the label, separated by \|, shaded by their values | `East Midlands \| East of England \| London \| North East \| North West \| Northern Ireland \| Scotland \| South East \| South West \| Wales \| West Midlands \| Yorkshire` | `{ 3, 6, 5, 4, 5, 6, 9, 8, 5, 3, 4, 2 }` | 38x66 | chart: values in `{ }` |
| `routemap` | Route map | an area's parts with its motorways (blue) and main A roads (green) over them (Yorkshire, as the example); name the parts in the label, separated by \|, shaded by their values | `East Yorkshire \| North Yorkshire \| South Yorkshire \| West Yorkshire` | `{ 4, 9, 6, 7 }` | 66x51 | chart: values in `{ }` |
| `sparkline` | Sparkline | a small trend line with no frame, for cards and tables | `Trend` | `{ 4, 6, 5, 8, 7, 9, 8, 11 }` | 41x10 | chart: values in `{ }` |
| `bullet` | Bullet chart | a value against a target | `Sales vs target` | `{ 60, 80 }` | 51x10 | chart: values in `{ }` |
| `dial` | Gauge | a half dial filled to the percentage in its label | `72%` |  | 36x20 |  |
| `kpi` | KPI card | a figure with a caption | `£12.4k\nRevenue` |  | 41x23 |  |
| `legend` | Legend | the series' names in the label, separated by \|, each with its colour | `Series 1 \| Series 2 \| Series 3` |  | 30x19 | `colours=` |
| `legendrow` | Legend row | Legend in a row, for under a chart: the series' names separated by \| | `Series 1 \| Series 2 \| Series 3` |  | 84x8 | `colours=` |

## Planning

| Type | Palette name | What it is | Default label | Size | Notes |
|---|---|---|---|---|---|
| `centraltopic` | Central topic | Mind map central topic: connect topics to it and they spread out to both sides | `Big idea` | 46x18 |  |
| `topic` | Topic | Mind map topic: a branch off the central topic or another topic | `Topic` | 36x11 |  |
| `sticky` | Sticky note | a yellow note with a folded corner | `Remember this` | 41x36 |  |
| `callout` | Callout | a speech bubble with a pointer at its bottom left | `A note about this` | 51x23 |  |
| `milestone` | Milestone | a filled diamond with its name under it, for timelines and roadmaps | `Launch` | 9x9 | fixed size |
| `timeline` | Timeline | a line with a dot per part of the label, separated by \| | `Q1 \| Q2 \| Q3 \| Q4` | 102x15 |  |
| `phases` | Phases | a chevron per stage of a roadmap, named in the label, separated by \| | `Discover \| Design \| Build \| Launch` | 112x13 |  |
| `mood` | Mood | Mood face for journey maps: happy, sad, mad, angry or laughing, from its face setting | `Happy` | 25x19 | fixed size |
| `personcard` | Person card | Person card for org charts: a picture, the name and role in its label | `Ana Silva\nHead of design` | 56x18 |  |

## UML

| Type | Palette name | What it is | Default label | Size | Notes |
|---|---|---|---|---|---|
| `umlclass` | Class | UML class: name \| attributes \| operations, one compartment per part of the label | `User \| id: int\nname: text \| login()\nlogout()` | 46x38 |  |
| `state` | State | UML state: a box with rounded corners | `Waiting` | 36x15 |  |
| `initial` | Initial state | UML initial state: a filled dot where the machine starts |  | 8x8 | fixed size |
| `final` | Final state | UML final state: a ring round a filled dot |  | 9x9 | fixed size |
| `lifeline` | Lifeline | Sequence diagram lifeline: the participant in a box over a dashed line | `Server` | 30x76 |  |
| `activation` | Activation | Sequence diagram activation bar: put it over a lifeline while it is busy |  | 4x25 | fixed size |

## BPMN

| Type | Palette name | What it is | Default label | Size | Notes |
|---|---|---|---|---|---|
| `startevent` | Start event | BPMN start event: a thin circle, its name under it |  | 11x11 | fixed size |
| `endevent` | End event | BPMN end event: a thick circle, its name under it |  | 11x11 | fixed size |
| `timerevent` | Timer event | BPMN timer event: a clock in a double circle |  | 11x11 | fixed size |
| `messageevent` | Message event | BPMN message event: an envelope in a double circle |  | 11x11 | fixed size |
| `intermediateevent` | Intermediate event | BPMN intermediate event: a double circle; put one on a task's edge for a boundary event |  | 11x11 | fixed size |
| `gateway` | Gateway | BPMN exclusive gateway: a diamond with an X; one way out is taken |  | 15x15 | fixed size |
| `parallelgateway` | Parallel gateway | BPMN parallel gateway: a diamond with a +; every way out is taken |  | 15x15 | fixed size |
| `inclusivegateway` | Inclusive gateway | BPMN inclusive gateway: a diamond with a ring; one or more ways out are taken |  | 15x15 | fixed size |
| `eventgateway` | Event gateway | BPMN event-based gateway: the way out is whichever event happens first |  | 15x15 | fixed size |
| `task` | Task | BPMN task: a box with rounded corners | `Task` | 38x20 |  |
| `usertask` | User task | BPMN user task: done by a person, with a person in its corner | `Review order` | 38x20 |  |
| `servicetask` | Service task | BPMN service task: done by a system, with a cog in its corner | `Send email` | 38x20 |  |
| `bpmnsubprocess` | Subprocess | BPMN collapsed subprocess: a task with a + at its foot, standing for a whole flow | `Handle refund` | 38x20 |  |
| `dataobject` | Data object | BPMN data object: a page with a folded corner, its name under it |  | 11x15 | fixed size |
