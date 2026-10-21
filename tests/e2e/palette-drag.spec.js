import {test, expect} from './fixtures.js';

/* Drags a palette button onto the page with hand-made drag events, with the drop's drag data empty. A real drag in
   Chrome on Windows goes through the operating system's drag and drop and arrives like that, with the custom shape
   data lost; Playwright's own dragTo never does (it stays inside the browser), so it can't catch this. */
async function dragFromPaletteLosingData(page, kind) {
    const box = await page.locator('#paper').boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.evaluate(([kind, x, y]) => {
        const button = document.querySelector(`.palette [data-kind="${kind}"]`),
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
    }, [kind, x, y]);
}

test('dragging a palette shape onto the page adds it there', async ({app, page}) => {
    const before = await app.shapes.count();
    await page.locator('.palette [data-kind="decision"]').dragTo(page.locator('#paper'));
    await expect(app.shapes).toHaveCount(before + 1);
    expect(await app.flowText()).toMatch(/: decision /);
});

test('a palette drag still adds its shape when the drop arrives without the drag data', async ({app, page}) => {
    const before = await app.shapes.count();
    await dragFromPaletteLosingData(page, 'process');
    await expect(app.shapes).toHaveCount(before + 1);
    expect(await app.flowText()).toMatch(/: process /);
});

test('a finished palette drag is forgotten, so a later empty drop adds nothing', async ({app, page}) => {
    const before = await app.shapes.count();
    await page.evaluate(() => {
        const button = document.querySelector('.palette [data-kind="process"]');
        button.dispatchEvent(new DragEvent('dragstart', {dataTransfer: new DataTransfer(), bubbles: true}));
        button.dispatchEvent(new DragEvent('dragend', {dataTransfer: new DataTransfer(), bubbles: true}));   // dropped somewhere else
        document.getElementById('stage').dispatchEvent(new DragEvent('drop', {
            dataTransfer: new DataTransfer(),
            bubbles: true,
            cancelable: true
        }));
    });
    await page.waitForTimeout(200);
    await expect(app.shapes).toHaveCount(before);
});
