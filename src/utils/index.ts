export { default as PatchedEventEmitter } from './PatchedEventEmitter'
export { default as TaskQueue } from './TaskQueue'
export * from './Log'

export function makePipePath(path: string): string {
  const pipePrefix = '\\\\.\\pipe\\'

  return process.platform === 'win32' && !path.startsWith(pipePrefix)
    ? `${pipePrefix}${path.replace(/^\//, '').replace(/\//g, '-')}`
    : path
}

export function makeServerPath(host, port) {
  return `${host}${port ? `:${port}` : ''}`
}
