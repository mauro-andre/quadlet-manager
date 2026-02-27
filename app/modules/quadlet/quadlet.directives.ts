export type FieldType = "text" | "pair" | "select";

export interface SelectOption {
    value: string;
    description: string;
}

export interface DirectiveSpec {
    key: string;
    description: string;
    fieldType: FieldType;
    repeatable: boolean;
    separator?: string;
    leftLabel?: string;
    rightLabel?: string;
    options?: SelectOption[];
}

export interface SectionSpec {
    name: string;
    description: string;
    directives: DirectiveSpec[];
}

// ---------------------------------------------------------------------------
// [Unit] — Standard systemd unit directives
// ---------------------------------------------------------------------------

const UNIT_DIRECTIVES: DirectiveSpec[] = [
    { key: "Description", description: "Human-readable description of the unit", fieldType: "text", repeatable: false },
    { key: "After", description: "Start this unit after the specified units", fieldType: "text", repeatable: true },
    { key: "Before", description: "Start this unit before the specified units", fieldType: "text", repeatable: true },
    { key: "Requires", description: "Strict dependency — fails if dependency fails", fieldType: "text", repeatable: true },
    { key: "Wants", description: "Weak dependency — does not fail if dependency fails", fieldType: "text", repeatable: true },
    { key: "BindsTo", description: "Strong bidirectional dependency", fieldType: "text", repeatable: true },
    { key: "PartOf", description: "Stop/restart together with the specified unit", fieldType: "text", repeatable: true },
    { key: "Conflicts", description: "Cannot run at the same time as the specified units", fieldType: "text", repeatable: true },
];

// ---------------------------------------------------------------------------
// [Container] — Podman container configuration
// ---------------------------------------------------------------------------

