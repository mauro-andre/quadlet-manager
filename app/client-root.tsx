import type { ComponentChildren } from "preact";
import { Scripts } from "velojs";
import { darkTheme, lightTheme } from "./styles/theme.css.js";

const themeScript = `
(function() {
    var t = localStorage.getItem('theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    document.documentElement.className = t === 'light' ? '${lightTheme}' : '${darkTheme}';
})();
`;

export const Component = ({ children }: { children?: ComponentChildren }) => {
    return (
        <html lang="en" class={darkTheme}>
            <head>
                <meta charset="UTF-8" />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1.0"
                />
                <title>Quadlet Manager</title>
                <script dangerouslySetInnerHTML={{ __html: themeScript }} />
                <Scripts />
            </head>
            <body>{children}</body>
        </html>
    );
};
