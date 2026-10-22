import {test, expect} from './fixtures.js';

/* Stage G of ShapesPlan.md: planning, UML, BPMN, C4 and network shapes */

/* Opens a .flow document given as text */
const openFlow = (app, text) => app.open({name: 'planning.flow', mimeType: 'text/plain', buffer: Buffer.from(text)});

/* Clicks a palette button, opening its (collapsed) group first */
async function addFromPalette(page, kind) {
    const b = page.locator(`.palette [data-kind="${kind}"]`);
    if (!await b.isVisible()) await b.locator('xpath=ancestor::details[1]/summary').click();
    await b.click();
}

/* Where a shape's text sits in it: its middle as fractions of the shape's box, y down. shape is the #layer group
   (the drawn box); its text is in the sibling #labels group sharing its data-id. */
const textAt = shape => shape.evaluate(g => {
    const lg = document.querySelector(`#labels > [data-id="${CSS.escape(g.getAttribute('data-id'))}"]`);
    const t = lg.querySelector('text').getBoundingClientRect(), b = g.querySelector('path').getBoundingClientRect();
    return {x: (t.left + t.width / 2 - b.left) / b.width, y: (t.top + t.height / 2 - b.top) / b.height};
});

test('planning: a sticky note, a callout, a milestone with its name under it and a person card', async ({
                                                                                                            app,
                                                                                                            page
                                                                                                        }) => {
    await openFlow(app, 'flow 1\npage "Plan"\ns1: postit "Call Sam" @ 10,10\nc1: speechbubble "Why?" @ 70,10\n' +
        'm1: milestone "Launch" @ 140,20\np1: orgcard "Ana Silva\\nHead of design" @ 10,70\n');
    for (const t of ['Call Sam', 'Why?', 'Launch']) await expect(app.shape(t)).toHaveCount(1);
    await expect(app.shape('Call Sam').locator('path[fill="#FFE38A"]')).toHaveCount(1);   // sticky yellow
    expect((await textAt(app.shape('Launch'))).y).toBeGreaterThan(1);                      // under the diamond
    const card = app.shape('Head of design');
    await expect(card).toHaveCount(1);
    expect((await textAt(card)).x).toBeGreaterThan(0.4);                               // beside the picture
    const kinds = ['sticky', 'callout', 'milestone', 'personcard'];
    for (const k of kinds) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of kinds) expect(text).toMatch(new RegExp(`: ${k} "`));
    expect(text).toContain('s1: postit "Call Sam" @ 10,10');                             // aliases left as typed
    expect(text).toContain('m1: milestone "Launch" @ 140,20');
});

test('UML: a class box has a line between each compartment, states join up, a lifeline has its name in its head', async ({
                                                                                                                             app,
                                                                                                                             page
                                                                                                                         }) => {
    await openFlow(app, 'flow 1\npage "UML"\nc1: class "Order | id: int | total()" @ 10,10\nc2: umlclass "Customer | name" @ 70,10\n' +
        's0: initial @ 130,15\ns1: state "Waiting" @ 150,10\ns2: endstate "Done" @ 200,15\nl1: participant "Server" @ 10,70\n' +
        'a1: activation @ 23,90\ns0 -> s1\ns1 -> s2\n');
    const lines = t => app.shape(t).locator('path[data-sec="1"][fill="none"]').getAttribute('d');
    expect((await lines('Order')).match(/M/g)).toHaveLength(2);       // three compartments, two lines
    expect((await lines('Customer')).match(/M/g)).toHaveLength(1);
    await expect(app.shape('Waiting')).toHaveCount(1);
    expect((await textAt(app.shape('Done'))).y).toBeGreaterThan(1);   // the final state's name is under it
    expect((await textAt(app.shape('Server'))).y).toBeLessThan(0.2);  // in the head box at the top
    expect(await app.connectionLines()).toHaveLength(2);
    const kinds = ['umlclass', 'state', 'initial', 'final', 'lifeline', 'activation'];
    for (const k of kinds) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of kinds) expect(text).toMatch(new RegExp(`: ${k}\\b`));
    expect(text).toContain('c1: class "Order | id: int | total()" @ 10,10');
    expect(text).toContain('s2: endstate "Done" @ 200,15');
});

