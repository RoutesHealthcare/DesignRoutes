import {test, expect} from './fixtures.js';

/* Opens a .flow document given as text */
const openFlow = (app, text) => app.open({name: 'containers.flow', mimeType: 'text/plain', buffer: Buffer.from(text)});

/* Clicks a palette button, opening its (collapsed) group first */
async function addFromPalette(page, kind) {
    const b = page.locator(`.palette [data-kind="${kind}"]`);
    if (!await b.isVisible()) await b.locator('xpath=ancestor::details[1]/summary').click();
    await b.click();
}

/* A shape's drawn box on screen. Not boundingBox(), which counts the wide see-through outline every shape has for
   easier clicking. */
const box = l => l.evaluate(e => {
    const r = e.getBoundingClientRect();
    return {x: r.x, y: r.y, width: r.width, height: r.height};
});
const holds = (outer, inner) => inner.x >= outer.x - 0.5 && inner.y >= outer.y - 0.5 && inner.x + inner.width <= outer.x + outer.width + 0.5 && inner.y + inner.height <= outer.y + outer.height + 0.5;
/* The line in the text for shape id */
const lineOf = (text, id) => text.split('\n').find(l => l.startsWith(id + ':'));

const TEAM = 'flow 1\npage "P"\nboard: container "Team"\na: process "Plan" [in=board]\nb: process "Build" [in=board]\nc: process "Ship"\na -> b\nb -> c\n';

test('a container from the text is drawn round its members, beneath them', async ({app, page}) => {
    await openFlow(app, TEAM);
    const frame = await box(app.shape('Team')), plan = await box(app.shape('Plan')),
        build = await box(app.shape('Build')), ship = await box(app.shape('Ship'));
    expect(holds(frame, plan)).toBe(true);
    expect(holds(frame, build)).toBe(true);
    expect(holds(frame, ship)).toBe(false);
    // the frame is painted first, so its members are on top of it
    const order = await app.shapes.evaluateAll(gs => gs.map(g => g.dataset.kind));
    expect(order.indexOf('container')).toBeLessThan(order.indexOf('process'));
    await addFromPalette(page, 'process');   // an unrelated edit leaves the typed lines alone
    const text = await app.flowText();
    expect(text).toContain('a: process "Plan" [in=board]');
    expect(text).toContain('board: container "Team"\n');
});

test('dragging a shape onto a container puts it inside, and dragging it out takes it out', async ({app, page}) => {
    await openFlow(app, TEAM);
    const frame = await box(app.shape('Team')), ship = await app.centreOf(app.shape('Ship'));
    await app.drag(ship, {x: frame.x + frame.width - 30, y: frame.y + frame.height - 20});
    let text = await app.flowText();
    expect(lineOf(text, 'c')).toMatch(/\[in=board\]$/);
    // the container and its other members are placed with it, so the next layout keeps them together
    expect(lineOf(text, 'board')).toMatch(/@ [\d.]+,[\d.]+ [\d.]+x[\d.]+$/);
    expect(lineOf(text, 'a')).toMatch(/@ [\d.]+,[\d.]+ \[in=board\]$/);
    expect(holds(await box(app.shape('Team')), await box(app.shape('Ship')))).toBe(true);   // it grew to fit
    await app.drag(await app.centreOf(app.shape('Ship')), {
        x: frame.x + frame.width + 200,
        y: frame.y + frame.height + 150
    });
    text = await app.flowText();
    expect(lineOf(text, 'c')).not.toContain('[in=');
    expect(lineOf(text, 'a')).toContain('[in=board]');
});

test('moving a container moves its members and keeps their connections', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "P"\nboard: container "Team" @ 20,20 120x70\na: process "Plan" @ 30,40 [in=board]\nb: process "Build" @ 90,40 [in=board]\nc: process "Ship" @ 200,40\na -> b : "next"\nb -> c\n');
    const before = {
        plan: await box(app.shape('Plan')),
        ship: await box(app.shape('Ship')),
        line: (await app.connectionLines())
    };
    const head = await box(app.shape('Team'));
    await app.drag({x: head.x + head.width / 2, y: head.y + 6}, {x: head.x + head.width / 2 + 60, y: head.y + 66});
    const plan = await box(app.shape('Plan')), ship = await box(app.shape('Ship'));
    expect(plan.x - before.plan.x).toBeGreaterThan(40);
    expect(plan.y - before.plan.y).toBeGreaterThan(40);
    expect(ship).toEqual(before.ship);   // not a member, so it stays
    // the line between two members moved with them, unchanged in shape
    const lines = await app.connectionLines(), was = before.line[0], now = lines[0], dx = now[0][0] - was[0][0],
        dy = now[0][1] - was[0][1];
    expect(now.length).toBe(was.length);
    for (const [i, p] of now.entries()) {
        expect(p[0] - was[i][0]).toBeCloseTo(dx, 1);
        expect(p[1] - was[i][1]).toBeCloseTo(dy, 1);
    }
    const text = await app.flowText();
    expect(lineOf(text, 'board')).toMatch(/^board: container "Team" @ (?!20,20)/);
    expect(lineOf(text, 'a')).toMatch(/\[in=board\]$/);
    expect(lineOf(text, 'c')).toBe('c: process "Ship" @ 200,40');
});

