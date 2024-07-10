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
import './styles/index.css';
import "./styles/home.css";

console.log('👋 This message is being logged by "renderer.ts", included via Vite');

const b_test = document.querySelector<HTMLButtonElement>(".b-test");
const b_click = document.querySelector<HTMLButtonElement>(".b-click");
const b_click2 = document.querySelector<HTMLButtonElement>(".b-click2");
const modList = document.querySelector<HTMLDivElement>(".mod-list");
const modTable = document.querySelector<HTMLTableElement>(".mod-table");
const b_addInstance = document.querySelector<HTMLButtonElement>(".b-add-instance");

// 

b_addInstance?.addEventListener("click",e=>{
    window.gAPI.openMenu("add-instance");
});

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