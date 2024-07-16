import { app } from "electron";
import fs from "fs";
import path from "path";

export async function wait(delay:number){
    return new Promise<void>(resolve=>{
        setTimeout(()=>{
            resolve();
        },delay);
    });
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
    return new Promise<Buffer>(resolve=>{
        fs.readFile(path,(err,data)=>{
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
export function util_readJSON<T>(path:fs.PathOrFileDescriptor){
    return new Promise<T | undefined>(resolve=>{
        fs.readFile(path,{encoding:"utf8"},(err,data)=>{
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
export function util_mkdir(path:fs.PathLike){
    return new Promise<boolean>(resolve=>{
        fs.mkdir(path,(err)=>{
            if(err){
                // console.log("Err:",err);
                resolve(false);
            }
            resolve(true);
        });
    });
}

// 
export function util_warn(...text:string[]){
    // console.log('\x1b[36m%s\x1b[0m', 'I am cyan'); // cyan
    // console.log('\x1b[33m%s\x1b[0m', 'Your yellow text here'); // yellow        
    for(const item of text) console.log("\x1b[33m%s\x1b[0m","Warn: "+item);
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