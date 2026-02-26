import { defineConfig } from "vite";
import { veloPlugin } from "velojs/vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";

export default defineConfig({
    plugins: [veloPlugin(), vanillaExtractPlugin({ identifiers: "debug" })],
});
