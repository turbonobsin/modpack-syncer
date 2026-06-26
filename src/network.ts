import { io } from "socket.io-client";
import { Arg_CheckModUpdates, Arg_Connection, Arg_GetModUpdates, Arg_SearchPacks, PackMetaData, Res_GetModUpdates, Res_SearchPacks, Res_SearchPacksMeta, UpdateSearch } from "./interface";
import { util_note, util_note2, util_warn } from "./util";
import { errors, Result } from "./errors";
import { getMainAccount, instCache, ModPackInst, sysInst } from "./db";
import { Socket } from "socket.io";
import { getWindowStack } from "./menu_api";
// const socket = io({
//     host:"http://localhost:3000"
// });

// export let remoteServerURL = "http://localhost:3001";

export let socket = io("");
export function getSocketId(){
    return socket.id;
}

export function updateSocketURL(){
    let url0 = sysInst.meta?.serverURL;
    if(!url0) return;

    // 1. Get the current path (e.g., "/umm/" or "/mp/" or "/")
    // let serverUrlOrigin = server_url.value.match(/^.+\:\/\/.+\//)[0];
    let url = new URL(url0);
    let currentPath = url.pathname;

    // 2. Ensure it ends with a trailing slash if it isn't just root
    if (!currentPath.endsWith('/')) {
        currentPath += '/';
    }

    // 3. Append the required socket.io suffix
    const dynamicSocketPath = currentPath + "socket.io/";
    
    socket = io(url.origin,{
        path:dynamicSocketPath,
    });
    // 

    socket.on("connect",()=>{
        getMainAccount().then(acc=>{
            if(!acc){
                util_warn("Failed to get account data to login");
                return;
            }
    
            semit<Arg_Connection,boolean>("connectUser",{
                uid:acc.profile.id,
                uname:acc.profile.name
            }).then(v=>{
                let res = v.unwrap();
                console.log("Logged in: "+(res?"SUCCESS":"FAILED"));
            });
        });
    });

    socket.on("updateSearch",(arg:UpdateSearch)=>{
        let w = getWindowStack().find(v=>v?.title == "Edit Instance");
        if(!w){
            // console.log("No update: couldn't find 'Edit Instance'");
            return;
        }
    
        let inst:ModPackInst|undefined;
        for(const [k,v] of instCache.modpack){
            if(v.meta?.meta.id == arg.mpID){
                inst = v;
                break;
            }
        }
        if(!inst){
            // console.log("No update: couldn't find inst");
            return;
        }
        if(!inst.meta?.meta.id){
            // console.log("No update: inst not loaded");
            return;
        }
    
        w.webContents.send("updateSearch",{
            mpID:inst.meta.meta.id, // this needs to be mpID but idk how to do that from the client yet -> done :D
            id:arg.id,
            data:arg.data
        });
    });
}

// socket.emit("msg","hello!");

console.log("---loaded network.ts");

// 

export type Err<T> = {
    err?:string,
    data?:T
};
const unknownErr:Err<undefined> = {
    err:"Unknown error"
};

export function getConnectionStatus(){
    return socket.connected;
}

function validate():Err<undefined>|undefined{
    if(!socket.connected){
        util_warn("Not connected to backend");
        return {
            err:"Not connected to backend server"
        }
    }
    
    return;
}

export async function semit<T,V>(ev:string,arg:T): Promise<Result<V>>{
    if(!socket.connected){
        return errors.serverNotConnected;
    }
    
    return await new Promise<Result<V>>(resolve=>{
        socket.emit(ev,arg,(res:V)=>{
            resolve(new Result(res));
        });
    });
}

export function getPackMeta(id:string){
    let validationErr = validate();
    if(validationErr) return validationErr ?? unknownErr;
    
    return new Promise<Err<PackMetaData>>(resolve=>{
        socket.emit("getPackMeta",id,(res:Err<PackMetaData>)=>{
            if(res.err) util_warn(res.err);
            resolve(res);
        });
    });
}
export function searchPacks(arg:Arg_SearchPacks){
    return semit<Arg_SearchPacks,Res_SearchPacks>("searchPacks",arg);
}
export async function searchPacksMeta(arg:Arg_SearchPacks){
    if(!sysInst.meta) return;

    let res = (await semit<Arg_SearchPacks,Res_SearchPacksMeta>("searchPacksMeta",arg)).unwrap();
    if(!res) return;

    for(const item of res.similar){
        let url = getServerURLWithNewPath(sysInst.meta.serverURL,{
            pathname:"modpack_image"
        });
        // url.pathname += "modpack_image";
        url.searchParams.set("mpID",item.id);
        item.img = url.href;

        // if(item.mmcPackFile instanceof Buffer){
        //     util_note2("was buf");
        //     item.mmcPackFile = item.mmcPackFile.buffer.slice(0);
        // }
        // else util_note2("wasn't buf: ",item.mmcPackFile);
        // if(item.instanceCfgFile) item.instanceCfgFile = Array.fr`om(item.instanceCfgFile);
    }

    return res;
}

export function getServerURLWithNewPath(serverURL:string,ops:{
    pathname?:string;
}={}){
    const url = new URL(serverURL.replaceAll("\\","/").replaceAll("//","/"));
    if(!url.pathname.endsWith("/")) url.pathname += "/";
    if(ops.pathname){
        url.pathname += ops.pathname;
    }
    return url;
}

// sync
export function checkModUpdates_old(arg:Arg_CheckModUpdates){
    return semit<Arg_CheckModUpdates,boolean>("checkModUpdates",arg);
}
export function getModUpdates(arg:Arg_GetModUpdates){
    return semit<Arg_GetModUpdates,Res_GetModUpdates>("getModUpdates",arg);
}