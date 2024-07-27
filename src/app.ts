// app.ts

import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import { mainWindow } from "./main";
import Seven from "node-7z";
import sevenBin from "7zip-bin";
import toml from "toml";
import { Curseforge } from "node-curseforge";

const _cf = new Curseforge("$2a$10$/vPH6A3TRcGR9ahXyWmjo.p1lcpWAYQERThrNAT6Jrl/pT4G4qh.C");
const cf_mc = _cf.get_game("minecraft");

// const pathTo7zip = sevenBin.path7za;

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
    ipcMain.handle("openMenu",async (ev,id:string,data:any)=>{
        await openCCMenu(id,data);
    });
    ipcMain.handle("openMenuCB",async (ev,...args)=>{
        let id = args[0];
        args.splice(0,1);
        await openCCMenu(id);

        ev.sender.send("initReturnCB",...args);
    });
    ipcMain.handle("triggerEvt",async (ev,id:string,data:any)=>{
        evtTimeline.exec(id,data);
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

        if(!await ensurePrismLinked(getWindow(ev))) return;

        let pack = await getModpackInst(iid);
        if(!pack) return;
        if(!pack.meta) return;
        if(!pack.meta.linkName) return;

        // let cfgPath = path.join(sysInst.meta.prismRoot,"instances",pack.meta.linkName,"instance.cfg");
        // let instCfg = parseCFGFile(await util_readText(cfgPath));
        // if(!instCfg) return;
        // instCfg.setValue("JavaPath","C:/Program Files (x86)/Minecraft Launcher/runtime/java-runtime-delta/windows-x64/java-runtime-delta/bin/javaw.exe");
        // instCfg.setValue("JavaVersion","21.0.3");
        // instCfg.setValue("OverrideJavaLocation","true");
        // await util_writeText(cfgPath,instCfg.toText());

        let cmd = `${path.join(sysInst.meta.prismRoot,"prismlauncher")} --launch "${pack.meta.linkName}"`;
        util_warn("EXEC:",cmd);
        // exec(cmd);
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
    ipcMain.handle("getInstRPs",async (ev,arg:Arg_GetInstResourcePacks)=>{
        let inst = await getModpackInst(arg.iid);
        if(!inst) return errors.couldNotFindPack.unwrap();
        
        let res = inst.getResourcePacks(arg.filter);
        if(!res) return;

        return res;
    });

    ipcMain.handle("getModIndexFiles",async (ev,arg:Arg_IID)=>{
        return (await getModIndexFiles(arg)).unwrap();
    });
    ipcMain.handle("cacheMods",async (ev,iid:string)=>{
        return (await cacheMods(iid)).unwrap();
    });
    ipcMain.handle("toggleModEnabled",async (ev,iid:string,filename:string,force?:boolean)=>{
        return (await toggleModEnabled(iid,filename,force)).unwrap();
    });

    // 
    ipcMain.handle("dropdown-mod",async (ev,iid:string,files:string[])=>{
        let w = getWindow(ev);
        if(!w) return;
        return await allDropdowns.modItem(w,iid,files);
    });
    ipcMain.handle("openDropdown",async (ev,id:string,...args:any[])=>{
        let w = getWindow(ev);
        if(!w) return;
        let f = (allDropdowns as any)[id];
        if(!f) return;
        return await f(w,...args);
    });

    // sync
    ipcMain.handle("syncMods",async (ev,arg:Arg_SyncMods)=>{
        let w = getWindow(ev);
        if(!w) return;
        return (await syncMods(w,arg.iid)).unwrap();
    });

    // 
    ipcMain.handle("getImage",async (ev,fullPath:string)=>{
        let buf = await util_readBinary(fullPath);
        return buf;
    });

    // dbSys
    ipcMain.handle("changeServerURL",async (ev)=>{
        return await changeServerURL();
    });

    // folders
    ipcMain.handle("folder-create",async (ev,arg:Arg_CreateFolder)=>{
        let inst = await getModpackInst(arg.iid);
        if(!inst) return;

        if(!inst) return false;
        
        // let res = inst.addModToFolder(arg);

        // return res;

        // NOT FINISHED
        return false;
    });
    ipcMain.handle("folder-changeType",async (ev,arg:Arg_ChangeFolderType)=>{
        // NOT FINISHED
        return false;
    });
    ipcMain.handle("folder-addMod",async (ev,arg:Arg_AddModToFolder)=>{
        let inst = await getModpackInst(arg.iid);
        if(!inst) return false;
        
        let res = inst.addModToFolder(arg);

        return res;
    });

    // resource packs
    ipcMain.handle("uploadRP",async (ev,arg:Arg_UploadRP)=>{
        let inst = await getModpackInst(arg.iid);
        if(!inst || !inst.meta) return false;

        arg.mpID = inst.meta.meta.id;

        let res = await inst.uploadRP(arg);
        return !!res;
    });
    ipcMain.handle("unpackRP",async (ev,arg:Arg_UnpackRP)=>{
        let mp = await getModpackInst(arg.iid);
        if(!mp || !mp.meta) return false;

        let prismPath = mp.getPrismInstPath();
        if(!prismPath) return errors.failedToGetPrismInstPath.unwrap();
        
        let loc = path.join(prismPath,".minecraft","resourcepacks");

        let ar = arg.rpID.split(".");
        ar.pop();
        let stream = Seven.extractFull(path.join(loc,arg.rpID),path.join(loc,ar.join(".")),{
            $bin:pathTo7zip,
            $progress:true,
            recursive:true,
        });

        let w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid:arg.iid});
        if(!w) return errors.failedNewWindow.unwrap();

        w.webContents.send("updateProgress","main",0,100,"Initializing...");

        stream.on("progress",prog=>{
            w.webContents.send("updateProgress","main",prog.percent,100,"Extracting...");
        });
        stream.on("end",()=>{
            console.log(":: Finished unpacking");
            w.close();
            ev.sender.reload();
        });
        stream.on("error",err=>{
            util_warn("ERR extracting:");
            console.log(err);
        });

        return true;
    });
    ipcMain.handle("removeRP",(ev,arg:Arg_RemoveRP)=>{
        
    });
    ipcMain.handle("downloadRP",async (ev,arg:Arg_DownloadRP)=>{
        return await downloadRP(arg);
    });
    ipcMain.handle("getRPs",async (ev,arg:ArgC_GetRPs)=>{
        let inst = await getModpackInst(arg.iid);
        if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();

        let prismRoot = inst.getPrismInstPath();
        if(!prismRoot) return errors.noPrismRoot.unwrap();
        if(!inst.meta.linkName) return errors.failedToGetPackLink.unwrap();

        let existing = await util_readdir(path.join(prismRoot,".minecraft","resourcepacks"));

        let res = (await semit<Arg_GetRPs,Res_GetRPs>("getRPs",{
            mpID:inst.meta.linkName,
            existing
        })).unwrap();
        if(!res) return;

        return res;

        // let w = await openCCMenu<AddRP_InitData>("add_rp_menu",{
        //     iid:arg.iid,
        //     data:res
        // });
        // if(!w) return errors.failedNewWindow.unwrap();
    });
    ipcMain.handle("getRPImg",async (ev,iid:string,rpID:string)=>{
        if(!sysInst.meta) return errors.noSys.unwrap();
        
        let inst = await getModpackInst(iid);
        if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();

        if(!inst.meta.linkName) return errors.failedToGetPackLink.unwrap();

        let url = new URL(sysInst.meta.serverURL);
        url.pathname = "rp_image";
        url.searchParams.set("mpID",inst.meta.linkName);
        url.searchParams.set("rpID",rpID);

        return url.href;
    });

    // more inst stuff
    ipcMain.handle("checkForInstUpdates",async (ev,iid:string)=>{
        console.log("CHECK FOR INST UPDATES:",iid);

        let window = getWindow(ev);
        if(!window) return;

        let inst = await getModpackInst(iid);
        if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();

        console.log(11);

        if(!inst.meta.linkName) return errors.failedToGetPackLink.unwrap();

        console.log(22);
        
        let res = (await semit<Arg_GetRPVersions,Res_GetRPVersions>("getRPVersions",{
            mpID:inst.meta.linkName,
            current:inst.meta.resourcepacks.map(v=>{
                return {
                    rpID:v.rpID,
                    update:v.update
                };
            })
        })).unwrap();
        if(!res) return;

        console.log("VERSIONS:",res.versions);

        let res1 = (await syncMods(window,iid,true)).unwrap();
        let modsUpToDate = res1?.upToDate;

        let proms:Promise<any>[] = [];
        for(const v of res.versions){
            proms.push(downloadRP({
                iid,lastDownloaded:-1,
                mpID:inst.meta.linkName,
                rpID:v.rpID
            }));
        }
        await Promise.all(proms);

        if(modsUpToDate && res.versions.length == 0){
            await dialog.showMessageBox({
                message:"Up to date"
            });
        }
        else{
            await dialog.showMessageBox({
                message:"Finished"
            });
        }
    });
    ipcMain.handle("updateInst",async (ev,iid:string)=>{

    });
}

