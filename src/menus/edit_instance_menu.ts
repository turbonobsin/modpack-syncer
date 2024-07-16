import "../render_lib";
import { makeDivPart, MP_ActivityBarItem, MP_Div, MP_Flexbox, MP_Grid, MP_TabbedMenu, MP_Text } from "../menu_parts";
import { qElm } from "../render_lib";
import { EditInst_InitData } from "../interface";
import { InitData } from "../render_util";

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

async function loadSection(index:number,menu:MP_TabbedMenu){
    switch(index){
        case 0:{
            let grid = menu.main_body.addPart(
                new MP_Grid({
                    template_columns:"1fr 1fr"
                })
            );
            let cols = grid.createSubSections(2);
            cols[0].addPart(new MP_Text({text:"hi"}));
            cols[1].addPart(new MP_Text({text:"hi 2"}));
            
        } break;
        case 1:{
            let res = await window.gAPI.getInstScreenshots({iid:initData.d.iid});
            if(!res) return;
            console.log("RES:",res);

            let list_cont = new MP_Grid({
                template_columns:"repeat(auto-fill,300px)",
                gap:"3px"
                // gap:"0px"
            });
            menu.main_body.addPart(list_cont);
            if(!list_cont.e) return;

            let can = document.createElement("canvas");
            can.width = 1920;
            can.height = 1080;
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

            let cont = list_cont.e;
            // let x = Math.floor(cont.offsetWidth/303);
            // let y = Math.floor((innerHeight-cont.offsetTop)/(9/16*303));

            menu.main_body.e?.parentElement?.addEventListener("scroll",e=>{
                checkVis();
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

const fullscreenCont = qElm(".fullscreen-cont");
const imgCont = qElm(".img-cont");
let elms:HTMLImageElement[] = [];
let _lastCheckVis = 0;
let __curImg:HTMLImageElement|undefined;

// note: I think it would be pretty cool to have a note underneath the image when it's loaded that you can set, for memories

function openImg(img?:HTMLImageElement){
    if(!img) return;
    if(!fullscreenCont) return;
    if(!imgCont) return;

    fullscreenCont.classList.toggle("open");
    imgCont.innerHTML = "";

    __curImg = img;

    // let clone = img.cloneNode() as HTMLImageElement;
    let clone = document.createElement("img");
    clone.src = img.src;
    let amt = "100%";
    if(clone.width > clone.height) clone.style.width = amt;
    else clone.style.height = amt;

    imgCont.appendChild(clone);
    // let subImg = document.createElement("div");
    // subImg.style.backgroundImage = `url(${img.src})`;
    // imgCont.appendChild(subImg);
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
            closeImg();
            openImg(cur as HTMLImageElement);
            return;
        }
        if(k == "arrowleft"){
            let cur = __curImg?.previousSibling;
            if(!cur) cur = __curImg?.parentNode?.lastChild;
            closeImg();
            openImg(cur as HTMLImageElement);
            return;
        }
    }
});

function checkVis(){
    let margin = 0;

    if(performance.now()-_lastCheckVis < 500) return; // don't check but at most every ___ ms

    let i = 0;
    for(const e of elms){
        if(e.classList.contains("_loaded")) continue;
        
        let r = e.getBoundingClientRect();

        // e.classList.remove("test-highlight");

        let y = r.y;

        i++;

        if(y+margin < 0){
            // console.log("skip");
            continue;
        }
        if(y+margin > innerHeight-150){
            // console.log("skip");
            continue;
        }

        // e.classList.add("test-highlight");
        // 

        let path = e.getAttribute("full-path");
        if(!path) continue;
        
        e.classList.add("_loaded");

        window.gAPI.getImage(path).then(buf=>{
            let blob = new Blob([buf]);
            let url = URL.createObjectURL(blob);
            e.src = url;
            e.onload = ()=>{
                // URL.revokeObjectURL(url);
            };
        });
    }
}

// const cache = new Map<string,Blob>

async function init(){
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