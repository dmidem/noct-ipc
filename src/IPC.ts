import Config from './Config'
import { Client, makeClient } from './Client'
import { Server, UDPType, makeServer } from './Server'
import { log } from './utils'

export { UDPType }
export type Callback = () => void

/* eslint-disable node/no-callback-literal */

export default class IPC {
  public config: Config = new Config()

  public of: Record<string, Client> = {}
  public server: Server | undefined = undefined

  private validateId(id) {
    if (!id) {
      this.log(
        'Requested service connection without specifying service id - aborting connection attempt'
      )
    }
    return id
  }

  private validatePath(path) {
    if (!path) {
      path = this.config.socketRoot + this.config.appspace + this.config.id
      this.log(
        'Service path not specified, so defaulting to socketRoot + appspace + id from ipc.config:',
        path
      )
    }
    return path
  }

  private validateHost(host) {
    if (!host) {
      host = this.config.networkHost
      this.log('Server host not specified, so defaulting to ipc.config.networkHost:', host)
    }
    return host
  }

  private validatePort(port) {
    if (!port) {
      port = this.config.networkPort
      this.log('Server port not specified, so defaulting to ipc.config.networkPort:', port)
    }
    return port
  }

  private setupClient(id, callback, path, port?) {
    if (this.of[id]?.isConnected()) {
      this.log('Already connected to', id, ', so executing success without connection')
    } else {
      this.of[id] = makeClient(this.config, id, path, port).connect()
    }

    callback?.()
  }

  private setupServer(callback, path, port?, udpType?) {
    this.server = makeServer(this.config, path, port, udpType)
    callback && this.server.on('start', callback)
  }

  public log(...args) {
    log(this.config, ...args)
  }

  public disconnect(id) {
    if (this.of[id]) {
      this.of[id].disconnect()
      delete this.of[id]
    }
  }

  public connectTo(id, ...args: [string, Callback] | [Callback]) {
    const [path, callback] = typeof args[0] === 'function' ? [undefined, args[0]] : args

    this.validateId(id) && this.setupClient(id, callback, this.validatePath(path))
  }

  public connectToNet(
    id,
    ...args: [string, number, Callback] | [number, Callback] | [string, Callback] | [Callback]
  ) {
    const [host, port, callback] =
      typeof args[0] === 'number'
        ? [undefined, args[0], args[1]]
        : typeof args[1] === 'function'
        ? [args[0], undefined, args[1]]
        : typeof args[0] === 'function'
        ? [undefined, undefined, args[0]]
        : args

    this.validateId(id) &&
      this.setupClient(id, callback, this.validateHost(host), this.validatePort(port))
  }

  public serve(...args: [string, Callback] | [Callback]) {
    const [callback, path] = typeof args[0] === 'function' ? [args[0], undefined] : args

    this.setupServer(callback, this.validatePath(path))
  }

  public serveNet(
    ...args:
      | [number, string, Callback]
      | [Callback]
      | [string, Callback]
      | [string, string, Callback]
      | [string, Callback]
      | [string, number, Callback]
      | [string, number, string, Callback]
  ) {
    const [host, port, udpType, callback] =
      typeof args[0] === 'number'
        ? [undefined, args[0], args[1], args[2]]
        : typeof args[0] === 'function'
        ? [undefined, undefined, undefined, args[0]]
        : typeof args[0] === 'string' &&
          (args[0].toLowerCase() === 'udp4' || args[0].toLowerCase() === 'udp6')
        ? [this.config.networkHost, undefined, args[0].toLowerCase(), args[1]]
        : typeof args[1] === 'string'
        ? [args[0], undefined, args[1], args[2]]
        : typeof args[1] === 'function'
        ? [args[0], undefined, undefined, args[1]]
        : typeof args[2] === 'function'
        ? [args[0], args[1], undefined, args[2]]
        : args

    this.setupServer(callback, this.validateHost(host), this.validatePort(port), udpType)
  }
}
