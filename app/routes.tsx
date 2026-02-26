import type { AppRoutes } from "velojs";

import * as Root from "./client-root.js";
import * as Dashboard from "./dashboard/Dashboard.js";
import * as ContainerList from "./containers/ContainerList.js";
import * as ContainerDetail from "./containers/ContainerDetail.js";
import * as QuadletList from "./quadlets/QuadletList.js";
import * as QuadletNew from "./quadlets/QuadletNew.js";
import * as QuadletEdit from "./quadlets/QuadletEdit.js";

export default [
    {
        module: Root,
        isRoot: true,
        children: [
            { path: "/", module: Dashboard },
            { path: "/containers", module: ContainerList },
            { path: "/containers/:id", module: ContainerDetail },
            { path: "/quadlets", module: QuadletList },
            { path: "/quadlets/new", module: QuadletNew },
            { path: "/quadlets/:name", module: QuadletEdit },
        ],
    },
] satisfies AppRoutes;
