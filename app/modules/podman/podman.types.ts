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
    Created: number;
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
    cpu_stats: {
        cpu_usage: {
            total_usage: number;
            usage_in_kernelmode: number;
            usage_in_usermode: number;
        };
        system_cpu_usage: number;
        online_cpus: number;
    };
    precpu_stats: {
        cpu_usage: {
            total_usage: number;
        };
        system_cpu_usage?: number;
    };
    memory_stats: {
        usage: number;
        limit: number;
    };
    blkio_stats: {
        io_service_bytes_recursive: Array<{
            major: number;
            minor: number;
            op: string;
            value: number;
        }> | null;
    };
    networks?: Record<string, {
        rx_bytes: number;
        tx_bytes: number;
    }>;
    pids_stats: {
        current: number;
    };
}
