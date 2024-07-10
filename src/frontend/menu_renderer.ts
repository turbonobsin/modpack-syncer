import "../styles/index.css";
import { MP_Div } from "./menu_parts";

console.log("menu is loaded");

window.gAPI.onInitMenu((...args)=>{
    console.log("ON INIT",...args);
});

const main = document.querySelector("main");
initPage();

async function initPage(){
    if(!main) return;

    console.log("loading");

    const root = new MP_Div({
        overrideDiv:main
    });
    
    root.addPart(new MP_Div({
        textContent:"This is a generated div!"
    }));

    console.log(root);
}