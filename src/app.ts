// app.ts

import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import { mainWindow } from "./main";

export async function preInit(){
    console.log("pre init");
    
    ipcMain.handle("fsTest",async (ev,...args)=>{
        return fsTest(...args);
    });
    ipcMain.handle("getPackMeta",async (ev,...args)=>{
        return getPackMeta(args[0]);
    });
    ipcMain.handle("alert",async (ev,...args)=>{
        let w = BrowserWindow.fromWebContents(ev.sender);
        await dialog.showMessageBox(w ?? mainWindow,{
            message:args[0],
            title:"Error"
        });
    });
    ipcMain.handle("openMenu",async (ev,...args)=>{
        await openCCMenu(args[0]);
    });
    ipcMain.handle("searchPacks",async (ev,arg:Arg_SearchPacks)=>{
        return (await searchPacks(arg)).unwrap();
    });
    ipcMain.handle("searchPacksMeta",async (ev,arg:Arg_SearchPacks)=>{
        return (await searchPacksMeta(arg)).unwrap();
    });
    ipcMain.handle("addInstance",async (ev,meta:PackMetaData)=>{
        return (await addInstance(meta)).unwrap();
    });
    ipcMain.handle("getInstances",async (ev,folder?:string)=>{
        let root = path.join(app.getAppPath(),"data","instances");
        if(folder) root = path.join(root,folder);

        let instanceIds = await util_readdir(root);
        let list:InstanceData[] = [];

        for(const iid of instanceIds){
            let inst = await new ModPackInst(path.join(root,iid,"meta.json")).load();
            if(!inst){
                util_warn(iid+": failed to load instance");
                continue;
            }
            if(!inst.meta){
                util_warn(iid+": failed to load instance's meta");
                continue;
            }
            list.push(inst.meta);
        }

        return list;
    });
    ipcMain.handle("linkInstance",async (ev,iid:string)=>{
        if(!await ensurePrismLinked(getWindow(ev))) return;
        
        await openCCMenu("prism_instances");

        // let inst = await getModpackInst(iid);
        // if(!inst) return;
        // if(!inst.meta) return;

        // let res = await dialog.showOpenDialog(BrowserWindow.fromWebContents(ev.sender)??mainWindow,{
        //     properties:["openDirectory"],
        //     title:"Select a Prism Instance's .minecraft folder"
        // });

        // let dirPath = res.filePaths[0];
        // if(dirPath){
        //     inst.meta.dirPath = dirPath;
        //     await inst.save();
        // }

        // return dirPath;
    });

    // prism instances
    ipcMain.handle("getPrismInstances",async (ev,arg:Arg_GetPrismInstances)=>{
        return (await getPrismInstances(getWindow(ev))).unwrap();
    });
}

async function getPrismInstances(w=mainWindow):Promise<Result<Res_GetPrismInstances>>{
    if(!sysInst.meta) return errors.noSys;

    if(!await ensurePrismLinked(w)) return errors.noPrismRoot;

    if(!sysInst.meta.prismRoot) return errors.noPrismRoot;

    let data:Res_GetPrismInstances = {
        list:[]
    };

    let instancePath = path.join(sysInst.meta.prismRoot,"instances");
    let groupData = await util_readJSON<InstGroups>(path.join(instancePath,"instgroups.json"));
    if(!groupData){
        return errors.instgroupsRead;
    }
    
    console.log("GROUP DATA:",groupData);

    let keys = Object.keys(groupData.groups);
    for(const group of keys){
        let gdata = groupData.groups[group];

        for(const inst of gdata.instances){
            let cfg = parseCFGFile(await util_readText(path.join(instancePath,inst,"instance.cfg")));
            if(!cfg){
                util_warn("Failed to read pack config: "+inst);
                continue;
            }
            let mmc = await util_readJSON<MMCPack>(path.join(instancePath,inst,"mmc-pack.json"));
            if(!mmc){
                util_warn("Failed to read pack info: "+inst);
                continue;
            }
            
            let name = cfg.getValue("name");
            if(!name){
                util_warn("Something went wrong parsing [1] "+inst);
                continue;
            }
            let totalTimePlayed = cfg.getValue("totalTimePlayed");
            if(!totalTimePlayed){
                util_warn("Something went wrong parsing [1.1] "+inst);
                continue;
            }
            let versionComp = mmc.components.find(v=>v.cachedName == "Minecraft");
            if(!versionComp){
                util_warn("Something went wrong parsing [2] "+inst);
                continue;
            }
            let loaders = ["fabric","quilt","forge","neoforge"];
            // let loaderComp = mmc.components.find(v=>v.cachedRequires != undefined && v != versionComp);
            let loaderComp = mmc.components.find(v=>loaders.some(w=>v.cachedName.toLowerCase().includes(w)));
            if(!loaderComp){
                util_warn("Something went wrong parsing [3] "+inst);
                continue;
            }

            data.list.push({
                name,
                group,
                version:versionComp.version,
                loader:loaderComp.cachedName,
                loaderVersion:loaderComp.version,
                totalTimePlayed:parseInt(totalTimePlayed)
            });
        }
    }

    return new Result(data);
}

