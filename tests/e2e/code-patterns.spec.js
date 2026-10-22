import {test, expect} from './fixtures.js';

/* The design pattern and algorithm groups of the palette (shapes/code-patterns.ts) */
const openFlow = (app, text) => app.open({name: 'code.flow', mimeType: 'text/plain', buffer: Buffer.from(text)});
/* Every pattern by its palette name, and the id of the frame it comes in */
const DESIGN_FRAMES = {
    singleton: 'singleton',
    factory: 'factory',
    observer: 'observer',
    strategy: 'strategy',
    decorator: 'decorator',
    adapter: 'adapter',
    abstractfactory: 'abstractfactory',
    builder: 'builder',
    prototype: 'prototype',
    facade: 'facade',
    composite: 'composite',
    proxy: 'proxy',
    command: 'command',
    state: 'state',
    templatemethod: 'template',
    iterator: 'iterator',
    chain: 'chain',
    visitor: 'visitor',
    injection: 'injection',
    flyweight: 'flyweight',
    mediator: 'mediator',
    memento: 'memento',
    bridge: 'bridge',
    interpreter: 'interpreter',
    nullobject: 'nullobject',
    objectpool: 'objectpool'
};
const ARCHITECTURE_FRAMES = {
    layered: 'layered', pubsub: 'pubsub', cqrs: 'cqrs', microservices: 'microservices', webapp: 'webapp',
    circuitbreaker: 'breaker', unitofwork: 'unitofwork', mvc: 'mvc', repository: 'repository',
    clientserver: 'request', tcphandshake: 'handshake', oauth: 'oauth', eventsourcing: 'eventsourcing', saga: 'saga',
    stranglerfig: 'strangler', retry: 'retry', ratelimiter: 'limiter', webhook: 'webhook', tokenrefresh: 'refresh',
    checkout: 'checkout'
};
const ALGORITHM_FRAMES = {
    binarysearch: 'bsearch', bubblesort: 'bubble', bst: 'bst', linkedlist: 'linked', stack: 'stack', queue: 'queue',
    bfs: 'bfs', insertionsort: 'insertion', mergesort: 'merge', quicksort: 'quick', dfs: 'dfs', dijkstra: 'dijkstra',
    hashtable: 'hashtable', recursion: 'recursion', gcd: 'gcd', heap: 'heap', trie: 'trie', lrucache: 'lru',
    toposort: 'topo', dynamic: 'dynamic', trafficlight: 'traffic', orderstates: 'lifecycle', selectionsort: 'selection',
    heapsort: 'heapsort', linearsearch: 'linear', astar: 'astar', kruskal: 'kruskal', twopointers: 'twopointers',
    slidingwindow: 'sliding',
    backtracking: 'queens',
    doublylinked: 'doubly',
    adjacency: 'adjacency',
    ringbuffer: 'ring',
    bellmanford: 'bellman',
    unionfind: 'unionfind',
    kmp: 'kmp',
    huffman: 'huffman',
    avl: 'avl',
    btree: 'btree',
    skiplist: 'skiplist',
    bloomfilter: 'bloom'
};
const ML_FRAMES = {
    neuralnetwork: 'network', trainingloop: 'training', gradientdescent: 'descent', backprop: 'backprop', cnn: 'cnn',
    transformer: 'transformer', decisiontree: 'tree', kmeans: 'kmeans', confusionmatrix: 'confusion',
    mlpipeline: 'pipeline', rnn: 'rnn', autoencoder: 'autoencoder', rlloop: 'rl', learningcurves: 'curves'
};
const DESIGN = Object.keys(DESIGN_FRAMES), ARCHITECTURE = Object.keys(ARCHITECTURE_FRAMES),
    ALGORITHMS = Object.keys(ALGORITHM_FRAMES), ML = Object.keys(ML_FRAMES);

/* Clicks a ready-made pattern on the palette, opening its group first */
async function addPattern(page, name) {
    const b = page.locator(`.palette [data-pattern="${name}"]`);
    if (!await b.isVisible()) await b.locator('xpath=ancestor::details[1]/summary').click();
    await b.click();
}

