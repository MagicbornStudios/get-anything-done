import "iconify-icon";
import "./styles.css";
import { mount } from "./scenes/router";

const root = document.getElementById("app");
if (!root) throw new Error("No #app root element");
mount(root);