export async function downloadRP(arg:Arg_DownloadRP){
    let inst = await getModpackInst(arg.iid);
    if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();

    if(!inst.meta.linkName) return errors.failedToGetPackLink.unwrap();
    
    let meta = inst.meta.resourcepacks.find(v=>v.rpID == arg.rpID);
    if(!meta){
        meta = {
            rpID:arg.rpID,
            lastModified:0,
            lastUploaded:0,
            lastDownloaded:0,
            update:-1
        };
        inst.meta.resourcepacks.push(meta);
        await inst.save();
        // return errors.couldNotFindRPMeta.unwrap();
    }
    // 

    // let cachePath = path.join(inst.getRPCachePath()!,arg.rpID+".json");
    // let cache = await util_readJSON<Record<string,RPCache>>(cachePath);
    // if(!cache) return errors.couldNotFindRPCache.unwrap(); // do I need to change this now?

    // arg.lastDownloaded = Math.min(meta.lastDownloaded,meta.lastUploaded);
    // arg.lastDownloaded = Math.max(meta.lastDownloaded,meta.lastUploaded);
    arg.lastDownloaded = meta.lastDownloaded;
    arg.mpID = inst.meta.linkName;

    // arg.data = cache;
    
    // 
    let prismRoot = inst.getPrismInstPath();
    if(!prismRoot) return errors.failedToGetPrismInstPath.unwrap();
    
    let loc = path.join(prismRoot,".minecraft","resourcepacks",arg.rpID);
    console.log("ARG:",arg);

    let w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid:arg.iid});
    if(!w) return errors.failedNewWindow.unwrap();
    w.webContents.send("updateProgress","main",0,100,"Initializing...");

    // ensure folder is created if downloading for the first time
    if(!await util_lstat(loc)){
        // force download
        arg.force = true;
    }
    
    // let stat = await util_lstat(loc);
    let resPacked = await semit<Arg_DownloadRP,Res_DownloadRP>("downloadRP",arg) as Result<Res_DownloadRP>;
    if(!resPacked){
        util_warn("---- error couldn't unpack");
        w.close();
        return errors.unknown;
    }

    let res = resPacked.unwrap();
    if(!res){
        w.close();
        return;
    }

    util_warn("ADD FILES:");
    console.log(res.add);
    util_warn("REMOVE FILES:");
    console.log(res.remove);

    // 
    let total = res.add.length+res.remove.length;
    w.webContents.send("updateProgress","main",0,total,"");

    // ensure folder is created if downloading for the first time
    if(!await util_lstat(loc)){
        await util_mkdir(loc);
    }

    // 
    let successfulFiles:ModifiedFile[] = [];
    let failed:ModifiedFile[] = [];
    let completed = 0;
    let success = 0;

    let nowTime = new Date().getTime();

    for(const file of res.add){
        w.webContents.send("updateProgress","main",completed,total,file.n);
        completed++;

        let l = file.l.substring(1);
        let subPath = path.join(loc,l);

        // let cacheMeta = cache[l];
        // if(!cacheMeta){
        //     cacheMeta = {
        //         // download:meta.lastDownloaded,
        //         // modified:meta.lastDownloaded,
        //         // upload:meta.lastDownloaded
        //         download:nowTime,
        //         modified:nowTime,
        //         upload:0
        //     };
        //     cache[l] = cacheMeta;
        // }
        // else{
        //     cacheMeta.download = nowTime;
        //     cacheMeta.modified = nowTime;
        //     // cacheMeta.upload = nowTime;
        // }

        let stat = await util_lstat(subPath);
        if(stat) if(stat.mtimeMs > Math.max(file.mt,file.bt)){ // do I need && with comparision with cacheMeta instead of stat? like cacheMeta... < Math.max(...) ?
            let altName = subPath+".__conflict";
            let num = 0;
            while(await util_lstat(altName+(num == 0 ? "" : num))){
                num++;
            }
            await util_rename(subPath,altName+(num == 0 ? "" : num));

            // check contents
            // let text1 = await util_readText(subPath);
        }
        
        let bufPACK = (await semit<Arg_DownloadRPFile,ModifiedFileData>("download_rp_file",{
            mpID:arg.mpID,
            rpName:arg.rpID,
            path:l,
        })) as Result<ModifiedFileData>;
        if(!bufPACK){
            failed.push(file);
            continue;
        }
        
        let f = bufPACK.unwrap();
        if(!f){
            failed.push(file);
            continue;
        }

        await util_mkdir(path.dirname(subPath),true);
        await util_writeBinary(subPath,Buffer.from(f.buf));
        if(stat) await util_utimes(subPath,{ atime:stat.atimeMs, btime:stat.birthtimeMs, mtime:stat.mtimeMs });
        
        success++;
        successfulFiles.push(file);
    }

    // 
    // await util_writeJSON(cachePath,cache);

    meta.lastDownloaded = new Date().getTime();
    // meta.lastUploaded = new Date().getTime();
    meta.lastModified = meta.lastDownloaded;

    meta.update = res.update;

    await inst.save();

    // w.webContents.send("updateProgress","main",total,total,"Finished.");
    // console.log("FINISHED! -- total: ",completed);
    // console.log("Success:",success);
    // console.log("Failed:",failed);

    // show results
    w.webContents.send("updateProgress","main",total,total,"Finished.",{
        sections:[
            {
                header:`Failed: (${failed.length})`,
                text:failed.map(v=>v.l)
            },
            {
                header:`Downloaded: (${successfulFiles.length})`,
                text:successfulFiles.map(v=>v.l)
            }
        ]
    });
    
    await wait(500);
    // w.close();
}

