import { EventEmitter } from 'events'

class EventEmitterWithEmitAlias extends EventEmitter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public emitEvent(eventName: string | symbol, ...args: any[]): boolean {
    return super.emit(eventName, ...args)
  }
}

type PatchedEventEmitter = new () => {
  [P in Exclude<keyof EventEmitterWithEmitAlias, 'emit'>]: EventEmitterWithEmitAlias[P]
}

const PatchedEventEmitter: PatchedEventEmitter = EventEmitterWithEmitAlias

export default PatchedEventEmitter
