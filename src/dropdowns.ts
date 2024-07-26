import { BrowserWindow, dialog, ipcMain, Menu, MenuItemConstructorOptions, nativeImage } from "electron";
import { appPath, cleanModName, cleanModNameDisabled, getMainAccount, getModpackInst, getStandardInstData, initDB } from "./db";
import { Result } from "./errors";
import { ETL_Generic, evtTimeline, util_rename, util_warn } from "./util";
import path from "path";
import { electron } from "process";
import { checkForModUpdates, downloadRP } from "./app";
import { openCCMenu } from "./menu_api";
import { IMO_Combobox, IMO_Input, IMO_MultiSelect, InputMenu_InitData, ModsFolderDef, Res_InputMenu } from "./interface";

// const folderIcon = nativeImage.createFromPath(path.join(appPath,"icons","folder.svg"));
const folderIcon = path.join(appPath,"icons","folder.png");

async function openModDropdown(w:BrowserWindow,iid:string,files:string[]){
    // let end:(changed:string[][])=>void;
    // let prom = new Promise<string[][]>(resolve=>end = resolve);
    let end:(data?:any)=>void;
    let prom = new Promise<any>(resolve=>end = resolve);

    let inst = await getModpackInst(iid);
    if(!inst || !inst.meta) return;
    
    const menu = Menu.buildFromTemplate([
        // {
        //     label: "Main Name 2",
        //     submenu: [
        //         {
        //             click: () => w.webContents.send('update-counter', 1),
        //             label: 'Increment'
        //         },
        //         {
        //             click: () => w.webContents.send('update-counter', -1),
        //             label: 'Decrement'
        //         }
        //     ]
        // }
        {
            label:"Enable / Disable",
            click:async ()=>{
                let changed:string[][] = [];
                for(const file of files){
                    let res = (await toggleModEnabled(iid,file)).unwrap();
                    if(!res) continue;
                    changed.push([file,res.newName]);
                }
                end(changed);
            }
        },
        {
            label:"Move To Folder",
            submenu:(()=>{
                let ar:MenuItemConstructorOptions[] = [];

                let folders = [...inst.meta.folders];
                folders.splice(0,0,{
                    name:"Global Folder",
                    type:"root",
                    mods:[],
                    tags:[]
                });
                let inRoot = (files.length == 1 ? !folders.some(v=>v.mods.includes(cleanModName(files[0]))) : false);
                for(const folder of folders){
                    if(files.length == 1){
                        if(folder.type == "root" && inRoot) continue;
                        if(folder.mods.includes(cleanModName(files[0]))) continue;
                    }
                    ar.push({
                        label:folder.name,
                        icon:folderIcon,
                        click:async ()=>{
                            for(const file_name of files){
                                let name = cleanModName(file_name);
                                let res = inst.addModToFolder({iid,name:folder.name,modCleaned:name,type:folder.type});
                                if(!res){
                                    dialog.showMessageBox({
                                        message:"Failed to add mod to folder: "+name
                                    });
                                    console.log("-> fail: "+name);
                                }
                                else console.log("-> success: "+name);
                            }
                            await inst.save();

                            w.reload(); // temp for now
                        }
                    });
                }

                return ar;
            })()
        }
    ])
    // Menu.setApplicationMenu(menu);
    
    menu.popup({window:w});
    return prom;
}

