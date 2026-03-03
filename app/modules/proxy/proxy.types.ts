export type SslMode = "letsencrypt" | "custom" | "none";

export interface ProxyConfig {
    enabled: boolean;
    sslMode: SslMode;
    certPath: string | null;
    keyPath: string | null;
}

export interface DomainMapping {
    id: number;
    domain: string;
    containerName: string;
    containerPort: number;
    enabled: boolean;
}

export interface ContainerOption {
    id: string;
    name: string;
    ports: number[];
    networks: string[];
    state: string;
}
