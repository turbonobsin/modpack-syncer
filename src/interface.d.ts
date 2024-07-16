// Server Types

import { ModPackInst } from "./db";
import { InstanceData } from "./db_types";

type FSTestData = {
    instancePath:string;
    modList:string[];
}
type PackMetaData = {
    id:string;
    name:string;
    desc:string;
    loader:string;
    version:string;
};
type InitMenuData<T> = {
    data:T
};

type Arg_SearchPacks = {
    query?:string
};
interface Res_SearchPacks{
    similar:string[];
}
interface Res_SearchPacksMeta{
    similar:PackMetaData[];
}

type ListPrismInstReason = "view" | "link";
interface Data_PrismInstancesMenu{
    reason:ListPrismInstReason;
    iid:string;
    instName:string;
}
interface PrismInstance{
    name:string;
    group:string;
    version:string;
    loader:string;
    loaderVersion:string;
    totalTimePlayed:number;
    path:string;
}
interface Arg_GetPrismInstances{
    query?:string;
}
interface Res_GetPrismInstances{
    list:PrismInstance[];
}

// prism
interface InstGroups{
    formatVersion:string;
    groups:Record<string,{
        hidden:boolean;
        instances:string[];
    }>;
}
interface MMCPack{
    formatVersion:number;
    components:{
        cachedName:string;
        cachedVersion:string;
        cachedVolatile:boolean;
        dependencyOnly:boolean;
        uid:string;
        version:string;
        cachedRequires:{
            suggests:string;
            equals:string;
            uid:string;
        }[];
        important:boolean;
    }[];
}

interface Arg_GetInstances{
    folder?:string;
    query?:string;
}

interface ScreenshotItem{
    name:string;
    path:string;
    // buf:Uint8Array;
}
export interface Arg_GetInstScreenshots{
    iid:string;
}
export interface Res_GetInstScreenshots{
    list:ScreenshotItem[];
    path:string;
}

interface EditInst_InitData{
    iid:string;
}

export type Err<T> = {
    err?:string;
    data?:T;
};

export interface IGlobalAPI{
    // render -> main
    fsTest:(path?:string)=>Promise<FSTestData>;
    getPackMeta:(id?:string)=>Promise<Err<PackMetaData>>;
    alert:(msg?:string)=>Promise<void>;
    openMenu:(type:string)=>void;
    
    searchPacks:(arg:Arg_SearchPacks)=>Promise<Res_SearchPacks>;
    searchPacksMeta:(arg:Arg_SearchPacks)=>Promise<Res_SearchPacksMeta>;

    addInstance:(meta:PackMetaData)=>Promise<ModPackInst|undefined>;
    getInstances:(arg:Arg_GetInstances)=>Promise<InstanceData[]|undefined>;
    showLinkInstance:(iid:string,instName:string)=>Promise<string|undefined>;
    linkInstance:(iid:string,pInstName:string)=>Promise<void>;
    getInstScreenshots:(arg:Arg_GetInstScreenshots)=>Promise<Res_GetInstScreenshots>;

    getPrismInstances:(arg:Arg_GetPrismInstances)=>Promise<Res_GetPrismInstances>;

    launchInstance:(iid:string)=>Promise<void>;

    showEditInstance:(iid:string)=>Promise<void>;

    getImage:(path:string)=>Promise<Uint8Array>;
    
    // main -> render
    onInitMenu:(cb:(data:InitMenuData)=>void)=>void;
    onInitReturnCB:(cb:(data:any)=>void)=>void;
    refresh:(cb:(data:any)=>void)=>void;
}

declare global{
    interface Window{
        gAPI:IGlobalAPI
    }
}