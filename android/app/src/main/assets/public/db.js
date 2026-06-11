// db.js - Dexie.js wrapper for Offline/Mobile Support
// This file mocks the Electron IPC 'window.api' when running in a web browser or Capacitor (Android/iOS).

if (!window.api) {
    console.log("Electron IPC not detected. Initializing local Dexie.js database for mobile/web.");

    const db = new Dexie("KarmaPrintDB");
    
    // Define Database Schema
    db.version(1).stores({
        clients: '_id, name, phone, createdAt',
        suppliers: '_id, name, phone, createdAt',
        materials: '_id, name, type, supplier, createdAt',
        orders: '_id, orderNumber, client, status, createdAt',
        payments: '_id, orderId, clientName, createdAt',
        supplierInvoices: '_id, invoiceNumber, supplierName, createdAt',
        supplierPayments: '_id, invoiceId, supplierName, createdAt',
        expenses: '_id, category, date, createdAt'
    });

    // Helper: Seed default materials if empty
    db.on('populate', async () => {
        const defaults = [
            { _id: 'm1', name: 'بانر خارجي 440 جم (Banner)', type: 'Outdoor', stock: 350.0, costPrice: 4.5, sellPrice: 12.0, createdAt: new Date().toISOString() },
            { _id: 'm2', name: 'فليكس مضيء خارجي (Flex)', type: 'Outdoor', stock: 200.0, costPrice: 7.0, sellPrice: 18.0, createdAt: new Date().toISOString() },
            { _id: 'm3', name: 'فينيل لاصق خارجي (Vinyl)', type: 'Outdoor', stock: 150.0, costPrice: 6.0, sellPrice: 16.0, createdAt: new Date().toISOString() },
            { _id: 'm4', name: 'ماش خارجي مخرم (Mesh)', type: 'Outdoor', stock: 100.0, costPrice: 8.0, sellPrice: 20.0, createdAt: new Date().toISOString() },
            { _id: 'm5', name: 'ستيكر داخلي لامع (Sticker Indoor)', type: 'Indoor', stock: 180.0, costPrice: 5.5, sellPrice: 15.0, createdAt: new Date().toISOString() },
            { _id: 'm6', name: 'ورق بوستر داخلي (Poster Paper)', type: 'Indoor', stock: 120.0, costPrice: 4.0, sellPrice: 10.0, createdAt: new Date().toISOString() },
            { _id: 'm7', name: 'قماش لوحات كانفاس (Canvas)', type: 'Indoor', stock: 80.0, costPrice: 12.0, sellPrice: 30.0, createdAt: new Date().toISOString() }
        ];
        await db.materials.bulkAdd(defaults);
    });

    // --- Provide the window.api interface ---
    window.api = {
        // --- Clients ---
        getClients: async () => {
            return await db.clients.orderBy('createdAt').reverse().toArray();
        },
        addClient: async (client) => {
            const exists = await db.clients.where('name').equals(client.name).first();
            if (exists) throw new Error('اسم العميل مسجل بالفعل بالبرنامج.');
            
            client._id = Date.now().toString();
            client.createdAt = new Date().toISOString();
            await db.clients.add(client);
            return client;
        },
        updateClient: async (id, client) => {
            await db.clients.update(id, client);
            return await db.clients.get(id);
        },
        deleteClient: async (id) => {
            await db.clients.delete(id);
            return { success: true };
        },

        // --- Suppliers ---
        getSuppliers: async () => {
            return await db.suppliers.orderBy('createdAt').reverse().toArray();
        },
        addSupplier: async (supplier) => {
            supplier._id = Date.now().toString();
            supplier.createdAt = new Date().toISOString();
            await db.suppliers.add(supplier);
            return supplier;
        },
        updateSupplier: async (id, supplier) => {
            await db.suppliers.update(id, supplier);
            return await db.suppliers.get(id);
        },
        deleteSupplier: async (id) => {
            await db.suppliers.delete(id);
            return { success: true };
        },

        // --- Materials ---
        getMaterials: async () => {
            return await db.materials.orderBy('name').toArray();
        },
        addMaterial: async (material) => {
            material._id = Date.now().toString();
            material.createdAt = new Date().toISOString();
            await db.materials.add(material);
            return material;
        },
        updateMaterial: async (id, material) => {
            await db.materials.update(id, material);
            return await db.materials.get(id);
        },
        deleteMaterial: async (id) => {
            await db.materials.delete(id);
            return { success: true };
        },

        // --- Orders ---
        getOrders: async () => {
            return await db.orders.orderBy('createdAt').reverse().toArray();
        },
        addOrder: async (orderData) => {
            return await db.transaction('rw', db.orders, db.materials, db.payments, async () => {
                const totalArea = orderData.width * orderData.height * orderData.quantity;
                const totalPrice = totalArea * orderData.unitPrice;
                const amountRemaining = totalPrice - (orderData.amountPaid || 0);

                const dateCode = new Date().toISOString().slice(2, 10).replace(/-/g, '');
                const randomCode = Math.floor(1000 + Math.random() * 9000).toString();
                const orderNumber = `KP-${dateCode}-${randomCode}`;

                const newOrder = {
                    ...orderData,
                    _id: Date.now().toString(),
                    orderNumber,
                    totalArea,
                    totalPrice,
                    amountRemaining,
                    createdAt: new Date().toISOString()
                };

                await db.orders.add(newOrder);

                // Initial Payment
                if (orderData.amountPaid > 0) {
                    await db.payments.add({
                        _id: (Date.now() + 1).toString(),
                        orderId: newOrder._id,
                        clientName: newOrder.client,
                        amount: parseFloat(orderData.amountPaid),
                        date: new Date().toISOString().slice(0, 10),
                        notes: 'دفعة مقدمة عند إنشاء الطلب',
                        createdAt: new Date().toISOString()
                    });
                }

                // Deduct stock
                const mat = await db.materials.where('name').equals(newOrder.materialName).first();
                if (mat) {
                    await db.materials.update(mat._id, { stock: Math.max(0, mat.stock - totalArea) });
                }

                return newOrder;
            });
        },
        updateOrder: async (id, orderData) => {
            return await db.transaction('rw', db.orders, db.materials, async () => {
                const oldOrder = await db.orders.get(id);
                if (!oldOrder) throw new Error("الطلب غير موجود");

                const totalArea = orderData.width * orderData.height * orderData.quantity;
                const totalPrice = totalArea * orderData.unitPrice;
                const amountPaid = parseFloat(orderData.amountPaid || 0);
                const amountRemaining = totalPrice - amountPaid;

                // Adjust Stock
                if (oldOrder.materialName === orderData.materialName) {
                    const mat = await db.materials.where('name').equals(orderData.materialName).first();
                    if (mat) {
                        const stockDiff = oldOrder.totalArea - totalArea;
                        await db.materials.update(mat._id, { stock: Math.max(0, mat.stock + stockDiff) });
                    }
                } else {
                    const oldMat = await db.materials.where('name').equals(oldOrder.materialName).first();
                    if (oldMat) await db.materials.update(oldMat._id, { stock: oldMat.stock + oldOrder.totalArea });

                    const newMat = await db.materials.where('name').equals(orderData.materialName).first();
                    if (newMat) await db.materials.update(newMat._id, { stock: Math.max(0, newMat.stock - totalArea) });
                }

                const updatedOrder = { ...oldOrder, ...orderData, totalArea, totalPrice, amountPaid, amountRemaining };
                await db.orders.update(id, updatedOrder);
                return updatedOrder;
            });
        },
        deleteOrder: async (id) => {
            return await db.transaction('rw', db.orders, db.materials, db.payments, async () => {
                const order = await db.orders.get(id);
                if (order) {
                    const mat = await db.materials.where('name').equals(order.materialName).first();
                    if (mat) {
                        await db.materials.update(mat._id, { stock: mat.stock + order.totalArea });
                    }
                    await db.payments.where('orderId').equals(id).delete();
                    await db.orders.delete(id);
                }
                return { success: true };
            });
        },

        // --- Payments ---
        getPayments: async (orderId) => {
            if (orderId) return await db.payments.where('orderId').equals(orderId).reverse().sortBy('createdAt');
            return await db.payments.orderBy('createdAt').reverse().toArray();
        },
        addPayment: async (paymentData) => {
            return await db.transaction('rw', db.orders, db.payments, async () => {
                const order = await db.orders.get(paymentData.orderId);
                if (!order) throw new Error("الطلب غير موجود");

                const payment = {
                    ...paymentData,
                    _id: Date.now().toString(),
                    clientName: order.client,
                    createdAt: new Date().toISOString()
                };
                await db.payments.add(payment);

                const payments = await db.payments.where('orderId').equals(order._id).toArray();
                const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                await db.orders.update(order._id, {
                    amountPaid: totalPaid,
                    amountRemaining: Math.max(0, order.totalPrice - totalPaid)
                });

                return payment;
            });
        },
        updatePayment: async (id, paymentData) => {
            return await db.transaction('rw', db.orders, db.payments, async () => {
                await db.payments.update(id, { amount: parseFloat(paymentData.amount), date: paymentData.date, notes: paymentData.notes });
                const payment = await db.payments.get(id);
                
                const order = await db.orders.get(payment.orderId);
                if (order) {
                    const payments = await db.payments.where('orderId').equals(order._id).toArray();
                    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                    await db.orders.update(order._id, {
                        amountPaid: totalPaid,
                        amountRemaining: Math.max(0, order.totalPrice - totalPaid)
                    });
                }
                return payment;
            });
        },
        deletePayment: async (id) => {
            return await db.transaction('rw', db.orders, db.payments, async () => {
                const payment = await db.payments.get(id);
                if (payment) {
                    await db.payments.delete(id);
                    const order = await db.orders.get(payment.orderId);
                    if (order) {
                        const payments = await db.payments.where('orderId').equals(order._id).toArray();
                        const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
                        await db.orders.update(order._id, {
                            amountPaid: totalPaid,
                            amountRemaining: Math.max(0, order.totalPrice - totalPaid)
                        });
                    }
                }
                return { success: true };
            });
        },

        // --- Supplier Invoices ---
        getSupplierInvoices: async () => {
            return await db.supplierInvoices.orderBy('createdAt').reverse().toArray();
        },
        addSupplierInvoice: async (invoice) => {
            invoice._id = Date.now().toString();
            invoice.createdAt = new Date().toISOString();
            await db.supplierInvoices.add(invoice);
            return invoice;
        },
        updateSupplierInvoice: async (id, invoice) => {
            await db.supplierInvoices.update(id, invoice);
            return await db.supplierInvoices.get(id);
        },
        deleteSupplierInvoice: async (id) => {
            await db.supplierInvoices.delete(id);
            return { success: true };
        },

        // --- Supplier Payments ---
        getSupplierPayments: async (invoiceId) => {
            if (invoiceId) return await db.supplierPayments.where('invoiceId').equals(invoiceId).reverse().sortBy('createdAt');
            return await db.supplierPayments.orderBy('createdAt').reverse().toArray();
        },
        addSupplierPayment: async (payment) => {
            payment._id = Date.now().toString();
            payment.createdAt = new Date().toISOString();
            await db.supplierPayments.add(payment);
            return payment;
        },
        updateSupplierPayment: async (id, payment) => {
            await db.supplierPayments.update(id, payment);
            return await db.supplierPayments.get(id);
        },
        deleteSupplierPayment: async (id) => {
            await db.supplierPayments.delete(id);
            return { success: true };
        },

        // --- Expenses ---
        getExpenses: async () => {
            return await db.expenses.orderBy('createdAt').reverse().toArray();
        },
        addExpense: async (expense) => {
            expense._id = Date.now().toString();
            expense.createdAt = new Date().toISOString();
            await db.expenses.add(expense);
            return expense;
        },
        deleteExpense: async (id) => {
            await db.expenses.delete(id);
            return { success: true };
        },

        // --- Database Tools ---
        exportDatabase: async () => {
            alert("تصدير قاعدة البيانات في المتصفح غير مفعل، يرجى الاستمرار في الاستخدام.");
            return true;
        },
        importDatabase: async () => {
            alert("استيراد قاعدة البيانات في المتصفح غير مفعل حالياً.");
            return true;
        },
        resetDatabase: async () => {
            if(confirm('هل أنت متأكد من تصفير التطبيق؟')) {
                await db.delete();
                window.location.reload();
            }
            return true;
        }
    };
}
