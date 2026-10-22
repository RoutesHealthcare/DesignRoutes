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
    version++;
    listeners.forEach(l => l());
}

/* Bumped by every notify(), so a component that derives a whole view (not just one
   scalar, the way PageSizeInput reads pageSizeMM directly) can subscribe to "something
   changed" with useSyncExternalStore(subscribe, getVersion) and re-read S / selEl() /
   engine helpers fresh in its render body. */
let version = 0;
export const getVersion = () => version;