export async function changeServerURL(url?:string){
    if(!sysInst || !sysInst.meta) return errors.noSys.unwrap() ?? false;

    if(!url){
        let evt = evtTimeline.subEvt(new ETL_Generic<Res_InputMenu>("i_changeServerURL"));
        await openCCMenu<InputMenu_InitData>("input_menu",{
            cmd:"triggerEvt",args:[evt.getId()],
            title:"Set Server URL",
            width:400,
            height:400,
            sections:[
                {options:[
                    {
                        type:"title",
                        title:"Set Server URL",
                        desc:"This is the URL or IP Address of the server where your mod packs will be synced from."
                    }
                ]},
                {options:[
                    {
                        type:"input",
                        label:"URL",
                        id:"url",
                        inputType:"text",
                        value:sysInst.meta.serverURL,
                        placeholder:sysInst.meta.serverURL,
                    }
                ]}
            ]
        });
        let res = await evtTimeline.waitFor(evt);
        if(!res) return false;
        url = res.data.url;
    }
    
    if(url == undefined) return false;

    sysInst.meta.serverURL = url;
    await sysInst.save();
    updateSocketURL();
    
    return true;
}

export async function areModsUpToDate(iid:string){
    let res = (await getModUpdatesData(iid)).unwrap();
    if(!res) return;
    return res.upToDate;
}
export async function checkForModUpdates(w:BrowserWindow,iid:string){
    let res = await areModsUpToDate(iid);
    if(res == undefined){
        // await dialog.showMessageBox({
        //     message:"Something went wrong while checking for updates"
        // });
    }
    else if(res){
        await dialog.showMessageBox({
            message:"Up to date"
        });
    }
    else{
        let res2 = await dialog.showMessageBox({
            message:"This pack has updates available!",
            buttons:[
                "Cancel",
                "Sync",
            ]
        });
        if(res2.response == 1){
            syncMods(w,iid);
        }
    }
}
async function getModUpdatesData(iid:string){
    let inst = await getModpackInst(iid);
    if(!inst || !inst.meta) return errors.couldNotFindPack;
    if(!inst.meta.linkName) return errors.failedToGetPackLink;
    
    // let needsUpdate = (await checkModUpdates({id:inst.meta.linkName,update:inst.meta.update})).unwrap();
    // if(needsUpdate == undefined) return errors.responseErr;

    // if(!needsUpdate){
    //     await dialog.showMessageBox(mainWindow,{
    //         message:"Up to date"
    //     });
    //     return new Result({});
    // }

    // await dialog.showMessageBox(mainWindow,{
    //     message:"Updates available"
    // });

    let currentMods:string[] = [];
    let currentIndexes:string[] = [];
    let ignoreMods:string[] = [];

    let prismPath = inst.getPrismInstPath();
    if(!prismPath) return errors.failedToGetPrismInstPath;

    const modsPath = path.join(prismPath,".minecraft","mods");
    const indexPath = path.join(modsPath,".index");

    let _curMods = await util_readdirWithTypes(modsPath);
    let _curIndexes = await util_readdir(indexPath);
    for(const mod of _curMods){
        if(!mod.isFile()) continue;
        let cleanName = cleanModName(mod.name);
        let existingFolder = inst.meta.folders.find(v=>v.mods.includes(cleanName));
        if(existingFolder?.tags.includes("local")){
            ignoreMods.push(mod.name,cleanModNameDisabled(mod.name)); // <- TEMP FOR NOW
        }
        // currentMods.push(cleanModNameDisabled(mod.name));
        currentMods.push(mod.name);
    }
    for(const index of _curIndexes){
        currentIndexes.push(index);
    }

    let resWrapped = (await getModUpdates({
        id:inst.meta.linkName,
        currentMods,
        currentIndexes,
        ignoreMods
    }));
    let res = resWrapped.unwrap();
    if(!res) return new Result(undefined);
    // if(!res) return resWrapped ?? Result.err("Failed to get mod updates");

    let upToDate = false;
    if(
        res.indexes.add.length == 0 &&
        res.indexes.remove.length == 0 &&
        res.mods.add.length == 0 &&
        res.mods.remove.length == 0
    ){
        upToDate = true;
        // await dialog.showMessageBox(mainWindow,{
        //     message:"Up to date"
        // });
        
        // return new Result(res);
    }

    return new Result({
        res,indexPath,modsPath,ignoreMods,inst,upToDate
    });
}
async function syncMods(w:BrowserWindow,iid:string,noMsg=false): Promise<Result<Res_SyncMods|undefined>>{
    if(!sysInst.meta) return errors.noSys;
    
    let _res = await getModUpdatesData(iid);
    if(!_res) return new Result(undefined);
    let _d = _res.unwrap();
    if(!_d) return _res;
    let {res,indexPath,modsPath,ignoreMods,inst,upToDate} = _d;

    if(upToDate){
        if(!noMsg) await dialog.showMessageBox({
            message:"Up to date"
        });
        return new Result({upToDate:true});
    }

    let deletedPath = path.join(modsPath,".deleted");
    await util_mkdir(deletedPath);

    // w.webContents.send("msg","hi there!");
    let newW = await openCCMenu("update_progress_menu",{iid});
    if(newW){
        // newW.webContents.send("msg","hello 2!");
        await util_mkdir(indexPath);
        
        // await wait(500);

        let items:{
            name:string;
            ep:string;
            action:ItemAction;
            path:string;
        }[] = [];

        // 
        for(const mod of res.mods.add){
            items.push({
                name:mod,
                ep:"mod",
                action:ItemAction.add,
                path:path.join(modsPath,mod)
            });
        }
        for(const mod of res.mods.remove){
            if(ignoreMods.includes(mod)) continue;
            if(mod.includes("..")) continue; // <-- PROBABLY GOOD FOR SAFETY/SECURITY
            items.push({
                name:mod,
                ep:"mod",
                action:ItemAction.remove,
                path:path.join(modsPath,mod)
            });
        }
        for(const file of res.indexes.add){
            items.push({
                name:file,
                ep:"modindex",
                action:ItemAction.add,
                path:path.join(indexPath,file)
            });
        }
        // : GOING TO DISABLE THIS FOR NOW BC IT DOESN'T REALLY MAKE SENSE
        // for(const file of res.indexes.remove){ 
        //     if(file.includes("..")) continue;
        //     items.push({
        //         name:file,
        //         ep:"modindex",
        //         action:ItemAction.remove,
        //         path:path.join(indexPath,file)
        //     });
        // }
        // 

        let total = items.length;

        let fails:{
            name:string;
            ep:string;
            action:ItemAction;
            path:string;
        }[] = [];

        console.log(">> STARTING UPDATE");
        for(let i = 0; i < items.length; i++){
            let item = items[i];

            if(item.action == ItemAction.add){ // add
                console.log("add: ",item.path);

                let url = new URL(sysInst.meta.serverURL+"/"+item.ep);
                url.searchParams.set("id",inst.meta.linkName);
                url.searchParams.set("name",item.name);
                
                let response = await fetch(url.href);
                if(!response.ok){
                    util_warn("Failed to get file: "+item.name+" ~ "+response.statusText+" ~ "+response.status);
                    fails.push(item);
                }
                else{
                    let buf = await response.arrayBuffer();
                    await util_writeBinary(item.path,Buffer.from(buf));
                }
            }
            else{ // remove
                console.log("remove: ",item.path);

                let response = await util_rename(item.path,path.join(path.dirname(item.path),".deleted",item.name));
                // let response = await util_rm(item.path);
                if(!response){
                    util_warn("Failed to remove file: "+item.name);
                    fails.push(item);
                }
            }

            // await wait(1);
            // await wait(1000);
            
            newW.webContents.send("updateProgress","main",i+1,total,item.action == ItemAction.add ? `Downloading: ${item.name}` : `Removing: ${item.name}`);
        }
        console.log(">> FINISHED UPDATE");

        let sections:any[] = [];
        // sections.push({
        //     header:"Finished."
        // });
        let failSection:any|undefined;
        if(fails.length){
            failSection = {
                header:"Failed Items:",
                text:[]
            };
        }

        if(failSection) for(const fail of fails){
            failSection.text.push(`${fail.name} (${fail.action == ItemAction.add ? "downloading" : "removing"})`);
        }
        newW.webContents.send("updateProgress","main",total,total,"Finished.",{
            sections:sections.concat(failSection)
        });

        // auto close if success
        if(fails.length == 0){
            // await wait(1500);
            await wait(500);
            newW.close();
            w.reload();
        }
    }
    
    return new Result(res);
}
enum ItemAction{
    add,
    remove
}