const SEQUENCE = 'flow 1\npage "Seq"\nclient: lifeline "Client"\nserver: lifeline "Server"\ndb: participant "Database"\n' +
    'client -> server : "GET"\nserver -> db : "query"\ndb ..> server : "rows"\nserver ..> client : "200"';

/* Every connection's line as a list of [x,y] points in screen pixels, like boundingBox, in the order of their lines in
   the text (the order they're built in, not drawn in) */
const screenLines = page => page.locator('#layer > [data-id] > path[fill="none"][stroke="transparent"]').evaluateAll(ps => ps
    .sort((p, q) => p.parentNode.dataset.id - q.parentNode.dataset.id).map(p => {
        const m = p.getScreenCTM();
        return [...p.getAttribute('d').matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map(([, x, y]) =>
            [+x * m.a + +y * m.c + m.e, +x * m.b + +y * m.d + m.f]);
    }));
/* A shape's outline's box in screen pixels, without the wider transparent edge that makes it easy to pick */
const outlineBox = shape => shape.locator('path[data-sec]').first().boundingBox();

/* A sequence's lifelines' boxes and its messages' lines, in screen pixels: [[x, y], [x, y]] per message */
async function sequenceOf(app) {
    const box = t => outlineBox(app.shape(t));
    return {
        boxes: {client: await box('Client'), server: await box('Server'), db: await box('Database')},
        lines: await screenLines(app.page)
    };
}

test('UML sequence: lifelines side by side in text order, each message a level arrow under the last, line to line', async ({
                                                                                                                               app,
                                                                                                                               page
                                                                                                                           }) => {
    await openFlow(app, SEQUENCE);
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const {boxes: {client, server, db}, lines} = await sequenceOf(app);
    expect(server.y).toBeCloseTo(client.y, 0);                                  // tops level
    expect(db.y).toBeCloseTo(client.y, 0);
    expect(server.x).toBeGreaterThan(client.x + client.width);                  // side by side, in text order
    expect(db.x).toBeGreaterThan(server.x + server.width);
    const long = async t => (await app.shape(t).boundingBox()).height;
    expect(await long('Server')).toBeCloseTo(await long('Client'), 0);           // all as long as each other
    expect(await long('Database')).toBeCloseTo(await long('Client'), 0);
    const mid = b => b.x + b.width / 2;
    const ends = [[client, server], [server, db], [db, server], [server, client]];
    expect(lines).toHaveLength(4);
    lines.forEach((l, i) => {
        expect(l).toHaveLength(2);
        expect(l[0][1]).toBeCloseTo(l[1][1], 0);                                 // level
        if (i) expect(l[0][1]).toBeGreaterThan(lines[i - 1][0][1] + 10);        // under the one before
        expect(l[0][1]).toBeGreaterThan(client.y + 20);                          // under the heads
        expect(l[0][0]).toBeCloseTo(mid(ends[i][0]), 0);                         // from the dashed line ...
        expect(l[1][0]).toBeCloseTo(mid(ends[i][1]), 0);                         // ... to the other
    });
    expect(await app.flowText()).toBe(SEQUENCE);                                 // nothing written back
    expect((await textAt(app.shape('Server'))).y).toBeLessThan(0.15);            // the name stays in the head
});

test('UML sequence: a later lifeline snaps back into place when dragged; the first moves the sequence', async ({
                                                                                                                   app,
                                                                                                                   page
                                                                                                               }) => {
    await openFlow(app, SEQUENCE);
    const before = await sequenceOf(app), head = b => ({x: b.x + b.width / 2, y: b.y + 8});
    await app.drag(head(before.boxes.server), {
        x: head(before.boxes.server).x + 40,
        y: head(before.boxes.server).y + 60
    });
    expect(await app.flowText()).toBe(SEQUENCE);
    expect((await sequenceOf(app)).boxes.server.x).toBeCloseTo(before.boxes.server.x, 0);
    await app.drag(head(before.boxes.client), {
        x: head(before.boxes.client).x + 60,
        y: head(before.boxes.client).y + 40
    });
    const text = await app.flowText(), after = await sequenceOf(app);
    expect(text).toMatch(/^client: lifeline "Client" @ [\d.]+,[\d.]+$/m);       // only the first gets a place
    expect(text).toContain('server: lifeline "Server"\n');
    expect(text).not.toContain('endpt');
    expect(after.boxes.server.x - after.boxes.client.x).toBeCloseTo(before.boxes.server.x - before.boxes.client.x, 0);
    expect(after.boxes.client.y).toBeGreaterThan(before.boxes.client.y + 20);
    for (const l of after.lines) expect(l[0][1]).toBeCloseTo(l[1][1], 0);
});

test('UML sequence: the lifelines in a container make a sequence of their own, inside it, moving with it', async ({
                                                                                                                      app,
                                                                                                                      page
                                                                                                                  }) => {
    const text = 'flow 1\npage "Seq"\nframe: container "Request" @ 10,10 140x90\n' +
        'client: lifeline "Client" @ 18,22 30x66 [in=frame]\nserver: lifeline "Server" 30x66 [in=frame]\n' +
        'db: participant "Database" 30x66 [in=frame]\n' +
        'client -> server : "GET"\nserver -> db : "query"\ndb ..> server : "rows"\nserver ..> client : "200"';
    await openFlow(app, text);
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const {boxes: {client, server, db}, lines} = await sequenceOf(app), frame = await outlineBox(app.shape('Request'));
    expect(server.y).toBeCloseTo(client.y, 0);                                  // a sequence: tops level ...
    expect(server.x).toBeGreaterThan(client.x + client.width);                  // ... side by side in text order
    expect(db.x).toBeGreaterThan(server.x + server.width);
    for (const l of lines) expect(l[0][1]).toBeCloseTo(l[1][1], 0);              // every message level
    for (const b of [client, server, db]) {                                      // all inside the frame
        expect(b.x).toBeGreaterThan(frame.x);
        expect(b.x + b.width).toBeLessThan(frame.x + frame.width);
    }
    expect(await app.flowText()).toBe(text);                                     // nothing written back
    const grab = await app.centreOf(app.label('Request').locator('tspan').first());
    await app.drag(grab, {x: grab.x + 60, y: grab.y + 30});
    const after = await sequenceOf(app);
    expect(after.boxes.client.x - client.x).toBeCloseTo(60, -1);                 // the whole sequence went with it
    expect(after.boxes.db.x - db.x).toBeCloseTo(after.boxes.client.x - client.x, 0);
    for (const l of after.lines) expect(l[0][1]).toBeCloseTo(l[1][1], 0);
    expect(await app.flowText()).toContain('server: lifeline "Server" 30x66 [in=frame]\n');   // still placed by it
});

test('a connection can end part way along a side: endpt=w@0.25 a quarter of the way down', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "Ends"\na: process "A" @ 10,10 30x40\nb: process "B" @ 90,10 30x40\na -> b [beginpt=e@0.75 endpt=w@0.25]\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const a = await outlineBox(app.shape('A')), b = await outlineBox(app.shape('B')),
        [l] = await screenLines(page);
    expect(l[0][1]).toBeCloseTo(a.y + a.height * 0.75, -1);
    expect(l[l.length - 1][1]).toBeCloseTo(b.y + b.height * 0.25, -1);
    expect(l[l.length - 1][0]).toBeCloseTo(b.x, -1);
    expect(await app.flowText()).toContain('a -> b [beginpt=e@0.75 endpt=w@0.25]');
    await openFlow(app, 'flow 1\npage "Ends"\na: process "A"\nb: process "B"\na -> b [endpt=w@2]\n');
    await expect(page.locator('#tpStatus')).toContainText('like e@0.3');
});

