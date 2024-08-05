<!-- default loc -->
c:users/name/appdata/roaming/prismlauncher
c:users/name/appdata/local/programs/prismlauncher

<!-- marked folders for world sync -->
- data
- datapacks
- DIM1
- DIM-1
- dimensions
- entities
- integratedscripting
- poi
- region
<!-- maybe? -->
- serverconfig
- advancements
- stats

<!-- I can check if any instance is currently running by checking if .minecraft/logs/latest.log is openable or not -->

<!-- when to upload/download? -->
- upload
    - when local files are newer than (last sync time finish)

- download
    - when server files are newer than (last sync time finish)
    - (the reason for finish is because it will be newer than all the files changed then)