async function cacheMods(iid:string): Promise<Result<any>>{
    let res = await cacheModsLocal(iid);
    if(res.err) return res;
    // res = await cacheModsRemote(iid);
    // if(res.err) return res;

    return new Result({});
}

async function cacheModsLocal(iid:string): Promise<Result<LocalModData[]>>{
    let inst = await getModpackInst(iid);
    if(!inst) return errors.couldNotFindPack;

    let prismPath = inst.getPrismInstPath();
    if(!prismPath) return errors.failedToGetPrismInstPath;

    let modsPath = path.join(prismPath,".minecraft","mods");
    if(!modsPath) return Result.err("Could not find mods path");

    let indexPath = path.join(modsPath,".index");
    console.log(":: start cache mods (local)");
    let cachePath = path.join(modsPath,".cache");
    await util_mkdir(cachePath);

    let localModCache:Map<string,LocalModInst> = new Map();

    let req = {
        indexScan:new Set<string>()
    };

    // scan
    let localMods = await util_readdirWithTypes(modsPath,false);
    for(const mod of localMods){
        if(!mod.isFile()) continue;
        // if(!mod.name.endsWith(".jar") && !mod.name.endsWith(".jar.disabled")) continue;

        let filename = cleanModName(mod.name);
        // if(filename.endsWith(".disabled")) filename = filename.replace(".disabled","");

        let slug = slugMap.getVal(filename);
        if(!slug){
            req.indexScan.add(filename);
            // continue;
        }

        localModCache.set(mod.name,await new LocalModInst(modsPath,iid,filename).load());
    }

    // temp force all mods to update slugs/.index data
    if(false) for(const [filename,local] of localModCache){
        req.indexScan.add(filename);
    }

    // extract
    if(true) for(const mod of localMods){
        if(!mod.isFile()) continue;
        // if(!mod.name.endsWith(".jar") && !mod.name.endsWith(".jar.disabled")) continue;
        
        let filename = cleanModName(mod.name);

        let info = await getMod(modsPath,mod.name);
        let ok = Object.keys(info);
        let local = localModCache.get(mod.name) as any;
        if(!local) continue;
        if(local.meta) for(const k of ok){
            local.meta[k] = info[k];
        }
        else{
            local.meta = info;
        }
    }

    // link slugs
    if(req.indexScan){
        let indexFiles = await util_readdir(indexPath);
        for(const index of indexFiles){
            let indexData = await util_readTOML<ModIndex>(path.join(indexPath,index));
            if(!indexData){
                util_warn("couldn't read pw.toml file for: "+index);
                continue;
            }

            let slug = index.replace(".pw.toml","");

            let filename = cleanModName(indexData.filename);
            // if(filename.endsWith(".disabled")) filename = filename.replace(".disabled","");
            
            slugMap.setVal(slug,filename);

            let local = localModCache.get(indexData.filename);
            if(!local) local = localModCache.get(indexData.filename+".disabled");
            if(local && local.meta){
                let m = local.meta;
                m.pw = indexData;
                m.name = indexData.name;
                m.slug = slug;
                // await local.save();
            }
            else if(local){
                console.log("Err [1]: failed to find local for saving index: ",index,indexData.filename,local != null);
                // local.meta = 
            }
            else{
                console.log("Err [2]: failed to find local for saving index: ",index,indexData.filename,local != null);
                
            }
        }

        await slugMap.save();
    }

    // save
    for(const [filename,local] of localModCache){
        await local.save();
    }

    console.log(":: FINISH cache mods (local)",localModCache.size);
    
    return new Result([...localModCache.entries()].map(v=>{
        if(v[1].meta == null) v[1].meta = {
            _formatVersion:"1",
            _type:"other",
            file:v[0],
        } as any;
        if(v[1].meta) v[1].meta.file = v[0];
        return v;
    }).map(v=>v[1].meta).filter(v=>v != null));
}