const CONTAINER_DIRECTIVES: DirectiveSpec[] = [
    // Core
    { key: "Image", description: "Container image to run (required)", fieldType: "text", repeatable: false },
    { key: "ContainerName", description: "Custom name for the container", fieldType: "text", repeatable: false },
    { key: "Exec", description: "Command arguments passed after the image", fieldType: "text", repeatable: false },
    { key: "Entrypoint", description: "Override the default image entrypoint", fieldType: "text", repeatable: false },
    { key: "WorkingDir", description: "Working directory inside the container", fieldType: "text", repeatable: false },

    // Environment
    { key: "Environment", description: "Set an environment variable", fieldType: "pair", repeatable: true,
      separator: "=", leftLabel: "Variable", rightLabel: "Value" },
    { key: "EnvironmentFile", description: "Read environment variables from a file", fieldType: "text", repeatable: true },
    { key: "EnvironmentHost", description: "Use all host environment variables", fieldType: "select", repeatable: false, options: [
        { value: "true", description: "Pass host environment to the container" },
        { value: "false", description: "Do not pass host environment" },
    ] },

    // Network
    { key: "PublishPort", description: "Expose port from container to host", fieldType: "pair", repeatable: true,
      separator: ":", leftLabel: "Host Port", rightLabel: "Container Port" },
    { key: "Network", description: "Connect to a Podman network", fieldType: "text", repeatable: true },
    { key: "NetworkAlias", description: "Network-scoped alias for the container", fieldType: "text", repeatable: true },
    { key: "HostName", description: "Hostname inside the container", fieldType: "text", repeatable: false },
    { key: "DNS", description: "Custom DNS server", fieldType: "text", repeatable: true },
    { key: "DNSSearch", description: "Custom DNS search domain", fieldType: "text", repeatable: true },
    { key: "DNSOption", description: "Custom DNS option", fieldType: "text", repeatable: true },
    { key: "AddHost", description: "Add host-to-IP mapping to /etc/hosts", fieldType: "pair", repeatable: true,
      separator: ":", leftLabel: "Hostname", rightLabel: "IP Address" },
    { key: "IP", description: "Static IPv4 address", fieldType: "text", repeatable: false },
    { key: "IP6", description: "Static IPv6 address", fieldType: "text", repeatable: false },
    { key: "ExposeHostPort", description: "Expose port range from host to container", fieldType: "text", repeatable: true },
    { key: "HttpProxy", description: "Inherit proxy environment variables from host", fieldType: "select", repeatable: false, options: [
        { value: "true", description: "Pass proxy env vars to the container" },
        { value: "false", description: "Do not pass proxy env vars" },
    ] },

    // Storage
    { key: "Volume", description: "Mount a volume or host path", fieldType: "pair", repeatable: true,
      separator: ":", leftLabel: "Source", rightLabel: "Destination" },
    { key: "Mount", description: "Attach a filesystem mount", fieldType: "text", repeatable: true },
    { key: "Tmpfs", description: "Mount a tmpfs filesystem", fieldType: "text", repeatable: true },
    { key: "ReadOnly", description: "Make the container root filesystem read-only", fieldType: "select", repeatable: false, options: [
        { value: "true", description: "Root filesystem is read-only" },
        { value: "false", description: "Root filesystem is writable" },
    ] },
    { key: "ReadOnlyTmpfs", description: "Mount read-write tmpfs on read-only root", fieldType: "select", repeatable: false, options: [
        { value: "true", description: "Mount tmpfs on /tmp, /var/tmp, /run" },
        { value: "false", description: "Do not mount additional tmpfs" },
    ] },

    // Labels & Annotations
    { key: "Label", description: "Set an OCI label on the container", fieldType: "pair", repeatable: true,
      separator: "=", leftLabel: "Key", rightLabel: "Value" },
    { key: "Annotation", description: "Set an OCI annotation on the container", fieldType: "pair", repeatable: true,
      separator: "=", leftLabel: "Key", rightLabel: "Value" },

    // User & Security
    { key: "User", description: "Run as this UID inside the container", fieldType: "text", repeatable: false },
    { key: "Group", description: "Run as this GID inside the container", fieldType: "text", repeatable: false },
    { key: "GroupAdd", description: "Add supplementary group for the user", fieldType: "text", repeatable: true },
    { key: "AddCapability", description: "Add a Linux capability", fieldType: "text", repeatable: true },
    { key: "DropCapability", description: "Drop a Linux capability", fieldType: "text", repeatable: true },
    { key: "NoNewPrivileges", description: "Prevent gaining new privileges via setuid", fieldType: "select", repeatable: false, options: [
        { value: "true", description: "Block privilege escalation" },
        { value: "false", description: "Allow privilege escalation" },
    ] },
    { key: "SecurityLabelDisable", description: "Disable SELinux label separation", fieldType: "select", repeatable: false, options: [
        { value: "true", description: "Disable SELinux labeling" },
        { value: "false", description: "Keep SELinux labeling enabled" },
    ] },
    { key: "SecurityLabelType", description: "SELinux process label type", fieldType: "text", repeatable: false },
    { key: "SecurityLabelLevel", description: "SELinux process label level", fieldType: "text", repeatable: false },
    { key: "UserNS", description: "User namespace mode", fieldType: "text", repeatable: false },
    { key: "UIDMap", description: "UID mapping for user namespace", fieldType: "text", repeatable: true },
    { key: "GIDMap", description: "GID mapping for user namespace", fieldType: "text", repeatable: true },
    { key: "SubUIDMap", description: "UID mapping from /etc/subuid", fieldType: "text", repeatable: false },
    { key: "SubGIDMap", description: "GID mapping from /etc/subgid", fieldType: "text", repeatable: false },
    { key: "SeccompProfile", description: "Seccomp security profile path", fieldType: "text", repeatable: false },
    { key: "AppArmor", description: "AppArmor confinement profile", fieldType: "text", repeatable: false },
    { key: "Mask", description: "Paths to mask inside the container", fieldType: "text", repeatable: false },
    { key: "Unmask", description: "Unmask default-masked paths", fieldType: "text", repeatable: false },

    // Resources
    { key: "Memory", description: "Memory limit for the container", fieldType: "text", repeatable: false },
    { key: "PidsLimit", description: "Maximum number of PIDs", fieldType: "text", repeatable: false },
    { key: "ShmSize", description: "Size of /dev/shm", fieldType: "text", repeatable: false },
    { key: "Ulimit", description: "Set ulimit value", fieldType: "text", repeatable: true },
    { key: "Sysctl", description: "Set a kernel parameter", fieldType: "pair", repeatable: true,
      separator: "=", leftLabel: "Parameter", rightLabel: "Value" },
    { key: "CgroupsMode", description: "Cgroups mode (default: split)", fieldType: "select", repeatable: false, options: [
        { value: "split", description: "Create a cgroup for each component (default)" },
        { value: "enabled", description: "Run everything in one cgroup" },
        { value: "disabled", description: "Do not create cgroups" },
        { value: "no-conmon", description: "Do not create a cgroup for conmon" },
    ] },

    // Health checks
    { key: "HealthCmd", description: "Command to check container health", fieldType: "text", repeatable: false },
    { key: "HealthInterval", description: "Time between health checks", fieldType: "text", repeatable: false },
    { key: "HealthRetries", description: "Retries before marking unhealthy", fieldType: "text", repeatable: false },
    { key: "HealthTimeout", description: "Maximum time for a health check", fieldType: "text", repeatable: false },
    { key: "HealthStartPeriod", description: "Initialization time before health checks", fieldType: "text", repeatable: false },
    { key: "HealthOnFailure", description: "Action when container becomes unhealthy", fieldType: "select", repeatable: false, options: [
        { value: "none", description: "Take no action (default)" },
        { value: "kill", description: "Kill the container" },
        { value: "restart", description: "Restart the container" },
        { value: "stop", description: "Stop the container" },
    ] },
    { key: "HealthStartupCmd", description: "Startup health check command", fieldType: "text", repeatable: false },
    { key: "HealthStartupInterval", description: "Startup health check interval", fieldType: "text", repeatable: false },
    { key: "HealthStartupRetries", description: "Startup health check retry count", fieldType: "text", repeatable: false },
    { key: "HealthStartupTimeout", description: "Startup health check timeout", fieldType: "text", repeatable: false },
    { key: "HealthStartupSuccess", description: "Successful startup checks needed", fieldType: "text", repeatable: false },

    // Lifecycle
    { key: "StopSignal", description: "Signal to stop the container (default: SIGTERM)", fieldType: "text", repeatable: false },
    { key: "StopTimeout", description: "Seconds before forceful stop", fieldType: "text", repeatable: false },
    { key: "RunInit", description: "Run a minimal init process", fieldType: "select", repeatable: false, options: [
        { value: "true", description: "Run an init process (tini) in the container" },
        { value: "false", description: "No init process" },
    ] },
    { key: "Notify", description: "Enable sd_notify support", fieldType: "select", repeatable: false, options: [
        { value: "false", description: "No notification (default)" },
        { value: "true", description: "Forward sd_notify from the container" },
        { value: "healthy", description: "Ready when health check passes" },
    ] },
    { key: "Timezone", description: "Container timezone", fieldType: "text", repeatable: false },
    { key: "Pull", description: "Image pull policy", fieldType: "select", repeatable: false, options: [
        { value: "missing", description: "Pull only if not present locally (default)" },
        { value: "always", description: "Always pull the latest image" },
        { value: "never", description: "Never pull, fail if not present" },
        { value: "newer", description: "Pull if a newer version exists" },
    ] },
    { key: "AutoUpdate", description: "Enable auto-update", fieldType: "select", repeatable: false, options: [
        { value: "registry", description: "Check registry for newer images" },
        { value: "local", description: "Check local storage for newer images" },
    ] },

    // Advanced
    { key: "Pod", description: "Link to a Quadlet .pod unit", fieldType: "text", repeatable: false },
    { key: "Secret", description: "Podman secret to provide to container", fieldType: "text", repeatable: true },
    { key: "AddDevice", description: "Add a host device to the container", fieldType: "text", repeatable: true },
    { key: "ReloadCmd", description: "Command for systemd reload", fieldType: "text", repeatable: false },
    { key: "ReloadSignal", description: "Signal for systemd reload", fieldType: "text", repeatable: false },
    { key: "Retry", description: "Retry count for image pull on error", fieldType: "text", repeatable: false },
    { key: "RetryDelay", description: "Delay between image pull retries", fieldType: "text", repeatable: false },
    { key: "Rootfs", description: "Use a rootfs directory instead of an image", fieldType: "text", repeatable: false },
    { key: "GlobalArgs", description: "Arguments between podman and run", fieldType: "text", repeatable: true },
    { key: "PodmanArgs", description: "Additional arguments for podman run", fieldType: "text", repeatable: true },
    { key: "ContainersConfModule", description: "Load a containers.conf module", fieldType: "text", repeatable: true },
];

