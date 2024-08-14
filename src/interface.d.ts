// Server Types

import { ModPackInst } from "./db";
import { InstanceData, RP_Meta } from "./db_types";
import type { Mod as Mod2 } from "node-curseforge";
import { allDropdowns } from "./dropdowns";

interface Arg_Connection{
    uid:string;
    uname:string;
}

type FSTestData = {
    instancePath:string;
    modList:string[];
}
interface PackMetaData{
    id:string;
    name:string;
    desc:string;
    loader:string;
    version:string;
    img:string;

    publisherUID?:string;
    publisherName?:string;

    RAM?:number;
    javaCodeName?:string; // delta (v21), gamma (v17), beta (v1.8)
    
    mmcPackFile?:any;
    instanceCfgFile?:any;

    update:number;

    resourcepacks:RP_Meta[];
};

// modpacks (new)
interface Arg_PublishModpack{
    meta:PackMetaData;
    icon?:Uint8Array;
    mmcPackFile?:Uint8Array;
}
interface Arg_UploadModpack{
    files:{
        sloc:string;
        mTime:number;
    }[];
    mpID:string;
}
interface Res_UploadModpack{
    files:string[];
}
interface Arg_UploadModpackFile{
    buf:Uint8Array;
    sloc:string;
    mpID:string;
}
// 

type InitMenuData<T> = {
    data:T
};
interface Arg_AddInstance{
    meta:PackMetaData;
    autoCreate:boolean;
}

