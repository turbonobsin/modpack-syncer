// Menu Components/Parts (Petal Parts? haha Petal Code is crazy)

import { MP_SearchStructure } from "./render_lib";

export enum PartTextStyle{
    normal,
    note,
}

export interface MP_Ops{
    overrideDiv?:Element;
    classList?:string[];
    className?:string;
    id?:string;
    /** adds a span and sets that textContent */
    textContent?:string;
    /** sets textContent */
    text?:string;
    /** sets innerHTML */
    innerHTML?:string;
    __tag?:string;
    skipAdd?:boolean;
    fontSize?:string;
    textAlign?:string;

    margin?:string;
    marginTop?:string;
    marginLeft?:string;
    marginBottom?:string;
    marginRight?:string;
    padding?:string;
    paddingTop?:string;
    paddingLeft?:string;
    paddingBottom?:string;
    paddingRight?:string;

    width?:string;
    height?:string;
    maxWidth?:string;
    maxHeight?:string;
    minWidth?:string;
    minHeight?:string;

    position?:string;
    display?:string;
    top?:string;
    left?:string;
    bottom?:string;
    right?:string;

    onClick?:(e:MouseEvent,elm:HTMLElement)=>any;
    onMouseUp?:(e:MouseEvent,elm:HTMLElement)=>any;

    onAdded?:()=>void;
}
export interface MP_Text_Ops extends MP_Ops{
    overrideTag?:string;
    style?:PartTextStyle;
}
export interface MP_Flexbox_Ops extends MP_Ops{
    direction?:string;
    gap?:string;
    justifyContent?:string;
    alignItems?:string;
}
export interface MP_Button_Ops extends MP_Ops{
    // onClick:(e:MouseEvent)=>any;
    label:string;
    disabled?:boolean;
    icon?:string;
}
export interface MP_Input_Ops extends MP_Ops{
    type:string;

    value?:string;
    valueAsNumber?:number;
    valueAsDate?:Date;
    checked?:boolean;

    name?:string;
    placeholder?:string;
}
export interface MP_SearchForm_Ops extends MP_Ops{
    onSubmit:(t:MP_SearchForm,e:SubmitEvent,query?:string)=>void|Promise<void>;
}

export function addClassToOps(ops:MP_Ops,...className:string[]){
    if(!ops.classList) ops.classList = [];
    ops.classList.push(...className);
}

export function makeDivPart(selector:string){
    return new MP_Div({overrideDiv:document.querySelector(selector) ?? undefined});
}

export abstract class MenuPart{
    constructor(ops:MP_Ops){
        this.ops = ops;
        this.parts = [];
        this.init();
    }
    e?:HTMLElement;
    ops:MP_Ops;
    parent:MenuPart|undefined;
    parts:MenuPart[];

    init(){
        if(this.ops.overrideDiv){
            this.e = this.ops.overrideDiv as HTMLElement;
            this._postLoad();
        }
        else this.create();
        // else this._load();

        if(this.e && this.ops.text){
            this.e.textContent = this.ops.text;
        }
        if(this.ops.textContent){
            this.addPart(new MP_Text({
                text:this.ops.textContent
            }));
        }
        if(this.e) if(this.ops.innerHTML) this.e.innerHTML = this.ops.innerHTML;

    }

    /**
     * Inverse of addPart, runs `parent.addPart(this)`
     * @returns this
     */
    addTo(parent:MenuPart){
        parent.addPart(this);
        return this;
    }

    /**
     * [BETA] May not always work correctly
     */
    replaceWith(newPart:MenuPart){
        if(!newPart.e || !this.e) return this;
        this.e.replaceWith(newPart.e);
        
        if(this.parent){
            let ind = this.parent.parts.indexOf(this);
            if(ind != -1) this.parent.parts.splice(ind,1);
            this.parent.parts[ind] = newPart;
        }

        return newPart;
    }
    replace(oldPart:MenuPart){
        return oldPart.replaceWith(this);
    }

