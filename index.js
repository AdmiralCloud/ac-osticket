const _ = require('lodash')
const axios = require('axios')

const keylock = require('ac-keylock')
const sanitizer = require('ac-sanitizer')

const osTicket = () => {

  // PRIVATE
  const apiBaseParams = {
    baseUrl: 'https://osticket.com/',
    headers: {
    //  'Content-Type': 'application/x-www-form-urlencoded',
      'x-api-key': 'abc-123',
    }
  }

  const apiCall = async function(params) {
    let apiParams = {
      method: _.get(params, 'method', 'post'),
      baseURL: _.get(apiBaseParams, 'baseUrl'),
      url: _.get(params, 'url', '/api/tickets.json'),
      headers: _.get(params, 'headers', _.get(apiBaseParams, 'headers')),
      data: _.get(params, 'data')
    }

    if (_.get(apiBaseParams, 'debugMode') || _.get(params, 'debug')) {
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


  // PUBLIC
  const init = async (params) => {
    _.set(apiBaseParams, 'baseUrl', _.get(params, 'baseUrl'))
    _.set(apiBaseParams, 'headers.x-api-key', _.get(params, 'apiKey'))
    if (_.get(params, 'apiSecret')) {
      _.set(apiBaseParams, 'headers.x-api-auth', _.get(params, 'apiSecret'))
    }
    if (_.has(params, 'debugMode')) {
      _.set(apiBaseParams, 'debugMode', _.get(params, 'debugMode'))
    }
    await keylock.init(_.get(params, 'keylock'))
  }
  
  const createTicket = async(data, options) => {
    let fields = [
      { field: 'email', type: 'email', required: true },
      { field: 'name', type: 'string', required: true },
      { field: 'subject', type: 'string', required: true },
      { field: 'message', type: 'string', required: true },
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
      return await apiCall(apiParams)
    }
    else {
      const lockParams = {
        key: _.get(options, 'key'),
        value: _.get(options, 'value'),
        expires: _.get(options, 'expires')
      }
      let lock = await keylock.lockKey(lockParams)
      if (_.has(lock, 'status')) return { status: _.get(lock, 'status') }
      return await apiCall(apiParams)
    }
  }

  return {
    init,
    createTicket
  }
}

module.exports = osTicket()



