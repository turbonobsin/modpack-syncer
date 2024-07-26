import "../render_lib";
import "../render_util";
import { AddRP_InitData } from "../interface";
import { MP_SearchStructure, qElm } from "../render_lib";
import { getImageURL, InitData, loadDefaultAside, searchStringCompare } from "../render_util";
import { makeDivPart, MP_Article, MP_Aside, MP_Div, MP_Flexbox, MP_Grid, MP_Header, MP_HR, MP_Img, MP_P, MP_TD, MP_Text } from "../menu_parts";
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

type Data = {
    rpID: string;
    desc: string;
    pack_format: number;
};

function createItem(data:Data){
    return new MP_Article({
        className:"instance-item"
    }).addParts(
        new MP_Header({
            textContent:data.rpID
        }),
        new MP_Div({
            className:"details"
        }).addParts(
            new MP_P({
                text:`Pack Format: ${data.pack_format}`
            }),
            new MP_HR(),
            new MP_P({
                text:data.desc
            })
        )
    );
}

const search = new MP_SearchStructure<Data>({
    listId:"instance",
    customListFormat:"view-list2",
    submitOnOpen:true,
    margin:"15px",
    onSelect:(data,item)=>{
        let {body,footer,head} = loadDefaultAside(aside,{
            title:""
        });

        for(const sel of search.sel.items){
            
        }
    },
    onSubmit:async (t,e,q)=>{      
        let d = await window.gAPI.getRPs({iid:initData.d.iid});
        if(!d) return;
        search.sel.clear();

        for(const item of d.list){
            if(q) if(!searchStringCompare(item.rpID,q)) continue;

            // let part = createItem(item);
            let content = new MP_Div({
                className:"mod-row-content"
            }).addParts(
                new MP_Text({text:item.rpID}),
                new MP_Text({
                    text:"Format: "+item.pack_format.toString(),
                    marginLeft:"auto"
                })
            );
            
            let part = new MP_Flexbox({
                alignItems:"center",
                classList:["mod-row"],
                gap:"5px"
            }).addParts(
                new MP_Img({
                    src:await window.gAPI.getRPImg(initData.d.iid,item.rpID),
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