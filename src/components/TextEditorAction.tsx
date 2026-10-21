export type TextAction = {
    id: string,
    label: string,
    title?: string,
    className?: string,
    hidden?: boolean,
    ariaPressed?: boolean
};

export const textEditorAction: Record<string, TextAction> = {
    revert: {
        id: 'tpRevert',
        title: 'Revert',
        hidden: true,
        label: "Revert"
    },
    apply: {
        id: 'tpApply',
        title: 'Apply',
        hidden: true,
        className: 'primary',
        label: "Apply"
    },
    pin: {
        id: 'tpPin',
        title: 'Keep the text beside the canvas',
        ariaPressed: false,
        label: "Pin"
    },
    close: {
        id: 'tpClose',
        title: 'Hide the text (Ctrl+E)',
        label: "Hide"
    },

};