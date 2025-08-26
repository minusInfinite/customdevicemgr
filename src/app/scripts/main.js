

/**
 * @returns {{initialize: Function, focus: Function, blur: Function, startup; Function, shutdown: Function}}
 */
geotab.addin.customdevicemgr = function () {
  'use strict';

  /**@type {GeotabApi} api */
  let api
  let state
  let deviceIndex
  let nextIndex

  let devices

  /** @type{GeotabApi.Objects.CustomDevice[]]} */
  let storedDevices

  const appName = 'customdevicemgr';
  const addinId = 'ajliNjUxOGEtZWQzMC1lOWF';

  /**@type {HTMLDivElement} */
  let elAddin

  /**@type {HTMLTableElement} */
  let elDeviceTable

  /**@type {HTMLTableSectionElement}*/
  let elDeviceTableBody

  /**@type {HTMLDivElement} */
  let elNotice

  /**@type {HTMLProgressElement} */
  let elProgress

  /**@type {HTMLDivElement} */
  let elDeviceCount

  /**@type {HTMLButtonElement} */
  let elPrev

  /**@type {HTMLButtonElement} */
  let elNext

  /**@type {HTMLDivElement} */
  let elSearchContainer

  /**@type {HTMLInputElement} */
  let elSearch

  /**@type {HTMLButtonElement} */
  let elSearchButton

  /**@type {HTMLDataListElement} */
  let elSearchList

  /**
   * 
   * @param {{error: boolean,text: string}}  
   */
  let noticeHandeler = ({ error, text }) => {
    elNotice.dataset.alert = error ? 'error' : 'success'
    let p = document.createElement('p')
    p.innerText = text
    elNotice.appendChild(p)
    setTimeout(() => {
      elNotice.removeChild(p)
    }, 1000 * 15)
  }

  let progressHandeler = (value) => {
    elProgress.value = value.toString()
    elProgress.innerText = `${value} %`
  }

  let sortNameEntities = (a, b) => {
    a = a.name.toLowerCase()
    b = b.name.toLowerCase()
    if (a === b) {
      return 0;
    } else if (a > b) {
      return 1;
    } else {
      return -1;
    }
  }

  /**
   * Get All CustomDevices
   * @returns {Promise<GeotabApi.Objects.CustomDevice[]>}
   */
  function getCustomDevices() {
    return new Promise((resolve, reject) => {
      const allDevices = []
      const resultsLimit = nextIndex;
      const nowISO = (new Date).toISOString()
      let offset = null
      let lastId = null
      let userGroups = state?.getAdvancedGroupFilter()

      function fetchPage() {
        api.call('Get', {
          typeName: 'Device',
          resultsLimit: resultsLimit,
          search: {
            fromDate: nowISO,
            groupFilterCondition: Object.keys(userGroups).length === 0 ? undefined : userGroups.groupFilterConditions.length === 1 ? userGroups.groupFilterConditions[0] : userGroups,
            deviceType: 'CustomDevice'
          },
          sort: {
            sortBy: 'name',
            sortDirection: 'desc',
            offset: offset,
            lastId: lastId
          },
          propertySelector: {
            fields: ['name', 'id', 'serialNumber'],
            isIncluded: true
          }
        }, function (devices) {
          if (!devices || devices.length === 0) {
            resolve(allDevices)
            return;
          }

          allDevices.push(...devices)

          offset = devices[devices.length - 1].name
          lastId = devices[devices.length - 1].id

          fetchPage()
        }, function (error) {
          reject(error)
        })
      }

      fetchPage()
    })
  }

  /**
   * Save Device odometer 
   * @param {number} o odometer in meters
   * @param {string} d device id
   * @returns {Promise<boolean>}
   */
  function saveOdo(o, d) {
    return new Promise((resolve, reject) => {
      api.call('Add', {
        typeName: 'StatusData',
        entity: {
          data: o,
          dateTime: (new Date).toISOString(),
          device: {
            id: d
          },
          diagnostic: {
            id: 'DiagnosticOdometerAdjustmentId'
          }
        }
      }, function (r) {
        resolve(!(!!r))
      }, function (err) {
        reject(err)
      })
    })
  }

  /**
   * Save Device Engine Hours
   * @param {number} s engine hours in seconds
   * @param {string} d device id
   * @returns {Promise<boolean>}
   */
  function saveEh(s, d) {
    return new Promise((resolve, reject) => {
      api.call('Add', {
        typeName: 'StatusData',
        entity: {
          data: s,
          dateTime: (new Date).toISOString(),
          device: {
            id: d
          },
          diagnostic: {
            id: 'DiagnosticEngineHoursAdjustmentId'
          }
        }
      }, function (r) {
        resolve(!(!!r))
      }, function (err) {
        reject(err)
      })
    })
  }

  // data math utilities
  const parseOdometer = (o) => Math.round(Math.round(o / 1e3));
  const parseEngineHours = (s) => Math.round(s / 3600);
  const parseEngineMinutes = (s, h) => (m => Math.round(60 * m))(Math.abs(s / 3600 - h));
  const parseEngineSecs = (h, m) => 3600 * (h + m / 60);


  // data generation functions 
  /** @param {Event} e */
  const updateStatusData = (e) => {
    let alertText

    /** @type {HTMLButtonElement} */
    const el = e.target
    const deviceId = el.id.split('-')[0]
    const deviceName = elAddin.querySelector(`#${deviceId}-name`).innerText
    const odoInput = elAddin.querySelector(`#${deviceId}-odo`)
    const ehInput = elAddin.querySelector(`#${deviceId}-eh`)
    const emInput = elAddin.querySelector(`#${deviceId}-em`)
    const ehContainer = elAddin.querySelector(`#${deviceId}-es`)
    const initOdo = parseOdometer(odoInput.dataset.currentOdo)
    const initSeconds = parseFloat(ehContainer.dataset.currentSec)
    const currentHours = parseEngineHours(initSeconds)
    const currentMin = parseEngineMinutes(initSeconds, currentHours)
    const currentSeconds = parseEngineSecs(currentHours, currentMin)
    const odoValueConvert = odoInput.value * 1e3
    const ehValueConvert = parseEngineSecs(ehInput.valueAsNumber, emInput.valueAsNumber)

    if (currentSeconds === ehValueConvert && initOdo === odoInput.valueAsNumber) {
      alertText = `${deviceName} odometer and engine hours not updated`
      noticeHandeler({ error: false, text: alertText })
      return;
    }

    if (initOdo !== odoInput.valueAsNumber) {
      saveOdo(odoValueConvert, deviceId)
        .then(() => {
          alertText = `Updated Odometer for ${deviceName} to ${odoInput.value}`
          noticeHandeler({ error: false, text: alertText })
        }).catch(e => {
          alertText = `Error updating Odometer for ${deviceName}: ${e}`
          noticeHandeler({ error: true, text: alertText })
        });
    }

    if (currentSeconds !== ehValueConvert) {
      saveEh(ehValueConvert, deviceId).then(() => {
        noticeHandeler({ error: false, text: `Updated Engine Hours for ${deviceName} to ${ehInput.value}:${emInput.value}` })
      }).catch(e => noticeHandeler({ error: true, text: `Error updating Engine Hours for ${deviceName}: ${e}` }));
    }
  }

  let getStatusData = async (deviceId) => {
    const nowISO = new Date().toISOString()
    return new Promise((resolve, reject) => {
      api.multiCall([['Get', {
        typeName: 'StatusData',
        search: {
          'deviceSearch': {
            'id': deviceId
          },
          'diagnosticSearch': {
            'id': 'DiagnosticEngineHoursAdjustmentId'
          },
          'fromDate': nowISO,
          'toDate': nowISO
        }
      }], ['Get', {
        typeName: 'StatusData',
        search: {
          'deviceSearch': {
            'id': deviceId
          },
          'diagnosticSearch': {
            'id': 'DiagnosticOdometerAdjustmentId'
          },
          'fromDate': nowISO,
          'toDate': nowISO
        }

      }], ['Get', {
        typeName: 'StatusData',
        search: {
          'deviceSearch': {
            'id': deviceId
          },
          'diagnosticSearch': {
            'id': 'DiagnosticAux8Id'
          },
          'fromDate': nowISO,
          'toDate': nowISO
        }

      }]], function (result) {
        let esData = result[0][0].data ? result[0][0].data : 0
        let odoData = result[1][0].data ? result[1][0].data : 0
        let battData = result[2][0].data ? result[2][0].data : 0
        let battDate = result[2][0].dateTime ? result[2][0].dateTime : 0



        resolve({ engineSeconds: esData, odometer: odoData, battery: !!+battData, batteryDate: battDate })
      }, function (error) {
        reject(error)
      })
    })
  }

  async function updateTable() {
    try {
      elDeviceTableBody.style.cssText = 'opacity: 0;'
      elNotice.appendChild(elProgress)

      if (elDeviceTableBody.rows.length === nextIndex || elDeviceTableBody.rows.length > deviceIndex || elDeviceTableBody.rows.length == 1) {
        for (let i = elDeviceTableBody.rows.length; i !== 0; i--) {
          elDeviceTableBody.deleteRow(-1)
        }
      }

      elDeviceCount.innerText =
        `${deviceIndex + 1}-${devices.length === 1 ? devices.length : (deviceIndex + nextIndex) >= storedDevices.length ? storedDevices.length : deviceIndex + nextIndex
        } of ${storedDevices.length}`;

      for (let i = 0; i < devices.length; i++) {

        elProgress.dataset.loading = 'progress'
        progressHandeler(Math.round((i / devices.length) * 100))

        let device = devices[i]
        const newRow = elDeviceTableBody.insertRow()
        let assetCell = newRow.insertCell()
        let snCell = newRow.insertCell()
        let snContent = document.createElement('div')
        let battCell = newRow.insertCell()
        let battContent = document.createElement('div')
        let odoCell = newRow.insertCell()
        let odoContent = document.createElement('input')
        let ehCell = newRow.insertCell()
        let ehContainer = document.createElement('div')
        let ehContent = document.createElement('input')
        let ehspan = document.createElement('span')
        let emContent = document.createElement('input')
        let emspan = document.createElement('span')
        let submitCell = newRow.insertCell()
        let submitButton = document.createElement('button')

        const { engineSeconds, odometer, battery, batteryDate } = await getStatusData(device.id)

        let engineHours = parseEngineHours(engineSeconds)
        let engineMinutes = parseEngineMinutes(engineSeconds, engineHours)

        if (i === 0) {
          newRow.dataset.rowId = device.id
          newRow.classList.add('entities-list__row', 'entities-list__row--first')
        } else if (i > 0 && i < devices.length - 1) {
          newRow.dataset.rowId = device.id
          newRow.classList.add('entities-list__row',)
        } else {
          newRow.dataset.rowId = device.id
          newRow.classList.add('entities-list__row', 'entities-list__row-cell--last',)
        }

        assetCell.classList.add('entities-list__row-cell', 'entities-list__row-cell--first', 'inventory-main-column__name', 'ellipsis')
        assetCell.id = `${device.id}-name`
        assetCell.innerText = device.name
        snCell.classList.add('entities-list__row-cell', 'ellipsis')
        snContent.classList.add('list-column-text')
        snContent.innerText = device.serialNumber
        snCell.appendChild(snContent)
        battCell.classList.add('entities-list__row-cell', 'ellipsis')
        battContent.classList.add('list-column-text', 'batteryStatus')
        battContent.title = `Since: ${new Date(Date.parse(batteryDate)).toLocaleString()}`
        battContent.dataset.status = battery ? 'low' : 'good'
        battContent.innerHTML = `<p>${battery ? 'Low' : 'Good'}</p>`
        battCell.appendChild(battContent)
        odoCell.classList.add('entities-list__row-cell', 'ellipsis')
        odoContent.classList.add('list-column-numeric', 'geotabFormEditField', 'odometer-control__field-units')
        odoContent.dataset.currentOdo = `${odometer}`
        odoContent.id = `${device.id}-odo`
        odoContent.type = 'number'
        odoContent.step = 1
        odoContent.value = (o => Math.round(o / 1e3))(odometer);
        odoCell.appendChild(odoContent)
        ehCell.classList.add('entities-list__row-cell', 'ellipsis')
        ehContent.classList.add('engine-hours-control__field', 'engine-hours-control__hours', 'zenith-input', 'zenith-input--minimized', 'zenith-input-number')
        ehContent.id = `${device.id}-eh`
        ehContent.type = 'number'
        ehContent.step = 1
        ehContent.value = engineHours
        ehspan.classList.add('geo-form__description-text', 'zenith-form__field-units', 'zenith-form__field-units--capitalized')
        ehspan.innerText = 'hr'
        emContent.classList.add('engine-hours-control__field', 'engine-hours-control__minutes', 'zenith-input', 'zenith-input--minimized', 'zenith-input-number')
        emContent.id = `${device.id}-em`
        emContent.type = 'number'
        emContent.step = 1
        emContent.value = engineMinutes
        emspan.classList.add('geo-form__description-text', 'zenith-form__field-units', 'zenith-form__field-units--capitalized')
        emspan.innerText = 'min'
        ehContainer.classList.add('list-column-numeric')
        ehContainer.id = `${device.id}-es`
        ehContainer.dataset.currentSec = `${engineSeconds}`
        ehContainer.appendChild(ehContent)
        ehContainer.appendChild(ehspan)
        ehContainer.appendChild(emContent)
        ehContainer.appendChild(emspan)
        ehCell.appendChild(ehContainer)
        submitCell.classList.add('entities-list__row-cell', 'entities-list__row-cell--last', 'ellipsis')
        submitButton.classList.add('geo-button', 'geo-button--action')
        submitButton.id = `${device.id}-button`
        submitButton.addEventListener('click', updateStatusData)
        submitButton.innerText = 'Update'
        submitCell.appendChild(submitButton)
      }
    } catch (e) {
      noticeHandeler({ error: true, text: `Error on UpdateTable: ${e}` })
    } finally {
      elNotice.removeChild(elProgress)
      elDeviceTable.style.cssText = 'opacity: 1;'
      elDeviceTableBody.style.cssText = 'opacity: 1;'
    }
  }

  const nextHandeller = () => {
    if (nextIndex >= storedDevices.length) {
      return
    }
    deviceIndex += nextIndex
    devices = storedDevices.slice(deviceIndex, (nextIndex + deviceIndex))

    updateTable().catch(e => noticeHandeler({ error: true, text: `Get Next Error:${e}` }))
  }

  const prevHandeller = () => {
    if (deviceIndex === 0) {
      return
    }
    deviceIndex -= nextIndex
    devices = storedDevices.slice(deviceIndex, (nextIndex + deviceIndex))

    updateTable().catch(e => noticeHandeler({ error: true, text: `Get Prev Error:${e}` }))

  }

  const searchHandeller = () => {
    let selectDevice = elSearch.value
    let foundDevice = storedDevices.findIndex(d => d.name === selectDevice)
    if (foundDevice < 0 ?? selectDevice === '') {
      devices = storedDevices.slice(deviceIndex, (nextIndex + deviceIndex))
      updateTable().catch(e => noticeHandeler({ error: true, text: `Get Search Error:${e}` }))
      return;
    }

    devices = [storedDevices[foundDevice]]

    updateTable().catch(e => noticeHandeler({ error: true, text: `Get Search Error:${e}` }))
  }

  // the root container
  elAddin = document.getElementById(appName);


  return {

    /**
     * initialize() is called only once when the Add-In is first loaded. Use this function to initialize the
     * Add-In's state such as default values or make API requests (MyGeotab or external) to ensure interface
     * is ready for the user.
     * @param {GeotabApi} freshApi - The GeotabApi object for making calls to MyGeotab.
     * @param {Object} freshState - The page state object allows access to URL, page navigation and global group filter.
     * @param {function} initializeCallback - Call this when your initialize route is complete. Since your initialize routine
     *        might be doing asynchronous operations, you must call this method when the Add-In is ready
     *        for display to the user.
     */
    initialize: function (freshApi, freshState, initializeCallback) {
      api = freshApi;
      state = freshState;

      elDeviceTable = document.querySelector('.customdevicemgr-table')
      elDeviceTableBody = document.querySelector('.customdevicemgr-table__body')
      elNotice = document.querySelector('#customdevicemgr-notice')
      elDeviceCount = document.querySelector('.list-pagination__stats')
      elSearchContainer = document.querySelector('.geo-search-field')
      elSearch = document.querySelector('.geo-search-field input')
      elSearchButton = document.querySelector('.geo-search-field button')
      elPrev = document.querySelector('.list-pagination__previous')
      elNext = document.querySelector('.list-pagination__next')

      elSearchList = document.createElement('datalist')
      elProgress = document.createElement('progress')

      // Loading translations if available
      if (freshState.translate) {
        freshState.translate(elAddin || '');
      }


      // MUST call initializeCallback when done any setup
      initializeCallback();
    },

    /**
     * focus() is called whenever the Add-In receives focus.
     *
     * The first time the user clicks on the Add-In menu, initialize() will be called and when completed, focus().
     * focus() will be called again when the Add-In is revisited. Note that focus() will also be called whenever
     * the global state of the MyGeotab application changes, for example, if the user changes the global group
     * filter in the UI.
     *
     * @param {GeotabApi} freshApi - The GeotabApi object for making calls to MyGeotab.
     * @param {Object} freshState - The page state object allows access to URL, page navigation and global group filter.
    */
    focus: function (freshApi, freshState) {
      api = freshApi
      state = freshState
      deviceIndex = 0
      nextIndex = 15
      devices = []
      storedDevices = []

      elAddin.style.display = 'initial';

      (async () => {
        try {

          elProgress.max = '100'

          storedDevices = await getCustomDevices()
          devices = storedDevices.slice(deviceIndex, (nextIndex + deviceIndex))
          elSearchList.id = 'customDevicesList'

          for (let device of storedDevices) {
            let elOption = document.createElement('option')
            elOption.value = device.name
            elSearchList.appendChild(elOption)
          }

          elSearch.setAttribute('list', 'customDevicesList')
          elSearchContainer.appendChild(elSearchList)

          if (storedDevices.length > nextIndex) {
            elNext.disabled = false
            elPrev.disabled = false
          }

          elSearchButton.addEventListener('click', searchHandeller)

          elNext.addEventListener('click', nextHandeller)
          elPrev.addEventListener('click', prevHandeller)

          await updateTable()

        } catch (e) {
          noticeHandeler({ error: true, text: `Error on Focus: ${e}` })
        } finally {
          elDeviceTable.style.cssText = 'opacity: 1;'
          elDeviceTableBody.style.cssText = 'opacity: 1;'
        }
      })();
    },

    /**
     * blur() is called whenever the user navigates away from the Add-In.
     *
     * Use this function to save the page state or commit changes to a data store or release memory.
     *
     * @param {GeotabApi} freshApi - The GeotabApi object for making calls to MyGeotab.
     * @param {Object} freshState - The page state object allows access to URL, page navigation and global group filter.
    */
    blur: function () {
      elDeviceTableBody = elAddin.querySelector('.customdevicemgr-table__body')
      storedDevices = []
      devices = []

      for (let i = elDeviceTableBody.rows.length; i !== 0; i--) {
        elDeviceTableBody.deleteRow(-1)
      }
      elAddin.style.display = 'none'
    }
  };
};
