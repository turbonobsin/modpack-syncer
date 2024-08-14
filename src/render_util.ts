import { MenuPart, MP_Button, MP_Div, MP_Header, MP_HR, MP_Input, MP_Label, MP_OutlinedBox, MP_P, MP_Text } from "./menu_parts";
import { InitMenuData, PackMetaData, WorldState } from "./interface";

export function loadDefaultAside(aside:MenuPart,ops:{
    title:string,
    desc?:string
}){
    aside.clearParts();

    let head = aside.addPart(new MP_Div({className:"info-head"}));
    let body = aside.addPart(new MP_Div({className:"info-body"}));
    let footer = aside.addPart(new MP_Div({className:"info-footer"}));

    let details = new MP_Div({
        className:"info-details accent"
    });

    head.addParts(
        new MP_Header({
            textContent:ops.title
        }),
        details
    );
    
    // aside.addParts(
    //     new MP_Div({
    //         className:"info-head",
    //         textContent:ops.title
    //     }),
    //     new MP_Div({
    //         skipAdd:ops.desc == null,
    //         className:"info-body",
    //         textContent:ops.desc
    //     })
    // );

    return {
        head,body,footer
    };
}
export async function loadModPackMetaPanel(meta:PackMetaData,panel?:HTMLElement|null){
    if(!panel) return;
    
    let root = new MP_Div({
        overrideDiv:panel
    });
    root.clearParts();

    let head = root.addPart(new MP_Div({className:"info-head"}));
    let body = root.addPart(new MP_Div({className:"info-body"}));
    let footer = root.addPart(new MP_Div({className:"info-footer"}));

    head.addParts(
        new MP_Header({
            textContent:meta.name
        }),
        new MP_Div({
            className:"info-details accent"
        }).addParts(
            new MP_Text({
                text:meta.version,
                className:"l-version"
            }),
            new MP_Text({
                text:meta.loader,
                className:"l-loader"
            })
        ),
    );

    body.addParts(
        new MP_P({
            text:meta.desc,
            className:"l-desc"
        }),

        new MP_OutlinedBox({
            marginTop:"50px",
            padding:"5px 5px"
        }).addParts(
            new MP_Input({
                type:"checkbox",
                id:"cb-auto-create-inst",
                checked:true
            }),
            new MP_Label({
                for:"cb-auto-create-inst",
                text:"Auto Create Instance"
            })
        ),

        new MP_HR(),
        new MP_Button({
            label:"Add Modpack",
            className:"b-add-mod-pack",
            onClick:async e=>{
                let res = await window.gAPI.addInstance({
                    meta,
                    autoCreate:document.querySelector<HTMLInputElement>("#cb-auto-create-inst")?.checked ?? false
                });
                window.close();
            }
        }).onPostLoad(p=>{
            // p.e!.style.float = "right";
        })
    )

    footer.addParts();
}

// Selection API 2
type SAPI2_Bundle<T> = {
    data:T;
    e:Element
};
export class SelectionAPI2<T>{
    constructor(){
        this.items = [];
        this.selected = new Set();
    }
    clear(){
        for(const item of this.items){
            item.deselect();
        }
        this.items = [];
        this.selected = new Set();
    }
    addItems(...list:SAPI2_Bundle<T>[]){
        let newList:SAPI2_Item<T>[] = [];
        for(const d of list){
            let item = new SAPI2_Item(this,d);
            this.items.push(item);
            newList.push(item);
        }
        return newList;
    }

    deselectAll(){
        for(const item of this.items){
            item.deselect();
        }
    }

    onSelect?:(data:T,item:SAPI2_Item<T>)=>any;
    onNoSelection?:()=>any;

    items:SAPI2_Item<T>[];
    selected:Set<SAPI2_Item<T>>;

    _firstSelInd = -1;
}
export class SAPI2_Item<T>{
    constructor(api:SelectionAPI2<T>,bundle:SAPI2_Bundle<T>){
        this.api = api;
        this.data = bundle.data;
        this.e = bundle.e;
    }
    api:SelectionAPI2<T>;
    data:T;
    e:Element;
    private selected = false;

    isSelected(){
        return this.selected;
    }

