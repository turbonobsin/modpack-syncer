import "./styles/index.css";
import "./styles/home.css";
import "./styles/menus.css";
import "./styles/menus_custom.css";

import { addClassToOps, MenuPart, MP_Div, MP_Input, MP_SearchForm, MP_SearchForm_Ops, MP_Text } from "./menu_parts";
import { deselectItem, reselectItem, SAPI2_Item, SelectedItem, SelectionAPI2, wait } from "./render_util";

const overlaysCont = new MP_Div({
    overrideDiv:document.body
}).addPart(new MP_Div({
    className:"overlays-cont"
}));

const overlaysBack = overlaysCont.addPart(new MP_Div({
    className:"overlays-back"
}));

window.gAPI.refresh(()=>{
    window.location.reload();
});

// 
export interface MP_SearchStructure_Ops<T> extends MP_SearchForm_Ops{
    listId:string;
    customListFormat?:string;
    submitOnOpen?:boolean;
    onSelect:(data:T,item:SAPI2_Item<T>)=>void;
    onNoSelected?:()=>void;
    // getList:()=>Promise<MenuPart[]>;

    getItemUniqueID?(item:SAPI2_Item<T>): any;
    getItemByID?(s:MP_SearchStructure<T>,id:any): SAPI2_Item<T> | undefined;
    getScrollableElm?(): Element | undefined;
}
export class MP_SearchStructure<T> extends MP_Div{
    constructor(ops:MP_SearchStructure_Ops<T>){
        addClassToOps(ops,"search-structure");
        
        if(ops.submitOnOpen){
            ops.onAdded = ()=>{
                this.submit();
            };
        }
        
        super(ops);
        // this.selected = new SelectedItem<T>({
        //     onSelect:(data,item)=>{
        //         // loadModPackMetaPanel(data,aside);

        //         this.ops.onSelect(data,item);
        //     }
        // });
        this.sel = new SelectionAPI2();
        this.sel.onSelect = ops.onSelect;
        this.sel.onNoSelection = ops.onNoSelected;
    }
    declare ops:MP_SearchStructure_Ops<T>;

    listCont?:MP_Div;
    list = new MP_Div({});
    form?:MP_SearchForm;
    i_search?:MP_Input;
    mainOptions = new MP_Div({className:"main-options"});

    // selected:SelectedItem<T>;
    sel:SelectionAPI2<T>;
    registerSelItem(data:T,e?:HTMLElement){
        if(!e){
            console.warn("Err: e was not defined when trying to register for selection event");
            return;
        }
        
        let [item] = this.sel.addItems({e,data});
        
        e.addEventListener("mouseup",e=>{
            if(e.button == 0){
                item.toggle(e);
            }
        });

        return item;
    }

    load(): void {
        super.load();

        this.form = new MP_SearchForm({
            onSubmit:async (t,e,query)=>{
                if(!this.list) return;

                this.list.clearParts();
                await this.ops.onSubmit(t,e,query);

                // deselectItem(this.selected);
                this.sel.deselectAll();
            }
        });
        // this.form.parCont = this;

        this.list = new MP_Div({
            className:"search-structure-list "+this.ops.listId+"-grid-items list"+(this.ops.customListFormat?" "+this.ops.customListFormat:"")
        });

        this.addParts(
            new MP_Div({
                className:"main-options-cont"
            }).addParts(
                this.mainOptions,
                this.form
            ),
            new MP_Div({
                className:this.ops.listId+"-grid list-cont"
            }).addParts(
                this.list
            )
        );

        this.listCont = this.qPart(".list-cont") as MP_Div;
        this.list = this.qPart(".list") as MP_Div;
        this.i_search = this.form.inp;
    }

    async submit(){
        this.sel.clear();
        await this.form?.submit();
    }
    async refresh(){
        let scrollElm = this.ops.getScrollableElm ? this.ops.getScrollableElm() : undefined;
        let scrollTop = (scrollElm ? scrollElm.scrollTop : 0);

        let selected = this.ops.getItemUniqueID ? this.sel.items.filter(v=>v.isSelected()).map(v=>this.ops.getItemUniqueID!(v)).filter(v=>v != undefined) : [];
        this.sel.clear();
        await this.form?.submit(true);

        if(this.ops.getItemByID) for(const selId of selected){
            let item = this.ops.getItemByID(this,selId);
            if(!item) continue;

            item.select();
        }

        if(scrollElm) scrollElm.scrollTop = scrollTop;
    }
}

export function qElm(selector?:string){
    if(selector) return document.querySelector(selector) ?? undefined;
}