// ---------------------------------------------------------------------------
// [Install] — Systemd install directives
// ---------------------------------------------------------------------------

const INSTALL_DIRECTIVES: DirectiveSpec[] = [
    { key: "WantedBy", description: "Start automatically when this target is reached", fieldType: "select", repeatable: true, options: [
        { value: "default.target", description: "Start on user login (rootless default)" },
        { value: "multi-user.target", description: "Start on boot (system services)" },
    ] },
    { key: "RequiredBy", description: "Required by the specified target", fieldType: "text", repeatable: true },
    { key: "Alias", description: "Alternative name for this unit", fieldType: "text", repeatable: true },
];

// ---------------------------------------------------------------------------
// [Network] — Podman network configuration
// ---------------------------------------------------------------------------

const NETWORK_DIRECTIVES: DirectiveSpec[] = [
    { key: "NetworkName", description: "Custom name for the network", fieldType: "text", repeatable: false },
    { key: "Driver", description: "Network driver", fieldType: "select", repeatable: false, options: [
        { value: "bridge", description: "Software bridge network (default)" },
        { value: "macvlan", description: "Container gets its own MAC address" },
        { value: "ipvlan", description: "Containers share MAC, separate IPs" },
    ] },
    { key: "Subnet", description: "Subnet in CIDR notation", fieldType: "text", repeatable: true },
    { key: "Gateway", description: "Gateway address for the subnet", fieldType: "text", repeatable: true },
    { key: "IPRange", description: "IP range for container allocation", fieldType: "text", repeatable: true },
    { key: "Internal", description: "Restrict external network access", fieldType: "select", repeatable: false, options: [
        { value: "false", description: "Allow external access (default)" },
        { value: "true", description: "No external network access" },
    ] },
    { key: "DisableDNS", description: "Disable the DNS plugin", fieldType: "select", repeatable: false, options: [
        { value: "false", description: "DNS plugin enabled (default)" },
        { value: "true", description: "Disable DNS resolution" },
    ] },
    { key: "IPv6", description: "Enable IPv6 networking", fieldType: "select", repeatable: false, options: [
        { value: "false", description: "IPv4 only (default)" },
        { value: "true", description: "Enable dual-stack IPv4/IPv6" },
    ] },
    { key: "IPAMDriver", description: "IP Address Management driver", fieldType: "text", repeatable: false },
    { key: "InterfaceName", description: "Network interface name", fieldType: "text", repeatable: false },
    { key: "DNS", description: "Custom DNS server for the network", fieldType: "text", repeatable: true },
    { key: "DNSSearch", description: "Custom DNS search domain", fieldType: "text", repeatable: true },
    { key: "DNSOption", description: "Custom DNS option", fieldType: "text", repeatable: true },
    { key: "Label", description: "Set an OCI label on the network", fieldType: "pair", repeatable: true,
      separator: "=", leftLabel: "Key", rightLabel: "Value" },
    { key: "Options", description: "Driver-specific option", fieldType: "pair", repeatable: true,
      separator: "=", leftLabel: "Key", rightLabel: "Value" },
    { key: "NetworkDeleteOnStop", description: "Delete network when service stops", fieldType: "select", repeatable: false, options: [
        { value: "false", description: "Keep network after stop (default)" },
        { value: "true", description: "Remove network when service stops" },
    ] },
    { key: "GlobalArgs", description: "Arguments between podman and network", fieldType: "text", repeatable: true },
    { key: "PodmanArgs", description: "Additional arguments for podman network create", fieldType: "text", repeatable: true },
    { key: "ContainersConfModule", description: "Load a containers.conf module", fieldType: "text", repeatable: true },
];

