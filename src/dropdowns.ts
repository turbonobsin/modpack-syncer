import { BrowserWindow, Menu } from "electron";
import { cleanModNameDisabled, getStandardInstData } from "./db";
import { Result } from "./errors";
import { util_rename } from "./util";
import path from "path";

export async function openModDropdown(w:BrowserWindow,iid:string,files:string[]){
    // let end:(changed:string[][])=>void;
    // let prom = new Promise<string[][]>(resolve=>end = resolve);
    let end:(data?:any)=>void;
    let prom = new Promise<any>(resolve=>end = resolve);
    
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
        }
    ])
    // Menu.setApplicationMenu(menu);
    
    menu.popup({window:w});
    return await prom;
}

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