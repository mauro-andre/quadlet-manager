import { createMiddleware } from "velojs/factory";
import { getCookie } from "velojs/cookie";

function isApiRoute(path: string): boolean {
    return path.startsWith("/api/");
}

export const authMiddleware = createMiddleware(async (c, next) => {
    const token = getCookie(c, "session");

    if (!token) {
        if (isApiRoute(c.req.path)) {
            return c.json({ error: "Unauthorized" }, 401);
        }
        if (c.req.method === "GET") {
            return c.redirect("/login");
        }
        return c.json({ error: "Unauthorized" }, 401);
    }

    try {
        const { verifyToken } = await import("./auth.service.js");
        const user = await verifyToken(token);
        c.set("user", user);
    } catch {
        if (isApiRoute(c.req.path)) {
            return c.json({ error: "Unauthorized" }, 401);
        }
        if (c.req.method === "GET") {
            return c.redirect("/login");
        }
        return c.json({ error: "Unauthorized" }, 401);
    }

    await next();
});
