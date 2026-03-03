export type Scope = "system" | "user";

export interface AuthUser {
    username: string;
    uid: number;
    gid: number;
    groups: string[];
    hasSudo: boolean;
    homeDir: string;
}