async function openEditModsAdditional(_w:BrowserWindow,iid:string){  
    let end:(data?:any)=>void;
    let prom = new Promise<any>(resolve=>end = resolve);

    let inst = await getModpackInst(iid);
    if(!inst || !inst.meta) return;
    
    let menu = Menu.buildFromTemplate([
        {
            label:"Sync",
            submenu:[
                {
                    label:"Check For Updates",
                    click:async ()=>{
                        await checkForModUpdates(_w,iid);
                        end();
                    }
                }
            ]
        },
        {
            label:"Folder",
            submenu:[
                {
                    label:"Create Mod Folder",
                    click:async ()=>{
                        // await openCCMenu<InputMenu_InitData>("input_menu",{cmd:"alert",args:["Hello how are you???"]});
                        // await openCCMenu<InputMenu_InitData>("input_menu",{cmd:"folder-create",args:[{}]});

                        let evt = evtTimeline.subEvt(new ETL_Generic<Res_InputMenu|undefined>("input_createFolder"));
                        let finished = false;

                        // let res = await openCCMenu<InputMenu_InitData>("input_menu",{cmd:"alert",args:["bob0"]});
                        let w = await openCCMenu<InputMenu_InitData>("input_menu",{
                            cmd:"triggerEvt",args:[evt.getId()],
                            title:"Create Mod Folder",
                            height:500,
                            sections:[
                                {
                                    options:[
                                        {
                                            type:"title",
                                            title:"Create Mod Folder"
                                        }
                                    ]
                                },
                                {
                                    options:[
                                        {
                                            type:"input",
                                            id:"name",
                                            label:"Name",
                                            inputType:"text"
                                        } as IMO_Input,
                                        {
                                            type:"combobox",
                                            id:"type",
                                            label:"Type",
                                            default:0,
                                            options:[
                                                { label:"Custom", value:"custom" },
                                            ]
                                        } as IMO_Combobox,
                                        {
                                            type:"multi_select",
                                            id:"tags",
                                            label:"Tags",
                                            options:[
                                                { label:"Local", value:"local" },
                                                // { label:"Global", value:"global" },
                                            ]
                                        } as IMO_MultiSelect,
                                    ]
                                }
                            ]
                        });
                        if(w) w.addListener("close",e=>{
                            if(finished) return;
                            if(!evt._end) return;
                            util_warn(">>>> CANCELED FROM CLOSE");
                            evt._end(undefined);
                        });

                        util_warn("-- start wait");

                        let resData = await evtTimeline.waitFor(evt);
                        finished = true;
                        
                        util_warn("----");
                        console.log("RETURN:",resData);
                        // await dialog.showMessageBox({
                        //     message:"return res"
                        // });

                        if(resData){
                            let name = resData.data.name;
                            let type = resData.data.type.value;
                            let tags = resData.data.tags;

                            if(!name || !type || !tags){
                                Result.err("Failed to get entries").unwrap();
                                end();
                                return;
                            }

                            let res = inst.createFolder({iid,name,type,tags}).unwrap();
                            if(res){
                                await inst.save();
                                _w.reload();
                            }
                            // if(res){
                            //     await inst.save();
                            // }
                            // else{
                            //     // AN ERROR MESSAGE SHOULD ALREADY DISPLAY FROM THE UNWRAP
                            //     // await dialog.showMessageBox({
                            //     //     message:"An error occured while trying to create the folder"
                            //     // });
                            // }
                        }

                        end();
                    }
                }
            ]
        }
    ]);
    menu.addListener("menu-will-close",e=>{
        end();
    });
    
    menu.popup({window:_w});

    return prom;
}

