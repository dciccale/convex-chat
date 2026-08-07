import { defineComponent } from "convex/server";
import presence from "@convex-dev/presence/convex.config.js";

const component = defineComponent("chat");
component.use(presence);

export default component;
