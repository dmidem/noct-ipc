export type Task = () => void

export default class TaskQueue {
  private tasks: Task[] = []
  private running = false

  public stop = false

  public clear() {
    this.running = false
    this.tasks = []
    return this.tasks
  }

  public add(...tasks: Task[]) {
    this.tasks.push(...tasks)

    if (!this.running && !this.stop) {
      this.next()
    }
  }

  public next() {
    if (this.tasks.length < 1 || this.stop) {
      this.running = false
    } else {
      this.running = true
      this.tasks.shift()?.()
    }
  }
}
