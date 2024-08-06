import "../render_lib";
import "../styles/edit_instance_menu.css";
import { addClassToOps, makeDivPart, MP_ActivityBarItem, MP_Button, MP_Combobox, MP_Div, MP_Flexbox, MP_Flexbox_Ops, MP_Generic, MP_Grid, MP_Header, MP_HR, MP_Img, MP_Section, MP_TabbedMenu, MP_TableList, MP_P, MP_Text, MP_TR, PartTextStyle } from "../menu_parts";
import { MP_SearchStructure, qElm } from "../render_lib";
import { EditInst_InitData, FullModData, ModData, ModsFolder, Res_GetInstMods, RP_Data, UpdateSearch, World_Data, WorldState } from "../interface";
import { deselectItem, getImageURL, InitData, SAPI2_Item, SelectedItem, selectItem, wait } from "../render_util";
import { io } from "socket.io-client";
import { allDropdowns } from "src/dropdowns";
import { getWorldStateText } from "../preload";

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
                "Resource Packs",
                "Screenshots",
                "Worlds",
                "Java Configuration",
                "Settings"
            ][index];
        }
    }
);

interface MP_ModRow_Ops extends MP_Flexbox_Ops{
    mod:FullModData;
    onClick2?:(e:MouseEvent,elm:HTMLElement)=>any;
    onMouseUp2?:(e:MouseEvent,elm:HTMLElement)=>any;
}
class MP_ModRow extends MP_Flexbox{
    constructor(ops:MP_ModRow_Ops){
        addClassToOps(ops,"mod-row");
        ops.alignItems = "center";
        ops.gap = "5px";
        ops.marginBottom = "3px";
        
        super(ops);

        this.updateProps();
    }
    declare ops:MP_ModRow_Ops;

    main?:MP_Div;

    icon!: string;
    name!:string;
    version!: string;
    updateProps(){
        let mod = this.ops.mod;

        this.icon = mod.remote?.modrinth?.icon_url ?? mod.remote?.curseforge?.logo.url ?? mod.local.icon;
        this.name = mod.remote?.modrinth?.title ?? mod.remote?.curseforge?.name ?? mod.local.name ?? mod.local.file;
        this.version = mod.local.version;
    }

    load(): void {
        super.load();
        let mod = this.ops.mod;

        let main = new MP_Div({
            className:"mod-row-content",
            onClick:this.ops.onClick2,
            onMouseUp:this.ops.onMouseUp2,
        }).addParts(
            new MP_Text({
                text:this.name,
                marginRight:"auto"
            }),
            new MP_Text({
                text:this.version ?? ""
            }).onPostLoad(p=>{
                if(!p.e) return;
                p.e.style.textAlign = "right";
                p.e.style.color = "var(--text-dim)";
            })
        );

        this.addParts(
            new MP_Generic<HTMLImageElement>("img",{}).onPostLoad(p=>{
                if(!p.e) return;

                let e = p.e as HTMLImageElement;

                e.style.width = "25px";
                e.style.height = "25px";

                if(this.icon) e.setAttribute("full-path",this.icon);
                _loadImage(e,0);

                e.onclick = function(){
                    openImg(e);
                };
            }),
            main
        );

        this.main = main;

        this.update();
    }

