import "../render_lib";
import "../render_util";
import { AddWorld_InitData, ServerWorld, WorldInfo, WorldMeta } from "../interface";
import { MP_SearchStructure, qElm } from "../render_lib";
import { getImageURL, getWorldStateText, InitData, loadDefaultAside, searchStringCompare } from "../render_util";
import { makeDivPart, MP_Article, MP_Aside, MP_Button, MP_Div, MP_Flexbox, MP_Grid, MP_Header, MP_HR, MP_Img, MP_P, MP_TD, MP_Text } from "../menu_parts";
import "../styles/menus_custom.css";

console.log("loaded page");

let initData = new InitData<AddWorld_InitData>(init);
let body = makeDivPart("body");
let main = body.addPart(new MP_Grid({
    className:"root",
    template_columns:"1fr auto",
    gap:"15px",
    margin:"0px"
}));
const aside = new MP_Aside({});

function createItem(data:ServerWorld){
    return new MP_Article({
        className:"instance-item"
    }).addParts(
        new MP_Header({
            textContent:data.wID
        }),
        new MP_Div({
            className:"details"
        }).addParts(

        )
    );
}

async function showData(data:ServerWorld,aside:MP_Div){
    const {head,body,footer} = loadDefaultAside(aside,{title:""});

    let wID = data.wID;
    
    new MP_Header({}).addParts(
        new MP_Flexbox({
            justifyContent:"space-between"
        }).addParts(
            new MP_Text({text:data.wID}),
            new MP_Text({
                className:"l-desc",
                text:"Version: "+((data.update ?? 0)/10) // only dividing by 10 to make it more readable and rememberable
            }),
        ),
        new MP_P({
            className:"l-desc",
            text:"Publisher: "+data.publisherName,
            marginBottom:"0px"
        }),
        new MP_P({
            className:"l-desc accent-text",
            text:"Current Owner: "+data.ownerName,
            marginTop:"0px"
        }),
        new MP_P({ 
            className:"l-desc",
            text:"State: ",
        }).addParts(
            new MP_Text({
                text:getWorldStateText(data.state,undefined,""),
            }).onPostLoad(p=>{
                p.e!.style.textTransform = "uppercase";
                p.e!.style.fontWeight = "bold";
                // if(w.state == "inUse") p.e!.style.fontWeight = "bold";
                // else p.e!.classList.add("accent-text");
            })
        ),
    ).addTo(head);

    {
        head.e!.style.height = "unset";
        // head.parts[0].addPart(
        //     new MP_P({
        //         text:"Pack format: "+data.data.meta?.pack.pack_format ?? "(none found)",
        //         className:"l-details"
        //     })
        // );
        head.addParts(
            new MP_Flexbox({
                justifyContent:"space-between",
                alignItems:"center",
                marginBottom:"20px"
            }).addParts(
                new MP_Button({
                    // skipAdd:d.data?.sync != null,
                    label:"Download",
                    icon:"download",
                    className:"accent",
                    onClick:(e,elm)=>{
                        window.gAPI.downloadWorld({iid:initData.d.iid,wID,forceAllFiles:true});
                    }
                }),//
                new MP_Button({
                    label:"Take Ownership",
                    onClick:(e,elm)=>{
                        window.gAPI.takeWorldOwnership({iid:initData.d.iid,wID,uid:"",uname:""});
                    }
                }),
                // new MP_Button({
                //     // skipAdd:d.data?.sync == null,
                //     skipAdd:true,
                //     label:"Sync",
                //     icon:"sync_alt",
                //     onClick:(e,elm)=>{

                //     }
                // })
            )
        );
        body.addParts(            
            new MP_Img({
                src:await window.gAPI.getWorldImg(initData.d.iid,wID),
                width:"50%"
            }).autoJustify("start","center")
        );
    }
}

const search = new MP_SearchStructure<ServerWorld>({
    listId:"instance",
    customListFormat:"view-list2",
    submitOnOpen:true,
    margin:"15px",
    onSelect:(data,item)=>{
        showData(data,aside);

        for(const sel of search.sel.items){
            
        }
    },
    onSubmit:async (t,e,q)=>{      
        let d = await window.gAPI.getServerWorlds({iid:initData.d.iid});
        if(!d) return;
        search.sel.clear();

        for(const item of d.list){
            // let rpID = item.data?.sync?.rpID;
            let wID = item.wID;

            if(q) if(!searchStringCompare(wID,q)) continue;

            // let part = createItem(item);
            let content = new MP_Div({
                className:"mod-row-content"
            }).addParts(
                new MP_Text({text:wID}),
            );
            
            let part = new MP_Flexbox({
                alignItems:"center",
                classList:["mod-row"],
                gap:"5px"
            }).addParts(
                new MP_Img({
                    src:await window.gAPI.getWorldImg(initData.d.iid,wID),
                    className:"_loaded",
                    minWidth:"25px",
                    minHeight:"25px",
                    width:"25px",
                    height:"25px",
                }),
                content
            );
            search.list.addPart(part);

            search.registerSelItem(item,content.e);
        }
    }
});

async function init(){    
    main.addPart(search);
    main.addPart(aside);
}