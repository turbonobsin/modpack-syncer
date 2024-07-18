/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

// import { Menu, MenuItem } from "electron";
import { FSTestData } from "./interface";
import "./render_lib";
import "./styles/renderer.css";
import { loadModPackMetaPanel, SelectedItem, selectItem } from "./render_util";
import { InstanceData } from "./db_types";
import { makeDivPart, MP_ActivityBarItem, MP_Article, MP_Button, MP_Div, MP_Flexbox, MP_Header, MP_HR, MP_Ops, MP_OutlinedBox, MP_P, MP_Section, MP_TabbedMenu, MP_Text, PartTextStyle } from "./menu_parts";
import { MP_SearchStructure, qElm } from "./render_lib";

console.log('👋 This message is being logged by "renderer.ts", included via Vite');

const b_test = document.querySelector<HTMLButtonElement>(".b-test");
const b_click = document.querySelector<HTMLButtonElement>(".b-click");
const b_click2 = document.querySelector<HTMLButtonElement>(".b-click2");
const modList = document.querySelector<HTMLDivElement>(".mod-list");
const modTable = document.querySelector<HTMLTableElement>(".mod-table");
// const b_addInstance = document.querySelector<HTMLButtonElement>(".b-add-instance");
const viewPanel = document.querySelector("aside");
const mainSection = new MP_Div({overrideDiv:qElm(".main-section")});

// 

// b_addInstance?.addEventListener("click",e=>{
//     window.gAPI.openMenu("search_packs");
// });

const query = document.querySelector<HTMLFormElement>(".query");
const i_query = document.querySelector<HTMLInputElement>("#i-query");

query?.addEventListener("submit",async e=>{
    e.preventDefault();
    
    // let meta = await getPackMeta(i_query?.value);
    // if(!meta){
    //     return;
    // }

    let res = await window.gAPI.searchPacks({
        query:i_query?.value
    });
    console.log("RES:",res);
    if(!res) return;
    
    // query.reset();
});

b_test?.addEventListener("click",async e=>{
    let val = i_query?.value;    
    await getPackMeta(val);
});

async function getPackMeta(id?:string){
    let res = await window.gAPI.getPackMeta(id);
    if(!res) window.gAPI.alert("Unknown error");
    else if(res.err) window.gAPI.alert(res.err);
    else console.log("META:",res.data);
    (document.activeElement as HTMLInputElement)?.focus();

    return res?.data;
}

b_click?.addEventListener("click",async e=>{    
    let data = await window.gAPI.fsTest(localStorage.getItem("instancePath") ?? undefined);
    console.log("click1 data",data);

    await loadData(data);
});
b_click2?.addEventListener("click",async e=>{
    console.log("before");
    let data = await window.gAPI.fsTest();
    console.log("after");
    
    console.log("DATA",data);
    if(!data) return;
    
    localStorage.setItem("instancePath",data.instancePath);

    await loadData(data);
});

type TableOptions = {
    header?:{
        label:string
    }[]
};
function initTable(table:HTMLTableElement,options:TableOptions){
    table.innerHTML = "";
    
    if(options.header){
        const headerTr = document.createElement("tr");
        
        for(const headerItem of options.header){
            let th = document.createElement("th");
            th.textContent = headerItem.label;
        }
        
        table.appendChild(headerTr);
    }
}

// const modItemMenu = new Menu();
// const modItemMenuItem = new MenuItem({
//     label:"Test 1",
//     click:()=>{
//         alert("hi");
//     }
// });
// modItemMenu.append(modItemMenuItem);

class SelectionAPI{
    constructor(){
        this.items = [];
    }

    items:SelectionItem[];

    add(sel:SelectionItem){
        this.items.push(sel);
        return sel;
    }
    remove(sel:SelectionItem){
        let ind = this.items.indexOf(sel);
        if(ind != -1) this.items.splice(ind,1);
    }
    clear(){
        this.items = [];
    }

    // 
    deselectAll(){
        for(const item of this.items){
            item.setSelection(false);
        }
    }
    select(item:SelectionItem,v:boolean){
        this.deselectAll();
        item.setSelection(v);
    }
}
class SelectionItem{
    constructor(api:SelectionAPI,elm:HTMLElement,selected=false){
        this.api = api;
        this.elm = elm;
        this.selected = selected;

        api.add(this);
        this.init();
    }
    api:SelectionAPI;
    elm:HTMLElement;
    selected:boolean;

