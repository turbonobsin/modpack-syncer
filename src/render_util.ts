import { MP_Button, MP_Div, MP_Header, MP_P, MP_Text } from "./menu_parts";
import { InitMenuData, PackMetaData } from "./interface";

export function loadDefaultAside(aside:MP_Div,ops:{
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
        })
    )

    footer.addParts(
        new MP_Button({
            label:"Add Mod Pack",
            className:"b-add-mod-pack",
            onClick:async e=>{
                let res = await window.gAPI.addInstance(meta);
                window.close();
            }
        })
    )
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
        let multi_select = false;
        if(e) if(e.shiftKey || e.ctrlKey) multi_select = true;
        if(!multi_select) this.api.deselectAll();
        
        if(this.selected) this.deselect(e);
        else this.select(e);
    }
    select(e?:MouseEvent){
        if(this.selected) return;
        
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
    // @ts-ignore
    d:T; // <-- I will only load the page if this is defined so it is garenteed to be defined
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
        
            console.log("...called init");
            this.init();
        });
        
        setTimeout(()=>{
            if(this.hasLoadedPage) return;
            this.hasLoadedPage = true;
        
            let cache = sessionStorage.getItem("initData");
            if(cache){
                this.d = JSON.parse(cache).data;
                if(!this.d) return;

                console.log("...called init");
                this.init();
            }
        },this.timeoutDelay);
    }
}