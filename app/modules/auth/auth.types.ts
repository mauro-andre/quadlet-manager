export interface AuthUser {
    username: string;
    uid: number;
    gid: number;
    groups: string[];
    homeDir: string;
}
