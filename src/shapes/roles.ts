import {setUser, userV} from "../engine/flow/model";

/* Role tag stored in a User-defined cell, so it survives a round trip through Visio (shape names must be unique per page) */
const ROLE_ROW = 'FlowEditorRole'

export function roleOf(el: Element | null): string | null {
    return userV(el, ROLE_ROW)
}

export function setRole(el: Element, role: string): void {
    setUser(el, ROLE_ROW, role)
}