async function cacheModsRemote(iid:string): Promise<Result<RemoteModData[]>>{
    let inst = await getModpackInst(iid);
    if(!inst) return errors.couldNotFindPack;

    let prismPath = inst.getPrismInstPath();
    if(!prismPath) return errors.failedToGetPrismInstPath;

    let modsPath = path.join(prismPath,".minecraft","mods");
    if(!modsPath) return Result.err("Could not find mods path");

    let indexPath = path.join(modsPath,".index");
    console.log(":: start cache mods (remote)");

    let modCache:Map<string,RemoteModInst> = new Map();
    // 

    let req = {
        mr_needsUpdate:[] as string[],
        cf_needsUpdate:[] as string[]
    };
    
    // scan
    let indexList = await util_readdir(indexPath);
    for(const index of indexList){
        let slug = index.replace(".pw.toml","");
        
        let remote = await new RemoteModInst(slug,indexPath).load();
        if(!remote.meta) await remote.postLoad();
        modCache.set(slug,remote);

        if(!remote.meta){
            // util_warn("Couldn't find remote meta for: "+slug);

            if(remote.pw){
                if(remote.pw.update.modrinth) req.mr_needsUpdate.push(remote.pw.update.modrinth["mod-id"]);
                else if(remote.pw.update.curseforge) req.cf_needsUpdate.push(remote.pw.update.curseforge["project-id"].toString());
                else{
                    util_warn("Unknown mod update type: "+slug);
                    console.log(remote.pw);
                }
            }
            else{
                util_warn("Unknown mod: "+slug);
            }
        }
    }

    let mr_updated:string[] = [];
    let cf_updated:string[] = [];
    
    // get remote data
    let err:Result<any>|undefined;
    if(req.mr_needsUpdate.length){
        console.log(`...getting from modrinth (${req.mr_needsUpdate.length})`);
        await new Promise<void>(resolve=>{
            axios.get("https://api.modrinth.com/v2/projects",{
                params:{
                    ids:`[${req.mr_needsUpdate.map(v=>'"'+v+'"').join(",")}]`
                }
            }).then(res=>{
                for(const d of res.data as ModrinthModData[]){                
                    let remote = modCache.get(d.slug);
                    if(!remote){
                        util_warn("Failed to find remote mod cache object after receiving remote data: "+d.slug);
                        continue;
                    }
    
                    remote.meta = {
                        modrinth:d
                    };
                    mr_updated.push(d.title);
                }
                resolve();
            }).catch(reason=>{
                err = errors.responseErr;
                util_warn("HTTP Error (Modrinth): "+reason);
                resolve();
            });
        });
    }
    if(err) return err;

    if(req.cf_needsUpdate.length){
        console.log(`...getting from curseforge (${req.cf_needsUpdate.length})`);
        await new Promise<void>(async resolve=>{
            (await cf_mc)._client.get_mods(...req.cf_needsUpdate.map(v=>parseInt(v))).then(v=>{
                for(const d of v){
                    let remote = modCache.get(d.slug);
                    if(!remote){
                        util_warn("Failed to find remote mod cache object after receiving remote data: "+d.slug);
                        continue;
                    }
    
                    remote.meta = {
                        curseforge:d
                    };
                    cf_updated.push(d.name);
                }
                resolve();
            }).catch(reason=>{
                err = errors.responseErr;
                util_warn("HTTP Error (Curseforge):"+reason);
                resolve();
            });
        });
    }
    if(err) return err;

    // save
    for(const [slug,remote] of modCache){
        await remote.save();
    }

    console.log("Remote Stats (Modrinth):\nto update: "+req.mr_needsUpdate.length+" "+req.mr_needsUpdate.join(", ")+"\nupdated: "+mr_updated.length);
    console.log("Remote Stats (Curseforge):\nto update: "+req.cf_needsUpdate.length+" "+req.cf_needsUpdate.join(", ")+"\nupdated: "+cf_updated.length);

    console.log(":: FINISH cache mods (remote)",modCache.size);

    let resultList = [...modCache.entries()].map(v=>v[1].meta).filter(v=>v != null);
    // console.log("RESULT LIST:",resultList.map(v=>v.modrinth?.icon_url));
    return new Result(resultList);
    // return new Result({});
}

