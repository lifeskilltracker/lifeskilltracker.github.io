
// this file is generated — do not edit it


/// <reference types="@sveltejs/kit" />

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module only includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/private';
 * 
 * console.log(ENVIRONMENT); // => "production"
 * console.log(PUBLIC_BASE_URL); // => throws error during build
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/private' {
	export const LESS_TERMCAP_se: string;
	export const MAIL: string;
	export const USER: string;
	export const LESS_TERMCAP_ue: string;
	export const AI_AGENT: string;
	export const CLAUDE_CODE_ENTRYPOINT: string;
	export const npm_config_user_agent: string;
	export const XDG_SEAT: string;
	export const GIT_EDITOR: string;
	export const SSH_AGENT_PID: string;
	export const XDG_SESSION_TYPE: string;
	export const BUN_INSTALL: string;
	export const npm_node_execpath: string;
	export const SHLVL: string;
	export const CLAUDE_CODE_MESSAGING_TOKEN: string;
	export const npm_config_noproxy: string;
	export const HOME: string;
	export const OLDPWD: string;
	export const DESKTOP_SESSION: string;
	export const NVM_BIN: string;
	export const npm_package_json: string;
	export const NVM_INC: string;
	export const npm_package_engines_node: string;
	export const GTK_MODULES: string;
	export const XDG_SEAT_PATH: string;
	export const PAGER: string;
	export const __SQZ_CMD: string;
	export const LESS_TERMCAP_so: string;
	export const CLAUDE_CODE_CHILD_SESSION: string;
	export const npm_config_userconfig: string;
	export const npm_config_local_prefix: string;
	export const DBUS_SESSION_BUS_ADDRESS: string;
	export const COLORTERM: string;
	export const QSYS_ROOTDIR: string;
	export const COLOR: string;
	export const NVM_DIR: string;
	export const GTK_IM_MODULE: string;
	export const LOGNAME: string;
	export const LESS_TERMCAP_us: string;
	export const SALT_LICENSE_FILE: string;
	export const _: string;
	export const npm_config_prefix: string;
	export const npm_config_npm_version: string;
	export const XDG_SESSION_CLASS: string;
	export const XDG_SESSION_ID: string;
	export const TERM: string;
	export const npm_config_cache: string;
	export const npm_config_node_gyp: string;
	export const PATH: string;
	export const GTK3_MODULES: string;
	export const FINNHUB_API_KEY: string;
	export const NODE: string;
	export const npm_package_name: string;
	export const GNOME_TERMINAL_SCREEN: string;
	export const XDG_SESSION_PATH: string;
	export const XDG_RUNTIME_DIR: string;
	export const COREPACK_ENABLE_AUTO_PIN: string;
	export const DISPLAY: string;
	export const CLAUDE_EFFORT: string;
	export const XDG_CURRENT_DESKTOP: string;
	export const LANG: string;
	export const API_BASE_URL: string;
	export const NoDefaultCurrentDirectoryInExePath: string;
	export const CLAUDE_PID: string;
	export const XDG_SESSION_DESKTOP: string;
	export const GNOME_TERMINAL_SERVICE: string;
	export const XMODIFIERS: string;
	export const XAUTHORITY: string;
	export const LS_COLORS: string;
	export const npm_lifecycle_script: string;
	export const SSH_AUTH_SOCK: string;
	export const XDG_GREETER_DATA_DIR: string;
	export const SHELL: string;
	export const npm_lifecycle_event: string;
	export const QT_ACCESSIBILITY: string;
	export const GDMSESSION: string;
	export const TT_CLIENT_ID: string;
	export const TT_REFRESH: string;
	export const CLAUDE_CODE_SESSION_ID: string;
	export const LESS_TERMCAP_mb: string;
	export const CLAUDECODE: string;
	export const GPG_AGENT_INFO: string;
	export const QT_IM_MODULE: string;
	export const XDG_VTNR: string;
	export const LESS_TERMCAP_md: string;
	export const npm_config_globalconfig: string;
	export const npm_config_init_module: string;
	export const PWD: string;
	export const LESS_TERMCAP_me: string;
	export const TT_SECRET: string;
	export const npm_execpath: string;
	export const XDG_DATA_DIRS: string;
	export const CLUTTER_IM_MODULE: string;
	export const NVM_CD_FLAGS: string;
	export const CLAUDE_CODE_EXECPATH: string;
	export const npm_config_global_prefix: string;
	export const npm_command: string;
	export const I3SOCK: string;
	export const VTE_VERSION: string;
	export const EDITOR: string;
	export const CLAUDE_CODE_MESSAGING_SOCKET: string;
	export const INIT_CWD: string;
	export const TEST: string;
	export const VITEST: string;
	export const NODE_ENV: string;
	export const PROD: string;
	export const DEV: string;
	export const BASE_URL: string;
	export const MODE: string;
}

