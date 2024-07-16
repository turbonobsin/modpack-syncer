import { app } from "electron";
import { util_lstat, util_mkdir, util_readdir, util_readJSON, util_readText, util_warn, util_writeJSON } from "./util";
import path from "path";
import { DBSys, DBUser, InstanceData as ModPackInstData } from "./db_types";
import { PackMetaData } from "./interface";
import { errors, Result } from "./errors";

let appPath = app.getAppPath();
const dataPath = path.join(appPath,"data");
const folderPath = path.join(dataPath,"folders");

// 
let userData:DBUser;
// let sysData:DBSys;

function markSave(path:string,data:any){
    util_writeJSON(path,data);
}

enum IDType{
    user,
    instance,
    folder
}
function genId(type:IDType){
    if(!sysInst){
        util_warn("SysInst not loaded");
        return;
    }
    if(!sysInst.meta){
        util_warn("SysInst's meta not loaded");
        return;
    }
    
    switch(type){
        case IDType.user:
            sysInst.meta.uid++;
            // markSave(path.join(dataPath,"sys.json"),sysData);
            sysInst.save();
            return sysInst.meta.uid.toString();
        case IDType.folder:
            sysInst.meta.fid++;
            sysInst.save();
            return "folder_"+sysInst.meta.fid;
        case IDType.instance:
            sysInst.meta.iid++;
            sysInst.save();
            return "inst_"+sysInst.meta.iid;
        default:
            return;
    }
}

async function createFolder(name:string,parentPath=folderPath){
    await util_mkdir(path.join(parentPath,name));
    return name;
}

// async function getNewFID(){
//     sysData.fid++;
//     return "folder_"+sysData.fid;
// }

export async function initDB(){
    // if(!await util_lstat(path.join(dataPath,"sys.json"))){
    //     sysData = {
    //         fid:0,
    //         iid:0,
    //         uid:0,
    //         ver:"0.0.1"
    //     };
    //     await util_writeJSON(path.join(dataPath,"sys.json"),sysData);
    // }
    // else{
    //     let res = await util_readJSON<DBSys>(path.join(dataPath,"sys.json"));
    //     if(!res){
    //         util_warn("Could not load system data");
    //         return;
    //     }
    //     sysData = res;
    // }

    sysInst = await sysInst.load();
    
    // 
    let username = "Unnamed";
    await util_mkdir(dataPath);
    
    let userPath = path.join(dataPath,"user.json")
    if(!await util_lstat(userPath)){
        await util_writeJSON(userPath,{
            name:username,
        } as DBUser);

        await createFolder("instances",dataPath);
    }

    let res = await util_readJSON<DBUser>(userPath);
    if(!res){
        util_warn("Could not load user data");
        return;
    }
}

// 

abstract class Inst<T>{
    constructor(filePath:string){
        this.filePath = filePath;
    }
    filePath:string;
    meta?:T;
    useDefaultIfDNE(){
        return false;
    }
    abstract getDefault():T|undefined;
    async fillDefaults(){
        let def = this.getDefault() as any;
        if(!def) return;
        let o = this.meta as any;
        let wasChange = false;

        let keys = Object.keys(def);
        for(const k of keys){
            if(o[k] == undefined){
                o[k] = def[k];
                wasChange = true;
            }
        }

        if(wasChange) await this.save();

        return this;
    }

    async load(defMeta?:T){ // todo - add some point need to have an instance cache and it'll just grab from that if needed, that way I can queue all write operations
        let stats = await util_lstat(this.filePath);
        if(!stats){
            if(!defMeta && !this.useDefaultIfDNE()){
                util_warn("couldn't read file [1]");
                return this;
            }
            let def = defMeta ?? this.getDefault();
            if(!def){
                util_warn("no default was provided");
                return this;
            }

            this.meta = def;
            await this.save();

            return this;
        }
        let res = await util_readJSON<T>(this.filePath);
        if(!res){
            util_warn("couldn't read file [2]");
            return this;
        }

        this.meta = res;
        await this.fillDefaults();

        return this;
    }
    async save(){ // not sure if I want to do save now or add it to a queue
        await util_writeJSON(this.filePath,this.meta);
    }
}

export class SysInst extends Inst<DBSys>{
    constructor(filePath:string){
        super(filePath);
    }
    useDefaultIfDNE(): boolean {
        return true;
    }
    getDefault(): DBSys | undefined {
        return {
            fid:0,
            iid:0,
            uid:0,
            ver:"0.0.1"
        };
    }
}
export class UserInst extends Inst<DBUser>{
    constructor(filePath:string){
        super(filePath);
    }
    getDefault(): DBUser | undefined {
        return;
    }
}
export class ModPackInst extends Inst<ModPackInstData>{
    constructor(filePath:string){
        super(filePath);
    }
    getDefault(): ModPackInstData | undefined {
        return;
    }

    getPrismInstPath(): string|undefined{
        if(!sysInst.meta) return;
        if(!sysInst.meta.prismRoot) return;
        if(!this.meta) return;
        if(!this.meta.linkName) return;

        return path.join(sysInst.meta.prismRoot,"instances",this.meta.linkName);
    }
    /**
     * Gets the instance's .minecraft folder
     */
    getRoot(): string|undefined{
        if(!sysInst.meta) return;
        if(!sysInst.meta.prismRoot) return;
        if(!this.meta) return;
        if(!this.meta.linkName) return;

        return path.join(sysInst.meta.prismRoot,"instances",this.meta.linkName,".minecraft");
    }
}

const fspath_modPacks = path.join(dataPath,"instances");

export function getModpackInst(iid:string){
    return new ModPackInst(path.join(fspath_modPacks,iid,"meta.json")).load();
}

function makeInstanceData(meta:PackMetaData){
    let iid = genId(IDType.instance);
    if(iid == null) return;
    
    let data:ModPackInstData = {
        iid,
        meta
    };
    return data;
}
export async function addInstance(meta:PackMetaData):Promise<Result<ModPackInst>>{
    let instanceData = makeInstanceData(meta);
    if(!instanceData){
        return errors.instDataConvert;
    }

    if(!await util_mkdir(path.join(fspath_modPacks,instanceData.iid))) return errors.addInstFolder;

    let inst = await new ModPackInst(path.join(fspath_modPacks,instanceData.iid,"meta.json")).load(instanceData);
    if(!inst){
        util_warn("Failed to add instance:");
        console.log(meta);
        return errors.addInstance;
    }
    console.log("ADDED INSTANCE:",inst);

    return new Result(inst);
}

// 
export let sysInst = new SysInst(path.join(dataPath,"sys.json"));