const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Client APIs
    getClients: () => ipcRenderer.invoke('db:getClients'),
    addClient: (client) => ipcRenderer.invoke('db:addClient', client),
    updateClient: (id, client) => ipcRenderer.invoke('db:updateClient', id, client),
    deleteClient: (id) => ipcRenderer.invoke('db:deleteClient', id),

    // Supplier APIs
    getSuppliers: () => ipcRenderer.invoke('db:getSuppliers'),
    addSupplier: (supplier) => ipcRenderer.invoke('db:addSupplier', supplier),
    updateSupplier: (id, supplier) => ipcRenderer.invoke('db:updateSupplier', id, supplier),
    deleteSupplier: (id) => ipcRenderer.invoke('db:deleteSupplier', id),

    // Supplier Invoices APIs
    getSupplierInvoices: () => ipcRenderer.invoke('db:getSupplierInvoices'),
    addSupplierInvoice: (invoice) => ipcRenderer.invoke('db:addSupplierInvoice', invoice),
    updateSupplierInvoice: (id, invoice) => ipcRenderer.invoke('db:updateSupplierInvoice', id, invoice),
    deleteSupplierInvoice: (id) => ipcRenderer.invoke('db:deleteSupplierInvoice', id),

    // Material APIs
    getMaterials: () => ipcRenderer.invoke('db:getMaterials'),
    addMaterial: (material) => ipcRenderer.invoke('db:addMaterial', material),
    updateMaterial: (id, material) => ipcRenderer.invoke('db:updateMaterial', id, material),
    deleteMaterial: (id) => ipcRenderer.invoke('db:deleteMaterial', id),

    // Order APIs
    getOrders: () => ipcRenderer.invoke('db:getOrders'),
    addOrder: (order) => ipcRenderer.invoke('db:addOrder', order),
    updateOrder: (id, order) => ipcRenderer.invoke('db:updateOrder', id, order),
    deleteOrder: (id) => ipcRenderer.invoke('db:deleteOrder', id),

    // Payment APIs
    getPayments: (orderId) => ipcRenderer.invoke('db:getPayments', orderId),
    addPayment: (payment) => ipcRenderer.invoke('db:addPayment', payment),
    updatePayment: (id, payment) => ipcRenderer.invoke('db:updatePayment', id, payment),
    deletePayment: (id) => ipcRenderer.invoke('db:deletePayment', id),

    // Expense APIs
    getExpenses: () => ipcRenderer.invoke('db:getExpenses'),
    addExpense: (expense) => ipcRenderer.invoke('db:addExpense', expense),
    deleteExpense: (id) => ipcRenderer.invoke('db:deleteExpense', id),

    // Supplier Payment APIs
    getSupplierPayments: (invoiceId) => ipcRenderer.invoke('db:getSupplierPayments', invoiceId),
    addSupplierPayment: (payment) => ipcRenderer.invoke('db:addSupplierPayment', payment),
    updateSupplierPayment: (id, payment) => ipcRenderer.invoke('db:updateSupplierPayment', id, payment),
    deleteSupplierPayment: (id) => ipcRenderer.invoke('db:deleteSupplierPayment', id),

    // Database tools
    exportDatabase: () => ipcRenderer.invoke('db:export'),
    importDatabase: () => ipcRenderer.invoke('db:import'),
    resetDatabase: () => ipcRenderer.invoke('db:reset')
});
