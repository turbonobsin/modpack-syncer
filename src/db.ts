import { app } from "electron";
import { util_lstat, util_mkdir, util_readdir, util_readJSON, util_readText, util_readTOML, util_warn, util_writeJSON } from "./util";
import path from "path";
import { DBSys, DBUser, InstanceData as ModPackInstData } from "./db_types";
import { Arg_AddModToFolder, Arg_ChangeFolderType, Arg_CreateFolder, Arg_EditFolder, FolderType, LocalModData, ModIndex, ModrinthModData, ModsFolder, ModsFolderDef, PackMetaData, RemoteModData, SlugMapData } from "./interface";
import { errors, Result } from "./errors";
import express from "express";
import toml from "toml";
import { changeServerURL } from "./app";
import { updateSocketURL } from "./network";

export let appPath = app.getAppPath();
export const dataPath = path.join(appPath,"data");
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
    slugMap = await slugMap.load();
    
    // 
    if(!sysInst.meta?.serverURL) changeServerURL();
    else updateSocketURL();

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

export async function getStandardInstData(iid:string): Promise<Result<{inst:ModPackInst,prismPath:string,modsPath:string}>>{
    let inst = await getModpackInst(iid);
    if(!inst) return errors.couldNotFindPack;

    let prismPath = inst.getPrismInstPath();
    if(!prismPath) return errors.failedToGetPrismInstPath;

    let modsPath = path.join(prismPath,".minecraft","mods");
    if(!modsPath) return Result.err("Could not find mods path");

    return new Result({inst,prismPath,modsPath});
}
export function cleanModName(name:string){
    if(name.endsWith(".disabled")) name = name.substring(0,name.length-9);

    let ind = name.lastIndexOf(".");
    if(ind != -1){
        name = name.substring(0,ind);
    }

    return name;
}
export function cleanModNameDisabled(name:string){
    if(name.endsWith(".disabled")) name = name.substring(0,name.length-9);
    return name;
}

// 

abstract class Inst<T>{
    constructor(filePath:string){
        this.filePath = filePath;
    }
    filePath:string;
    meta?:T;
    getFileType(): "json" | "toml"{
        return "json";
    }

    useDefaultIfDNE(){
        return false;
    }
    abstract getDefault():Promise<T|undefined>;
    async getAnyDefault():Promise<any|undefined>{}
    async fillDefaults(){
        let def = await this.getDefault() as any;
        if(!def) def = await this.getAnyDefault();
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
            let def = defMeta ?? await this.getDefault();
            if(!def){
                util_warn("no default was provided");
                return this;
            }

            this.meta = def;
            await this.save();

            return this;
        }
        let res:T|undefined;
        if(this.getFileType() == "json"){
            res = await util_readJSON<T>(this.filePath);
            if(!res){
                util_warn("couldn't read file [2]");
                return this;
            }
        }
        else if(this.getFileType() == "toml"){
            let text = await util_readText(this.filePath);
            try{
                res = toml.parse(text) as T;
            }
            catch(e){
                util_warn("couldn't read file [2]");
                return this;
            }
            if(!res){
                util_warn("couldn't read file [2]");
                return this;
            }
        }
        else{
            util_warn("couldn't read file with invalid file type: "+this.getFileType());
            return this;
        }

        this.meta = res;
        await this.fillDefaults();

        await this.postLoad();

        return this;
    }
    async save(){ // not sure if I want to do save now or add it to a queue
        if(!this.meta){
            // util_warn("Couldn't save, meta doesn't exist for: "+this.filePath);
            return;
        }

        if(!await util_lstat(this.filePath)) await util_mkdir(path.join(this.filePath,".."));
        await util_writeJSON(this.filePath,this.meta);
    }

    async postLoad(){}
}

export class SysInst extends Inst<DBSys>{
    constructor(filePath:string){
        super(filePath);
    }
    useDefaultIfDNE(): boolean {
        return true;
    }
    async getDefault(): Promise<DBSys | undefined> {
        return {
            fid:0,
            iid:0,
            uid:0,
            ver:"0.0.1",
            port:"57152",
            serverURL:""
        };
    }
    async postLoad() {
        if(!this.meta){
            util_warn("Failed to start internal server, system info not found/loaded");
            return;
        }
        
        const eApp = express();

        eApp.get("/image",(req,res)=>{
            // let filePath = req.params.path;
            let filePath = req.query.path as string;
            if(!filePath){
                res.sendStatus(403);
                return;
            }
            let newPath = filePath;
            if(!newPath || newPath == ""){
                res.sendStatus(404);
                return;
            }
            if(!newPath.includes(path.sep)){
                res.sendStatus(404);
                return;
            }
            
            res.sendFile(newPath);
        });

        eApp.listen(this.meta.port,()=>{
            console.log(":: started internal server on port: "+this.meta?.port);
        });
        // eApp.use("/image",express.static);
        // eApp.get("/image/:iid/:name",(req,res)=>{
        //     let iid = req.params.iid;
        //     let name = req.params.name;
        //     if(!iid || !name) return;

        //     let fullPath = path.join(dataPath,"instances",iid,);
        // });
    }
}
export class UserInst extends Inst<DBUser>{
    constructor(filePath:string){
        super(filePath);
    }
    async getDefault(): Promise<DBUser | undefined> {
        return;
    }
}

export class ModPackInst extends Inst<ModPackInstData>{
    constructor(filePath:string){
        super(filePath);
    }
    async getDefault(): Promise<ModPackInstData | undefined> {
        return;
    }
    async getAnyDefault(): Promise<any | undefined> {
        return {
            folders:[]
        };
    }

