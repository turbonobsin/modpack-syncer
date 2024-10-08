// app.ts

import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import path from "path";
import { mainWindow } from "./main";
import Seven, { extract } from "node-7z";
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
        let acc = await getMainAccount();
        if(!acc) return;
        
        arg.uid = acc.profile.id;
        arg.uname = acc.profile.name;
        
        return (await searchPacks(arg)).unwrap();
    });
    ipcMain.handle("searchPacksMeta",async (ev,arg:Arg_SearchPacks)=>{
        let acc = await getMainAccount();
        if(!acc) return;
        
        arg.uid = acc.profile.id;
        arg.uname = acc.profile.name;
        
        return await searchPacksMeta(arg);
    });
    ipcMain.handle("addInstance",async (ev,arg:Arg_AddInstance)=>{
        return (await addInstance(arg)).unwrap();
    });
    ipcMain.handle("getInstances",async (ev,arg:Arg_GetInstances)=>{
        let root = path.join(dataPath,"instances");
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

            let prismRoot = inst.getRoot();
            if(prismRoot){
                let cfg = parseCFGFile(await util_readText(path.join(prismRoot,"..","instance.cfg")));
                if(!cfg){
                    util_warn("Failed to read pack config: "+inst);
                    inst.meta.loc = path.join(prismRoot,"icon.png");
                }
                else{
                    let iconKey = cfg.getValue("iconKey");
                    let iconPath = path.join(sysInst.meta!.prismRoot!,"icons",iconKey+".png");
                    if(!await util_lstat(iconPath)) inst.meta.loc = path.join(prismRoot,"icon.png");
                    else inst.meta.loc = iconPath;
                }               
            }
            else inst.meta.loc = "";
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
        return await launchInstance(iid,ev);
    });

    ipcMain.handle("showEditInstance",async (ev,iid:string)=>{
        let inst = await getModpackInst(iid);
        if(!inst || !inst.meta) return;

        await openCCMenu("edit_instance_menu",{iid,mpID:inst.meta.meta.id});
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
    ipcMain.handle("getInstWorlds",async (ev,arg:Arg_GetInstWorlds)=>{        
        let res = getWorlds(arg.iid,arg.filter);
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

        let wasError = false;

        await new Promise<void>(resolve=>{
            stream.on("progress",prog=>{
                w.webContents.send("updateProgress","main",prog.percent,100,"Extracting...");
            });
            stream.on("end",()=>{
                console.log(":: Finished unpacking");
                w.close();
                // ev.sender.reload();
                resolve();
            });
            stream.on("error",err=>{
                util_warn("ERR extracting:");
                console.log(err);
                wasError = true;
                resolve(); // I'm adding this here because I'm not sure if "end" will get called if there is an error
            });
        });

        if(!wasError){ // success
            await util_mkdir(path.join(loc,".deleted"));
            await util_rename(path.join(loc,arg.rpID),path.join(loc,".deleted",arg.rpID));
        }

        return !wasError;
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
        // if(!inst.meta.meta.id) return errors.failedToGetPackLink.unwrap();

        let existing = await util_readdir(path.join(prismRoot,".minecraft","resourcepacks"));

        let res = (await semit<Arg_GetRPs,Res_GetRPs>("getRPs",{
            mpID:inst.meta.meta.id,
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

        if(!inst.meta.meta.id) return errors.failedToGetPackLink.unwrap();

        let url = new URL(sysInst.meta.serverURL.replaceAll("\\","/"));
        url.pathname = "rp_image";
        url.searchParams.set("mpID",inst.meta.meta.id);
        url.searchParams.set("rpID",rpID);

        return url.href;
    });

    // more inst stuff
    ipcMain.handle("checkForInstUpdates",async (ev,iid:string)=>{
        return await checkForInstUpdates(iid);
    });
    // ipcMain.handle("updateInst",async (ev,iid:string)=>{

    // });
    ipcMain.handle("removeInst",async (ev,iid:string)=>{
        let inst = await getModpackInst(iid);
        if(!inst) return;

        let w = getWindow(ev);
        if(!w) return;

        let confirmRes = await dialog.showMessageBox(w,{
            message:`This instance will be moved to the "instances_deleted" folder.\n\nNote: THIS DOES NOT AFFECT THE PRISM INSTANCE FILES.`,
            buttons:["Cancel","Remove"]
        });
        if(confirmRes.response != 1) return;

        let loc = path.dirname(inst.filePath);
        let res = await util_cp(loc,path.join(loc,"..","..","instances_deleted",iid),true);
        if(res){
            res = await util_rm(loc,true);
        }
        if(res){
            instCache.modpack.delete(inst.filePath);
        }

        refreshMainWindow();

        return new Result(res);
    });
    ipcMain.handle("unlinkInst",async (ev,iid:string)=>{
        let inst = await getModpackInst(iid);
        if(!inst || !inst.meta) return;

        inst.meta.linkName = undefined;
        await inst.save();

        refreshMainWindow();

        return new Result(true);
    });
    ipcMain.handle("genAllThePBR",async (ev,iid:string)=>{
        let inst = await getModpackInst(iid);
        return await genAllThePBR(iid,inst);
    });
    ipcMain.handle("getTheme",async (ev)=>{
        return sysInst.meta?.theme;
    });

    // worlds
    ipcMain.handle("getWorld",async (ev,arg:Arg_GetWorldInfo)=>{
        return await getWorld(arg);
    });
    ipcMain.handle("publishWorld",async (ev,arg:Arg_PublishWorld)=>{
        if(!arg.iid) return errors.invalid_args.unwrap();

        let inst = await getModpackInst(arg.iid);
        if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();
        // 

        let prismLoc = inst.getRoot();
        if(!prismLoc) return errors.failedToGetPrismInstPath.unwrap();

        let saveLoc = path.join(prismLoc,"saves",arg.wID);
        if(!await util_lstat(saveLoc)) return errors.worldDNE;

        let allowedDirs = [
            "data",
            "datapacks",
            "DIM1",
            "DIM-1",
            "dimensions",
            "entities",
            "integratedscripting",
            "poi",
            "region",
            // maybe? -----
            "serverconfig",
            "advancements",
            "stats"
        ];

        let acc = await getMainAccount();
        if(!acc) return;

        let res = (await semit<SArg_PublishWorld,boolean>("publishWorld",{
            mpID:inst.meta.meta.id,
            wID:arg.wID,
            allowedDirs,
            ownerUID:acc.profile.id,
            ownerName:acc.profile.name
        })).unwrap();
        if(!res) return errors.failedToPublishWorld;

        // res.yourName = acc.profile.name;

        let w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid:arg.iid});
        if(!w) return errors.failedNewWindow.unwrap();

        util_note("STARTED publishing world...");
        w.webContents.send("updateProgress","main",0,1,"Initializing...");

        let completed = 0;
        let total = 0;

        let files:{
            loc:string;
            sloc:string;
            name:string;
        }[] = [];
        let failed:string[] = [];
        let success:string[] = [];

        // let rootList = await util_readdir(saveLoc);
        let loop = async (loc:string,sloc:string)=>{
            let list = await util_readdirWithTypes(loc);
            for(const item of list){
                if(item.isDirectory()){
                    await loop(path.join(loc,item.name),path.join(sloc,item.name));
                    continue;
                }
                total++;
                files.push({
                    loc:path.join(loc,item.name),
                    sloc:path.join(sloc,item.name),
                    name:item.name
                });
            }
        };
        // for(const f of rootList){
        //     // if(!allowedDirs.includes(f)) continue; // THIS IS DISABLED FOR THE FIRST PUBLISH AND FIRST DOWNLOAD
        //     await loop(path.join(saveLoc,f),f);
        // }
        await loop(path.join(saveLoc),"");

        for(const {loc,sloc,name} of files){
            let buf = await util_readBinary(loc);
            if(!buf){
                failed.push(sloc);
                continue;
            }
            
            let fres = (await semit<Arg_UploadWorldFile,boolean>("upload_world_file",{ // file res
                buf,
                mpID:inst.meta.meta.id,
                path:sloc,
                uid:acc.profile.id,
                uname:acc.profile.name,
                wID:arg.wID
            })).unwrap();
            if(!fres){
                failed.push(sloc);
                continue;
            }

            // console.log("Upload: "+sloc);
            w.webContents.send("updateProgress","main",completed,total,"Upload: "+name);
            completed++;
            success.push(sloc);
        }

        w.webContents.send("updateProgress","main",completed,total,"Finished.",{
            sections:[
                {
                    header:`Failed: (${failed.length})`,
                    items:failed
                },
                {
                    header:`Success: (${success.length})`,
                    items:success
                }
            ]
        });

        util_note("FINISHED publishing world...");
        if(failed.length == 0) w.close();
        else{
            let res1 = (await semit<Arg_UnpublishWorld,boolean>("unpublishWorld",{
                mpID:inst.meta.meta.id,
                uid:acc.profile.id,
                wID:arg.wID
            })).unwrap();
            if(!res1) return errors.failedToUnpublishWorld;
            return;
        }

        let w2 = getWindowStack().find(v=>v.title == "Edit Instance");
        if(w2) w2.webContents.send("updateSearch");

        return new Result(true);
    });
    ipcMain.handle("uploadWorld",async (ev,arg:Arg_UploadWorld)=>{
        return await uploadWorld(arg);
    });
    ipcMain.handle("downloadWorld",async (ev,arg:Arg_DownloadWorld,useTime=true)=>{
        // if(arg.forceAllFiles) useTime = false; // might not need this
        return await downloadWorld(arg,useTime);
    });
    ipcMain.handle("getServerWorlds",async (ev,arg:Arg_GetServerWorlds)=>{
        if(!arg.iid) return errors.invalid_args.unwrap();

        let inst = await getModpackInst(arg.iid);
        if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();

        let prismRoot = inst.getRoot();
        if(!prismRoot) return errors.failedToGetPrismInstPath.unwrap();
        
        let existing = await util_readdir(path.join(prismRoot,"saves"));
        // let existing = inst.meta.worlds.map(v=>v.wID); // even though this is faster, if the user changes the name of a world manually or deletes it manually then it may be screwed up
        
        let res = (await semit<SArg_GetServerWorlds,Res_GetServerWorlds>("getServerWorlds",{
            existing,
            mpID:inst.meta.meta.id
        })).unwrap();
        if(!res) return;

        for(const w of res.list){
            w.icon = path.join(prismRoot,"saves",w.wID,"icon.png");
        }

        return res;
    });
    ipcMain.handle("getWorldImg",async (ev,iid:string,wID:string)=>{
        if(!sysInst.meta) return errors.noSys.unwrap();
        
        let inst = await getModpackInst(iid);
        if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();

        if(!inst.meta.meta.id) return errors.failedToGetPackLink.unwrap();

        let url = new URL(sysInst.meta.serverURL.replaceAll("\\","/"));
        url.pathname = "world_image";
        url.searchParams.set("mpID",inst.meta.meta.id);
        url.searchParams.set("wID",wID);

        return url.href;
    });
    ipcMain.handle("takeWorldOwnership",async (ev,arg:Arg_TakeWorldOwnership)=>{
        return await takeWorldOwnership(arg);
    });
    ipcMain.handle("toggleWorldEnabled",async (ev,arg:Arg_ToggleWorldEnabled)=>{
        return await toggleWorldEnabled(arg);
    });
    ipcMain.handle("getRPInfo",async (ev,iid:string,rpID:string)=>{
        // if(!getConnectionStatus()) return;
        return await getRPInfo(iid,rpID);
    });
}

export async function checkForInstUpdates(iid:string,ev?:Electron.IpcMainInvokeEvent,ignoreWorlds=false){
    console.log("CHECK FOR INST UPDATES:",iid);

    let window:BrowserWindow|undefined = mainWindow;
    if(ev){
        window = getWindow(ev);
    }
    if(!window) return;

    let inst = await getModpackInst(iid);
    if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();

    // if(!inst.meta.meta.id) return errors.failedToGetPackLink.unwrap();
    
    let res = (await semit<Arg_GetRPVersions,Res_GetRPVersions>("getRPVersions",{
        mpID:inst.meta.meta.id,
        current:inst.meta.resourcepacks.map(v=>{
            return {
                rpID:v.rpID,
                update:v.update
            };
        })
    })).unwrap();
    if(!res) return;

    console.log("VERSIONS:",res.versions);

    // sync mods
    let res1 = (await syncMods(window,iid,true)).unwrap();
    let modsUpToDate = res1?.upToDate;

    // get mod info
    await getInstMods_old({iid});

    // sync rps
    let proms:Promise<any>[] = [];
    for(const v of res.versions){
        proms.push(downloadRP({
            iid,lastDownloaded:-1,
            mpID:inst.meta.meta.id,
            rpID:v.rpID
        }));
    }
    await Promise.all(proms);

    // sync worlds
    if(!ignoreWorlds){
        let acc = await getMainAccount();
        if(acc){
            let worlds = inst.meta.worlds;
            for(const w of worlds){
                if(w.lastSync == -1) continue;

                let res1 = await takeWorldOwnership({
                    iid,wID:w.wID,
                    uid:acc.profile.id,
                    uname:acc.profile.name
                });
                if(!res1) return;
        
                let res = await downloadWorld({
                    iid,wID:w.wID
                },undefined,true);
                if(!res) return;
            }
        }
    }

    // finish
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
}

export async function launchInstance(iid:string,ev?:Electron.IpcMainInvokeEvent){
    // exec("notepad");
    if(!sysInst.meta) return;
    if(!sysInst.meta.prismExe || !sysInst.meta.prismRoot) return;

    if(ev) if(!await ensurePrismLinked(getWindow(ev))) return;

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

    let acc = await getMainAccount();
    if(!acc) return;

    let worlds = pack.meta.worlds;
    for(const w of worlds){
        if(!await util_lstat(path.join(sysInst.meta.prismRoot,".minecraft/saves",w.wID))) continue;
        if(w.wID.endsWith(".disabled")) continue;

        if(w.lastSync == -1) continue;

        let res1 = await takeWorldOwnership({
            iid,wID:w.wID,
            uid:acc.profile.id,
            uname:acc.profile.name
        });
        if(!res1) return;

        let res = await downloadWorld({
            iid,wID:w.wID
        },undefined,true);
        if(!res) return;
    }
    
    let res = (await semit<Arg_LaunchInst,boolean>("startLaunchInst",{
        mpID:pack.meta.meta.id,
        uid:acc.profile.id,
        uname:acc.profile.name
    })).unwrap();
    if(!res) return;

    await checkForInstUpdates(iid,undefined,true);

    pack.meta.isRunning = true;
    pack.meta.lastLaunched = Date.now();
    await pack.save();

    let cmd = `${path.join(sysInst.meta.prismExe,"prismlauncher")} --launch "${pack.meta.linkName}"`;
    util_note("EXEC:",cmd);
    exec(cmd);

    getWindowStack().find(v=>v.title == "Edit Instance")?.webContents.send("updateSearch",{
        mpID:pack.meta.meta.id,
        id:"world",
        data:{
            wID:"*"
        }
    });
    mainWindow.reload();
}

export async function takeWorldOwnership(arg:Arg_TakeWorldOwnership): Promise<boolean | undefined>{    
    if(!sysInst.meta) return errors.noSys.unwrap();
        
    let inst = await getModpackInst(arg.iid);
    if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();
    if(!inst.meta.meta.id) return errors.failedToGetPackLink.unwrap();

    let acc = await getMainAccount();
    if(!acc) return;

    arg.uid = acc.profile.id;
    arg.uname = acc.profile.name;

    let res = (await semit<SArg_TakeWorldOwnership,boolean>("takeWorldOwnership",{
        ...arg,
        mpID:inst.meta.meta.id
    })).unwrap();
    if(!res) return;

    return true;
}

export async function getWorld(arg:Arg_GetWorldInfo):Promise<Res_GetWorldInfo|undefined>{
    if(!arg.iid) return;

    let inst = await getModpackInst(arg.iid);
    if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();

    let res = (await semit<Arg_GetWorldInfo,Res_GetWorldInfo>("getWorldMeta",{
        ...arg,
        mpID:inst.meta.meta.id
    })).unwrap();
    if(!res) return;

    let acc = await getMainAccount();
    res.yourName = acc?.profile.name ?? "(Can't load your account)";

    let w = inst.meta.worlds.find(v=>v.wID == arg.wID);
    res.yourUpdate = w?.update ?? 0;
    res.isRunning = inst.meta.isRunning;

    return res;
}

export async function uploadWorld(arg:Arg_UploadWorld,useTime=true,delayedWindow=false,noUpToDateMsg=false){
    if(!arg.iid) return errors.invalid_args.unwrap();
    if(!sysInst.meta) return errors.noSys.unwrap();

    let inst = await getModpackInst(arg.iid);
    if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();
    // 

    let prismLoc = inst.getRoot();
    if(!prismLoc) return errors.failedToGetPrismInstPath.unwrap();

    let saveLoc = path.join(prismLoc,"saves",arg.wID);
    if(!await util_lstat(saveLoc)) return errors.worldDNE.unwrap();
    
    let acc = await getMainAccount();
    if(!acc) return;

    let wMeta = inst.meta.worlds.find(v=>v.wID == arg.wID);
    if(!wMeta) return errors.couldNotFindWorldMeta.unwrap();

    let allowedDirs = (await semit<Arg_GetAllowedDirs,string[]|undefined>("getAllowedDirs",{
        mpID:inst.meta.meta.id,
        wID:arg.wID,
        uid:acc.profile.id
    })).unwrap();
    if(!allowedDirs) return;

    let w:BrowserWindow|undefined;
    if(!delayedWindow){
        w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid:arg.iid});
        if(!w) return errors.failedNewWindow.unwrap();
        w.webContents.send("updateProgress","main",0,1,"Initializing 'upload world'...");
    }

    util_note("STARTED uploading world...");

    let completed = 0;
    let total = 0;

    let files:{
        loc:string;
        sloc:string;
        name:string;
    }[] = [];
    let failed:string[] = [];
    let success:string[] = [];

    let syncTime = wMeta.lastSync ?? -1;

    let rootList = await util_readdir(saveLoc);
    let loop = async (loc:string,sloc:string)=>{
        let list = await util_readdirWithTypes(loc);
        for(const item of list){
            if(w?.isDestroyed()) return;
            if(item.isDirectory()){
                await loop(path.join(loc,item.name),path.join(sloc,item.name));
                continue;
            }
            if(useTime){
                let stat = await util_lstat(path.join(loc,item.name));
                if(!stat){
                    util_warn("This error should never happen, failed to open stats after just detecting it was there: ",loc,item.name);
                    continue;
                }
                if(Math.max(stat.mtimeMs,stat.birthtimeMs) <= syncTime) continue; // skip
            }
            total++;
            files.push({
                loc:path.join(loc,item.name),
                sloc:path.join(sloc,item.name),
                name:item.name
            });
        }
    };
    for(const f of rootList){
        if(!allowedDirs.includes(f)) continue; // THIS IS DISABLED FOR THE FIRST PUBLISH AND FIRST DOWNLOAD
        await loop(path.join(saveLoc,f),f);
    }

    if(w?.isDestroyed()) return;

    if(total == 0){
        w?.close();
        if(!noUpToDateMsg) await dialog.showMessageBox({
            message:"Up to date"
        });
        return true;
    }

    if(delayedWindow){
        w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid:arg.iid});
        if(!w) return errors.failedNewWindow.unwrap();
        w.webContents.send("updateProgress","main",0,1,"Initializing...");
    }
    else if(!w || w.isDestroyed()) return;

    // 

    let resStart = (await semit<Arg_FinishUploadWorld,void>("startUploadWorld",{
        mpID:inst.meta!.meta.id,
        wID:arg.wID,
        uid:acc.profile.id,
        uname:acc.profile.name
    }));
    if(resStart.err){
        resStart.unwrap();
        return;
    }
    
    let finish = async ()=>{
        return (await semit<Arg_FinishUploadWorld,Res_FinishUploadWorld>("finishUploadWorld",{
            mpID:inst.meta!.meta.id,
            wID:arg.wID,
            uid:acc.profile.id,
            uname:acc.profile.name
        })).unwrap();
    };

    // let proms:Promise<void>[] = [];
    
    let uploadMethod = 0; //4 
    if(uploadMethod == 0){
        let start = performance.now();
        for(const {loc,sloc,name} of files){
            // proms.push(new Promise<void>(async resolve=>{
                if(w.isDestroyed()){
                    await finish();
                    // resolve();
                    // return;
                    continue;
                }
                
                let buf = await util_readBinary(loc);
                if(!buf){
                    failed.push(sloc);
                    // resolve();
                    // return;
                    continue;
                }
                
                let fres = (await semit<Arg_UploadWorldFile,boolean>("upload_world_file",{ // file res
                    buf,
                    mpID:inst.meta!.meta.id,
                    path:sloc,
                    uid:acc.profile.id,
                    uname:acc.profile.name,
                    wID:arg.wID
                })).unwrap();
                if(!fres){
                    failed.push(sloc);
                    // resolve();
                    // return;
                    continue;
                }
        
                w.webContents.send("updateProgress","main",completed,total,"Upload: "+name);
                completed++;
                success.push(sloc);
    
                // resolve();
            // }));
        }
        // await Promise.all(proms);

        console.log("TIME: ",performance.now()-start);
    }
    else if(uploadMethod == 1){
        await startExtractTMP();

        let start = performance.now();
        
        let archLoc = path.join(extractTMP,"world.7z");
        await util_rm(archLoc);
        // let stream = Seven.add(archLoc,[],{
        //     $bin:pathTo7zip
        // });
        let stream = Seven.add(archLoc,allowedDirs.map(v=>path.join(saveLoc,v)),{
            $bin:pathTo7zip,
            $progress:true,
            recursive:true
        });

        stream.on("progress",progress=>{
            w!.webContents.send("updateProgress","main",progress.percent,100,"Packing: #"+progress.fileCount);
            // w.webContents.send("updateProgress","main",progress.percent,100,progress.file+"\n\n"+progress.fileCount+" total files.");
        });
        
        let res = await new Promise<boolean>(resolve=>{
            stream.on("end",()=>{
                w!.webContents.send("updateProgress","main",100,100,"Finished Packing.");
                console.log("FINISHED, TIME: ",performance.now()-start);
                resolve(true);
            });
            stream.on("error",err=>{
                util_warn("Error while zipping: "+err);
                return errors.zipping.unwrap();
                resolve(false);
            });
        });
        if(!res){
            util_warn("Failed to pack world into archive");
            return;
        }

        // await endExtractTMP();

        start = performance.now();

        let data = await util_readBinary(archLoc);
        if(!data){
            util_warn("Failed to read archive just created");
            return;
        }
        let file1 = new Blob([data]);

        await new Promise<boolean>(resolve=>{
            axios.post(`${sysInst.meta!.serverURL}/upload_test`,{
                // params:{
                //     ids:`[${req.mr_needsUpdate.map(v=>'"'+v+'"').join(",")}]`
                // }
                files:{
                    file1
                }
            }).then(res=>{
                console.log(">> successfully uploaded packed world",performance.now()-start);
                console.log(res);
                resolve(true);
            }).catch(reason=>{
                // err = errors.responseErr;
                util_warn("HTTP Error (upload packed world): "+reason);
                resolve(false);
            });
        });
    }
    else if(uploadMethod == 2){
        // upload all files in one http request

        console.log("> START FULL UPLOAD");
        
        let res = await new Promise<boolean>(async resolve=>{
            if(!inst.meta) return;
            
            let data = {
                files:await Promise.all(files.map(async v=>{
                    if(w?.isDestroyed()){
                        failed.push(v.sloc);
                        return;
                    }

                    let buf = await util_readBinary(v.loc);
                    if(!buf){
                        failed.push(v.sloc);
                        return;
                    }
                    
                    return {
                        buf:Array.from(buf),
                        path:v.sloc
                    };
                })),
                mpID:inst.meta.meta.id,
                wID:arg.wID,
                uid:acc.profile.id,
                uname:acc.profile.name
            };

            if(w?.isDestroyed()){
                resolve(false);
                return;
            }

            let start = performance.now();

            axios.post(`${sysInst.meta!.serverURL}/world/upload_full`,data,{
                headers:{
                    "Content-Type":"application/json",
                    "Socket-Id":getSocketId()
                }
            }).then(res=>{
                console.log(">> success: res",res);
                console.log("TIME:",performance.now()-start);
                resolve(true);
            }).catch(err=>{
                console.log("$ err occured while uploading:",err);
                resolve(false);
            });
        });
        if(!res){
            util_note("Failed uploading full world");
            return;
        }
    }
    else if(uploadMethod == 3){
        console.log("> START FULL UPLOAD [3]");
        
        let maxSizePerReq = 1024 * 1000; // 1mb // 10mb
        let curTotalSize = 0;
        let fullTotalUploadSize = 0;
        let filesList:{
            buf:Uint8Array;
            path:string;
        }[] = [];

        let start = performance.now();

        let i = 0;
        let chunk = 0;
        for(const v of files){
            i++;
            if(w?.isDestroyed()){
                failed.push(v.sloc);
                return;
            }

            let buf = await util_readBinary(v.loc);
            if(!buf){
                failed.push(v.sloc);
                continue;
            }
            
            filesList.push({
                // buf:Array.from(buf),
                buf,
                path:v.sloc
            });

            // 
            // curTotalSize++; // only doing amt for now so I don't have to do lstat everytime
            curTotalSize += buf.byteLength;
            fullTotalUploadSize += buf.byteLength;

            if(curTotalSize >= maxSizePerReq || i == files.length){
                let res = await new Promise<boolean>(async resolve=>{
                    if(!inst.meta) return;
                    if(!sysInst.meta) return;
                    
                    let data = {
                        files:filesList,
                        mpID:inst.meta.meta.id,
                        wID:arg.wID,
                        uid:acc.profile.id,
                        uname:acc.profile.name
                    };
        
                    if(w?.isDestroyed()){
                        resolve(false);
                        return;
                    }
        
                    axios.post(`${sysInst.meta.serverURL}/world/upload_full`,data,{
                        headers:{
                            "Content-Type":"application/json",
                            "Socket-Id":getSocketId()
                        },
                        onUploadProgress:(ev)=>{
                            if(!ev) return;
                            console.log("PROG:",ev.progress,ev.total);
                        }
                    }).then(res=>{
                        resolve(true);
                    }).catch(err=>{
                        console.log("$ err occured while uploading [3]:",err);
                        resolve(false);
                    });
                });
                if(!res){
                    util_note("Failed uploading full world [3]");
                    return;
                }

                chunk++;
                completed += filesList.length;
                w?.webContents.send("updateProgress","main",completed,total,"Chunk: "+chunk);
                
                // 
                curTotalSize = 0;
                filesList = [];
            }
        }

        console.log(">> success [3]: ",{
            fullTotalUploadSize
        });
        console.log("TIME:",performance.now()-start);
    }
    else if(uploadMethod == 4){ // chunk parallel version
        console.log("> START FULL UPLOAD [4]");
        
        let maxSizePerReq = 1024 * 1000; // 1mb // 10mb
        let curTotalSize = 0;
        let fullTotalUploadSize = 0;
        let filesList:{
            buf:Uint8Array;
            path:string;
        }[] = [];

        let start = performance.now();

        let uploadProms:Promise<boolean>[] = [];

        let i = 0;
        let chunk = 0;

        let chunks:{
            files:{
                buf:Uint8Array;
                path:string;
            }[];
            mpID:string;
            wID:string;
            uid:string;
            uname:string;
        }[] = [];

        for(const v of files){
            i++;
            if(w?.isDestroyed()){
                failed.push(v.sloc);
                return;
            }

            let buf = await util_readBinary(v.loc);
            if(!buf){
                failed.push(v.sloc);
                continue;
            }
            
            filesList.push({
                buf,
                path:v.sloc
            });

            // 
            curTotalSize += buf.byteLength;
            fullTotalUploadSize += buf.byteLength;

            if(curTotalSize >= maxSizePerReq || i == files.length){
                let data = {
                    files:filesList,
                    mpID:inst.meta.meta.id,
                    wID:arg.wID,
                    uid:acc.profile.id,
                    uname:acc.profile.name
                };
                chunks.push(data);

                chunk++;
                completed += filesList.length;
                w?.webContents.send("updateProgress","main",completed,total,"Init: #"+chunk);
                
                // 
                curTotalSize = 0;
                filesList = [];

                uploadProms.push(new Promise<boolean>(async function(resolve){
                    if(!inst.meta) return;
                    if(!sysInst.meta) return;
        
                    if(w?.isDestroyed()){
                        resolve(false);
                        return;
                    }

                    let data = chunks[chunk-1];
        
                    axios.post(`${sysInst.meta.serverURL}/world/upload_full`,data,{
                        headers:{
                            "Content-Type":"application/json",
                            "Socket-Id":getSocketId()
                        },
                        onUploadProgress:(ev)=>{
                            if(!ev) return;
                            console.log("PROG:",ev.progress,ev.total);
                        }
                    }).then(res=>{
                        console.log("FINISH");
                        w?.webContents.send("updateProgress","main",completed,total,"Upload: #"+chunk);
                        resolve(true);
                    }).catch(err=>{
                        console.log("$ failed uploading world [4]:",err);
                        resolve(false);
                    });
                }));
            }
        }
        await Promise.all(uploadProms);

        console.log(">> success [4]: ",{
            fullTotalUploadSize
        });
        console.log("TIME:",performance.now()-start);
    }

    // 
    if(true) w!.webContents.send("updateProgress","main",completed,total,"Finished.",{
        sections:[
            {
                header:`Failed: (${failed.length})`,
                items:failed
            },
            {
                header:`Success: (${success.length})`,
                items:success
            }
        ]
    });

    util_note("FINISHED uploading world...");

    let res2 = await finish();
    if(!res2) return;
    
    wMeta.update = res2.update;
    wMeta.lastSync = Date.now();
    await inst.save();

    if(noUpToDateMsg) if(failed.length == 0) w.close();

    getWindowStack().find(v=>v.title == "Edit Instance")?.webContents.send("updateSearch");

    return true;
}
export async function downloadWorld(arg:Arg_DownloadWorld,useTime=true,noUpToDateMsg=false){
    if(!arg.iid) return errors.invalid_args.unwrap();

    let inst = await getModpackInst(arg.iid);
    if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();
    // 

    if(inst.meta.isRunning) return errors.downloadWorldWhileRunning.unwrap();

    let prismLoc = inst.getRoot();
    if(!prismLoc) return errors.failedToGetPrismInstPath.unwrap();

    let saveLoc = path.join(prismLoc,"saves",arg.wID);
    // if(!await util_lstat(saveLoc)) return errors.worldDNE.unwrap();
    await util_mkdir(saveLoc,true);
    
    let acc = await getMainAccount();
    if(!acc) return;

    let wMeta = inst.meta.worlds.find(v=>v.wID == arg.wID);
    // if(!wMeta) return errors.couldNotFindWorldMeta.unwrap();
    if(!wMeta){
        wMeta = {
            wID:arg.wID,
            lastSync:-1,
            update:-1
        };
        inst.meta.worlds.push(wMeta);
        await inst.save();
    }

    // let world = await getWorld({iid:arg.iid,wID:arg.wID,mpID:inst.meta.meta.id});
    // if(!world || !world.data) return errors.couldNotFindWorldMeta.unwrap(); //[2] - may need to change this error to something more unique in the future but it shouldn't be likely to happen if the others passed

    let res = (await semit<Arg_GetWorldFiles,Res_GetWorldFiles>("getWorldFiles",{
        mpID:inst.meta.meta.id,
        wID:arg.wID,
        useTime,
        syncTime:wMeta.lastSync ?? -1,
        update:wMeta.update ?? -1,
        uid:acc.profile.id,
        forceAllFiles:arg.forceAllFiles
    })).unwrap();
    if(!res) return;

    if(res.files.length == 0){
        util_note2(wMeta.update,res.update);
        if(!noUpToDateMsg) await dialog.showMessageBox({
            message:"Up to date"
        });
        return true;
    }

    // DONT KNOW OF AN EASY FIX FOR THIS YET
    // if(wMeta.update >= res.update){
    //     await dialog.showMessageBox({
    //         message:"Up to date"
    //     });
    //     return;
    // }

    let w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid:arg.iid});
    if(!w) return errors.failedNewWindow.unwrap();

    let finish = async ()=>{
        let res2 = (await semit<Arg_FinishUploadWorld,void>("finishDownloadWorld",{
            mpID:inst.meta!.meta.id,
            wID:arg.wID,
            uid:acc.profile.id,
            uname:acc.profile.name
        })).unwrap();
    };
    let resStart = (await semit<Arg_FinishUploadWorld,void>("startDownloadWorld",{
        mpID:inst.meta.meta.id,
        wID:arg.wID,
        uid:acc.profile.id,
        uname:acc.profile.name
    }));
    if(resStart.err){
        resStart.unwrap();
        return;
    }

    util_note("STARTED downloading world...");
    w.webContents.send("updateProgress","main",0,1,"Initializing 'download world'...");

    let failed:string[] = [];
    let success:string[] = [];
    let completed = 0;
    let total = res.files.length;

    let proms:Promise<void>[] = [];
    for(const {loc,sloc,n} of res.files){
        proms.push(new Promise<void>(async resolve=>{
            if(w.isDestroyed()){
                await finish();
                resolve();
                return;
            }
            
            let fres = (await semit<Arg_DownloadWorldFile,ModifiedFileData>("download_world_file",{ // file res
                mpID:inst.meta!.meta.id,
                path:sloc,
                wID:arg.wID
            })).unwrap();
            if(!fres){
                failed.push(sloc);
                console.log("FAILED [1] - "+sloc);
                resolve();
                return;
            }
    
            let folderRes = await util_mkdir(path.dirname(path.join(saveLoc,sloc)),true);
            if(!folderRes) util_warn("Error creating folder: "+path.dirname(path.join(saveLoc,sloc)));
            let res = await util_writeBinary(path.join(saveLoc,sloc),Buffer.from(fres.buf));
            if(!res){
                failed.push(sloc);
                console.log("FAILED [2] - "+sloc,path.join(saveLoc,sloc));
            }
            else success.push(sloc);
    
            w.webContents.send("updateProgress","main",completed,total,"Download: "+n);
            completed++;

            resolve();
        }));
    }
    await Promise.all(proms);

    // 
    w.webContents.send("updateProgress","main",completed,total,"Finished.",{
        sections:[
            {
                header:`Failed: (${failed.length})`,
                text:failed
            },
            {
                header:`Success: (${success.length})`,
                text:success
            }
        ]
    });
    
    wMeta.update = res.update;
    wMeta.lastSync = Date.now();
    await inst.save();

    util_note("FINISHED downloading world...",failed);

    await finish();

    // windowStack.find(v=>v.title == "Edit Instance")?.webContents.send("updateSearch",{
    //     mpID:inst.meta.meta.id,
    //     id:"world",
    //     data:{
    //         wID:arg.wID
    //     }
    // });
    // windowStack.find(v=>v.title == "Edit Instance")?.webContents.send("updateSearch");

    if(failed.length == 0){
        getWindowStack().find(v=>v.title == "Add World")?.close();
        w.close();
    }

    getWindowStack().find(v=>v.title == "Edit Instance")?.webContents.send("updateSearch");

    return true;
}
export async function unpublishWorld(arg:{
    iid:string;
    wID:string;
}){
    if(!arg.iid) return errors.invalid_args.unwrap();

    let inst = await getModpackInst(arg.iid);
    if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();

    let acc = await getMainAccount();
    if(!acc) return;
    
    let res1 = (await semit<Arg_UnpublishWorld,boolean>("unpublishWorld",{
        mpID:inst.meta.meta.id,
        uid:acc.profile.id,
        wID:arg.wID
    })).unwrap();
    if(!res1) return errors.failedToUnpublishWorld;

    let w2 = getWindowStack().find(v=>v.title == "Edit Instance");
    if(w2) w2.webContents.send("updateSearch");

    return new Result(true);
}

