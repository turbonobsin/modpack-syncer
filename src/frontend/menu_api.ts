/**
 * Claeb Code Menu API
 */

import { BrowserWindow, ipcRenderer, Menu } from "electron";
import path from "path";
import { InitMenuData } from "src/interface";
import { util_warn } from "../util";

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

    async init(){
        let w = new BrowserWindow({
            width:this.w,
            height:this.h,
            webPreferences: {
                preload: path.join(__dirname, "preload.js"),
            },
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
        // w.webContents.send("initMenu",<InitMenuData>{
        //     color:"gray"
        // });
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
export class PrismInstancesMenu extends CCMenu{
    constructor(){
        super("prism_instances",1200,800);
    }
    getId(): string {
        return "prism_instances";
    }
}

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

export async function openCCMenu(id:string){
    let menu = ccMenuRegistry.reg.get(id);
    if(!menu){
        util_warn("Failed to find ccMenu: "+id);
        console.log("Available packs:",[...ccMenuRegistry.reg.keys()]);
        return;
    }

    await menu.init();
}
export async function openCCMenuCB(id:string,w:Electron.WebContents,...args:any[]){
    let menu = ccMenuRegistry.reg.get(id);
    if(!menu){
        util_warn("Failed to find ccMenu: "+id);
        console.log("Available packs:",[...ccMenuRegistry.reg.keys()]);
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