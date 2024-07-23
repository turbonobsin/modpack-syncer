import { makeDivPart, MenuPart, MP_Button, MP_Combobox, MP_Div, MP_Flexbox, MP_Generic, MP_Grid, MP_Header, MP_HR, MP_Input, MP_Label, MP_MultiSelectGroup, MP_P, MP_SearchForm, MP_Section, MP_TD, MP_Text } from "../menu_parts";
import "../render_lib";
import "../render_util";
import { InitData } from "../render_util";
import { InputMenu_InitData, Res_InputMenu } from "../interface";
import { qElm } from "../render_lib";

let initData = new InitData<InputMenu_InitData>(init);
const root = makeDivPart("body").onPostLoad(p=>{
    p.e!.style.overflowY = "auto";
});
const main = root.addPart(new MP_Grid({
    className:"root",
    justifyContent:"center",
    alignContent:"start",
}))

async function execute(data:any){
    let cmd = initData.d.cmd;
    let args = initData.d.args;
    if(!cmd || !args) return;

    let f = (window.gAPI as any)[cmd];
    if(!f) return;
    await f(...args,data);
    // await f(data,...args);
}

async function init(){
    let d = initData.d;
    document.title = d.title;
    resizeTo(d.width ?? innerWidth,d.height ?? innerHeight);
    
    let section_i = 0;
    for(const section of d.sections){
        if(section_i != 0) main.addPart(new MP_HR({width:"100%",marginBottom:"30px",marginTop:"-10px"}));

        // 
        let contDir = "row";
        let alignItems = "center";
        let justifyContent = "space-between";
        let gap = "40px";
        // 
        
        let s_div = new MP_Section().addTo(main);
        let option_i = 0;
        for(const op of section.options){
            let item:MenuPart | undefined;
            if(op.type == "multi_select"){
                item = new MP_MultiSelectGroup({options:op.options,selected:op.selected});
                // contDir = "column";
                alignItems = "start";
                // gap = "5px";
            }
            if(op.type == "title"){
                item = new MP_Div({});
                if(op.title) item.addPart(new MP_Header({textContent:op.title}));
                if(op.desc) item.addPart(new MP_P({className:"l-details",textContent:op.desc}));
            }
            if(op.type == "input"){
                const input = new MP_Input({
                    type:op.inputType,
                    checked:op.checked,
                    value:op.value,
                    placeholder:op.placeholder
                });
                item = input;
            }
            else if(op.type == "search"){
                const search = new MP_SearchForm({
                    onSubmit:async (t,e,q)=>{
                        await execute({
                            query:q
                        });
                        window.close();
                    }
                });
                item = search;
                if(search.inp?.e){
                    if(op.value) search.inp.e.value = op.value;
                }
                if(op.placeholder && search?.inp?.e) search.inp.e.placeholder = op.placeholder;
            }
            else if(op.type == "combobox"){
                // s_div.addParts(...op.options.map(v=>new MP_P({ text:v })));
                const select = new MP_Combobox({
                    options:op.options,
                    default:op.default,
                    multiple:op.multiple,
                    selected:op.selected
                });
                item = select;
            }

            let cont = new MP_Flexbox({gap,alignItems,justifyContent,marginBottom:"25px",direction:contDir});
            s_div.addPart(cont);

            if("label" in op) if(op.label) cont.addPart(new MP_Label({text:op.label,for:""}));
            if(item?.e) if("id" in op) item.e.id = "__item_id-"+op.id;

            if(item) cont.addPart(item);

            option_i++;
        }
        section_i++;

        // 
        let first_inp = main.q("input") as HTMLInputElement | undefined;
        if(first_inp) first_inp.focus();
    }

    // SUBMIT CONT
    main.addPart(new MP_HR({width:"100%",marginTop:"20px",marginBottom:"2   0px"}));
    let submitCont = new MP_Flexbox({alignItems:"center",justifyContent:"end",gap:"10px"}).addTo(main).addParts(
        new MP_Button({
            label:"Cancel",
            onClick:()=>{
                window.close();
            }
        }),
        new MP_Button({
            label:"Submit",
            padding:"6px 10px",
            className:"accent",
            onClick:(e,elm)=>{
                submit();
            }
        })
    );

    
    // main.addPart(new MP_Text({text:"hi"}));

    // main.addPart(
    //     new MP_Button({
    //         label:"Click",
    //         onClick:(e,elm)=>{
    //             let cmd = initData.d.cmd;
    //             let args = initData.d.args;
    //             if(!cmd || !args) return;

    //             let f = (window.gAPI as any)[cmd];
    //             if(!f) return;
    //             f(...args);
    //         }
    //     })
    // );
}

async function submit(){
    let d = initData.d;
    
    // SUBMIT
    let res:Res_InputMenu = {
        data:{}
    };

    for(const section of d.sections){
        for(const op of section.options){
            if(!("id" in op)) continue;
            if(!("type" in op)) continue;

            let q = qElm("#__item_id-"+op.id);
            if(!q) continue;

            let val:any|undefined;
            // 
            
            if(op.type == "input"){
                val = (q as HTMLInputElement).value;
            }
            else if(op.type == "search"){
                val = (q as HTMLInputElement).value;
            }
            else if(op.type == "combobox"){
                let sel = (q as HTMLSelectElement);
                val = {
                    index:sel.options.selectedIndex,
                    value:sel.options.item(sel.options.selectedIndex)?.value
                };
            }
            else if(op.type == "multi_select"){
                let boxes = q.querySelectorAll("input");
                val = [];
                for(const box of boxes){
                    if(box.checked) val.push(box.value);
                }
            }
            
            // 
            // if(val != undefined) res.data[op.id] = {
            //     val,
            //     type:op.type
            // };
            if(val != undefined) res.data[op.id] = val;
        }
    }

    await execute(res);
    window.close();
}

document.addEventListener("keydown",e=>{
    let k = e.key.toLowerCase();
    if(k == "escape"){
        window.close();
    }
    else if(k == "enter" || k == "return"){
        submit();
    }
});