test('BPMN: events and gateways keep their size with names under them, tasks carry their marker', async ({
                                                                                                             app,
                                                                                                             page
                                                                                                         }) => {
    await openFlow(app, 'flow 1\npage "BPMN"\ns: bpmnstart "Order in" @ 10,20\nt1: usertask "Check order" @ 35,12\n' +
        'g: xorgateway "In stock?" @ 90,18\nt2: servicetask "Send email" @ 125,0\ne: endevent "Done" @ 175,8\n' +
        'w: timer "2 days" @ 175,40\nd: dataobject "Invoice" @ 60,60\nt0: activity "Plain" @ 100,60\ns -> t1\nt1 -> g\ng -> t2 : "yes"\nt2 -> e\n');
    for (const t of ['Order in', 'In stock?', 'Done', '2 days', 'Invoice']) expect((await textAt(app.shape(t))).y).toBeGreaterThan(1);
    // the end event's thick ring is a dark disc with a white one over it
    await expect(app.shape('Done').locator('path[fill="#FFFFFF"]')).toHaveCount(1);
    // a user task has its person marker as well as its box, a plain task only the box
    const sections = t => app.shape(t).locator('path[data-sec][fill="none"]').count();
    expect(await sections('Check order')).toBeGreaterThan(await sections('Plain'));
    expect(await sections('Send email')).toBeGreaterThan(await sections('Plain'));
    expect(await app.connectionLines()).toHaveLength(4);
    const kinds = ['startevent', 'endevent', 'timerevent', 'messageevent', 'gateway', 'parallelgateway', 'task',
        'usertask', 'servicetask', 'dataobject'];
    for (const k of kinds) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of kinds) expect(text).toMatch(new RegExp(`: ${k}\\b`));
    expect(text).toContain('g: xorgateway "In stock?" @ 90,18');
});

