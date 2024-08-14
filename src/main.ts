import { app, BrowserWindow, dialog, ipcMain, Menu, shell, AutoUpdater } from "electron";
import path from "path";
import {updateElectronApp} from "update-electron-app";
updateElectronApp();

// require('update-electron-app')();

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
		},
		// show:false
	});

	// and load the index.html of the app.
	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
	} else {
		mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
	}
	// await new Promise<void>(resolve=>{
	// 	mainWindow.once("ready-to-show",()=>{
	// 		mainWindow.show();
	// 		resolve();
	// 	});
	// });

	// dialog.showMessageBox({
	// 	message:"First theme: "+sysInst.meta?.theme
	// });
	// mainWindow.webContents.send("setClientTheme",sysInst.meta?.theme);
	mainWindow.webContents.send("initMenu",<InitMenuData<any>>{
		data:undefined
	});

	if(false) setTimeout(async ()=>{
		let ar = (await util_readdir(path.join(__dirname,"../renderer")));
		ar.push("-----");
		ar.push(...(await util_readdir(path.join(__dirname,"../renderer",MAIN_WINDOW_VITE_NAME))));
		ar.push("-----");
		ar.push(...(await util_readdir(path.join(__dirname,"../renderer",MAIN_WINDOW_VITE_NAME,"assets"))));
		dialog.showMessageBox({
			message:ar.join("\n")
		});
	},1500);

	// Open the DevTools.
	// mainWindow.webContents.openDevTools();

	await initDB();
};

// const log = require('electron-log');
// const path = require('path');

// import {autoUpdater} from "electron-updater";

// autoUpdater.autoDownload = false;
// autoUpdater.autoInstallOnAppQuit = true;

// autoUpdater.on('update-available', (info) => {
// 	dialog.showMessageBox({
// 		type: 'info',
// 		title: 'Update available',
// 		message: `A new version is available. Do you want to update now?\n\nYour Version: ${app.getVersion()}\nNew Version: ${info.version}`,
// 		buttons: ['Update', 'Later']
// 	}).then(result => {
// 		if (result.response === 0) {
// 			autoUpdater.downloadUpdate();
// 		}
// 	});
// });

// autoUpdater.on('update-downloaded', (info) => {
// 	dialog.showMessageBox({
// 		type: 'info',
// 		title: 'Update ready',
// 		message: 'Install & restart now?',
// 		buttons: ['Yes', 'Later']
// 	}).then(result => {
// 		if (result.response === 0) {
// 			autoUpdater.quitAndInstall();
// 		}
// 	});
// });

// autoUpdater.on("error",(err,msg)=>{
// 	dialog.showMessageBox({
// 		type:"error",
// 		title:"Error Updating",
// 		message:err.message
// 	});
// });

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
async function mainInit(){	
	// init icpMain
	preInit();
	await preInitDB();

	await createWindow();

	// autoUpdater.checkForUpdates();
}
app.on("ready", mainInit);

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
import { dataPath, initDB, openPublishModpackMenu, preInitDB, sysInst, themes } from "./db";
import "./network";
import { InitMenuData } from "./interface";
import { getConnectionStatus } from "./network";
import { util_readdir } from "./util";

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
			},
			{
				label:"Set 7zip Executable",
				click:async ()=>{
					if(!sysInst.meta) return;
					
					let loc = sysInst.meta.sevenZipExe ?? "";
					let newLoc = await dialog.showOpenDialog(mainWindow,{
						properties:[
							"openFile"
						],
						defaultPath:loc
					});
					if(newLoc.canceled) return;

					sysInst.meta.sevenZipExe = path.join(newLoc.filePaths[0],"..");
					await sysInst.save();
				}
			},
			{
				type:"separator"
			},
			{
				label:"Open Program Data Folder",
				click:()=>{
					shell.showItemInFolder(dataPath);
				}
			},
			{
				label:"Open Prism Instances Folder",
				// enabled:sysInst.meta?.prismRoot != undefined,
				click:()=>{
					if(!sysInst.meta?.prismRoot) return;
					shell.showItemInFolder(path.join(sysInst.meta.prismRoot,"instances"));
				}
			},
		]
	},
	{
		label:"Network",
		submenu:[
			{
				label:"Test Connection",
				click:()=>{
					dialog.showMessageBox({
						message:"Server URL: "+sysInst.meta?.serverURL+"\n\nConnected: "+getConnectionStatus()+"\n\nApp Version: "+app.getVersion()
					});
				}
			},
			{
				label:"Set Server URL",
				click:()=>{
					changeServerURL();
				}
			},
			{
				type:"separator"
			},
			{
				label:"Publish a Modpack",
				click:()=>{
					openPublishModpackMenu();
				}
			}
		]
	},
	{
		label:"Theme",
		submenu:[
			{
				label:"Change Theme",
				submenu:(()=>{
					let ok = Object.keys(themes);
					return ok.map(k=>{
						let v = themes[k];
						if(v._disabled) return;
						return {
							label:v.name ?? k,
							click:()=>{
								sysInst.setTheme(k);
							}
						};
					}).filter(v=>!!v);
				})()
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