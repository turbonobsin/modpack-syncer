import { MP_Button, MP_Div, MP_Header, MP_P, MP_Text } from "./frontend/menu_parts";
import { PackMetaData } from "./interface";

export function loadDefaultAside(aside:MP_Div,ops:{
    title:string,
    desc?:string
}){
    aside.clearParts();

    let head = aside.addPart(new MP_Div({className:"info-head"}));
    let body = aside.addPart(new MP_Div({className:"info-body"}));
    let footer = aside.addPart(new MP_Div({className:"info-footer"}));

    let details = new MP_Div({
        className:"info-details"
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
            onclick:async e=>{
                let res = await window.gAPI.addInstance(meta);
                window.close();
            }
        })
    )
}

// Simple Select API

type SelectedItemData<T> = {
    data:T;
    e:Element;
};
export interface SelectedItemOptions<T>{
    onSelect?:(data:T,item:SelectedItem<T>)=>void;
}
export class SelectedItem<T>{
    constructor(ops:SelectedItemOptions<T>){
        this.ops = ops;
    }
    ops:SelectedItemOptions<T>;
    data?:SelectedItemData<T>;
};
export function selectItem<T>(item:SelectedItem<T>,data:T,e:Element){
    item.data = {data,e};
    let aside = document.querySelector("aside");
    
    let wasActive = e.classList.contains("active");
            
    let allActive = e.parentElement?.querySelectorAll(".active");
    if(allActive) for(const elm of allActive) elm.classList.remove("active");
    if(wasActive){
        if(aside) aside.textContent = "";
        return;
    }

    e.classList.add("active");
    if(item.ops.onSelect) item.ops.onSelect(item.data.data,item);
}
export function reselectItem<T>(item:SelectedItem<T>){
    if(!item.data) return;

    selectItem(item,item.data.data,item.data.e);
}