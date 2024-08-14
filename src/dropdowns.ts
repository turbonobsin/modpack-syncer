import { BrowserWindow, dialog, ipcMain, Menu, MenuItemConstructorOptions, nativeImage, shell } from "electron";
import { appPath, cleanModName, cleanModNameDisabled, dataPath, getMainAccount, getModpackInst, getStandardInstData, initDB } from "./db";
import { errors, Result } from "./errors";
import { ETL_Generic, evtTimeline, util_cp, util_lstat, util_mkdir, util_note, util_readJSON, util_readText, util_readTOML, util_rename, util_rm, util_warn, util_writeJSON, util_writeText } from "./util";
import path from "path";
import { electron } from "process";
import { checkForModUpdates, downloadRP, downloadWorld, genAllThePBR, getInstMods_old, getModIndexFiles, getWorld, launchInstance, takeWorldOwnership, unpublishWorld, uploadWorld } from "./app";
import { openCCMenu } from "./menu_api";
import { Arg_FinishUploadWorld, Arg_UnpublishRP, IMO_Combobox, IMO_Input, IMO_MultiSelect, InputMenu_InitData, ModsFolderDef, Res_InputMenu, UpdateProgress_InitData } from "./interface";
import { semit } from "./network";

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
                        // icon:folderIcon,
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

                            // w.reload(); // temp for now
                            w.webContents.send("updateSearch");
                        }
                    });
                }

                return ar;
            })()
        },
        {
            label:"Show in Explorer",
            click:()=>{
                let prismPath = inst.getPrismInstPath();
                if(!prismPath) return errors.failedToGetPrismInstPath.unwrap();
                
                shell.showItemInFolder(path.join(prismPath,".minecraft","mods",files[files.length-1] ?? ""));
            }
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
                                // _w.reload();
                                _w.webContents.send("updateSearch");
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
        },
        {
            label:"Show in Explorer",
            click:()=>{
                let prismPath = inst.getPrismInstPath();
                if(!prismPath) return errors.failedToGetPrismInstPath.unwrap();
                
                shell.showItemInFolder(path.join(prismPath,".minecraft","mods"));
            }
        },
        {
            label:"Get Full Mod Info",
            click:async ()=>{
                if(!inst.meta) return;
                let w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid:inst.meta.iid});
                await getInstMods_old({iid:inst.meta.iid});
                w?.close();
                _w.reload();
                // _w.webContents.send("updateSearch");
            }
        },
        {
            label:"Gen Server Mods",
            click:async ()=>{
                if(!inst.meta) return;

                let w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid:inst.meta.iid});
                if(!w) return errors.failedNewWindow.unwrap();
                w.webContents.send("updateProgress","main",0,100,"Initializing...");
                // 
                
                let res = (await getModIndexFiles({iid:inst.meta.iid})).unwrap();
                if(!res) return;

                util_note("RES");
                // console.log(res.client,res.server);
                // 

                let prismPath = inst.getRoot();
                if(!prismPath) return errors.failedToGetPrismInstPath.unwrap();

                // 
                let serverNeeded = res.server.required.concat(res.server.optional);
                let instPath = path.join(inst.filePath,"..");
                let serverPath = path.join(instPath,"servers","main");
                let serverModsPath = path.join(serverPath,"mods");

                await util_rm(serverModsPath,true); // remove old mods before creating new mods
                await util_mkdir(serverModsPath,true);
                
                let completed:string[] = [];
                let failed:string[] = [];
                for(const name of serverNeeded){
                    let res = await util_cp(path.join(prismPath,"mods",name),path.join(serverModsPath,name));
                    if(res) completed.push(name);
                    else failed.push(name);
                    w.webContents.send("updateProgress","main",completed.length+failed.length,serverNeeded.length,name);
                }

                w.webContents.send("updateProgress","main",serverNeeded.length,serverNeeded.length,"Finished.",{
                    sections:[
                        {
                            header:`Failed: (${failed.length})`,
                            text:failed
                        },
                        {
                            header:`Completed: (${completed.length})`,
                            text:completed
                        }
                    ]
                });
            }
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
                            // _w.reload();
                            _w.webContents.send("updateSearch");
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
                            // _w.reload();
                            _w.webContents.send("updateSearch");
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
                        iid,name:rpID,mpID:inst.meta!.meta.id,uid:user.profile.id,uname:user.profile.name,force:true
                    });
                }
            },
            {
                label:"Force Download All",
                click:()=>{
                    downloadRP({
                        iid,mpID:inst.meta!.meta.id,
                        rpID,lastDownloaded:-1,force:true
                    });
                }
            },
            {
                label:"Unpublish",
                click:async ()=>{
                    let res = (await semit<Arg_UnpublishRP,boolean>("unpublishRP",{
                        mpID:inst.meta!.meta.id,
                        rpID,
                        uid:user.profile.id
                    })).unwrap();
                    dialog.showMessageBox({
                        message:res ? "Unpublish Success" : "Unpublish Failed"
                    });
                }
            }
        ]);

        menu.popup({window:_w});
    },
    rpItem:async (_w:BrowserWindow,iid:string,rpID:string)=>{
        let inst = await getModpackInst(iid);
        if(!inst || !inst.meta) return;

        let loc = inst.getPrismInstPath();
        if(!loc) return errors.failedToGetPrismInstPath.unwrap();
        loc = path.join(loc,".minecraft","resourcepacks",rpID);
        let loc1 = loc;

        if(await util_lstat(path.join(loc,"assets"))) loc = path.join(loc,"assets");

        let menu = Menu.buildFromTemplate([
            {
                label:"Show in Explorer",
                click:()=>{
                    shell.showItemInFolder(loc);
                }
            },
            {
                label:"Remove",
                click:async ()=>{
                    let res = await dialog.showMessageBox({
                        message:`Are you sure you want to remove this resouce pack?\n\nIt will be moved to the "resourcepacks/.deleted" folder.`,
                        buttons:["Cancel","Remove"]
                    });
                    if(res.response != 1) return;

                    await util_mkdir(path.join(loc1,"..",".deleted"));
                    let res2 = await util_rename(loc1,path.join(loc1,"..",".deleted",rpID));
                    if(!res2) errors.failedToRemoveRP.unwrap();
                    else _w.webContents.send("updateSearch");
                }
            }
        ]);

        menu.popup({window:_w});
    },
    rpAdditional:async (_w:BrowserWindow,iid:string)=>{
        let inst = await getModpackInst(iid);
        if(!inst || !inst.meta) return;

        const menu = Menu.buildFromTemplate([
            {
                label:"Generate Auto PBR (Experimental)",
                click:()=>{
                    genAllThePBR(inst.meta!.iid,inst);
                }
            },
            {
                label:"Show in Explorer",
                click:()=>{
                    let root = inst.getRoot();
                    if(!root) return;
                    shell.showItemInFolder(path.join(root,"resourcepacks"));
                }
            }
        ]);
        
        // 
        menu.popup({window:_w});
    },
    worldsAdditional:async (_w:BrowserWindow,iid:string)=>{
        let inst = await getModpackInst(iid);
        if(!inst || !inst.meta) return;

        const menu = Menu.buildFromTemplate([
            {
                label:"Show in Explorer",
                click:()=>{
                    let root = inst.getRoot();
                    if(!root) return;
                    shell.showItemInFolder(path.join(root,"saves"));
                }
            }
        ]);
        
        // 
        menu.popup({window:_w});
    },
    worldItem:async (_w:BrowserWindow,iid:string,wID:string)=>{
        let inst = await getModpackInst(iid);
        if(!inst || !inst.meta) return;

        let loc = inst.getPrismInstPath();
        if(!loc) return errors.failedToGetPrismInstPath.unwrap();
        loc = path.join(loc,".minecraft","saves",wID);
        let loc1 = loc;

        let menu = Menu.buildFromTemplate([
            {
                label:"Show in Explorer",
                click:()=>{
                    shell.showItemInFolder(loc);
                }
            },
            {
                label:"Remove",
                click:async ()=>{
                    let res = await dialog.showMessageBox({
                        message:`Are you sure you want to remove this world?\n\nIt will be moved to the "saves/.deleted" folder.`,
                        buttons:["Cancel","Remove"]
                    });
                    if(res.response != 1) return;

                    await util_mkdir(path.join(loc1,"..",".deleted"));
                    let tar = path.join(loc1,"..",".deleted",wID);
                    await util_rm(path.join(loc1,"..",".deleted",wID),true); // delete it so if deleted again it won't error, or is this bad?
                    let res2 = await util_rename(loc1,tar);
                    if(!res2) errors.failedToRemoveWorld.unwrap();
                    else _w.webContents.send("updateSearch");
                }
            }
        ]);

        menu.popup({window:_w});
    },
    worldOptions:async (_w:BrowserWindow,iid:string,wID:string)=>{
        let inst = await getModpackInst(iid);
        if(!inst || !inst.meta) return;

        let user = await getMainAccount();
        if(!user) return;

        let wMeta = inst.meta.worlds.find(v=>v.wID == wID);
        if(!wMeta) return;
        let world = await getWorld({
            iid,wID,mpID:inst.meta.meta.id
        });
        if(!world) return;

        console.log(">> NOTE: ",world.data?.ownerName,world.data?.publisherName);

        let menu = Menu.buildFromTemplate([
            // {
            //     label:"Launch",
            //     click:()=>{
            //         launchInstance(iid);
            //     }
            // },
            {
                label:"Take Ownership",
                enabled:world.data?.ownerName != user.profile.name,
                click:()=>{
                    takeWorldOwnership({
                        iid,wID,
                        uid:user.profile.id,
                        uname:user.profile.name
                    });
                }
            },
            {
                label:"Upload",
                click:()=>{
                    uploadWorld({iid,wID});
                }
            },
            {
                label:"Download",
                click:()=>{
                    downloadWorld({iid,wID});
                }
            },
            {
                type:"separator"
            },
            {
                label:"Force Upload",
                click:()=>{
                    uploadWorld({iid,wID},false);
                }
            },
            {
                label:"Force Download",
                click:()=>{
                    downloadWorld({iid,wID},false);
                }
            },
            {
                type:"separator"
            },
            {
                label:"Unpublish",
                click:async ()=>{
                    let res = await dialog.showMessageBox({
                        message:"Are you sure you want to unpublish this world?\n\nYou can only do this if you were the original publisher of the world.\n\nProceed with caution, this could cause unexpected issues.",
                        buttons:["Cancel","Unpublish"]
                    });
                    if(res.response != 1) return;
                    unpublishWorld({
                        iid,wID
                    });
                }
            },
            {
                label:"Force Fix Broken State",
                click:async ()=>{
                    let res = await dialog.showMessageBox({
                        message:"Are you sure you want to FORCE the world into an available state?\n\nYou should only do this if an error occured when you tried to upload or download the pack and it got stuck or if there was some uncaught error after a game crash.\n\nIf not used properly it can cause world corruption.",
                        buttons:["Cancel","FORCE"]
                    });
                    if(res.response != 1) return;
                    (await semit<Arg_FinishUploadWorld,boolean>("forceFixBrokenWorldState",{
                        mpID:inst.meta!.meta.id,
                        wID,
                        uid:user.profile.id,
                        uname:user.profile.name
                    })).unwrap();
                }
            }
        ]);

        menu.popup({window:_w});
    },
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
            // console.log(">> disable");
            newName = filename+".disabled";
            let res = await util_rename(path.join(a.modsPath,filename),path.join(a.modsPath,newName));
            if(!res) return Result.err("Failed to disable mod");
        }
        else{ // enable
            // console.log(">> enable");
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