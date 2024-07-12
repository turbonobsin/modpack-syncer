import "./lib_submenu";
import "../render_util";
import { MP_Article, MP_Div, MP_Flexbox, MP_Header, MP_HR, MP_P, MP_Section } from "../frontend/menu_parts";
import { SelectedItem, selectItem } from "../render_util";
import { PrismInstance } from "src/interface";

// const instanceGridItems = document.querySelector(".instance-grid-items");
// const instList = new MP_Div({overrideDiv:document.querySelector<HTMLElement>(".inst-list")??undefined});
const instList = new MP_Div({overrideDiv:document.querySelector<HTMLElement>(".instance-grid-items")??undefined});

function formatTime(time:number){
    let t = time;
    // return t.toFixed(1); // hours
    return t;
}

const selInst = new SelectedItem<PrismInstance>({
    onSelect:(data,item)=>{

    }
});

async function initPage(){
    let res = await window.gAPI.getPrismInstances({});
    console.log("inst:",res);
    if(!res) return;

    let groups:Record<string,MP_Div> = {};

    for(const inst of res.list){
        let part = new MP_Article({
            className:"instance-item"
        }).addParts(
            new MP_Header({
                textContent:inst.name
            }),
            new MP_Div({
                className:"details"
            }).addParts(
                new MP_P({
                    text:inst.group
                }),
                new MP_HR(),
                new MP_Flexbox({alignItems:"center",justifyContent:"space-between",className:"l-version"}).addParts(
                    new MP_P({
                        text:inst.version,
                    }),
                    new MP_P({
                        text:inst.loader,
                    }),
                    new MP_P({
                        text:inst.loaderVersion,
                    })
                )
            )
        );
        if(groups[inst.group]) groups[inst.group].parts[1].addPart(part);
        else{
            let gg = new MP_Section().addParts(
                new MP_P({text:inst.group}),
                new MP_Div({className:"sub-list"}),
            );
            groups[inst.group] = gg;
            instList.addPart(gg);
            gg.parts[1].addPart(part);
        }

        part.e?.addEventListener("click",e=>{
            if(!part.e) return;
            selectItem(selInst,inst,part.e);
        });
    }

    
}
initPage();

//5,449