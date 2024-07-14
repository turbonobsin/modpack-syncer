## To get forge, fabric, mc info:
- https://meta.fabricmc.net/v2/versions/game
- https://files.minecraftforge.net/maven/net/minecraftforge/forge/json (doesn't work)
- https://launchermeta.mojang.com/mc/game/version_manifest.json

### Information like download links to client and server jars (this file is in the version_manifest.json)
- https://piston-meta.mojang.com/v1/packages/177e49d3233cb6eac42f0495c0a48e719870c2ae/1.21.json
- Important properties:
    - downloads
    - javaVersion
    - libraries?
    - assetIndex?
    - arguments

- prism launcher CLI: https://prismlauncher.org/wiki/getting-started/command-line-interface/

## looking for mod info
- inside mods like Ad Astra's .jar file, then inside META_INF, then mods.toml, there is display name, author, description, and dependency (with versions) information
    - I could flag mods in the list that don't meet the dependency requirements
- in the assets folder 