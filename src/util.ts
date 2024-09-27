import { app } from "electron";
import fs from "fs";
import path from "path";
import toml from "toml";

let tmp = path.join;
path.join = (...paths:any[])=>{
    if(paths.includes(undefined)) return tmp("");
    return tmp(...paths);
};

export let pathTo7zip = path.join(app.getAppPath(),"node_modules","7zip-bin","win",process.arch,"7za.exe");
if(process.platform == "darwin"){
    if(process.arch == "arm64") pathTo7zip = path.join(app.getAppPath(),"node_modules","7zip-bin","mac","arm64","7za");
    else pathTo7zip = path.join(app.getAppPath(),"node_modules","7zip-bin","mac","x64","7za");
    util_note2("DETECTED MACOS: set 7zip path to: "+pathTo7zip);
}
else if(process.platform == "linux"){
    pathTo7zip = path.join(app.getAppPath(),"node_modules","7zip-bin","linux",process.arch,"7za");
    util_note2("DETECTED LINUX: set 7zip path to: "+pathTo7zip);
}
else if(process.platform == "win32"){
    util_note2("DETECTED WINDOWS: set 7zip path to: "+pathTo7zip);
}
console.log("PLATFORM: ",process.platform,process.arch);

// @ts-ignore
if(app.isPackaged) pathTo7zip = undefined;

export async function wait(delay:number){
    return new Promise<void>(resolve=>{
        setTimeout(()=>{
            resolve();
        },delay);
    });
}

/**
 * This is the path to the executable
 */
export async function set7zipPath(path:string){
    pathTo7zip = path;
}

export class CFGFile{
    constructor(){
        this.properties = new Map();
    }
    properties:Map<string,string>;

    getValue(key:string){
        return this.properties.get(key);
    }
    setValue(key:string,value:string){
        return this.properties.set(key,value);
    }
    toText(){
        let text = "";
        for(const [k,v] of this.properties){
            text += k+"="+v+"\n";
        }
        return text;
    }
}
export function parseCFGFile(text?:string){
    if(!text) return;
    let file = new CFGFile();

    let lines = text.split(/\r?\n/);

    for(const line of lines){
        if(!line) continue;
        if(!line.includes("=")) continue;

        let [key,prop] = line.split("=");
        file.properties.set(key,prop);
    }

    return file;
}