// ---------------------------------------------------------------------------
// [Volume] — Podman volume configuration
// ---------------------------------------------------------------------------

const VOLUME_DIRECTIVES: DirectiveSpec[] = [
    { key: "VolumeName", description: "Custom name for the volume", fieldType: "text", repeatable: false },
    { key: "Driver", description: "Volume driver name", fieldType: "text", repeatable: false },
    { key: "Image", description: "Image for image-driver volumes", fieldType: "text", repeatable: false },
    { key: "Device", description: "Device path to mount", fieldType: "text", repeatable: false },
    { key: "Type", description: "Filesystem type of the device", fieldType: "text", repeatable: false },
    { key: "Options", description: "Mount options", fieldType: "text", repeatable: false },
    { key: "Copy", description: "Copy image content on first run", fieldType: "select", repeatable: false, options: [
        { value: "true", description: "Copy image data to volume (default)" },
        { value: "false", description: "Do not copy image data" },
    ] },
    { key: "User", description: "UID or username for mount operation", fieldType: "text", repeatable: false },
    { key: "Group", description: "GID or group name for mount operation", fieldType: "text", repeatable: false },
    { key: "Label", description: "Set an OCI label on the volume", fieldType: "pair", repeatable: true,
      separator: "=", leftLabel: "Key", rightLabel: "Value" },
    { key: "GlobalArgs", description: "Arguments between podman and volume", fieldType: "text", repeatable: true },
    { key: "PodmanArgs", description: "Additional arguments for podman volume create", fieldType: "text", repeatable: true },
    { key: "ContainersConfModule", description: "Load a containers.conf module", fieldType: "text", repeatable: true },
];

