export interface PodmanPort {
    host_ip: string;
    container_port: number;
    host_port: number;
    range: number;
    protocol: string;
}

export interface PodmanMount {
    Type: string;
    Source: string;
    Destination: string;
    Mode: string;
    RW: boolean;
}

export interface PodmanContainer {
    Id: string;
    Names: string[];
    Image: string;
    ImageID: string;
    State: string;
    Status: string;
    Created: string;
    Ports: PodmanPort[];
    Labels: Record<string, string>;
    Mounts: PodmanMount[];
}

export interface PodmanContainerInspect {
    Id: string;
    Name: string;
    State: {
        Status: string;
        Running: boolean;
        Paused: boolean;
        StartedAt: string;
        FinishedAt: string;
        ExitCode: number;
        Pid: number;
    };
    Config: {
        Image: string;
        Env: string[];
        Labels: Record<string, string>;
    };
    NetworkSettings: {
        Networks: Record<string, { IPAddress: string }>;
    };
    Mounts: PodmanMount[];
}

export interface PodmanStats {
    ContainerID: string;
    Name: string;
    CPUNano: number;
    SystemNano: number;
    MemUsage: number;
    MemLimit: number;
    Network: Record<string, {
        RxBytes: number;
        TxBytes: number;
    }> | null;
    BlockInput: number;
    BlockOutput: number;
    PIDs: number;
}

export interface PodmanStatsResponse {
    Error: unknown;
    Stats: PodmanStats[] | null;
}
