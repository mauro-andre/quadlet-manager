import type { DirectiveSpec, SectionSpec } from "../quadlet/quadlet.directives.js";

// ---------------------------------------------------------------------------
// [Unit] — same as quadlet, shared
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
    { key: "ConditionPathExists", description: "Only start if this path exists", fieldType: "text", repeatable: true },
    { key: "ConditionPathIsDirectory", description: "Only start if path is a directory", fieldType: "text", repeatable: true },
];

// ---------------------------------------------------------------------------
// [Service] — systemd service directives
// ---------------------------------------------------------------------------

const SERVICE_DIRECTIVES: DirectiveSpec[] = [
    { key: "Type", description: "Service type", fieldType: "select", repeatable: false, options: [
        { value: "simple", description: "Main process is the service (default)" },
        { value: "exec", description: "Like simple, but service is ready after exec succeeds" },
        { value: "forking", description: "Service forks and parent exits" },
        { value: "oneshot", description: "Runs once and exits" },
        { value: "notify", description: "Sends notification when ready" },
        { value: "idle", description: "Delayed until all jobs finish" },
    ] },
    { key: "ExecStart", description: "Command to start the service", fieldType: "text", repeatable: false },
    { key: "ExecStartPre", description: "Commands to run before ExecStart", fieldType: "text", repeatable: true },
    { key: "ExecStartPost", description: "Commands to run after ExecStart", fieldType: "text", repeatable: true },
    { key: "ExecStop", description: "Command to stop the service", fieldType: "text", repeatable: false },
    { key: "ExecStopPost", description: "Commands to run after service stops", fieldType: "text", repeatable: true },
    { key: "ExecReload", description: "Command to reload configuration", fieldType: "text", repeatable: false },
    { key: "Restart", description: "When to restart the service", fieldType: "select", repeatable: false, options: [
        { value: "no", description: "Never restart (default)" },
        { value: "on-success", description: "Restart only on clean exit" },
        { value: "on-failure", description: "Restart on failure" },
        { value: "on-abnormal", description: "Restart on signal or timeout" },
        { value: "on-watchdog", description: "Restart on watchdog timeout" },
        { value: "on-abort", description: "Restart on uncaught signal" },
        { value: "always", description: "Always restart" },
    ] },
    { key: "RestartSec", description: "Delay before restarting (seconds)", fieldType: "text", repeatable: false },
    { key: "TimeoutStartSec", description: "Timeout for service startup", fieldType: "text", repeatable: false },
    { key: "TimeoutStopSec", description: "Timeout for service shutdown", fieldType: "text", repeatable: false },
    { key: "TimeoutSec", description: "Shorthand for both start and stop timeout", fieldType: "text", repeatable: false },
    { key: "WatchdogSec", description: "Watchdog timeout", fieldType: "text", repeatable: false },
    { key: "RemainAfterExit", description: "Keep service active after process exits", fieldType: "select", repeatable: false, options: [
        { value: "no", description: "Service is inactive after exit (default)" },
        { value: "yes", description: "Service stays active after exit" },
    ] },
    { key: "WorkingDirectory", description: "Working directory for the service", fieldType: "text", repeatable: false },
    { key: "User", description: "Run service as this user", fieldType: "text", repeatable: false },
    { key: "Group", description: "Run service as this group", fieldType: "text", repeatable: false },
    { key: "Environment", description: "Set an environment variable", fieldType: "pair", repeatable: true,
      separator: "=", leftLabel: "Variable", rightLabel: "Value" },
    { key: "EnvironmentFile", description: "Read environment variables from a file", fieldType: "text", repeatable: true },
    { key: "StandardOutput", description: "Where to send stdout", fieldType: "select", repeatable: false, options: [
        { value: "journal", description: "Log to journal (default)" },
        { value: "inherit", description: "Inherit from parent" },
        { value: "null", description: "Discard output" },
        { value: "file:/path", description: "Write to file" },
        { value: "append:/path", description: "Append to file" },
    ] },
    { key: "StandardError", description: "Where to send stderr", fieldType: "select", repeatable: false, options: [
        { value: "inherit", description: "Same as StandardOutput (default)" },
        { value: "journal", description: "Log to journal" },
        { value: "null", description: "Discard errors" },
        { value: "file:/path", description: "Write to file" },
        { value: "append:/path", description: "Append to file" },
    ] },
    { key: "SyslogIdentifier", description: "Identifier for syslog/journal messages", fieldType: "text", repeatable: false },
    { key: "KillMode", description: "How to kill processes on stop", fieldType: "select", repeatable: false, options: [
        { value: "control-group", description: "Kill all processes in cgroup (default)" },
        { value: "mixed", description: "SIGTERM to main, SIGKILL to remaining" },
        { value: "process", description: "Kill only main process" },
        { value: "none", description: "No processes killed" },
    ] },
    { key: "KillSignal", description: "Signal to send on stop", fieldType: "text", repeatable: false },
    { key: "SuccessExitStatus", description: "Additional exit codes considered success", fieldType: "text", repeatable: false },
    { key: "RestartPreventExitStatus", description: "Exit codes that prevent restart", fieldType: "text", repeatable: false },
    { key: "ProtectSystem", description: "Mount /usr and /boot read-only", fieldType: "select", repeatable: false, options: [
        { value: "false", description: "No protection (default)" },
        { value: "true", description: "/usr and /boot read-only" },
        { value: "full", description: "/usr, /boot, /etc read-only" },
        { value: "strict", description: "Entire filesystem read-only" },
    ] },
    { key: "ProtectHome", description: "Restrict access to home directories", fieldType: "select", repeatable: false, options: [
        { value: "false", description: "No restriction (default)" },
        { value: "true", description: "Home dirs inaccessible" },
        { value: "read-only", description: "Home dirs read-only" },
        { value: "tmpfs", description: "Empty tmpfs mounted on home dirs" },
    ] },
    { key: "PrivateTmp", description: "Use private /tmp directory", fieldType: "select", repeatable: false, options: [
        { value: "false", description: "Share /tmp (default)" },
        { value: "true", description: "Private /tmp and /var/tmp" },
    ] },
    { key: "NoNewPrivileges", description: "Prevent privilege escalation", fieldType: "select", repeatable: false, options: [
        { value: "false", description: "Allow (default)" },
        { value: "true", description: "Block privilege escalation" },
    ] },
    { key: "LimitNOFILE", description: "Maximum number of open files", fieldType: "text", repeatable: false },
    { key: "LimitNPROC", description: "Maximum number of processes", fieldType: "text", repeatable: false },
    { key: "MemoryMax", description: "Maximum memory limit", fieldType: "text", repeatable: false },
    { key: "CPUQuota", description: "CPU time quota (e.g. 50%)", fieldType: "text", repeatable: false },
];

