import { getModpackInst, ModPackInst, sysInst } from "./db";
import { errors } from "./errors";
import { UpdateProgress_InitData } from "./interface";
import { openCCMenu } from "./menu_api";
import { getServerURLWithNewPath } from "./network";
import path from "path";
import { util_mkdir, util_note, util_readText, util_warn, util_writeBinary, util_writeText, wait } from "./util";
import { dialog } from "electron";
import { mainWindow } from "./main";

export type ExtrasJson = {
    shaderpacks?:{
        /**
         * something.zip
         */
        file:string;
    }[];
};

export async function syncKeybinds(iid:string){
    const data = await setupExtras(iid);
    if(!data) return;

    const existing = await util_readText(path.join(data.minecraftLoc,"options.txt"));
    if(!existing){
        await syncOptionsDotTxt(iid);
        return;
    }

    // 
    
    const url = getExtrasURL(data.inst,"options.txt");
    if(!url){
        return;
    }
    
    const res = await fetch(url,{
        method:"GET"
    });

    if(!res.ok){
        dialog.showErrorBox("Failed to Sync Keybinds","This pack doesn't have a keybinds file available.");
        return;
    }

    try{
        let newFile = await res.text();
        if(!newFile) throw "Failed to load retrieved keybinds file";

        const finalLines = existing.split("\n").map(v=>v.trim().replace(/\r/g,""));

        let existingKeys = getKeysFromOptionsFile(existing);
        let newKeys = getKeysFromOptionsFile(newFile);

        // vvv - override in existingKeys the new ones from newKeys
        for(const key in newKeys){
            // existingKeys[key] = newKeys[key];
            let ind = finalLines.indexOf(`${key}:${existingKeys[key]}`);
            if(ind != -1) finalLines.splice(ind);

            finalLines.push(`${key}:${newKeys[key]}`);
        }

        await util_writeText(path.join(data.minecraftLoc,"options.txt"),finalLines.join("\n"));
        await dialog.showMessageBox(mainWindow,{
            message:"Sync Keybinds successfully"
        });
    }
    catch(e:any){
        dialog.showErrorBox("Failed to Sync Keybinds",e);
    }
}

function getKeysFromOptionsFile(file:string){
    let lines:string[] = file.split("\n").map(v=>v.trim().replace(/\r/g,""));
    
    let keys:Record<string,string> = {};
    for(const line of lines){
        if(line.startsWith("key_")){
            const [k,v] = line.split(":");
            keys[k] = v;
        }
    }

    return keys;
}

export async function syncShaders(iid:string){
    const data = await setupExtras(iid);
    if(!data) return;
    
    const url = getExtrasURL(data.inst,"extras.json");
    if(!url){
        // w.close();
        return;
    }

    let w:Electron.CrossProcessExports.BrowserWindow | undefined;

    try{
        const res = await fetch(url,{
            method:"GET"
        });

        if(!res.ok) throw "This pack doesn't have any available shaderpacks.";

        const extras = await res.json() as ExtrasJson;
        if(!extras.shaderpacks) throw "This pack doesn't have any available shaderpacks.";

        await util_mkdir(path.join(data.minecraftLoc,"shaderpacks"),true);

        w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid});
        if(!w) return errors.failedNewWindow.unwrap();

        w.webContents.send("updateProgress","main",0,1,"Initializing mod upload...");

        let total = extras.shaderpacks.length;
        let completed = 0;
        let failed:string[] = [];
        let success:string[] = [];
        
        let proms:Promise<void>[] = [];
        
        for(const sp of extras.shaderpacks){
            proms.push(new Promise<void>(async resolve=>{
                try{
                    completed++;

                    if(w?.isDestroyed()){
                        resolve();
                        return;
                    }
                    w?.webContents.send("updateProgress","main",completed,total,"Download: "+sp.file);
                    
                    if(sp.file.includes("..") || sp.file.includes("/")){
                        resolve();
                        return; // <-- for security/safety
                    }

                    // actual shaderpack file
                    
                    const shaderURL = getExtrasURL(data.inst,"shaderpacks/"+sp.file);
                    if(!shaderURL){
                        failed.push(sp.file);
                        resolve();
                        return;
                    }

                    console.log("try to download: ",shaderURL.href);

                    const shaderRes = await fetch(shaderURL,{
                        method:"GET",
                    });

                    if(!shaderRes.ok){
                        util_warn("failed to download shaderpack",sp.file,shaderURL.href);
                        util_note(await shaderRes.text());
                        failed.push(sp.file);
                        resolve();
                        return;
                    }

                    const writeSuccess = await util_writeBinary(path.join(data.minecraftLoc,"shaderpacks",sp.file),Buffer.from(await shaderRes.arrayBuffer()));
                    if(writeSuccess){
                        success.push(sp.file);
                    }
                    else{
                        failed.push(sp.file);
                    }

                    // shader config

                    const shaderConfigURL = getExtrasURL(data.inst,"shaderpacks/"+sp.file+".txt");
                    if(!shaderConfigURL){
                        resolve();
                        return;
                    }

                    const shaderConfigRes = await fetch(shaderConfigURL,{
                        method:"GET",
                    });

                    if(!shaderConfigRes.ok){
                        util_note("failed to download (or find) shaderpack config file",sp.file,shaderConfigURL.href);
                        resolve();
                        return;
                    }
                    
                    await util_writeBinary(path.join(data.minecraftLoc,"shaderpacks",sp.file+".txt"),Buffer.from(await shaderConfigRes.arrayBuffer()));

                    resolve();
                }
                catch(e:any){
                    resolve();
                }
            }));
        }

        // success

        
        await Promise.all(proms);
        // 

        w.webContents.send("updateProgress","main",total,total,"Finished.",{
            sections:[
                {
                    header:`Failed: (${failed.length})`,
                    text:failed
                },
                {
                    header:`Downloaded: (${success.length})`,
                    text:success
                }
            ]
        });

        if(failed.length == 0){
            await wait(1000);
            w.close();
        }
    }
    catch(e:any){
        w?.close();
        dialog.showErrorBox("Failed to Sync Shaderpacks",`${e}`);
        return;
    }
}

