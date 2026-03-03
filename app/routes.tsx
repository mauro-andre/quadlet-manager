import type { AppRoutes } from "velojs";

import * as Root from "./client-root.js";
import * as AuthLayout from "./auth/AuthLayout.js";
import * as Login from "./auth/Login.js";
import { authMiddleware } from "./modules/auth/auth.middleware.js";
import * as AdminLayout from "./layouts/AdminLayout.js";
import * as Dashboard from "./dashboard/Dashboard.js";
import * as ContainerList from "./containers/ContainerList.js";
import * as ContainerDetail from "./containers/ContainerDetail.js";
import * as QuadletList from "./quadlets/QuadletList.js";
import * as QuadletNew from "./quadlets/QuadletNew.js";
import * as QuadletEdit from "./quadlets/QuadletEdit.js";
import * as ImageList from "./images/ImageList.js";
import * as ImageDetail from "./images/ImageDetail.js";
import * as VolumeList from "./volumes/VolumeList.js";
import * as VolumeDetail from "./volumes/VolumeDetail.js";
import * as NetworkList from "./networks/NetworkList.js";
import * as NetworkDetail from "./networks/NetworkDetail.js";
import * as DomainList from "./domains/DomainList.js";
import * as HostTerminal from "./terminal/HostTerminal.js";
import * as ContainerTerminal from "./containers/ContainerTerminal.js";

export default [
    {
        module: Root,
        isRoot: true,
        children: [
            {
                path: "/login",
                module: AuthLayout,
                children: [{ module: Login }],
            },
            {
                module: AdminLayout,
                middlewares: [authMiddleware],
                children: [
                    { path: "/", module: Dashboard },
                    { path: "/containers", module: ContainerList },
                    { path: "/containers/:id", module: ContainerDetail },
                    { path: "/quadlets", module: QuadletList },
                    { path: "/quadlets/new", module: QuadletNew },
                    { path: "/quadlets/:name", module: QuadletEdit },
                    { path: "/images", module: ImageList },
                    { path: "/images/:id", module: ImageDetail },
                    { path: "/volumes", module: VolumeList },
                    { path: "/volumes/:name", module: VolumeDetail },
                    { path: "/networks", module: NetworkList },
                    { path: "/networks/:name", module: NetworkDetail },
                    { path: "/domains", module: DomainList },
                    { path: "/terminal", module: HostTerminal },
                    { path: "/containers/:id/terminal", module: ContainerTerminal },
                ],
            },
        ],
    },
] satisfies AppRoutes;
