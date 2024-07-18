import "../render_lib";
import "../styles/edit_instance_menu.css";
import { addClassToOps, makeDivPart, MP_ActivityBarItem, MP_Div, MP_Flexbox, MP_Flexbox_Ops, MP_Generic, MP_Grid, MP_Header, MP_HR, MP_TabbedMenu, MP_TableList, MP_Text, MP_TR } from "../menu_parts";
import { MP_SearchStructure, qElm } from "../render_lib";
import { EditInst_InitData, ModData } from "../interface";
import { InitData, SelectedItem, selectItem, wait } from "../render_util";
import { sysInst } from "src/db";
import { io } from "socket.io-client";

let initData = new InitData<EditInst_InitData>(init);

const root = makeDivPart(".main");
const tab_menu = new MP_TabbedMenu(
    {},
    {
        style:"left"
    },
    {
        hasAside:true,
        onLoadSection:loadSection,
        getSectionTitle:(index)=>{
            return [
                "Mods",
                "Screenshots",
                "Java Configuration",
                "Settings"
            ][index];
        }
    }
);

interface MP_ModRow_Ops extends MP_Flexbox_Ops{
    mod:ModData;
    onClick2?:(e:MouseEvent,elm:HTMLElement)=>any;
}
class MP_ModRow extends MP_Flexbox{
    constructor(ops:MP_ModRow_Ops){
        addClassToOps(ops,"mod-row");
        ops.alignItems = "center";
        ops.gap = "5px";
        ops.marginBottom = "3px";
        
        super(ops);
    }
    declare ops:MP_ModRow_Ops;

    load(): void {
        super.load();
        let mod = this.ops.mod;

        this.addParts(
            new MP_Generic<HTMLImageElement>("img",{}).onPostLoad(p=>{
                if(!p.e) return;
                if(!mod.info) return;

                let e = p.e as HTMLImageElement;

                e.style.width = "25px";
                e.style.height = "25px";

                e.setAttribute("full-path",mod.info.icon);
                _loadImage(e,0);

                e.onclick = function(){
                    openImg(e);
                };
            }),
            new MP_Div({
                className:"mod-row-content",
                onClick:this.ops.onClick2
            }).addParts(
                new MP_Text({
                    text:mod.info ? mod.info.name : mod.name,
                    marginRight:"auto"
                }),
                new MP_Text({
                    text:mod.info ? mod.info.version : `(No Info)`
                }).onPostLoad(p=>{
                    if(!p.e) return;
                    p.e.style.textAlign = "right";
                    p.e.style.color = "var(--text-dim)";
                })
            )
        );

        this.update();
    }

    update(){
        let rowContent = this.qPart(".mod-row-content");
        if(!rowContent) return;
        let mod = this.ops.mod;

        this.e?.classList.toggle("disabled",mod.name.endsWith(".disabled"));
    }

    showData(){
        let aside = tab_menu.aside;
        if(!aside.e) return;
        aside.clearParts();

        aside.addParts(
            new MP_Header({ textContent:"Updates" }),
            new MP_HR()
        );
    }
}