// standard file ops
export function util_readdir(path:fs.PathLike){
    return new Promise<string[]>(resolve=>{
        fs.readdir(path,(err,files)=>{
            if(err) resolve([]);
            else resolve(files);
        });
    });
}
export function util_readdirWithTypes(path:fs.PathLike,recursive=false){
    return new Promise<fs.Dirent[]>(resolve=>{
        fs.readdir(path,{withFileTypes:true,recursive},(err,files)=>{
            if(err) resolve([]);
            else resolve(files);
        });
    });
}
export function util_readBinary(path:fs.PathOrFileDescriptor){
    return new Promise<Buffer|undefined>(resolve=>{
        fs.readFile(path,(err,data)=>{
            if(err) resolve(undefined);
            resolve(data);
        });
    });
}
export function util_readText(path:fs.PathOrFileDescriptor){
    return new Promise<string>(resolve=>{
        fs.readFile(path,{encoding:"utf8"},(err,data)=>{
            // if(err) console.log("Err: ",err);
            resolve(data);
        });
    });
}
export function util_readJSON<T>(path:fs.PathOrFileDescriptor,preTextTransform?:(text:string)=>string){
    return new Promise<T | undefined>(resolve=>{
        fs.readFile(path,{encoding:"utf8"},(err,data)=>{
            if(preTextTransform) data = preTextTransform(data);
            if(err){
                // console.log("Err: ",err);
                resolve(undefined);
            }
            else{
                let obj:T | undefined;
                try{
                    obj = JSON.parse(data);
                }
                catch(err2){
                    console.log("Err: ",err2);
                }
                resolve(obj);
            }
        });
    });
}
export async function util_readTOML<T>(path:fs.PathOrFileDescriptor){
    let text = await util_readText(path);
    if(!text) return;
    
    let data:T | undefined;
    try{
        data = toml.parse(text);
    }
    catch(e){
        return;
    }

    return data;
}
export function util_writeText(path:fs.PathOrFileDescriptor,text:string){
    return new Promise<void>(resolve=>{
        fs.writeFile(path,text,{encoding:"utf8"},()=>{
            resolve();
        });
    });
}
export function util_writeJSON(path:fs.PathOrFileDescriptor,data:any){
    return new Promise<void>(resolve=>{
        fs.writeFile(path,JSON.stringify(data,undefined,4),{encoding:"utf8"},()=>{
            resolve();
        });
    });
}
export function util_writeBinary(path:fs.PathOrFileDescriptor,data:Buffer){
    return new Promise<boolean>(resolve=>{
        fs.writeFile(path,data,(err)=>{
            if(err) resolve(false);
            else resolve(true);
        });
    });
}
export function util_lstat(path:fs.PathLike){
    return new Promise<fs.Stats|undefined>(resolve=>{
        fs.lstat(path,(err,stats)=>{
            if(err){
                // console.log("Err: ",err);
                resolve(undefined);
            }
            else resolve(stats);
        });
    });
}
export function util_mkdir(path:fs.PathLike,recursive=false){
    return new Promise<boolean>(resolve=>{
        fs.mkdir(path,{recursive},(err)=>{
            if(err){
                if(err.code == "EEXIST"){
                    resolve(true);
                    return;
                }
                console.log("Err:",err);
                resolve(false);
            }
            else resolve(true);
        });
    });
}
export function util_rename(path:fs.PathLike,newPath:fs.PathLike){
    return new Promise<boolean>(resolve=>{
        fs.rename(path,newPath,(err)=>{
            if(err){
                util_warn("ERR: "+err.message);
                resolve(false);
            }
            else resolve(true);
        });
    });
}
export function util_cp(path:string|URL,newPath:string|URL,recursive=true){
    return new Promise<boolean>(resolve=>{
        fs.cp(path,newPath,{recursive,preserveTimestamps:true},(err)=>{
            if(err){
                util_warn("ERR: "+err.message);
                resolve(false);
            }
            else resolve(true);
        });
    });
}
export function util_rm(path:fs.PathLike,recursive=false){
    return new Promise<boolean>(resolve=>{
        fs.rm(path,{recursive},(err=>{
            if(err){
                util_warn("Failed to delete file: "+path);
                resolve(false);
            }
            else resolve(true);
        }));
    });
}
export function util_utimes(path:string,ops:{
    mtime:number,
    atime:number,
    btime:number
}){
    if(ops.atime == undefined) ops.atime = 0;

    if(ops.mtime) ops.mtime = Math.floor(ops.mtime);
    if(ops.atime) ops.atime = Math.floor(ops.atime);
    // if(ops.btime) ops.btime = Math.floor(ops.btime);

    return new Promise<boolean>(resolve=>{
        fs.utimes(path,ops.atime/1000,ops.mtime/1000,err=>{
            if(err){
                util_warn("Error occured while changing timestamps:");
                console.log(err);
                resolve(false);
            }
            else resolve(true);
        });
    });

    

    // if(ops.mtime) ops.mtime = Math.floor(ops.mtime);
    // if(ops.btime) ops.btime = Math.floor(ops.btime);
    
    // return new Promise<boolean>(resolve=>{
    //     // utimes(path,{
    //     //     btime:ops.btime,
    //     //     mtime:ops.mtime
    //     // },err=>{
    //     //     if(err){
    //     //         util_warn("Error occured while changing timestamps:");
    //     //         console.log(err);
    //     //         resolve(false);
    //     //     }
    //     //     else resolve(true);
    //     // });
    // });
}

export function util_testAccess(loc:fs.PathLike){
    return new Promise<boolean>(resolve=>{
        fs.open(loc,(err,fd)=>{
            if(err){
                // console.log("-- there was an err: ",err);
                resolve(false);
            }
            // EPERM
    
            if(err && err.code == "EBUSY"){
                // console.log("file is locked, do nothing.");
                resolve(false);
            }
            else if(err && err.code == "ENOENT"){
                // console.log("it was deleted.");
                resolve(false);
            }
            else{
                // console.log(">> File is accessible.",fd);
                resolve(true);
                if(fd != undefined) fs.close(fd,()=>{
                    fs.unlink(loc,err=>{
                        if(!err){
                            // console.log("deleted?");
                        }
                    });
                });
            }
        });
    });
}

// 
export function util_warn(...text:string[]){
    // console.log('\x1b[36m%s\x1b[0m', 'I am cyan'); // cyan
    // console.log('\x1b[33m%s\x1b[0m', 'Your yellow text here'); // yellow        
    for(const item of text) console.log("\x1b[33m%s\x1b[0m","Warn: "+item);
}
export function util_note(...text:any[]){
    // console.log("\x1b[36m%s\x1b[0m",text.join(" "));
    console.log("\x1b[32m%s\x1b[0m",text.join(" "));
}
export function util_note2(...text:any[]){
    // console.log("\x1b[36m%s\x1b[0m",text.join(" "));
    console.log("\x1b[35m%s\x1b[0m",text.join(" "));
}