    addParts(...parts:MenuPart[]){
        if(this.ops.skipAdd) return this;
        
        for(const p of parts){
            this.addPart(p);
        }
        return this;
    }
    addPart(part:MenuPart){
        if(this.ops.skipAdd) return part;
        if(part.ops.skipAdd) return part;

        if(!this.e){
            console.warn("Err: could not add part, there was no container on this object.",this);
            return part;
        }
        
        this.parts.push(part);
        part._load(); // I'm moving part loading to be immidiate so stuff can happen even before it's been appended

        if(part.e) this.e.appendChild(part.e);

        if(part.ops.onAdded) part.ops.onAdded();

        part.parent = this;
        return part;
    }

    clearParts(){
        if(this.e){
            this.e.textContent = "";
        }
        this.parts = [];
    }
    clearFromPoint(startI:number){
        let amt = this.parts.length-startI;
        for(let i = 0; i < amt; i++){
            this.parts[startI].remove();
        }
    }
    remove(){
        if(this.parent){
            let ind = this.parent.parts.indexOf(this);
            if(ind != -1) this.parent.parts.splice(ind,1);
        }
        this.e?.remove();
        this.parent = undefined;
    }
    onPostLoad(f:(p:this)=>void){
        // this._onPostLoad = f;
        f(this);
        return this;
    }

    wrapWith(p:MenuPart){
        p.addPart(this);
        return p;
    }
    autoJustify(justifyContent?:string,alignItems?:string){
        return this.wrapWith(new MP_Flexbox({justifyContent,alignItems}));
    }

    // private _onPostLoad?:(p:MenuPart)=>void;
    

    // load(){
    //     this.e = this.ops.overrideDiv ?? document.createElement("div");
    // }

    q(selector?:string){
        if(!selector) return;
        return this.e?.querySelector(selector) ?? undefined;
    }
    qAll(selector?:string){
        if(!selector) return [];
        if(!this.e) return [];
        return [...this.e.querySelectorAll(selector)];
    }
    qPart(className?:string){
        if(!className) return;
        if(!this.e) return;

        let e = this.q(className);
        if(!e) return;

        function search(p:MenuPart):MenuPart|undefined{
            for(const part of p.parts){
                if(part.e == e) return part;
                let res1 = search(part);
                if(res1) return res1;
            }
        }
        let res = search(this);
        return res;

        // return this.parts.find(v=>v.hasClass(className));
    }

    hasClass(className?:string){
        if(!className) return;
        if(this.ops.classList) if(this.ops.classList.includes(className)) return true;
        if(this.ops.className) if(this.ops.className.split(" ").includes(className)) return true;
        return false;
    }

    private _load(){
        this.load();
        this._postLoad();
    }
    private _postLoad(){
        let o = this.ops;
        let e = this.e as HTMLElement;

        if(e){
            if(o.className) e.className = o.className;
            if(o.classList) e.classList.add(...o.classList);
            if(o.id) e.id = o.id;
            if(o.fontSize) e.style.fontSize = o.fontSize;
            if(o.textAlign) e.style.textAlign = o.textAlign;
            if(o.margin) e.style.margin = o.margin;
            if(o.marginTop) e.style.marginTop = o.marginTop;
            if(o.marginLeft) e.style.marginLeft = o.marginLeft;
            if(o.marginBottom) e.style.marginBottom = o.marginBottom;
            if(o.marginRight) e.style.marginRight = o.marginRight;
            if(o.padding) e.style.padding = o.padding;
            if(o.paddingTop) e.style.paddingTop = o.paddingTop;
            if(o.paddingLeft) e.style.paddingLeft = o.paddingLeft;
            if(o.paddingBottom) e.style.paddingBottom = o.paddingBottom;
            if(o.paddingRight) e.style.paddingRight = o.paddingRight;

            if(o.width) e.style.width = o.width;
            if(o.height) e.style.height = o.height;
            if(o.maxWidth) e.style.maxWidth = o.maxWidth;
            if(o.maxHeight) e.style.maxHeight = o.maxHeight;
            if(o.minWidth) e.style.minWidth = o.minWidth;
            if(o.minHeight) e.style.minHeight = o.minHeight;

            if(o.position) e.style.position = o.position;
            if(o.display) e.style.display = o.display;
            if(o.top) e.style.top = o.top;
            if(o.left) e.style.left = o.left;
            if(o.bottom) e.style.bottom = o.bottom;
            if(o.right) e.style.right = o.right;

            if(o.onClick) e.addEventListener("click",e=>{
                if(!this.e) return;
                if(o.onClick) o.onClick(e,this.e);
            });
            if(o.onMouseUp) e.addEventListener("mouseup",e=>{
                if(!this.e) return;
                if(o.onMouseUp) o.onMouseUp(e,this.e);
            });
        }

        // if(this._onPostLoad) this._onPostLoad(this);

        this.postLoad();
        requestAnimationFrame(()=>{
            this.onNextFrame();
        });
    }