test('a table and a grid can be inside a container and stay there after other edits', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "P"\ndb: container "Database"\nt: table "users" { id; name } [in=db]\ng: grid { A, B; 1, 2 } [in=db]\n');
    const frame = await box(app.shape('Database'));
    expect(holds(frame, await box(app.shape('users').first()))).toBe(true);
    await addFromPalette(page, 'process');
    const text = await app.flowText();
    expect(text).toContain('t: table "users" { id; name } [in=db]');
    expect(text).toContain('g: grid { A, B; 1, 2 } [in=db]');
});

test('swimlanes: a pool stacks its lanes, and comes from the palette with two', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "P"\np: pool "Orders"\nl1: lane "Customer" [in=p]\nl2: swimlane "Shop" [in=p]\na: process "Order" [in=l1]\nb: process "Pack" [in=l2]\na -> b\n');
    const pool = await box(app.shape('Orders')), l1 = await box(app.shape('Customer')),
        l2 = await box(app.shape('Shop'));
    expect(holds(pool, l1) && holds(pool, l2)).toBe(true);
    expect(l1.x).toBeCloseTo(l2.x, 0);
    expect(l1.width).toBeCloseTo(l2.width, 0);
    expect(l2.y).toBeCloseTo(l1.y + l1.height, 0);   // stacked, one under the other
    expect(holds(l1, await box(app.shape('Order')))).toBe(true);
    expect(holds(l2, await box(app.shape('Pack')))).toBe(true);
    // the lane's label reads upwards down its header
    await expect(app.shape('Customer').locator('g[transform^="rotate(-90"] tspan')).toHaveCount(1);

    await page.click('#btnNew');   // nothing has changed, so it doesn't ask
    await addFromPalette(page, 'pool');
    const text = await app.flowText();
    expect(text).toMatch(/^pool: pool "Pool" @ [\d.]+,[\d.]+ [\d.]+x[\d.]+$/m);
    expect(text).toMatch(/: lane "Lane 1" @ .*\[in=pool\]$/m);
    expect(text).toMatch(/: lane "Lane 2" @ .*\[in=pool\]$/m);
});

test('a shape added from the palette over a container goes inside it', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "P" size 297x210\nboard: container "Team" @ 10,10 270x180\n');
    await addFromPalette(page, 'process');   // added in the middle of the view, which the frame covers
    expect(lineOf(await app.flowText(), 'process')).toMatch(/\[in=board\]$/);
});

test('arrow keys move a container\'s members once, even when they are selected too', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "P"\nboard: container "Team" @ 20,20 120x70\na: process "Plan" @ 30,40 [in=board]\n');
    await app.click('Plan');
    await page.keyboard.press('Control+a');
    await page.keyboard.press('ArrowRight');
    const text = await app.flowText();
    expect(lineOf(text, 'a')).toBe('a: process "Plan" @ 31,40 [in=board]');
    expect(lineOf(text, 'board')).toBe('board: container "Team" @ 21,20 120x70');
});

test('a lane\'s label can be edited on the page', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "P"\np: pool "Orders"\nl1: lane "Customer" [in=p]\n');
    await app.click('Customer');
    await app.click('Customer');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('Buyer');
    await page.keyboard.press('Control+Enter');
    await expect(app.shape('Buyer')).toHaveCount(1);
    expect(lineOf(await app.flowText(), 'l1')).toMatch(/^l1: lane "Buyer"/);
});

test('in= must name a container on the page', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "P"\nx: process "X"\na: process "A" [in=x]\nb: process "B" [in=nowhere]\nc: container "C" [in=c]\n');
    await page.keyboard.press('Control+e');
    await expect(page.locator('#tpStatus')).toContainText('Line 4: "x" is a process, not a container');
    await expect(page.locator('#tpStatus')).toContainText('and 2 more problems');
    await page.keyboard.press('Control+e');
    await expect(app.shape('A')).toHaveCount(1);   // still drawn, just not inside anything
});

