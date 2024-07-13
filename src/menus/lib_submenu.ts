import "../styles/index.css";
import "../styles/home.css";
import "../styles/menus.css";
import { MenuPart, MP_Div, MP_Input, MP_SearchForm, MP_SearchForm_Ops, MP_Text } from "../frontend/menu_parts";
import { reselectItem, SelectedItem } from "../render_util";

const overlaysCont = new MP_Div({
    overrideDiv:document.body
}).addPart(new MP_Div({
    className:"overlays-cont"
}));

const overlaysBack = overlaysCont.addPart(new MP_Div({
    className:"overlays-back"
}));

// 
export interface MP_SearchStructure_Ops<T> extends MP_SearchForm_Ops{
    listId:string;
    customListFormat?:string;
    onSelect:(data:T,item:SelectedItem<T>)=>void;
}
export class MP_SearchStructure<T> extends MP_Div{
    constructor(ops:MP_SearchStructure_Ops<T>){
        super(ops);
        this.selected = new SelectedItem<T>({
            onSelect:(data,item)=>{
                // loadModPackMetaPanel(data,aside);
                this.ops.onSelect(data,item);
            }
        });
    }
    declare ops:MP_SearchStructure_Ops<T>;

    listCont?:MP_Div;
    list?:MP_Div;
    form?:MP_SearchForm;
    i_search?:MP_Input;

    selected:SelectedItem<T>;

    load(): void {
        super.load();

        this.form = new MP_SearchForm({
            onSubmit:async (t,e,query)=>{
                if(!this.list) return;

                this.list.clearParts();
                await this.ops.onSubmit(t,e,query);

                reselectItem(this.selected);
            }
        });

        this.addParts(
            new MP_Div({
                className:"main-options"
            }).addParts(
                new MP_Text({text:""}),
                this.form
            ),
            new MP_Div({
                className:this.ops.listId+"-grid list-cont"
            }).addParts(
                new MP_Div({
                    className:this.ops.listId+"-grid-items list"+(this.ops.customListFormat?" "+this.ops.customListFormat:"")
                })
            )
        );

        this.listCont = this.qPart(".list-cont") as MP_Div;
        this.list = this.qPart(".list") as MP_Div;
        this.i_search = this.form.inp;
    }

    async submit(){
        await this.form?.submit();
    }
}

export function qElm(selector?:string){
    if(selector) return document.querySelector(selector) ?? undefined;
}