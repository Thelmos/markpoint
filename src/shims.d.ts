declare module "markdown-it-texmath" {
  const plugin: (md: any, options?: any) => void;
  export default plugin;
}

declare module "markdown-it-task-lists" {
  const plugin: (md: any, options?: any) => void;
  export default plugin;
}

declare module "markdown-it-emoji" {
  export const full: (md: any, options?: any) => void;
  export const light: (md: any, options?: any) => void;
  export const bare: (md: any, options?: any) => void;
}
