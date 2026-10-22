"""Render a .flow file in the real DesignRoutes editor and save a PNG of every page, plus any presentation steps asked
for, so a drawing can be checked by eye. The parser (check-flow.mjs) proves a flow is valid; only the editor shows
whether it looks right: labels that crowd, a key past the page edge, text too small to read.

Needs Python 3 with Playwright and its Chromium, and an editor export (DesignRoutes-editor.html, the single-file
build of the editor). Nothing is sent anywhere: the editor runs from the local file.

    python3 scripts/render-flow.py EDITOR.html FILE.flow OUT_DIR [--steps 1,6,14]

Writes OUT_DIR/page-1.png ... and OUT_DIR/step-N.png. Exits 0 on success, 1 if the editor reported errors while
loading or playing, 2 on bad arguments, missing files or no Playwright.
"""
import argparse
import sys
from pathlib import Path

LOAD_WAIT_MS = 1500   # the editor builds its canvas after the file input fires
STEP_WAIT_MS = 800    # presentation tweens take 450 ms; leave margin for the page switch


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("editor", type=Path, help="DesignRoutes-editor.html")
    parser.add_argument("flow", type=Path, help="the .flow file to render")
    parser.add_argument("out", type=Path, help="folder for the PNGs")
    parser.add_argument("--steps", default="", help="presentation steps to capture, e.g. 1,6,14")
    args = parser.parse_args()
    for path in (args.editor, args.flow):
        if not path.is_file():
            print(f"Not found: {path}", file=sys.stderr)
            sys.exit(2)
    try:
        args.steps = sorted({int(s) for s in args.steps.split(",") if s.strip()})
    except ValueError:
        parser.error("--steps takes step numbers separated by commas, e.g. 1,6,14")
    return args


def open_flow(page, editor: Path, flow: Path):
    page.goto(editor.resolve().as_uri())
    page.wait_for_timeout(LOAD_WAIT_MS)
    if not page.query_selector("#fileInput"):
        return False
    if page.is_visible("#tourEnd"):  # the first-run tour covers part of the canvas
        page.click("#tourEnd")
    page.set_input_files("#fileInput", str(flow))
    page.wait_for_timeout(LOAD_WAIT_MS)
    return True


def page_names(page):
    names = page.eval_on_selector_all(
        "#tabs *", "els => els.filter(e => !e.children.length).map(e => e.textContent.trim())")
    return [n for n in names if n and n != "+"]


def render_pages(page, out: Path):
    names = page_names(page)
    for i, name in enumerate(names, 1):
        page.get_by_text(name, exact=True).last.click()
        page.wait_for_timeout(STEP_WAIT_MS)
        page.click("#btnFit")
        page.wait_for_timeout(STEP_WAIT_MS)
        page.locator("#stage").screenshot(path=str(out / f"page-{i}.png"))
        print(f"page {i} \"{name}\" -> {out / f'page-{i}.png'}")
    return len(names)


def render_steps(page, out: Path, steps):
    page.click("#btnPresent")
    page.wait_for_timeout(STEP_WAIT_MS)
    total = int(page.inner_text("#presentCount").split("/")[1])
    for n in steps:
        if not 0 <= n <= total:
            print(f"step {n}: skipped, the animation has steps 0 to {total}")
            continue
        page.select_option("#presentStep", str(n))
        page.wait_for_timeout(STEP_WAIT_MS)
        page.screenshot(path=str(out / f"step-{n}.png"))
        print(f"step {n} -> {out / f'step-{n}.png'}")
    page.click("#presentExit")


def main():
    args = parse_args()
    try:
        from playwright.sync_api import sync_playwright, Error as PlaywrightError
    except ImportError:
        print("Playwright isn't installed (pip install playwright, then playwright install chromium).",
              file=sys.stderr)
        sys.exit(2)
    args.out.mkdir(parents=True, exist_ok=True)
    page_errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            try:
                page = browser.new_page(viewport={"width": 1600, "height": 900})
                page.on("pageerror", lambda e: page_errors.append(str(e)))
                if not open_flow(page, args.editor, args.flow) or not render_pages(page, args.out):
                    print(f"{args.editor} doesn't look like a DesignRoutes editor export.", file=sys.stderr)
                    sys.exit(2)
                if args.steps:
                    render_steps(page, args.out, args.steps)
            finally:
                browser.close()
    except PlaywrightError as e:
        print(f"The browser failed: {e}", file=sys.stderr)
        sys.exit(2)
    for e in page_errors:
        print(f"editor error: {e}", file=sys.stderr)
    sys.exit(1 if page_errors else 0)


if __name__ == "__main__":
    main()
