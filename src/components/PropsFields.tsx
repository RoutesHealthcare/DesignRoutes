import {type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState} from "react";

/* A value that shows what's being typed/picked without a live update (from notify())
   clobbering it mid-edit, and commits against whatever it was opened for, not whatever
   is newly selected by the time the edit finishes. key identifies that owner (a shape
   id, a page index, ...); switching key discards any stale draft and shows the new live
   value straight away. */
export function useDraft<K>(key: K, live: string) {
    const [draft, setDraft] = useState<{ key: K; v: string } | null>(null);
    const value = draft && draft.key === key ? draft.v : live;
    return {
        value,
        set: (v: string) => setDraft({key, v}),
        clear: () => setDraft(null),
        /* The pending value for this key, if any, clearing it; null if there's nothing to commit */
        take(): string | null {
            if (!draft || draft.key !== key) return null;
            setDraft(null);
            return draft.v;
        },
    };
}

/* A text or number field that commits on blur or Enter, and leaves Escape to do nothing
   special (matching the fields that had no keyboard handling before this was a
   component). For a <textarea> where Enter should insert a newline instead of
   committing, pass enterCommits: false. */
export function useCommittedField<K>(key: K, live: string, onCommit: (v: string) => void, enterCommits = true) {
    const d = useDraft(key, live);
    const commit = () => {
        const v = d.take();
        if (v !== null) onCommit(v);
    };
    return {
        value: d.value,
        onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => d.set(e.target.value),
        onBlur: commit,
        onKeyDown: enterCommits ? (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.stopPropagation();   // Enter would also start editing the shape's text
                commit();
            }
        } : undefined,
    };
}

/* A colour input fires React's onChange on every native "input" tick while its picker is
   open (every drag of the wheel); the engine wants one commit when a colour is settled,
   the same "change" event the DOM listened for directly before this was a component. */
export function useNativeChange<E extends HTMLElement>(handler: ((e: Event) => void) | undefined) {
    const ref = useRef<E | null>(null);
    const handlerRef = useRef(handler);
    handlerRef.current = handler;
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const listener = (e: Event) => handlerRef.current?.(e);
        el.addEventListener('change', listener);
        return () => el.removeEventListener('change', listener);
    }, []);
    return ref;
}