test('design patterns and algorithms have groups of their own on the palette', async ({app, page}) => {
    const group = name => page.locator('.palette details', {has: page.locator('summary', {hasText: new RegExp(`^${name}$`)})});
    for (const n of DESIGN) await expect(group('Design patterns').locator(`[data-pattern="${n}"]`)).toHaveCount(1);
    for (const n of ALGORITHMS) await expect(group('Algorithms').locator(`[data-pattern="${n}"]`)).toHaveCount(1);
    for (const n of ARCHITECTURE) await expect(group('Architecture').locator(`[data-pattern="${n}"]`)).toHaveCount(1);
    for (const n of ML) await expect(group('Machine learning').locator(`[data-pattern="${n}"]`)).toHaveCount(1);
    await expect(group('UI patterns').locator('[data-pattern="login"]')).toHaveCount(1);
    await page.locator('#paletteSearch').fill('algorithm');            // a group's name finds what's in it
    const results = page.getByRole('region', {name: 'Search results'});
    for (const n of ALGORITHMS) await expect(results.locator(`[data-pattern="${n}"]`)).toHaveCount(1);
    await expect(results.locator('[data-pattern="singleton"]')).toHaveCount(0);
});

/* One test per pattern, so a failure names it: it goes in with no problem in its lines or its steps, its frame
   selected, with a description and a walk-through that makes the drawing playable */
for (const [name, frame] of Object.entries({...DESIGN_FRAMES, ...ARCHITECTURE_FRAMES, ...ALGORITHM_FRAMES, ...ML_FRAMES})) {
    test(`the ${name} pattern goes in without a problem, described and with its walk-through`, async ({app, page}) => {
        await openFlow(app, 'flow 1\npage "One"\nx: process "Step" @ 250,180\n');
        await addPattern(page, name);
        await expect(app.selId).toHaveValue(new RegExp(frame));
        await expect(page.locator('#btnPresent')).toBeEnabled();
        const text = await app.flowText();
        expect(text).toMatch(new RegExp(`^about: text ".+" @ [\\d.]+,[\\d.]+ [\\d.]+x[\\d.]+ \\[in=${frame}\\]$`, 'm'));
        expect(text).toMatch(/@animation start\nstep 1\n/);
        await page.keyboard.press('Control+e');
        await expect(page.locator('#tpStatus')).not.toHaveText(/^Line \d+:/);
    });
}

test('a pattern placed twice gets its own ids, and its connections follow them', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "One"\nx: process "Step" @ 250,180\n');
    await addPattern(page, 'factory');
    await addPattern(page, 'factory');
    const text = await app.flowText();
    expect(text).toMatch(/^concrete_creator_2: umlclass "ConcreteCreator .*\[in=factory_2\]$/m);
    expect(text).toContain('concrete_creator_2 --|> creator_2');
    expect(text).toContain('creator_2 ..> product_2 : "makes"');
    expect(text).toContain('concrete_creator --|> creator\n');      // the first copy's are left as they were
});

test('dropped near the top left of the page, a pattern keeps its shape', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "One"\nx: process "Step" @ 250,180\n');
    const s = await page.locator('#stage').boundingBox();
    await page.mouse.move(s.x + s.width / 2, s.y + s.height / 2);
    await page.mouse.wheel(-1500, -1500);                             // the view's centre well off the page's corner
    await addPattern(page, 'bubblesort');
    const text = await app.flowText();
    expect(text).toContain('bubble: container "Bubble sort" @ 0,0 190x223');   // the whole pattern kept on the page
    expect(text).toContain('swap: process "swap them\\nswapped = true" @ 136,91 44x16 [in=bubble]');   // not squashed onto it
    expect(text).toContain('start: terminator "List of n items" @ 64,12 48x14 [in=bubble]');
});

test('a pattern can be dragged onto the page, and lands where it is dropped', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "One"\nx: process "Step" @ 250,180\n');
    const b = page.locator('.palette [data-pattern="factory"]');
    await b.locator('xpath=ancestor::details[1]/summary').click();
    const paper = await page.locator('#paper').boundingBox(), at = {x: paper.width * 0.35, y: paper.height * 0.45};
    await b.dragTo(page.locator('#paper'), {targetPosition: at});
    await expect(app.selId).toHaveValue(/factory/);                  // its frame comes selected
    const frame = await app.centreOf(app.shape('Factory Method'));
    expect(Math.abs(frame.x - (paper.x + at.x))).toBeLessThan(12);       // centred on the drop
    expect(Math.abs(frame.y - (paper.y + at.y))).toBeLessThan(12);
    expect(await app.flowText()).toContain('concrete_creator --|> creator');
});