    init(){
        this.elm.addEventListener("click",e=>{
            if(e.ctrlKey) this.setSelection(!this.selected);
            else this.api.select(this,!this.selected);
        });
    }

    setSelection(v:boolean){
        this.elm.classList.toggle("selected",v);
        this.selected = v;
    }
}
class TableSelection{
    constructor(){
        this.items = [];
    }

    items:{
        name:string,
        tr:HTMLTableRowElement
    }[];
}
const selAPI = new SelectionAPI();

// const selectedInst = new SelectedItem<CMP_FullInst>({
//     onSelect:(data,item)=>{
//         localStorage.setItem("selected_modpack",data.ops.data.iid);
//         data.showData();
//     },
//     onDeselect:(data,item)=>{
//         localStorage.removeItem("selected_modpack");
//     }
// })

interface CMP_FullInst_Ops extends MP_Ops {
    data: InstanceData;
}
/**
 * Custom Menu Part - Result
 */
export class CMP_FullInst extends MP_Article {
    constructor(ops: CMP_FullInst_Ops) {
        if (!ops.classList) ops.classList = [];
        ops.classList.push("instance-item");
        super(ops);
    }
    declare ops: CMP_FullInst_Ops;

    canLaunch(){
        let inst = this.ops.data;
        if(inst.linkName == undefined) return false;
        
        return true;
    }
    showData(panel?:HTMLElement|null){
        if(!panel) panel = viewPanel;
        if(!panel) return;
        let inst = this.ops.data;
        let meta = inst.meta;
        
        let root = new MP_Div({
            overrideDiv:panel
        });
        root.clearParts();
    
        let head = root.addPart(new MP_Div({className:"info-head"}));
        let body = root.addPart(new MP_Div({className:"info-body"}));
        // let footer = root.addPart(new MP_Div({className:"info-footer"}));
    
        head.addParts(
            new MP_Header({
                textContent:meta.name
            }),
            new MP_Div({
                className:"info-details"
            }).addParts(
                new MP_Text({
                    text:meta.version,
                    className:"l-version"
                }),
                new MP_Text({
                    text:meta.loader,
                    className:"l-loader"
                })
            )
        );
    
        body.addParts(
            new MP_P({
                text:meta.desc,
                className:"l-desc"
            }),
            new MP_OutlinedBox({
                skipAdd:inst.linkName != undefined,
            }).addParts(
                new MP_P({
                    text:"This instance is not yet linked to a Prism Instance.",
                    style:PartTextStyle.note
                }),
                new MP_Button({
                    label:"Link",
                    icon:"link",
                    onClick:async e=>{
                        // window.gAPI.openMenu("prism_instances");
                        
                        let res = await window.gAPI.showLinkInstance(inst.iid,inst.customName??inst.meta.name);
                        console.log("RES:",res);
                    },
                }),
            ).wrapWith(new MP_Section()),

            new MP_HR(),

            new MP_Section().addParts(
                new MP_Flexbox({
                    alignItems:"center",
                    justifyContent:"space-between"
                }).addParts(
                    new MP_Button({
                        label:"Launch",
                        className:"b-inst-launch",
                        disabled:!this.canLaunch(),
                        onClick:async e=>{
                            window.gAPI.launchInstance(inst.iid);
                            // let res = await window.gAPI.addInstance(meta);
                            // console.log("RES:",res);
                        }
                    }),
                    new MP_Button({
                        label:"Edit",
                        onClick:e=>{
                            window.gAPI.showEditInstance(inst.iid);
                        }
                    }),
                )
            )
        );
        // footer.addParts(
        //     new MP_Button({
        //         label:"Launch",
        //         className:"b-inst-launch",
        //         onclick:async e=>{
        //             // let res = await window.gAPI.addInstance(meta);
        //             // console.log("RES:",res);
        //         }
        //     })
        // )
    }

