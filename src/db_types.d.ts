import { ModsFolder, ModsFolderDef, PackMetaData, WorldMeta } from "./interface";

type IId = string;
type FId = string;
type UId = string;

// type DBInstanceRecord = {
//     iid:IId, // unique instance id
//     path:string,
//     name:string,
//     customName:string,
//     fid:FId, // the unique fid of the folder this instance is located in
// };

type DBFolder = {
    fid:FId,
    name:string,
    folders:FId[],
    instances:IId[],
};

type DBUser = {
    uid:UId,
    name:string,
    root:FId,
};

interface DBSys{
    fid:number;
    uid:number;
    iid:number;
    ver:string;
    port:string;
    serverURL:string;
    theme:string;

    prismRoot?:string;
    prismExe?:string;

    sevenZipExe?:string;
};

// 

type javaId = string;

export interface InstanceData{
    iid:string;
    update:number;
    meta:PackMetaData;
    loc:string;

    isRunning:boolean;
    lastLaunched:number;
    
    linkName?:string;

    customName?:string;
    customDesc?:string;

    java?:javaId;
    resourcePackFolder?:FId;
    shaderPackFolder?:FId;
    dataPackFolder?:FId;

    folders:ModsFolderDef[];

    resourcepacks:RP_Meta[];
    worlds:WorldMeta[];

    // auth:{
    //     users:any[]
    // }
}

export interface RP_Meta{
    rpID:string;
    lastModified:number;
    lastUploaded:number;
    lastDownloaded:number;
    update:number;
}
export interface TmpFile{
    path:string,
    buf:Uint8Array,
    name:string,
    
    at:number,
    bt:number,
    mt:number
}