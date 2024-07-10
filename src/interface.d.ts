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

export type Err<T> = {
    err?:string;
    data?:T;
};

export interface IGlobalAPI{
    fsTest:(path?:string)=>Promise<FSTestData>;
    getPackMeta:(id?:string)=>Promise<Err<PackMetaData>>;
    alert:(msg?:string)=>Promise<void>;
    openMenu:(type:string)=>void;
    
    searchPacks:(arg:Arg_SearchPacks)=>Promise<Res_SearchPacks>;
    searchPacksMeta:(arg:Arg_SearchPacks)=>Promise<Res_SearchPacksMeta>;

    onInitMenu:(cb:(data:InitMenuData)=>void)=>void;
}

declare global{
    interface Window{
        gAPI:IGlobalAPI
    }
}