const extractTMP = path.join(appPath,".tmp","extract");
async function startExtractTMP(){
    await util_rm(extractTMP,true);
    return util_mkdir(extractTMP,true);
}
function endExtractTMP(){
    return util_rm(extractTMP,true);
}

export async function downloadRP(arg:Arg_DownloadRP){
    console.log("---starting RP download: ",arg.rpID);
    
    let inst = await getModpackInst(arg.iid);
    console.log("- 1");
    if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();

    // if(!inst.meta.linkName) return errors.failedToGetPackLink.unwrap();

    console.log("- 2");
    
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

    console.log("- 3");

    // let cachePath = path.join(inst.getRPCachePath()!,arg.rpID+".json");
    // let cache = await util_readJSON<Record<string,RPCache>>(cachePath);
    // if(!cache) return errors.couldNotFindRPCache.unwrap(); // do I need to change this now?

    // arg.lastDownloaded = Math.min(meta.lastDownloaded,meta.lastUploaded);
    // arg.lastDownloaded = Math.max(meta.lastDownloaded,meta.lastUploaded);
    arg.lastDownloaded = meta.lastDownloaded;
    arg.mpID = inst.meta.meta.id;

    // arg.data = cache;
    
    // 
    let prismRoot = inst.getPrismInstPath();
    if(!prismRoot) return errors.failedToGetPrismInstPath.unwrap();
    
    let alreadyHad = await util_lstat(path.join(prismRoot,".minecraft","resourcepacks",arg.rpID));
    let loc = path.join(prismRoot,".minecraft","resourcepacks",arg.rpID);

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
        util_warn("---- error failed to get rp info from server for download");
        console.log(resPacked.err);
        w.close();
        return;
    }

    util_warn("ADD FILES:");
    // console.log(res.add);
    util_warn("REMOVE FILES:");
    // console.log(res.remove);

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

    if(w.isDestroyed()) return;

    // let nowTime = new Date().getTime();

    let proms:Promise<void>[] = [];
    for(const file of res.add){
        let prom = new Promise<void>(async resolve=>{
            if(w.isDestroyed()){
                failed.push(file);
                resolve();
                return;
            }

            w.webContents.send("updateProgress","main",completed,total,file.n); // should this be here or before?

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
                resolve();
                return;
            }
            
            let f = bufPACK.unwrap();
            if(!f){
                failed.push(file);
                resolve();
                return;
            }

            await util_mkdir(path.dirname(subPath),true);
            await util_writeBinary(subPath,Buffer.from(f.buf));
            if(stat) await util_utimes(subPath,{ atime:stat.atimeMs, btime:stat.birthtimeMs, mtime:stat.mtimeMs });
            
            success++;
            successfulFiles.push(file);

            // 
            completed++;
            w.webContents.send("updateProgress","main",completed,total,file.n); // should this be here or before?

            resolve();
        });
        proms.push(prom);
    }
    await Promise.all(proms);

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

    // auto add it to options.txt (currently selected packs)
    if(!alreadyHad){
        util_note("Didn't have the RP, adding...");
        let optionsText = await util_readText(path.join(prismRoot,".minecraft","options.txt"));
        if(optionsText){
            let lines = optionsText.split("\n");
            let rpLineI = lines.findIndex(v=>v.startsWith("resourcePacks:"));
            let altrpLineI = lines.findIndex(v=>v.startsWith("incompatibleResourcePacks:"));
            let wasChange = false;
            if(rpLineI != -1){
                let rpLine = lines[rpLineI];
                let split = rpLine.split(":");
                let list = JSON.parse(split[1] || "[]") as string[];
                let toAdd = "file/"+arg.rpID;
                if(!list.includes(toAdd)){
                    list.push(toAdd);
                    
                    lines[rpLineI] = split[0]+":"+JSON.stringify(list);
                    wasChange = true;
                }
            }
            if(altrpLineI != -1){
                let rpLine = lines[altrpLineI];
                let split = rpLine.split(":");
                let list = JSON.parse(split[1] || "[]") as string[];
                let toAdd = "file/"+arg.rpID;
                if(!list.includes(toAdd)){
                    list.push(toAdd);
                    
                    lines[altrpLineI] = split[0]+":"+JSON.stringify(list);
                    wasChange = true;
                }
            }
            if(wasChange) await util_writeText(path.join(prismRoot,".minecraft","options.txt"),lines.join("\n"));
        }
    }
    else util_note("Already had the RP, skipping!");

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
    // if(failed.length == 0) w.close(); // I think it's best to leave it open to see what it downloaded
    
    getWindowStack().find(v=>v.title == "Edit Instance")?.webContents.send("updateSearch");

    if(getWindowStack().some(v=>v.title == "Add Resource Pack")){ // may need to fix this later because it's no future proof if the title gets changed
        let rpW = getWindowStack().findIndex(v=>v.title == "Add Resource Pack");
        if(rpW != -1){
            getWindowStack()[rpW].close();
            getWindowStack().splice(rpW,1);
        }

        // let rpW = windowStack.findIndex(v=>v.title == "Add Resource Pack");
        // if(rpW != -1){
        //     windowStack[rpW].close();
        //     windowStack.splice(rpW,1);
        // }

        let last = getWindowStack()[getWindowStack().length-1];
        if(last?.title == "Edit Instance"){
            last.webContents.send("updateSearch");
        }
    }
    
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
            height:430,
            sections:[
                {options:[
                    {
                        type:"title",
                        title:"Set Server URL",
                        desc:`This is the URL or IP Address of the "Modpack Sync Server" where your packs will be synced from.\n\n(You can always change this by going to: Network -> Set Server URL)`
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
    // let res = await areModsUpToDate(iid);
    let res = (await getModUpdatesData(iid)).unwrap();
    if(res == undefined){
        return;
        // await dialog.showMessageBox({
        //     message:"Something went wrong while checking for updates"
        // });
    }
    else if(res.upToDate){
        await dialog.showMessageBox({
            message:"Up to date"
        });
    }
    else{
        let res2 = await dialog.showMessageBox({
            message:`This pack has updates available!\n\nRemove (Mods): (${res.res.mods.remove.length})\n${res.res.mods.remove.join("\n")}\n\nAdd (Mods): (${res.res.mods.add.length})\n${res.res.mods.add.join("\n")}\n\nAdd (Mod Indexes): (${res.res.indexes.add.length})\n${res.res.indexes.add.join("\n")}`,
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
async function getModUpdatesData(iid:string):Promise<Result<{
    res:Res_GetModUpdates,
    indexPath:string,
    modsPath:string,
    ignoreMods:string[],
    inst:ModPackInst,
    upToDate:boolean
}>>{
    let inst = await getModpackInst(iid);
    if(!inst || !inst.meta) return errors.couldNotFindPack;
    // if(!inst.meta.linkName) return errors.failedToGetPackLink;
    
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
        id:inst.meta.meta.id,
        currentMods,
        currentIndexes,
        ignoreMods
    }));
    let res = resWrapped.unwrap();
    if(!res) return new Result(undefined as any);
    // if(!res) return resWrapped ?? Result.err("Failed to get mod updates");

    let upToDate = false;
    if(
        res.indexes.add.length == 0 &&
        res.mods.add.length == 0 &&
        res.mods.remove.length == 0
    ){
        upToDate = true;
        // await dialog.showMessageBox(mainWindow,{
        //     message:"Up to date"
        // });
        
        // return new Result(res);
    }

    util_note2("UPDATE: ");
    console.log(res.mods.add.length,res.mods.remove.length,res.indexes.add.length,res.indexes.remove.length);

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

    // I'VE DISABLED THIS FOR NOW BC I'M NOT SURE WHY IT'S HERE AT THE MOMENT, HOPEFULLY DOESN'T BREAK ANYTHING
    // let deletedPath = path.join(modsPath,".deleted");
    // await util_mkdir(deletedPath);
    // await util_mkdir(path.join(modsPath,".cache"));

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

        let completed = 0;
        let total = items.length;

        let fails:{
            name:string;
            ep:string;
            action:ItemAction;
            path:string;
        }[] = [];

        console.log(">> STARTING UPDATE");
        let proms:Promise<void>[] = [];
        for(let i = 0; i < items.length; i++){
            proms.push(new Promise<void>(async resolve=>{
                if(!sysInst.meta){
                    resolve();
                    return;
                }
                
                let item = items[i];

                if(item.action == ItemAction.add){ // add
                    // console.log("add: ",item.path);

                    let url = new URL((sysInst.meta.serverURL+"/"+item.ep).replaceAll("\\","/").replaceAll("//","/"));
                    url.searchParams.set("id",inst!.meta!.meta.id);
                    url.searchParams.set("name",item.name);
                    let href = url.href;
                    
                    let response = await fetch(href);
                    if(!response.ok){
                        util_warn("Failed to get file: "+item.name+" ~ "+response.statusText+" ~ "+response.status);
                        console.log(href);
                        fails.push(item);
                    }
                    else{
                        let buf = await response.arrayBuffer();
                        await util_writeBinary(item.path,Buffer.from(buf));
                    }
                }
                else{ // remove
                    // console.log("remove: ",item.path);

                    let response = await util_rename(item.path,path.join(path.dirname(item.path),".deleted",item.name));
                    // let response = await util_rm(item.path);
                    if(!response){
                        util_warn("Failed to remove file: "+item.name);
                        fails.push(item);
                    }
                }

                // await wait(1);
                // await wait(1000);
                
                completed++;
                newW.webContents.send("updateProgress","main",completed,total,item.action == ItemAction.add ? `Downloading: ${item.name}` : `Removing: ${item.name}`);

                resolve();
            }));
        }
        await Promise.all(proms);

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
            // w.reload();
            w.webContents.send("updateSearch");
        }
    }
    
    return new Result(res as any);
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
    if(!slugMap.meta) return errors.noSlug;

    // if(w) w.webContents.send("updateProgress","main",0,1,"Initializing local mod cache...");
    
    let time2 = performance.now();
    
    let inst = await getModpackInst(iid);
    if(!inst) return errors.couldNotFindPack;

    util_note2("time [1]:",performance.now()-time2);
    time2 = performance.now();

    let prismPath = inst.getPrismInstPath();
    if(!prismPath) return errors.failedToGetPrismInstPath;

    let modsPath = path.join(prismPath,".minecraft","mods");
    if(!modsPath) return Result.err("Could not find mods path");

    util_note2("time [2]:",performance.now()-time2);
    time2 = performance.now();

    let indexPath = path.join(modsPath,".index");
    console.log(":: start cache mods (local)");
    let cachePath = path.join(modsPath,".cache");
    await util_mkdir(cachePath);

    let localModCache:Map<string,LocalModInst> = new Map();

    let req = {
        indexScan:new Set<string>()
    };

    util_note2("time [3]:",performance.now()-time2);
    time2 = performance.now();

    // scan
    let localMods = await util_readdirWithTypes(modsPath,false);
    
    // let total = localMods.length*2;
    // w?.webContents.send("updateProgress","main",0,total,"Starting local mod cache...");

    let proms:{
        prom:Promise<LocalModInst>;
        name:string;
    }[] = [];
    for(const mod of localMods){
        if(!mod.isFile()) continue;
        // if(!mod.name.endsWith(".jar") && !mod.name.endsWith(".jar.disabled")) continue;

        let filename = cleanModName(mod.name);
        // if(filename.endsWith(".disabled")) filename = filename.replace(".disabled","");

        // let slug = slugMap.getVal(filename);
        let slug = slugMap.getSlug(filename);
        // let slug = "";
        if(!slug){
            req.indexScan.add(filename);
            // continue;
        }

        proms.push({
            prom:new LocalModInst(modsPath,iid,filename).load(),
            name:mod.name
        });
    }
    await Promise.all(proms);
    for(const d of proms){
        localModCache.set(d.name,await d.prom);
    }    

    util_note2("time [4]:",performance.now()-time2);
    time2 = performance.now();

    // temp force all mods to update slugs/.index data
    if(false) for(const [filename,local] of localModCache){
        req.indexScan.add(filename);
    }

    // extract
    if(true) for(const mod of localMods){ // !!! -> this could be an important thing to have enabled
        if(!mod.isFile()) continue;
        // if(!mod.name.endsWith(".jar") && !mod.name.endsWith(".jar.disabled")) continue;
        
        // let filename = cleanModName(mod.name);

        let info = await getMod(modsPath,mod.name);
        let ok = Object.keys(info);
        let local = localModCache.get(mod.name) as any;
        if(!local) continue;
        if(local.meta) for(const k of ok){
            local.meta[k] = (info as any)[k];
        }
        else{
            local.meta = info;
        }
    }

    util_note2("time [5]:",performance.now()-time2);
    time2 = performance.now();

    // link slugs
    if(req.indexScan.size != 0){
        util_note("->> doing index scan: ",req.indexScan.size);
        let time2 = performance.now();
        let indexFiles = await util_readdir(indexPath);
        let proms2:Promise<void>[] = [];
        for(const index of indexFiles){
            proms2.push(new Promise<void>(async resolve=>{
                let indexData = await util_readTOML<ModIndex>(path.join(indexPath,index));
                if(!indexData){
                    util_warn("couldn't read pw.toml file for: "+index);
                    resolve();
                    return;
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
                resolve();
            }));
        }
        await Promise.all(proms2);

        await slugMap.save();

        util_note2("time [6]:",performance.now()-time2);
    }
    time2 = performance.now();

    // save
    for(const [filename,local] of localModCache){
        await local.save();
    }

    util_note2("time [7]:",performance.now()-time2);

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

    // let modCache:Map<string,RemoteModInst> = new Map();
    let changed:RemoteModInst[] = [];
    let resultList:RemoteModInst[] = [];
    // 

    let req = {
        mr_needsUpdate:[] as string[],
        cf_needsUpdate:[] as string[]
    };
    
    // scan
    let indexList = await util_readdir(indexPath);
    for(const index of indexList){
        let slug = index.replace(".pw.toml","");
        
        let foundRemote = instCache.remoteMods.get(slug);
        if(foundRemote){
            resultList.push(foundRemote);
            continue;
        }

        let remote = await new RemoteModInst(slug,indexPath).load();
        if(!remote.meta) await remote.postLoad();
        // modCache.set(slug,remote);
        instCache.remoteMods.set(slug,remote);
        changed.push(remote);
        resultList.push(remote);

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
                    // let remote = modCache.get(d.slug);
                    let remote = instCache.remoteMods.get(d.slug);
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
                    // let remote = modCache.get(d.slug);
                    let remote = instCache.remoteMods.get(d.slug);
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
    for(const remote of changed){
        await remote.save();
    }

    console.log("Remote Stats (Modrinth):\nto update: "+req.mr_needsUpdate.length+" "+req.mr_needsUpdate.join(", ")+"\nupdated: "+mr_updated.length);
    console.log("Remote Stats (Curseforge):\nto update: "+req.cf_needsUpdate.length+" "+req.cf_needsUpdate.join(", ")+"\nupdated: "+cf_updated.length);

    console.log(":: FINISH cache mods (remote)",changed.length);

    // let resultList = [...modCache.entries()].map(v=>v[1].meta).filter(v=>v != null);
    // console.log("RESULT LIST:",resultList.map(v=>v.modrinth?.icon_url));
    return new Result(resultList.map(v=>v.meta).filter(v=>v != null));
    // return new Result({});
}

export async function getModIndexFiles(arg:Arg_IID): Promise<Result<Res_GetModIndexFiles>>{
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
        if(mod.name.endsWith(".disabled")) continue; // ignore disabled files

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
    if(!inst || !inst.meta) return errors.couldNotFindPack;

    let prismPath = inst.getRoot();
    if(!prismPath) return errors.failedToGetPrismInstPath;

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
    for(const f of inst.meta.folders){
        data.folders.push({
            type:f.type,
            name:f.name,
            tags:f.tags,
            mods:[]
        });
    }
    
    // 

    let instPath = path.dirname(inst.filePath);
    // let modsCache = await util_readJSON<Record<string,LocalModData>>(path.join(instPath,"mods.json"));
    // if(!modsCache) modsCache = {};

    // 

    let modsPath = path.join(prismPath,"mods");

    let files = await util_readdirWithTypes(path.join(prismPath,"mods"));
    let proms:Promise<void>[] = [];
    for(const file of files){
        proms.push(new Promise<void>(async resolve=>{
            if(!inst || !inst.meta){
                resolve();
                return;
            }
            
            if(!file.isFile()){
                resolve();
                return;
            }

            if(arg.query) if(!searchStringCompare(file.name,arg.query)){
                resolve();
                return;
            }
            let cleanName = cleanModName(file.name);

            let fRef = inst.meta.folders.find(v=>v.mods.includes(cleanName));
            let f:ModsFolder | undefined;
            if(fRef) f = data.folders.find(v=>v.name == fRef.name);

            if(!f) f = rootFolder;
            if(!f){
                util_warn("Serious issue happened where mod couldn't find folder")
                resolve();
                return;
            }
            
            // let cacheData = modsCache[file.name];
            let cacheFileName = path.join(modsPath,".cache",cleanName+".json");
            if(!await util_lstat(cacheFileName)){
                let newData = await getMod(modsPath,file.name);
                if(!newData){
                    console.log("couldn't find mod data: "+file.name);
                }
                else{
                    console.log("...had to write cache data... : "+file.name);
                    await util_writeJSON(cacheFileName,newData);
                }
            }
            
            let cacheData = await new LocalModInst(modsPath,arg.iid,cleanName).load();
            if(cacheData.meta){
                let remoteCache:RemoteModData | undefined;
                if(cacheData.meta.slug){
                    let found = instCache.remoteMods.get(cleanName);
                    if(found) remoteCache = found.meta;
                    else{
                        let rinst = new RemoteModInst(cacheData.meta.slug,path.join(modsPath,".index"));
                        remoteCache = (await rinst.load())?.meta;
                        instCache.remoteMods.set(cleanName,rinst);
                    }
                }
                cacheData.meta.file = file.name; // hopefully fix
                f.mods.push({
                    local:cacheData.meta,
                    remote:remoteCache
                });
                resolve();
                return;
            }
            else{
                f.mods.push({
                    local:{
                        _formatVersion:"1",
                        _type:"other",
                        name:file.name,
                        file:file.name,
                        authors:[],
                        description:"",
                        icon:"",
                        id:"",
                        slug:"",
                        version:"",
                        pw:undefined as any,
                        fabric:undefined,
                        datapack:undefined,
                        forge:undefined
                    }
                });
            }

            resolve();
        }));
    }
    await Promise.all(proms);

    // sort
    for(const f of data.folders){
        f.mods.sort((a,b)=>{
            let aName = a.remote?.modrinth?.title ?? a.remote?.curseforge?.name ?? a.local.name ?? a.local.file;
            let bName = b.remote?.modrinth?.title ?? b.remote?.curseforge?.name ?? b.local.name ?? b.local.file;

            return aName.localeCompare(bName) ?? 0;
        })
    }

    return new Result(data);
}
export async function getInstMods_old(arg:Arg_GetInstMods): Promise<Result<Res_GetInstMods>>{
    let time2 = performance.now();
    
    if(!sysInst.meta) return errors.noSys;
    if(!sysInst.meta.prismRoot) return errors.noPrismRoot;

    let inst = await getModpackInst(arg.iid);
    if(!inst.meta) return errors.couldNotFindPack;

    let prismPath = inst.getRoot();
    if(!prismPath) return errors.failedToGetPrismInstPath;
    // 

    let total = 4;

    let w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid:arg.iid});
    let finish = ()=>{
        w?.close();
    };
    w?.webContents.send("updateProgress","main",0,total,"Initializing mod cache...");

    util_warn("TIME [1] - "+(performance.now()-time2));
    time2 = performance.now();

    w?.webContents.send("updateProgress","main",1,total,"Caching local mods...");
    let localList = (await cacheModsLocal(arg.iid)).unwrap();
    util_warn("TIME [2] - "+(performance.now()-time2));
    time2 = performance.now();
    w?.webContents.send("updateProgress","main",2,total,"Caching remote mods...");
    let remoteList = (await cacheModsRemote(arg.iid)).unwrap();
    util_warn("TIME [3] - "+(performance.now()-time2));
    time2 = performance.now();

    w?.webContents.send("updateProgress","main",3,total,"Associating mod slugs...");
    
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

    util_warn("TIME [4] - "+(performance.now()-time2));
    time2 = performance.now();
    
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

    util_warn("TIME [5] - "+(performance.now()-time2));
    time2 = performance.now();

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

    util_warn("TIME [6] - "+(performance.now()-time2));
    time2 = performance.now();

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

    util_warn("TIME [7] - "+(performance.now()-time2));
    time2 = performance.now();

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
        folder.mods = folder.mods.sort((a,b)=>(a.local.name??"").localeCompare(b.local.name??""));
    }

    w?.webContents.send("updateProgress","main",4,total,"Finished.");

    util_warn("TIME [8] - "+(performance.now()-time2));
    time2 = performance.now();


    // data.mods.global.sort((a,b)=>a.local.name.localeCompare(b.local.name));

    finish();

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

export async function genAllThePBR(iid:string,inst:ModPackInst|undefined){
    if(!inst || !inst.meta) return;
    
    let res = (await getInstMods_old({iid})).unwrap();
    if(!res) return;

    let prismPath = inst.getRoot();
    if(!prismPath) return errors.failedToGetPrismInstPath.unwrap();

    util_note("Generating 'All The PBR'.");
    // 

    let rpID = "All The PBR (Generated)";
    // let rpID = "All The PBR";

    let loc = inst.getPrismInstPath();
    if(!loc) return errors.failedToGetPrismInstPath.unwrap();
    loc = path.join(loc,".minecraft","resourcepacks",rpID);
    await util_mkdir(loc);
    let defaultLoc = path.join(appPath,"internal","rp","allThePBR");

    let w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid});
    if(!w) return errors.failedNewWindow.unwrap();

    // create pack
    let mcmeta = await util_readText(path.join(defaultLoc,"pack.mcmeta")) ?? JSON.stringify({
        pack: {
            pack_format: 15, // 15 is for 1.20.1
            description: "A generated pack that automatically creates specular and normal maps from all textures provided from the mods in the current instance."
        }
    },undefined,2);
    if(!await util_lstat(path.join(loc,"pack.mcmeta"))) await util_writeText(path.join(loc,"pack.mcmeta"),mcmeta);
    if(!await util_lstat(path.join(loc,"pack.png"))) await util_cp(path.join(defaultLoc,"pack.png"),path.join(loc,"pack.png"));

    let extractPath = path.join(path.join(appPath,".tmp","extract"));
    if(await util_lstat(extractPath)) await util_rm(extractPath,true);
    await util_mkdir(extractPath);
    if(await util_lstat(path.join(loc,"assets"))) await util_rm(path.join(loc,"assets"),true);
    
    // 

    let modsPath = path.join(prismPath,"mods");

    if(w.isDestroyed()) return;

    // extract all mods
    let modsList = await util_readdirWithTypes(modsPath);
    let proms:Promise<void>[] = [];

    let completed = 0;
    let modPaths:string[] = [];

    w.webContents.send("updateProgress","main",0,1,"Init: extraction");
    if(true) for(const f of modsList){
        if(!f.isFile()) continue;
        if(f.name.endsWith(".disabled")) continue;

        if(w!.isDestroyed()) return;

        proms.push(new Promise<void>(resolve=>{            
            let end = ()=>{
                completed++;
                w!.webContents.send("updateProgress","main",completed,modsList.length,"Extracting: "+f.name);
                
                resolve();
            };
            
            let newPath = path.join(extractPath,f.name);
            modPaths.push(newPath);
            let stream = Seven.extractFull(path.join(modsPath,f.name),newPath,{
                $bin:pathTo7zip,
                $cherryPick:["*.png"],
                recursive:true
            });
            stream.on("end",()=>{
                end();
            });
            stream.on("error",e=>{
                console.log("err: ",e);
                end();
            });
        }));
    }
    else{
        modPaths = (await util_readdir(extractPath)).map(v=>path.join(extractPath,v));
    }
    await Promise.all(proms);

    if(w.isDestroyed()) return;

    // copy textures into pack
    completed = 0;
    let total = 0;
    w.webContents.send("updateProgress","main",0,1,"Init: copy textures");
    
    for(const loc1 of modPaths){
        let modNamePaths = await util_readdir(path.join(loc1,"assets"));
        // total += modNamePaths.length; // quick copy all method

        for(const name of modNamePaths){
            if(w!.isDestroyed()) return;

            async function loop(loc2:string){
                let items = await util_readdirWithTypes(loc2);
                for(const item of items){
                    if(item.isDirectory()){
                        await loop(path.join(loc2,item.name));
                        return;
                    }
                    // file
                    total++;
                }
            }
            await loop(path.join(loc1,"assets",name,"textures","block"));
        }
    }
    if(w.isDestroyed()) return;

    for(const loc1 of modPaths){
        if(w.isDestroyed()) return;
        
        let modNamePaths = await util_readdir(path.join(loc1,"assets"));
        for(const name of modNamePaths){
            if(w!.isDestroyed()) return;
            
            async function loop(loc2:string,loc3:string){
                let items = await util_readdirWithTypes(loc2);
                for(const item of items){
                    if(item.isDirectory()){
                        await loop(path.join(loc2,item.name),path.join(loc3,item.name));
                        return;
                    }
                    // file
                    await Promise.all([
                        util_cp(path.join(loc2,item.name),path.join(loc3,item.name)),
                        util_cp(path.join(loc2,item.name),path.join(loc3,item.name.substring(0,item.name.length-4)+"_n.png")), // normal map
                        util_cp(path.join(loc2,item.name),path.join(loc3,item.name.substring(0,item.name.length-4)+"_s.png")), // specular map
                    ]);

                    completed++;
                    w!.webContents.send("updateProgress","main",completed,total,`Copy: (${name}) - ${item.name}`);
                }
            }
            await loop(path.join(loc1,"assets",name,"textures","block"),path.join(loc,"assets",name,"textures","block"));
            
            /////////////////
            // quick copy all method
            // let fromPath = path.join(loc1,"assets",name,"textures","block"); // only block textures are done for now
            // let toPath = path.join(loc!,"assets",name,"textures","block");
            // await util_mkdir(toPath,true); // is this needed?
            // await util_cp(fromPath,toPath,true);

            // completed++;
            // w!.webContents.send("updateProgress","main",completed,total,`Copy: ${name}`);
        }
    }

    if(w.isDestroyed()) return;

    // await wait(500);

    // finish up
    if(await util_lstat(extractPath)) await util_rm(extractPath,true);
    w.webContents.send("updateProgress","main",1,1,"Finished");
    w.close();
    util_note("FINISHED",completed,total);

    let last = getWindowStack().find(v=>v.title == "Edit Instance");
    if(last){
        last.webContents.send("updateSearch");
    }

    return true;
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

async function getMod(modPath:string,filename:string,update=0):Promise<LocalModData>{
    
    // let info = 
    // let cachePath = `"${path.join(dataPath,"cache","mods")}"`;
    // let modPath = `"${path.join(mod.parentPath,mod.name)}"`;
    // let cachePath = path.join(dataPath,"cache","mods",mod.name);
    // let cachePath = path.join(modPath,".cache",filename); // THIS IS THE OLD CACHE PATH
    // let modPath = path.join(mod.parentPath,mod.name);

    let cleanName = cleanModName(filename);

    let cachePath = path.join(dataPath,"cache","mods",cleanName);
    // await util_mkdir(cachePath,true);

    // LOAD CACHE
    if(true) if((await util_lstat(cachePath))?.isDirectory()){
        if(update != 2){
            let data = await util_readJSON(path.join(cachePath,"info.json"));
            if(data) return data as any;
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
    let info:LocalModData = {} as any;

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

            // iconPaths = info.icon;
            iconPaths.push(info.icon);
        }
    }
    else{ // other or just couldn't find data like with the Essential Mod & Kotlin for Forge

    }

    // if(info1){
        info._formatVersion = "1";
        info._type = type as any;

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
    // console.log("REFRESHING...",mainWindow);
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

            let minecraftLoc = ".minecraft";
            if(!await util_lstat(path.join(instancePath,inst,minecraftLoc))) minecraftLoc = "minecraft";
            let iconPath = path.join(instancePath,inst,minecraftLoc,"icon.png");
            if(!await util_lstat(iconPath)){
                iconPath = path.join(sysInst.meta.prismRoot,"icons",cfg.getValue("iconKey") ?? "mc.png");
            }

            data.list.push({
                name,
                group,
                version:versionComp.version,
                loader:loaderComp.cachedName,
                loaderVersion:loaderComp.version,
                totalTimePlayed:parseInt(totalTimePlayed),
                path:path.join(instancePath,inst),
                iconPath
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

            let minecraftLoc = ".minecraft";
            if(!await util_lstat(path.join(instancePath,inst,minecraftLoc))) minecraftLoc = "minecraft";
            let iconPath = path.join(instancePath,inst,minecraftLoc,"icon.png");
            if(!await util_lstat(iconPath)){
                iconPath = path.join(sysInst.meta.prismRoot,"icons",cfg.getValue("iconKey")+".png");
            }

            data.list.push({
                name,
                group:unnamedGroup,
                version:versionComp.version,
                loader:loaderComp.cachedName,
                loaderVersion:loaderComp.version,
                totalTimePlayed:parseInt(totalTimePlayed),
                path:path.join(instancePath,inst),
                iconPath
            });
    }

    return new Result(data);
}

export async function ensurePrismLinked(w?:BrowserWindow|null){
    if(!w) w = mainWindow;

    if(!sysInst) return false;
    if(!sysInst.meta) return false;
    
    if(!sysInst.meta.prismRoot){
        if(await util_lstat(path.join(process.env.APPDATA!,"PrismLauncher","instances"))){
            sysInst.meta.prismRoot = path.join(process.env.APPDATA!,"PrismLauncher");
            await sysInst.save();
        }
        else{
            await alertBox(w,"Prism Launcher path not set.\nPlease select your prism launcher folder.");

            let res = await dialog.showOpenDialog(w,{
                properties:[
                    "openDirectory",
                    "showHiddenFiles",
                ],
                filters:[],
                title:"Please select your prism launcher folder",
                defaultPath:path.join(process.env.APPDATA!,"PrismLauncher"),
            });
            if(!res) return false;
            let filePath = res.filePaths[0];
            if(!filePath) return false;
    
            sysInst.meta.prismRoot = filePath;
            await sysInst.save();
    
            await alertBox(w,"Prism Launcher folder path set to:\n"+filePath,"Success");
        }
    }
    // process.env.HOME!, process.env.APPDATA!

    if(!sysInst.meta.prismExe){
        // if(await util_lstat(path.join(process.env.APPDATA!,"..","local","programs","prismlauncher","prismlauncher.exe"))){
        if(await util_lstat(path.join(process.env.APPDATA!,"..","Local","Programs","PrismLauncher","prismlauncher.exe"))){
            sysInst.meta.prismExe = path.join(process.env.APPDATA!,"..","Local","Programs","PrismLauncher");
            await sysInst.save();
        }
        else{
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
                defaultPath:path.join(process.env.APPDATA!,"..","Local","Programs","PrismLauncher"),
            });
            if(!res) return false;
            let filePath = res.filePaths[0];
            if(!filePath) return false;

            filePath = path.join(filePath,"..");
            sysInst.meta.prismExe = filePath;
            await sysInst.save();

            await alertBox(w,"Prism Launcher executable path set to:\n"+filePath,"Success");
        }
    }
    
    return true;
}

