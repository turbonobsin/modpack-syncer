// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ContextBridge, ipcRenderer } from "electron";
import { wait } from "./util";
import { IGlobalAPI, PackMetaData } from "./interface";

function promiseWrapper<T>(channel:string,...args:unknown[]){
    return async ()=>{
        return new Promise<T>(resolve=>{
            ipcRenderer.send(channel,(data:T)=>{
                resolve(data);
            },...args);
        })
    };
}

function invoke(channel:string,...args:unknown[]){
    return ipcRenderer.invoke(channel,...args);
}

// let _tmp:Record<string,((...args:unknown[])=>Promise<any>) | ((cb:(...args:unknown[])=>Promise<any>)=>void)> = {} as IGlobalAPI;
// let _tmp = {} as IGlobalAPI;
// let gAPI_methods = [
//     "fsTest",
//     "getPackMeta",
//     "alert",
//     "openMenu"
// ];

// for(const v of gAPI_methods){
//     _tmp[v] = async (...args:unknown[])=>await invoke(v,...args);
// }

function regf(cmdId:string){
    return async (...args:unknown[]) => await invoke(cmdId,...args);
}

contextBridge.exposeInMainWorld("gAPI",{
    fsTest: async (...args) => await invoke("fsTest",...args),
    getPackMeta: async (...args) => await invoke("getPackMeta",...args),
    alert: async (...args) => await invoke("alert",...args),
    openMenu: async (...args) => await invoke("openMenu",...args),

    searchPacks:regf("searchPacks"),
    searchPacksMeta:regf("searchPacksMeta"),

    addInstance:regf("addInstance"),
    getInstances:regf("getInstances"),
    linkInstance:regf("linkInstance"),

    getPrismInstances:regf("getPrismInstances"),

    onInitMenu: (cb) => ipcRenderer.on("initMenu",(ev,data)=>cb(data)),
    onInitReturnCB: (cb) => ipcRenderer.on("initReturnCB",(ev,data)=>cb(data)),
} as IGlobalAPI);

// contextBridge.exposeInMainWorld("gAPI",{
//     fsTest: async (...args:unknown[])=> await invoke("fs-test",...args),
//     getPackMeta: async (...args:unknown[])=> await invoke("get-pack-meta",...args),
//     alert: async (...args:unknown[])=> await invoke("alert",...args),
// });

// 
// window.addEventListener("DOMContentLoaded",e=>{
//     ipcRenderer.on("initMenu",(...args)=>{
//         console.log("INIT:",...args);
//     });
// });

window.addEventListener("DOMContentLoaded",e=>{
    // document.body.parentElement?.classList.add("themestyle-clean-dark");
    document.body.parentElement?.classList.add("themestyle-dark");
    // document.body.parentElement?.classList.add("themestyle-clean-light");
    // document.body.parentElement?.classList.add("themestyle-light","theme-light2");
});