export function searchStringCompare(s1?:string,s2?:string){
    if(!s1 || !s2) return true;
    // return s1.toLowerCase().split(" ").some(v=>v.includes(s2??""));
    // let split2 = s2.toLowerCase().split(" ");
    // return s1.toLowerCase().split(" ").some(v=>split2.includes(v));
    s1 = s1.toLowerCase().replaceAll(" ","");
    s2 = s2.toLowerCase().replaceAll(" ","");
    
    return s1.includes(s2) || s2.includes(s1);
}

/**
 * * @param path At this point, must not end with /
 * @param query Name of the item you are looking for
 */
async function recurSearch(path:string,query:string,watches:string[]=[]){
    let res:string|undefined;

    let watchMap = new Map<string,string>();

    let f = async (subpath:string)=>{
        if(res) return;
        
        let items = await util_readdirWithTypes(subpath);
        for(const item of items){
            let n = item.name;
            let newpath = subpath+"/"+n;
            if(watches.includes(n)){
                watchMap.set(n,newpath);
            }
            if(n == query){
                res = newpath;
            }
            if(item.isDirectory()){
                await f(newpath);
            }
        }
    };
    await f(path);
    return {
        path:res,
        watchMap
    };
}

// test
async function testtest(){
    // fs.link("bob1","bob2",(err)=>{
    //     if(err) console.log("ERR linking:",err);
    //     else console.log(":: link successful");
    // });

    // let path1 = path.join(app.getAppPath(),"bob1");
    // let path2 = path.join(app.getAppPath(),"bob3");
    let path1 = `D:/PrismLauncher-Windows-Portable-5.0/instances/The Gang 3 - Test Pack (edit1)/.minecraft/shaderpacks`;
    let path2 = `D:/PrismLauncher-Windows-Portable-5.0/instances/Shaders Forge 1.18.2/.minecraft/shaderpacks`;
    // let path3 = `C:/Program Files (x86)/Minecraft Launcher/runtime`;

    // let start = performance.now();
    // let res = await recurSearch(path3,"java-runtime-delta");
    // let res = await recurSearch(path3,"javaw.exe",[".version","release"]);
    // console.log("RES:",res,performance.now()-start);

    // fs.symlink(path1,path2,"junction",(err)=>{ // creates the symlink
    //     if(err) console.log("ERR linking:",err);
    //     else console.log(":: link successful");
    // });
    // fs.readlink(path2,{encoding:"utf8"},(err,linkString)=>{ // this can be used to detect if a folder is a symlink or not
    //     if(err) console.log("ERR read linking:",err);
    //     else console.log(":: read link successful",linkString);
    // });
}
testtest();

// EVT TIMELINE SCHEDULER

export abstract class EvtTL_Event<T>{
    abstract getId():string;
    // abstract run():Promise<any>;

    start(){
        this._prom = new Promise(resolve=>this._end = resolve);
    }
    
    _end?:(data:T)=>void;
    _prom?:Promise<T>;
}
export class ETL_Generic<T> extends EvtTL_Event<T>{
    constructor(id:string){
        super();
        this._id = id;
    }
    _id:string;

    getId(): string {
        return this._id;
    }
}
export class EvtTimeline{
    constructor(){
        this.evts = new Map();
    }
    evts:Map<string,EvtTL_Event<any>>;

    // server
    subEvt<T>(evt:EvtTL_Event<T>){
        let id = evt.getId();
        if(this.evts.has(id)){
            this.cancelEvtID(id);
        }
        this.evts.set(id,evt);
        evt.start();
        return evt;
    }
    async waitFor<T>(evt:EvtTL_Event<T>){
        if(!evt._prom) return;
        return evt._prom;
    }
    async waitForId<T>(id:string){
        let evt = this.evts.get(id) as EvtTL_Event<T> | undefined;
        if(!evt) return;
        return evt._prom;
    }
    // cancelEvt(evt:EvtTL_Event){
    //     this.evts.delete(evt.getId());
    // }
    cancelEvtID(id:string){
        this.evts.delete(id);
    }

    // client
    exec(id:string,data:any){
        let evt = this.evts.get(id);
        if(!evt){
            util_warn("Couldn't finish evt, it wasn't in the list: "+id);
            return;
        }
        this.finishEvt(evt,data);
    }
    finishEvt<T>(evt:EvtTL_Event<T>,data:any){
        // await evt.run();
        if(!evt._end){
            util_warn("Something seriously wrong has happened, this should never, ever print. Probably need an app restart because the event schedule is probably screwed up.");
            return;
        }
        evt._end(data);
        this.cancelEvtID(evt.getId());
    }
}
export const evtTimeline = new EvtTimeline();