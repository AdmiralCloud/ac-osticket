const _ = require('lodash')
const axios = require('axios')

const ackeylock = require('ac-keylock')
const sanitizer = require('ac-sanitizer')

class OSTicket {

  constructor(params) {
    this.baseURL = _.get(params, 'baseURL') || 'https://osticket.com/'
    this.headers = {
      'x-api-key': _.get(params, 'apiKey') || 'abc-123'
    }
    if (_.get(params, 'apiSecret')) {
      _.set(this.headers, 'x-api-auth', _.get(params, 'apiSecret'))
    }
    if (_.has(params, 'debugMode')) {
      this.debugMode = _.get(params, 'debugMode')
    }
  }

  async init({ keylock, debugMode } =  {}) {
    if (!_.isNil(debugMode)) {
      this.debugMode = debugMode
    }
    await ackeylock.init(keylock)
  }

  async apiCall({ method = 'post', url = '/api/tickets.json', headers, data, debug }) {
    let apiParams = {
      method,
      baseURL: this.baseURL,
      url,
      headers: headers || this.headers,
      data
    }

    if (this.debugMode || debug) {
      const ticketId = Math.floor(Math.random() * 100000)
      const payload =  _.pick(apiParams, ['method', 'baseURL', 'url', 'data'])
      return { ticketId, payload, debugMode: true }
    }

    try {
      const apiResponse = await axios(apiParams)
      const response = {
        ticketId: _.get(apiResponse, 'data')
      }
      // for test mode
      if (_.get(apiResponse, 'headers.x-ac-payloadhash')) {
        _.set(response, 'hash', _.get(apiResponse, 'headers.x-ac-payloadhash'))
      }
      return response
    }
    catch(e) {
      console.log('OSTICKET | Payload | %j', _.pick(apiParams, ['baseURL', 'url', 'data']))
      console.log('OSTICKET | Error | %s | %j', _.get(e, 'code'), _.get(e, 'message'))
      return { code: _.get(e, 'code'), message: _.get(e, 'message') }
    }
  }

  async createTicket(data, options) {
    let fields = [
      { field: 'email', type: 'email', required: true },
      { field: 'name', type: 'string', required: true },
      { field: 'subject', type: 'string', required: true },
      { field: 'message', type: 'string', required: true },
      { field: 'topicId', type: 'integer' },
      { field: 'payloadCheck', type: 'boolean' },
    ]
    if (_.size(_.get(options, 'fieldsToCheck'))) {
      fields = _.concat(fields, _.get(options, 'fieldsToCheck'))
    }

    let fieldsToCheck = {
      params: data,
      fields
    }
    let check = sanitizer.checkAndSanitizeValues(fieldsToCheck)
    if (_.get(check, 'error')) return _.get(check, 'error')
    else data = _.get(check, 'params')

    let apiParams = {
      data,
      debug: _.get(options, 'debug')
    }
    
    if (!_.get(options, 'key')) {
      return await this.apiCall(apiParams)
    }
    else {
      const lockParams = {
        key: _.get(options, 'key'),
        value: _.get(options, 'value'),
        expires: _.get(options, 'expires')
      }
      let lock = await ackeylock.lockKey(lockParams)
      if (_.has(lock, 'status')) return { status: _.get(lock, 'status') }
      return await this.apiCall(apiParams)
    }
  }

}

module.exports = { OSTicket }