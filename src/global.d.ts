declare const __DEV__: boolean
/** 发布版构建时写入的标签，例如 v1.8.36-mlt.1，本地构建为空字符串 */
declare const __RELEASE_TAG__: string

declare module '*.vue' {
  const component: any
  export default component
}
