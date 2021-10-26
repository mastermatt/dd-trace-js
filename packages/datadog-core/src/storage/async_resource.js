'use strict'

const { createHook, executionAsyncResource } = require('async_hooks')

class AsyncResourceStorage {
  constructor () {
    this._ddResourceStore = Symbol('ddResourceStore')
    this._enabled = false
    this._hook = this._createHook()
  }

  disable () {
    if (!this._enabled) return

    this._hook.disable()
    this._enabled = false
  }

  getStore () {
    if (!this._enabled) return

    const resource = this._executionAsyncResource()

    return resource[this._ddResourceStore]
  }

  enterWith (store) {
    this._enable()

    const resource = this._executionAsyncResource()

    resource[this._ddResourceStore] = store
  }

  run (store, callback, ...args) {
    this._enable()

    const resource = this._executionAsyncResource()
    const oldStore = resource[this._ddResourceStore]

    resource[this._ddResourceStore] = store

    try {
      return callback(...args)
    } finally {
      resource[this._ddResourceStore] = oldStore
    }
  }

  _createHook () {
    return createHook({
      init: this._init.bind(this)
    })
  }

  _enable () {
    if (this._enabled) return

    this._enabled = true
    this._hook.enable()
  }

  _init (asyncId, type, triggerAsyncId, resource) {
    const currentResource = this._executionAsyncResource()

    if (Object.prototype.hasOwnProperty.call(currentResource, this._ddResourceStore)) {
      resource[this._ddResourceStore] = currentResource[this._ddResourceStore]
    }
  }

  _executionAsyncResource () {
    return executionAsyncResource()
  }
}

module.exports = AsyncResourceStorage