import { PackMetaData } from "./interface";

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

    prismRoot?:string;
};

// 

type javaId = string;

interface InstanceData{
    iid:string;
    meta:PackMetaData;
    
    dirPath?:string;

    customName?:string;
    customDesc?:string;

    java?:javaId;
    resourcePackFolder?:FId;
    shaderPackFolder?:FId;
    dataPackFolder?:FId;
}