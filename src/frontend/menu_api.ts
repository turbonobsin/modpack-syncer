/**
 * Claeb Code Menu API
 */

import { BrowserWindow, ipcRenderer, Menu } from "electron";
import path from "path";
import { InitMenuData } from "src/interface";

export class CCMenu{
    constructor(){
        this.init();
    }
    async init(){
        let w = new BrowserWindow({
            width:800,
            height:600,
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

        await w.loadURL(path.join(MAIN_WINDOW_VITE_DEV_SERVER_URL,"menus/search_packs.html"));
        // w.webContents.send("initMenu",<InitMenuData>{
        //     color:"gray"
        // });
    }
}