async function loadSection(index:number,menu:MP_TabbedMenu){
    switch(index){
        case 0:{
            let table = new MP_TableList({
                header:[
                    {
                        label:"",
                        width:"0px"
                    },
                    {
                        label:"Name",
                        width:"100%"
                    },
                    {
                        label:"Version",
                        width:"auto"
                    }
                ]
            });

            let search = new MP_SearchStructure<ModData>({
                listId:"_",
                // listId:"instance",
                submitOnOpen:true,
                onSelect:(data,item)=>{
                    
                },
                onSubmit:async (t,e,q)=>{
                    // let grid = menu.main_body.addPart(
                    //     new MP_Grid({
                    //         template_columns:"1fr auto"
                    //     })
                    // );
                    
                    // let cols = grid.createSubSections(2);
                    // let col1 = cols[0]; //.addPart(new MP_Text({text:"hi"}));
                    // let col2 = cols[1]; //.addPart(new MP_Text({text:"hi 2"}));

                    let res = await window.gAPI.getInstMods({iid:initData.d.iid});
                    console.log("RES:",res);

                    let col1 = search.list;
                    // if(col1.e) col1.e.style.overflowY = "scroll";
                    // if(menu.main_body.e?.parentElement) menu.main_body.e.parentElement.style.overflowY = "hidden";

                    col1.addParts(
                        new MP_Flexbox({
                            alignItems:"center",
                            gap:"10px",
                            marginBottom:"3px"
                        }).addParts(
                            new MP_Div({width:"25px"}),
                            new MP_Text({
                                text:"Name",
                                marginRight:"auto"
                            }),
                            new MP_Text({
                                text:"Version"
                            }).onPostLoad(p=>{
                                if(!p.e) return;
                                // p.e.style.textAlign = "right";
                                // p.e.style.color = "var(--text-dim)";
                            }),
                        ),
                        new MP_HR()
                    );
                    
                    // 

                    for(const mod of res.mods.global){
                        table.addRow(false,[
                            new MP_Generic<HTMLImageElement>("img",{}).onPostLoad(p=>{
                                if(!p.e) return;
                                if(!mod.info) return;

                                let e = p.e as HTMLImageElement;

                                e.style.width = "25px";
                                e.style.height = "25px";

                                e.setAttribute("full-path",mod.info.icon);
                                _loadImage(e,0);

                                e.onclick = function(){
                                    openImg(e);
                                };

                                // (p.e as HTMLImageElement).src = mod.info.icon;
                            }),
                            new MP_Text({
                                text:mod.name,
                                marginRight:"auto"
                            }),
                            new MP_Text({
                                text:mod.info ? mod.info.version : `(No Info)`
                            }).onPostLoad(p=>{
                                if(!p.e) return;
                                p.e.style.textAlign = "right";
                                p.e.style.color = "var(--text-dim)";
                            })
                        ],td=>{
                            if(td.e){
                                td.e.style.color = "var(--t2)";
                            }
                        });
                        
                        let div = new MP_ModRow({
                            mod,
                            onClick2:(e,elm)=>{
                                console.log("click 1");
                                selectItem(search.selected,mod,elm);
                            }
                        });

                        col1.addPart(div);
                    }
                }
            });

            menu.main_body.addPart(search);
            console.log(search.e);
            if(search.e){
                // search.e.style.display = "grid";
                // search.e.style.gridTemplateRows = "auto 1fr";
            }
            
        } break;
        case 1:{
            let res = await window.gAPI.getInstScreenshots({iid:initData.d.iid});
            if(!res) return;
            console.log("RES:",res);

            let list_cont = new MP_Grid({
                template_columns:"repeat(auto-fill,300px)",
                gap:"3px",
                className:"img-list"
                // gap:"0px"
            });
            menu.main_body.addPart(list_cont);
            if(!list_cont.e) return;

            list_cont.clearParts();

            let can = document.createElement("canvas");
            can.width = 192;
            can.height = 108;
            let ctx = can.getContext("2d");
            if(!ctx) return;
            ctx.fillStyle = "green";
            // ctx.fillRect(0,0,can.width,can.height);
            let b1 = await new Promise<Blob|null>(resolve=>{
                can.toBlob(blob=>{
                    resolve(blob);
                });
            });
            if(!b1) return;
            let url1 = URL.createObjectURL(b1);

            // let cont = list_cont.e;
            // let x = Math.floor(cont.offsetWidth/303);
            // let y = Math.floor((innerHeight-cont.offsetTop)/(9/16*303));

            menu.main_body.e?.parentElement?.addEventListener("scroll",e=>{
                checkVis();
                if(!menu.main_body.e) return;
                _scrollY = menu.main_body.e.scrollTop;
            });

            elms = [];

            for(const ss of res.list){
                let img = document.createElement("img");
                img.style.width = "300px";
                // img.width = 1920;
                // img.height = 1080;

                img.src = url1;
                elms.push(img);
                img.setAttribute("full-path",ss.path);
                img.setAttribute("path-name",ss.name);
                
                if(false) setTimeout(()=>{
                    window.gAPI.getImage(ss.path).then(buf=>{
                        let blob = new Blob([buf]);
                        let url = URL.createObjectURL(blob);
                        img.src = url;
                        img.onload = ()=>{
                            URL.revokeObjectURL(url);
                        };
                    });
                },300+500*(Math.ceil(Math.random()*5)));

                img.onload = ()=>{
                    // let vis = cont.checkVisibility({contentVisibilityAuto:true});
                };

                img.addEventListener("click",e=>{
                    openImg(img);
                });

                list_cont.e?.appendChild(img);
            }

            checkVis();
        } break;
    }
}

const fullscreenCont = qElm(".fullscreen-cont") as HTMLElement | undefined;
const imgCont = qElm(".img-cont") as HTMLElement | undefined;
let elms:HTMLImageElement[] = [];
let _lastCheckVis = 0;
let __curImg:HTMLImageElement|undefined;

// note: I think it would be pretty cool to have a note underneath the image when it's loaded that you can set, for memories