async function ensurePrismLinked(w?:BrowserWindow|null){
    if(!w) w = mainWindow;

    if(!sysInst) return false;
    if(!sysInst.meta) return false;
    
    if(!sysInst.meta.prismRoot){
        await alertBox(w,"Prism Launcher path not set.\nPlease select your prismlauncher.exe.");
        
        let res = await dialog.showOpenDialog(w,{
            properties:["openFile"],
            filters:[
                {
                    extensions:["exe"],
                    name:"prismlauncher"
                }
            ],
            title:"Please select your prismlauncher.exe"
        });
        if(!res) return false;
        let filePath = res.filePaths[0];
        if(!filePath) return false;

        filePath = path.join(filePath,"..");
        sysInst.meta.prismRoot = filePath;
        await sysInst.save();

        await alertBox(w,"Prism Launcher file path set to:\n"+filePath,"Success");
    }
    
    return true;
}

function getWindow(ev:Electron.IpcMainInvokeEvent){
    return BrowserWindow.fromWebContents(ev.sender) ?? undefined;
}
async function alertBox(w:BrowserWindow,message:string,title="Error"){
    return await dialog.showMessageBox(w,{
        message,
        title
    });
}

// 

import { parseCFGFile, util_readdir, util_readdirWithTypes, util_readJSON, util_readText, util_warn, wait } from "./util";
import { Arg_GetPrismInstances, Arg_SearchPacks, FSTestData, InstGroups, MMCPack, PackMetaData, Res_GetPrismInstances } from "./interface";
import { getPackMeta, searchPacks, searchPacksMeta } from "./network";
import { openCCMenu, SearchPacksMenu, ViewInstanceMenu } from "./frontend/menu_api";
import { addInstance, getModpackInst, ModPackInst, sysInst } from "./db";
import { InstanceData } from "./db_types";
import { errors, Result } from "./errors";
import { readConfigFile } from "typescript";

async function fsTest(customPath?:string): Promise<FSTestData|undefined>{
    let instancePath:string;
    
    if(!customPath){
        let res = await dialog.showOpenDialog(mainWindow,{
            properties:[
                "openDirectory"
            ]
        });
        if(res.canceled){
            return;
        }
    
        instancePath = res.filePaths[0];
    }
    else instancePath = customPath;
    // 

    console.log(":: path:",instancePath);
    let instanceRootFiles = await util_readdir(instancePath);
    
    if(!instanceRootFiles.includes(".minecraft")){
        console.log("Err: folder doesn't seem to be valid. Please select a folder that contains a .minecraft folder.");
        return;
    }

    let modsFiles = (await util_readdirWithTypes(path.join(instancePath,".minecraft/mods"))).filter(v=>v.isFile());
    console.log("MODS:",modsFiles.map(v=>v.name));

    let instanceCfg = parseCFGFile(await util_readText(path.join(instancePath,"instance.cfg")));
    console.log(":: Found Instance: ",instanceCfg?.getValue("name"));

    // 
    return {
        instancePath,
        modList:modsFiles.map(v=>v.name)
    };
}

async function searchForJavaPaths(){
    let files = await util_readdirWithTypes("C:/Program Files/",true);
    for(const file of files){
        if(file.name == "javaw.exe"){
            console.log("$ found: ",file.parentPath);
        }
    }
}