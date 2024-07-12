import "../styles/index.css";
import "../styles/home.css";
import "../styles/menus.css";
import { MP_Div } from "../frontend/menu_parts";

const overlaysCont = new MP_Div({
    overrideDiv:document.body
}).addPart(new MP_Div({
    className:"overlays-cont"
}));

const overlaysBack = overlaysCont.addPart(new MP_Div({
    className:"overlays-back"
}));