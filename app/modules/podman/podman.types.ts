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
    HostConfig: {
        PortBindings: Record<string, Array<{
            HostIp: string;
            HostPort: string;
        }>> | null;
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

export interface PodmanImage {
    Id: string;
    RepoTags: string[] | null;
    RepoDigests: string[] | null;
    Size: number;
    VirtualSize: number;
    SharedSize: number;
    Containers: number;
    Created: number; // unix timestamp (seconds)
    Labels: Record<string, string> | null;
    ParentId: string;
}

export interface PodmanImageInspect {
    Id: string;
    RepoTags: string[] | null;
    RepoDigests: string[] | null;
    Size: number;
    VirtualSize: number;
    Created: string; // ISO date string
    Architecture: string;
    Os: string;
    Config: {
        Env: string[] | null;
        Cmd: string[] | null;
        Entrypoint: string[] | null;
        ExposedPorts: Record<string, object> | null;
        Labels: Record<string, string> | null;
        WorkingDir: string;
        User: string;
        Volumes: Record<string, object> | null;
    };
    RootFS: {
        Type: string;
        Layers: string[] | null;
    };
}

export interface PodmanImageHistory {
    id: string;
    created: number; // unix timestamp
    createdBy: string;
    size: number;
    comment: string;
    tags: string[] | null;
    emptyLayer: boolean;
}

export interface PodmanDiskUsage {
    ImagesSize: number;
    Images: PodmanDfImage[];
    Containers: PodmanDfContainer[];
    Volumes: PodmanDfVolume[];
}

export interface PodmanDfImage {
    Repository: string;
    Tag: string;
    ImageID: string;
    Created: string;
    Size: number;
    SharedSize: number;
    UniqueSize: number;
    Containers: number;
}

export interface PodmanDfContainer {
    ContainerID: string;
    Image: string;
    Command: string;
    LocalVolumes: number;
    Size: number;
    RWSize: number;
    Created: string;
    Status: string;
    Names: string;
}

export interface PodmanDfVolume {
    VolumeName: string;
    Links: number;
    Size: number;
    ReclaimableSize: number;
}
