// 本 fork 的发布标签是 v版本号-mlt.N，和上游的 v版本号 区分开，同一版本号也能多次发布
const FORK_TAG_SUFFIX = /-mlt\.\d+$/

/**
 * 判断 GitHub 上最新的 Release 是否比当前构建新。
 * 发布版的构建带有自己的标签，直接比较；本地构建没有标签，只比较版本号。
 */
export function isNewerRelease(latestTag: string, version: string, buildTag: string): boolean {
  if (buildTag)
    return latestTag !== buildTag
  return latestTag.replace(FORK_TAG_SUFFIX, '') !== `v${version}`
}
