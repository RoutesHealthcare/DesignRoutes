import {useRef, type ReactNode} from "react";
import licence from "../../LICENSE.md?raw";
import notices from "../../THIRD-PARTY-NOTICES.md?raw";

/* Just enough Markdown for THIRD-PARTY-NOTICES.md: headings, "- " lists, ``` blocks shown as they are, and
   paragraphs. Text wrapped onto the next line joins its paragraph or list item. */
function Markdown({text}: { text: string }) {
    const out: ReactNode[] = [];
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const isBreak = (l: string) => !l.trim() || /^(#|```|- )/.test(l);
    // a line and the wrapped lines after it, as one line of text
    const joined = (i: number): [string, number] => {
        const parts = [lines[i]];
        while (i + 1 < lines.length && !isBreak(lines[i + 1])) parts.push(lines[++i]);
        return [parts.map(l => l.trim()).join(' ').replace(/`/g, ''), i];
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('```')) {
            const code: string[] = [];
            while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i]);
            out.push(<pre key={i}>{code.join('\n')}</pre>);
        } else if (/^#{1,6} /.test(line)) {
            const level = line.indexOf(' ');
            const heading = line.slice(level + 1);
            out.push(level <= 2 ? <h3 key={i}>{heading}</h3> : <h4 key={i}>{heading}</h4>);
        } else if (line.startsWith('- ')) {
            const items: ReactNode[] = [];
            const start = i;
            while (i < lines.length && lines[i].startsWith('- ')) {
                const [item, end] = joined(i);
                items.push(<li key={i}>{item.slice(2)}</li>);
                i = end + 1;
            }
            i--;
            out.push(<ul key={start}>{items}</ul>);
        } else if (line.trim()) {
            const [para, end] = joined(i);
            out.push(<p key={i}>{para}</p>);
            i = end;
        }
    }
    return <>{out}</>;
}

// the file opens with a note on where it's copied to, which is for the repo, not for someone using the editor
const credits = notices.slice(notices.indexOf('## Map data'));

export function CreditsDialog() {
    const dlg = useRef<HTMLDialogElement>(null);
    return (
        <dialog id="creditsDlg" aria-labelledby="creditsTitle" ref={dlg}>
            <h2 id="creditsTitle">Credits and licences</h2>
            <div id="creditsText" className="credits">
                <p>This editor is made by Routes Healthcare and uses the map data and software below.</p>
                <Markdown text={credits}/>
                <h3>This editor</h3>
                <pre>{licence.trim()}</pre>
            </div>
            <div className="dlgBtns">
                <button id="creditsClose" className="primary" onClick={() => dlg.current?.close()}>Close</button>
            </div>
        </dialog>
    )
}