    postLoad(){}
    onNextFrame(){}

    abstract create():void;
    load():void {}

    /**
     * @param amt 
     * @param ops This parameter is cloned so can only contain JSON serializable data
     */
    createSubSections(amt:number,ops:MP_Ops={}){
        let sections:MP_Section[] = [];
        for(let i = 0; i < amt; i++){
            sections.push(this.addPart(new MP_Section(JSON.parse(JSON.stringify(ops)))));
        }
        return sections;
    }
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
        if(this.ops.text) this.e.textContent = this.ops.text;

        let o = this.ops;
        if(o.style) applyTextStyle(this.e,o.style);
    }
}

function applyTextStyle(e:Element,style:PartTextStyle){
    e.classList.add("textstyle-"+PartTextStyle[style]);
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
export class MP_HR extends MenuPart{
    constructor(ops:MP_Ops={}){
        super(ops);
    }
    create(): void {
        this.e = document.createElement("hr");
    }
}
export class MP_Section extends MenuPart{
    constructor(ops:MP_Ops={}){
        super(ops);
    }
    create(): void {
        this.e = document.createElement("section");
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
        if(ops.icon) addClassToOps(ops,"icon-btn");
        super(ops);
    }
    declare ops:MP_Button_Ops;
    declare e?:HTMLButtonElement;
    
    create(): void {
        this.e = document.createElement("button");
    }
    load(): void {
        if(!this.e) return;
        let o = this.ops;

        // this.e.addEventListener("click",e=>{
        //     this.ops.onClick(e);
        // });

        if(this.ops.icon){
            this.addParts(
                new MP_Text({text:this.ops.icon,className:"icon"}),
                new MP_Text({
                    skipAdd:!this.ops.label,
                    text:this.ops.label
                })
            );
        }
        else if(this.ops.label) this.e.textContent = this.ops.label;

        this.e.disabled = !!o.disabled;
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
        if(o.placeholder) e.placeholder = o.placeholder;
    }

    getValue(){
        return this.e?.value;
    }

    focus(){
        this.e?.focus();
    }
    blur(){
        this.e?.blur();
    }
}

export class MP_Flexbox extends MP_Div{
    constructor(ops:MP_Flexbox_Ops){
        super(ops);
    }
    declare ops:MP_Flexbox_Ops;

    create(): void {
        super.create();
    }
    load(): void {
        super.load();
        if(!this.e) return;
        let o = this.ops;

        this.e.classList.add("flex");
        let e = this.e as HTMLElement;

        if(o.direction) e.style.flexDirection = o.direction;
        if(o.gap) e.style.gap = o.gap;
        if(o.justifyContent) e.style.justifyContent = o.justifyContent;
        if(o.alignItems) e.style.alignItems = o.alignItems;
    }
}
export class MP_OutlinedBox extends MP_Flexbox{
    constructor(ops:MP_Flexbox_Ops){
        if(!ops.gap) ops.gap = "10px";
        if(!ops.alignItems) ops.alignItems = "center";
        if(!ops.classList) ops.classList = [];
        ops.classList.push("outlined-box");

        super(ops);
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
            this.ops.onSubmit(this,e,i_query.getValue());
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

    parCont?:MenuPart & {submit:()=>any};
    async submit(bare=false){
        if(!bare) if(this.parCont){
            this.parCont.submit();
            return;
        }
        
        let ev = new SubmitEvent("submit");
        await this.ops.onSubmit(this,ev,this.inp?.getValue());
        // this.e?.submit();
    }
}

export interface ActivityBar_Ops extends MP_Ops{
    style:"left"|"top"
}

export class MP_ActivityBar extends MP_Div{
    constructor(ops:ActivityBar_Ops){
        addClassToOps(ops,"activity-bar");
        super(ops);
    }
    declare ops:ActivityBar_Ops;
}

export interface ActivityBarItem_Ops extends MP_Ops{
    icon:string;
}

export class MP_ActivityBarItem extends MP_Div{
    constructor(ops:ActivityBarItem_Ops){
        addClassToOps(ops,"icon");
        super(ops);
    }
    declare ops:ActivityBarItem_Ops;
    load(): void {
        super.load();
        if(!this.e) return;

        this.e.textContent = this.ops.icon;

        this.e.role = "navigation";
        (this.e as HTMLElement).tabIndex = 0;
    }
    getIndex(){
        if(!this.e) return 0;
        if(!this.e.parentElement) return 0;

        return [...this.e.parentElement.children].indexOf(this.e);
    }
}

export interface TabbedMain_Ops extends MP_Ops{
    onLoadSection:(index:number,menu:MP_TabbedMenu)=>void;
    getSectionTitle:(index:number)=>string|undefined;
    hasAside?:boolean;
}

export class MP_TabbedMenu extends MP_Div{
    constructor(containerOps:MP_Ops,activityBarOps:ActivityBar_Ops,mainOps:TabbedMain_Ops){
        addClassToOps(containerOps,"tabbed-menu");
        addClassToOps(activityBarOps,"tabbed-activity-bar");
        addClassToOps(mainOps,"tabbed-main");

        super(containerOps);

        this.activityBarOps = activityBarOps;
        this.mainOps = mainOps;

        this.activityBar = new MP_ActivityBar(activityBarOps);
        this.main = new MP_Div(mainOps);
        
        this.main_header = new MP_Section({ className:"head-section" });
        this.main_body = new MP_Section({ className:"body-section" });
        this.main_footer = new MP_Section({ className:"footer-section" });
        this.aside = new MP_Generic<HTMLElement>("aside",{});
    }

    activityBarOps:ActivityBar_Ops;
    mainOps:TabbedMain_Ops;

    activityBar:MP_ActivityBar;
    main:MP_Div;

    main_header:MP_Section;
    main_body:MP_Section;
    main_footer:MP_Section;

    aside:MP_Generic<HTMLElement>;

    active_section_index = 0;

    load(): void {
        super.load();

        this.addParts(
            this.activityBar,
            this.main
        );

        if(this.mainOps.hasAside) this.addPart(this.aside);
    }
    onNextFrame(): void {
        this.loadSection(0);
    }

    postSetup(){
        this.main.addParts(
            this.main_header,
            this.main_body,
            this.main_footer
        );

        for(let i = 0; i < this.activityBar.parts.length; i++){
            let p = this.activityBar.parts[i];
            if(!p.e) continue;
            
            p.e.addEventListener("mousedown",e=>{
                if(e.button != 0) return;
                this.loadSection(i);
            });
        }
    }

    loadSection(index:number){
        if(!this.activityBar.e) return;

        this.main_header.clearParts();
        this.main_body.clearParts();
        this.main_footer.clearParts();

        let selected = this.activityBar.e.querySelectorAll(".active");
        for(const c of selected) c.classList.remove("active");

        this.activityBar.parts[index].e?.classList.add("active");
        this.active_section_index = index;

        let title = this.mainOps.getSectionTitle(index);
        if(title){
            this.main_header.addParts(
                new MP_Div({
                    className:"head-section"
                }).addParts(
                    new MP_Header({
                        textContent:title
                    })
                )
            );
        }

        // 
        this.mainOps.onLoadSection(this.active_section_index,this);
    }
}

interface MP_Grid_Ops extends MP_Ops{
    template_columns?:string;
    template_rows?:string;
    gap?:string;
    justifyContent?:string;
    alignItems?:string;
    justifyItems?:string;
    alignContent?:string;
}

export class MP_Grid extends MP_Div{
    constructor(ops:MP_Grid_Ops){
        super(ops);
    }
    declare ops:MP_Grid_Ops;
    load(): void {
        super.load();
        if(!this.e) return;

        let e = this.e;
        let o = this.ops;

        e.style.display = "grid";
        if(o.template_columns) e.style.gridTemplateColumns = o.template_columns;
        if(o.template_rows) e.style.gridTemplateRows = o.template_rows;
        if(o.justifyContent) e.style.justifyContent = o.justifyContent;
        if(o.alignItems) e.style.alignItems = o.alignItems;
        if(o.justifyItems) e.style.justifyItems = o.justifyItems;
        if(o.alignContent) e.style.alignContent = o.alignContent;
        if(o.gap) e.style.gap = o.gap;
    }
}

interface MP_TableList_Ops extends MP_Ops{
    header:{
        label:string,
        width?:string
    }[]
}
export class MP_Table extends MenuPart{
    create(): void {
        this.e = document.createElement("table");
    }
}
export class MP_TR extends MenuPart{
    create(): void {
        this.e = document.createElement("tr");
    }
}
interface MP_TD_Ops extends MP_Ops{
    header:boolean;
}
export class MP_TD extends MenuPart{
    constructor(ops:MP_TD_Ops){
        super(ops);
    }
    declare ops:MP_TD_Ops;

    create(): void {
        this.e = document.createElement(this.ops.header ? "th" : "td");
    }
}
export class MP_TableList extends MP_Div{
    constructor(ops:MP_TableList_Ops){
        super(ops);
    }
    declare ops:MP_TableList_Ops;
    table = new MP_Table({});

    load(): void {
        super.load();

        this.addPart(this.table);
    }
    postLoad(): void {
        super.postLoad();

        this.addRow(true,this.ops.header.map(v=>new MP_TD({header:true,textContent:v.label})),(td,i)=>{
            let w = this.ops.header[i].width;
            if(!w) return;
            if(td.e) td.e.style.minWidth = w;
        });
    }
    addRow(header:boolean,parts:MenuPart[],post?:(td:MenuPart,i:number)=>void){
        let tr = new MP_TR({});
        this.table.addPart(tr);

        let i = 0;
        for(const p of parts){
            let ops = {
                header
            } as MP_TD_Ops;
            
            let td = new MP_TD(ops);
            tr.addPart(td);
            td.addPart(p);

            if(td.e){
                td.e.style.verticalAlign = "middle";
                td.e.style.fontSize = "12px";
            }

            if(post) post(td,i);

            i++;
        }
    }
}

interface MP_Progress_Ops extends MP_Ops{

}
export class MP_Progress extends MP_Div{
    constructor(ops:MP_Progress_Ops){
        addClassToOps(ops,"progress-cont");
        super(ops);
    }
    declare ops:MP_Progress_Ops;

    barCont = new MP_Div({
        className:"progress-bar-cont"
    });
    bar = new MP_Div({
        className:"progress-bar"
    });
    details = new MP_Div({
        className:"progress-details-cont l-details"
    });

    load(): void {
        super.load();

        this.barCont.addPart(this.bar);
        this.addParts(
            this.barCont,this.details
        );
    }

    updateProgress(amt:number,total:number,curItem:string,extra?:{sections?:{header?:string,text:string[]}[]}){
        if(!this.bar.e) return;
        if(!this.details.e) return;
        
        let percent = amt == 0 ? 0 : (amt/total*100);
        if(amt == 0 && total == 0) percent = 100;
        
        this.bar.e.style.setProperty("--progress-text",`"${Math.floor(percent)}% | ${amt}/${total}"`);
        this.bar.e.style.width = `${percent}%`;
        this.details.clearParts();

        this.details.addPart(new MP_P({text:curItem}));
        
        if(extra){
            if(extra.sections){
                for(const section of extra.sections){
                    if(section.header) this.details.addPart(new MP_P({text:section.header}));
                    if(section.text) for(const line of section.text){
                        this.details.addPart(new MP_Div({textContent:line.length ? line : " "}));
                    }
                }
            }
        }
    }
}

export interface OptionItem{
    label:string;
    value:string;
}
export interface MP_Combobox_Ops extends MP_Ops{
    options:OptionItem[];
    default?:number;
    multiple?:boolean;
    selected?:string[]; // <- selected values
}
export class MP_Combobox extends MP_Generic<HTMLSelectElement>{
    constructor(ops:MP_Combobox_Ops){
        super("select",ops);
    }
    declare ops:MP_Combobox_Ops;
    
    load(): void {
        super.load();
        if(!this.e) return;

        this.e.multiple = !!this.ops.multiple;
        
        for(let i = 0; i < this.ops.options.length; i++){
            let op = document.createElement("option");
            let option = this.ops.options[i];
            op.text = option.label;
            op.value = option.value;
            this.e.appendChild(op);

            if(this.ops.selected?.includes(option.value)) op.selected = true;
        }

        if(!this.ops.selected || this.ops.selected.length == 0){
            if(this.ops.default == undefined) this.ops.default = 0;
            this.e.options.selectedIndex = this.ops.default;
        }
    }

    getI(){
        if(!this.e) return Math.min(this.ops.options.length-1,0); // return index of first item or -1 if there are no items
        return this.e.options.selectedIndex;
    }
}

export interface MP_MultiSelectGroup_Ops extends MP_Grid_Ops{
    options:OptionItem[];
    selected?:string[];
}

export interface MP_Label_Ops extends MP_Text_Ops{
    for:string;
}
export class MP_Label extends TextMenuPart{
    constructor(ops:MP_Label_Ops){
        super("label",ops);
    }
    create(): void {
        super.create();
        if(this.e) this.e.htmlFor = this.ops.for;
    }
    declare ops:MP_Label_Ops;
    declare e?:HTMLLabelElement;
}
export class MP_MultiSelectGroup extends MP_Grid{
    constructor(ops:MP_MultiSelectGroup_Ops){
        if(!ops.gap) ops.gap = "5px";
        super(ops);
    }
    declare ops:MP_MultiSelectGroup_Ops;

    load(): void {
        super.load();
        if(!this.e) return;
        // 
        
        for(let i = 0; i < this.ops.options.length; i++){
            let op = this.ops.options[i];
            let inp = new MP_Input({type:"checkbox",checked:false,id:this.ops.id??"multiselect"+"__i-"+i});

            let row = new MP_Flexbox({alignItems:"center",justifyContent:"space-between",width:"100%",gap:"15px"});
            this.addPart(row);
            row.addParts(
                new MP_Label({text:op.label,for:inp.ops.id??""}),
                inp
            );

            
            if(inp.e){
                if(this.ops.selected?.includes(op.value)) inp.e.checked = true;
                inp.e.value = op.value;
            }
        }
    }
}

export interface MP_Img_Ops extends MP_Ops{
    src:string;
}
export class MP_Img extends MenuPart{
    constructor(ops:MP_Img_Ops){
        super(ops)
    }
    declare ops:MP_Img_Ops;
    declare e?:HTMLImageElement;

    create(): void {
        this.e = document.createElement("img");
    }
    load(): void {
        super.load();
        if(!this.e) return;

        if(this.ops.src) this.e.src = this.ops.src;
    }
}

export class MP_Aside extends MenuPart{
    create(): void {
        this.e = document.createElement("aside");
    }
}

export class MP_ImgCube extends MP_Div{
    constructor(ops:MP_Img_Ops){
        addClassToOps(ops,"img-cube");
        
        super(ops);
    }
    declare ops:MP_Img_Ops;
    create(): void {
        this.e = document.createElement("div");

        for(let i = 0; i < 6; i++){
            let img = document.createElement("img");
            img.className = "i"+i;
            img.src = this.ops.src;
            this.e.appendChild(img);
        }
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