/* ---------- flexi containers: [flow=row|column] ---------- */
const BOARD = 'flow 1\npage "P"\ntodo: container "To do" [flow=column gap=4]\nc1: process "Login" [in=todo]\nc2: process "Sign up" [in=todo]\nc3: process "Reset password" [in=todo]\n';

test('a column flexi container stacks its members in text order, stretched to its width', async ({app, page}) => {
    await openFlow(app, BOARD);
    const col = await box(app.shape('To do')), a = await box(app.shape('Login')), b = await box(app.shape('Sign up')),
        c = await box(app.shape('Reset password'));
    expect(holds(col, a) && holds(col, b) && holds(col, c)).toBe(true);
    expect(a.y).toBeLessThan(b.y);
    expect(b.y).toBeLessThan(c.y);
    expect(a.x).toBeCloseTo(b.x, 0);
    expect(a.width).toBeCloseTo(c.width, 0);   // stretched: all as wide
    expect(b.y - (a.y + a.height)).toBeCloseTo(c.y - (b.y + b.height), 0);             // the same gap
    await addFromPalette(page, 'text');   // an unrelated edit leaves the lines alone, with no positions added
    const text = await app.flowText();
    expect(text).toContain('c1: process "Login" [in=todo]\nc2: process "Sign up" [in=todo]\nc3: process "Reset password" [in=todo]\n');
});

test('a row flexi container lines its members up side by side, and align=center centres them', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "P"\nbar: container "Buttons" [flow=row gap=6 align=center]\nok: button "OK" [in=bar]\nhelp: process "Help" 30x25 [in=bar]\n');
    const ok = await box(app.shape('OK')), h = await box(app.shape('Help'));
    expect(h.height).toBeGreaterThan(ok.height * 1.5);   // centred, not stretched
    expect(ok.x + ok.width).toBeLessThan(h.x);
    expect(ok.y + ok.height / 2).toBeCloseTo(h.y + h.height / 2, 0);
});

test('dragging a member to a new spot reorders the lines', async ({app, page}) => {
    await openFlow(app, BOARD + '# the end\n');
    const a = await box(app.shape('Login')), c = await box(app.shape('Reset password'));
    await app.drag(await app.centreOf(app.shape('Login')), {x: a.x + a.width / 2, y: c.y + c.height - 2});
    const text = await app.flowText();
    expect(text).toContain('c2: process "Sign up" [in=todo]\nc3: process "Reset password" [in=todo]\nc1: process "Login" [in=todo]\n# the end');
    const a2 = await box(app.shape('Login')), c2 = await box(app.shape('Reset password'));
    expect(a2.y).toBeGreaterThan(c2.y);
});

test('a shape dropped into a flexi container joins its lines, with no position', async ({app, page}) => {
    await openFlow(app, BOARD + 'other: process "Ship" @ 150,20\n');
    const a = await box(app.shape('Login')), b = await box(app.shape('Sign up'));
    await app.drag(await app.centreOf(app.shape('Ship')), {x: a.x + a.width / 2, y: (a.y + a.height + b.y) / 2});
    const text = await app.flowText();
    expect(text).toContain('c1: process "Login" [in=todo]\nother: process "Ship" [in=todo]\nc2: process "Sign up" [in=todo]\n');
    // and dragged back out, it gets a position again
    await app.drag(await app.centreOf(app.shape('Ship')), {x: a.x + a.width + 250, y: a.y});
    expect((await app.flowText()).split('\n').find(l => l.startsWith('other:'))).toMatch(/^other: process "Ship" @ [\d.]+,[\d.]+$/);
});

test('kanban: a row of columns, each stretched to the tallest', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "P"\nboard: container "Board" [flow=row]\nt: container "To do" [flow=column in=board]\nd: container "Done" [flow=column in=board]\nx1: process "One" [in=t]\nx2: process "Two" [in=t]\nx3: process "Three" [in=t]\ny1: process "Four" [in=d]\n');
    const t = await box(app.shape('To do')), d = await box(app.shape('Done')), board = await box(app.shape('Board'));
    expect(holds(board, t) && holds(board, d)).toBe(true);
    expect(t.x + t.width).toBeLessThan(d.x);
    expect(t.height).toBeCloseTo(d.height, 0);
});

