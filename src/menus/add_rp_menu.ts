import "../render_lib";
import "../render_util";
import { AddRP_InitData, RP_Data } from "../interface";
import { MP_SearchStructure, qElm } from "../render_lib";
import { getImageURL, InitData, loadDefaultAside, parseDescription, searchStringCompare, wait } from "../render_util";
import { makeDivPart, MP_Article, MP_Aside, MP_Button, MP_Div, MP_Flexbox, MP_Grid, MP_Header, MP_HR, MP_Img, MP_P, MP_TD, MP_Text } from "../menu_parts";
import "../styles/menus_custom.css";

console.log("loaded page");

let initData = new InitData<AddRP_InitData>(init);
let body = makeDivPart("body");
let main = body.addPart(new MP_Grid({
    className:"root",
    template_columns:"1fr auto",
    gap:"15px",
    margin:"0px"
}));
const aside = new MP_Aside({});

function createItem(data:RP_Data){    
    return new MP_Article({
        className:"instance-item"
    }).addParts(
        new MP_Header({
            textContent:data.name
        }),
        new MP_Div({
            className:"details"
        }).addParts(
            new MP_P({
                text:`Pack Format: ${data.data?.sync?.rpID}`
            }),
            new MP_HR(),
            new MP_P({
                text:data.data?.meta?.pack.description
            })
        )
    );
}

async function showData(data:RP_Data,aside:MP_Div){
    let d = data;
    const {head,body,footer} = loadDefaultAside(aside,{title:""});

    let rpID = data.data?.sync?.rpID;
    
    head.addParts(
        new MP_Header({text:d.name}),
        new MP_HR()
    );

    if(!data.data){ // it's currently "packed" as a zip
        body.addParts(
            new MP_P({
                text:"The current Resource Pack is still packed a .zip file.",
                className:"l-details"
            }),
            new MP_P({
                text:"You must unpack it in order to edit or view it's info.",
                className:"l-details"
            }),
            new MP_Button({
                label:"Unpack",
                marginTop:"20px",
                onClick:(e,elm)=>{
                    window.gAPI.unpackRP({iid:initData.d.iid,rpID:data.name});
                }
            }).autoJustify("center","center"),
        );
    }
    else{
        head.e!.style.height = "unset";
        head.parts[0].addPart(
            new MP_P({
                text:"Pack format: "+data.data.meta?.pack.pack_format ?? "(none found)",
                className:"l-details"
            })
        );
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
                        window.gAPI.downloadRP({
                            iid:initData.d.iid,
                            rpID:d.name,
                            mpID:"",
                            lastDownloaded:-1
                        });
                    }
                }),//
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
                src:await window.gAPI.getRPImg(initData.d.iid,rpID!),
                width:"50%"
            }).autoJustify("start","center"),
            new MP_P({
                className:"formatted-text-cont",
                innerHTML:parseDescription(data.data.meta?.pack.description)
            })
        );
    }
}

const search = new MP_SearchStructure<RP_Data>({
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
        let d = await window.gAPI.getRPs({iid:initData.d.iid});
        if(!d) return;
        search.sel.clear();

        for(const item of d.list){
            let rpID = item.data?.sync?.rpID;

            if(q) if(!searchStringCompare(rpID,q)) continue;

            // let part = createItem(item);
            let content = new MP_Div({
                className:"mod-row-content"
            }).addParts(
                new MP_Text({text:rpID}),
                new MP_Text({
                    text:"Format: "+item.data?.meta?.pack.pack_format.toString(),
                    marginLeft:"auto"
                })
            );
            
            let part = new MP_Flexbox({
                alignItems:"center",
                classList:["mod-row"],
                gap:"5px"
            }).addParts(
                new MP_Img({
                    src:await window.gAPI.getRPImg(initData.d.iid,rpID!),
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
    console.log("START");
    main.addPart(search);
    main.addPart(aside);
}