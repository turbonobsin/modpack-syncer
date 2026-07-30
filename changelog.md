# 1/3/25
- added delete button to mods right click menu
- fixed syncing mods wouldn't delete the old mods that didn't exist on the server anymore
    - now the .delete folder is properly created and the removed mods moved there
- significantly improved mod search accuracy by using not just the filename but also the meta name if available

# 8/23/25
- hopefully fixed when syncing mods failing to catch and keep going

# 6/25/26
- fixed putting slashes at the end of server_urls
- fixed so that socket.io works with server_urls that require a path (like /mp)
- fixed so that images from server load properly with custom path server_urls using the new (getServerURLWithNewPathl)

# 6/26/26 -- 0.32.3
- added fourth button to right side panel for an instance which is a dropdown button for "Extras"
    - added "Sync Keybinds"
        - downloads options.txt and only add/override newer keybinds specifically without getting rid of other keybinds set by the user or their other options.txt settings
    - added "Sync Shaders"
        - downloads all (no matter what for now) to your shaderpacks folder with settings .txt files too (must be specified in extras/extras.json on the server modpack)
    - added "Sync Settings"
        - simply downloads options.txt file to your instance
    - (currently no way to configure or upload these things except with access to the server unfortunately -- gui would take too much time right now in a non framework env xD)
- fixed random (newer) packs not being able to be read by the modpack syncer
    - (it was bc newer prism uses minecraft as the folder instead of .minecraft)
    - this is automatically moved back to .minecraft when opening the edit menu or downloading a new pack
- added Sync Settings to be called to auto download the options.txt file if available when downloading a new pack
- renamed Get All Mod Info button to be "Fetch Mod Icons" to be more user friendly (decided keep this not running by default since it could be expensive)
- fixed publishing modpacks to work again
- fixed publishing modpacks that were NeoForge or Quilt didn't work and would fail every time
- fixed uploading mods to published modpack didn't work or didn't always work
- fixed uploading mods to published modpack's progress bar didn't update during the process
- when publishing a modpack and it succeeds, added an optional message dialog box that comes up and asks if you'd like to go ahead and upload the mods too then (so you don't have to go straight to Edit->Mods->MoreOptions->Upload)
- probably some other little things too

# 7/25/26 -- 0.32.4
todo:
- auto add custom servers -- doesn't seem to be possible for some reason, copying over the servers.dat file doesn't work, and opening the .dat seems too hard for right now
- set RAM amount -- added but prism seems to override it every time somehow

done:
- want to add some specific sync configs -- *done*
- want to add specific distant horizons distance one to force a specific distance (64 chunks) -- *done*
- be able to update mod loader version -- *done*
- fix downloading mods silently fail (hopefully fixed now, added delay with 3 times auto retry)

# 7/29/26 -- 0.32.5
- fixed shader packs being able to download on initial pack download
- added modpack download screen to sort based on name, and if a date property is on the pack meta.json then sort by that with the newest first, otherwise alphabetical order
- added ability to update meta data of pack from remote meta data (like pack name) -- (disabled for now)
    - added desc to update at least