function getWindow(ev:Electron.IpcMainInvokeEvent){
    return BrowserWindow.fromWebContents(ev.sender) ?? undefined;
}
export async function alertBox(w:BrowserWindow,message:string,title="Error"){
    return await dialog.showMessageBox(w,{
        message,
        title
    });
}

// 

import { ETL_Generic, evtTimeline, parseCFGFile, pathTo7zip, searchStringCompare, util_cp, util_lstat, util_mkdir, util_note, util_note2, util_readBinary, util_readdir, util_readdirWithTypes, util_readJSON, util_readText, util_readTOML, util_rename, util_rm, util_utimes, util_warn, util_writeBinary, util_writeJSON, util_writeText, wait } from "./util";
import { AddRP_InitData, Arg_AddInstance, Arg_AddModToFolder, Arg_ChangeFolderType, Arg_CheckModUpdates, Arg_CreateFolder, Arg_DownloadRP, Arg_DownloadRPFile, Arg_DownloadWorld, Arg_DownloadWorldFile, Arg_FinishUploadWorld, Arg_GetAllowedDirs, Arg_GetInstances, Arg_GetInstMods, Arg_GetInstResourcePacks, Arg_GetInstScreenshots, Arg_GetInstWorlds, Arg_GetPrismInstances, Arg_GetRPs, Arg_GetRPVersions, Arg_GetServerWorlds, Arg_GetWorldFiles, Arg_GetWorldInfo, Arg_IID, Arg_LaunchInst, Arg_PublishWorld, Arg_RemoveRP, Arg_SearchPacks, Arg_SyncMods, Arg_TakeWorldOwnership, Arg_ToggleWorldEnabled, Arg_UnpackRP, Arg_UnpublishWorld, Arg_UploadRP, Arg_UploadWorld, Arg_UploadWorldFile, ArgC_GetRPs, CurseForgeUpdate, Data_PrismInstancesMenu, FSTestData, FullModData, InputMenu_InitData, InstGroups, LocalModData, MMCPack, ModData, ModifiedFile, ModifiedFileData, ModIndex, ModInfo, ModrinthModData, ModrinthUpdate, ModsFolder, ModsFolderDef, PackMetaData, RemoteModData, Res_DownloadRP, Res_FinishUploadWorld, Res_GetInstMods, Res_GetInstResourcePacks, Res_GetInstScreenshots, Res_GetModIndexFiles, Res_GetModUpdates, Res_GetPrismInstances, Res_GetRPs, Res_GetRPVersions, Res_GetServerWorlds, Res_GetWorldFiles, Res_GetWorldInfo, Res_InputMenu, Res_SyncMods, RPCache, SArg_GetServerWorlds, SArg_PublishWorld, SArg_TakeWorldOwnership, ServerWorld, UpdateProgress_InitData } from "./interface";
import { getConnectionStatus, getModUpdates, getPackMeta, getSocketId, searchPacks, searchPacksMeta, semit, updateSocketURL } from "./network";
import { getWindowStack, ListPrismInstReason, openCCMenu, openCCMenuCB, SearchPacksMenu, ViewInstanceMenu } from "./menu_api";
import { addInstance, appPath, cleanModName, cleanModNameDisabled, dataPath, getMainAccount, getModFolderPath, getModpackInst, getModpackPath, getRPInfo, getWorlds, instCache, LocalModInst, ModPackInst, RemoteModInst, slugMap, sysInst, toggleWorldEnabled } from "./db";
import { InstanceData } from "./db_types";
import { errors, Result } from "./errors";
import { readConfigFile, StringMappingType } from "typescript";
import { getMaxListeners } from "stream";
import { exec } from "child_process";
import { Dirent } from "fs";
// import { CineonToneMapping } from "three";
import axios from "axios";
import { toggleModEnabled, allDropdowns } from "./dropdowns";
import { text } from "stream/consumers";

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