import {languageNames} from "./LanguageNames";
import {textEditorAction} from "./TextEditorAction";
import {CodeRename} from "./CodeRename";
import {useRef} from "react";



export function DiagramTextEditor() {
    const code = useRef<HTMLTextAreaElement>(null);
    return (
        <>
            <aside className="textpane" id="textPane" hidden aria-label="Diagram text">
                <div className="tp-resize" id="tpResize" aria-hidden="true"></div>
                <div className="tp-head">
                    <span className="tp-title">Text</span>
                    <select id="tpLang" aria-label="Language">
                        {Object.entries(languageNames).map(([lang, name]) => (
                            <option key={lang} value={lang}>{name}</option>
                        ))}
                    </select>
                    <span className="grow"></span>
                    {Object.values(textEditorAction).map(action => (
                        <button key={action.id} id={action.id} title={action.title}
                                className={action?.className} hidden={action?.hidden}
                                aria-pressed={action?.ariaPressed}>
                            {action?.label}
                        </button>
                    ))}
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