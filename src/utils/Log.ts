import util from 'util'

export interface LogConfig {
  silent: boolean
  logDepth: number
  logInColor: boolean
  logger: (string) => void
}

export function log(config: LogConfig, ...args) {
  if (!config.silent) {
    const inspectOptions = {
      depth: config.logDepth,
      colors: config.logInColor,
    }

    config.logger(
      args.map(arg => (typeof arg === 'object' ? util.inspect(arg, inspectOptions) : arg)).join(' ')
    )
  }
}

// export type Log = (...args) => void
