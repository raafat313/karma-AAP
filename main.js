const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Realm = require('realm');

let mainWindow;
let realm;

// Realm Schemas
const ClientSchema = {
    name: 'Client',
    primaryKey: '_id',
    properties: {
        _id: 'string',
        name: 'string',
        phone: 'string',
        address: 'string?',
        createdAt: 'date'
    }
};

const SupplierSchema = {
    name: 'Supplier',
    primaryKey: '_id',
    properties: {
        _id: 'string',
        name: 'string',
        phone: 'string',
        address: 'string?',
        company: 'string?',
        createdAt: 'date'
    }
};

const MaterialSchema = {
    name: 'Material',
    primaryKey: '_id',
    properties: {
        _id: 'string',
        name: 'string',
        type: 'string', // Indoor or Outdoor
        stock: 'double', // Square meters or running meters
        costPrice: 'double',
        sellPrice: 'double',
        supplier: 'string?', // Name of the supplier
        createdAt: 'date'
    }
};

const OrderSchema = {
    name: 'Order',
    primaryKey: '_id',
    properties: {
        _id: 'string',
        orderNumber: 'string',
        client: 'string', // client's name or id
        printType: 'string', // Indoor or Outdoor
        materialName: 'string',
        width: 'double',
        height: 'double',
        quantity: 'int',
        totalArea: 'double',
        unitPrice: 'double',
        totalPrice: 'double',
        amountPaid: 'double',
        amountRemaining: 'double',
        status: 'string', // pending, in-progress, ready, delivered
        notes: 'string?',
        createdAt: 'date'
    }
};

const PaymentSchema = {
    name: 'Payment',
    primaryKey: '_id',
    properties: {
        _id: 'string',
        orderId: 'string',
        clientName: 'string',
        amount: 'double',
        date: 'string', // YYYY-MM-DD format
        notes: 'string?',
        createdAt: 'date'
    }
};

const SupplierPaymentSchema = {
    name: 'SupplierPayment',
    primaryKey: '_id',
    properties: {
        _id: 'string',
        invoiceId: 'string',
        supplierName: 'string',
        amount: 'double',
        date: 'string', // YYYY-MM-DD format
        notes: 'string?',
        createdAt: 'date'
    }
};

const ExpenseSchema = {
    name: 'Expense',
    primaryKey: '_id',
    properties: {
        _id: 'string',
        category: 'string',
        amount: 'double',
        description: 'string',
        date: 'string', // YYYY-MM-DD format
        createdAt: 'date'
    }
};

const SupplierInvoiceSchema = {
    name: 'SupplierInvoice',
    primaryKey: '_id',
    properties: {
        _id: 'string',
        invoiceNumber: 'string',
        supplierName: 'string',
        materialName: 'string',
        quantity: 'double',
        unitPrice: 'double',
        totalPrice: 'double',
        amountPaid: 'double',
        amountRemaining: 'double',
        paymentMethod: 'string', // cash, transfer, deferred
        notes: 'string?',
        date: 'string',
        createdAt: 'date'
    }
};

// Initialize Realm DB
function initDatabase() {
    try {
        const dbPath = path.join(app.getPath('userData'), 'karma_print_db.realm');
        realm = new Realm({
            path: dbPath,
            schema: [ClientSchema, SupplierSchema, MaterialSchema, OrderSchema, PaymentSchema, ExpenseSchema, SupplierInvoiceSchema, SupplierPaymentSchema],
            schemaVersion: 4,
            migration: (oldRealm, newRealm) => {
                if (oldRealm.schemaVersion < 2) {
                    // Realm Node.js handles addition of new models and optional fields automatically.
                }
            }
        });
        console.log('Realm DB Initialized at:', dbPath);
        
        // Seed default materials if database is empty
        if (realm.objects('Material').length === 0) {
            seedDefaultMaterials();
        }
    } catch (error) {
        console.error('Failed to initialize Realm DB:', error);
    }
}

// Seed default materials helper
function seedDefaultMaterials() {
    realm.write(() => {
        const defaults = [
            { _id: 'm1', name: 'بانر خارجي 440 جم (Banner)', type: 'Outdoor', stock: 350.0, costPrice: 4.5, sellPrice: 12.0, createdAt: new Date() },
            { _id: 'm2', name: 'فليكس مضيء خارجي (Flex)', type: 'Outdoor', stock: 200.0, costPrice: 7.0, sellPrice: 18.0, createdAt: new Date() },
            { _id: 'm3', name: 'فينيل لاصق خارجي (Vinyl)', type: 'Outdoor', stock: 150.0, costPrice: 6.0, sellPrice: 16.0, createdAt: new Date() },
            { _id: 'm4', name: 'ماش خارجي مخرم (Mesh)', type: 'Outdoor', stock: 100.0, costPrice: 8.0, sellPrice: 20.0, createdAt: new Date() },
            { _id: 'm5', name: 'ستيكر داخلي لامع (Sticker Indoor)', type: 'Indoor', stock: 180.0, costPrice: 5.5, sellPrice: 15.0, createdAt: new Date() },
            { _id: 'm6', name: 'ورق بوستر داخلي (Poster Paper)', type: 'Indoor', stock: 120.0, costPrice: 4.0, sellPrice: 10.0, createdAt: new Date() },
            { _id: 'm7', name: 'قماش لوحات كانفاس (Canvas)', type: 'Indoor', stock: 80.0, costPrice: 12.0, sellPrice: 30.0, createdAt: new Date() }
        ];
        
        for (const mat of defaults) {
            realm.create('Material', mat);
        }
    });
    console.log('Seeded default materials successfully.');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'نظام إدارة مطبعة كارما برنت',
        icon: path.join(__dirname, 'logo.png')
    });

    // Hide default menu bar for clean modern UI look (Apple style)
    mainWindow.setMenuBarVisibility(false);

    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Convert Realm Results to plain serializable JS objects
function toPlainObject(realmObject) {
    if (!realmObject) return null;
    return JSON.parse(JSON.stringify(realmObject));
}

