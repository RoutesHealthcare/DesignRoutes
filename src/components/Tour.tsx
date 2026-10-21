import {useEffect, useLayoutEffect, useRef, useSyncExternalStore} from "react";
import {subscribe} from "../engine/store";
import {endTour, getStep, nextStep, STEP_COUNT, getTourStep, place} from "../engine/tutorial";


export function Tour() {
    const step = useSyncExternalStore(subscribe, getStep);
    const tourStep = useSyncExternalStore(subscribe, getTourStep);
    const next = useRef<HTMLButtonElement>(null);
    useLayoutEffect(() => {
        if (!tourStep) return;                         // no tour showing
        place();                                       // position the card now its new text is on the page
        if (!tourStep.done) next.current?.focus();     // waiting steps leave focus on the page for the task
    }, [tourStep]);
    const running = step >= 0;
    useEffect(() => {
        if (!running) return;
        const onResize = () => place();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [running])
    return (
        <>
            <div id="tour" className="tour" role="dialog" hidden={!tourStep} aria-labelledby="tourTitle"
                 aria-describedby="tourBody"
            >
                <p className="count" id="tourCount">{step >= 0 && `Step ${step + 1} of ${STEP_COUNT}`}</p>
                <h2 id="tourTitle">{tourStep?.title}</h2>
                <p id="tourBody">{tourStep?.body}</p>
                <p className="status" id="tourStatus"
                   aria-live="polite">{tourStep?.done ? 'Waiting for you to do this…' : ''}</p>
                <div className="tour-btns">
                    <button id="tourEnd" onClick={endTour}>End tour</button>
                    <button id="tourNext" ref={next} className={tourStep && !tourStep.done ? 'primary' : undefined}
                            onClick={nextStep}>{tourStep?.done ? 'Skip this step' : tourStep?.next ?? 'Next'}</button>
                </div>
            </div>
        </>
    )
}