test('C4 and network: kinds with a digit in them parse, dark boxes get white text, icons have their names under them', async ({
                                                                                                                                  app,
                                                                                                                                  page
                                                                                                                              }) => {
    await openFlow(app, 'flow 1\npage "C4"\np: c4person "Customer" @ 10,10\ns: softwaresystem "Shop" @ 70,15\n' +
        'k: c4component "Sign-in" @ 140,15\nf: firewall "Edge" @ 10,80\nq: mq "Orders" @ 50,80\nm: smartphone "App" @ 90,80\np -> s\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    for (const t of ['Customer', 'Shop', 'Sign-in']) await expect(app.shape(t)).toHaveCount(1);
    const ink = t => app.label(t).locator('text').getAttribute('fill');
    expect(await ink('Shop')).toBe('#FFFFFF');
    expect(await ink('Sign-in')).not.toBe('#FFFFFF');                  // the lightest blue keeps dark text
    for (const t of ['Edge', 'Orders', 'App']) expect((await textAt(app.shape(t))).y).toBeGreaterThan(1);
    expect(await app.connectionLines()).toHaveLength(1);
    const kinds = ['c4person', 'c4system', 'c4container', 'c4component', 'c4external', 'firewall', 'router',
        'loadbalancer', 'queue', 'cache', 'bucket', 'phone', 'service'];
    for (const k of kinds) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of kinds) expect(text).toMatch(new RegExp(`: ${k} "`));
    expect(text).toContain('s: softwaresystem "Shop" @ 70,15');
    expect(text).toContain('p: c4person "Customer" @ 10,10');
});

test('the kanban pattern drops a board of three columns of sticky notes', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "Plan"\na: process "Step"\n');
    const b = page.locator('.palette [data-pattern="kanban"]');
    if (!await b.isVisible()) await b.locator('xpath=ancestor::details[1]/summary').click();
    await b.click();
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    for (const t of ['To do', 'Doing', 'Done', 'Write the brief', 'Login page']) await expect(app.shape(t)).toHaveCount(1);
    const text = await app.flowText();
    expect(text).toMatch(/^kanban: container "Board" @ [\d.]+,[\d.]+ \[flow=row gap=6\]$/m);
    expect(text).toContain('login: sticky "Login page" 40x18 [in=doing]');
});

test('a class box goes out to DOT as a record of its compartments and comes back as a class box', async ({
                                                                                                             app,
                                                                                                             page
                                                                                                         }) => {
    await openFlow(app, 'flow 1\npage "UML"\nr: umlclass "Repo | items: List<Item> | add()\\nremove()" @ 10,10\n');
    await page.click('#btnExport');
    await page.selectOption('#exportFmt', 'dot');
    const dot = await page.locator('#exportText').inputValue();
    expect(dot).toContain('shape=record, label="{Repo|items: List\\<Item\\>\\l|add()\\lremove()\\l}"');
    await page.keyboard.press('Escape');
    await page.click('#btnImport');
    await page.fill('#importText', dot);
    await page.selectOption('#importDest', 'new');
    await page.click('#importGo');
    await expect(page.locator('#importDlg')).toBeHidden();
    expect(await app.flowText()).toMatch(/: umlclass "Repo \| items: List<Item> \| add\(\)\\nremove\(\)"/);
});

