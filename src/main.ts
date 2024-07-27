import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";
import path from "path";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
	app.quit();
}

export let mainWindow:BrowserWindow;

const createWindow = async () => {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 1000,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
		}
	});

	// and load the index.html of the app.
	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
	} else {
		mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
	}

	// Open the DevTools.
	mainWindow.webContents.openDevTools();

	await initDB();

	// init icpMain
	preInit();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

import "./app";
import { changeServerURL, preInit } from "./app";
import { initDB, sysInst } from "./db";
import "./network";

const appMenu = Menu.buildFromTemplate([
	{
		label:"File",
		submenu:[
			{
				role:"close"
			}
		]
	},
	{
		label:"Data",
		submenu:[
			{
				label:"Set Server URL",
				click:()=>{
					changeServerURL();
				}
			},
			{
				label:"Set Prism Folder",
				click:async ()=>{
					if(!sysInst.meta) return;
					
					let loc = sysInst.meta.prismRoot ?? "";
					let newLoc = await dialog.showOpenDialog(mainWindow,{
						properties:[
							"openDirectory"
						],
						defaultPath:loc
					});
					if(newLoc.canceled) return;

					sysInst.meta.prismRoot = newLoc.filePaths[0];
					await sysInst.save();
				}
			},
			{
				label:"Set Prism Executable",
				click:async ()=>{
					if(!sysInst.meta) return;
					
					let loc = sysInst.meta.prismExe ?? "";
					let newLoc = await dialog.showOpenDialog(mainWindow,{
						properties:[
							"openFile"
						],
						filters:[
							{
								extensions:[],
								name:"prismlauncher"
							}
						],
						defaultPath:loc
					});
					if(newLoc.canceled) return;

					sysInst.meta.prismExe = path.join(newLoc.filePaths[0],"..");
					await sysInst.save();
				}
			}
		]
	},
	{
		label:"View",
		submenu:[
			{
				role:"toggleDevTools"
			}
		]
	},
	{
		label:"Window",
		submenu:[
			{
				role:"reload"
			},
			{
				role:"forceReload"
			}
		]
	}
]);
Menu.setApplicationMenu(appMenu);