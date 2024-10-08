import { app, BrowserWindow, dialog, systemPreferences } from "electron";
import { ETL_Generic, evtTimeline, EvtTL_Event, pathTo7zip, searchStringCompare, set7zipPath, util_lstat, util_mkdir, util_note, util_note2, util_readBinary, util_readdir, util_readdirWithTypes, util_readJSON, util_readText, util_readTOML, util_rename, util_testAccess, util_warn, util_writeBinary, util_writeJSON, util_writeText, wait } from "./util";
import path from "path";
import { DBSys, DBUser, InstanceData as ModPackInstData, TmpFile } from "./db_types";
import { Arg_AddInstance, Arg_AddModToFolder, Arg_ChangeFolderType, Arg_CreateFolder, Arg_EditFolder, Arg_FinishUploadRP, Arg_GetRPInfo, Arg_LaunchInst, Arg_PublishModpack, Arg_ToggleWorldEnabled, Arg_UploadModpack, Arg_UploadModpackFile, Arg_UploadRP, Arg_UploadRPFile, Data_PrismInstancesMenu, FolderType, IMO_Combobox, IMO_Input, IMO_MultiSelect, InputMenu_InitData, LocalModData, MMCPack, ModIndex, ModrinthModData, ModsFolder, ModsFolderDef, PackMetaData, PrismAccount, PrismAccountsData, RemoteModData, Res_GetInstResourcePacks, Res_GetInstWorlds, Res_GetRPInfo, Res_GetRPInfoLocal, Res_InputMenu, Res_UploadModpack, Res_UploadRP, RP_Data, RPCache, SearchFilter, SelectPrismInstData, SlugMapData, UpdateProgress_InitData, World_Data } from "./interface";
import { errors, Result } from "./errors";
import express from "express";
import toml from "toml";
import { alertBox, changeServerURL, checkForInstUpdates, ensurePrismLinked, refreshMainWindow, uploadWorld } from "./app";
import { semit, updateSocketURL } from "./network";
import { getWindowStack, openCCMenu, PrismInstancesMenu } from "./menu_api";
import Seven from "node-7z";
import axios from "axios";
import { mainWindow } from "./main";
import { i } from "vite/dist/node/types.d-aGj9QkWt";

// export let appPath = app.isPackaged ? path.join(process.resourcesPath,"..","data") : app.getAppPath();
// export let appPath = app.isPackaged ? path.join(process.resourcesPath) : app.getAppPath();
// export let appPath = app.isPackaged ? path.join(process.env.APPDATA!,".modpack-syncer") : app.getAppPath();
export let appPath = path.join(process.env.APPDATA!,".modpack-syncer");
export const dataPath = path.join(appPath,"data");
const folderPath = path.join(dataPath,"folders");

if(false) if(app.isPackaged) setTimeout(()=>{
    dialog.showMessageBox({
        message:[
            appPath,
            process.resourcesPath,
            __dirname
        ].join("\n")
    });
},1500);

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