type Arg_SearchPacks = {
    query?:string
    uid:string;
    uname:string;
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

interface CmdInitData{
    cmd?:string;
    args?:any[];
}
interface EditInst_InitData{
    iid:string;
    mpID:string;
}
interface UpdateProgress_InitData{
    iid:string;
    // update:Res_GetModUpdates;
}

// type InputMenuOptionType = "text" | "combobox" | "multiselect";
type InputMenuOption = IMO_Title | IMO_Input | IMO_Search | IMO_Combobox | IMO_MultiSelect;
// interface InputMenuOption{
//     readonly type:InputMenuOptionType;
// }

interface IMO_MultiSelect{
    readonly type:"multi_select",
    id:string;
    label:string;
    options:OptionItem[];
    selected?:string[];
}
interface IMO_Title extends InputMenuOption{
    readonly type:"title";
    title?:string;
    desc?:string;
}
interface IMO_Text extends InputMenuOption{
    readonly type:"text";
    id:string;
    label:string;
}
interface IMO_Input extends InputMenuOption{
    readonly type:"input";
    id:string;
    label:string;
    inputType:string;
    value?:any;
    checked?:boolean;
    placeholder?:string;
}
interface IMO_Search extends InputMenuOption{
    readonly type:"search";
    id:string;
    label:string;
    placeholder?:string;
    value?:string;
}

export interface OptionItem{
    label:string;
    value:string;
}
interface IMO_Combobox extends InputMenuOption{
    readonly type:"combobox";
    id:string;
    label:string;
    options:OptionItem[];
    default:number;
    multiple?:boolean;
    selected?:string[];
}

interface InputMenuSection{
    options:InputMenuOption[];
}
interface InputMenu_InitData{
    cmd:string;
    args:any[];

    title:string;
    sections:InputMenuSection[];

    width?:number;
    height?:number;
}
interface Res_InputMenu{
    data:Record<string,any>;
}

interface Arg_IID{
    iid:string;
}
interface Arg_GetInstMods extends Arg_IID{
    query?:string;
}
interface ModInfo{
    m:any;

    name:string;
    version:string;
    desc:string;
    authors:string[];
    icon:string;
    loader:string;
}
interface ModData{
    // name:string;
    // info?:ModInfo;
    slug:string; // slug

    file:string;
    name:string;
    description:string;
    id:string;
    version:string;
    authors:string[];
    icon:string;

    fabric:any;
    forge:any;
    datapack:any;

    _formatVersion:string;
    _type:"fabric" | "forge" | "datapack" | "other";
}
interface FullModData{
    local:LocalModData;
    remote?:RemoteModData;
}
type FolderType = "root" | "custom";
interface ModsFolderDef{
    name:string;
    type:FolderType;
    tags:string[];
    mods:string[];
}
interface ModsFolder{
    name:string;
    type:FolderType;
    tags:string[];
    mods:FullModData[];
}
interface Res_GetInstMods{
    // mods:{
    //     global:FullModData[],
    //     local:FullModData[]
    // }
    folders:ModsFolder[];
}

interface RP_MCMeta{
    pack:{
        pack_format:number;
        description:string;
    }
}
interface RP_Data{
    name:string;
    data?:{ // data will be defined only if the Resource Pack has been unpacked into a folder (because I can't efficiently read the data otherwise)
        icon?:string;
        meta?:RP_MCMeta;
        sync?:RP_Sync;
    }
}
interface World_Data{
    wID:string;
    data?:{
        icon?:string;
        // isRunning:boolean;
    };
    // data?:{ // data will be defined only if the Resource Pack has been unpacked into a folder (because I can't efficiently read the data otherwise)
    //     icon?:string;
    //     meta?:RP_MCMeta;
    //     sync?:RP_Sync;
    // }
}
interface RP_Sync{
    rpID:string;
}
interface TItem{
    name:string;
}
interface TFolder extends TItem{
    items:TItem[];
}
interface TFile extends TItem{
    buf:Uint8Array;
}
interface ResourcePack{
    data:RP_Data;
    root:TFolder;
}
interface Arg_GetResourcePack{
    name:string;
}
interface Res_GetResourcePack{
    pack:ResourcePack;
}
interface Arg_GetInstResourcePacks{
    iid:string;
    filter:SearchFilter;
}
interface Res_GetInstResourcePacks{
    packs:RP_Data[];
}
interface Arg_GetInstWorlds{
    iid:string;
    filter:SearchFilter;
}
interface Res_GetInstWorlds{
    worlds:World_Data[];
}

interface ModrinthUpdate{
    "mod-id":string;
    version:string;
}
interface CurseForgeUpdate{
    "file-id":number;
    "project-id":number;
}
interface ModIndex{
    name:string;
    filename:string;
    side:string;

    download:{
        mode:string;
        url:string;
        "hash-format":string;
        hash:string;
    }

    update:{
        modrinth:ModrinthUpdate;
        curseforge:CurseForgeUpdate;
    }

}
type ModSideType = "required" | "optional" | "unsupported";
type ModStatus = "approved" | "archived" | "rejected" | "draft" | "unlisted" | "processing" | "withheld" | "scheduled" | "private" | "unknown"
type RequestedStatus = "approved" | "archived" | "unlisted" | "private" | "draft";
type Modrinth_ProjectType = "mod" | "modpack" | "resourcepack" | "shader";
type ISOString = string;
interface Modrinth_DonationURL{
    /** The ID of the donation platform */
    id:string;
    /** The donation platform this link is to */
    platform:string;
    /** The URL of the donation platform and user */
    url:string;
}
interface Modrinth_License{
    /** The SPDX license ID of a project */
    id:string;
    /** The long name of a license */
    name:string;
    /** The URL to this license */
    url?:string;
}
interface Modrinth_GalleryImage{
    /** The URL of the gallery image */
    url:string;
    /** Whether the image is featured in the gallery */
    featured:boolean;
    /** The title of the gallery image */
    title?:string;
    /** The description of the gallery image */
    description?:string;
    /** The date and time the gallery image was created */
    created:ISOString;
    /** The order of the gallery image. Gallery images are sorted by this field and then alphabetically by title. */
    ordering:number;
}

interface ModrinthModData{
    /** The slug of a project, used for vanity URLs. Regex: ^[\w!@$()`.+,"\-']{3,64}$ */
    slug:string;
    /** The title or name of the project */
    title:string;
    /** A short description of the project */
    description:string;
    /** A list of the categories that the project has */
    categories:string[];
    /** The client side support of the project */
    client_side:ModSideType;
    /** The server side support of the project */
    server_side:ModSideType;
    /** A long form description of the project */
    body:string;
    /** The status of the project */
    status:ModStatus,

    /** The requested status when submitting for review or scheduling the project for release */
    requested_status?:string;
    /** A list of categories which are searchable but non-primary */
    additional_categories:string[];
    /** An optional link to where to submit bugs or issues with the project */
    issues_url?:string;
    /** An optional link to the source code of the project */
    source_url?:string;
    /** An optional link to the project's wiki page or other relevant information */
    wiki_url?:string;
    /** An optional invite link to the project's discord */
    discord_url?:string;
    /** A list of donation links for the project */
    donation_urls:Modrinth_DonationURL[],

    /** The project type of the project */
    project_type:Modrinth_ProjectType;
    /** The total number of downloads of the project */
    downloads:number;

    /** The URL of the project's icon */
    icon_url?:string;
    /** The RGB color of the project, automatically generated from the project icon */
    color?:number;
    /** The ID of the moderation thread associated with this project */
    thread_id:string;
    monetization_status:"monetized" | "demonetized" | "force-demonetized";

    /** The ID of the project, encoded as a base62 string */
    id:string;
    /** The ID of the team that has ownership of this project */
    team:string;

    /** The date the project was published */
    published:ISOString;
    /** The date the project was last updated */
    updated:ISOString;
    /** The date the project's status was set to an approved status */
    approved?:ISOString;
    /** The date the proejct's status was submitted to moderators for review */
    queued?:ISOString;

    /** The total number of users following the project */
    followers:number;
    /** The license of the project */
    license?:Modrinth_License;

    /** A list of the version IDs of the project (will never be empty unless draft status) */
    versions:string[];
    /** A list of all of the game versions supported by the project */
    game_versions:string[];
    /** A list of all of the loaders supported by the project */
    loaders:string[];
    /** A list of images that have been uploaded to the project's gallery */
    gallery:(Modrinth_GalleryImage | undefined)[];
}
interface CurseForgeModData extends Mod2{

}
interface Res_GetModIndexFiles{
    modrinth:ModrinthModData[];
    curseforge:CurseForgeModData[];

    server:{
        required:string[],
        optional:string[],
        unsupported:string[]
    },
    client:{
        required:string[],
        optional:string[],
        unsupported:string[]
    }
}

interface LocalModData extends ModData{
    pw:ModIndex;
}
interface RemoteModData{
    modrinth?:ModrinthModData;
    curseforge?:CurseForgeModData;
}
interface SlugMapData{
    map:Record<string,string[]>;
}

export type Err<T> = {
    err?:string;
    data?:T;
};

interface Arg_SyncMods extends Arg_IID{

}
interface Res_SyncMods{
    upToDate:boolean;
}
interface Arg_CheckModUpdates{
    id:string;
    update:number;
}
interface Arg_GetModUpdates{
    id:string;
    currentMods:string[];
    currentIndexes:string[];
    ignoreMods:string[];
}
interface Res_GetModUpdates{
    mods:{
        add:string[],
        remove:string[]
    },
    indexes:{
        add:string[],
        remove:string[]
    }
}

// folders
interface Arg_CreateFolder extends Arg_IID{
    name:string;
    type:FolderType;
    tags:string[];
}
interface Arg_EditFolder extends Arg_IID{
    folderName:string;
    name:string;
    type:FolderType;
    tags:string[];
}
interface Arg_ChangeFolderType extends Arg_IID{
    name:string;
    newType:FolderType;
}
interface Arg_AddModToFolder extends Arg_IID{
    name:string;
    modCleaned:string;
    type:FolderType;
}

interface SearchFilter{
    query?:string;
}

interface PrismAccount{
    active:boolean;
    entitlement:{
        canPlayMinecraft:boolean;
        ownsMinecraft:boolean;
    };
    profile:{
        capes:{
            alias:string;
            id:string;
            url:string;
        }[];
        id:string;
        name:string;
        skin:{
            data:string;
            id:string;
            url:string;
            variant:string; // CLASSIC
        };
    };
}
interface PrismAccountsData{
    accounts:PrismAccount[];
}

interface Arg_UnpublishRP{
    mpID:string;
    rpID:string;
    uid:string;
}

interface Arg_UploadRP{
    iid:string;
    uid:string;
    uname:string;
    mpID:string;
    name:string; // this is now rpID which is just the name of the folder/file that is the pack
    force?:boolean;
}
interface Res_UploadRP{
    res:number;
    update:number;
}
interface Arg_UploadRPFile{
    path:string;
    buf:Uint8Array;
    mpID:string;
    rpName:string;

    uid?:string;
    uname?:string;
    
    at:number;
    mt:number;
    bt:number;
}
interface Arg_UnpackRP{
    iid:string;
    rpID:string;
}
interface Arg_RemoveRP{
    iid:string;
    rpID:string;
}
interface Arg_DownloadRPFile{
    path:string;
    mpID:string;
    rpName:string;

    // upload:number;
    // download:number;
    // modified:number;
}
interface Arg_DownloadRP{
    iid:string;
    mpID:string;
    rpID:string;
    lastDownloaded:number;
    force?:boolean;
}
interface ModifiedFile{
    n:string; // just the name of the file
    l:string; // relative path/location
    // lm:number; // last modified (or time created if that's newer)
    mt:number; // modify time
    bt:number; // birth time (time created)
    at:number;
}
interface ModifiedFileData{
    buf:Uint8Array;
    mt:number;
    at:number;
    bt:number;
}
interface Res_DownloadRP{
    add:ModifiedFile[];
    remove:ModifiedFile[];
    update:number;
}
interface RPCache{
    upload:number;
    download:number;
    modified:number;
}
interface ArgC_GetRPs{ // arg client
    iid:string;
}
interface Arg_GetRPs{
    mpID:string;
    existing:string[];
}
interface Res_GetRPs{
    // list:{
    //     rpID:string;
    //     desc:string;
    //     pack_format:number;
    // }[];
    list:RP_Data[];
}

interface AddRP_InitData{
    iid:string;
    // data:Res_GetRPs;
}
interface AddWorld_InitData{
    iid:string;
}

interface Arg_GetRPVersions{
    mpID:string;
    current:{
        rpID:string;
        update:number;
    }[];
}
interface Res_GetRPVersions{
    versions:{
        rpID:string;
        update:number;
    }[];
}

interface WorldInfo{
    icon:string;
    ownerUID:string;
    ownerName:string;
    update:number;
    publisherName:string;
}
interface Arg_GetWorldInfo{
    iid?:string;
    // 
    mpID?:string;
    wID:string;
}
interface Res_GetWorldInfo{
    isPublished:boolean;
    wID:string;
    data?:WorldInfo;
    yourUpdate:number; // for just the client side
    yourName:string; // for just the client side
    state:WorldState;
    isRunning:boolean;
}
type WorldState = "" | "inUse" | "uploading" | "downloading";
interface Arg_PublishWorld{
    iid:string;
    wID:string;
}
interface SArg_PublishWorld{ // server arg
    mpID:string;
    wID:string;
    allowedDirs:string[];
    ownerUID:string;
    ownerName:string;
}
interface Arg_UnpublishWorld{
    mpID:string;
    wID:string;
    uid:string;
}
interface Arg_UploadWorldFile{
    path:string;
    mpID:string;
    wID:string;
    uid:string;
    uname:string;
    buf:Uint8Array;
}
interface Arg_DownloadWorldFile{
    path:string;
    mpID:string;
    wID:string;
}
interface Arg_UploadWorld{
    iid:string;
    wID:string;
}
interface Arg_DownloadWorld{
    iid:string;
    wID:string;
    forceAllFiles?:boolean;
}
interface Arg_GetAllowedDirs{
    mpID:string;
    wID:string;
    uid:string;
}
interface Arg_GetWorldFiles{
    mpID:string;
    wID:string;
    useTime:boolean;
    syncTime:number;
    update:number;
    uid:string;
    forceAllFiles?:boolean;
}
interface Res_GetWorldFiles{
    files:WorldFile[];
    update:number;
}
interface WorldFile{
    n:string;
    loc:string;
    sloc:string;
}
interface WorldMeta{
    wID:string;
    lastSync:number; // this time is when the last sync (download or upload) has completely finished so it doesn't include the files it just did something with and it works in both directions for upload/download
    update:number; // not sure if I'll use this but it's for future proofing and hopefully faster up to date checks
}
interface Arg_FinishUploadWorld{
    mpID:string;
    wID:string;
    uid:string;
    uname:string;
}
interface Res_FinishUploadWorld{
    update:number;
}
interface Arg_GetServerWorlds{
    iid:string;
}
interface SArg_GetServerWorlds{
    mpID:string;
    existing:string[];
}
interface Res_GetServerWorlds{
    list:ServerWorld[];
}
interface ServerWorld{
    wID:string;
    icon:string;
    publisherName:string;
    ownerName:string;
    update:number;
    state:WorldState;
}
interface Arg_SetWorldState{
    iid:string;
    wID:string;
    uid:string;
    state:WorldState;
}
interface SArg_SetWorldState{
    mpID:string;
    wID:string;
    uid:string;
    state:WorldState;
}
interface Arg_TakeWorldOwnership{
    iid:string;
    wID:string;
    uid:string;
    uname:string;
}
interface SArg_TakeWorldOwnership{
    mpID:string;
    wID:string;
    uid:string;
    uname:string;
}
interface Arg_GenericWorld{
    mpID:string;
    wID:string;
    uid:string;
    uname:string;
}
interface Arg_ToggleWorldEnabled{
    iid:string;
    wID:string;
    enable?:booelean;
}

interface Arg_LaunchInst{
    mpID:string;
    uid:string;
    uname:string;
}

interface UpdateSearch{
    iid?:string;
    mpID:string;
    id:string;
    data:any;
}

// 

export interface IGlobalAPI{
    // render -> main
    fsTest:(path?:string)=>Promise<FSTestData>;
    getPackMeta:(id?:string)=>Promise<Err<PackMetaData>>;
    alert:(msg?:string)=>Promise<void>;
    openMenu:(type:string,data?:any)=>void;
    triggerEvt:(id:string,data:any)=>void;
    
    searchPacks:(arg:Arg_SearchPacks)=>Promise<Res_SearchPacks>;
    searchPacksMeta:(arg:Arg_SearchPacks)=>Promise<Res_SearchPacksMeta>;

    addInstance:(arg:Arg_AddInstance)=>Promise<ModPackInst|undefined>;
    getInstances:(arg:Arg_GetInstances)=>Promise<InstanceData[]|undefined>;
    showLinkInstance:(iid:string,instName:string)=>Promise<string|undefined>;
    linkInstance:(iid:string,pInstName:string)=>Promise<void>;
    checkForInstUpdates:(iid:string)=>Promise<boolean>;
    updateInst:(iid:string)=>Promise<boolean>; // depricated?
    removeInst:(iid:string)=>Promise<boolean>;
    unlinkInst:(iid:string)=>Promise<boolean>;

    getInstScreenshots:(arg:Arg_GetInstScreenshots)=>Promise<Res_GetInstScreenshots>;
    getInstMods:(arg:Arg_GetInstMods)=>Promise<Res_GetInstMods>;
    getInstRPs:(arg:Arg_GetInstResourcePacks)=>Promise<Res_GetInstResourcePacks|undefined>;
    getInstWorlds:(arg:Arg_GetInstWorlds)=>Promise<Res_GetInstWorlds|undefined>;

    // worlds
    getWorld:(arg:Arg_GetWorldInfo)=>Promise<Res_GetWorldInfo|undefined>;
    publishWorld:(arg:Arg_PublishWorld)=>Promise<boolean>;
    uploadWorld:(arg:Arg_UploadWorld)=>Promise<boolean>;
    downloadWorld:(arg:Arg_DownloadWorld,useTime=true)=>Promise<boolean>;
    getServerWorlds:(arg:Arg_GetServerWorlds)=>Promise<Res_GetServerWorlds>;
    getWorldImg:(iid:string,wID:string)=>Promise<string>;
    takeWorldOwnership:(arg:Arg_TakeWorldOwnership)=>Promise<boolean>;
    toggleWorldEnabled:(arg:Arg_ToggleWorldEnabled)=>Promise<boolean>;
    
    getModIndexFiles:(arg:Arg_IID)=>Promise<Res_GetModIndexFiles>;
    cacheMods:(iid:string)=>Promise<void>;
    toggleModEnabled:(iid:string,filename:string,force?:boolean)=>Promise<void>;

    getPrismInstances:(arg:Arg_GetPrismInstances)=>Promise<Res_GetPrismInstances>;

    launchInstance:(iid:string)=>Promise<void>;

    showEditInstance:(iid:string)=>Promise<void>;

    getImage:(path:string)=>Promise<Uint8Array>;
    changeServerURL:()=>Promise<boolean>;

    getTheme():Promise<string|undefined>;

    // folders
    folder:{
        create:(arg:Arg_CreateFolder)=>Promise<boolean>;
        changeType:(arg:Arg_ChangeFolderType)=>Promise<boolean>;
        addMod:(arg:Arg_AddModToFolder)=>Promise<boolean>;
    }

    // resource packs
    uploadRP:(arg:Arg_UploadRP)=>Promise<boolean>;
    unpackRP:(arg:Arg_UnpackRP)=>Promise<boolean>;
    removeRP:(arg:Arg_RemoveRP)=>Promise<boolean>;
    downloadRP:(arg:Arg_DownloadRP)=>Promise<boolean>;
    getRPs:(arg:ArgC_GetRPs)=>Promise<Res_GetRPs>;
    getRPImg:(iid:string,rpID:string)=>Promise<string>;
    genAllThePBR:(iid:string)=>Promise<boolean>;

    // sync
    sync:{
        mods:(arg:Arg_SyncMods)=>Promise<Res_SyncMods>;
    }

    // dropdowns
    dropdown:{
        mod:(iid:string,files:string[])=>Promise<string[][]>;
    }
    openDropdown:(id:string,...args:any[])=>Promise<any>;
    
    // main -> render
    onInitMenu:(cb:(data:InitMenuData)=>void)=>void;
    onInitReturnCB:(cb:(data:any)=>void)=>void;
    refresh:(cb:(data:any)=>void)=>void;
    onMsg:(cb:(msg:string)=>void)=>void;

    onEditImg:(cb:(img:string,type:string)=>any)=>void;
    onSetClientTheme:(cb:(theme:string|undefined)=>void)=>void;
    onUpdateSearch:(cb:(data:any)=>void)=>void;
    
    onUpdateProgress:(cb:(id:string,i:number,total:number,item:string,extra:any)=>void)=>void;
}

declare global{
    interface Window{
        gAPI:IGlobalAPI
    }
}