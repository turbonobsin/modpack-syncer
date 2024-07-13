import "./lib_submenu";
import "../render_util";
import "../styles/prism_instances.css";
import { MP_Article, MP_Button, MP_Div, MP_Flexbox, MP_Header, MP_HR, MP_OutlinedBox, MP_P, MP_Section, MP_Text } from "../frontend/menu_parts";
import { loadDefaultAside, SelectedItem, selectItem } from "../render_util";
import { PrismInstance } from "src/interface";
import { MP_SearchStructure, qElm } from "./lib_submenu";

// const instanceGridItems = document.querySelector(".instance-grid-items");
// const instList = new MP_Div({overrideDiv:document.querySelector<HTMLElement>(".inst-list")??undefined});
// const instList = new MP_Div({overrideDiv:document.querySelector<HTMLElement>(".instance-grid-items")??undefined});
const mainSection = new MP_Div({overrideDiv:qElm(".main-section")});
const aside = new MP_Div({overrideDiv:qElm("aside")});

function formatTime(time:number){
    let t = time;
    // return t.toFixed(1); // hours
    return t;
}

window.gAPI.onInitReturnCB(data=>{
    console.log("INIT DATA:",data);
});

async function initPage(){
    if(!mainSection.e) return;
    if(!aside) return;

    // 

    const search = new MP_SearchStructure<PrismInstance>({
        listId:"instance",
        customListFormat:"view-list2",
        onSelect:(data,item)=>{
            let a = loadDefaultAside(aside,{
                title:data.name,
                desc:data.version
            });

            a.body.addParts(
                new MP_OutlinedBox({
                    // justifyContent:"space-between",
                    alignItems:"left",
                    direction:"column",
                    classList:["version-list"]
                }).addParts(
                    new MP_Text({text:"Version: "+data.version}),
                    new MP_Text({text:"Loader: "+data.loader}),
                    new MP_Text({text:"Loader Version: "+data.loaderVersion}),
                )
            );

            a.body.addParts(
                new MP_HR(),
                new MP_Section().addParts(
                    new MP_Button({
                        label:"Select",
                        onclick:e=>{

                        }
                    })
                )
            );
        },
        onSubmit:async (t,e,q)=>{
            if(!search.list) return;
            
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
                    search.list.addPart(gg);
                    gg.parts[1].addPart(part);
                }

                part.e?.addEventListener("click",e=>{
                    if(!part.e) return;
                    selectItem(search.selected,inst,part.e);
                });
            }
        }
    })

    mainSection.addPart(search);
    await search.submit();
}
initPage();

//5,449