// ---------------------------------------------------------------------------
// Section registry
// ---------------------------------------------------------------------------

export const SECTIONS: SectionSpec[] = [
    { name: "Unit", description: "Systemd unit configuration: dependencies and ordering", directives: UNIT_DIRECTIVES },
    { name: "Container", description: "Container runtime configuration", directives: CONTAINER_DIRECTIVES },
    { name: "Install", description: "Controls when the service starts automatically", directives: INSTALL_DIRECTIVES },
    { name: "Network", description: "Podman network configuration", directives: NETWORK_DIRECTIVES },
    { name: "Volume", description: "Podman volume configuration", directives: VOLUME_DIRECTIVES },
];

/**
 * Get the SectionSpec for a given section name.
 * Returns undefined for unknown sections (custom/unmapped).
 */
export function getSectionSpec(name: string): SectionSpec | undefined {
    return SECTIONS.find((s) => s.name === name);
}

/**
 * Get the DirectiveSpec for a given key within a section.
 * Returns undefined for unknown directives (custom/unmapped).
 */
export function getDirectiveSpec(sectionName: string, key: string): DirectiveSpec | undefined {
    const section = getSectionSpec(sectionName);
    return section?.directives.find((d) => d.key === key);
}

/**
 * Get the sections relevant to a quadlet file type.
 */
export function getSectionsForType(type: "container" | "network" | "volume"): string[] {
    switch (type) {
        case "container":
            return ["Unit", "Container", "Install"];
        case "network":
            return ["Network"];
        case "volume":
            return ["Volume"];
    }
}
