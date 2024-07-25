import { io } from "socket.io-client";
import { Arg_CheckModUpdates, Arg_GetModUpdates, Arg_SearchPacks, PackMetaData, Res_GetModUpdates, Res_SearchPacks, Res_SearchPacksMeta } from "./interface";
import { util_warn } from "./util";
import { errors, Result } from "./errors";
import { sysInst } from "./db";
import { Socket } from "socket.io";
// const socket = io({
//     host:"http://localhost:3000"
// });

// export let remoteServerURL = "http://localhost:3001";

let socket = io("");

export function updateSocketURL(){
    let url = sysInst.meta?.serverURL;
    if(!url) return;

    socket = io(url);
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

function validate():Err<undefined>|undefined{
    if(!socket.connected){
        util_warn("Not connected to backend");
        return {
            err:"Not connected to backend server"
        }
    }
    
    return;
}

export function semit<T,V>(ev:string,arg:T){
    if(!socket.connected){
        return errors.serverNotConnected;
    }
    
    return new Promise<Result<V>>(resolve=>{
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
export function searchPacksMeta(arg:Arg_SearchPacks){
    return semit<Arg_SearchPacks,Res_SearchPacksMeta>("searchPacksMeta",arg);
}

// sync
export function checkModUpdates_old(arg:Arg_CheckModUpdates){
    return semit<Arg_CheckModUpdates,boolean>("checkModUpdates",arg);
}
export function getModUpdates(arg:Arg_GetModUpdates){
    return semit<Arg_GetModUpdates,Res_GetModUpdates>("getModUpdates",arg);
}