test('a pattern dragged in still lands when the drop loses its drag data', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "One"\nx: process "Step" @ 250,180\n');
    const box = await page.locator('#paper').boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.evaluate(([x, y]) => {   // as Chrome on Windows delivers it: the drop's data empty (see palette-drag.spec.js)
        const button = document.querySelector('.palette [data-pattern="stack"]'),
            stage = document.getElementById('stage');
        button.dispatchEvent(new DragEvent('dragstart', {
            dataTransfer: new DataTransfer(),
            bubbles: true,
            cancelable: true
        }));
        const dt = new DataTransfer();
        stage.dispatchEvent(new DragEvent('dragover', {
            dataTransfer: dt,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true
        }));
        stage.dispatchEvent(new DragEvent('drop', {
            dataTransfer: dt,
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true
        }));
        button.dispatchEvent(new DragEvent('dragend', {dataTransfer: dt, bubbles: true}));
    }, [x, y]);
    expect(await app.flowText()).toMatch(/^stack: container "Stack: last in, first out" @/m);
});

test('deleting a pattern\'s frame deletes everything in it, as one undo step', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "One"\nx: process "Step" @ 250,180\n');
    await addPattern(page, 'factory');
    await expect(app.selId).toHaveValue(/factory/);
    await page.keyboard.press('Delete');
    const text = await app.flowText();
    expect(text).not.toMatch(/umlclass|factory|-->|\.\.>|\.\.\|>|--\|>/);  // the classes and their connections
    expect(text).toContain('x: process "Step" @ 250,180');             // and nothing else
    await expect(app.shapes).toHaveCount(1);
    await page.keyboard.press('Control+z');
    await expect(app.shape('ConcreteCreator')).toHaveCount(1);
    expect(await app.flowText()).toContain('concrete_creator --|> creator');
});

/* Where the shape `id` is placed in the text, [x, y] in mm */
const placeOf = (text, id) => text.match(new RegExp(String.raw`^${id}: .* @ ([\d.]+),([\d.]+)`, 'm')).slice(1).map(Number);

test('dragging a pattern\'s frame on the page moves everything in it', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "One"\nx: process "Step" @ 250,180\n');
    await addPattern(page, 'singleton');
    const before = await app.flowText();
    const grab = await app.centreOf(app.label('Singleton').first().locator('tspan').first());   // the frame's name, in its header
    await app.drag(grab, {x: grab.x + 80, y: grab.y + 40});
    const after = await app.flowText(), shift = id => placeOf(after, id).map((v, i) => v - placeOf(before, id)[i]);
    const [dx, dy] = shift('singleton');
    expect(dx).toBeGreaterThan(5);
    for (const id of ['client', 'only_one']) {                          // its classes keep their places in it
        expect(shift(id)[0]).toBeCloseTo(dx, 0);
        expect(shift(id)[1]).toBeCloseTo(dy, 0);
    }
});

test('a pattern can be dragged by any empty part of its frame, not just its header', async ({app, page}) => {
    await openFlow(app, 'flow 1\npage "One"\nx: process "Step" @ 250,180\n');
    await addPattern(page, 'singleton');
    await page.mouse.click(5, 450);                                     // nothing selected to start with
    const before = await app.flowText(),
        b = await app.shape('Singleton').first().locator('path[data-bg]').boundingBox();
    const grab = {x: b.x + b.width * 0.4, y: b.y + b.height * 0.62};     // between the classes, above the description
    await app.drag(grab, {x: grab.x + 60, y: grab.y + 30});
    const after = await app.flowText(), shift = id => placeOf(after, id).map((v, i) => v - placeOf(before, id)[i]);
    expect(shift('singleton')[0]).toBeGreaterThan(5);
    for (const i of [0, 1]) expect(shift('client')[i]).toBeCloseTo(shift('singleton')[i], 0);   // its classes with it
});