export const allDropdowns = {
    modItem:openModDropdown,
    editModsAdditional:openEditModsAdditional,
    modFolder:async (_w:BrowserWindow,iid:string,folderName:string)=>{
        let inst = await getModpackInst(iid);
        if(!inst || !inst.meta) return;

        let folder = inst.meta.folders.find(v=>v.name == folderName);
        if(!folder) return;
        
        let menu = Menu.buildFromTemplate([
            {
                label:"Edit Folder",
                click:async ()=>{
                    let evt = evtTimeline.subEvt(new ETL_Generic<Res_InputMenu|undefined>("input_editFolder"));
                    let finished = false;

                    let w = await openCCMenu<InputMenu_InitData>("input_menu",{
                        cmd:"triggerEvt",args:[evt.getId()],
                        title:"Edit Mod Folder",
                        height:500,
                        sections:[
                            {
                                options:[
                                    {
                                        type:"title",
                                        title:"Edit Mod Folder"
                                    }
                                ]
                            },
                            {
                                options:[
                                    {
                                        type:"input",
                                        id:"name",
                                        label:"Name",
                                        inputType:"text",
                                        value:folder.name
                                    } as IMO_Input,
                                    {
                                        type:"combobox",
                                        id:"type",
                                        label:"Type",
                                        default:0,
                                        options:[
                                            { label:"Custom", value:"custom" },
                                        ],
                                        selected:[folder.type]
                                    } as IMO_Combobox,
                                    {
                                        type:"multi_select",
                                        id:"tags",
                                        label:"Tags",
                                        options:[
                                            { label:"Local", value:"local" },
                                            // { label:"Global", value:"global" },
                                        ],
                                        selected:folder.tags
                                    } as IMO_MultiSelect,
                                ]
                            }
                        ]
                    });
                    if(w) w.addListener("close",e=>{
                        if(finished) return;
                        if(!evt._end) return;
                        evt._end(undefined);
                    });

                    let resData = await evtTimeline.waitFor(evt);
                    finished = true;
                    
                    util_warn("----");
                    console.log("RETURN:",resData);

                    if(resData){
                        let name = resData.data.name;
                        let type = resData.data.type.value;
                        let tags = resData.data.tags;

                        if(!name || !type || !tags){
                            Result.err("Failed to get entries").unwrap();
                            return;
                        }

                        let res = inst.editFolder({iid,folderName,name,type,tags}).unwrap();
                        if(res){
                            await inst.save();
                            _w.reload();
                        }
                    }
                }
            },
            {
                label:"Remove",
                click:async ()=>{
                    let res = await dialog.showMessageBox(_w,{
                        message:"Are you sure you want to remove the folder: "+`"${folderName}"`+"?",
                        detail:"Note: mods will not be deleted. They will be moved back into the Global Folder.",
                        buttons:["Cancel","Delete"]
                    });
                    if(res.response == 1){
                        let res = inst.removeFolder(folderName).unwrap();
                        if(res){
                            await inst.save();
                            _w.reload();
                        }
                    }
                }
            }
        ]);

        menu.popup({window:_w});
    },
    rpOptions:async (_w:BrowserWindow,iid:string,rpID:string)=>{
        let inst = await getModpackInst(iid);
        if(!inst || !inst.meta) return;

        let user = await getMainAccount();
        if(!user) return;

        let menu = Menu.buildFromTemplate([
            {
                label:"Force Upload All",
                click:()=>{
                    inst.uploadRP({
                        iid,name:rpID,mpID:inst.meta!.linkName!,uid:user.profile.id,uname:user.profile.name,force:true
                    });
                }
            },
            {
                label:"Force Download All",
                click:()=>{
                    downloadRP({
                        iid,mpID:inst.meta!.linkName!,
                        rpID,lastDownloaded:-1,force:true
                    });
                }
            }
        ]);

        menu.popup({window:_w});
    }
};

export async function toggleModEnabled(iid:string,filename:string,force?:boolean): Promise<Result<{newName:string}>>{
    console.log("TOGGLING:",filename,force);
    
    let _res = (await getStandardInstData(iid))
    let a = _res.unwrap();
    if(!a) return _res as Result<any>;

    let last_enabled = !filename.endsWith(".disabled");
    let enabled = last_enabled;
    if(force == undefined) enabled = !enabled;
    else enabled = force;

    let newName = filename;

    if(last_enabled != enabled){
        if(last_enabled){ // disable
            console.log(">> disable");
            newName = filename+".disabled";
            let res = await util_rename(path.join(a.modsPath,filename),path.join(a.modsPath,newName));
            if(!res) return Result.err("Failed to disable mod");
        }
        else{ // enable
            console.log(">> enable");
            newName = cleanModNameDisabled(filename);
            let res = await util_rename(path.join(a.modsPath,filename),path.join(a.modsPath,newName));
            if(!res) return Result.err("Failed to enable mod");
        }
    }
    
    console.log("...success!");

    // await sendUpdateMod();

    return new Result({newName});
}

async function sendUpdateMod(){
    
}