async function getModIndexFiles(arg:Arg_IID): Promise<Result<Res_GetModIndexFiles>>{
    if(!sysInst.meta) return errors.noSys;
    if(!sysInst.meta.prismRoot) return errors.noPrismRoot;

    let inst = await getModpackInst(arg.iid);
    if(!inst.meta) return errors.couldNotFindPack;

    let prismPath = inst.getRoot();
    if(!prismPath) return errors.failedToGetPrismInstPath;
    // 

    let indexPath = path.join(prismPath,"mods",".index");
    
    let data:Res_GetModIndexFiles = {
        modrinth:[],
        curseforge:[],

        server:{
            optional:[],
            required:[],
            unsupported:[]
        },
        client:{
            optional:[],
            required:[],
            unsupported:[]
        }
    };

    // GET MOD id's
    let modrinth_ids:{pw:string,name:string,update:ModrinthUpdate}[] = [];
    let curseforge_ids:{pw:string,name:string,update:CurseForgeUpdate}[] = [];

    let modList = await util_readdirWithTypes(indexPath,false);
    let allowedExts = ["pw.toml"];
    for(const mod of modList){
        if(!mod.isFile()) continue;

        let check = false;
        for(const ext of allowedExts){
            if(mod.name.toLowerCase().endsWith(ext)){
                check = true;
                break;
            }
        }
        if(!check) continue;

        let data = toml.parse(await util_readText(path.join(indexPath,mod.name))) as ModIndex;
        if(!data) continue;
        
        // ids.push();
        // console.log("DATA:",JSON.stringify(data,undefined,4));
        
        if(data.update.modrinth){
            modrinth_ids.push({
                pw:mod.name,
                name:data.filename,
                update:data.update.modrinth
            });
        }
        else if(data.update.curseforge){
            curseforge_ids.push({
                pw:mod.name,
                name:data.filename,
                update:data.update.curseforge
            });
        }
    }

    let start_time = performance.now();

    let err:Result<any>|undefined;

    // FETCH (Modrinth)
    if(modrinth_ids.length) await new Promise<void>(resolve=>{
        axios.get("https://api.modrinth.com/v2/projects",{
            params:{
                ids:`[${modrinth_ids.map(v=>'"'+v.update["mod-id"]+'"').join(",")}]`
            }
        }).then(res=>{
            if(res.data) data.modrinth.push(...res.data);
            resolve();
        }).catch(reason=>{
            err = errors.responseErr;
            util_warn("HTTP Error (Modrinth): "+reason);
            resolve();
        });
    });

    // FETCH (Curseforge)
    // if(curseforge_ids.length) await new Promise<void>(async resolve=>{
    //     (await cf_mc)._client.get_mods(...curseforge_ids.map(v=>v.update["project-id"])).then(v=>{
    //         if(v) data.curseforge.push(...v as any[]);
    //         resolve();
    //     }).catch(reason=>{
    //         err = errors.responseErr;
    //         util_warn("HTTP Error (Curseforge):"+reason);
    //         resolve();
    //     });
    // });
    
    // if(curseforge_ids.length) axios.get("https://api.curseforge.com/v1/mods",{
    // if(false) if(curseforge_ids.length) axios.post("https://api.curseforge.com/v1/mods",{
    //     // params:{
    //     //     // modIds:curseforge_ids.map(v=>v["project-id"]).join(',')
    //     //     modIds:`[${curseforge_ids.map(v=>'"'+v["project-id"]+'"').join(",")}]`
    //     // },
    //     data:{
    //         // modIds:`[${curseforge_ids.map(v=>+v["project-id"]).join(",")}]`
    //         // modIds:curseforge_ids.map(v=>+v["project-id"])
    //         modIds:[237307],
    //         "filterPcOnly": true
    //     },
    //     headers:{
    //         "x-api-key":CF_api_key
    //     },
    //     // onDownloadProgress: progressEvent => {
    //     //     const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
    //     //     console.log(`Download progress: ${percentCompleted}%`);
    //     // }
    // }).then(res=>{
    //     console.log("RES:",res.data);
    //     // if(res.data) data.curseforge.push(...res.data);
    //     end();
    // }).catch(reason=>{
    //     // err = errors.responseErr;
    //     err = Result.err("HTTP Error: "+reason);
    //     util_warn("ERR: "+reason);
    //     end();
    // });
    
    // let xml = new XMLHttpRequest2() as XMLHttpRequest;
    // xml.open("get",`https://api.modrinth.com/v2/projects?ids=[${modrinth_ids.map(v=>'"'+v["mod-id"]+'"').join(",")}]`);
    // xml.onload = (ev:ProgressEvent<EventTarget>)=>{
    //     if(xml.response) data.modrinth.push(...JSON.parse(xml.response));
    //     res();
    // };
    // xml.onerror = (ev:ProgressEvent<EventTarget>)=>{
    //     err = errors.responseErr;
    //     res();
    // };
    // xml.onprogress = (ev:ProgressEvent)=>{
    //     // console.log("prog: ",ev.loaded,ev.total);
    // };
    // xml.send();
    
    console.log(":: time: ",performance.now()-start_time);

    // TEST
    for(const mod of data.modrinth){
        let d = modrinth_ids.find(v=>v.update["mod-id"] == mod.id);
        if(!d) continue;

        if(mod.server_side == "optional") data.server.optional.push(d.name);
        if(mod.server_side == "required") data.server.required.push(d.name);
        if(mod.server_side == "unsupported") data.server.unsupported.push(d.name);

        if(mod.client_side == "optional") data.client.optional.push(d.name);
        if(mod.client_side == "required") data.client.required.push(d.name);
        if(mod.client_side == "unsupported") data.client.unsupported.push(d.name);
    }
    for(const mod of data.curseforge){
        let d = curseforge_ids.find(v=>v.update["project-id"] == mod.id);
        if(!d) continue;
        
        let f = mod.latestFiles[0];
        if(!f) continue;

        if(f.isServerPack) data.server.required.push(d.name);
        else data.server.unsupported.push(d.name);

        data.client.required.push(d.name);
    }

    if(err) return err;

    return new Result(data);
}
async function getInstMods(arg:Arg_GetInstMods): Promise<Result<Res_GetInstMods>>{
    if(!sysInst.meta) return errors.noSys;
    if(!sysInst.meta.prismRoot) return errors.noPrismRoot;

    let inst = await getModpackInst(arg.iid);
    if(!inst.meta) return errors.couldNotFindPack;

    let prismPath = inst.getRoot();
    if(!prismPath) return errors.failedToGetPrismInstPath;
    // 

    let localList = (await cacheModsLocal(arg.iid)).unwrap();
    let remoteList = (await cacheModsRemote(arg.iid)).unwrap();
    
    // 
    let data:Res_GetInstMods = {
        folders:[]
    };
    let rootFolder:ModsFolder = {
        name:"root",
        type:"root",
        tags:[],
        mods:[]
    };
    data.folders.push(rootFolder);

    // mod_name -> folder_name
    let _cache = new Map<string,string>();
    let _cache2 = new Map<string,ModsFolder>();
    for(const folder of inst.meta.folders){
        for(const mod of folder.mods){
            _cache.set(mod,folder.name);
        }

        let f:ModsFolder = {
            name:folder.name,
            type:folder.type,
            tags:folder.tags,
            mods:[]
        };
        data.folders.push(f);
        _cache2.set(folder.name,f);
    }
    
    let _map:Map<string,FullModData[]> = new Map();

    
    if(localList){
        for(const meta of localList){
            if(!_map.has(meta.slug)) _map.set(meta.slug,[]);
            _map.get(meta.slug)?.push({
                local:meta
            });
            // _map.set(meta.file,{
            //     local:meta
            // });
        }
    }

    if(remoteList){
        for(const meta of remoteList){
            // console.log("remote cache item: ",meta.modrinth?.title ?? meta.curseforge?.name);
            // console.log("remote cache item: ",meta.modrinth?.slug ?? meta.curseforge?.slug);
            let slug = meta.modrinth?.slug ?? meta.curseforge?.slug;
            if(!slug) continue;
            let d = _map.get(slug);
            if(!d) continue;

            // d.remote = meta;
            for(const meta2 of d){
                meta2.remote = meta;
            }
        }
    }
    else util_warn("Remote cache list was undefined");

    for(const [slug,metas] of _map){
        for(const meta of metas){
            let folderName = _cache.get(cleanModName(meta.local.file));
            if(!folderName) rootFolder.mods.push(meta);
            else{
                let folder = _cache2.get(folderName);
                if(!folder){
                    util_warn("Weird error happened, found folder name but not it's cache: "+folderName+" ~ "+meta.local.file);
                    rootFolder.mods.push(meta);
                }
                else{
                    folder.mods.push(meta);
                }
            }
        }
    }

    // let folder2:ModsFolder = {
    //     name:"Extra Folder",
    //     type:"custom",
    //     mods:data.folders[0].mods.slice(0,3)
    // };
    // data.folders.push(folder2);

    if(arg.query){
        for(const folder of data.folders){
            folder.mods = folder.mods.filter(v=>searchStringCompare(v.local.name,arg.query));
        }
    }

    for(const folder of data.folders){
        folder.mods = folder.mods.sort((a,b)=>a.local.name.localeCompare(b.local.name));
    }

    // data.mods.global.sort((a,b)=>a.local.name.localeCompare(b.local.name));

    return new Result(data);

    // await new Promise<void>(resolve=>{
    //     axios.get("https://api.modrinth.com/v2/projects");
    // });

    // let indexList = await util_readdir(path.join(prismPath,"mods",".index"));
    // let indexData:Map<string,any> = new Map();
    // let initedIndexData = false;
    // async function initIndexData(){
    //     if(!prismPath) return;
    //     if(initedIndexData) return;
    //     initedIndexData = true;

    //     for(const index of indexList){
    //         let text = await util_readText(path.join(prismPath,"mods",".index",index));
    //         if(!text) continue;
    //         let data = toml.parse(text);
    //         if(!data) continue;
    
    //         data._id = index;
    //         indexData.set(data.filename,data);
    //     }
    // }

    // const cachePath = path.join(prismPath,"mods",".cache");
    // await util_mkdir(cachePath);

    // let modList = await util_readdirWithTypes(path.join(prismPath,"mods"),false);
    // let allowedExts = [".jar",".jar.disabled"];
    // for(const mod of modList){
    //     if(!mod.isFile()) continue;

    //     let check = false;
    //     for(const ext of allowedExts){
    //         if(mod.name.toLowerCase().endsWith(ext)){
    //             check = true;
    //             break;
    //         }
    //     }
    //     if(!check) continue;
    //     // 

    //     let m = await getMod(path.join(prismPath,"mods"),mod.name);
    //     if(!m){
    //         // util_warn("Failed to getMod:",mod.name);
    //         // continue;

    //         await initIndexData();
    //         let idata = indexData.get(mod.name);
    //         // if(idata){
    //         //     console.log(`>> ${mod.name} ~ ${idata.name} ~ ${idata._id}`);
    //         // }

    //         m = {
    //             _id:idata._id,
    //             file:mod.name,
    //             name:idata.name
    //         } as ModData;
    //     }
    //     else if(!m._id){
    //         await initIndexData();
    //         let idata = indexData.get(mod.name);

    //         if(idata) m._id = idata._id;
    //     }

    //     data.mods.global.push(m);
    // }
    // // 
    // return new Result(data);
}

function getSimilarStringCount(s1?:string,s2?:string){
    if(!s1 || !s2){
        console.log(" ??? - ",s1,s2);
        return -1;
    }
    
    s1 = s1.trim().toLowerCase().replaceAll(" ","").replaceAll("-","").replaceAll("_","");
    s2 = s2.trim().toLowerCase().replaceAll(" ","").replaceAll("-","").replaceAll("_","");
    
    let s2_list = new Set(s2.split(""));
    let cnt = 0;

    for(const c of s1){
        if(s2_list.has(c)){
            s2_list.delete(c);
            cnt++;
        }
    }

    return cnt;
}