/**
 * This module provides access to environment variables that are injected _statically_ into your bundle at build time and are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Static environment variables are [loaded by Vite](https://vitejs.dev/guide/env-and-mode.html#env-files) from `.env` files and `process.env` at build time and then statically injected into your bundle at build time, enabling optimisations like dead code elimination.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * For example, given the following build time environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { ENVIRONMENT, PUBLIC_BASE_URL } from '$env/static/public';
 * 
 * console.log(ENVIRONMENT); // => throws error during build
 * console.log(PUBLIC_BASE_URL); // => "http://site.com"
 * ```
 * 
 * The above values will be the same _even if_ different values for `ENVIRONMENT` or `PUBLIC_BASE_URL` are set at runtime, as they are statically replaced in your code with their build time values.
 */
declare module '$env/static/public' {
	
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are limited to _private_ access.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Private_ access:**
 * 
 * - This module cannot be imported into client-side code
 * - This module includes variables that _do not_ begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) _and do_ start with [`config.kit.env.privatePrefix`](https://svelte.dev/docs/kit/configuration#env) (if configured)
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://site.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/private';
 * 
 * console.log(env.ENVIRONMENT); // => "production"
 * console.log(env.PUBLIC_BASE_URL); // => undefined
 * ```
 */
declare module '$env/dynamic/private' {
	export const env: {
		LESS_TERMCAP_se: string;
		MAIL: string;
		USER: string;
		LESS_TERMCAP_ue: string;
		AI_AGENT: string;
		CLAUDE_CODE_ENTRYPOINT: string;
		npm_config_user_agent: string;
		XDG_SEAT: string;
		GIT_EDITOR: string;
		SSH_AGENT_PID: string;
		XDG_SESSION_TYPE: string;
		BUN_INSTALL: string;
		npm_node_execpath: string;
		SHLVL: string;
		CLAUDE_CODE_MESSAGING_TOKEN: string;
		npm_config_noproxy: string;
		HOME: string;
		OLDPWD: string;
		DESKTOP_SESSION: string;
		NVM_BIN: string;
		npm_package_json: string;
		NVM_INC: string;
		npm_package_engines_node: string;
		GTK_MODULES: string;
		XDG_SEAT_PATH: string;
		PAGER: string;
		__SQZ_CMD: string;
		LESS_TERMCAP_so: string;
		CLAUDE_CODE_CHILD_SESSION: string;
		npm_config_userconfig: string;
		npm_config_local_prefix: string;
		DBUS_SESSION_BUS_ADDRESS: string;
		COLORTERM: string;
		QSYS_ROOTDIR: string;
		COLOR: string;
		NVM_DIR: string;
		GTK_IM_MODULE: string;
		LOGNAME: string;
		LESS_TERMCAP_us: string;
		SALT_LICENSE_FILE: string;
		_: string;
		npm_config_prefix: string;
		npm_config_npm_version: string;
		XDG_SESSION_CLASS: string;
		XDG_SESSION_ID: string;
		TERM: string;
		npm_config_cache: string;
		npm_config_node_gyp: string;
		PATH: string;
		GTK3_MODULES: string;
		FINNHUB_API_KEY: string;
		NODE: string;
		npm_package_name: string;
		GNOME_TERMINAL_SCREEN: string;
		XDG_SESSION_PATH: string;
		XDG_RUNTIME_DIR: string;
		COREPACK_ENABLE_AUTO_PIN: string;
		DISPLAY: string;
		CLAUDE_EFFORT: string;
		XDG_CURRENT_DESKTOP: string;
		LANG: string;
		API_BASE_URL: string;
		NoDefaultCurrentDirectoryInExePath: string;
		CLAUDE_PID: string;
		XDG_SESSION_DESKTOP: string;
		GNOME_TERMINAL_SERVICE: string;
		XMODIFIERS: string;
		XAUTHORITY: string;
		LS_COLORS: string;
		npm_lifecycle_script: string;
		SSH_AUTH_SOCK: string;
		XDG_GREETER_DATA_DIR: string;
		SHELL: string;
		npm_lifecycle_event: string;
		QT_ACCESSIBILITY: string;
		GDMSESSION: string;
		TT_CLIENT_ID: string;
		TT_REFRESH: string;
		CLAUDE_CODE_SESSION_ID: string;
		LESS_TERMCAP_mb: string;
		CLAUDECODE: string;
		GPG_AGENT_INFO: string;
		QT_IM_MODULE: string;
		XDG_VTNR: string;
		LESS_TERMCAP_md: string;
		npm_config_globalconfig: string;
		npm_config_init_module: string;
		PWD: string;
		LESS_TERMCAP_me: string;
		TT_SECRET: string;
		npm_execpath: string;
		XDG_DATA_DIRS: string;
		CLUTTER_IM_MODULE: string;
		NVM_CD_FLAGS: string;
		CLAUDE_CODE_EXECPATH: string;
		npm_config_global_prefix: string;
		npm_command: string;
		I3SOCK: string;
		VTE_VERSION: string;
		EDITOR: string;
		CLAUDE_CODE_MESSAGING_SOCKET: string;
		INIT_CWD: string;
		TEST: string;
		VITEST: string;
		NODE_ENV: string;
		PROD: string;
		DEV: string;
		BASE_URL: string;
		MODE: string;
		[key: `PUBLIC_${string}`]: undefined;
		[key: `${string}`]: string | undefined;
	}
}

/**
 * This module provides access to environment variables set _dynamically_ at runtime and that are _publicly_ accessible.
 * 
 * |         | Runtime                                                                    | Build time                                                               |
 * | ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
 * | Private | [`$env/dynamic/private`](https://svelte.dev/docs/kit/$env-dynamic-private) | [`$env/static/private`](https://svelte.dev/docs/kit/$env-static-private) |
 * | Public  | [`$env/dynamic/public`](https://svelte.dev/docs/kit/$env-dynamic-public)   | [`$env/static/public`](https://svelte.dev/docs/kit/$env-static-public)   |
 * 
 * Dynamic environment variables are defined by the platform you're running on. For example if you're using [`adapter-node`](https://github.com/sveltejs/kit/tree/main/packages/adapter-node) (or running [`vite preview`](https://svelte.dev/docs/kit/cli)), this is equivalent to `process.env`.
 * 
 * **_Public_ access:**
 * 
 * - This module _can_ be imported into client-side code
 * - **Only** variables that begin with [`config.kit.env.publicPrefix`](https://svelte.dev/docs/kit/configuration#env) (which defaults to `PUBLIC_`) are included
 * 
 * > [!NOTE] In `dev`, `$env/dynamic` includes environment variables from `.env`. In `prod`, this behavior will depend on your adapter.
 * 
 * > [!NOTE] To get correct types, environment variables referenced in your code should be declared (for example in an `.env` file), even if they don't have a value until the app is deployed:
 * >
 * > ```env
 * > MY_FEATURE_FLAG=
 * > ```
 * >
 * > You can override `.env` values from the command line like so:
 * >
 * > ```sh
 * > MY_FEATURE_FLAG="enabled" npm run dev
 * > ```
 * 
 * For example, given the following runtime environment:
 * 
 * ```env
 * ENVIRONMENT=production
 * PUBLIC_BASE_URL=http://example.com
 * ```
 * 
 * With the default `publicPrefix` and `privatePrefix`:
 * 
 * ```ts
 * import { env } from '$env/dynamic/public';
 * console.log(env.ENVIRONMENT); // => undefined, not public
 * console.log(env.PUBLIC_BASE_URL); // => "http://example.com"
 * ```
 * 
 * ```
 * 
 * ```
 */
declare module '$env/dynamic/public' {
	export const env: {
		[key: `PUBLIC_${string}`]: string | undefined;
	}
}
