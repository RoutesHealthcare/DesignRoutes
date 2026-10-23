import {languageNames} from "./LanguageNames";
import {CodeRename} from "./CodeRename";
import {useRef, useSyncExternalStore} from "react";
import {subscribe, getVersion} from "../engine/store";
import {TP, setPane, setLanguage, applyForeign, revertEditor} from "../engine/text-pane";

/* Screen region 4 of docs/app-plan.md. Pin, Hide and the language choice (this component's "first" per the
   migration checklist) all read/write TP directly, subscribed via the version counter like Props/PageTabs - TP
   isn't part of S, so it needs refreshEditor()/setPane() to notify() for this to see their changes. The editor
   itself (gutter, highlighting, suggestions, the status line) stays an engine piece inside, like the canvas:
   codeText/codeHl/codeGutter/tpStatus are still plain DOM nodes text-pane.ts writes into directly. */
export function DiagramTextEditor() {
    useSyncExternalStore(subscribe, getVersion);
    const code = useRef<HTMLTextAreaElement>(null);
    const otherFormat = TP.mode !== 'flow';
    return (
        <>
            <aside className={"textpane" + (TP.open && !TP.pinned ? ' floating' : '')} id="textPane"
                   hidden={!TP.open} aria-label="Diagram text">
                <div className="tp-resize" id="tpResize" aria-hidden="true"></div>
                <div className="tp-head">
                    <span className="tp-title">Text</span>
                    <select id="tpLang" aria-label="Language" value={TP.mode}
                            onChange={e => setLanguage(e.target.value)}>
                        {Object.entries(languageNames).map(([lang, name]) => (
                            <option key={lang} value={lang}>{name}</option>
                        ))}
                    </select>
                    <span className="grow"></span>
                    <button id="tpRevert" title="Revert" hidden={!otherFormat} disabled={!TP.dirty}
                            onClick={revertEditor}>Revert</button>
                    <button id="tpApply" title="Apply" className="primary" hidden={!otherFormat} disabled={!TP.dirty}
                            onClick={applyForeign}>Apply</button>
                    <button id="tpPin" title="Keep the text beside the canvas" aria-pressed={TP.pinned}
                            onClick={() => setPane(true, !TP.pinned)}>{TP.pinned ? 'Unpin' : 'Pin'}</button>
                    <button id="tpClose" title="Hide the text (Ctrl+E)"
                            onClick={() => setPane(false, TP.pinned)}>Hide</button>
                </div>
                <div className="code">
                    <div className="gutter-wrap">
                        <div id="codeGutter" className="code-gutter" aria-hidden="true"></div>
                    </div>
                    <div className="code-body">
                        <div id="codeHl" className="code-hl" aria-hidden="true"></div>
                        <textarea ref={code} id="codeText" className="code-text" spellCheck="false" autoCapitalize="off"
                                  autoComplete="off" aria-label="Diagram text"></textarea>
                        <ul id="suggest" className="suggest" role="listbox" aria-label="Suggestions" hidden></ul>
                        <CodeRename code={code}/>
                    </div>
                </div>
                <div className="tp-status" id="tpStatus" role="status"></div>
            </aside>
        </>
    )
}