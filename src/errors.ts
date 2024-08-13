import { dialog } from "electron";
import { mainWindow } from "./main";
import { getWindowStack } from "./menu_api";
import { sysInst } from "./db";

async function showError(msg:string){
    await dialog.showMessageBox(getWindowStack()[getWindowStack().length-1] ?? mainWindow,{
        message:msg,
        title:"Error"
    });
}

export class Result<T>{
    constructor(data:T,err?:string){
        let d = data as any;
        if(d) if(typeof d == "object") if("isResult" in d){
            data = d.data;
            err = d.err;
        }
        
        this.data = data;
        this.err = err;
    }
    err?:string;
    private data?:T;

    static err(msg?:string){
        return new Result<any>(undefined,msg);
    }

    unwrap(errCall?:(...args:any[])=>any){
        if(this.err){
            if(this.err == "Failed to get Prism Instance's path"){
                dialog.showMessageBox({
                    message:"ERR: "+sysInst.meta?.prismRoot
                });
            }
            
            showError(this.err);
            if(errCall) errCall(this.err ? this : errors.unknown);
            return;
        }
        if(!this.data){
            if(errCall) errCall(this.err ? this : errors.unknown);
            return;
        }
        return this.data as T;
    }
    unwrapPanic(){
        let data = this.unwrap();
        if(data == null || !data || data == undefined){
            showError("Data was undefined");
            return;
        }
        return data;
    }
};

export const errors = {
    noSys: Result.err("System data isn't loaded"),
    responseErr: Result.err("Unknown network response error"),
    serverNotConnected: Result.err("Couldn't connect to the server.\n\nEither it's down, or you don't have an active internet connection."),
    noSlug: Result.err("Slug map isn't loaded"),
    
    unknown: Result.err("Unknown error"),
    invalid_args: Result.err("Invalid arguments"),
    couldNotFindPack: Result.err("Couldn't find pack"),
    failedToReadPack: Result.err("Failed to read pack meta"),
    failedToGetPackLink: Result.err("Failed to get pack link"),

    instDataConvert: Result.err("Failed to make instance data from pack meta"),
    addInstance: Result.err("Failed to add instnace"),
    addInstFolder: Result.err("Failed to create folder for instance"),

    folderAlreadyExists: Result.err("A folder with that name already exists"),
    folderDNE: Result.err("A folder with that name doesn't exist"),
    modAlreadyInFolder: Result.err("That mod is already in this folder"),
    invalidFolderName: Result.err("Invalid folder name"),

    failedUploadRP: Result.err("A file failed to upload, aborting"),
    couldNotFindRPMeta: Result.err("Could not find meta data for this resource pack"),
    couldNotFindRPCache: Result.err("Could not find resource pack cache file"),
    failedToRemoveRP: Result.err("Failed to remove resource pack"),

    // prism
    instgroupsRead: Result.err("Failed to read instance group data"),
    noPrismRoot: Result.err("No path for Prism Launcher has been set"),
    failedToGetPrismInstPath: Result.err("Failed to get Prism Instance's path"),

    // accounts
    noAccountsFile: Result.err("Could not find Prism Accounts file"),
    noMainAccount: Result.err("Could not find main Prism Account"),

    // 
    failedNewWindow: Result.err("Failed to open window"),
    zipping: Result.err("Failed to pack/compress files"),

    // worlds
    worldDNE: Result.err("World does not exist"),
    failedToPublishWorld: Result.err("Failed to publish world"),
    failedToUnpublishWorld: Result.err("Failed to unpublish world"),
    failedToRemoveWorld: Result.err("Failed to remove world"),
    couldNotFindWorldMeta: Result.err("Could not find world meta"),
};