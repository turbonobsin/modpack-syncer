import "../render_lib";
import "../styles/search_packs_menu.css";
import { MenuPart, MP_Any, MP_Article, MP_Div, MP_Header, MP_Ops, MP_P, MP_SearchForm, MP_Text, MP_Text_Ops } from "../menu_parts";
import { PackMetaData } from "../../src/interface";
import { loadModPackMetaPanel, reselectItem as reselectItem, SelectedItem, selectItem, SelectedItemOptions } from "../render_util";
import { MP_SearchStructure } from "../render_lib";

const main = document.querySelector("main");
const aside = document.querySelector("aside");

interface CMP_Result_Ops extends MP_Ops{
    data:PackMetaData;
}

let search:MP_SearchStructure<PackMetaData>|undefined;

/**
 * Custom Menu Part - Result
 */
class CMP_Result extends MP_Article{
    constructor(ops:CMP_Result_Ops){
        if(!ops.classList) ops.classList = [];
        ops.classList.push("instance-item");
        super(ops);
    }
    declare ops:CMP_Result_Ops;
    
    load(): void {
        super.load();
        if(!this.e) return;
        
        let data = this.ops.data;

        this.addParts(
            new MP_Header({
                textContent:data.name,
                className:"l-title"
            }),
            new MP_Div({
                classList:["details"]
            }).addParts(
                new MP_P({
                    text:"",
                    classList:["l-version"]
                }).addParts(
                    new MP_Text({text:data.version}),
                    new MP_Text({text:data.loader}),
                ),
                new MP_P({
                    text:data.desc,
                    classList:["l-desc"]
                }).onPostLoad(p=>{
                    if(!p.e) return;

                    let tmp = document.createElement("span");
                    tmp.style.whiteSpace = "nowrap";
                    tmp.style.fontSize = "12px";
                    tmp.textContent = p.e?.textContent ?? null;
                    
                    document.body.appendChild(tmp);
                    let w = tmp.offsetWidth;
                    tmp.remove();

                    let maxWidth = 178.4*2;
                    if(w > maxWidth){
                        p.e.classList.add("overflow");
                    }
                })
            )
        );

        search?.registerSelItem(this.ops.data,this.e);
        // this.e.addEventListener("click",e=>{
        //     if(!this.e) return;
        //     if(!search) return;
        //     selectItem(search?.selected,this.ops.data,this.e);
        // });
    }
}

async function initPage(){
    if(!main) return;
    if(!aside) return;
    
    // async function submitSearchPacks(q?:string){
    //     instanceGridItems.clearParts();
                
    //     let res = await window.gAPI.searchPacksMeta({
    //         query:q
    //     });
    //     if(!res) return;
    
    //     for(const m of res.similar){
    //         let p = instanceGridItems.addPart(
    //             new CMP_Result({
    //                 data:m
    //             })
    //         ) as CMP_Result;
    //     }

    //     reselectItem(selectedPack);
    // }

    const root = new MP_Div({
        overrideDiv:main,
        classList:["root"]
    });
    console.log(root);

    root.addPart(new MP_P({
        text:"Search Packs"
    }));

    search = new MP_SearchStructure({
        listId:"instance",
        onSubmit:async (t,e,q)=>{
            if(!search) return;
            if(!search.list) return;
     
            let res = await window.gAPI.searchPacksMeta({
                query:q
            });
            if(!res) return;
            for(const m of res.similar){
                let p = search.list.addPart(
                    new CMP_Result({
                        data:m
                    })
                ) as CMP_Result;
            }
        },
        onSelect:(data,item)=>{
            loadModPackMetaPanel(data,aside);
        }
    });
    root.addPart(search);
    
    // let searchForm = new MP_SearchForm({
    //     onsubmit:(e,q)=>{
    //         submitSearchPacks(q);
    //     }
    // });
    // console.log(searchForm.inp);
    
    // let mainCont = root.addPart(new MP_Div({classList:["main-options"]}));
    // mainCont.addParts(
    //     new MP_Text({
    //         text:""
    //     }),
    //     searchForm
    // );

    // let instanceGrid = root.addPart(new MP_Div({
    //     classList:["instance-grid"]
    // }));
    // let instanceGridItems = instanceGrid.addPart(new MP_Div({
    //     classList:["instance-grid-items"]
    // }));

    // 

    // await submitSearchPacks();

    await search.form?.submit();

    requestAnimationFrame(()=>{
        if(!search) return;
        // searchForm.inp?.e?.focus();
        search.i_search?.focus();
    });
}
initPage();