// async function getInstMods_0(arg:Arg_GetInstMods): Promise<Result<Res_GetInstMods>>{
//     if(!sysInst.meta) return errors.noSys;
//     if(!sysInst.meta.prismRoot) return errors.noPrismRoot;

//     let inst = await getModpackInst(arg.iid);
//     if(!inst.meta) return errors.couldNotFindPack;

//     let mainPath = inst.getRoot();
//     if(!mainPath) return errors.failedToGetPrismInstPath;
//     // 

//     let data:Res_GetInstMods = {
//         mods:{
//             global:[],
//             local:[]
//         }
//     };

//     let modList = await util_readdirWithTypes(path.join(mainPath,"mods"),false);
//     let allowedExts = ["jar",".jar.disabled"];
//     for(const mod of modList){
//         if(!mod.isFile()) continue;

//         let ext = mod.name.split(".").pop()?.toLowerCase();
//         if(!ext) continue;
//         let check = false;
//         for(const ext of allowedExts){
//             if(mod.name.toLowerCase().endsWith(ext)){
//                 check = true;
//                 break;
//             }
//         }
//         if(!check) continue;

//         // let m = await getMod(mod);
//         // if(!m){
//         //     util_warn("Failed to getMod:",mod.name);
//         //     continue;
//         // }
//         let m = {} as any;

//         // let _info = await toml.parse(await util_readText(path.join(mainPath,"mods",".index",)))
//         // let m = getMod2(mod.name);

//         let info:ModInfo|undefined;
        
//         let cachePath = path.join(dataPath,"cache","mods",mod.name);
        
//         if(m.__type == "fabric"){
//             info = {
//                 m,
//                 name:m.name,
//                 desc:m.description,
//                 version:m.version,
//                 authors:m.authors,
//                 loader:m.__type,
//                 icon:path.join(cachePath,m.icon.split("/").pop())
//             };
//         }
//         else if(m.__type == "forge" || m.__type == "datapack"){
//             info = {
//                 m,
//                 name:m.mods.displayName,
//                 desc:m.mods.description,
//                 version:m.mods.version,
//                 authors:(m.mods.authors ?? "").replaceAll(", ",",").split(","),
//                 loader:m.__type,
//                 icon:path.join(cachePath,(m.logoFile ?? "").split("/").pop())
//             };
//         }

//         data.mods.global.push({
//             name:mod.name,
//             info
//         });
//     }

//     return new Result(data);
// }