function isImg(img?:Node|null){
    if(!img) return false;
    if(!("tagName" in img)) return false;
    if((img.tagName as string).toLowerCase() != "img") return false;
    return true;
}
function openImg(img?:HTMLImageElement){
    if(!img) return;
    if(!fullscreenCont) return;
    if(!imgCont) return;
    if(img.tagName.toLowerCase() != "img") return;

    fullscreenCont.classList.toggle("open");
    imgCont.innerHTML = "";

    __curImg = img;

    let can = document.createElement("canvas");
    let ctx = can.getContext("2d");

    let clone = document.createElement("img");
    clone.style.userSelect = "none";
    clone.src = img.src;

    can.width = clone.width;
    can.height = clone.height;

    let e = can;

    clone.addEventListener("load",e=>{
        ctx?.drawImage(clone,0,0);
    });

    if(e.width <= 64 || e.height <= 64){
        e.style.imageRendering = "pixelated";
    }

    if(e.width > clone.height) e.classList.add("vert");
    else e.classList.add("horz");

    e.addEventListener("click",e=>{
        e.stopPropagation();
    });

    e.classList.add("img");
    imgCont.appendChild(e);
}
function closeImg(){
    __curImg = undefined;
    fullscreenCont?.classList.remove("open");
    if(imgCont) imgCont.innerHTML = "";
}

document.addEventListener("keydown",e=>{
    let k = e.key.toLowerCase();
    
    if(fullscreenCont?.classList.contains("open") && imgCont){
        if(k == "escape"){
            closeImg();
            return;
        }
        if(k == "arrowright"){
            let cur = __curImg?.nextSibling;
            if(!cur) cur = __curImg?.parentNode?.firstChild;
            if(!isImg(cur)) return;
            closeImg();
            openImg(cur as HTMLImageElement);
            return;
        }
        if(k == "arrowleft"){
            let cur = __curImg?.previousSibling;
            if(!cur) cur = __curImg?.parentNode?.lastChild;
            if(!isImg(cur)) return;
            closeImg();
            openImg(cur as HTMLImageElement);
            return;
        }
    }
});

function initFullscreenCont(){
    if(!fullscreenCont || !imgCont) return;

    fullscreenCont.addEventListener("click",e=>{
        closeImg();
    });
}

let checkingVis = false;
async function checkVis(){
    let margin = 0;
    
    if(checkingVis) return;
    if(performance.now()-_lastCheckVis < 2500) return; // don't check but at most every ___ ms
    
    checkingVis = true;

    let i = 0;
    for(const e of elms){
        // if(i >= 1) break;
        _loadImage(e,i);
        // if(res == 1) continue;
    }
    checkingVis = false;
}
let loadingImageCache:number[] = [];

let _scrollY = 0;
async function _loadImage(e:HTMLImageElement,i:number){
    if(loadingImageCache[i] == 2) return;
    // loadingImageCache[i] = 1;

    // await wait
    // await wait(50+100*Math.random()*5);
    // await wait(500+2000*Math.random()*5);

    let margin = _scrollY;

    let res:any;
    let prom = new Promise<void>(resolve=>res = resolve);

    if(e.classList.contains("_loaded")) return 1;
        
    let r = e.getBoundingClientRect();

    // e.classList.remove("test-highlight");

    let y = r.y;

    i++;

    if(y+margin < 0){
        // console.log("skip");
        return 1;
    }
    if(y+margin > innerHeight-150){ //150
    // if(y+margin > 50){
        // console.log("skip");
        return 1;
    }

    // e.classList.add("test-highlight");
    // 

    let fullPath = e.getAttribute("full-path");
    if(!fullPath) return;
    
    // let path = `http://localhost:57152/image/${e.getAttribute("path-name")}`;
    let url1 = new URL("http://localhost:57152/image");
    url1.searchParams.set("path",fullPath);
    let path = url1.href;
    // let path = fullPath;

    // if(i == 1) console.log(":: PATH",path);
    // let path = elms[0].getAttribute("full-path");
    // let path = "http://localhost:3000/test/2024-01-13_15.49.30.png";
    // let path = "http://localhost:3000/image";
    if(!path) return 1;

    loadingImageCache[i] = 2; // loaded

    let startTime = performance.now();
    
    e.classList.add("_loaded");

    let j = i;

    if(false) window.gAPI.getImage(path).then(function(buf){
        let blob = new Blob([buf]);
        let url = URL.createObjectURL(blob);
        e.src = url;
        
        e.onload = function(){
            // URL.revokeObjectURL(url);
            // if(j == 1) console.log("TIME:",performance.now()-startTime);
            // console.log("TIME:",performance.now()-startTime);
        };
    });
    else{
        // setTimeout(()=>{
            e.src = path;
        
            e.onload = function(){
                // if(j == 1) console.log("TIME:",performance.now()-startTime);
                res();
            };
        // },50+100*Math.random()*5);
    }
    
    await prom;
}

// const cache = new Map<string,Blob>

async function init(){
    initFullscreenCont();
    
    root.addPart(tab_menu);

    tab_menu.activityBar.addParts(
        // new MP_ActivityBarItem({ icon:"public" }),
        // new MP_ActivityBarItem({ icon:"outdoor_grill" }),
        new MP_ActivityBarItem({ icon:"inbox_customize" }),
        new MP_ActivityBarItem({ icon:"landscape" }),
        new MP_ActivityBarItem({ icon:"coffee" }),
        new MP_ActivityBarItem({ icon:"settings" }),
    );

    tab_menu.postSetup();
}