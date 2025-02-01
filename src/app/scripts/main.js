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
  let errorHandler = message => {
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

  /** @type {EventListener} */
  let updateStatusData = () => {

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

      }]], function (result) {
        let ehData = result[0][0].data ? result[0][0].data : 0,
          odoData = result[1][0].data ? result[1][0].data : 0;



        resolve({ engineHours: ehData, odometer: odoData })
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
      elNotice = elAddin.querySelector(`${appName}-notice`)

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
          let odoCell = newRow.insertCell()
          let odoContent = document.createElement('input')
          let ehCell = newRow.insertCell()
          let ehContent = document.createElement('input')
          let submitCell = newRow.insertCell()
          let submitButton = document.createElement('button')

          const { engineHours, odometer } = await getStatusData(device.id)

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
          assetCell.innerText = device.name
          snCell.classList.add('entities-list__row-cell', 'ellipsis')
          snContent.classList.add('list-column-text')
          snContent.innerText = device.serialNumber
          snCell.appendChild(snContent)
          odoCell.classList.add('entities-list__row-cell', 'ellipsis')
          odoContent.classList.add('list-column-numeric', 'geotabFormEditField')
          odoContent.dataset.currentOdo = `${odometer}`
          odoContent.id = `${device.id}-odo`
          odoContent.type = 'number'
          odoContent.value = Math.ceil(odometer / 1000)
          odoCell.appendChild(odoContent)
          ehCell.classList.add('entities-list__row-cell', 'ellipsis')
          ehContent.classList.add('list-column-numeric', 'geotabFormEditField')
          ehContent.id = `${device.id}-eh`
          ehContent.dataset.currentHours = `${engineHours}`
          ehContent.type = 'number'
          ehContent.value = Math.floor(engineHours / 60 / 60)
          ehCell.appendChild(ehContent)
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
