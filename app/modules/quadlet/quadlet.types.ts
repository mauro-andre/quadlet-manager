export type QuadletType = "container" | "network" | "volume";

export interface QuadletFile {
    name: string;
    type: QuadletType;
    filename: string;
    path: string;
    content: string;
    serviceName: string;
}

export interface QuadletListItem {
    name: string;
    type: QuadletType;
    filename: string;
    serviceName: string;
}