test('mind map: topics joined to a central topic spread out to both sides of it, loose shapes go underneath', async ({
                                                                                                                         app,
                                                                                                                         page
                                                                                                                     }) => {
    await openFlow(app, 'flow 1\npage "Mind"\nidea: mindmap "Website"\na: topic "Goals"\nb: branch "Users"\nc: topic "Content"\n' +
        'a1: topic "Sign-ups"\nb1: topic "Staff"\nnote: sticky "Later"\nidea -> a\nidea -> b\nidea -> c\na -> a1\nb1 -> b\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const box = async t => app.shape(t).evaluate(g => {
        const r = g.querySelector('path').getBoundingClientRect();
        return {l: r.left, r: r.right, t: r.top, b: r.bottom, cx: r.left + r.width / 2};
    });
    const idea = await box('Website'), xs = {};
    for (const t of ['Goals', 'Users', 'Content', 'Sign-ups', 'Staff']) xs[t] = await box(t);
    const left = Object.values(xs).filter(b => b.r < idea.l), right = Object.values(xs).filter(b => b.l > idea.r);
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBeGreaterThan(0);
    expect(left.length + right.length).toBe(5);                       // every topic beside the centre, none over it
    // a topic's own branches go further out on its side, whichever way its line points
    for (const [kid, parent] of [['Sign-ups', 'Goals'], ['Staff', 'Users']]) {
        const k = xs[kid], p = xs[parent];
        expect(Math.abs(k.cx - idea.cx)).toBeGreaterThan(Math.abs(p.cx - idea.cx));
        expect(Math.sign(k.cx - idea.cx)).toBe(Math.sign(p.cx - idea.cx));
    }
    expect((await box('Later')).t).toBeGreaterThan(Math.max(...Object.values(xs).map(b => b.b)));
    expect(await app.label('Website').locator('text').getAttribute('fill')).toBe('#FFFFFF');
    for (const k of ['centraltopic', 'topic']) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of ['centraltopic', 'topic']) expect(text).toMatch(new RegExp(`: ${k} "`));
    expect(text).toContain('idea: mindmap "Website"');
});

test('timeline, phases and moods: a dot or chevron per part of the label, the face from its face setting', async ({
                                                                                                                    app,
                                                                                                                    page
                                                                                                                }) => {
    await openFlow(app, 'flow 1\npage "Road"\nt: timescale "Jan | Feb | Mar" @ 10,10\np: roadmap "Plan | Build" @ 10,40\n' +
        'm1: mood "Happy" @ 10,80\nm2: feeling "Frustrated" @ 40,80 [face=angry]\nm3: emotion "Okay" @ 70,80 [face=:(]\n' +
        'm4: mood "Sad" @ 100,80 [face=:D]\nm5: mood "Cross" @ 130,80 [face=mad]\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const filled = t => app.shape(t).locator('path[data-sec]:not([fill="none"])').count();
    expect(await filled('Feb')).toBe(3);                               // a dot per month
    expect(await filled('Build')).toBe(2);                             // a chevron per phase
    // each face is shaded by its face setting, never its label: green, red, blue, green (laughing), amber
    const face = t => app.shape(t).locator('path[data-sec="0"]:not([fill="none"])').getAttribute('fill');
    const fills = [await face('Happy'), await face('Frustrated'), await face('Okay'), await face('Sad'), await face('Cross')];
    expect(new Set(fills).size).toBe(4);
    expect(fills[3]).toBe(fills[0]);
    // the name is inside the shape, under the face
    const at = await textAt(app.shape('Happy'));
    expect(at.y).toBeGreaterThan(0.6);
    expect(at.y).toBeLessThan(1);
    const kinds = ['timeline', 'phases', 'mood'];
    for (const k of kinds) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of kinds) expect(text).toMatch(new RegExp(`: ${k} "`));
    expect(text).toContain('t: timescale "Jan | Feb | Mar" @ 10,10');
});