// Setup IPC handlers
function registerIpcHandlers() {
    // Clients CRUD
    ipcMain.handle('db:getClients', () => {
        const clients = realm.objects('Client').sorted('createdAt', true);
        return toPlainObject(clients);
    });

    ipcMain.handle('db:addClient', (event, clientData) => {
        const name = (clientData.name || '').trim();
        const phone = (clientData.phone || '').trim();
        const address = (clientData.address || '').trim();

        if (!name) throw new Error('الاسم مطلوب لتسجيل العميل.');
        if (!phone) throw new Error('رقم الهاتف مطلوب لتسجيل العميل.');

        let newClient;
        realm.write(() => {
            // Check for duplicate name (case-insensitive)
            const duplicateName = realm.objects('Client').filtered('name ==[c] $0', name);
            if (duplicateName.length > 0) {
                throw new Error('اسم العميل مسجل بالفعل بالبرنامج.');
            }

            // Check for duplicate phone
            const duplicatePhone = realm.objects('Client').filtered('phone == $0', phone);
            if (duplicatePhone.length > 0) {
                throw new Error('رقم الهاتف هذا مسجل لعميل آخر بالفعل.');
            }

            newClient = realm.create('Client', {
                _id: Date.now().toString(),
                name: name,
                phone: phone,
                address: address,
                createdAt: new Date()
            });
        });
        return toPlainObject(newClient);
    });

    ipcMain.handle('db:updateClient', (event, id, clientData) => {
        const name = (clientData.name || '').trim();
        const phone = (clientData.phone || '').trim();
        const address = (clientData.address || '').trim();

        if (!name) throw new Error('الاسم مطلوب.');
        if (!phone) throw new Error('رقم الهاتف مطلوب.');

        let updated;
        realm.write(() => {
            const client = realm.objectForPrimaryKey('Client', id);
            if (client) {
                const oldName = client.name;
                const newName = name;

                // Check for duplicate name for other clients
                const duplicateName = realm.objects('Client').filtered('name ==[c] $0 && _id != $1', newName, id);
                if (duplicateName.length > 0) {
                    throw new Error('اسم العميل الجديد مسجل بالفعل لعميل آخر.');
                }

                // Check for duplicate phone for other clients
                const duplicatePhone = realm.objects('Client').filtered('phone == $0 && _id != $1', phone, id);
                if (duplicatePhone.length > 0) {
                    throw new Error('رقم الهاتف الجديد مسجل لعميل آخر بالفعل.');
                }

                client.name = newName;
                client.phone = phone;
                client.address = address;
                updated = client;

                // Cascade update orders if the client name changed
                if (oldName !== newName) {
                    const clientOrders = realm.objects('Order').filtered('client == $0', oldName);
                    for (const order of clientOrders) {
                        order.client = newName;
                    }
                }
            } else {
                throw new Error('العميل غير موجود.');
            }
        });
        return toPlainObject(updated);
    });

    ipcMain.handle('db:deleteClient', (event, id) => {
        realm.write(() => {
            const client = realm.objectForPrimaryKey('Client', id);
            if (client) {
                realm.delete(client);
            }
        });
        return { success: true };
    });

    // Materials CRUD
    ipcMain.handle('db:getMaterials', () => {
        const materials = realm.objects('Material').sorted('name', false);
        return toPlainObject(materials);
    });

    ipcMain.handle('db:addMaterial', (event, materialData) => {
        const name = (materialData.name || '').trim();
        const type = materialData.type;
        const stock = parseFloat(materialData.stock);
        const costPrice = parseFloat(materialData.costPrice);
        const sellPrice = parseFloat(materialData.sellPrice);
        const supplier = materialData.supplier ? materialData.supplier.trim() : null;

        if (!name) throw new Error('اسم الخامة مطلوب.');
        if (type !== 'Indoor' && type !== 'Outdoor') throw new Error('نوع الخامة غير صالح.');
        if (isNaN(stock) || stock < 0) throw new Error('الكمية يجب أن تكون رقماً أكبر من أو يساوي الصفر.');
        if (isNaN(costPrice) || costPrice <= 0) throw new Error('سعر التكلفة يجب أن يكون رقماً أكبر من الصفر.');
        if (isNaN(sellPrice) || sellPrice <= 0) throw new Error('سعر البيع يجب أن يكون رقماً أكبر من الصفر.');

        let newMaterial;
        realm.write(() => {
            // Check duplicate name
            const duplicate = realm.objects('Material').filtered('name ==[c] $0', name);
            if (duplicate.length > 0) {
                throw new Error('اسم الخامة مسجل بالفعل.');
            }

            newMaterial = realm.create('Material', {
                _id: Date.now().toString(),
                name: name,
                type: type,
                stock: stock,
                costPrice: costPrice,
                sellPrice: sellPrice,
                supplier: supplier,
                createdAt: new Date()
            });
        });
        return toPlainObject(newMaterial);
    });

    ipcMain.handle('db:updateMaterial', (event, id, materialData) => {
        const name = (materialData.name || '').trim();
        const type = materialData.type;
        const stock = parseFloat(materialData.stock);
        const costPrice = parseFloat(materialData.costPrice);
        const sellPrice = parseFloat(materialData.sellPrice);
        const supplier = materialData.supplier ? materialData.supplier.trim() : null;

        if (!name) throw new Error('اسم الخامة مطلوب.');
        if (type !== 'Indoor' && type !== 'Outdoor') throw new Error('نوع الخامة غير صالح.');
        if (isNaN(stock) || stock < 0) throw new Error('الكمية يجب أن تكون رقماً أكبر من أو يساوي الصفر.');
        if (isNaN(costPrice) || costPrice <= 0) throw new Error('سعر التكلفة يجب أن يكون رقماً أكبر من الصفر.');
        if (isNaN(sellPrice) || sellPrice <= 0) throw new Error('سعر البيع يجب أن يكون رقماً أكبر من الصفر.');

        let updated;
        realm.write(() => {
            const material = realm.objectForPrimaryKey('Material', id);
            if (material) {
                const oldName = material.name;
                const newName = name;

                // Check duplicate name for other materials
                const duplicate = realm.objects('Material').filtered('name ==[c] $0 && _id != $1', newName, id);
                if (duplicate.length > 0) {
                    throw new Error('اسم الخامة الجديد مسجل بالفعل لخامة أخرى.');
                }

                material.name = newName;
                material.type = type;
                material.stock = stock;
                material.costPrice = costPrice;
                material.sellPrice = sellPrice;
                material.supplier = supplier;
                updated = material;

                // Cascade update orders if the material name changed
                if (oldName !== newName) {
                    const materialOrders = realm.objects('Order').filtered('materialName == $0', oldName);
                    for (const order of materialOrders) {
                        order.materialName = newName;
                    }
                }
            } else {
                throw new Error('الخامة غير موجودة.');
            }
        });
        return toPlainObject(updated);
    });

    ipcMain.handle('db:deleteMaterial', (event, id) => {
        realm.write(() => {
            const material = realm.objectForPrimaryKey('Material', id);
            if (material) {
                realm.delete(material);
            }
        });
        return { success: true };
    });

    // Suppliers CRUD
    ipcMain.handle('db:getSuppliers', () => {
        const suppliers = realm.objects('Supplier').sorted('createdAt', true);
        return toPlainObject(suppliers);
    });

    ipcMain.handle('db:addSupplier', (event, supplierData) => {
        const name = (supplierData.name || '').trim();
        const phone = (supplierData.phone || '').trim();
        const address = (supplierData.address || '').trim();
        const company = (supplierData.company || '').trim();

        if (!name) throw new Error('الاسم مطلوب لتسجيل المورد.');
        if (!phone) throw new Error('رقم الهاتف مطلوب لتسجيل المورد.');

        let newSupplier;
        realm.write(() => {
            // Check for duplicate name
            const duplicateName = realm.objects('Supplier').filtered('name ==[c] $0', name);
            if (duplicateName.length > 0) {
                throw new Error('اسم المورد مسجل بالفعل بالبرنامج.');
            }

            // Check for duplicate phone
            const duplicatePhone = realm.objects('Supplier').filtered('phone == $0', phone);
            if (duplicatePhone.length > 0) {
                throw new Error('رقم الهاتف هذا مسجل لمورد آخر بالفعل.');
            }

            newSupplier = realm.create('Supplier', {
                _id: Date.now().toString(),
                name: name,
                phone: phone,
                address: address,
                company: company,
                createdAt: new Date()
            });
        });
        return toPlainObject(newSupplier);
    });

    ipcMain.handle('db:updateSupplier', (event, id, supplierData) => {
        const name = (supplierData.name || '').trim();
        const phone = (supplierData.phone || '').trim();
        const address = (supplierData.address || '').trim();
        const company = (supplierData.company || '').trim();

        if (!name) throw new Error('الاسم مطلوب.');
        if (!phone) throw new Error('رقم الهاتف مطلوب.');

        let updated;
        realm.write(() => {
            const supplier = realm.objectForPrimaryKey('Supplier', id);
            if (supplier) {
                const oldName = supplier.name;
                const newName = name;

                // Check duplicate name for other suppliers
                const duplicateName = realm.objects('Supplier').filtered('name ==[c] $0 && _id != $1', newName, id);
                if (duplicateName.length > 0) {
                    throw new Error('اسم المورد الجديد مسجل بالفعل لمورد آخر.');
                }

                // Check duplicate phone for other suppliers
                const duplicatePhone = realm.objects('Supplier').filtered('phone == $0 && _id != $1', phone, id);
                if (duplicatePhone.length > 0) {
                    throw new Error('رقم الهاتف الجديد مسجل لمورد آخر بالفعل.');
                }

                supplier.name = newName;
                supplier.phone = phone;
                supplier.address = address;
                supplier.company = company;
                updated = supplier;

                // Cascade update materials if the supplier name changed
                if (oldName !== newName) {
                    const supplierMaterials = realm.objects('Material').filtered('supplier == $0', oldName);
                    for (const mat of supplierMaterials) {
                        mat.supplier = newName;
                    }
                }
            } else {
                throw new Error('المورد غير موجود.');
            }
        });
        return toPlainObject(updated);
    });

    ipcMain.handle('db:deleteSupplier', (event, id) => {
        realm.write(() => {
            const supplier = realm.objectForPrimaryKey('Supplier', id);
            if (supplier) {
                // Remove supplier reference from materials
                const supplierMaterials = realm.objects('Material').filtered('supplier == $0', supplier.name);
                for (const mat of supplierMaterials) {
                    mat.supplier = null;
                }
                realm.delete(supplier);
            }
        });
        return { success: true };
    });

    // Payments CRUD
    ipcMain.handle('db:getPayments', (event, orderId) => {
        let payments;
        if (orderId) {
            payments = realm.objects('Payment').filtered('orderId == $0', orderId).sorted('createdAt', true);
        } else {
            payments = realm.objects('Payment').sorted('createdAt', true);
        }
        return toPlainObject(payments);
    });

    ipcMain.handle('db:addPayment', (event, paymentData) => {
        const orderId = paymentData.orderId;
        const amount = parseFloat(paymentData.amount);
        const date = (paymentData.date || '').trim();
        const notes = (paymentData.notes || '').trim();

        if (!orderId) throw new Error('معرف الطلب مطلوب لتسجيل الدفعة.');
        if (isNaN(amount) || amount <= 0) throw new Error('مبلغ الدفعة يجب أن يكون رقماً أكبر من الصفر.');
        if (!date) throw new Error('التاريخ مطلوب.');

        let newPayment;
        realm.write(() => {
            const order = realm.objectForPrimaryKey('Order', orderId);
            if (!order) throw new Error('الطلب المرتبط بهذه الدفعة غير موجود.');

            newPayment = realm.create('Payment', {
                _id: Date.now().toString(),
                orderId: orderId,
                clientName: order.client,
                amount: amount,
                date: date,
                notes: notes,
                createdAt: new Date()
            });

            // Recalculate amountPaid and amountRemaining on the order
            const orderPayments = realm.objects('Payment').filtered('orderId == $0', orderId);
            const totalPaid = orderPayments.reduce((sum, p) => sum + p.amount, 0);
            order.amountPaid = totalPaid;
            order.amountRemaining = Math.max(0, order.totalPrice - totalPaid);
        });
        return toPlainObject(newPayment);
    });

    ipcMain.handle('db:updatePayment', (event, id, paymentData) => {
        const amount = parseFloat(paymentData.amount);
        const date = (paymentData.date || '').trim();
        const notes = (paymentData.notes || '').trim();

        if (isNaN(amount) || amount <= 0) throw new Error('مبلغ الدفعة يجب أن يكون رقماً أكبر من الصفر.');
        if (!date) throw new Error('التاريخ مطلوب.');

        let updated;
        realm.write(() => {
            const payment = realm.objectForPrimaryKey('Payment', id);
            if (payment) {
                payment.amount = amount;
                payment.date = date;
                payment.notes = notes;
                updated = payment;

                // Recalculate amountPaid and amountRemaining on the order
                const orderId = payment.orderId;
                const order = realm.objectForPrimaryKey('Order', orderId);
                if (order) {
                    const orderPayments = realm.objects('Payment').filtered('orderId == $0', orderId);
                    const totalPaid = orderPayments.reduce((sum, p) => sum + p.amount, 0);
                    order.amountPaid = totalPaid;
                    order.amountRemaining = Math.max(0, order.totalPrice - totalPaid);
                }
            } else {
                throw new Error('دفعة السداد غير موجودة.');
            }
        });
        return toPlainObject(updated);
    });

    ipcMain.handle('db:deletePayment', (event, id) => {
        realm.write(() => {
            const payment = realm.objectForPrimaryKey('Payment', id);
            if (payment) {
                const orderId = payment.orderId;
                realm.delete(payment);

                // Recalculate amountPaid and amountRemaining on the order
                const order = realm.objectForPrimaryKey('Order', orderId);
                if (order) {
                    const orderPayments = realm.objects('Payment').filtered('orderId == $0', orderId);
                    const totalPaid = orderPayments.reduce((sum, p) => sum + p.amount, 0);
                    order.amountPaid = totalPaid;
                    order.amountRemaining = Math.max(0, order.totalPrice - totalPaid);
                }
            }
        });
        return { success: true };
    });

    // Orders CRUD
    ipcMain.handle('db:getOrders', () => {
        const orders = realm.objects('Order').sorted('createdAt', true);
        return toPlainObject(orders);
    });

    ipcMain.handle('db:addOrder', (event, orderData) => {
        const client = (orderData.client || '').trim();
        const printType = orderData.printType;
        const materialName = (orderData.materialName || '').trim();
        const width = parseFloat(orderData.width);
        const height = parseFloat(orderData.height);
        const quantity = parseInt(orderData.quantity);
        const unitPrice = parseFloat(orderData.unitPrice);
        const amountPaid = parseFloat(orderData.amountPaid || 0);
        const status = orderData.status || 'pending';
        const notes = (orderData.notes || '').trim();

        if (!client) throw new Error('يجب اختيار عميل للطلب.');
        if (!materialName) throw new Error('يجب اختيار خامة للطلب.');
        if (printType !== 'Indoor' && printType !== 'Outdoor') throw new Error('نوع الطباعة غير صالح.');
        if (isNaN(width) || width <= 0) throw new Error('عرض العمل يجب أن يكون رقماً أكبر من الصفر.');
        if (isNaN(height) || height <= 0) throw new Error('ارتفاع العمل يجب أن يكون رقماً أكبر من الصفر.');
        if (isNaN(quantity) || quantity < 1) throw new Error('الكمية يجب أن تكون عدداً أكبر من أو يساوي 1.');
        if (isNaN(unitPrice) || unitPrice <= 0) throw new Error('سعر المتر مربع يجب أن يكون رقماً أكبر من الصفر.');
        if (isNaN(amountPaid) || amountPaid < 0) throw new Error('المبلغ المدفوع مقدماً يجب أن يكون رقماً أكبر من أو يساوي الصفر.');

        let newOrder;
        realm.write(() => {
            // Verify client exists
            const clientExists = realm.objects('Client').filtered('name ==[c] $0', client).length > 0;
            if (!clientExists) throw new Error('العميل المختار غير مسجل بقاعدة البيانات.');

            // Verify material exists
            const materialQuery = realm.objects('Material').filtered('name ==[c] $0', materialName);
            if (materialQuery.length === 0) throw new Error('الخامة المختارة غير مسجلة بقاعدة البيانات.');
            const mat = materialQuery[0];

            const totalArea = width * height * quantity;
            const totalPrice = totalArea * unitPrice;
            const amountRemaining = totalPrice - amountPaid;

            // Generate unique order number (prevent duplication)
            let orderNumber;
            let numberExists = true;
            while (numberExists) {
                const dateCode = new Date().toISOString().slice(2, 10).replace(/-/g, '');
                const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
                orderNumber = `KP-${dateCode}-${randomCode}`;
                numberExists = realm.objects('Order').filtered('orderNumber == $0', orderNumber).length > 0;
            }

            newOrder = realm.create('Order', {
                _id: Date.now().toString(),
                orderNumber: orderNumber,
                client: client,
                printType: printType,
                materialName: mat.name,
                width: width,
                height: height,
                quantity: quantity,
                totalArea: totalArea,
                unitPrice: unitPrice,
                totalPrice: totalPrice,
                amountPaid: amountPaid,
                amountRemaining: amountRemaining,
                status: status,
                notes: notes,
                createdAt: new Date()
            });

            // Create initial payment record if amountPaid > 0
            if (amountPaid > 0) {
                realm.create('Payment', {
                    _id: (Date.now() + 1).toString(),
                    orderId: newOrder._id,
                    clientName: client,
                    amount: amountPaid,
                    date: new Date().toISOString().slice(0, 10),
                    notes: 'دفعة مقدمة عند إنشاء الطلب',
                    createdAt: new Date()
                });
            }

            // Deduct stock of the material
            mat.stock = Math.max(0, mat.stock - totalArea);
        });
        return toPlainObject(newOrder);
    });

    ipcMain.handle('db:updateOrder', (event, id, orderData) => {
        const client = (orderData.client || '').trim();
        const printType = orderData.printType;
        const materialName = (orderData.materialName || '').trim();
        const width = parseFloat(orderData.width);
        const height = parseFloat(orderData.height);
        const quantity = parseInt(orderData.quantity);
        const unitPrice = parseFloat(orderData.unitPrice);
        const amountPaid = parseFloat(orderData.amountPaid || 0);
        const status = orderData.status;
        const notes = (orderData.notes || '').trim();

        if (!client) throw new Error('يجب اختيار عميل للطلب.');
        if (!materialName) throw new Error('يجب اختيار خامة للطلب.');
        if (printType !== 'Indoor' && printType !== 'Outdoor') throw new Error('نوع الطباعة غير صالح.');
        if (isNaN(width) || width <= 0) throw new Error('عرض العمل يجب أن يكون رقماً أكبر من الصفر.');
        if (isNaN(height) || height <= 0) throw new Error('ارتفاع العمل يجب أن يكون رقماً أكبر من الصفر.');
        if (isNaN(quantity) || quantity < 1) throw new Error('الكمية يجب أن تكون عدداً أكبر من أو يساوي 1.');
        if (isNaN(unitPrice) || unitPrice <= 0) throw new Error('سعر المتر مربع يجب أن يكون رقماً أكبر من الصفر.');
        if (isNaN(amountPaid) || amountPaid < 0) throw new Error('المبلغ المدفوع مقدماً يجب أن يكون رقماً أكبر من أو يساوي الصفر.');

        let updated;
        realm.write(() => {
            const order = realm.objectForPrimaryKey('Order', id);
            if (order) {
                // Verify client exists
                const clientExists = realm.objects('Client').filtered('name ==[c] $0', client).length > 0;
                if (!clientExists) throw new Error('العميل المختار غير مسجل بقاعدة البيانات.');

                // Verify new material exists
                const materialQuery = realm.objects('Material').filtered('name ==[c] $0', materialName);
                if (materialQuery.length === 0) throw new Error('الخامة المختارة غير مسجلة بقاعدة البيانات.');
                const newMat = materialQuery[0];

                const totalArea = width * height * quantity;
                const oldTotalArea = order.totalArea;
                const oldMaterialName = order.materialName;

                // Adjust stock deduction back and forth safely
                if (oldMaterialName === newMat.name) {
                    // Same material, adjust stock by difference
                    newMat.stock = Math.max(0, newMat.stock + oldTotalArea - totalArea);
                } else {
                    // Different material:
                    // 1. Restore stock of the old material
                    const oldMatQuery = realm.objects('Material').filtered('name == $0', oldMaterialName);
                    if (oldMatQuery.length > 0) {
                        const oldMat = oldMatQuery[0];
                        oldMat.stock = oldMat.stock + oldTotalArea;
                    }
                    // 2. Deduct stock from the new material
                    newMat.stock = Math.max(0, newMat.stock - totalArea);
                }

                // Cascade update client name in payments if the client name changed
                if (order.client !== client) {
                    const orderPayments = realm.objects('Payment').filtered('orderId == $0', id);
                    for (const payment of orderPayments) {
                        payment.clientName = client;
                    }
                }

                order.client = client;
                order.printType = printType;
                order.materialName = newMat.name;
                order.width = width;
                order.height = height;
                order.quantity = quantity;
                order.totalArea = totalArea;
                order.unitPrice = unitPrice;
                
                const totalPrice = totalArea * unitPrice;
                order.totalPrice = totalPrice;
                
                // If direct edit of amountPaid happens, we need to make sure we sync it
                // Note: For existing orders, the UI will make amountPaid read-only, but we keep it here for compatibility.
                order.amountPaid = amountPaid;
                order.amountRemaining = totalPrice - amountPaid;
                order.status = status;
                order.notes = notes;
                
                updated = order;
            } else {
                throw new Error('الطلب غير موجود.');
            }
        });
        return toPlainObject(updated);
    });

    ipcMain.handle('db:deleteOrder', (event, id) => {
        realm.write(() => {
            const order = realm.objectForPrimaryKey('Order', id);
            if (order) {
                // Return stock of deleted order
                const materials = realm.objects('Material').filtered('name == $0', order.materialName);
                if (materials.length > 0) {
                    const mat = materials[0];
                    mat.stock = mat.stock + order.totalArea;
                }

                // Delete linked payments
                const orderPayments = realm.objects('Payment').filtered('orderId == $0', id);
                realm.delete(orderPayments);

                realm.delete(order);
            }
        });
        return { success: true };
    });

    // Expenses CRUD
    ipcMain.handle('db:getExpenses', () => {
        const expenses = realm.objects('Expense').sorted('date', true);
        return toPlainObject(expenses);
    });

    ipcMain.handle('db:addExpense', (event, expenseData) => {
        const category = (expenseData.category || '').trim();
        const amount = parseFloat(expenseData.amount);
        const description = (expenseData.description || '').trim();
        const date = (expenseData.date || '').trim();

        if (!category) throw new Error('بند المصروف مطلوب.');
        if (isNaN(amount) || amount <= 0) throw new Error('القيمة المالية للمصروف يجب أن تكون رقماً أكبر من الصفر.');
        if (!description) throw new Error('الوصف مطلوب.');
        if (!date) throw new Error('التاريخ مطلوب.');

        let newExpense;
        realm.write(() => {
            newExpense = realm.create('Expense', {
                _id: Date.now().toString(),
                category: category,
                amount: amount,
                description: description,
                date: date,
                createdAt: new Date()
            });
        });
        return toPlainObject(newExpense);
    });

    ipcMain.handle('db:deleteExpense', (event, id) => {
        realm.write(() => {
            const expense = realm.objectForPrimaryKey('Expense', id);
            if (expense) {
                realm.delete(expense);
            }
        });
        return { success: true };
    });

    // Supplier Invoices CRUD
    ipcMain.handle('db:getSupplierInvoices', () => {
        const invoices = realm.objects('SupplierInvoice').sorted('date', true);
        return toPlainObject(invoices);
    });

    ipcMain.handle('db:addSupplierInvoice', (event, invoiceData) => {
        const invoiceNumber = (invoiceData.invoiceNumber || '').trim();
        const supplierName = (invoiceData.supplierName || '').trim();
        const materialName = (invoiceData.materialName || '').trim();
        const quantity = parseFloat(invoiceData.quantity);
        const unitPrice = parseFloat(invoiceData.unitPrice);
        const amountPaid = parseFloat(invoiceData.amountPaid);
        const paymentMethod = (invoiceData.paymentMethod || 'cash').trim();
        const notes = (invoiceData.notes || '').trim();
        const date = (invoiceData.date || '').trim();

        if (!invoiceNumber) throw new Error('رقم الفاتورة مطلوب.');
        if (!supplierName) throw new Error('اسم المورد مطلوب.');
        if (!materialName) throw new Error('الخامة مطلوبة.');
        if (isNaN(quantity) || quantity <= 0) throw new Error('الكمية يجب أن تكون أكبر من الصفر.');
        if (isNaN(unitPrice) || unitPrice <= 0) throw new Error('السعر يجب أن يكون أكبر من الصفر.');
        if (isNaN(amountPaid) || amountPaid < 0) throw new Error('المبلغ المدفوع يجب أن يكون صفر أو أكثر.');
        if (!date) throw new Error('التاريخ مطلوب.');

        const totalPrice = quantity * unitPrice;
        const amountRemaining = Math.max(0, totalPrice - amountPaid);

        let newInvoice;
        realm.write(() => {
            // Check for duplicate invoice number
            const duplicateInvoice = realm.objects('SupplierInvoice').filtered('invoiceNumber ==[c] $0', invoiceNumber);
            if (duplicateInvoice.length > 0) {
                throw new Error('رقم الفاتورة مسجل مسبقاً.');
            }

            const materials = realm.objects('Material').filtered('name == $0', materialName);
            if (materials.length === 0) {
                throw new Error('الخامة المحددة غير موجودة في المستودع.');
            }
            const mat = materials[0];

            newInvoice = realm.create('SupplierInvoice', {
                _id: Date.now().toString(),
                invoiceNumber: invoiceNumber,
                supplierName: supplierName,
                materialName: materialName,
                quantity: quantity,
                unitPrice: unitPrice,
                totalPrice: totalPrice,
                amountPaid: amountPaid,
                amountRemaining: amountRemaining,
                paymentMethod: paymentMethod,
                notes: notes,
                date: date,
                createdAt: new Date()
            });

            // Create initial payment record if amountPaid > 0
            if (amountPaid > 0) {
                realm.create('SupplierPayment', {
                    _id: Date.now().toString() + Math.random().toString(),
                    invoiceId: newInvoice._id,
                    supplierName: supplierName,
                    amount: amountPaid,
                    date: date || new Date().toISOString().slice(0, 10),
                    notes: 'دفعة أولية عند تسجيل الفاتورة',
                    createdAt: new Date()
                });
            }

            // Add stock of the material
            mat.stock += quantity;
        });
        return toPlainObject(newInvoice);
    });

    ipcMain.handle('db:updateSupplierInvoice', (event, id, invoiceData) => {
        const invoiceNumber = (invoiceData.invoiceNumber || '').trim();
        const supplierName = (invoiceData.supplierName || '').trim();
        const materialName = (invoiceData.materialName || '').trim();
        const quantity = parseFloat(invoiceData.quantity);
        const unitPrice = parseFloat(invoiceData.unitPrice);
        const amountPaid = parseFloat(invoiceData.amountPaid ?? 0) || 0;
        const paymentMethod = (invoiceData.paymentMethod || 'cash').trim();
        const notes = (invoiceData.notes || '').trim();
        const date = (invoiceData.date || '').trim();

        if (!invoiceNumber) throw new Error('رقم الفاتورة مطلوب.');
        if (!supplierName) throw new Error('اسم المورد مطلوب.');
        if (!materialName) throw new Error('الخامة مطلوبة.');
        if (isNaN(quantity) || quantity <= 0) throw new Error('الكمية يجب أن تكون أكبر من الصفر.');
        if (isNaN(unitPrice) || unitPrice <= 0) throw new Error('السعر يجب أن يكون أكبر من الصفر.');
        if (amountPaid < 0) throw new Error('المبلغ المدفوع يجب أن يكون صفر أو أكثر.');
        if (!date) throw new Error('التاريخ مطلوب.');


        let updated;
        realm.write(() => {
            const invoice = realm.objectForPrimaryKey('SupplierInvoice', id);
            if (!invoice) throw new Error('الفاتورة غير موجودة.');

            const duplicateInvoice = realm.objects('SupplierInvoice').filtered('invoiceNumber ==[c] $0 && _id != $1', invoiceNumber, id);
            if (duplicateInvoice.length > 0) {
                throw new Error('رقم الفاتورة مستخدم لفاتورة أخرى.');
            }

            const materials = realm.objects('Material').filtered('name == $0', materialName);
            if (materials.length === 0) {
                throw new Error('الخامة المحددة غير موجودة في المستودع.');
            }
            const newMat = materials[0];

            const oldMaterialName = invoice.materialName;
            const oldQuantity = invoice.quantity;

            // Adjust stock safely
            if (oldMaterialName === newMat.name) {
                newMat.stock = Math.max(0, newMat.stock - oldQuantity + quantity);
            } else {
                // Restore old material stock
                const oldMatQuery = realm.objects('Material').filtered('name == $0', oldMaterialName);
                if (oldMatQuery.length > 0) {
                    const oldMat = oldMatQuery[0];
                    oldMat.stock = Math.max(0, oldMat.stock - oldQuantity);
                }
                // Add new material stock
                newMat.stock += quantity;
            }

            const totalPrice = quantity * unitPrice;
            const amountRemaining = Math.max(0, totalPrice - amountPaid);

            // Cascade update supplier name in payments if changed
            if (invoice.supplierName !== supplierName) {
                const invoicePayments = realm.objects('SupplierPayment').filtered('invoiceId == $0', id);
                for (const payment of invoicePayments) {
                    payment.supplierName = supplierName;
                }
            }

            invoice.invoiceNumber = invoiceNumber;
            invoice.supplierName = supplierName;
            invoice.materialName = materialName;
            invoice.quantity = quantity;
            invoice.unitPrice = unitPrice;
            invoice.totalPrice = totalPrice;
            // amountPaid and amountRemaining should ideally be recalculated based on payments,
            // but we keep direct update for compatibility.
            invoice.amountPaid = amountPaid;
            invoice.amountRemaining = amountRemaining;
            invoice.paymentMethod = paymentMethod;
            invoice.notes = notes;
            invoice.date = date;

            updated = invoice;
        });
        return toPlainObject(updated);
    });

    ipcMain.handle('db:deleteSupplierInvoice', (event, id) => {
        realm.write(() => {
            const invoice = realm.objectForPrimaryKey('SupplierInvoice', id);
            if (invoice) {
                // Deduct stock of deleted invoice
                const materials = realm.objects('Material').filtered('name == $0', invoice.materialName);
                if (materials.length > 0) {
                    const mat = materials[0];
                    mat.stock = Math.max(0, mat.stock - invoice.quantity);
                }

                // Delete linked payments
                const invoicePayments = realm.objects('SupplierPayment').filtered('invoiceId == $0', id);
                realm.delete(invoicePayments);

                realm.delete(invoice);
            }
        });
        return { success: true };
    });

    // Supplier Payments CRUD
    ipcMain.handle('db:getSupplierPayments', (event, invoiceId) => {
        let payments;
        if (invoiceId) {
            payments = realm.objects('SupplierPayment').filtered('invoiceId == $0', invoiceId).sorted('createdAt', true);
        } else {
            payments = realm.objects('SupplierPayment').sorted('createdAt', true);
        }
        return toPlainObject(payments);
    });

    ipcMain.handle('db:addSupplierPayment', (event, paymentData) => {
        const invoiceId = paymentData.invoiceId;
        const amount = parseFloat(paymentData.amount);
        const date = (paymentData.date || '').trim();
        const notes = (paymentData.notes || '').trim();

        if (!invoiceId) throw new Error('معرف الفاتورة مطلوب لتسجيل الدفعة.');
        if (isNaN(amount) || amount <= 0) throw new Error('مبلغ الدفعة يجب أن يكون رقماً أكبر من الصفر.');
        if (!date) throw new Error('التاريخ مطلوب.');

        let newPayment;
        realm.write(() => {
            const invoice = realm.objectForPrimaryKey('SupplierInvoice', invoiceId);
            if (!invoice) throw new Error('الفاتورة المرتبطة بهذه الدفعة غير موجودة.');

            newPayment = realm.create('SupplierPayment', {
                _id: Date.now().toString() + Math.random().toString(),
                invoiceId: invoiceId,
                supplierName: invoice.supplierName,
                amount: amount,
                date: date,
                notes: notes,
                createdAt: new Date()
            });

            // Recalculate amountPaid and amountRemaining on the invoice
            const invoicePayments = realm.objects('SupplierPayment').filtered('invoiceId == $0', invoiceId);
            const totalPaid = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
            invoice.amountPaid = totalPaid;
            invoice.amountRemaining = Math.max(0, invoice.totalPrice - totalPaid);
        });
        return toPlainObject(newPayment);
    });

    ipcMain.handle('db:updateSupplierPayment', (event, id, paymentData) => {
        const amount = parseFloat(paymentData.amount);
        const date = (paymentData.date || '').trim();
        const notes = (paymentData.notes || '').trim();

        if (isNaN(amount) || amount <= 0) throw new Error('مبلغ الدفعة يجب أن يكون رقماً أكبر من الصفر.');
        if (!date) throw new Error('التاريخ مطلوب.');

        let updated;
        realm.write(() => {
            const payment = realm.objectForPrimaryKey('SupplierPayment', id);
            if (payment) {
                payment.amount = amount;
                payment.date = date;
                payment.notes = notes;
                updated = payment;

                // Recalculate amounts on the invoice
                const invoiceId = payment.invoiceId;
                const invoice = realm.objectForPrimaryKey('SupplierInvoice', invoiceId);
                if (invoice) {
                    const invoicePayments = realm.objects('SupplierPayment').filtered('invoiceId == $0', invoiceId);
                    const totalPaid = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
                    invoice.amountPaid = totalPaid;
                    invoice.amountRemaining = Math.max(0, invoice.totalPrice - totalPaid);
                }
            } else {
                throw new Error('دفعة السداد غير موجودة.');
            }
        });
        return toPlainObject(updated);
    });

    ipcMain.handle('db:deleteSupplierPayment', (event, id) => {
        realm.write(() => {
            const payment = realm.objectForPrimaryKey('SupplierPayment', id);
            if (payment) {
                const invoiceId = payment.invoiceId;
                realm.delete(payment);

                // Recalculate amounts on the invoice
                const invoice = realm.objectForPrimaryKey('SupplierInvoice', invoiceId);
                if (invoice) {
                    const invoicePayments = realm.objects('SupplierPayment').filtered('invoiceId == $0', invoiceId);
                    const totalPaid = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
                    invoice.amountPaid = totalPaid;
                    invoice.amountRemaining = Math.max(0, invoice.totalPrice - totalPaid);
                }
            }
        });
        return { success: true };
    });

    // EXPORT DATABASE TO A SINGLE JSON FILE
    ipcMain.handle('db:export', async () => {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'تصدير نسخة احتياطية لقاعدة البيانات',
            defaultPath: path.join(app.getPath('downloads'), `karma_print_backup_${new Date().toISOString().slice(0,10)}.json`),
            filters: [{ name: 'JSON files', extensions: ['json'] }]
        });

        if (!filePath) {
            return { success: false, cancelled: true };
        }

        try {
            const backupData = {
                clients: toPlainObject(realm.objects('Client')),
                suppliers: toPlainObject(realm.objects('Supplier')),
                materials: toPlainObject(realm.objects('Material')),
                orders: toPlainObject(realm.objects('Order')),
                payments: toPlainObject(realm.objects('Payment')),
                supplierPayments: toPlainObject(realm.objects('SupplierPayment')),
                supplierInvoices: toPlainObject(realm.objects('SupplierInvoice')),
                expenses: toPlainObject(realm.objects('Expense')),
                exportedAt: new Date().toISOString()
            };

            fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
            return { success: true, path: filePath };
        } catch (error) {
            console.error('Export DB error:', error);
            return { success: false, error: error.message };
        }
    });

    // IMPORT DATABASE FROM A SINGLE JSON FILE
    ipcMain.handle('db:import', async () => {
        const { filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'استيراد نسخة احتياطية لقاعدة البيانات',
            filters: [{ name: 'JSON files', extensions: ['json'] }],
            properties: ['openFile']
        });

        if (filePaths.length === 0) {
            return { success: false, cancelled: true };
        }

        try {
            const fileContent = fs.readFileSync(filePaths[0], 'utf-8');
            const backupData = JSON.parse(fileContent);

            // Basic validation
            if (!backupData.clients || !backupData.materials || !backupData.orders || !backupData.expenses) {
                throw new Error('ملف النسخة الاحتياطية غير صالح أو غير مكتمل.');
            }

            realm.write(() => {
                // Clear existing database
                realm.deleteAll();

                // Re-import Clients
                for (const client of backupData.clients) {
                    const clientDate = client.createdAt ? new Date(client.createdAt) : new Date();
                    realm.create('Client', {
                        _id: client._id || Date.now().toString() + Math.random().toString(),
                        name: client.name,
                        phone: client.phone,
                        address: client.address || '',
                        createdAt: isNaN(clientDate.getTime()) ? new Date() : clientDate
                    });
                }

                // Re-import Suppliers
                if (backupData.suppliers) {
                    for (const supplier of backupData.suppliers) {
                        const supDate = supplier.createdAt ? new Date(supplier.createdAt) : new Date();
                        realm.create('Supplier', {
                            _id: supplier._id || Date.now().toString() + Math.random().toString(),
                            name: supplier.name,
                            phone: supplier.phone,
                            address: supplier.address || '',
                            company: supplier.company || '',
                            createdAt: isNaN(supDate.getTime()) ? new Date() : supDate
                        });
                    }
                }

                // Re-import Materials
                for (const material of backupData.materials) {
                    const materialDate = material.createdAt ? new Date(material.createdAt) : new Date();
                    realm.create('Material', {
                        _id: material._id || Date.now().toString() + Math.random().toString(),
                        name: material.name,
                        type: material.type,
                        stock: parseFloat(material.stock || 0),
                        costPrice: parseFloat(material.costPrice || 0),
                        sellPrice: parseFloat(material.sellPrice || 0),
                        supplier: material.supplier || null,
                        createdAt: isNaN(materialDate.getTime()) ? new Date() : materialDate
                    });
                }

                // Re-import Orders
                for (const order of backupData.orders) {
                    const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
                    realm.create('Order', {
                        _id: order._id || Date.now().toString() + Math.random().toString(),
                        orderNumber: order.orderNumber,
                        client: order.client,
                        printType: order.printType,
                        materialName: order.materialName,
                        width: parseFloat(order.width || 0),
                        height: parseFloat(order.height || 0),
                        quantity: parseInt(order.quantity || 1),
                        totalArea: parseFloat(order.totalArea || 0),
                        unitPrice: parseFloat(order.unitPrice || 0),
                        totalPrice: parseFloat(order.totalPrice || 0),
                        amountPaid: parseFloat(order.amountPaid || 0),
                        amountRemaining: parseFloat(order.amountRemaining || 0),
                        status: order.status || 'pending',
                        notes: order.notes || '',
                        createdAt: isNaN(orderDate.getTime()) ? new Date() : orderDate
                    });
                }

                // Re-import Payments (with fallback)
                if (backupData.payments) {
                    for (const payment of backupData.payments) {
                        const payDate = payment.createdAt ? new Date(payment.createdAt) : new Date();
                        realm.create('Payment', {
                            _id: payment._id || Date.now().toString() + Math.random().toString(),
                            orderId: payment.orderId,
                            clientName: payment.clientName,
                            amount: parseFloat(payment.amount || 0),
                            date: payment.date || new Date().toISOString().slice(0, 10),
                            notes: payment.notes || '',
                            createdAt: isNaN(payDate.getTime()) ? new Date() : payDate
                        });
                    }
                } else {
                    // Fallback: create initial payment for each order that had a deposit
                    for (const order of backupData.orders) {
                        const amountPaid = parseFloat(order.amountPaid || 0);
                        if (amountPaid > 0) {
                            realm.create('Payment', {
                                _id: 'imported_initial_' + order._id,
                                orderId: order._id,
                                clientName: order.client,
                                amount: amountPaid,
                                date: order.createdAt ? new Date(order.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                                notes: 'دفعة مقدمة مستوردة',
                                createdAt: order.createdAt ? new Date(order.createdAt) : new Date()
                            });
                        }
                    }
                }

                // Re-import Supplier Invoices
                if (backupData.supplierInvoices) {
                    for (const invoice of backupData.supplierInvoices) {
                        const invDate = invoice.createdAt ? new Date(invoice.createdAt) : new Date();
                        realm.create('SupplierInvoice', {
                            _id: invoice._id || Date.now().toString() + Math.random().toString(),
                            invoiceNumber: invoice.invoiceNumber,
                            supplierName: invoice.supplierName,
                            materialName: invoice.materialName,
                            quantity: parseFloat(invoice.quantity || 0),
                            unitPrice: parseFloat(invoice.unitPrice || 0),
                            totalPrice: parseFloat(invoice.totalPrice || 0),
                            amountPaid: parseFloat(invoice.amountPaid || 0),
                            amountRemaining: parseFloat(invoice.amountRemaining || 0),
                            paymentMethod: invoice.paymentMethod || 'cash',
                            notes: invoice.notes || '',
                            date: invoice.date || new Date().toISOString().slice(0, 10),
                            createdAt: isNaN(invDate.getTime()) ? new Date() : invDate
                        });
                    }
                }

                // Re-import Supplier Payments
                if (backupData.supplierPayments) {
                    for (const payment of backupData.supplierPayments) {
                        const payDate = payment.createdAt ? new Date(payment.createdAt) : new Date();
                        realm.create('SupplierPayment', {
                            _id: payment._id || Date.now().toString() + Math.random().toString(),
                            invoiceId: payment.invoiceId,
                            supplierName: payment.supplierName,
                            amount: parseFloat(payment.amount || 0),
                            date: payment.date || new Date().toISOString().slice(0, 10),
                            notes: payment.notes || '',
                            createdAt: isNaN(payDate.getTime()) ? new Date() : payDate
                        });
                    }
                }

                // Re-import Expenses
                if (backupData.expenses) {
                    for (const expense of backupData.expenses) {
                        const expenseDate = expense.createdAt ? new Date(expense.createdAt) : new Date();
                        realm.create('Expense', {
                            _id: expense._id || Date.now().toString() + Math.random().toString(),
                            category: expense.category,
                            amount: parseFloat(expense.amount || 0),
                            description: expense.description || '',
                            date: expense.date || new Date().toISOString().slice(0, 10),
                            createdAt: isNaN(expenseDate.getTime()) ? new Date() : expenseDate
                        });
                    }
                }
            });

            return { success: true };
        } catch (error) {
            console.error('Import DB error:', error);
            return { success: false, error: error.message };
        }
    });

    // RESET SYSTEM / RESET DATABASE
    ipcMain.handle('db:reset', async () => {
        try {
            realm.write(() => {
                realm.deleteAll();
            });
            seedDefaultMaterials();
            return { success: true };
        } catch (error) {
            console.error('Reset DB error:', error);
            return { success: false, error: error.message };
        }
    });
}

app.whenReady().then(() => {
    initDatabase();
    registerIpcHandlers();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (realm) {
            realm.close();
        }
        app.quit();
    }
});
