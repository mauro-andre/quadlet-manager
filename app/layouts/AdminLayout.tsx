import type { ComponentChildren } from "preact";
import type { LoaderArgs } from "velojs";
import { useCallback } from "preact/hooks";
import { Link } from "velojs";
import { useLoader, usePathname } from "velojs/hooks";
import { darkTheme, lightTheme } from "../styles/theme.css.js";
import { ToastContainer } from "../components/ToastContainer.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import * as css from "./AdminLayout.css.js";

interface AdminLayoutData {
    username: string;
    hasSudo: boolean;
}

export const loader = async ({ c }: LoaderArgs) => {
    const user = c.get("user");
    return {
        username: user?.username ?? "unknown",
        hasSudo: user?.hasSudo ?? false,
    } satisfies AdminLayoutData;
};

function ThemeToggle() {
    const toggle = useCallback(() => {
        const html = document.documentElement;
        const isDark = html.classList.contains(darkTheme);
        const next = isDark ? "light" : "dark";
        html.className = next === "light" ? lightTheme : darkTheme;
        localStorage.setItem("theme", next);
    }, []);

    return (
        <button class={css.themeToggle} onClick={toggle}>
            Toggle theme
        </button>
    );
}

const navItems = [
    { path: "/", label: "Dashboard" },
    { path: "/containers", label: "Containers" },
    { path: "/quadlets", label: "Quadlets" },
    { path: "/images", label: "Images" },
    { path: "/volumes", label: "Volumes" },
    { path: "/domains", label: "Domains" },
    { path: "/terminal", label: "Terminal" },
];

export const Component = ({ children }: { children?: ComponentChildren }) => {
    const pathname = usePathname();
    const { data } = useLoader<AdminLayoutData>();

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
    };

    return (
        <div class={css.shell}>
            <aside class={css.sidebar}>
                <div class={css.logo}>Quadlet Manager</div>
                <nav class={css.nav}>
                    {navItems.map((item) => {
                        const isActive =
                            item.path === "/"
                                ? pathname === "/"
                                : pathname.startsWith(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                class={`${css.navLink} ${isActive ? css.navLinkActive : ""}`}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>
                <div class={css.sidebarFooter}>
                    <div class={css.userInfo}>
                        <span class={css.username}>{data.value?.username}</span>
                        {data.value?.hasSudo && (
                            <span class={css.sudoBadge}>sudo</span>
                        )}
                    </div>
                    <ThemeToggle />
                    <button class={css.logoutButton} onClick={handleLogout}>
                        Sign out
                    </button>
                </div>
            </aside>
            <main class={css.main}>{children}</main>
            <ToastContainer />
            <ConfirmDialog />
        </div>
    );
};
