import fs from 'fs'

import Config from '../Config'

import { EventType, RawData, Message, DataObject, MessageData, makeRawBuffer } from '../Message'

import { PatchedEventEmitter, log } from '../utils'

interface BaseSocketServer {
  close(): void
}

export interface IPCServer<ClientSocket> {
  stop(): void
  start(): void
  emit(
    socket: ClientSocket | string | symbol,
    typeOrRawData: EventType | RawData,
    data?: DataObject
  ): void
  broadcast(typeOrRawData: EventType | RawData, data): void
}

/*
interface BaseClientSocket<Socket> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on<Socket>(eventName: EventType, listener: (...args: any[]) => void): Socket
}
*/

export default abstract class BaseServer<ClientSocket, SocketServer extends BaseSocketServer>
  extends PatchedEventEmitter
  implements IPCServer<ClientSocket>
{
  protected config: Config
  protected path: string
  protected port: number | undefined

  protected server: SocketServer | undefined = undefined

  protected log(...args): void {
    log(this.config, ...args)
  }

  protected abstract parseSocketMessages(socket: ClientSocket, data: string): Message[] | undefined

  protected handleSocketData(socket: ClientSocket, data: MessageData): void {
    if (this.config.rawBuffer) {
      this.emitEvent('data', makeRawBuffer(data, this.config), socket)
      return
    }

    const messages = this.parseSocketMessages(socket, data.toString())
    if (!messages) {
      this.log('Messages are large, you may want to consider smaller messages')
      return
    }

    messages.forEach(({ type, data }) => {
      this.log('Received event of:', type, data)
      this.emitEvent(type, data, socket)
    })
  }

  protected setupSocket(socket) {
    return socket
      .on('close', socket => this.emitEvent('close', socket))
      .on('error', err => {
        this.log('server socket error', err)
        this.emitEvent('error', err)
      })
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected handleServerClose(): void {}

  protected handleServerBound(): void {
    this.emitEvent('start', this.server)
  }

  protected abstract startServer(): void

  constructor(config: Config, path: string, port?: number) {
    super()

    this.config = config
    this.path = path
    this.port = port

    this.on('close', this.handleServerClose.bind(this))
  }

  public stop(): void {
    this.server?.close()
  }

  public start(): void {
    if (!this.path) {
      this.log('Socket server path not specified - refusing to start')
      return
    }

    if (this.config.unlink) {
      fs.unlink(this.path, this.startServer.bind(this))
    } else {
      this.startServer()
    }
  }

  public emit(socket: ClientSocket, typeOrRawData: EventType | RawData, data?: DataObject): void {
    this.log('Dispatching event to socket:', typeOrRawData, data)
  }

  public abstract broadcast(typeOrRawData: EventType | RawData, data?: DataObject): void
}
