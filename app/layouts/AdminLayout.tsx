import type { ComponentChildren } from "preact";
import { useCallback } from "preact/hooks";
import { Link } from "velojs";
import { usePathname } from "velojs/hooks";
import { darkTheme, lightTheme } from "../styles/theme.css.js";
import * as css from "./AdminLayout.css.js";

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
];

export const Component = ({ children }: { children?: ComponentChildren }) => {
    const pathname = usePathname();

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
                    <ThemeToggle />
                </div>
            </aside>
            <main class={css.main}>{children}</main>
        </div>
    );
};