    async postLoad(): Promise<void> {
        await super.postLoad();

        if(!this.meta) return;

        if(this.meta.update == undefined){
            this.meta.update = 0;
            await this.save();
        }

        for(const folder of this.meta.folders){
            if(!folder.tags) folder.tags = [];
        }
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

    // 
    createFolder(arg:Arg_CreateFolder):Result<ModsFolderDef>{
        if(!this.meta) return errors.failedToReadPack;
        if(!arg.name || arg.name.length == 0) return errors.invalidFolderName;

        if(this.meta.folders.some(v=>v.name == arg.name)) return errors.folderAlreadyExists;

        let folder:ModsFolderDef = {
            name:arg.name,type:arg.type,mods:[],tags:arg.tags
        };
        this.meta.folders.push(folder);

        return new Result(folder);
    }
    editFolder(arg:Arg_EditFolder){
        if(!this.meta) return errors.failedToReadPack;
        if(!arg.name || arg.name.length == 0) return errors.invalidFolderName;

        let folder = this.meta.folders.find(v=>v.name == arg.folderName);
        if(!folder) return errors.folderDNE;

        folder.name = arg.name;
        folder.type = arg.type;
        folder.tags = arg.tags;

        return new Result(folder);
    }
    removeFolder(folderName:string){
        if(!this.meta) return errors.failedToReadPack;
        if(!folderName) return errors.invalidFolderName;

        let folderInd = this.meta.folders.findIndex(v=>v.name == folderName);
        if(folderInd == -1) return errors.folderDNE;

        this.meta.folders.splice(folderInd,1);
        
        return new Result({});
    }
    changeFolderType(arg:Arg_ChangeFolderType):Result<ModsFolderDef>{
        if(!this.meta) return errors.failedToReadPack;

        let folder = this.meta.folders.find(v=>v.name == arg.name);
        if(!folder) return errors.folderDNE;

        folder.type = arg.newType;

        return new Result(folder);
    }
    addModToFolder(arg:Arg_AddModToFolder):Result<ModsFolderDef|undefined>{
        if(!this.meta) return errors.failedToReadPack;

        let existingFolder = this.meta.folders.find(v=>v.mods.includes(arg.modCleaned));
        if(existingFolder){
            let ind = existingFolder.mods.indexOf(arg.modCleaned);
            if(ind != -1) existingFolder.mods.splice(ind,1);
        }

        if(arg.type == "root"){   
            return new Result(undefined);
        }

        let folder = this.meta.folders.find(v=>v.name == arg.name);
        if(!folder) return errors.folderDNE;

        if(folder.mods.includes(arg.modCleaned)) return errors.modAlreadyInFolder;
        folder.mods.push(arg.modCleaned);
        
        return new Result(folder);
    }
}

export class LocalModInst extends Inst<LocalModData>{
    constructor(modsPath:string,iid:string,filename:string){
        super(path.join(modsPath,".cache",filename+".json"));
        // super(path.join(modsPath,".cache",filename,"local.json"));

        this.folderPath = modsPath;
        this.iid = iid;
        this.filename = filename;
    }
    folderPath:string;
    iid:string;
    filename:string;
    
    // static fromFilename(iid:string,filename:string){
    //     let loc = path.join(getModFolderPath(iid),".cache",filename);
    // }

    async getDefault(): Promise<LocalModData | undefined> {
        return;
    }
}

export class RemoteModInst extends Inst<RemoteModData>{    
    constructor(slug:string,indexPath:string){
        super(path.join(dataPath,"cache","remote",slug+".json"));
        this.slug = slug;
        this.indexPath = indexPath;
    }
    slug:string;
    indexPath:string;
    pw?:ModIndex;

    async postLoad(): Promise<void> {
        let indexData = await util_readTOML<ModIndex>(path.join(this.indexPath,this.slug+".pw.toml"));
        if(!indexData){
            util_warn("Failed to read INDEX_DATA: "+this.slug);
            return;
        }
        
        this.pw = indexData;
    }

    async getDefault(): Promise<RemoteModData | undefined> {
        return;
    }
}

export class SlugMap extends Inst<SlugMapData>{
    useDefaultIfDNE(): boolean {
        return true;
    }
    async getDefault(): Promise<SlugMapData | undefined> {
        return {
            map:{}
        };
    }

    getVal(k:string){
        if(!this.meta) return;

        return this.meta.map[k];
    }
    setVal(k:string,v:string){
        if(!this.meta) return;
        
        // let v_old = this.meta.map[k];
        // if(v_old){
        //     delete this.meta.map[k];
        //     delete this.meta.map[v_old];
        // }

        // this.meta.map[k] = v;
        // this.meta.map[v] = k;

        let ar = this.meta.map[k];
        if(ar) ar.push(v);
        else{
            this.meta.map[k] = [v];
        }
    }
}

// 

const fspath_modPacks = path.join(dataPath,"instances");

export function getModpackInst(iid:string){
    return new ModPackInst(path.join(fspath_modPacks,iid,"meta.json")).load();
}
export function getModpackPath(iid:string){
    return path.join(fspath_modPacks,iid);
}
export async function getModFolderPath(iid:string){
    let inst = await getModpackInst(iid);
    if(!inst.meta) return;
    let prismPath = inst.getPrismInstPath();
    if(!prismPath) return;
    return path.join(prismPath,".minecraft","mods");
}

function makeInstanceData(meta:PackMetaData){
    let iid = genId(IDType.instance);
    if(iid == null) return;
    
    let data:ModPackInstData = {
        iid,
        update:0,
        meta,
        folders:[]
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
export let slugMap = new SlugMap(path.join(dataPath,"slug_map.json"));