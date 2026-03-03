import { TerminalView } from "../components/Terminal.js";
import * as css from "../components/Terminal.css.js";

export const Component = () => {
    return (
        <div class={css.terminalPage}>
            <h1>Terminal</h1>
            <TerminalView wsUrl="/api/terminal?type=host" />
        </div>
    );
};
