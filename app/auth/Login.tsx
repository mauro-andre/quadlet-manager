import type { ActionArgs } from "velojs";
import { useSignal } from "@preact/signals";
import * as css from "./Login.css.js";

export const action_login = async ({ body, c }: ActionArgs<{ username: string; password: string }>) => {
    const { authenticate, createToken } = await import(
        "../modules/auth/auth.service.js"
    );
    const { setCookie } = await import("velojs/cookie");

    const user = await authenticate(body.username, body.password);
    const token = await createToken(user);

    setCookie(c!, "session", token, {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        path: "/",
        maxAge: 86400,
    });

    return { ok: true };
};

export const Component = () => {
    const username = useSignal("");
    const password = useSignal("");
    const error = useSignal("");
    const loading = useSignal(false);

    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        error.value = "";
        loading.value = true;

        try {
            const result = await action_login({
                body: {
                    username: username.value,
                    password: password.value,
                },
            }) as { ok?: boolean; error?: string };

            if (result.error) {
                error.value = result.error;
            } else {
                window.location.href = "/";
            }
        } catch {
            error.value = "Invalid username or password";
        } finally {
            loading.value = false;
        }
    };

    return (
        <div class={css.card}>
            <div class={css.title}>Quadlet Manager</div>
            <div class={css.subtitle}>Sign in with your system credentials</div>

            <form class={css.form} onSubmit={handleSubmit}>
                {error.value && <div class={css.error}>{error.value}</div>}

                <div class={css.field}>
                    <label class={css.label}>Username</label>
                    <input
                        class={css.input}
                        type="text"
                        autocomplete="username"
                        value={username.value}
                        onInput={(e) => {
                            username.value = (e.target as HTMLInputElement).value;
                        }}
                    />
                </div>

                <div class={css.field}>
                    <label class={css.label}>Password</label>
                    <input
                        class={css.input}
                        type="password"
                        autocomplete="current-password"
                        value={password.value}
                        onInput={(e) => {
                            password.value = (e.target as HTMLInputElement).value;
                        }}
                    />
                </div>

                <button
                    class={css.submitButton}
                    type="submit"
                    disabled={loading.value}
                >
                    {loading.value ? "Signing in..." : "Sign in"}
                </button>
            </form>
        </div>
    );
};