    toggle(e?:MouseEvent){
        if(e?.shiftKey){
            // let firstInd = this.api.items.findIndex(v=>v.selected);
            let firstInd = this.api._firstSelInd;
            if(firstInd == -1) firstInd = 0;
            let toInd = this.api.items.indexOf(this);

            this.api.deselectAll();

            let min = Math.min(firstInd,toInd);
            let max = Math.max(firstInd,toInd);
            for(let i = min; i <= max; i++){
                this.api.items[i]?.select();
            }

            this.api._firstSelInd = firstInd;

            return;
        }
        
        let multi_select = false;
        if(e) if(e.shiftKey || e.ctrlKey) multi_select = true;
        if(!multi_select) this.api.deselectAll();
        
        if(this.selected) this.deselect(e);
        else this.select(e);
    }
    select(e?:MouseEvent){
        if(this.selected) return;

        if(this.api.selected.size == 0){
            this.api._firstSelInd = this.api.items.indexOf(this);
        }
        
        this.selected = true;
        this.api.selected.add(this);
        if(this.api.onSelect) this.api.onSelect(this.data,this);

        this.update();
    }
    deselect(e?:MouseEvent){        
        if(!this.selected) return;
        
        this.selected = false;
        this.api.selected.delete(this);
        if(this.api.selected.size == 0) if(this.api.onNoSelection) this.api.onNoSelection();

        this.update();
    }

    update(){
        this.e.classList.toggle("active",this.selected);
    }
}

// Simple Select API
type SelectedItemData<T> = {
    data:T;
    e:Element;
};
export interface SelectedItemOptions<T>{
    onSelect?:(data:T,item:SelectedItem<T>)=>void;
    onDeselect?:(data:T,item:SelectedItem<T>)=>void;
}
export class SelectedItem<T>{
    constructor(ops:SelectedItemOptions<T>){
        this.ops = ops;
    }
    ops:SelectedItemOptions<T>;
    data?:SelectedItemData<T>;
};
export function selectItem<T>(item:SelectedItem<T>,data:T,e:Element){
    // deselectItem(item); // IF NOT MULTI-SELECT
    
    item.data = {data,e};
    let aside = document.querySelector("aside");
    
    let wasActive = e.classList.contains("active");
            
    let allActive = e.parentElement?.querySelectorAll(".active");
    if(allActive) for(const elm of allActive) elm.classList.remove("active");
    if(wasActive){
        deselectItem(item);
        // if(aside) aside.textContent = "";
        // if(item.ops.onDeselect) item.ops.onDeselect(data,item);
        return;
    }

    e.classList.add("active");
    if(item.ops.onSelect) item.ops.onSelect(item.data.data,item);
}
export function reselectItem<T>(item:SelectedItem<T>){
    if(!item.data) return;

    let aside = document.querySelector("aside");

    if(aside) aside.textContent = "";
    if(item.ops.onDeselect) item.ops.onDeselect(item.data.data,item);

    selectItem(item,item.data.data,item.data.e);
}
export function deselectItem<T>(item:SelectedItem<T>){
    if(!item.data) return;
    if(item.data.e.classList.contains("active")){
        // selectItem(item,item.data.data,item.data.e);
        item.data.e.classList.remove("active");
    }
}

export async function wait(delay:number){
    return new Promise<void>(resolve=>{
        setTimeout(()=>{
            resolve();
        },delay);
    });
}

// 
export class InitData<T>{
    constructor(init:()=>any){
        this.init = init;
        this.setup();
    }
    d!:T; // <-- I will only load the page if this is defined so it is garenteed to be defined
    hasLoadedPage = false;
    init:()=>any;
    
    // timeoutDelay = 1500;
    timeoutDelay = 300;

    setup(){
        window.gAPI.onInitMenu((data:InitMenuData<any>)=>{
            this.hasLoadedPage = true;

            console.log("INIT DATA:",data);
            sessionStorage.setItem("initData",JSON.stringify(data));
            this.d = data.data;
            if(!this.d) return;
        
            this.init();
        });
        
        setTimeout(()=>{
            if(this.hasLoadedPage) return;
            this.hasLoadedPage = true;
        
            let cache = sessionStorage.getItem("initData");
            if(cache){
                this.d = JSON.parse(cache).data;
                if(!this.d) return;

                this.init();
            }
        },this.timeoutDelay);
    }
}

export function searchStringCompare(s1?:string,s2?:string){
    if(!s1 || !s2) return true;
    s1 = s1.toLowerCase().replaceAll(" ","");
    s2 = s2.toLowerCase().replaceAll(" ","");
    
    return s1.includes(s2) || s2.includes(s1);
}

export function getImageURL(path?:string){
    if(!path) return "";
    if(!path.startsWith("http")){
        let url1 = new URL("http://localhost:57152/image");
        url1.searchParams.set("path",path);
        path = url1.href;
    }
    return path;
}

// 
export function setTheme(theme?:string){
    if(!theme) theme = "dark";
    
    let par = document.body.parentElement;
    if(!par) return;

    let oldTheme = [...par.classList].find(v=>v.startsWith("themestyle-"));
    if(oldTheme) par.classList.remove(oldTheme);

    localStorage.setItem("theme",theme);
    par.classList.add("themestyle-"+theme);
}

