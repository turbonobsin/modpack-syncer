import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import { pluginExposeRenderer } from './vite.base.config';
import { resolve } from "path";

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'renderer'>;
  const { root, mode, forgeConfigSelf } = forgeEnv;
  const name = forgeConfigSelf.name ?? '';

  return {
    root,
    mode,
    base: './',
    build: {
      outDir: `.vite/renderer/${name}`,
      rollupOptions:{
        input:{
          main_window:resolve(__dirname,"index.html"),
          add_rp_menu:resolve(__dirname,"src/menus/add_rp_menu.html"),
          add_world_menu:resolve(__dirname,"src/menus/add_world_menu.html"),
          edit_instance_menu:resolve(__dirname,"src/menus/edit_instance_menu.html"),
          input_menu:resolve(__dirname,"src/menus/input_menu.html"),
          prism_instances:resolve(__dirname,"src/menus/prism_instances.html"),
          search_packs:resolve(__dirname,"src/menus/search_packs.html"),
          update_progress_menu:resolve(__dirname,"src/menus/update_progress_menu.html"),
          view_instance:resolve(__dirname,"src/menus/view_instance.html")
        }
      }
    },
    plugins: [pluginExposeRenderer(name)],
    resolve: {
      preserveSymlinks: true,
    },
    clearScreen: false,
  } as UserConfig;
});