async function getMod(modPath:string,filename:string,update=0){
    
    // let info = 
    // let cachePath = `"${path.join(dataPath,"cache","mods")}"`;
    // let modPath = `"${path.join(mod.parentPath,mod.name)}"`;
    // let cachePath = path.join(dataPath,"cache","mods",mod.name);
    // let cachePath = path.join(modPath,".cache",filename); // THIS IS THE OLD CACHE PATH
    // let modPath = path.join(mod.parentPath,mod.name);

    let cleanName = cleanModName(filename);

    let cachePath = path.join(dataPath,"cache","mods",cleanName);

    // LOAD CACHE
    if(true) if((await util_lstat(cachePath))?.isDirectory()){
        if(update != 2){
            let data = await util_readJSON(path.join(cachePath,"info.json"));
            if(data) return data;
            else{
                util_warn("Failed to read data even though it was there!",cachePath);
            }
        }
    }

    const jarStream = Seven.extract(path.join(modPath,filename),cachePath,{
        $bin:pathTo7zip,
        recursive:true,
        $cherryPick:[
            // fabric/forge
            "fabric.mod.json",
            // "icon.png",
            "MANIFEST.MF", // not sure if I'll need this but I'll add it anyways

            // forge
            "mods.toml", // for forge mod's descriptions

            // datapack
            // "pack.png",
            "pack.mcmeta",
            "README.md"
        ]
    });

    jarStream.on('data', function (data) {
        // doStuffWith(data) //? { status: 'extracted', file: 'extracted/file.txt" }
        
        // if(data.file == "")
        // console.log("FILE:",data.file);
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
        (await util_lstat(path.join(cachePath,"mods.toml"))) != null ? "forge" :
        (await util_lstat(path.join(cachePath,"pack.png"))) != null ? "datapack" : "other";

    let iconPaths:string[] = [];
    let fabric_info:any;
    let forge_info:any;
    let datapack_info:any;
    let info1:any;
    let info:any = {};

    info.file = filename;

    if(type == "fabric"){
        try{
            fabric_info = await util_readJSON(path.join(cachePath,"fabric.mod.json")) as any;
        }
        catch(e){
            util_warn("Failed to parse FABRIC mod's info: "+e);
        }

        if(fabric_info){
            if(!fabric_info.icon) fabric_info.icon = "icon.png";
            iconPaths.push(fabric_info.icon);
            
            info1 = fabric_info;
            // 

            info.name = fabric_info.name;
            info.description = fabric_info.description;
            info.id = fabric_info.id;
            info.version = fabric_info.version;
            info.authors = fabric_info.authors;
            info.icon = path.join(cachePath,fabric_info.icon.split("/").pop());
        }
    }
    else if(type == "forge"){
        try{
            let text = await util_readText(path.join(cachePath,"mods.toml"));
            if(text) forge_info = toml.parse(text);
        }
        catch(e){
            util_warn("Failed to parse FORGE mod's info: "+e);
        }

        let modData = forge_info?.mods[0];
        if(forge_info && modData){
            // iconPath = modData.logoFile ? path.join("assets",modData.modId,modData.logoFile) : path.join("assets",modData.modId,"icon.png");
            // iconPath = modData.logoFile ? modData.logoFile : path.join("assets",modData.modId,"icon.png");
            // console.log(`>> ${modData.displayName} - ${modData.logoFile} - ${iconPath}`);
            
            info1 = forge_info;
            // 

            info.name = modData.displayName;
            info.description = modData.description;
            info.id = modData.modId;
            info.version = modData.version;
            info.authors = typeof modData.authors == "object" ? modData.authors : (modData.authors ?? "").replaceAll(", ",",").split(",");

            let logoFile = modData.logoFile ?? info1.logoFile;
            if(modData.logoFile){
                iconPaths.push(path.join("assets",info.id,...logoFile.split("/")));
                iconPaths.push(path.join("META-INF",...logoFile.split("/")));
                iconPaths.push(path.join("META-INF",logoFile.split("/").pop()));
                iconPaths.push(path.join(...logoFile.split("/")));
                iconPaths.push(path.join(logoFile.split("/").pop()));
                iconPaths.push(path.join("assets",info.id,"icon.png"));
                iconPaths.push(path.join("icon.png"));
                info.icon = path.join(cachePath,logoFile.split("/").pop());
            }
            else if(info1.logoFile){
                iconPaths.push(logoFile);
                iconPaths.push(path.join("assets",info.id,"icon.png"));
                iconPaths.push(path.join("icon.png"));
                info.icon = path.join(cachePath,logoFile.split("/").pop());
            }
            else{
                iconPaths.push(path.join("assets",info.id,"icon.png"));
                iconPaths.push(path.join("icon.png"));
                info.icon = path.join(cachePath,"icon.png");
            }
            // if(modData.logoFile) info.icon = path.join(cachePath,"assets",info.id,...modData.logoFile.split("/"));
            // else info.icon = path.join(cachePath,"assets",info.id,"icon.png");

            // console.log("logo:",info.icon,"  ~~~  ",iconPaths);
        }
    }
    else if(type == "datapack"){
        try{
            let text = await util_readText(path.join(cachePath,"mods.toml"));
            if(text) datapack_info = toml.parse(text);
        }
        catch(e){
            util_warn("Failed to parse DATAPACK's info: "+e);
        }

        let modData = datapack_info?.mods[0];
        if(datapack_info && modData){
            iconPaths = datapack_info.logoFile ?? "pack.png";
            
            info1 = datapack_info;
            // 

            info.name = modData.displayName;
            info.description = modData.description;
            info.id = modData.modId;
            info.version = modData.version;
            info.authors = typeof modData.authors == "object" ? modData.authors : (modData.authors ?? "").replaceAll(", ",",").split(",");
            if(modData.logoFile) info.icon = path.join(cachePath,modData.logoFile.split("/").pop());
            else info.icon = "pack.png";
            // else info.icon = path.join(cachePath,"assets",info.id,"pack.png");

            iconPaths = info.icon;
        }
    }
    else{ // other or just couldn't find data like with the Essential Mod & Kotlin for Forge

    }

    // if(info1){
        info._formatVersion = "1";
        info._type = type;

        info.fabric = fabric_info;
        info.forge = forge_info;
        info.datapack = datapack_info;
        
        await util_writeJSON(path.join(cachePath,"info.json"),info);
    // }

    if(true) if(iconPaths.length && iconPaths[0] != ""){
        // console.log("get icon: ",mod.name,iconPath);
        const jarStream2 = Seven.extract(path.join(modPath,filename),cachePath,{
            $bin:pathTo7zip,
            recursive:false,
            $cherryPick:[
                ...iconPaths
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

export function refreshMainWindow(){
    // mainWindow.webContents.send("refresh");
    mainWindow.webContents.reload();
    console.log("REFRESHING...",mainWindow);
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
        util_warn("PATH TO READ: ",path.join(instancePath,"instgroups.json"));
        return errors.instgroupsRead;
    }

    let namesDone:string[] = [];
    
    let keys = Object.keys(groupData.groups);
    for(let group of keys){
        let gdata = groupData.groups[group];

        for(const inst of gdata.instances){
            namesDone.push(inst);

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

    let listUngrouped = await util_readdirWithTypes(instancePath);
    let unnamedGroup = "(Ungrouped)";
    for(const folderItem of listUngrouped){
        if(folderItem.isFile()) continue;

        let inst = folderItem.name
        if(namesDone.includes(inst)) continue;

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
                group:unnamedGroup,
                version:versionComp.version,
                loader:loaderComp.cachedName,
                loaderVersion:loaderComp.version,
                totalTimePlayed:parseInt(totalTimePlayed),
                path:path.join(instancePath,inst)
            });
    }

    return new Result(data);
}

async function ensurePrismLinked(w?:BrowserWindow|null){
    if(!w) w = mainWindow;

    if(!sysInst) return false;
    if(!sysInst.meta) return false;
    
    if(!sysInst.meta.prismRoot){
        await alertBox(w,"Prism Launcher path not set.\nPlease select your prism launcher folder.");
        
        let res = await dialog.showOpenDialog(w,{
            properties:[
                "openDirectory",
                "showHiddenFiles",
            ],
            filters:[],
            title:"Please select your prism launcher folder",
            defaultPath:path.join(process.env.APPDATA!,"prismlauncher"),
        });
        if(!res) return false;
        let filePath = res.filePaths[0];
        if(!filePath) return false;

        sysInst.meta.prismRoot = filePath;
        await sysInst.save();

        await alertBox(w,"Prism Launcher folder path set to:\n"+filePath,"Success");
    }
    // process.env.HOME!, process.env.APPDATA!

    if(!sysInst.meta.prismExe){
        await alertBox(w,"Prism Launcher executable not set.\nPlease select your prismlauncher executable.");
        
        let res = await dialog.showOpenDialog(w,{
            properties:["openFile"],
            filters:[
                {
                    // extensions:["exe"],
                    extensions:[],
                    name:"prismlauncher"
                }
            ],
            title:"Please select your prismlauncher executable",
            defaultPath:path.join(process.env.APPDATA!,"..","local","programs","prismlauncher"),
        });
        if(!res) return false;
        let filePath = res.filePaths[0];
        if(!filePath) return false;

        filePath = path.join(filePath,"..");
        sysInst.meta.prismExe = filePath;
        await sysInst.save();

        await alertBox(w,"Prism Launcher executable path set to:\n"+filePath,"Success");
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

import { ETL_Generic, evtTimeline, parseCFGFile, pathTo7zip, searchStringCompare, util_lstat, util_mkdir, util_readBinary, util_readdir, util_readdirWithTypes, util_readJSON, util_readText, util_readTOML, util_rename, util_rm, util_utimes, util_warn, util_writeBinary, util_writeJSON, util_writeText, wait } from "./util";
import { AddRP_InitData, Arg_AddModToFolder, Arg_ChangeFolderType, Arg_CheckModUpdates, Arg_CreateFolder, Arg_DownloadRP, Arg_DownloadRPFile, Arg_GetInstances, Arg_GetInstMods, Arg_GetInstResourcePacks, Arg_GetInstScreenshots, Arg_GetPrismInstances, Arg_GetRPs, Arg_GetRPVersions, Arg_IID, Arg_RemoveRP, Arg_SearchPacks, Arg_SyncMods, Arg_UnpackRP, Arg_UploadRP, ArgC_GetRPs, CurseForgeUpdate, Data_PrismInstancesMenu, FSTestData, FullModData, InputMenu_InitData, InstGroups, LocalModData, MMCPack, ModData, ModifiedFile, ModifiedFileData, ModIndex, ModInfo, ModrinthModData, ModrinthUpdate, ModsFolder, ModsFolderDef, PackMetaData, RemoteModData, Res_DownloadRP, Res_GetInstMods, Res_GetInstResourcePacks, Res_GetInstScreenshots, Res_GetModIndexFiles, Res_GetPrismInstances, Res_GetRPs, Res_GetRPVersions, Res_InputMenu, Res_SyncMods, RPCache, UpdateProgress_InitData } from "./interface";
import { getModUpdates, getPackMeta, searchPacks, searchPacksMeta, semit, updateSocketURL } from "./network";
import { ListPrismInstReason, openCCMenu, openCCMenuCB, SearchPacksMenu, ViewInstanceMenu } from "./menu_api";
import { addInstance, cleanModName, cleanModNameDisabled, dataPath, getModFolderPath, getModpackInst, getModpackPath, LocalModInst, ModPackInst, RemoteModInst, slugMap, sysInst } from "./db";
import { InstanceData } from "./db_types";
import { errors, Result } from "./errors";
import { readConfigFile, StringMappingType } from "typescript";
import { getMaxListeners } from "stream";
import { exec } from "child_process";
import { Dirent } from "fs";
import { CineonToneMapping } from "three";
import axios from "axios";
import { toggleModEnabled, allDropdowns } from "./dropdowns";

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