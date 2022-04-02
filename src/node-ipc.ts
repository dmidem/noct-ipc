import IPC from './IPC'

class IPCModule extends IPC {
  readonly IPC = IPC
}

export = new IPCModule()