export async function preInitDB(){
    // first, init paths
    
    await util_mkdir(appPath,true);
    
    await util_mkdir(path.join(dataPath,"instances_deleted"),true);
    await util_mkdir(path.join(dataPath,"cache"),true);
    await util_mkdir(path.join(dataPath,"cache","mods"),true);
    await util_mkdir(path.join(dataPath,"cache","remote"),true);

    sysInst = await sysInst.load();
    slugMap = await slugMap.load();

    // 
    if(!sysInst.meta) return;

    let wasSysChanged = false;
    if(sysInst.meta.sevenZipExe) set7zipPath(sysInst.meta.sevenZipExe);
    else{
        if(process.platform == "win32" && process.env.programFiles){
            sysInst.meta.sevenZipExe = path.join(process.env.programFiles,"7-Zip","7z.exe");
            set7zipPath(sysInst.meta.sevenZipExe);
            wasSysChanged = true;
        }
    }

    if(wasSysChanged) await sysInst.save();
}
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

    if(!sysInst?.meta) return;

    let w = mainWindow;
    
    if(process.platform == "win32") if(!sysInst.meta.prismRoot){
        if(await util_lstat(path.join(process.env.APPDATA!,"PrismLauncher","instances"))){
            sysInst.meta.prismRoot = path.join(process.env.APPDATA!,"PrismLauncher");
            await sysInst.save();
        }
        else{
            await dialog.showMessageBox({
                message:"Prism Launcher path not set.\nPlease select your prism launcher folder."
            });

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

    if(process.platform == "win32") if(!sysInst.meta.prismExe){
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
    
    /////////////////////
    
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

export const instCache = {
    user:new Map<string,UserInst>(),
    modpack:new Map<string,ModPackInst>(),
    localMods:new Map<string,LocalModInst>(),
    remoteMods:new Map<string,RemoteModInst>(),
};

abstract class Inst<T>{
    constructor(filePath:string){
        this.filePath = filePath;
    }
    filePath:string;
    meta?:T;
    getFileType(): "json" | "toml"{
        return "json";
    }

    getCacheMap():Map<string,Inst<T>> | undefined{
        return;
    }
    storeInCache(){
        let map = this.getCacheMap();
        if(!map) return;
        
        map.set(this.filePath,this);
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
        let cache = this.getCacheMap();
        if(cache){
            let v = cache.get(this.filePath);
            if(v) return v as this; // MAY NEED SOME EXTRA WORK LIKE WHEN IT BECOMES STALE
        }

        // need to actually store in the map....
        if(cache) cache.set(this.filePath,this);

        // console.log("----- read: ",this.filePath);
        
        let stats = await util_lstat(this.filePath);
        if(!stats){
            if(!defMeta && !this.useDefaultIfDNE()){
                util_warn("couldn't read file [1]");
                console.log("path: "+this.filePath);
                return this;
            }
            let def = defMeta ?? await this.getDefault();
            if(!def){
                util_warn("no default was provided");
                return this;
            }

            this.meta = def;
            await this.save();

            await this.postLoad();

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
    eApp:any;
    async getDefault(): Promise<DBSys | undefined> {
        return {
            fid:0,
            iid:0,
            uid:0,
            ver:"0.0.1",
            port:"57152",
            serverURL:"",
            // theme:"soft-colors"
            theme:"dark"
        };
    }
    async postLoad() {
        if(!this.meta){
            util_warn("Failed to start internal server, system info not found/loaded");
            dialog.showMessageBox({
                message:"Failed to start internal server, system info not found/loaded"
            });
            return;
        }
        
        let eApp = express();
        this.eApp = eApp;

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

    async setTheme(theme:string){
        if(!this.meta) return;
        this.meta.theme = theme;
        await this.save();

        let ws = getWindowStack().concat(mainWindow);
        console.log("NEW ARR: ",ws.map(v=>v?.title));
        for(const w of ws){
            w.webContents.send("setClientTheme",theme);
        }

        // reloadAllWindows();
    }
}

export const themes:Record<string,any> = {
    "dark":{
        name:"Dark"
    },
    "clean-dark":{
        _disabled:true,
        name:"Soft Dark"
    },
    "light":{
        name:"Light"
    },
    "clean-light":{
        _disabled:true,
        name:"Soft Light"
    },
    "light2":{
        _disabled:true,
        name:"Light Alt"
    },
    "mint":{
        name:"Mint"
    },
    "soft-colors":{
        name:"Soft Colors"
    }
};

export function reloadAllWindows(){
    mainWindow.reload();
    for(const w of getWindowStack()){
        w.reload();
    }
}

export class UserInst extends Inst<DBUser>{
    constructor(filePath:string){
        super(filePath);
    }
    async getDefault(): Promise<DBUser | undefined> {
        return;
    }
    getCacheMap(): Map<string, Inst<DBUser>> | undefined {
        return instCache.user;
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
            folders:[],
            worlds:[],
            isRunning:false,
            lastLaunched:0,
        };
    }

    getCacheMap(): Map<string, Inst<ModPackInstData>> | undefined {
        return instCache.modpack;
    }

    async postLoad(): Promise<void> {
        await super.postLoad();

        if(!this.meta) return;

        let needsSave = false;

        if(this.meta.update == undefined){
            this.meta.update = 0;
            needsSave = true;
        }
        if(!this.meta.resourcepacks){
            this.meta.resourcepacks = [];
            needsSave = true;
        }
        // if(this.meta.auth == undefined){
        //     this.meta.auth = {
        //         users:[]
        //     };
        // }
        // if(this.meta.auth.users == undefined){
        //     this.meta.auth.users = [];
        // }

        if(needsSave) await this.save();

        for(const folder of this.meta.folders){
            if(!folder.tags) folder.tags = [];
        }

        // resource packs
        let res = await util_mkdir(path.join(dataPath,"instances",this.meta.iid,"rp"));
        if(res){
            
        }
    }
    getRPCachePath(){
        if(!this.meta) return;
        
        return path.join(dataPath,"instances",this.meta.iid,"rp");
    }

    async save(){ // not sure if I want to do save now or add it to a queue
        if(!this.meta){
            // util_warn("Couldn't save, meta doesn't exist for: "+this.filePath);
            return;
        }

        let tmpMMC = this.meta.meta.mmcPackFile;
        let tmpCfg = this.meta.meta.instanceCfgFile;

        // this.meta.meta.mmcPackFile = undefined;
        this.meta.meta.instanceCfgFile = undefined;

        if(!await util_lstat(this.filePath)) await util_mkdir(path.join(this.filePath,".."));
        await util_writeJSON(this.filePath,this.meta);

        // this.meta.meta.mmcPackFile = tmpMMC;
        // this.meta.meta.instanceCfgFile = tmpCfg;
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

    async getResourcePacks(filter:SearchFilter){
        return (await getInstResourcePacks(this,filter)).unwrap();
    }
    async uploadRP(arg:Arg_UploadRP): Promise<boolean | undefined>{
        if(!this.meta) return;
        let prismPath = this.getPrismInstPath();
        if(!prismPath) return errors.failedToGetPrismInstPath.unwrap();
        
        let acc = await getMainAccount();
        if(!acc) return;

        let mpID = this.meta?.meta.id;
        if(!mpID) return;

        arg.uid = acc.profile.id;
        arg.uname = acc.profile.name;

        let res = (await semit<Arg_UploadRP,Res_UploadRP>("uploadRP",{
            iid:arg.iid,
            uid:acc.profile.id,
            uname:acc.profile.name,
            mpID,
            name:arg.name
        })).unwrap();
        if(!res){
            util_warn("Failed to upload");
            return;
        }

        if(res.res == 2){
            arg.force = true;
        }

        // all good

        let meta = this.meta.resourcepacks.find(v=>v.rpID == arg.name);
        if(!meta) return errors.couldNotFindRPMeta.unwrap();

        meta.update = res.update;
        // await this.save();

        // let cachePath = path.join(this.getRPCachePath()!,arg.name+".json");
        // let cache = await util_readJSON<Record<string,RPCache>>(cachePath);
        // if(!cache) return errors.couldNotFindRPCache.unwrap();

        // let lastUploaded = meta.lastUploaded;
        
        let w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid:this.meta.iid});
        if(!w) return errors.failedNewWindow.unwrap();
        w.webContents.send("updateProgress","main",0,100,"Initializing...");

        // 
        
        if(true){
            let rootPath = path.join(prismPath!,".minecraft","resourcepacks",arg.name);
            let root = new FFolder("root");

            let totalFiles = 0;
            let totalFolders = 0;
            let start = performance.now();

            let files:TmpFile[] = [];

            const read = async (f:FFolder,loc:string,loc2:string)=>{
                let ar = await util_readdirWithTypes(loc);
                for(const item of ar){
                    if(item.isFile()){
                        if(item.name.includes(".__conflict")) continue; // don't want to upload conflict files, they should be local only

                        // let trimmed = loc2.substring(1)+"/"+item.name;
                        // let cacheMeta = cache[trimmed];
                        // if(!cacheMeta){
                        //     cacheMeta = {
                        //         download:0,
                        //         modified:0,
                        //         upload:0
                        //     };
                        //     // console.log("(update) LOC:",trimmed);
                        //     cache[trimmed] = cacheMeta;
                        // }
                        
                        let fileLoc = path.join(loc,item.name);
                        let stat = await util_lstat(fileLoc);
                        if(!stat) continue;

                        // if(item.name == "bronze_layer_1_s - Copy - Copy.png") console.log("STAT:",item.name,stat,cacheMeta);
                        let time = Math.max(stat.mtimeMs,stat.birthtimeMs);
                        // if(stat.mtimeMs <= lastUploaded && stat.ctimeMs <= lastUploaded) continue; // SKIP if it hasn't been modified
                        // if(time <= cacheMeta.upload) continue;
                        // if(time <= Math.min(meta.lastUploaded,meta.lastDownloaded)) continue;
                        // if(time <= meta.lastModified) continue;
                        // if(time <= Math.max(cacheMeta.download,cacheMeta.upload)) continue;
                        // if(time <= cacheMeta.upload) continue;
                        if(!arg.force) if(time <= meta.lastUploaded) continue;
                        
                        totalFiles++;
                        let buf = await util_readBinary(fileLoc);
                        if(!buf) continue;

                        let file = new FFile(item.name,buf);
                        f.items.push(file);
                        files.push({
                            path:loc2+"/"+item.name,buf,name:item.name,
                            at:stat.atimeMs,
                            bt:stat.birthtimeMs,
                            mt:stat.mtimeMs
                        });

                        // 
                        // cacheMeta.upload = new Date().getTime();
                        // cacheMeta.modified = cacheMeta.upload;
                    }
                    else{
                        totalFolders++;
                        let folder = new FFolder(item.name);
                        f.items.push(folder);
                        await read(folder,path.join(loc,item.name),loc2+"/"+item.name);
                    }
                }
            };
            await read(root,rootPath,"");

            // await util_writeJSON(cachePath,cache);

            let total = totalFiles+totalFolders;
            console.log("TOTAL: "+total);
            console.log(">> time [1]: ",performance.now()-start);
            start = performance.now();

            w.webContents.send("updateProgress","main",0,files.length,"Initializing upload...");

            // 
            let completed = 0;
            let successfulFiles:TmpFile[] = [];
            let failedFiles:TmpFile[] = [];

            if(w.isDestroyed()) return;

            let proms:Promise<void>[] = [];
            for(const f of files){
                proms.push(new Promise<void>(async resolve=>{
                    if(w.isDestroyed()){
                        failedFiles.push(f);
                        resolve();
                        return;
                    }
                    w.webContents.send("updateProgress","main",completed,files.length,f.name);
    
                    let res1 = await semit<Arg_UploadRPFile,boolean>("upload_rp_file",{
                        path:f.path,
                        buf:f.buf,
                        mpID:arg.mpID,
                        rpName:arg.name,
    
                        uid:arg.uid,
                        uname:arg.uname,
                        
                        at:f.at,
                        bt:f.bt,
                        mt:f.mt
                    });
                    if(!res1){
                        // return errors.failedUploadRP.unwrap();
                        failedFiles.push(f);
                        resolve();
                        return;
                    }
                    let res = res1.unwrap() as boolean;
                    if(!res){
                        util_warn("Err: [2]: ");
                        console.log(res,res1);
                        failedFiles.push(f);
                        // return errors.failedUploadRP.unwrap();
                        resolve();
                        return;
                    }
    
                    completed++;
                    w.webContents.send("updateProgress","main",completed,files.length,f.name);
                    successfulFiles.push(f);

                    resolve();
                }));
            }
            await Promise.all(proms);

            console.log(`>> time [2 - ${files.length}]: `,performance.now()-start);

            // UPLOAD FINAL/FINISH
            let res_final = (await semit<Arg_FinishUploadRP,{update:number}>("finishUploadRP",{mpID:arg.mpID,rpID:arg.name})).unwrap();
            if(!res_final) return errors.failedUploadRP.unwrap();

            meta.lastUploaded = Date.now();
            meta.lastModified = meta.lastUploaded;
            meta.update = res_final.update; // just to be safe
            await this.save();

            // w.webContents.send("updateProgress","main",completed,files.length,"Finished.");

            // show results
            w.webContents.send("updateProgress","main",completed,files.length,"Finished.",{
                sections:[
                    {
                        header:`Failed: (${failedFiles.length})`,
                        text:failedFiles.map(v=>v.path)
                    },
                    {
                        header:`Uploaded: (${successfulFiles.length})`,
                        text:successfulFiles.map(v=>v.path)
                    }
                ]
            });

            getWindowStack().find(v=>v.title == "Edit Instance")?.webContents.send("updateSearch");
            
            await wait(500);

            // console.log("UPLOAD FINISHED");
            // if(failedFiles.length == 0) w.close();
        }
        else{
            let start = performance.now();

            let tmpName = arg.name+"__tmp";
            let rpPath = path.join(prismPath!,".minecraft","resourcepacks");
            let srcPath = path.join(rpPath,arg.name);
            let zipPath = path.join(rpPath,tmpName);
            console.log("7Z path: ",zipPath);
            
            let stream = Seven.add(zipPath,path.join(srcPath,"*"),{
                $bin:pathTo7zip,
                $progress:true,
                recursive:true
            });

            stream.on("progress",progress=>{
                w!.webContents.send("updateProgress","main",progress.percent,100,"File: "+progress.fileCount);
                // w.webContents.send("updateProgress","main",progress.percent,100,progress.file+"\n\n"+progress.fileCount+" total files.");
            });
            stream.on("end",()=>{
                w!.webContents.send("updateProgress","main",100,100,"Finished.");
                console.log("TIME: ",performance.now()-start);
            });
            stream.on("error",err=>{
                util_warn("Error while zipping: "+err);
                return errors.zipping.unwrap();
            });
        }

        return true;
    }
}

export async function getWorlds(iid:string,filter:SearchFilter){
    return (await getInstWorlds(iid,filter)).unwrap();
}

class FItem{
    constructor(name:string){
        this.name = name;
    }
    name:string;
}
class FFolder extends FItem{
    constructor(name:string){
        super(name);
        this.items = [];
    }
    items:FItem[];
}
class FFile extends FItem{
    constructor(name:string,buf:Uint8Array){
        super(name);
        this.buf = buf;
    }
    buf:Uint8Array;
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
    getCacheMap(): Map<string, Inst<LocalModData>> | undefined {
        return instCache.localMods;
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

    async postLoad(): Promise<void> {
        if(!this.meta) return;
        let ok = Object.keys(this.meta.map);
        for(const k of ok){
            this.meta.map[k] = [...new Set(this.meta.map[k])];
        }
        await this.save();
    }

    getVal(k:string){
        if(!this.meta) return;

        return this.meta.map[k];
    }
    getSlug(file:string){
        if(!this.meta) return;
        let ok = Object.keys(this.meta.map);
        for(const k of ok){
            if(this.meta.map[k]?.includes(file)) return k;
        }
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
        if(ar){
            if(!ar.includes(v)) ar.push(v);
        }
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

function makeInstanceData(meta:PackMetaData,overrideIID?:string){
    let iid = overrideIID ?? genId(IDType.instance);
    if(iid == null) return;
    
    let data:ModPackInstData = {
        iid,
        update:0,
        meta,
        folders:[],
        resourcepacks:[],
        worlds:[],
        loc:"",
        isRunning:false,
        lastLaunched:0,
    };
    return data;
}
export async function addInstance(arg:Arg_AddInstance):Promise<Result<ModPackInst>>{
    if(!sysInst.meta?.prismRoot) return errors.noPrismRoot;

    let iid:string|undefined;
    if(arg.autoCreate){
        console.log("> Auto Creating Instance [1]");
        let num = 0;
        iid = `${arg.meta.id}_pack_${num}`;
        while(await util_lstat(path.join(sysInst.meta.prismRoot,"instances",iid))){
            num++;
            iid = `${arg.meta.id}_pack_${num}`;
        }
    }
    
    let meta = arg.meta;
    if(!meta){
        util_note2("Critical error: no meta was found to create instance, aborting.");
        return errors.unknown;
    }
    let instanceData = makeInstanceData(meta,iid);
    if(!instanceData){
        return errors.instDataConvert;
    }

    if(!await util_mkdir(path.join(fspath_modPacks,instanceData.iid))){
        util_warn("Failed to add inst folder: ",path.join(fspath_modPacks,instanceData.iid));
        return errors.addInstFolder;
    }

    if(arg.autoCreate && !meta.mmcPackFile) util_warn("Auto Create was selected but this pack doesn't have the REQUIRED mmc-pack.json file. Aborting the auto create!");
    if(arg.autoCreate && iid && meta.mmcPackFile){
        console.log("> Auto Creating Instance [2]");
        let instPath = path.join(sysInst.meta.prismRoot,"instances",iid);
        await util_mkdir(instPath,true);
        await util_mkdir(path.join(instPath,".minecraft","mods"),true);
        await util_mkdir(path.join(instPath,".minecraft","resourcepacks"),true);
        await util_mkdir(path.join(instPath,".minecraft","shaderpacks"),true);
        await util_mkdir(path.join(instPath,".minecraft","saves"),true);

        let javaPath = "";
        if(process.platform == "win32"){
            if(meta.javaCodeName){
                javaPath = path.join(process.env.LOCALAPPDATA??"","Packages/Microsoft.4297127D64EC6_8wekyb3d8bbwe/LocalCache/Local/runtime/java-runtime-"+meta.javaCodeName,"bin/javaw.exe");
                if(!await util_lstat(javaPath)){
                    javaPath = path.join(process.env["ProgramFiles(x86)"]??"","Minecraft Launcher/runtime/java-runtime-"+meta.javaCodeName,"windows-x64","java-runtime-"+meta.javaCodeName,"bin/javaw.exe");
                    if(!await util_lstat(javaPath)){
                        meta.javaCodeName = undefined; // can't find it so don't override their defaults
                    }
                }
                // C:\Users\user\AppData\Local\Packages\Microsoft.4297127D64EC6_8wekyb3d8bbwe\LocalCache\Local\runtime
            }
        }
        else meta.javaCodeName = undefined;
        if(javaPath) javaPath = javaPath.replaceAll("\\","/");

        if(javaPath) util_note2("JAVA PATH: "+meta.javaCodeName+" "+javaPath);
        
        if(meta.mmcPackFile) await util_writeBinary(path.join(instPath,"mmc-pack.json"),Buffer.from(meta.mmcPackFile));
        if(meta.instanceCfgFile) await util_writeBinary(path.join(instPath,"instance.cfg"),Buffer.from(meta.instanceCfgFile));
        else await util_writeText(path.join(instPath,"instance.cfg"),
`[General]
iconKey=${iid}
name=${meta.name}
${meta.RAM ?
`OverrideMemory=true
MaxMemAlloc=${meta.RAM}
MinMemAlloc=512`:""}${meta.javaCodeName ?
`OverrideJavaLocation=true
JavaPath=${javaPath}`:""}
`
);

        instanceData.linkName = instanceData.iid;

        util_note2("Pack img url: ",meta.img);
        if(meta.img){
            let img = await (await (await fetch(meta.img)).blob()).arrayBuffer();
            if(img){
                await util_writeBinary(path.join(instPath,".minecraft","icon.png"),Buffer.from(img));
                await util_writeBinary(path.join(sysInst.meta.prismRoot,"icons",iid+".png"),Buffer.from(img));
            }
        }
    }

    if(arg.linkName) instanceData.linkName = arg.linkName;

    let inst = await new ModPackInst(path.join(fspath_modPacks,instanceData.iid,"meta.json")).load(instanceData);
    if(!inst || !inst.meta){
        util_warn("Failed to add instance:");
        console.log(meta);
        return errors.addInstance;
    }
    console.log("ADDED INSTANCE:",inst);

    refreshMainWindow();

    if(arg.autoCreate) await checkForInstUpdates(inst.meta.iid,undefined,true);

    return new Result(inst);
}

// MODPACK INST METHODS
async function getInstResourcePacks(inst:ModPackInst,filter:SearchFilter): Promise<Result<Res_GetInstResourcePacks>>{
    if(!inst.meta) return errors.couldNotFindPack;
    
    let resData:Res_GetInstResourcePacks = {
        packs:[],
    };

    const prismPath = inst.getPrismInstPath();
    if(!prismPath) return errors.failedToGetPrismInstPath;

    const loc = path.join(prismPath,".minecraft","resourcepacks");
    let packList = await util_readdirWithTypes(loc,false);
    for(const fi_pack of packList){ // fileItem_pack
        if(fi_pack.name.startsWith(".")) continue;
        
        if(filter.query) if(!searchStringCompare(fi_pack.name,filter.query)) continue;
        
        if(fi_pack.isFile()){
            resData.packs.push({
                name:fi_pack.name
            });
            continue;
        }

        let packLoc = path.join(loc,fi_pack.name);

        let d:RP_Data = {
            name:fi_pack.name,
            data:{
                icon:path.join(packLoc,"pack.png")
            }
        };
        
        let packMCMeta = await util_readJSON<any>(path.join(packLoc,"pack.mcmeta"),(text)=>{
            return text.split("\n").filter(v=>!v.startsWith("//")).join("\n");
        });
        if(packMCMeta) d.data!.meta = packMCMeta;
        
        resData.packs.push(d);
    }

    // create metas if not defined
    if(!inst.meta.resourcepacks) inst.meta.resourcepacks = [];
    for(const pack of resData.packs){
        let rpPath = inst.getRPCachePath()!;
        if(!await util_lstat(path.join(rpPath,pack.name+".json"))){
            // let data = {
            //     download:0,
            //     upload:0,
            //     modified:0,
            // } as RPCache;
            let data = {};
            await util_writeJSON(path.join(rpPath,pack.name+".json"),data);
        }
        
        // 
        
        if(inst.meta.resourcepacks.some(v=>v.rpID == pack.name)) continue;
        inst.meta.resourcepacks.push({
            rpID:pack.name,
            lastModified:0,
            lastUploaded:0,
            lastDownloaded:0,
            update:-1
        });
        await inst.save();
    }
    
    // 
    return new Result(resData);
}
async function getInstWorlds(iid:string,filter:SearchFilter): Promise<Result<Res_GetInstWorlds>>{
    let inst = await getModpackInst(iid);
    if(!inst || !inst.meta) return errors.couldNotFindPack;
    
    let resData:Res_GetInstWorlds = {
        worlds:[],
        // isRunning:inst.meta.isRunning
    };

    const prismPath = inst.getPrismInstPath();
    if(!prismPath) return errors.failedToGetPrismInstPath;

    const loc = path.join(prismPath,".minecraft","saves");
    let worldList = await util_readdirWithTypes(loc,false);
    for(const fi_world of worldList){ // fileItem_world
        if(fi_world.name.startsWith(".")) continue;
        
        if(filter.query) if(!searchStringCompare(fi_world.name,filter.query)) continue;
        
        if(fi_world.isFile()){
            resData.worlds.push({
                wID:fi_world.name
            });
            continue;
        }

        let worldLoc = path.join(loc,fi_world.name);

        let d:World_Data = {
            wID:fi_world.name,
            data:{
                icon:path.join(worldLoc,"icon.png"),
                // isRunning:resData.isRunning
            }
        };
        
        resData.worlds.push(d);
    }

    // create metas if not defined
    // if(!inst.meta.resourcepacks) inst.meta.resourcepacks = [];
    // for(const world of resData.worlds){
    //     let wPath = inst.getRPCachePath()!;
    //     if(!await util_lstat(path.join(wPath,world.name+".json"))){
    //         // let data = {
    //         //     download:0,
    //         //     upload:0,
    //         //     modified:0,
    //         // } as RPCache;
    //         let data = {};
    //         await util_writeJSON(path.join(wPath,world.name+".json"),data);
    //     }
        
    //     // 
        
    //     if(inst.meta.resourcepacks.some(v=>v.rpID == world.name)) continue;
    //     inst.meta.resourcepacks.push({
    //         rpID:world.name,
    //         lastModified:0,
    //         lastUploaded:0,
    //         lastDownloaded:0,
    //         update:-1
    //     });
    //     await inst.save();
    // }
    
    // 

    let hasChangedInst = false;
    for(const w of resData.worlds){
        if(!inst.meta.worlds.find(v=>v.wID == w.wID)){
            inst.meta.worlds.push({
                wID:w.wID,
                lastSync:-1,
                update:-1
            });
            hasChangedInst = true;
        }
    }

    let found = resData.worlds.map(v=>v.wID);
    for(const w of inst.meta.worlds){
        if(!found.includes(w.wID)){
            // remove worlds from the cache/meta data that have been deleted
            let ind = inst.meta.worlds.indexOf(w);
            if(ind != -1) inst.meta.worlds.splice(ind,1);
            hasChangedInst = true;
        }
    }

    if(hasChangedInst) await inst.save();

    return new Result(resData);
}

/**
 * 
 * @note unwraps errors itself
 */
export async function getMainAccount(): Promise<PrismAccount | undefined>{
    if(!sysInst.meta) return errors.noSys.unwrap();
    let prismRoot = sysInst.meta.prismRoot;
    await ensurePrismLinked();
    if(!prismRoot) return errors.noPrismRoot.unwrap();

    let accountsFile = await util_readJSON<PrismAccountsData>(path.join(prismRoot,"accounts.json"));
    if(!accountsFile) return errors.noAccountsFile.unwrap();

    let mainAccount = accountsFile.accounts.find(v=>v.active);
    if(!mainAccount) return errors.noMainAccount.unwrap();

    return mainAccount;
}

// 
export let sysInst = new SysInst(path.join(dataPath,"sys.json"));
export let slugMap = new SlugMap(path.join(dataPath,"slug_map.json"));

// testing
// import ps from 'ps-node';
// import find from 'find-process';

// async function test(){
//     await wait(1000);

//     util_note("Running test...");
//     ps.lookup({command:"java"}, (Err, Programs) => {
//         if(Err) console.log("err:",Err);
//         util_note(123);
//         console.log(Programs);
//         // Programs.forEach(prog => {
//         //     util_note2("prog",prog.pid);
//         //     find('pid', prog.pid).then((progDetails) => {
//         //         const procName = progDetails.map(stuff => stuff.name)[0]
//         //         console.log(procName)
//         //     })
//         // });
//     })
// }
// // test();

async function instanceRunCheck(){
    for(const [k,v] of instCache.modpack){
        await wait(20);
        if(!v.meta?.isRunning) continue;
        // 

        let fail = async ()=>{
            if(!v.meta) return;
            v.meta.isRunning = false;
            await v.save();
        };

        let mpID = v.meta.meta.id;
        // util_note("Checking for running... : "+mpID);

        let prismLoc = v.getRoot();
        if(!prismLoc){
            await fail();
            continue;
        }
        let loc = path.join(prismLoc,"logs","latest.log");
        if(!util_lstat(loc)){
            await fail();
            continue;
        }
        let isRunning = await util_testAccess(loc);
        if(!isRunning) if((Date.now() - v.meta.lastLaunched) > 60000){ // 2 minutes - 120000 // 1 minute - 60000
            v.meta.isRunning = false;
            await v.save();
            util_warn(">> STOPPED INSTANCE: "+mpID);

            let acc = await getMainAccount();
            if(!acc) continue;

            let res = (await semit<Arg_LaunchInst,boolean>("finishLaunchInst",{
                mpID,
                uid:acc.profile.id,
                uname:acc.profile.name
            })).unwrap();
            if(!res) continue;

            // upload owned worlds on exit
            let worlds = v.meta.worlds;
            for(const w of worlds){
                if(w.lastSync == -1) continue;
                let res = await uploadWorld({
                    iid:v.meta.iid,wID:w.wID
                },undefined,true,true);
                if(!res) continue;
            }

            mainWindow.reload();

            continue;
        }
        // 
        
        util_note2("Instance is running: "+mpID);
    }
    
    // await wait(500);
    await wait(1000);
    instanceRunCheck();
}
instanceRunCheck();

export async function toggleWorldEnabled(arg:Arg_ToggleWorldEnabled,_w?:BrowserWindow){
    let inst = await getModpackInst(arg.iid);
    if(!inst?.meta) return;
    let wID = arg.wID;

    let prismPath = inst.getPrismInstPath();
    if(!prismPath) return;

    let loc = path.join(prismPath,".minecraft","saves",arg.wID);
    let dataInd = inst.meta.worlds.findIndex(v=>v.wID == wID);
    let data = inst.meta.worlds[dataInd];
    let newName = (wID.endsWith(".disabled") ? wID.substring(0,wID.length-".disabled".length) : wID+".disabled");
    
    if((loc.endsWith(".disabled") || arg.enable == true) && arg.enable != false){
        // enable
        await util_rename(path.join(loc,"level.dat.disabled"),path.join(loc,"level.dat"));
        await util_rename(loc,loc.substring(0,loc.length-".disabled".length));
    }
    else{
        // disable
        await util_rename(path.join(loc,"level.dat"),path.join(loc,"level.dat.disabled"));
        await util_rename(loc,loc+".disabled");
    }
    
    if(dataInd != -1){
        inst.meta.worlds.splice(dataInd,1);
        data.wID = newName;
        inst.meta.worlds.push(data);
        await inst.save();
    }
    
    if(_w) _w.webContents.send("updateSearch");
    else getWindowStack().find(v=>v.title == "Edit Instance")?.webContents.send("updateSearch");
}

export async function openPublishModpackMenu(){
    
    // let arg:Arg_PublishModpack = {
    //     meta:{
    //         id:data.name,
    //         name:data.name,
    //         desc:data.desc,
    //         loader:data.loader,
    //         version:data.version,
    //         img:"",

    //         resourcepacks:[],
    //         update:0,
    //     }
    // };

    let evt2 = evtTimeline.subEvt(new ETL_Generic<SelectPrismInstData|undefined>("select_prism_inst"));

    await openCCMenu<Data_PrismInstancesMenu>("prism_instances",{
        reason:"select",
        iid:"",
        instName:""
    });

    let data2 = await evtTimeline.waitFor(evt2);
    if(!data2) return;

    util_note("LOC: ",data2.loc);
    // 

    let evt = evtTimeline.subEvt(new ETL_Generic<Res_InputMenu|undefined>("input_editFolder"));
    let finished = false;

    let w = await openCCMenu<InputMenu_InitData>("input_menu",{
        cmd:"triggerEvt",args:[evt.getId()],
        title:"Publish Modpack",
        height:500,
        sections:[
            {
                options:[
                    {
                        type:"title",
                        title:"Publish Modpack"
                    }
                ]
            },
            {
                options:[
                    {
                        type:"input",
                        inputType:"text",
                        id:"name",
                        label:"Name (Optional)"
                    } as IMO_Input,
                    {
                        type:"input",
                        inputType:"text",
                        id:"desc",
                        label:"Description",
                        placeholder:"No Description."
                    } as IMO_Input,
                    {
                        type:"input",
                        inputType:"number",
                        id:"ram",
                        label:"Maximum RAM (MB) (Optional)"
                    } as IMO_Input,
                    {
                        type:"input",
                        inputType:"text",
                        id:"version",
                        label:"Game Version"
                    } as IMO_Input,
                    // {
                    //     type:"input",
                    //     id:"name",
                    //     label:"Name",
                    //     inputType:"text",
                    //     value:folder.name
                    // } as IMO_Input,
                    // {
                    //     type:"combobox",
                    //     id:"type",
                    //     label:"Type",
                    //     default:0,
                    //     options:[
                    //         { label:"Custom", value:"custom" },
                    //     ],
                    //     selected:[folder.type]
                    // } as IMO_Combobox,
                    // {
                    //     type:"multi_select",
                    //     id:"tags",
                    //     label:"Tags",
                    //     options:[
                    //         { label:"Local", value:"local" },
                    //         // { label:"Global", value:"global" },
                    //     ],
                    //     selected:folder.tags
                    // } as IMO_MultiSelect,
                ]
            }
        ]
    });
    if(w) w.addListener("close",e=>{
        if(finished) return;
        if(!evt._end) return;
        evt._end(undefined);
    });

    let resData = await evtTimeline.waitFor(evt);
    if(!resData) return errors.failedToPublishModpack.unwrap();
    let data = resData.data;

    // 

    let mmcPackFile = await util_readBinary(path.join(data2.loc,"mmc-pack.json")) ?? undefined;
    let mmcJson = await util_readJSON<MMCPack>(path.join(data2.loc,"mmc-pack.json"));
    if(!mmcJson) return errors.failedToPublishModpack.unwrap();

    let mc = mmcJson.components.find(v=>v.cachedName == "Minecraft");
    let loader = mmcJson.components.find(v=>["Forge","Fabric Loader"].includes(v.cachedName));
    if(!mc || !loader) return errors.failedToPublishModpack.unwrap();
    
    let arg:Arg_PublishModpack = {
        meta:{
            id:data2.name,
            name:data.name || data2.name,
            desc:data.desc || "No description.",
            img:"",
            loader:loader.cachedName.split(" ")[0].toLowerCase(),
            version:mc.version,
            resourcepacks:[],
            update:0,
            javaCodeName:getJavaCodeNameFromVersion(mc.version)
        },
        icon:await util_readBinary(data2.icon) ?? undefined,
        mmcPackFile
    };
    
    // 

    return await publishModpack(arg);
}
export function getJavaCodeNameFromVersion(version:string){
    let v = version.split(".");
    if(v[1] == "20" && v[2] == "6") return "delta";
    if(parseInt(v[1]) >= 21) return "delta";
    
    if(parseInt(v[1]) >= 18) return "gamma";

    return "beta";
}
export async function publishModpack(arg:Arg_PublishModpack){
    let res = (await semit<Arg_PublishModpack,boolean>("publishModpack",arg)).unwrap();
    
    await addInstance({
        autoCreate:false,
        meta:arg.meta,
        linkName:arg.meta.id
    });
    
    await dialog.showMessageBox({
        message:"Publish Modpack: "+res?"Success":"Failed"
    });

    return res;
}
export async function uploadModpack(iid:string){
    if(!iid) return;
    if(!sysInst || !sysInst.meta) return;
    
    let inst = await getModpackInst(iid);
    if(!inst || !inst.meta) return;
    
    let prismPath = inst.getPrismInstPath();
    if(!prismPath) return errors.failedToGetPrismInstPath.unwrap();
    
    let arg:Arg_UploadModpack = {
        files:[],
        mpID:inst.meta.meta.id
    };

    let w = await openCCMenu<UpdateProgress_InitData>("update_progress_menu",{iid});
    if(!w) return errors.failedNewWindow.unwrap();

    w.webContents.send("updateProgress","main",0,1,"Initializing mod upload...");

    let modLoc = path.join(prismPath,".minecraft","mods");
    let mods = await util_readdirWithTypes(modLoc);
    for(const mod of mods){
        if(!mod.isFile()) continue;
        if(mod.name.endsWith(".disabled")) continue;

        let stat = await util_lstat(path.join(modLoc,mod.name));
        if(!stat) continue;
        
        let meta = inst.meta.folders.find(v=>v.mods.includes(cleanModName(mod.name)));
        if(meta?.tags.includes("local")) continue;

        arg.files.push({
            mTime:Math.max(stat.mtimeMs,stat.birthtimeMs),
            sloc:mod.name
        });
    }
    let indexes = await util_readdirWithTypes(path.join(modLoc,".index"));
    for(const index of indexes){
        if(!index.isFile()) continue;

        let stat = await util_lstat(path.join(modLoc,".index",index.name));
        if(!stat) continue;
        
        arg.files.push({
            mTime:Math.max(stat.mtimeMs,stat.birthtimeMs),
            sloc:".index/"+index.name
        });
    }

    let res = (await semit<Arg_UploadModpack,Res_UploadModpack>("uploadModpack",arg)).unwrap();
    if(!res){
        w.close();
        return;
    }
    // 

    let total = res.files.length;
    let completed = 0;
    let failed:string[] = [];
    let success:string[] = [];
    
    let proms:Promise<void>[] = [];
    for(const file of res.files){
        proms.push(new Promise<void>(async resolve=>{
            if(w?.isDestroyed()){
                resolve();
                return;
            }
            w.webContents.send("updateProgress","main",completed,total,"Upload: "+file);
            
            let buf = await util_readBinary(path.join(modLoc,file));
            if(!buf){
                failed.push(file);
                completed++;
                resolve();
                return;
            }
            let res = await semit<Arg_UploadModpackFile,boolean>("upload_modpack_file",{
                buf,
                mpID:inst.meta!.meta.id,
                sloc:file
            });
            if(!res){
                failed.push(file);
                completed++;
            }
            else{
                success.push(file);
                completed++;
            }

            resolve();
        }));
    }

    await Promise.all(proms);
    // 

    w.webContents.send("updateProgress","main",total,total,"Finished.",{
        sections:[
            {
                header:`Failed: (${failed.length})`,
                text:failed
            },
            {
                header:`Uploaded: (${success.length})`,
                text:success
            }
        ]
    });
}
export async function unpublishModpack(mpID:string){
    let res = await dialog.showMessageBox({
        message:"Are you sure you want to unpublish: "+mpID+"?\n\nThis action cannot be reversed.\n\n*The modpack will be deleted off the server so no one can sync it or download it anymore, IT DOES NOT AFFECT YOUR OWN INSTANCE OR DELETE ANYONE ELSES INSTANCES, IT SIMPLY MEANS NO MORE SYNCING OR DOWNLOADING THE MODPACK.*",
        buttons:["Cancel","Unpublish"]
    });
    if(res.response != 1) return;
    
    if(!mpID) return errors.invalid_args.unwrap();

    let acc = await getMainAccount();
    if(!acc) return;
    
    let res1 = (await semit<string,boolean>("unpublishModpack",mpID)).unwrap();
    if(!res1) return errors.failedToUnpublishModpack.unwrap();

    let w2 = getWindowStack().find(v=>v.title == "Search Packs");
    if(w2) w2.reload();

    return new Result(true);
}


// get RP info
export async function getRPInfo(iid:string,rpID:string): Promise<Res_GetRPInfoLocal|undefined>{    
    let inst = await getModpackInst(iid);
    if(!inst || !inst.meta) return errors.couldNotFindPack.unwrap();

    let res = (await semit<Arg_GetRPInfo,Res_GetRPInfo>("getRPInfo",{mpID:inst.meta.meta.id,rpID})).unwrap();
    if(!res) return;

    let rp = inst.meta.resourcepacks.find(v=>v.rpID == rpID);

    let res2:Res_GetRPInfoLocal = res;
    if(rp) res2.local = {
        update:rp.update,
        lastDownloaded:rp.lastDownloaded,
        lastUploaded:rp.lastUploaded,
        lastUpdated:rp.lastModified
    };

    return res2;
}