// Menu Components/Parts (Petal Parts? haha Petal Code is crazy)

export interface MP_Ops{
    overrideDiv?:HTMLElement;
    classList?:string[];
    className?:string;
    id?:string;
    textContent?:string;
    __tag?:string;
}
export interface MP_Text_Ops extends MP_Ops{
    overrideTag?:string;
    text:string;
}
export interface MP_Flexbox_Ops extends MP_Ops{
    direction:string;
    gap:string;
}
export interface MP_Button_Ops extends MP_Ops{
    onclick:(e:MouseEvent)=>void;
    label:string,
    disabled?:boolean
}
export interface MP_Input_Ops extends MP_Ops{
    type:string;

    value?:string;
    valueAsNumber?:number;
    valueAsDate?:Date;
    checked?:boolean;

    name?:string;
}
export interface MP_SearchForm_Ops extends MP_Ops{
    onsubmit:(e:SubmitEvent,query?:string)=>void;
}

export abstract class MenuPart{
    constructor(ops:MP_Ops){
        this.ops = ops;
        this.parts = [];
        this.init();
    }
    e?:Element;
    ops:MP_Ops;
    parts:MenuPart[];

    init(){
        if(this.ops.overrideDiv){
            this.e = this.ops.overrideDiv;
            this._postLoad();
        }
        else this.create();
        // else this._load();

        if(this.ops.textContent){
            this.addPart(new MP_Text({
                text:this.ops.textContent
            }));
        }

    }

    addParts(...parts:MenuPart[]){
        for(const p of parts){
            this.addPart(p);
        }
        return this;
    }
    addPart(part:MenuPart){
        if(!this.e){
            console.warn("Err: could not add part, there was no container on this object.",this);
            return part;
        }
        
        this.parts.push(part);
        part._load(); // I'm moving part loading to be immidiate so stuff can happen even before it's been appended

        if(part.e) this.e.appendChild(part.e);

        return part;
    }

    clearParts(){
        if(this.e){
            this.e.textContent = "";
        }
    }
    onPostLoad(f:(p:MenuPart)=>void){
        // this._onPostLoad = f;
        f(this);
        return this;
    }
    // private _onPostLoad?:(p:MenuPart)=>void;
    

    // load(){
    //     this.e = this.ops.overrideDiv ?? document.createElement("div");
    // }

    private _load(){
        this.load();
        this._postLoad();
    }
    private _postLoad(){
        let o = this.ops;
        let e = this.e;

        if(e){
            if(o.className) e.className = o.className;
            if(o.classList) e.classList.add(...o.classList);
            if(o.id) e.id = o.id;
        }

        // if(this._onPostLoad) this._onPostLoad(this);
    }

    abstract create():void;
    load():void {}
}
abstract class TextMenuPart extends MenuPart{
    constructor(tag:string,ops:MP_Text_Ops){
        if(!ops.overrideTag) ops.overrideTag = tag;
        super(ops);
    }
    declare ops:MP_Text_Ops;
    create(){
        if(!this.ops.overrideTag) return;
        
        this.e = document.createElement(this.ops.overrideTag);
        this.e.textContent = this.ops.text;
    }
}

interface MenuPartTemplateOps{
    onload:()=>Promise<void>
}
class MenuPartTemplate{
    constructor(){
        
    }
    async onload(){
        
    }

    /**@unfinished */
    static async from(ops:MenuPartTemplateOps){
        let mp = new MenuPartTemplate();

        await ops.onload();
    }
}
// const menuPartTemplateRegistry = new Map<string,MenuPartTemplate>();
// function registerMenuPartTemplate(id:string,template:MenuPartTemplate){
//     menuPartTemplateRegistry.set(id,template);
// }
// function loadMenuPartTemplate(id:string){

// }

export class MP_Generic<T extends HTMLElement> extends MenuPart{
    constructor(tag:string,ops:MP_Ops){
        ops.__tag = tag;
        super(ops);
    }
    declare e?:T;
    
