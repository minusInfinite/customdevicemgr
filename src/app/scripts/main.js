const logger = require('./utils/logger.js')
/**
 * @returns {{initialize: Function, focus: Function, blur: Function, startup; Function, shutdown: Function}}
 */
geotab.addin.customdevicemgr = function (api, state, meta) {
  'use strict';
  const appName = 'customdevicemgr';
  const addinId = 'ajliNjUxOGEtZWQzMC1lOWF';



  /**@type {HTMLTableSectionElement}*/
  let elDeviceTableBody

  /**@type {HTMLDivElement} */
  let elNotice

  /** @type {Element} message */
  let noticeHandeler = message => {
    elNotice.innerText = message
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

  /** @param {Event} e */
  const updateStatusData = (e) => {

    /** @type {HTMLButtonElement} */
    const el = e.target
    const deviceId = el.id.split('-')[0]
    const deviceName = elAddin.querySelector(`#${deviceId}-name`)
    const odoInput = elAddin.querySelector(`#${deviceId}-odo`)
    const ehInput = elAddin.querySelector(`#${deviceId}-eh`)
    const emInput = elAddin.querySelector(`#${deviceId}-em`)
    const ehContainer = elAddin.querySelector(`#${deviceId}-es`)
    const currentOdo = odoInput.dataset.currentOdo
    const currentSeconds = ehContainer.dataset.currentSec
    const odoValueConvert = odoInput.value * 1000
    const ehValueConvert = 3600 * (ehInput.valueAsNumber + emInput.value / 60)

    console.log(currentOdo, currentSeconds)
    console.log('----')
    console.log(odoInput.value, ehInput.value, emInput.value, 3600 * (ehInput.valueAsNumber + emInput.value / 60))
    console.log(odoValueConvert, ehValueConvert)

    if (Math.round(currentOdo) === odoValueConvert && Math.round(currentSeconds) === ehValueConvert) {
      console.log(elNotice)
      noticeHandeler(`${deviceName.innerText} odometer and engine hours not updated`)
      return;
    } else {
      noticeHandeler(`${deviceName.innerText} - Odo: ${odoValueConvert} EngineHours: ${ehValueConvert}`)
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
        let esData = result[0][0].data ? result[0][0].data : 0,
          odoData = result[1][0].data ? result[1][0].data : 0,
          battData = result[2][0].data ? result[1][0].data : 0;

        resolve({ engineSeconds: esData, odometer: odoData, battery: !!+battData })
      }, reject)
    })
  }

  // the root container
  var elAddin = document.getElementById(appName);

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

      elDeviceTableBody = document.querySelector('.customdevicemgr-table__body')
      elNotice = elAddin.querySelector('#customdevicemgr-notice')

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
      elAddin.style.display = 'initial';
      // getting the current user to display in the UI

      // getting the current user to display in the UI
      freshApi.getSession(session => {
        elAddin.querySelector('#customdevicemgr-user').textContent = session.userName;
      });


      // show main content
      freshApi.call('Get', {
        typeName: 'Device',
        resultsLimit: 10,
        search: {
          fromDate: new Date().toISOString(),
          groups: freshState.getGroupFilter(),
          deviceType: 'CustomDevice'
        },
      }, async (devices) => {
        if (!devices || devices.length < 1) {
          return;
        }

        devices.sort(sortNameEntities)


        for (let i = 0; i < devices.length; i++) {
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
          let emContent = document.createElement('input')
          let submitCell = newRow.insertCell()
          let submitButton = document.createElement('button')

          const { engineSeconds, odometer, battery } = await getStatusData(device.id)

          let engineHours = Math.round(engineSeconds / 3600)
          let engineMinutes = (m => Math.round(60 * m))(Math.abs(engineSeconds / 3600 - engineHours))

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
          battContent.classList.add('list-column-text')
          battContent.innerText = battery ? 'Low' : 'Good'
          battCell.appendChild(battContent)
          odoCell.classList.add('entities-list__row-cell', 'ellipsis')
          odoContent.classList.add('list-column-numeric', 'geotabFormEditField')
          odoContent.dataset.currentOdo = `${odometer}`
          odoContent.id = `${device.id}-odo`
          odoContent.type = 'number'
          odoContent.step = 0.01
          odoContent.value = (o => Math.round(o / 1e3))(odometer);
          odoCell.appendChild(odoContent)
          ehCell.classList.add('entities-list__row-cell', 'ellipsis')
          ehContent.classList.add('geotabFormEditField')
          ehContent.id = `${device.id}-eh`
          ehContent.type = 'number'
          ehContent.step = 1
          ehContent.value = engineHours
          emContent.classList.add('geotabFormEditField')
          emContent.id = `${device.id}-em`
          emContent.type = 'number'
          emContent.step = 1
          emContent.value = engineMinutes
          ehContainer.classList.add('list-column-numeric')
          ehContainer.id = `${device.id}-es`
          ehContainer.dataset.currentSec = `${engineSeconds}`
          ehContainer.appendChild(ehContent)
          ehContainer.appendChild(emContent)
          ehCell.appendChild(ehContainer)
          submitCell.classList.add('entities-list__row-cell', 'entities-list__row-cell--last', 'ellipsis')
          submitButton.classList.add('geo-button', 'geo-button--action')
          submitButton.id = `${device.id}-button`
          submitButton.addEventListener('click', updateStatusData)
          submitButton.innerText = 'Update'
          submitCell.appendChild(submitButton)
        }
      })
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

      for (let i = elDeviceTableBody.rows.length; i !== 0; i--) {
        elDeviceTableBody.deleteRow(-1)
      }
      elAddin.style.display = 'none'
    }
  };
};
