const config = require('../../config.json');
/**
 * Props item - Houses all the navbar items and submenu items
 */
const props = [
    
    
    
    {
        name: 'engine',
        labelText: {
            en:'Engine &amp; Maintenance'
        },
        hasSubmenu: true,
        submenuItems: [
                {
                    name: 'customdevicemgr',
                    labelText:config.items[0].menuName,
                }
            ]
        },
        
    
    
    
     
];

module.exports = props;