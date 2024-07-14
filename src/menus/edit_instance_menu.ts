import "../render_lib";
import { makeDivPart, MP_ActivityBarItem, MP_Div, MP_TabbedMenu, MP_Text } from "../menu_parts";
import { qElm } from "../render_lib";

const root = makeDivPart(".main");
const tab_menu = new MP_TabbedMenu(
    {},
    {
        style:"left"
    },
    {
        onLoadSection:loadSection
    }
);

function loadSection(index:number,main:MP_Div){
    console.log("load",index,main);
    switch(index){
        case 0:
            main.addPart(new MP_Text({text:"hi 1"}));

            break;
        case 1:
            main.addPart(new MP_Text({text:"hi 222"}));

            break;
    }
}

async function init(){
    root.addPart(tab_menu);

    tab_menu.activityBar.addParts(
        // new MP_ActivityBarItem({ icon:"public" }),
        // new MP_ActivityBarItem({ icon:"outdoor_grill" }),
        new MP_ActivityBarItem({ icon:"inbox_customize" }),
        new MP_ActivityBarItem({ icon:"coffee" }),
        new MP_ActivityBarItem({ icon:"settings" }),
    );

    tab_menu.postSetup();
}
init();