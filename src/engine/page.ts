/** The editor's state. Typed only where TypeScript code uses it; the rest stays loose (any) until core.js is converted.
 @type {{elById: Record<string, Element>, [key: string]: any}} */
/* A page: either read from a .vsdx (path and sheet) or built from flow text (pageW and pageH) */
export type Page = {
    name: string,
    doc: Document,
    w: number,
    h: number,
    bg: boolean,
    path?: string,
    sheet?: Element | null,
    pageW?: number,
    pageH?: number,
};

type PageSize = {
    size: [number, number],
    rotationString: string,
    name: string
}
export function getPageSizeNameFormat(pageSize : PageSize){
    return `${pageSize.name} ${pageSize.rotationString} (${pageSize.size[0]} x ${pageSize.size[1]} mm)`
}

export const pageSizeDictionary = {
    a1p: {
        size: [594, 841],
        rotationString: "portrait",
        name: "A1"
    },
    a1l: {
        size: [841, 594],
        rotationString: "landscape",
        name: "A1"
    },
    a2p: {
        size: [420, 594],
        rotationString: "portrait",
        name: "A2"
    },
    a2l: {
        size: [594, 420],
        rotationString: "landscape",
        name: "A2"
    },
    a3p: {
        size: [297, 420],
        rotationString: "portrait",
        name: "A3"
    },
    a3l: {
        size: [420, 297],
        rotationString: "landscape",
        name: "A3"
    },
    a4p: {
        size: [210, 297],
        rotationString: "portrait",
        name: "A4"
    },
    a4l: {
        size: [297, 210],
        rotationString: "landscape",
        name: "A4"
    },
    a5p: {
        size: [148, 210],
        rotationString: "portrait",
        name: "A5"
    },
    a5l: {
        size: [210, 148],
        rotationString: "landscape",
        name: "A5"
    },
    letterp: {
        size: [216, 279],
        rotationString: "portrait",
        name: "US Letter"
    },
    letterl: {
        size: [279, 216],
        rotationString: "landscape",
        name: "US Letter"
    }
} satisfies Record<string, PageSize>;