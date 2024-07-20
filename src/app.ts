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
        return await openModDropdown(w,iid,files);
    });

    // 
    ipcMain.handle("getImage",async (ev,fullPath:string)=>{
        let buf = await util_readBinary(fullPath);
        return buf;
    });
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
        console.log("LMC: ",[...localModCache].map(v=>v[0]).join(", "));
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

    return new Result([...modCache.entries()].map(v=>v[1].meta).filter(v=>v != null));
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

    let data:Res_GetInstMods = {
        mods:{
            global:[],
            local:[]
        }
    };
    let _map:Map<string,FullModData> = new Map();

    let localList = (await cacheModsLocal(arg.iid)).unwrap();
    if(localList){
        for(const meta of localList){
            _map.set(meta.file,{
                local:meta
            });
        }
    }

    let remoteList = (await cacheModsRemote(arg.iid)).unwrap();
    if(remoteList){
        for(const meta of remoteList){
            let slug = meta.modrinth?.slug ?? meta.curseforge?.slug;
            if(!slug) continue;
            let d = _map.get(slug);
            if(!d) continue;

            d.remote = meta;
        }
    }

    console.log(">> local: "+localList?.length+" :: remote: "+remoteList?.length);

    for(const [slug,meta] of _map){
        data.mods.global.push(meta);
    }

    if(arg.query){
        data.mods.global = data.mods.global.filter(v=>searchStringCompare(v.local.name,arg.query));
    }

    data.mods.global.sort((a,b)=>a.local.name.localeCompare(b.local.name));

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

import { parseCFGFile, searchStringCompare, util_lstat, util_mkdir, util_readBinary, util_readdir, util_readdirWithTypes, util_readJSON, util_readText, util_readTOML, util_rename, util_warn, util_writeJSON, util_writeText, wait } from "./util";
import { Arg_GetInstances, Arg_GetInstMods, Arg_GetInstScreenshots, Arg_GetPrismInstances, Arg_IID, Arg_SearchPacks, CurseForgeUpdate, Data_PrismInstancesMenu, FSTestData, FullModData, InstGroups, LocalModData, MMCPack, ModData, ModIndex, ModInfo, ModrinthModData, ModrinthUpdate, PackMetaData, RemoteModData, Res_GetInstMods, Res_GetInstScreenshots, Res_GetModIndexFiles, Res_GetPrismInstances } from "./interface";
import { getPackMeta, searchPacks, searchPacksMeta } from "./network";
import { ListPrismInstReason, openCCMenu, openCCMenuCB, SearchPacksMenu, ViewInstanceMenu } from "./menu_api";
import { addInstance, cleanModName, dataPath, getModFolderPath, getModpackInst, getModpackPath, LocalModInst, ModPackInst, RemoteModInst, slugMap, sysInst } from "./db";
import { InstanceData } from "./db_types";
import { errors, Result } from "./errors";
import { readConfigFile } from "typescript";
import { getMaxListeners } from "stream";
import { exec } from "child_process";
import { Dirent } from "fs";
import { CineonToneMapping } from "three";
import axios from "axios";
import { openModDropdown, toggleModEnabled } from "./dropdowns";

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