function getExtrasURL(inst:ModPackInst,path:string){
    if(!sysInst.meta) return;
    if(!inst.meta) return;
    
    let url = getServerURLWithNewPath(sysInst.meta.serverURL,{
        pathname:"modindex"
    });
    url.searchParams.set("id",inst.meta.meta.id);
    url.searchParams.set("name","../../extras/"+path);

    return url;
}

async function setupExtras(iid:string){
    if(!iid) return;
    if(!sysInst || !sysInst.meta) return;
    
    let inst = await getModpackInst(iid);
    if(!inst || !inst.meta) return;
    
    let prismPath = inst.getPrismInstPath();
    if(!prismPath) return

    // let w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid});
    // if(!w) return errors.failedNewWindow.unwrap();

    // w.webContents.send("updateProgress","main",0,1,"Initializing mod upload...");

    let minecraftLoc = path.join(prismPath,".minecraft");

    return {
        sysInst,
        inst,
        prismPath,
        minecraftLoc
    };
}

export async function syncOptionsDotTxt(iid:string,silent=false){
    const data = await setupExtras(iid);
    if(!data) return;
    
    const url = getExtrasURL(data.inst,"options.txt");
    if(!url){
        // w.close();
        return;
    }
    
    const res = await fetch(url,{
        method:"GET"
    });

    if(!res.ok){
        // w.close();
        if(!silent) dialog.showErrorBox("Failed to Sync Settings","This pack doesn't have a settings file available.");
        return;
    }

    try{
        await util_writeBinary(path.join(data.minecraftLoc,"options.txt"),Buffer.from(await res.arrayBuffer()));
        if(!silent) await dialog.showMessageBox(mainWindow,{
            message:"Sync Settings successfully"
        });
    }
    catch(e:any){
        if(!silent) dialog.showErrorBox("Failed to Sync Settings",e);
    }
    
    // 

    // let total = res.files.length;
    // let completed = 0;
    // let failed:string[] = [];
    // let success:string[] = [];
    
    // let proms:Promise<void>[] = [];
    // for(const file of res.files){
    //     proms.push(new Promise<void>(async resolve=>{
    //         if(w?.isDestroyed()){
    //             resolve();
    //             return;
    //         }
    //         w.webContents.send("updateProgress","main",completed,total,"Upload: "+file);
            
    //         let buf = await util_readBinary(path.join(modLoc,file));
    //         if(!buf){
    //             failed.push(file);
    //             completed++;
    //             resolve();
    //             return;
    //         }
    //         let res = await semit<Arg_UploadModpackFile,boolean>("upload_modpack_file",{
    //             buf,
    //             mpID:inst.meta!.meta.id,
    //             sloc:file
    //         });
    //         if(!res){
    //             failed.push(file);
    //             completed++;
    //         }
    //         else{
    //             success.push(file);
    //             completed++;
    //         }

    //         resolve();
    //     }));
    // }

    // await Promise.all(proms);
    // // 

    // w.webContents.send("updateProgress","main",total,total,"Finished.",{
    //     sections:[
    //         {
    //             header:`Failed: (${failed.length})`,
    //             text:failed
    //         },
    //         {
    //             header:`Uploaded: (${success.length})`,
    //             text:success
    //         }
    //     ]
    // });
}