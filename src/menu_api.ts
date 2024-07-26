/**
 * Claeb Code Menu API
 */

import { BrowserWindow, ipcRenderer, Menu } from "electron";
import path from "path";
import { InitMenuData } from "src/interface";
import { util_warn } from "./util";
import { mainWindow } from "./main";

abstract class CCMenu{
    constructor(startScript:string,w=800,h=600){
        this.startScript = startScript;
        this.w = w;
        this.h = h;
    }
    startScript:string;
    w:number;
    h:number;

    abstract getId():string;

    async init<T>(data?:T){
        let w = new BrowserWindow({
            width:this.w,
            height:this.h,
            webPreferences: {
                preload: path.join(__dirname, "preload.js"),
            },
            parent:mainWindow,
            center:true
        });

        // const menu = Menu.buildFromTemplate([
        //     {
        //         label: "Main Name",
        //         submenu: [
        //         {
        //             click: () => w.webContents.send('update-counter', 1),
        //             label: 'Increment'
        //         },
        //         {
        //             click: () => w.webContents.send('update-counter', -1),
        //             label: 'Decrement'
        //         }
        //         ]
        //     }
        // ])
        // Menu.setApplicationMenu(menu);

        // await w.loadURL(path.join(MAIN_WINDOW_VITE_DEV_SERVER_URL,"menus/search_packs.html"));
        await w.loadURL(path.join(MAIN_WINDOW_VITE_DEV_SERVER_URL,"menus/"+this.startScript+".html"));
        if(data) w.webContents.send("initMenu",<InitMenuData<T>>{
            data
        });
        // w.webContents.send("initMenu",<InitMenuData<T>>{
        //     data
        // });

        return w;
    }
}

export class SearchPacksMenu extends CCMenu{
    constructor(){
        super("search_packs",800,600);
    }
    getId(): string {
        return "search_packs";
    }
}
export class ViewInstanceMenu extends CCMenu{
    constructor(){
        super("view_instance",1200,800);
    }
    getId(): string {
        return "view_instance";
    }
}
export enum ListPrismInstReason{
    view = "view",
    link = "link"
}
export class PrismInstancesMenu extends CCMenu{
    constructor(){
        super("prism_instances",1200,800);
    }
    getId(): string {
        return "prism_instances";
    }
}
export class EditInstanceMenu extends CCMenu{
    constructor(){
        super("edit_instance_menu",1200,800);
    }
    getId(): string {
        return "edit_instance_menu";
    }
}
export class UpdateProgressMenu extends CCMenu{
    constructor(){
        // super("update_progress_menu",500,300);
        super("update_progress_menu",635,800);
    }
    getId(): string {
        return "update_progress_menu";
    }
    async init<T>(data?: T | undefined): Promise<BrowserWindow> {
        let w = await super.init(data);

        // w.webContents.openDevTools();

        return w;
    }
}
export class InputMenu extends CCMenu{
    constructor(){
        super("input_menu",500,500);
    }
    getId(): string {
        return "input_menu";
    }
}
export class AddRPMenu extends CCMenu{
    constructor(){
        super("add_rp_menu",1000,800);
    }
    getId(): string {
        return "add_rp_menu";
    }
}

// 
class CCMenuRegistry{
    constructor(){
        this.reg = new Map();
    }
    reg:Map<string,CCMenu>;

    register(menu:CCMenu){
        this.reg.set(menu.getId(),menu);
    }
}
const ccMenuRegistry = new CCMenuRegistry();

export async function openCCMenu<T>(id:string,data?:T){
    let menu = ccMenuRegistry.reg.get(id);
    if(!menu){
        util_warn("Failed to find ccMenu: "+id);
        console.log("Available menus:",[...ccMenuRegistry.reg.keys()]);
        return;
    }

    return await menu.init(data);
}
export async function openCCMenuCB(id:string,w:Electron.WebContents,...args:any[]){
    let menu = ccMenuRegistry.reg.get(id);
    if(!menu){
        util_warn("Failed to find ccMenu: "+id);
        console.log("Available menus:",[...ccMenuRegistry.reg.keys()]);
        return;
    }

    await menu.init();

    let cb:((value:any)=>void) | undefined;
    let prom = new Promise<any>(resolve=>cb = resolve);
    if(!cb) return;

    w.send("initReturnCB",{
        cb,
        args
    });

    return prom;
}

// 
ccMenuRegistry.register(new SearchPacksMenu());
ccMenuRegistry.register(new ViewInstanceMenu());
ccMenuRegistry.register(new PrismInstancesMenu());
ccMenuRegistry.register(new EditInstanceMenu());
ccMenuRegistry.register(new UpdateProgressMenu());
ccMenuRegistry.register(new InputMenu());
ccMenuRegistry.register(new AddRPMenu());