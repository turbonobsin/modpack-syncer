// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ContextBridge, ipcRenderer } from "electron";
import { IGlobalAPI } from "./interface";

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

/**
 * Register function
 */
function regf(cmdId:string){
    return async (...args:unknown[]) => await invoke(cmdId,...args);
}
/**
 * Register listener
 */
function regl(cmdId:string){
    return (cb:(...data:any[])=>void) => ipcRenderer.on(cmdId,(ev,...data)=>cb(...data));
}

contextBridge.exposeInMainWorld("gAPI",{
    fsTest: async (...args) => await invoke("fsTest",...args),
    getPackMeta: async (...args) => await invoke("getPackMeta",...args),
    alert: async (...args) => await invoke("alert",...args),
    openMenu: async (...args) => await invoke("openMenu",...args),
    triggerEvt:regf("triggerEvt"),

    searchPacks:regf("searchPacks"),
    searchPacksMeta:regf("searchPacksMeta"),

    addInstance:regf("addInstance"),
    getInstances:regf("getInstances"),
    showLinkInstance:regf("showLinkInstance"),
    linkInstance:regf("linkInstance"),

    getInstScreenshots:regf("getInstScreenshots"),
    getInstMods:regf("getInstMods"),
    getInstRPs:regf("getInstRPs"),
    getInstWorlds:regf("getInstWorlds"),

    getWorld:regf("getWorld"),
    publishWorld:regf("publishWorld"),
    uploadWorld:regf("uploadWorld"),
    downloadWorld:regf("downloadWorld"),
    getServerWorlds:regf("getServerWorlds"),
    getWorldImg:regf("getWorldImg"),
    takeWorldOwnership:regf("takeWorldOwnership"),
    toggleWorldEnabled:regf("toggleWorldEnabled"),

    checkForInstUpdates:regf("checkForInstUpdates"),
    updateInst:regf("updateInst"),
    removeInst:regf("removeInst"),
    unlinkInst:regf("unlinkInst"),

    getModIndexFiles:regf("getModIndexFiles"),
    cacheMods:regf("cacheMods"),
    toggleModEnabled:regf("toggleModEnabled"),

    getPrismInstances:regf("getPrismInstances"),

    launchInstance:regf("launchInstance"),

    showEditInstance:regf("showEditInstance"),

    getImage:regf("getImage"),
    changeServerURL:regf("changeServerURL"),

    getTheme:regf("getTheme"),

    // folders
    folder:{
        create:regf("folder-create"),
        changeType:regf("folder-changeType"),
        addMod:regf("folder-addMod")
    },

    // resource packs
    uploadRP:regf("uploadRP"),
    unpackRP:regf("unpackRP"),
    removeRP:regf("removeRP"),
    downloadRP:regf("downloadRP"),
    getRPs:regf("getRPs"),
    getRPImg:regf("getRPImg"),
    genAllThePBR:regf("genAllThePBR"),
    getRPInfo:regf("getRPInfo"),

    dropdown:{
        mod:regf("dropdown-mod")
    },
    openDropdown:regf("openDropdown"),

    // sync
    sync:{
        mods:regf("syncMods")
    },

    onInitMenu: (cb) => ipcRenderer.on("initMenu",(ev,data)=>cb(data)),
    onInitReturnCB: (cb) => ipcRenderer.on("initReturnCB",(ev,data)=>cb(data)),
    refresh: (cb) => ipcRenderer.on("refresh",(ev,data)=>cb(data)),
    onMsg: (cb) => ipcRenderer.on("msg",(ev,data)=>cb(data)),
    onEditImg:regl("editImg"),
    onSetClientTheme:regl("setClientTheme"),
    onUpdateSearch:regl("updateSearch"),

    onUpdateProgress:regl("updateProgress")
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