// ---------------------------------------------------------------------------
// [Timer] — systemd timer directives
// ---------------------------------------------------------------------------

const TIMER_DIRECTIVES: DirectiveSpec[] = [
    { key: "OnCalendar", description: "Calendar-based schedule (e.g. daily, *-*-* 03:00)", fieldType: "text", repeatable: true },
    { key: "OnBootSec", description: "Run this long after boot", fieldType: "text", repeatable: false },
    { key: "OnStartupSec", description: "Run this long after service manager start", fieldType: "text", repeatable: false },
    { key: "OnUnitActiveSec", description: "Run this long after unit was last activated", fieldType: "text", repeatable: false },
    { key: "OnUnitInactiveSec", description: "Run this long after unit was last deactivated", fieldType: "text", repeatable: false },
    { key: "OnActiveSec", description: "Run this long after timer was activated", fieldType: "text", repeatable: false },
    { key: "AccuracySec", description: "Timer accuracy (default 1min)", fieldType: "text", repeatable: false },
    { key: "RandomizedDelaySec", description: "Random delay added to timer", fieldType: "text", repeatable: false },
    { key: "Persistent", description: "Run missed events after downtime", fieldType: "select", repeatable: false, options: [
        { value: "false", description: "Skip missed events (default)" },
        { value: "true", description: "Catch up missed events" },
    ] },
    { key: "Unit", description: "Unit to activate (defaults to same-named .service)", fieldType: "text", repeatable: false },
    { key: "WakeSystem", description: "Wake system from suspend for timer", fieldType: "select", repeatable: false, options: [
        { value: "false", description: "Do not wake (default)" },
        { value: "true", description: "Wake system from suspend" },
    ] },
    { key: "FixedRandomDelay", description: "Use fixed random delay per timer", fieldType: "select", repeatable: false, options: [
        { value: "false", description: "Different delay each time (default)" },
        { value: "true", description: "Same delay each time" },
    ] },
];

// ---------------------------------------------------------------------------
// [Install] — same as quadlet, shared
// ---------------------------------------------------------------------------

const INSTALL_DIRECTIVES: DirectiveSpec[] = [
    { key: "WantedBy", description: "Start automatically when this target is reached", fieldType: "select", repeatable: true, options: [
        { value: "default.target", description: "Start on user login (rootless default)" },
        { value: "multi-user.target", description: "Start on boot (system services)" },
        { value: "timers.target", description: "Start with timer subsystem" },
    ] },
    { key: "RequiredBy", description: "Required by the specified target", fieldType: "text", repeatable: true },
    { key: "Alias", description: "Alternative name for this unit", fieldType: "text", repeatable: true },
];

// ---------------------------------------------------------------------------
// Section registry
// ---------------------------------------------------------------------------

export const SYSTEMD_SECTIONS: SectionSpec[] = [
    { name: "Unit", description: "Unit metadata: description, dependencies and ordering", directives: UNIT_DIRECTIVES },
    { name: "Service", description: "Service execution configuration", directives: SERVICE_DIRECTIVES },
    { name: "Timer", description: "Timer schedule configuration", directives: TIMER_DIRECTIVES },
    { name: "Install", description: "Controls when the unit starts automatically", directives: INSTALL_DIRECTIVES },
];

export function getSystemdSectionSpec(name: string): SectionSpec | undefined {
    return SYSTEMD_SECTIONS.find((s) => s.name === name);
}

export function getSystemdDirectiveSpec(sectionName: string, key: string) {
    const section = getSystemdSectionSpec(sectionName);
    return section?.directives.find((d) => d.key === key);
}

export type SystemdUnitType = "service" | "timer";

export function getSectionsForUnitType(type: SystemdUnitType): string[] {
    switch (type) {
        case "service":
            return ["Unit", "Service", "Install"];
        case "timer":
            return ["Unit", "Timer", "Install"];
    }
}
