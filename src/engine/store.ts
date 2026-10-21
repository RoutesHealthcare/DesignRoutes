/* ---------- the store bridge ---------- */
/* How React finds out the engine has changed something. The engine calls notify() after a change; a component
   reads what it needs with useSyncExternalStore(subscribe, () => S.something), and React redraws it when that
   value is different. */
const listeners = new Set<() => void>();

export function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function notify() {
    listeners.forEach(l => l());
}