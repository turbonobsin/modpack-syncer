import "../render_lib";
import "../render_util";
import "../styles/prism_instances.css";
import "../styles/search_packs_menu.css";
import { MP_Article, MP_Button, MP_Div, MP_Flexbox, MP_Header, MP_HR, MP_OutlinedBox, MP_P, MP_Section, MP_Text, PartTextStyle } from "../menu_parts";
import { InitData, loadDefaultAside, SelectedItem, selectItem } from "../render_util";
import { Data_PrismInstancesMenu, InitMenuData, PrismInstance } from "src/interface";
import { MP_SearchStructure, qElm } from "../render_lib";

let hasLoadedPage = false;

const mainSection = new MP_Div({overrideDiv:qElm(".main-section")});
const aside = new MP_Div({overrideDiv:qElm("aside")});

// window.gAPI.onInitMenu((data:InitMenuData<Data_PrismInstancesMenu>)=>{
//     console.log("INIT DATA:",data);
//     sessionStorage.setItem("initData",JSON.stringify(data));
//     pageData = data.data;

//     initPage();
// });

// setTimeout(()=>{
//     if(hasLoadedPage) return;

//     let cache = sessionStorage.getItem("initData");
//     if(cache){
//         pageData = JSON.parse(cache).data;
//         initPage();
//     }
// },1000);

let initData = new InitData<Data_PrismInstancesMenu>(initPage);

async function initPage(){
    hasLoadedPage = true;
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

            console.log("reason:",initData.d);
            if(initData.d.reason == "view"){

            }
            else if(initData.d.reason == "link"){
                a.body.addParts(
                    new MP_HR(),
                    new MP_OutlinedBox({
                        direction:"column",
                        paddingBottom:"15px"
                    }).addParts(
                        new MP_P({
                            style:PartTextStyle.note,
                            innerHTML:`Link <span class="textstyle-accent">${initData.d.instName}</span> with <span class="textstyle-accent">${data.name}</span>?`
                        }),
                        new MP_Button({
                            label:"Link",
                            icon:"link",
                            onClick:async e=>{
                                await window.gAPI.linkInstance(initData.d.iid,data.name);
                                window.close();
                            }
                        })
                    )
                    // new MP_Section().addParts(
                    //     new MP_Button({
                    //         label:"Link to this Instance",
                    //         onclick:e=>{
                                
                    //         }
                    //     })
                    // )
                );
            }
        },
        onSubmit:async (t,e,q)=>{
            if(!search.list) return;
            // search.list.clearParts();
            // mainSection.clearParts();
            // mainSection.addPart(search);
            
            let res = await window.gAPI.getPrismInstances({query:q});
            console.log("inst:",q,res);
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

                // part.e?.addEventListener("click",e=>{
                //     if(!part.e) return;
                //     selectItem(search.selected,inst,part.e);
                // });
                search.registerSelItem(inst,part.e);
            }
        }
    })

    mainSection.addPart(search);
    await search.submit();
}