    load(): void {
        super.load();
        if (!this.e) return;

        let data = this.ops.data;

        this.addParts(
            new MP_Header({
                textContent: data.meta.name,
                className: "l-title"
            }),
            new MP_Div({
                classList: ["details"]
            }).addParts(
                new MP_P({
                    text: "",
                    classList: ["l-version"]
                }).addParts(
                    new MP_Text({ text: data.meta.version }),
                    new MP_Text({ text: data.meta.loader })
                ),
                new MP_P({
                    text: data.meta.desc,
                    classList: ["l-desc"]
                }).onPostLoad(p => {
                    if (!p.e) return;

                    let tmp = document.createElement("span");
                    tmp.style.whiteSpace = "nowrap";
                    tmp.style.fontSize = "12px";
                    tmp.textContent = p.e?.textContent ?? null;

                    document.body.appendChild(tmp);
                    let w = tmp.offsetWidth;
                    tmp.remove();

                    let maxWidth = 178.4 * 2;
                    if (w > maxWidth) {
                        p.e.classList.add("overflow");
                    }
                })
            )
        );

        // this.e.addEventListener("click", e => {
        //     if (!this.e) return;
        //     selectItem(selectedInst,this,this.e);
        //     // loadModPackMetaPanel(this.ops.data.meta,document.querySelector("aside"));
        //     // selectPack(this.ops.data, this.e);
        // });
    }
}


async function loadData(data:FSTestData){
    if(!modTable) return;

    // data.modList.sort((a,b)=>b.localeCompare(a));

    selAPI.clear();

    initTable(modTable,{
        header:[
            {
                label:""
            },
            {
                label:"Mod Name"
            }
        ]
    });
    
    for(let i = 0; i < data.modList.length; i++){
        let modName = data.modList[i];

        const tr = document.createElement("tr");
        tr.className = "mod-row";

        tr.innerHTML = `
            <td class="index">${i+1}</td>
            <td>${modName}</td>
        `;

        modTable.appendChild(tr);

        new SelectionItem(selAPI,tr,false);
    }
    
    // if(!modList) return;
    // modList.innerHTML = "";
    // for(const modName of data.modList){
    //     let container = document.createElement("div");
    //     container.innerHTML = `
    //         <div>${modName}</div>
    //     `;
    //     modList.appendChild(container);
    // }
}

const search = new MP_SearchStructure<CMP_FullInst>({
    listId:"instance",
    // margin:"15px",
    onSelect:(data,item)=>{
        
    },
    onSubmit:async (t,e,q)=>{
        if(!search.list) return;
        
        let instList = await window.gAPI.getInstances({query:q});
        if(instList){
            for(const inst of instList){
                let part = new CMP_FullInst({
                    data:inst
                });
                search.list.addPart(part);
                if(part.e) part.e.addEventListener("click",e=>{
                    if(!part.e) return;
                    selectItem(search.selected,part,part.e);
                });
            }
        }
        console.log("INST LIST:",instList);
    }
});

function autoSelectLastInstance(){
    let lastSelected = localStorage.getItem("selected_modpack");
    if(lastSelected){
        let part = (search.list.parts as CMP_FullInst[]).find(v=>v.ops.data.iid == lastSelected);
        if(part && part.e) selectItem(search.selected,part,part.e);
        else localStorage.removeItem("selected_modpack");
    }
}

async function loadSection(index:number,menu:MP_TabbedMenu){
    switch(index){
        case 0:{
            search.selected.ops.onSelect = (data,item)=>{
                localStorage.setItem("selected_modpack",data.ops.data.iid);
                data.showData();
            };
            search.selected.ops.onDeselect = ()=>{
                localStorage.removeItem("selected_modpack");
            };
        
            search.mainOptions.addPart(
                new MP_Button({
                    label:"add",
                    className:"b-add-instance icon-cont accent",
                    onClick:e=>{
                        console.log(search.selected.data);
                        if(!search.selected.data) return;
                        // let res = window.gAPI.addInstance(search.selected.data.data.ops.data.meta);
                        // console.log("RES:",res);
                        window.gAPI.openMenu("search_packs");
                    }
                })
            );
        
            menu.main_body.addPart(search);
            await search.submit();
            autoSelectLastInstance();
        } break;

        case 1:{

        } break;
    }
}

async function initPage(){

    let tabbed = new MP_TabbedMenu(
        {},
        {
            style:"left"
        },
        {
            onLoadSection:loadSection,
            getSectionTitle:(i)=>{
                return [
                    "Instances"
                ][i];
            }
        }
    );    
    tabbed.postSetup();

    tabbed.activityBar.addParts(
        new MP_ActivityBarItem({ icon:"deployed_code" })
    );

    makeDivPart(".main").addPart(tabbed);
}
initPage();