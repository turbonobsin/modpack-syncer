// app.ts

import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import { mainWindow } from "./main";
import Seven from "node-7z";
import sevenBin from "7zip-bin";
import toml from "toml";

// const pathTo7zip = sevenBin.path7za;
const pathTo7zip = path.join(app.getAppPath(),"node_modules","7zip-bin","win","x64","7za.exe");

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
    ipcMain.handle("openMenuCB",async (ev,...args)=>{
        let id = args[0];
        args.splice(0,1);
        await openCCMenu(id);

        ev.sender.send("initReturnCB",...args);
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
    ipcMain.handle("getInstances",async (ev,arg:Arg_GetInstances)=>{
        let root = path.join(app.getAppPath(),"data","instances");
        if(arg.folder) root = path.join(root,arg.folder);

        let instanceIds = await util_readdir(root);
        let list:InstanceData[] = [];

        for(const iid of instanceIds){
            let inst = await new ModPackInst(path.join(root,iid,"meta.json")).load();
            let instData = inst.meta;
            if(!instData) continue;

            // different search indexes for searching for your modpack instances
            let searchRes:boolean[] = [];
            searchRes.push(searchStringCompare(instData.meta.name,arg.query));
            searchRes.push(searchStringCompare(instData.meta.desc,arg.query));
            searchRes.push(searchStringCompare(instData.meta.loader,arg.query));
            if(!searchRes.includes(true)) continue;

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
    ipcMain.handle("showLinkInstance",async (ev,iid:string,instName:string)=>{
        if(!await ensurePrismLinked(getWindow(ev))) return;
        
        // await openCCMenu("prism_instances");
        await openCCMenu<Data_PrismInstancesMenu>("prism_instances",{
            reason:"link",
            iid,
            instName
        });

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
    ipcMain.handle("linkInstance",async (ev,iid:string,pInstPath:string)=>{
        // should we ensure prism here?

        (await linkInstance(iid,pInstPath)).unwrap();
    });

    // prism instances
    ipcMain.handle("getPrismInstances",async (ev,arg:Arg_GetPrismInstances)=>{
        return (await getPrismInstances(getWindow(ev),arg)).unwrap();
    });
    ipcMain.handle("launchInstance",async (ev,iid:string)=>{
        // exec("notepad");
        if(!sysInst.meta) return;
        if(!sysInst.meta.prismRoot) return;

        let pack = await getModpackInst(iid);
        if(!pack) return;
        if(!pack.meta) return;
        if(!pack.meta.linkName) return;

        let cfgPath = path.join(sysInst.meta.prismRoot,"instances",pack.meta.linkName,"instance.cfg");
        let instCfg = parseCFGFile(await util_readText(cfgPath));
        if(!instCfg) return;
        instCfg.setValue("JavaPath","C:/Program Files (x86)/Minecraft Launcher/runtime/java-runtime-delta/windows-x64/java-runtime-delta/bin/javaw.exe");
        instCfg.setValue("JavaVersion","21.0.3");
        instCfg.setValue("OverrideJavaLocation","true");
        await util_writeText(cfgPath,instCfg.toText());

        let cmd = `${path.join(sysInst.meta.prismRoot,"prismlauncher")} --launch "${pack.meta.linkName}"`;
        util_warn("EXEC:",cmd);
        exec(cmd);
    });

    ipcMain.handle("showEditInstance",async (ev,iid:string)=>{
        let inst = await getModpackInst(iid);
        if(!inst || !inst.meta) return;

        await openCCMenu("edit_instance_menu",{iid});
    });

    ipcMain.handle("getInstScreenshots",async (ev,arg:Arg_GetInstScreenshots)=>{
        return (await getInstScreenshots(arg)).unwrap();
    });
    ipcMain.handle("getInstMods",async (ev,arg:Arg_GetInstMods)=>{
        return (await getInstMods(arg)).unwrap();
    });

    ipcMain.handle("getImage",async (ev,fullPath:string)=>{
        let buf = await util_readBinary(fullPath);
        return buf;
    });
}

async function getInstMods(arg:Arg_GetInstMods): Promise<Result<Res_GetInstMods>>{
    if(!sysInst.meta) return errors.noSys;
    if(!sysInst.meta.prismRoot) return errors.noPrismRoot;

    let inst = await getModpackInst(arg.iid);
    if(!inst.meta) return errors.couldNotFindPack;

    let mainPath = inst.getRoot();
    if(!mainPath) return errors.failedToGetPrismInstPath;
    // 

    let data:Res_GetInstMods = {
        mods:{
            global:[],
            local:[]
        }
    };

    let modList = await util_readdirWithTypes(path.join(mainPath,"mods"),false);
    for(const mod of modList){
        if(!mod.isFile()) continue;
        if(!mod.name.endsWith(".jar")) continue;

        let m = await getMod(mod);

        let info:ModInfo|undefined;
        
        let cachePath = path.join(dataPath,"cache","mods",mod.name);
        
        if(m.__type == "fabric"){
            info = {
                m,
                name:m.name,
                desc:m.description,
                version:m.version,
                authors:m.authors,
                loader:m.__type,
                icon:path.join(cachePath,m.icon.split("/").pop())
            };
        }
        else if(m.__type == "forge" || m.__type == "datapack"){
            info = {
                m,
                name:m.mods.displayName,
                desc:m.mods.description,
                version:m.mods.version,
                authors:m.mods.authors.replaceAll(", ",",").split(","),
                loader:m.__type,
                icon:path.join(cachePath,m.logoFile.split("/").pop())
            };
        }

        data.mods.global.push({
            name:mod.name,
            info
        });
    }

    return new Result(data);
}

async function getMod(mod:Dirent,update=0){
    
    // let info = 
    // let cachePath = `"${path.join(dataPath,"cache","mods")}"`;
    // let modPath = `"${path.join(mod.parentPath,mod.name)}"`;
    let cachePath = path.join(dataPath,"cache","mods",mod.name);
    let modPath = path.join(mod.parentPath,mod.name);

    if((await util_lstat(cachePath))?.isDirectory()){
        if(update != 2){
            return await util_readJSON(path.join(cachePath,"m_info.json"));
        }
    }

    // util_warn("FILE: "+modPath);
    // util_warn("CACHE_PATH: "+cachePath);
    // console.log("path:",pathTo7zip);

    const jarStream = Seven.extract(modPath,cachePath,{
        $bin:pathTo7zip,
        recursive:true,
        $cherryPick:[
            // fabric/forge
            "fabric.mod.json",
            // "icon.png",
            "MANIFEST.MF", // not sure if I'll need this but I'll add it anyways

            // forge
            "mods.toml", // for forge mod's decriptions

            // datapack
            // "pack.png",
            "pack.mcmeta",
            "README.md"
        ]
    });

    jarStream.on('data', function (data) {
        // doStuffWith(data) //? { status: 'extracted', file: 'extracted/file.txt" }
        
        // if(data.file == "")
        console.log("FILE:",data.file);
    });
        
    jarStream.on('progress', function (progress) {
        // doStuffWith(progress) //? { percent: 67, fileCount: 5, file: undefinded }
    });
    
    let res:()=>void;
    let prom = new Promise<void>(resolve=>res = resolve);
    jarStream.on('end', function () {
            // end of the operation, get the number of folders involved in the operation
        // myStream.info.get('Folders') //? '4'

        res();
    });
        
    jarStream.on('error', (err) => {
        console.log("error:",err);
    });

    //   
    
    // console.log("path:",mod.parentPath);

    await prom;

    let type = 
        (await util_lstat(path.join(cachePath,"fabric.mod.json"))) != null ? "fabric" :
        (await util_lstat(path.join(cachePath,"mods.toml"))) != null ? "forge" : "datapack";

    let iconPath:string|undefined;
    let info:any;

    if(type == "fabric"){
        info = await util_readJSON(path.join(cachePath,"fabric.mod.json")) as any;

        iconPath = info.icon;
    }
    else if(type == "forge"){
        info = toml.parse(await util_readText(path.join(cachePath,"mods.toml")));

        iconPath = info.logoFile;
    }
    else if(type == "datapack"){
        info = toml.parse(await util_readText(path.join(cachePath,"mods.toml")));

        iconPath = "pack.png";
    }

    if(info){
        info.__formatVersion = "1";
        info.__type = type;
        await util_writeJSON(path.join(cachePath,"m_info.json"),info);
    }

    if(iconPath){
        const jarStream2 = Seven.extract(modPath,cachePath,{
            $bin:pathTo7zip,
            recursive:false,
            $cherryPick:[
                iconPath
            ]
        });
        await new Promise<void>(resolve=>{
            jarStream2.on("end",()=>{
                resolve();
            });
        });
    }

    return info;
}

async function getInstScreenshots(arg:Arg_GetInstScreenshots): Promise<Result<Res_GetInstScreenshots>>{
    if(!sysInst.meta) return errors.noSys;
    if(!sysInst.meta.prismRoot) return errors.noPrismRoot;
    
    let inst = await getModpackInst(arg.iid);
    if(!inst.meta) return errors.couldNotFindPack;

    let mainPath = inst.getRoot();
    if(!mainPath) return errors.failedToGetPrismInstPath;

    let screenshotPath = path.join(mainPath,"screenshots");

    let data:Res_GetInstScreenshots = {
        list:[],
        path:screenshotPath
    };

    let list = await util_readdir(screenshotPath);
    for(const name of list){
        let fullPath = path.join(screenshotPath,name);
        // let buf = await util_readBinary(fullPath);
        // buf = buf.subarray(0,buf.length*0.5);
        data.list.push({
            name,
            path:fullPath,
            // buf
            // file:new File([],"none.png"),
            // url2:URL.createObjectURL(await (await fetch(fullPath)).blob())
        });
    }

    return new Result(data);
}

function refreshMainWindow(){
    mainWindow.webContents.send("refresh");
}

async function linkInstance(iid:string,pInstName:string):Promise<Result<undefined>>{
    let inst = await getModpackInst(iid);
    if(!inst.meta) return errors.couldNotFindPack;

    inst.meta.linkName = pInstName;
    await inst.save();

    refreshMainWindow();

    return new Result(undefined);
}

async function getPrismInstances(w=mainWindow,arg:Arg_GetPrismInstances):Promise<Result<Res_GetPrismInstances>>{
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
    
    let keys = Object.keys(groupData.groups);
    for(const group of keys){
        let gdata = groupData.groups[group];

        for(const inst of gdata.instances){
            if(arg.query) if(!searchStringCompare(inst,arg.query)) continue;

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
                // util_warn("Something went wrong parsing [2] "+inst);
                // continue;
                totalTimePlayed = "0";
            }
            let versionComp = mmc.components.find(v=>v.cachedName == "Minecraft");
            if(!versionComp){
                util_warn("Something went wrong parsing [3] "+inst);
                continue;
            }
            let loaders = ["fabric","quilt","forge","neoforge"];
            // let loaderComp = mmc.components.find(v=>v.cachedRequires != undefined && v != versionComp);
            let loaderComp = mmc.components.find(v=>loaders.some(w=>v.cachedName.toLowerCase().includes(w)));
            if(!loaderComp){
                util_warn("Something went wrong parsing [4] "+inst);
                continue;
            }

            data.list.push({
                name,
                group,
                version:versionComp.version,
                loader:loaderComp.cachedName,
                loaderVersion:loaderComp.version,
                totalTimePlayed:parseInt(totalTimePlayed),
                path:path.join(instancePath,inst)
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
                    // extensions:["exe"],
                    extensions:[],
                    name:"prismlauncher"
                }
            ],
            title:"Please select your prismlauncher executable"
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

import { parseCFGFile, searchStringCompare, util_lstat, util_readBinary, util_readdir, util_readdirWithTypes, util_readJSON, util_readText, util_warn, util_writeJSON, util_writeText, wait } from "./util";
import { Arg_GetInstances, Arg_GetInstMods, Arg_GetInstScreenshots, Arg_GetPrismInstances, Arg_SearchPacks, Data_PrismInstancesMenu, FSTestData, InstGroups, MMCPack, ModData, ModInfo, PackMetaData, Res_GetInstMods, Res_GetInstScreenshots, Res_GetPrismInstances } from "./interface";
import { getPackMeta, searchPacks, searchPacksMeta } from "./network";
import { ListPrismInstReason, openCCMenu, openCCMenuCB, SearchPacksMenu, ViewInstanceMenu } from "./menu_api";
import { addInstance, dataPath, getModpackInst, ModPackInst, sysInst } from "./db";
import { InstanceData } from "./db_types";
import { errors, Result } from "./errors";
import { readConfigFile } from "typescript";
import { getMaxListeners } from "stream";
import { exec } from "child_process";
import { Dirent } from "fs";

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