    update(){
        let rowContent = this.qPart(".mod-row-content");
        if(!rowContent) return;
        let mod = this.ops.mod;
        this.updateProps();

        this.e?.classList.toggle("disabled",mod.local.file.endsWith(".disabled"));
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

async function loadFolder(folder:ModsFolder,menu:MP_TabbedMenu,search:MP_SearchStructure<FullModData>){
    let col1 = search.list;

    if(folder.type != "root") col1.addPart(
        new MP_Flexbox({
            gap:"10px",
            alignItems:"center",
            onMouseUp:(e,elm)=>{
                if(e.button != 2) return;
                window.gAPI.openDropdown("modFolder",initData.d.iid,folder.name);
            }
        }).addParts(
            new MP_Div({
                className:"material-symbols-outlined",
                innerHTML:"folder",
                fontSize:"20px",
            }).onPostLoad(p=>{
                p.e!.style.userSelect = "none";
            }),
            new MP_P({
                text:folder.name
            }),

            new MP_Flexbox({
                marginLeft:"auto",
                gap:"5px"
            }).addParts(
                // new MP_Div({
                //     className:"folder-tag",
                //     innerHTML:folder.type
                // }),
                // new MP_Div({
                //     className:"folder-tag",
                //     innerHTML:"Local"
                // })
                ...folder.tags.sort((a,b)=>a.localeCompare(b)).map(v=>new MP_Div({
                    className:"folder-tag",
                    innerHTML:v
                }))
            )
        )
    );
    
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

    for(const mod of folder.mods){
        let div = new MP_ModRow({
            mod,
            onClick2:(e,elm)=>{

            },
            onMouseUp2:async (e,elm)=>{
                if(e.button != 2) return;
                if(!sel_item) return;

                if(!sel_item.isSelected()) sel_item.toggle(e);
                let s_top = menu.main.e!.scrollTop;
                let res = await window.gAPI.dropdown.mod(initData.d.iid,[...sel_item.api.selected].map(v=>v.data.local.file));

                if(res.length){
                    for(const [name,newName] of res){
                        let d = col1.parts.filter(v=>v instanceof MP_ModRow).find((v:MP_ModRow)=>v.ops.mod.local.file == name);
                        if(!d) continue;
                        d.ops.mod.local.file = newName;
                        if(newName.endsWith(".disabled")){
                            d.e?.classList.add("disabled");
                        }
                        else{
                            d.e?.classList.remove("disabled");
                        }
                    }
                }

                menu.main.e!.scrollTop = s_top;
            }
        });

        col1.addPart(div);
        let sel_item = search.registerSelItem(mod,div.main?.e);
    }

    col1.addPart(new MP_Div({height:"30px"}));
}

interface CMP_RP_Ops extends MP_Flexbox_Ops{
    data:RP_Data;
}
interface CMP_World_Ops extends MP_Flexbox_Ops{
    data:World_Data;
}
class CMP_ResourcePackSimple extends MP_Flexbox{
    constructor(ops:CMP_RP_Ops){
        addClassToOps(ops,"mod-row");
        ops.gap = "5px";
        ops.alignItems = "center";
        ops.marginBottom = "3px";

        super(ops);
    }
    declare ops:CMP_RP_Ops;
    content = new MP_Div({className:"mod-row-content"});

    load(): void {
        super.load();

        let d = this.ops.data;
        let data = d.data;
        
        let icon = new MP_Img({
            src:getImageURL(data?.icon),
            minWidth:"25px",
            minHeight:"25px",
            width:"25px",
            height:"25px",
            className:"_loaded",
            onClick:(e,elm)=>{
                if(data?.icon) openImg(elm as HTMLImageElement);
            }
        }).addTo(this);

        let cont = this.content.addTo(this);

        let name = new MP_Text({
            text:d.name,
            marginRight:"auto"
        }).addTo(cont);
    }

    static showData(data:RP_Data,aside:MP_Div){
        let d = data;
        const {head,body,footer} = setupAside(aside);
        
        head.addParts(
            new MP_Header({text:d.name}),
            new MP_HR()
        );

        if(!data.data){ // it's currently "packed" as a zip
            body.addParts(
                new MP_P({
                    text:"The current Resource Pack is still packed a .zip file.",
                    className:"l-details"
                }),
                new MP_P({
                    text:"You must unpack it in order to edit or view it's info.",
                    className:"l-details"
                }),
                new MP_Button({
                    label:"Unpack",
                    marginTop:"20px",
                    onClick:async (e,elm)=>{
                        let res = await window.gAPI.unpackRP({iid:initData.d.iid,rpID:data.name});
                        if(res) currentSearch?.submit();
                    }
                }).autoJustify("center","center"),
            );
        }
        else{
            head.e!.style.height = "unset";
            head.parts[0].addPart(
                new MP_P({
                    text:"Pack format: "+data.data.meta?.pack.pack_format ?? "(none found)",
                    className:"l-details"
                })
            );
            head.addParts(
                new MP_Flexbox({
                    justifyContent:"space-between",
                    alignItems:"center",
                    marginBottom:"20px"
                }).addParts(
                    new MP_Button({
                        // label:"Edit",
                        label:"",
                        icon:"more_vert",
                        onClick:(e,elm)=>{
                            window.gAPI.openDropdown("rpOptions",initData.d.iid,d.name);
                        }
                    }),
                    new MP_Button({
                        // skipAdd:d.data?.sync != null,
                        label:"Upload",
                        icon:"upload",
                        onClick:(e,elm)=>{
                            window.gAPI.uploadRP({
                                iid:initData.d.iid,
                                mpID:"bob",
                                name:d.name,
                                uid:"",
                                uname:""
                            });
                        }
                    }),
                    new MP_Button({
                        // skipAdd:d.data?.sync != null,
                        label:"Download",
                        icon:"download",
                        className:"accent",
                        onClick:(e,elm)=>{
                            window.gAPI.downloadRP({
                                iid:initData.d.iid,
                                rpID:d.name,
                                mpID:"",
                                lastDownloaded:-1
                            });
                        }
                    }),//
                    // new MP_Button({
                    //     // skipAdd:d.data?.sync == null,
                    //     skipAdd:true,
                    //     label:"Sync",
                    //     icon:"sync_alt",
                    //     onClick:(e,elm)=>{
    
                    //     }
                    // })
                )
            );
            body.addParts(
                
                new MP_Img({
                    src:getImageURL(data.data.icon),
                    width:"50%"
                }).autoJustify("start","center"),
                new MP_P({
                    text:data.data.meta?.pack.description ?? "No description."
                })
            );
        }
    }
}
class CMP_World extends MP_Flexbox{
    constructor(ops:CMP_World_Ops){
        addClassToOps(ops,"mod-row");
        ops.gap = "5px";
        ops.alignItems = "center";
        ops.marginBottom = "3px";

        super(ops);
    }
    declare ops:CMP_World_Ops;
    content = new MP_Div({className:"mod-row-content"});

    load(): void {
        super.load();

        let d = this.ops.data;
        let data = d.data;
        
        new MP_Img({
            src:getImageURL(data?.icon),
            minWidth:"25px",
            minHeight:"25px",
            width:"25px",
            height:"25px",
            className:"_loaded",
            onClick:(e,elm)=>{
                if(data?.icon) openImg(elm as HTMLImageElement);
            }
        }).addTo(this);

        let cont = this.content.addTo(this);

        new MP_Text({
            text:d.wID,
            marginRight:"auto"
        }).addTo(cont);
    }

    static async showData(data:World_Data,aside:MP_Div){
        let d = data;
        const {head,body,footer} = setupAside(aside);

        let w = await window.gAPI.getWorld({
            iid:initData.d.iid,
            wID:d.wID
        });
        if(!w) return; // didn't find it or you don't have permission
        
        let updateAvailable = ((w.data?.update ?? 0) > w.yourUpdate);

        head.addParts(
            new MP_Header({}).addParts(
                new MP_Flexbox({
                    justifyContent:"space-between"
                }).addParts(
                    new MP_Text({text:d.wID}),
                    new MP_Div({
                        skipAdd:!w.data,
                        textAlign:"right"
                    }).addParts(
                        new MP_Div({
                            className:"l-desc",
                            fontSize:"11px",
                            text:"Current Version: "+((w.yourUpdate ?? 0)/10)
                        }),
                        new MP_Div({
                            className:"l-desc",
                            fontSize:"11px",
                            innerHTML:"Latest Version: "+`<span class="${updateAvailable ? "accent-text" : ""}">${((w.data?.update ?? 0)/10)}${updateAvailable?"^":""}</span>` // only dividing by 10 to make it more readable and rememberable
                        })
                    )
                ),
                new MP_P({
                    skipAdd:!w.data,
                    className:"l-desc",
                    text:"Publisher: "+w.data?.publisherName,
                    marginBottom:"0px"
                }),
                new MP_P({
                    skipAdd:!w.data,
                    className:"l-desc accent-text",
                    text:"Current Owner: "+w.data?.ownerName,
                    marginTop:"0px"
                }),
                new MP_P({
                    skipAdd:!w.data,
                    className:"l-desc",
                    text:"State: ",
                }).addParts(
                    new MP_Text({
                        text:getWorldStateText(w.state),
                    }).onPostLoad(p=>{
                        p.e!.style.textTransform = "uppercase";
                        p.e!.style.fontWeight = "bold";
                        // if(w.state == "inUse") p.e!.style.fontWeight = "bold";
                        // else p.e!.classList.add("accent-text");
                    })
                ),
                new MP_Flexbox({
                    justifyContent:"space-between",
                    skipAdd:true
                }).addParts(
                    new MP_Text({
                        text:"Your Version: "+((w.yourUpdate ?? 0)/10),
                        className:"l-desc",
                    }),
                    new MP_Text({
                        skipAdd:!w.data,
                        className:"l-desc",
                        text:"Latest: "+((w.data?.update ?? 0)/10) // only dividing by 10 to make it more readable and rememberable
                    }),
                ),
            ),
            new MP_HR()
        );

        if(!w.isPublished){ // it's unpublished
            body.addParts(
                new MP_Img({
                    src:getImageURL(d.data?.icon),
                    width:"50%"
                }).autoJustify("start","center"),
                new MP_P({
                    text:"The current world is unpublished.",
                    className:"l-details"
                }),
                new MP_P({
                    text:"Once published, anyone who has access to this modpack will be able to download the world.",
                    className:"l-details"
                }),
                new MP_Button({
                    label:"Publish",
                    marginTop:"20px",
                    onClick:async (e,elm)=>{
                        let res = await window.gAPI.publishWorld({
                            iid:initData.d.iid,
                            wID:w.wID
                        });
                        console.log("RES:",res);
                        // let res = await window.gAPI.unpackRP({iid:initData.d.iid,rpID:data.wID});
                        // if(res) currentSearch?.submit();
                    }
                }).autoJustify("center","center"),
            );
        }
        else{
            head.e!.style.height = "unset";
            head.addParts(
                new MP_Flexbox({
                    justifyContent:"space-between",
                    alignItems:"center",
                    marginBottom:"20px"
                }).addParts(
                    new MP_Button({
                        // label:"Edit",
                        label:"",
                        icon:"more_vert",
                        onClick:(e,elm)=>{
                            window.gAPI.openDropdown("worldOptions",initData.d.iid,d.wID);
                        }
                    }),
                    new MP_Button({
                        // skipAdd:d.data?.sync != null,
                        label:"Upload",
                        icon:"upload",
                        onClick:(e,elm)=>{
                            window.gAPI.uploadWorld({
                                iid:initData.d.iid,
                                wID:data.wID
                            });
                        }
                    }),
                    new MP_Button({
                        // skipAdd:d.data?.sync != null,
                        label:"Download",
                        icon:"download",
                        className:"accent",
                        onClick:(e,elm)=>{
                            window.gAPI.downloadWorld({
                                iid:initData.d.iid,
                                wID:data.wID
                            });
                        }
                    }),//
                    // new MP_Button({
                    //     // skipAdd:d.data?.sync == null,
                    //     skipAdd:true,
                    //     label:"Sync",
                    //     icon:"sync_alt",
                    //     onClick:(e,elm)=>{
    
                    //     }
                    // })
                )
            );
            body.addParts(
                new MP_Img({
                    src:getImageURL(d.data?.icon),
                    width:"50%"
                }).autoJustify("start","center"),
                new MP_P({
                    // text:data.data.meta?.pack.description ?? "No description."
                    text:"No description."
                })
            );
        }
    }
}
function setupAside(aside:MP_Div){
    let head = new MP_Div({className:"info-head"}); // or could be a section instead of div
    let body = new MP_Div({className:"info-body"});
    let footer = new MP_Div({className:"info-footer"});
    aside.addParts(head,body,footer);
    return {head,body,footer};
}

let curSection = 0;
async function loadSection(index:number,menu:MP_TabbedMenu){
    menu.aside.clearParts();

    tab_menu.aside.e!.classList.remove("hide");

    curSection = index;
    switch(index){
        case 0:{           
            let search = new MP_SearchStructure<FullModData>({
                listId:"_",
                // listId:"instance",
                submitOnOpen:true,
                onSelect:(data,item)=>{
                    let a = menu.aside;
                    if(!a.e) return;
                    a.clearParts();
                    let header = a.addPart(new MP_Div({className:"info-head"}));
                    let main = a.addPart(new MP_Div({className:"info-body"}));
                    let footer = a.addPart(new MP_Div({className:"info-footer"}));

                    header.addParts(
                        new MP_Header({
                            textContent:data.local.name
                        }),
                        new MP_Flexbox({
                            className:"info-details",
                            marginTop:"10px",
                            direction:"column",
                            gap:"3px",
                        }).addParts(
                            new MP_Div({
                                className:"l-version accent-text",
                                text:data.local.version
                            }),
                            new MP_Div({
                                className:"l-details",
                                text:data.local.file
                            }),
                        ),
                        new MP_HR()
                    );
                    main.addParts(
                        new MP_P({
                            className:"l-desc",
                            text:data.local.description
                        }),
                    );
                    footer.addParts(
                        new MP_Flexbox({
                            gap:"10px"
                        }).addParts(
                            new MP_Button({
                                skipAdd:true,
                                label:"Cache Mods",
                                onClick:async (e,elm)=>{
                                    let res = await window.gAPI.cacheMods(initData.d.iid);
                                    console.log("RES:",res);
                                }
                            }),
                            new MP_Button({
                                skipAdd:true,
                                label:"Get Index Files",
                                onClick:async (e,elm)=>{
                                    let res = await window.gAPI.getModIndexFiles({iid:initData.d.iid});
                                    console.log("RES:",res);
                                }
                            })
                        )
                    );
                },
                onNoSelected:()=>{
                    menu.aside.clearParts();
                },
                onSubmit:async (t,e,q)=>{
                    let res = await window.gAPI.getInstMods({iid:initData.d.iid,query:q});
                    console.log("RES:",res);

                    for(const folder of res.folders){
                        await loadFolder(folder,menu,search);
                    }

                    let total = res.folders.reduce((p,v,i,ar)=>p+v.mods.length,0);
                    menu.main_header.parts[0].parts[0].clearFromPoint(1);
                    let l_total = menu.main_header.parts[0].parts[0].addPart(
                        new MP_Text({
                            text:` (${total})`
                        })
                    );
                }
            });
            currentSearch = search;

            search.mainOptions = search.mainOptions.replaceWith(new MP_Flexbox({gap:"7.5px"}));
            search.mainOptions.addParts(
                new MP_Button({
                    label:"Sync",
                    className:"accent",
                    icon:"sync_alt",
                    onClick:async (e,elm)=>{
                        let res = await window.gAPI.sync.mods({iid:initData.d.iid});
                        console.log("RES:",res);
                    }
                }),
                new MP_Button({
                    label:"",
                    className:"",
                    icon:"more_vert",
                    onClick:async (e,elm)=>{
                        let res = await window.gAPI.openDropdown("editModsAdditional",initData.d.iid);
                        console.log("RES:",res);
                    }
                })
            );

            menu.main_body.addPart(search);
            console.log(search.e);
            if(search.e){
                // search.e.style.display = "grid";
                // search.e.style.gridTemplateRows = "auto 1fr";
            }
            
        } break;
        case 1:{
            let search = new MP_SearchStructure<RP_Data>({
                listId:"_",
                submitOnOpen:true,
                onSelect:(data,item)=>{
                    CMP_ResourcePackSimple.showData(data,menu.aside);
                },
                onNoSelected:()=>{
                    menu.aside.clearParts();
                },
                onSubmit:async (t,e,q)=>{
                    let res = await window.gAPI.getInstRPs({iid:initData.d.iid,filter:{query:q}});
                    console.log("RP:",res);
                    if(!res) return;

                    for(const pack of res.packs){
                        let p = new CMP_ResourcePackSimple({data:pack}).addTo(search.list);
                        let sel = search.registerSelItem(pack,p.content.e);
                        if(p.e) p.e.addEventListener("mouseup",e=>{
                            if(!sel) return;
                            if(e.button != 2) return;
                            if(!sel.isSelected()) sel.toggle(e);
                            window.gAPI.openDropdown("rpItem",initData.d.iid,pack.name);
                        });
                    }
                }
            });
            menu.main_body.addPart(search);
            currentSearch = search;

            let combo = new MP_Combobox({
                options:[
                    {
                        label:"(Local Folder)",
                        value:"_local"
                    },
                    // {
                    //     label:"High Rez Packs",
                    //     value:"high_rez_packs"
                    // },
                    // {
                    //     label:"Medieval Packs",
                    //     value:"medieval_packs"
                    // }
                ]
            });
            search.mainOptions.addParts(
                combo,
                new MP_Button({
                    label:"",
                    className:"accent",
                    icon:"add",
                    onClick:(e,elm)=>{
                        window.gAPI.openMenu("add_rp_menu",{iid:initData.d.iid});
                        // window.gAPI.getRPs({
                        //     iid:initData.d.iid
                        // });
                    }
                }),
                new MP_Button({
                    label:"",
                    icon:"more_vert",
                    onClick:(e,elm)=>{
                        // window.gAPI.genAllThePBR(initData.d.iid);
                        window.gAPI.openDropdown("rpAdditional",initData.d.iid);
                    }
                })
            );
        } break;
        case 2:{
            currentSearch = undefined;
            tab_menu.aside.e!.classList.add("hide");

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
        case 3:{
            let search = new MP_SearchStructure<World_Data>({
                listId:"_",
                submitOnOpen:true,
                onSelect:(data,item)=>{
                    CMP_World.showData(data,menu.aside);
                },
                onNoSelected:()=>{
                    menu.aside.clearParts();
                },
                onSubmit:async (t,e,q)=>{
                    let res = await window.gAPI.getInstWorlds({iid:initData.d.iid,filter:{query:q}});
                    console.log("worlds:",res);
                    if(!res) return;

                    for(const world of res.worlds){
                        let p = new CMP_World({data:world}).addTo(search.list);
                        let sel = search.registerSelItem(world,p.content.e);
                        if(p.e) p.e.addEventListener("mouseup",e=>{
                            if(!sel) return;
                            if(e.button != 2) return;
                            if(!sel.isSelected()) sel.toggle(e);
                            window.gAPI.openDropdown("worldItem",initData.d.iid,world.wID);
                        });
                    }
                }
            });
            menu.main_body.addPart(search);
            currentSearch = search;

            search.mainOptions.addParts(
                new MP_Button({
                    label:"",
                    className:"accent",
                    icon:"add",
                    onClick:(e,elm)=>{
                        window.gAPI.openMenu("add_world_menu",{iid:initData.d.iid});
                    }
                }),
                new MP_Button({
                    label:"",
                    icon:"more_vert",
                    onClick:(e,elm)=>{
                        // window.gAPI.genAllThePBR(initData.d.iid);
                        window.gAPI.openDropdown("worldsAdditional",initData.d.iid);
                    }
                })
            );
        } break;
    }
}

let currentSearch:MP_SearchStructure<any>|undefined;
window.gAPI.onUpdateSearch((data:UpdateSearch)=>{
    if(data?.iid != undefined) if(data.iid != initData.d.iid) return;
    if(data?.id != undefined){
        if(data.id == "world"){
            if(curSection != 3) return;
            if(!currentSearch?.sel.items.some((v:SAPI2_Item<World_Data>)=>v.data.wID == data.data.wID)) return;
        }
    }
    currentSearch?.submit();
});

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
    
    let path = fullPath;
    // let path = `http://localhost:57152/image/${e.getAttribute("path-name")}`;
    if(!path.startsWith("http")){
        let url1 = new URL("http://localhost:57152/image");
        url1.searchParams.set("path",fullPath);
        path = url1.href;
    }
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
        new MP_ActivityBarItem({ icon:"texture" }),
        new MP_ActivityBarItem({ icon:"landscape" }),
        new MP_ActivityBarItem({ icon:"grass" }),
            // new MP_ActivityBarItem({ icon:"park" }),
            // new MP_ActivityBarItem({ icon:"psychiatry" }),
            // new MP_ActivityBarItem({ icon:"potted_plant" }),
        new MP_ActivityBarItem({ icon:"coffee" }),
        new MP_ActivityBarItem({ icon:"settings" }),
    );

    tab_menu.postSetup();
}