test('a member keeps a size of its own, written with no position', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "P"\ntodo: container "To do" [flow=column]\nc1: process "Login" 40x30 [in=todo]\nc2: process "Sign up" @ 5,5 50x12 [in=todo]\n');
    const a = await box(app.shape('Login')), b = await box(app.shape('Sign up'));
    expect(a.width / a.height).toBeCloseTo(40 / 30, 1);
    expect(b.width / b.height).toBeCloseTo(50 / 12, 1);
    await addFromPalette(page, 'text');
    const text = await app.flowText();
    expect(text).toContain('c1: process "Login" 40x30 [in=todo]');
    expect(text).toContain('c2: process "Sign up" @ 5,5 50x12 [in=todo]');   // left as typed: the position is ignored
});

test('flow settings are checked', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "P"\nok: process "Fine"\na: process "A" [flow=row]\nb: container "B" [gap=4]\nc: container "C" [flow=diagonal]\n');
    await page.keyboard.press('Control+e');
    await expect(page.locator('#tpStatus')).toContainText('Line 4: Only containers, pools and lanes have flow, gap and align.');
    await expect(page.locator('#tpStatus')).toContainText('and 2 more problems');
});

/* ---------- scroll areas ---------- */
test('a scroll area keeps its size, cuts off what does not fit, and its thumb shows how much does', async ({
                                                                                                               app,
                                                                                                               page
                                                                                                           }) => {
    const items = Array.from({length: 8}, (_, i) => `i${i}: process "Item ${i}" [in=list]`).join('\n');
    await openFlow(app, `flow 1\npage "P"\nlist: scroll "Results" [flow=column]\n${items}\nfew: scroll "Short" [flow=column]\nf1: process "Only one" [in=few]\n`);
    const area = await box(app.shape('Results'));
    expect(area.height).toBeLessThan(250);   // its default size, not grown round eight items
    await expect(app.shape('Item 7')).toHaveAttribute('clip-path', /url\(#clip-/);
    // the last item reaches past the bottom, so the part drawn is cut off at the area's edge
    const last = await box(app.shape('Item 7'));
    expect(last.y + last.height).toBeGreaterThan(area.y + area.height);
    const visible = await page.evaluate(() => {
        const g = [...document.querySelectorAll('#layer > [data-id]')].find(g => g.textContent.includes('Item 0'));
        return !!document.elementsFromPoint(...(r => [r.x + r.width / 2, r.y + r.height / 2])(g.getBoundingClientRect())).find(e => g.contains(e));
    });
    expect(visible).toBe(true);
    // the thumb (the filled part of the bar) is shorter when more is hidden
    const thumb = async t => app.shape(t).locator('path[data-sec="3"][stroke="none"]').evaluate(p => p.getBoundingClientRect().height);
    expect(await thumb('Results')).toBeLessThan(await thumb('Short'));
    await addFromPalette(page, 'text');   // an unrelated edit: no sizes written down
    expect(await app.flowText()).toContain('list: scroll "Results" [flow=column]\n');
});

test('a scroll area can be scrolled from the text or the Scrolled box, and its contents and thumb move with it', async ({
                                                                                                                            app,
                                                                                                                            page
                                                                                                                        }) => {
    const items = Array.from({length: 8}, (_, i) => `i${i}: process "Item ${i}" [in=list]`).join('\n');
    const doc = s => `flow 1\npage "P"\nlist: scroll "Results" @ 20,20 80x70 [flow=column${s}]\n${items}\n`;
    const thumbTop = () => app.shape('Results').locator('path[data-sec="3"][stroke="none"]').evaluate(p => p.getBoundingClientRect().y);
    await openFlow(app, doc(''));
    const area = await box(app.shape('Results')), first = await box(app.shape('Item 0')), top = await thumbTop();
    await openFlow(app, doc(' scroll=30'));
    const moved = await box(app.shape('Item 0'));
    expect(first.y - moved.y).toBeGreaterThan(area.height * 0.3);   // 30 mm of a 70 mm area
    expect(await thumbTop()).toBeGreaterThan(top + 1);
    await addFromPalette(page, 'text');   // an unrelated edit keeps the setting as typed
    expect(lineOf(await app.flowText(), 'list')).toBe('list: scroll "Results" @ 20,20 80x70 [flow=column scroll=30]');
    // far past the end: kept as typed, but the last item stops at the bottom
    await openFlow(app, doc(' scroll=5000'));
    const end = await box(app.shape('Results')), last = await box(app.shape('Item 7'));
    expect(last.y + last.height).toBeLessThan(end.y + end.height);
    expect(last.y + last.height).toBeGreaterThan(end.y + end.height * 0.85);   // just its padding under it
    // the Scrolled box, on a selected scroll area (picked up by its header)
    await openFlow(app, doc(''));
    await page.mouse.click(area.x + 15, area.y + 4);
    await expect(page.locator('#scrollWrap')).toBeVisible();
    await expect(page.locator('#pScroll')).toHaveValue('0');
    await page.fill('#pScroll', '25');
    await page.locator('#pScroll').press('Enter');
    expect(lineOf(await app.flowText(), 'list')).toBe('list: scroll "Results" @ 20,20 80x70 [flow=column scroll=25]');
    expect((await box(app.shape('Item 0'))).y).toBeLessThan(first.y - 10);
    await page.fill('#pScroll', '0');
    await page.locator('#pScroll').press('Enter');
    expect(lineOf(await app.flowText(), 'list')).toBe('list: scroll "Results" @ 20,20 80x70 [flow=column]');
    await openFlow(app, 'flow 1\npage "P"\na: process "A"\nc: container "Box" [scroll=10]\n');
    await expect(page.locator('#tpStatus')).toContainText('Only scroll areas have a scroll');
});

test('a placed shape in a scrolled area is drawn moved back but keeps its place in the text', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "P"\nlist: scroll "Area" @ 20,20 80x60 [scroll=20]\na: process "Top" @ 30,40 [in=list]\nb: process "Far" @ 30,120 [in=list]\n');
    await addFromPalette(page, 'text');   // an unrelated edit: the members are drawn 20 mm up, but written where typed
    const text = await app.flowText();
    expect(lineOf(text, 'a')).toBe('a: process "Top" @ 30,40 [in=list]');
    expect(lineOf(text, 'b')).toBe('b: process "Far" @ 30,120 [in=list]');
    // dragged within it, it stays where it was dropped on the page, with the scroll added back in the text
    const at = await box(app.shape('Top'));
    const c = await app.centreOf(app.shape('Top'));
    await page.keyboard.down('Alt');   // no grid snap, so it moves only across
    await app.drag(c, {x: c.x + 30, y: c.y});
    await page.keyboard.up('Alt');
    const after = await box(app.shape('Top'));
    expect(Math.abs(after.y - at.y)).toBeLessThan(1);
    expect(after.x).toBeGreaterThan(at.x + 20);
    expect(lineOf(await app.flowText(), 'a')).toMatch(/^a: process "Top" @ \d+(\.\d)?,40 \[in=list\]$/);
});

test('a container is white behind its members unless bg=off, or the colour bgfill gives it', async ({app, page}) => {
    await openFlow(app, [
        'flow 1', 'page "Bg"',
        'box: container "Default" @ 10,10 70x46',
        'inside: process "Inside" @ 20,25 40x16 [in=box]',
        'off: container "See-through" @ 90,10 70x46 [bg=off]',
        'tinted: container "Tinted" @ 170,10 70x46 [bgfill=#FFF4D6]',
        'orders: pool "Pool" @ 10,70 150x60',
        'cust: lane "Lane" [in=orders]',
        'sys: c4boundary "Shop" @ 170,70 80x50',
        'list: scroll "List" @ 10,140 70x50',
        ''].join('\n'));
    const backdrop = t => app.shape(t).locator('path[data-bg]');
    for (const t of ['Default', 'Pool', 'Lane', 'Shop', 'List']) await expect(backdrop(t)).toHaveAttribute('fill', '#FFFFFF');
    await expect(backdrop('See-through')).toHaveCount(0);
    await expect(backdrop('Tinted')).toHaveAttribute('fill', '#FFF4D6');
    await expect(backdrop('Shop')).toHaveAttribute('stroke', 'none');   // a boundary keeps its dashes, not a solid line
    await expect(app.shape('Shop').locator('path[fill="none"]')).not.toHaveCount(0);
    const text = await app.flowText();
    expect(text).toContain('off: container "See-through" @ 90,10 70x46 [bg=off]');
    expect(text).toContain('tinted: container "Tinted" @ 170,10 70x46 [bgfill=#FFF4D6]');
    const label = await app.centreOf(app.shape('Default').locator('tspan', {hasText: 'Default'}));
    await page.mouse.click(label.x, label.y);                          // its header: Inside fills the middle
    await expect(page.locator('#bgWrap')).toBeVisible();               // switched off and on from the properties too
    await page.locator('#pBg').uncheck();
    await expect(backdrop('Default')).toHaveCount(0);
    expect(await app.flowText()).toContain('box: container "Default" @ 10,10 70x46 [bg=off]');
});
