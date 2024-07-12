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
type InitMenuData = {
    color:string;
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

interface PrismInstance{
    name:string;
    group:string;
    version:string;
    loader:string;
    loaderVersion:string;
    totalTimePlayed:number;
}
interface Arg_GetPrismInstances{

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
    getInstances:(folder?:string)=>Promise<InstanceData[]|undefined>;
    linkInstance:(iid:string)=>Promise<string|undefined>;

    getPrismInstances:(arg:Arg_GetPrismInstances)=>Promise<Res_GetPrismInstances>;
    
    // main -> render
    onInitMenu:(cb:(data:InitMenuData)=>void)=>void;
}

declare global{
    interface Window{
        gAPI:IGlobalAPI
    }
}