test('the journey map pattern drops stages, each with a step and a mood', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "Plan"\na: process "Step"\n');
    const b = page.locator('.palette [data-pattern="journey"]');
    if (!await b.isVisible()) await b.locator('xpath=ancestor::details[1]/summary').click();
    await b.click();
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    for (const t of ['Customer journey', 'Discover', 'Sign up', 'Use', 'Frustrated', 'Happy']) await expect(app.shape(t)).toHaveCount(1);
    expect(await app.flowText()).toContain('form_mood: mood "Frustrated" [face=angry in=sign_up]');
});

test('more BPMN: intermediate event, inclusive and event gateways, collapsed subprocess with its + marker', async ({
                                                                                                                       app,
                                                                                                                       page
                                                                                                                   }) => {
    await openFlow(app, 'flow 1\npage "BPMN"\nb: boundaryevent "Timeout" @ 10,10\ni: orgateway "Extras?" @ 40,10\n' +
        'e: eventbasedgateway "Reply?" @ 70,10\ns: callactivity "Refund" @ 100,10\nt: task "Plain" @ 100,50\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    for (const t of ['Timeout', 'Extras?', 'Reply?']) expect((await textAt(app.shape(t))).y).toBeGreaterThan(1);
    const lines = t => app.shape(t).locator('path[data-sec][fill="none"]').count();
    expect(await lines('Refund')).toBeGreaterThan(await lines('Plain'));   // the + marker
    expect(await lines('Reply?')).toBeGreaterThan(await lines('Extras?'));  // double ring and pentagon against one ring
    const kinds = ['intermediateevent', 'inclusivegateway', 'eventgateway', 'bpmnsubprocess'];
    for (const k of kinds) await addFromPalette(page, k);
    const text = await app.flowText();
    for (const k of kinds) expect(text).toMatch(new RegExp(`: ${k}\\b`));
    expect(text).toContain('s: callactivity "Refund" @ 100,10');
});

test('a C4 boundary is a dashed container: its members go inside it, and the old boundary alias is still a container', async ({
                                                                                                                                  app,
                                                                                                                                  page
                                                                                                                              }) => {
    await openFlow(app, 'flow 1\npage "C4"\nshop: systemboundary "Shop"\nweb: c4container "Web app" [in=shop]\n' +
        'api: c4container "API" [in=shop]\nold: boundary "Old frame" @ 150,10\n');
    await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    const rect = t => app.shape(t).evaluate(g => {
        const r = g.getBoundingClientRect();
        return {l: r.left, r: r.right, t: r.top, b: r.bottom};
    });
    const shop = await rect('Shop');
    for (const t of ['Web app', 'API']) {
        const m = await rect(t);
        expect(m.l).toBeGreaterThan(shop.l);
        expect(m.r).toBeLessThan(shop.r);
        expect(m.b).toBeLessThan(shop.b);
    }
    // the frame is drawn as dashes: many separate moves in its outline (after the backdrop and the name's band)
    const d = await app.shape('Shop').locator('path[data-sec="2"][fill="none"]').getAttribute('d');
    expect(d.match(/M/g).length).toBeGreaterThan(20);
    await addFromPalette(page, 'c4boundary');
    const text = await app.flowText();
    expect(text).toMatch(/: c4boundary "/);
    expect(text).toContain('old: boundary "Old frame" @ 150,10');
    expect(text).toContain('web: c4container "Web app" [in=shop]');
});

test('a C4 boundary can be dragged by its white header band, and its members come with it', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "C4"\nshop: c4boundary "Shop" @ 20,20 100x60\nweb: c4container "Web app" @ 35,40 [in=shop]\n');
    const box = t => app.shape(t).evaluate(g => {
        const r = g.getBoundingClientRect();
        return {x: r.left, y: r.top, w: r.width};
    });
    const shop = await box('Shop'), web = await box('Web app');
    const grab = {x: shop.x + shop.w * 0.75, y: shop.y + 5};
    await app.drag(grab, {x: grab.x + 60, y: grab.y + 40});
    const web2 = await box('Web app');
    expect(web2.x - web.x).toBeGreaterThan(40);
    expect(web2.y - web.y).toBeGreaterThan(25);
});
