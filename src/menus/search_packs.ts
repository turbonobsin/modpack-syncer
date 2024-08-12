import "../render_lib";
import "../styles/search_packs_menu.css";
import { MenuPart, MP_Any, MP_Article, MP_Div, MP_Flexbox, MP_Header, MP_Ops, MP_P, MP_SearchForm, MP_Text, MP_Text_Ops } from "../menu_parts";
import { PackMetaData } from "../../src/interface";
import { loadModPackMetaPanel, reselectItem as reselectItem, SelectedItem, selectItem, SelectedItemOptions, getImageURL } from "../render_util";
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
        this.e.style.display = "grid";
        this.e.style.gridTemplateColumns = "auto 1fr";
        
        let data = this.ops.data;

        this.addParts(
            new MP_Flexbox({
                width:"80px",
                height:"80px",
                justifyContent:"center",
                alignItems:"center"
            }).addParts(
                new MP_Div({}).onPostLoad(p=>{
                    let src = data.img ?? "";
                    p.e!.style.backgroundImage = `url(${src})`;
                    p.e!.style.backgroundSize = "contain";
                    p.e!.style.width = "100%";
                    p.e!.style.height = "100%";
                    p.e!.style.backgroundPosition = "center";
                    p.e!.style.margin = "10px";
                    p.e!.style.backgroundRepeat = "no-repeat";

                    let img = document.createElement("img");
                    img.src = src;
                    img.onload = ()=>{
                        if(img.width <= 32 || img.height <= 32) p.e!.style.imageRendering = "pixelated";
                    };
                })
            ),
            new MP_Flexbox({
                direction:"column",
                margin:"10px",
                marginLeft:"0px"
            }).addParts(
                new MP_Header({

                }).addParts(
                    new MP_Flexbox({
                        justifyContent:"space-between",
                    }).addParts(
                        new MP_Div({
                            text:data.name,
                            className:"l-title"
                        }),
                        new MP_Div({
                            text: "",
                            className: "l-version"
                        }).addParts(
                            new MP_Text({
                                text: data.version,
                                marginRight:"5px"
                            }),
                            // new MP_Text({ text: data.meta.loader.toWel })
                            new MP_Div({
                                text:data.loader,
                                className:"l-loader",
                            }).onPostLoad(p=>{
                                p.e!.style.display = "inline-block";
                            })
                        ),
                    )
                ),
                new MP_Div({
                    className:"details l-desc",
                    text:data.desc
                })
            )
        );

        if(false) this.addParts(
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
        // listId:"instance",
        listId:"full-inst",
        onSubmit:async (t,e,q)=>{
            if(!search) return;
            if(!search.list) return;
     
            let res = await window.gAPI.searchPacksMeta({
                query:q,
                uid:"",
                uname:"",
            });
            if(!res) return;
            console.log("RES:",res);
            for(const m of res.similar){
                let p = search.list.addPart(
                    new CMP_Result({
                        data:m,
                        marginBottom:"5px"
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