export function getWorldStateText(state:WorldState,ownerName:string|undefined,yourName:string){
    if(state == "" || !state) return "Available to use";
    let pre = "";
    if(ownerName != undefined){
        if(ownerName != yourName) pre = ownerName+" is ";
        else pre = "You are ";
    }
    
    return pre+{
        "inUse":"Playing",
        "uploading":"Uploading...",
        "downloading":"Downloading..."
    }[state];
}

setTimeout(()=>{
    if(document.body.parentElement?.classList.length == 0){
        let theme = localStorage.getItem("theme");
        // console.warn("Detected white window with no theme, applying...",theme);
        console.warn("Detected white window with no theme, reloading");
        // if(theme) setTheme(theme);
        location.reload();
    }
},3000);

// 

// From Jaredcheeda, https://stackoverflow.com/questions/7381974/which-characters-need-to-be-escaped-in-html
export function escapeMarkup (dangerousInput:string) {
    const dangerousString = String(dangerousInput);
    const matchHtmlRegExp = /["'&<>]/;
    const match = matchHtmlRegExp.exec(dangerousString);
    if (!match) {
        return dangerousInput;
    }
  
    const encodedSymbolMap:Record<string,string> = {
      '"': '&quot;',
      '\'': '&#39;',
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;'
    };
    const dangerousCharacters = dangerousString.split('');
    const safeCharacters = dangerousCharacters.map(function (character) {
        return encodedSymbolMap[character] || character;
    });
    const safeString = safeCharacters.join('');
    return safeString;
}

export const abc = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function parseDescription(desc?:string){
    if(!desc) return "No description.";
    desc = escapeMarkup(desc);

    let defColor = "#eee";

    let sections:HTMLSpanElement[] = [];
    let curProps = {
        text:"",
        color:defColor,
        bold:false,
        italic:false,
        underline:false,
        strikethrough:false,
        obfuscated:false,
        colorCode:""
    };
    function resetProps(){
        curProps = {
            text:"",
            color:defColor,
            bold:false,
            italic:false,
            underline:false,
            strikethrough:false,
            obfuscated:false,
            colorCode:"",
        };
    }
    function finish(){
        if(!curProps.text.length) return;
        let span = document.createElement("span");
        span.style.color = curProps.color;
        if(curProps.italic) span.style.fontStyle = "italic";
        if(curProps.bold) span.style.fontWeight = "bold";
        let decorList:string[] = [];
        if(curProps.strikethrough) decorList.push("line-through");
        if(curProps.underline) decorList.push("underline");
        if(decorList.length) span.style.textDecoration = decorList.join(", ");
        if(curProps.obfuscated){
            (async ()=>{
                for(let i = 0; i < 4; i++){
                    span.textContent = curProps.text.split("").map(v=>abc[Math.floor(Math.random()*abc.length)]).join("");
                    await wait(300);
                }
            })();
        }
        else span.textContent = curProps.text;
        
        // finalText += `<span style="color:${curProps.color};${curProps.italic?"font-style:italic;":""}${curProps.bold?"font-weight:bold;":""}>${curProps.text}</span>`;

        if(["c","d","e","f"].includes(curProps.colorCode)){
            span.classList.add("formatted-text-darken");
        }
        
        sections.push(span);
        resetProps();
    }

    // 

    for(let i = 0; i < desc.length; i++){
        let c = desc[i];
        if(c == "§"){
            finish();
            i++;
            let code = desc[i];
            if(code == undefined) continue;

            if(code == "l") curProps.bold = true;
            else if(code == "o") curProps.italic = true;
            else if(code == "k") curProps.obfuscated = true;
            else if(code == "m") curProps.strikethrough = true;
            else if(code == "n") curProps.underline = true;
            else if(code == "r"){
                finish(); // I'm not sure if this is a full reset or just a color reset. (CURRENTLY USED AS FULL RESET)
                continue;
            }
            else{
                // from: https://wiki.sportskeeda.com/minecraft/color-codes
                curProps.color = {
                    "0":"#000",
                    "1":"#0000AA",
                    "2":"#00AA00",
                    "3":"#00AAAA",
                    // "4":"#AA0000",
                    // "4":"#CC3333",
                    "4":"#DD5555",
                    "5":"#AA00AA",
                    "6":"#FFAA00",
                    "7":"#AAAAAA",
                    "8":"#555555",
                    "9":"#5555FF",
                    "a":"#55FF55",
                    "b":"#55FFFF",
                    "c":"#FF5555",
                    "d":"#FF55FF",
                    "e":"#FFFF55",
                    "f":defColor,
                }[code] ?? defColor;
                curProps.colorCode = code;
            }


            continue;
        }

        // 
        curProps.text += c;
    }
    finish();

    // 

    return sections.map(v=>v.outerHTML).join("");
}