import { app } from "electron";
import { util_lstat, util_mkdir, util_readdir, util_readJSON, util_readText, util_warn, util_writeJSON } from "./util";
import path from "path";

let appPath = app.getAppPath();
const dataPath = path.join(appPath,"data");
const folderPath = path.join(dataPath,"folders");

// 
let userData:DBUser;
let sysData:DBSys;

function markSave(path:string,data:any){
    util_writeJSON(path,data);
}

enum IDType{
    user,
    instance,
    folder
}
function genId(type:IDType){
    switch(type){
        case IDType.user:
            sysData.uid++;
            markSave(path.join(dataPath,"sys.json"),sysData);
            return sysData.uid;
        default:
            return -1;
    }
}

async function createFolder(name:string,parentPath=folderPath){
    await util_mkdir(path.join(parentPath,name));
    return name;
}

export async function initDB(){
    if(!await util_lstat(path.join(dataPath,"sys.json"))){
        sysData = {
            fid:0,
            iid:0,
            uid:0,
            ver:"0.0.1"
        };
        await util_writeJSON(path.join(dataPath,"sys.json"),sysData);
    }
    else{
        let res = await util_readJSON<DBSys>(path.join(dataPath,"sys.json"));
        if(!res){
            util_warn("Could not load system data");
            return;
        }
        sysData = res;
    }
    
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