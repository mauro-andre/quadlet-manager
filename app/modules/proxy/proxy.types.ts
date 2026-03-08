export type SslMode = "letsencrypt" | "custom" | "none";

export interface ProxyConfig {
    enabled: boolean;
    sslMode: SslMode;
    certPath: string | null;
    keyPath: string | null;
}

export type TargetType = "container" | "host";

export interface DomainMapping {
    id: string;
    domain: string;
    containerName: string;
    containerPort: number;
    enabled: boolean;
    targetType: TargetType;
    tls: boolean;
    backendHttps: boolean;
}

export interface ContainerOption {
    id: string;
    name: string;
    ports: number[];
    networks: string[];
    state: string;
}
