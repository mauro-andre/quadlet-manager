import type { Scope } from "../auth/auth.types.js";

export type QuadletType = "container" | "network" | "volume";

export interface QuadletFile {
    name: string;
    type: QuadletType;
    filename: string;
    path: string;
    content: string;
    serviceName: string;
    scope: Scope;
}

export interface QuadletListItem {
    name: string;
    type: QuadletType;
    filename: string;
    serviceName: string;
    activeState: string;
    scope: Scope;
}