    create(): void {
        if(this.ops.__tag) this.e = document.createElement(this.ops.__tag) as T;
    }
}
export class MP_Any<T extends HTMLElement> extends TextMenuPart{
    constructor(tag:string,ops:MP_Text_Ops){
        super(tag,ops);
    }
    declare e?:T;
}
export class MP_Div extends MenuPart{
    constructor(ops:MP_Ops){
        super(ops);
    }
    create(): void {
        this.e = document.createElement("div");
    }
}
export class MP_P extends TextMenuPart{
    constructor(ops:MP_Text_Ops){
        super("p",ops);
    }
}
export class MP_Text extends TextMenuPart{
    constructor(ops:MP_Text_Ops){
        super("span",ops);
    }
}

export class MP_Header extends MenuPart{
    constructor(ops:MP_Ops){
        super(ops);
    }
    create(): void {
        this.e = document.createElement("header");
    }
}
export class MP_Article extends MenuPart{
    constructor(ops:MP_Ops){
        super(ops);
    }
    create(): void {
        this.e = document.createElement("article");
    }
}

export class MP_Button extends MenuPart{
    constructor(ops:MP_Button_Ops){
        super(ops);
    }
    declare ops:MP_Button_Ops;
    declare e?:HTMLButtonElement;
    
    create(): void {
        this.e = document.createElement("button");
    }
    load(): void {
        if(!this.e) return;

        this.e.addEventListener("click",e=>{
            this.ops.onclick(e);
        });
        this.e.textContent = this.ops.label;
    }
}
export class MP_Input extends MenuPart{
    constructor(ops:MP_Input_Ops){
        super(ops);
    }
    declare ops:MP_Input_Ops;
    declare e?:HTMLInputElement;

    create(): void {
        this.e = document.createElement("input");

        let o = this.ops;
        let e = this.e;

        e.type = o.type;

        if(o.value) e.value = o.value;
        if(o.valueAsNumber) e.valueAsNumber = o.valueAsNumber;
        if(o.valueAsDate) e.valueAsDate = e.valueAsDate;
        if(o.checked) e.checked = o.checked;
    }

    getValue(){
        return this.e?.value;
    }
}

export class MP_Flexbox extends MenuPart{
    constructor(ops:MP_Ops){
        super(ops);
    }
    create(): void {
        
    }
}

export class MP_SearchForm extends MP_Generic<HTMLFormElement>{
    constructor(ops:MP_SearchForm_Ops){
        if(!ops.classList) ops.classList = [];
        ops.classList.push("query");

        super("form",ops);
    }
    declare ops:MP_SearchForm_Ops;

    inp?:MP_Input;

    load(): void {
        super.load();
        // <div class="main-options">
        //     <span>
        //         <button class="b-add-instance icon-cont">add</button>
        //     </span>
        //     <form action="" class="query">
        //         <input type="search" name="i-search" id="i-query">
        //         <input type="submit" class="icon-cont" value="search">
        //     </form>
        // </div>

        let i_query = new MP_Input({
            type:"search",
            name:"i-search",
            id:"i-query"
        });

        this.e?.addEventListener("submit",e=>{
            e.preventDefault();
            this.ops.onsubmit(e,i_query.getValue());
        });

        this.addParts(
            i_query,
            new MP_Input({
                type:"submit",
                classList:["icon-cont"],
                value:"search"
            })
        );

        this.inp = i_query;
    }
}



// ideas
/**

- need to make it so you can register it to have resize listener and then listen for innerWidth changes and scale based on the new size of the element
    - these will be stored in a map so they can be iterated over extremely quickly and easily when the event is fired
    - but this approach will need some way to free the listeners when the elements no longer exist
        - so I think I'll make a garbage collection (GC) for listeners and if their element is no longer in the DOM then free the listener
        - the GC should periodically go around and slowly asynchronously cleanup everything

 */