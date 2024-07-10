import { MenuPart, MP_Any, MP_Article, MP_Div, MP_Header, MP_Ops, MP_P, MP_SearchForm, MP_Text, MP_Text_Ops } from "../frontend/menu_parts";
import "../styles/index.css";
import "../styles/home.css";
import "../styles/menus.css";
import { PackMetaData } from "../../src/interface";
import { loadModPackMetaPanel } from "../../src/render_util";

const main = document.querySelector("main");
const aside = document.querySelector("aside");

interface CMP_Result_Ops extends MP_Ops{
    data:PackMetaData;
}

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
                    // text:(()=>{
                    //     let desc = data.desc;
                    
                    //     let tmp = document.createElement("span");
                    //     tmp.style.whiteSpace = "nowrap";
                    //     tmp.style.fontSize = "12px";
                    //     tmp.textContent = desc;
                    //     // let w = tmp.getBoundingClientRect();
                    //     document.body.appendChild(tmp);
                    //     let w = tmp.offsetWidth;
                    //     tmp.remove();
                        
                    //     // let w = _tmpCtx?.measureText(desc).width;
                    //     let maxWidth = 190;
                    //     let ratio = maxWidth/w;
                    //     if(w > maxWidth) desc = desc.substring(0,Math.floor(desc.length*ratio));
                        
                    //     return desc;
                    // })(),
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

        this.e.addEventListener("click",e=>{
            if(!this.e) return;
            let wasActive = this.e.classList.contains("active");
            
            let allActive = this.e.parentElement?.querySelectorAll(".active");
            if(allActive) for(const elm of allActive) elm.classList.remove("active");
            if(wasActive){
                if(aside) aside.textContent = "";
                return;
            }

            this.e.classList.add("active");
            loadModPackMetaPanel(this.ops.data,aside);
        });
    }
}

async function initPage(){
    if(!main) return;
    if(!aside) return;
    
    async function submitSearchPacks(q?:string){
        instanceGridItems.clearParts();
                
        let res = await window.gAPI.searchPacksMeta({
            query:q
        });
        if(!res) return;
    
        for(const m of res.similar){
            let p = instanceGridItems.addPart(
                new CMP_Result({
                    data:m
                })
            ) as CMP_Result;
        }
    }

    const root = new MP_Div({
        overrideDiv:main,
        classList:["root"]
    });
    console.log(root);

    root.addPart(new MP_P({
        text:"Search Packs"
    }));

    let searchForm = new MP_SearchForm({
        onsubmit:(e,q)=>{
            submitSearchPacks(q);
        }
    });
    console.log(searchForm.inp);
    
    let mainCont = root.addPart(new MP_Div({classList:["main-options"]}));
    mainCont.addParts(
        new MP_Text({
            text:""
        }),
        searchForm
    );

    let instanceGrid = root.addPart(new MP_Div({
        classList:["instance-grid"]
    }));
    let instanceGridItems = instanceGrid.addPart(new MP_Div({
        classList:["instance-grid-items"]
    }));
    // instanceGridItems.addParts(
    //     new CMP_Result({})
    // );

    // 

    await submitSearchPacks();

    requestAnimationFrame(()=>{
        console.log(searchForm);
        searchForm.inp?.e?.focus();
    });
}
initPage();