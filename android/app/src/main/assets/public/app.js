// --- Application State ---
let state = {
    clients: [],
    suppliers: [],
    materials: [],
    orders: [],
    payments: [],
    expenses: [],
    supplierInvoices: [],
    supplierPayments: [],
    activePanel: 'dashboard',
    shopSettings: {
        address: 'المنطقة الصناعية، مجمع مطابع الدعاية والإعلان',
        phone: '0599999999',
        taxNo: '300054321000003'
    }
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    loadShopSettings();
    await refreshAllData();
    setupEventListeners();
    initDashboardChart();
    
    // Set default month in reports to current month
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('report-month-select').value = currentMonthStr;
    renderReports(currentMonthStr);
});

// --- Data Operations & UI Sync ---
async function refreshAllData() {
    try {
        state.clients = await window.api.getClients() || [];
        state.suppliers = await window.api.getSuppliers() || [];
        state.materials = await window.api.getMaterials() || [];
        state.orders = await window.api.getOrders() || [];
        state.payments = await window.api.getPayments() || [];
        state.supplierInvoices = await window.api.getSupplierInvoices() || [];
        state.supplierPayments = await window.api.getSupplierPayments() || [];
        state.expenses = await window.api.getExpenses() || [];
        
        renderActivePanel();
        updateDashboardStats();
    } catch (error) {
        console.error("Error refreshing data:", error);
    }
}

function loadShopSettings() {
    const saved = localStorage.getItem('karma_print_settings');
    if (saved) {
        state.shopSettings = JSON.parse(saved);
        document.getElementById('shop-address').value = state.shopSettings.address;
        document.getElementById('shop-phone').value = state.shopSettings.phone;
        document.getElementById('shop-tax-no').value = state.shopSettings.taxNo;
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    // 1. Sidebar Tab Switching & Mobile Menu Toggle
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    
    document.querySelectorAll('.menu-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            switchPanel(target);
            // Close mobile sidebar if open
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('mobile-open');
                if (sidebarOverlay) sidebarOverlay.classList.remove('active');
            }
        });
    });

    const btnMobileMenu = document.getElementById('btn-mobile-menu');
    if (btnMobileMenu) {
        btnMobileMenu.addEventListener('click', () => {
            sidebar.classList.add('mobile-open');
            if (sidebarOverlay) sidebarOverlay.classList.add('active');
        });
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
        });
    }

    // 2. Panel Action Buttons
    document.getElementById('btn-quick-order').addEventListener('click', () => openOrderModal());
    document.getElementById('btn-goto-orders').addEventListener('click', () => switchPanel('orders'));
    document.getElementById('btn-add-client').addEventListener('click', () => openClientModal());
    document.getElementById('btn-add-supplier').addEventListener('click', () => openSupplierModal());
    document.getElementById('btn-add-supplier-invoice').addEventListener('click', () => openSupplierInvoiceModal());
    document.getElementById('btn-add-material').addEventListener('click', () => openMaterialModal());
    
    // Quick add client inside order modal
    document.getElementById('btn-order-new-client').addEventListener('click', () => {
        openClientModal();
    });

    // 3. Modals Close Triggers
    document.querySelectorAll('.modal-close-btn, .btn-close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) closeModal(modal.id);
        });
    });

    // 4. Form Submits
    document.getElementById('form-add-client').addEventListener('submit', handleAddClient);
    document.getElementById('form-add-supplier').addEventListener('submit', handleAddSupplier);
    document.getElementById('form-add-supplier-invoice').addEventListener('submit', handleAddSupplierInvoice);
    document.getElementById('form-add-material').addEventListener('submit', handleAddMaterial);
    document.getElementById('form-add-order').addEventListener('submit', handleAddOrder);
    document.getElementById('form-record-payment').addEventListener('submit', handleRecordPayment);
    document.getElementById('btn-cancel-payment-edit').addEventListener('click', cancelPaymentEdit);
    document.getElementById('form-record-supplier-payment').addEventListener('submit', handleRecordSupplierPayment);
    document.getElementById('btn-cancel-supplier-payment-edit').addEventListener('click', cancelSupplierPaymentEdit);
    document.getElementById('form-add-expense').addEventListener('submit', handleAddExpense);
    document.getElementById('form-shop-settings').addEventListener('submit', handleSaveSettings);

    // 5. Order Calculator Fields
    const printTypeSel = document.getElementById('order-print-type');
    const materialSel = document.getElementById('order-material-select');
    const widthInp = document.getElementById('order-width');
    const heightInp = document.getElementById('order-height');
    const qtyInp = document.getElementById('order-quantity');
    const unitPriceInp = document.getElementById('order-unit-price');
    const paidInp = document.getElementById('order-amount-paid');

    printTypeSel.addEventListener('change', () => {
        populateOrderMaterials(printTypeSel.value);
    });

    materialSel.addEventListener('change', () => {
        const selectedMatName = materialSel.value;
        const mat = state.materials.find(m => m.name === selectedMatName);
        if (mat) {
            unitPriceInp.value = mat.sellPrice;
            document.getElementById('summary-default-price').innerText = `${mat.sellPrice.toFixed(2)} ج.م`;
            calculateOrderSummary();
        }
    });

    [widthInp, heightInp, qtyInp, unitPriceInp, paidInp].forEach(input => {
        input.addEventListener('input', calculateOrderSummary);
    });

    // 6. Searches & Filters
    document.getElementById('search-clients').addEventListener('input', renderClientsPanel);
    document.getElementById('search-suppliers').addEventListener('input', renderSuppliersPanel);
    document.getElementById('search-supplier-invoices').addEventListener('input', renderSupplierInvoicesPanel);
    document.getElementById('search-orders').addEventListener('input', renderOrdersPanel);
    document.getElementById('search-materials').addEventListener('input', renderInventoryPanel);
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const group = e.target.closest('.filter-group');
            group.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (group.id === 'filter-supplier-invoices') {
                renderSupplierInvoicesPanel();
            } else {
                renderOrdersPanel();
            }
        });
    });

    // 7. Month picker trigger for reports
    document.getElementById('report-month-select').addEventListener('change', (e) => {
        renderReports(e.target.value);
    });

    // 8. Settings DB Operations
    document.getElementById('btn-export-db').addEventListener('click', handleExportDB);
    document.getElementById('btn-import-db').addEventListener('click', handleImportDB);
    document.getElementById('btn-reset-db').addEventListener('click', handleResetDB);
    
    // 9. Combined Invoices
    initCombinedInvoiceListeners();
}

// --- Routing / Panel Switch ---
function switchPanel(panelId) {
    state.activePanel = panelId;
    
    // Toggle active menu button
    document.querySelectorAll('.menu-item').forEach(btn => {
        if (btn.dataset.target === panelId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Toggle panel view
    document.querySelectorAll('.content-panel').forEach(panel => {
        if (panel.id === `panel-${panelId}`) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });

    // Update Headers
    const titleEl = document.getElementById('current-panel-title');
    const subtitleEl = document.getElementById('current-panel-subtitle');
    
    const headerInfo = {
        dashboard: { title: 'لوحة التحكم', subtitle: 'إحصائيات مطبعة كارما برنت والعمليات الجارية' },
        clients: { title: 'إدارة العملاء', subtitle: 'سجل العملاء وحساب الديون والدفعات' },
        suppliers: { title: 'إدارة الموردين', subtitle: 'سجل الموردين المعتمدين وتفاصيل الاتصال والشركات' },
        'supplier-invoices': { title: 'فواتير الموردين', subtitle: 'إدارة وتتبع مشتريات الخامات من الموردين' },
        orders: { title: 'الطلبات والفواتير', subtitle: 'متابعة طلبات الطباعة وعمليات التسليم والفواتير' },
        inventory: { title: 'مستودع الخامات والمواد', subtitle: 'كميات رولات الطباعة وتكلفة المخزون المتاح' },
        expenses: { title: 'المصروفات التشغيلية', subtitle: 'تسجيل المصروفات اليومية والرواتب وصيانة الماكينات' },
        reports: { title: 'التقارير والإحصائيات المالية', subtitle: 'الحسابات الختامية والأرباح الصافية للفترات المحددة' },
        settings: { title: 'الإعدادات العامة والنسخ الاحتياطي', subtitle: 'أدوات صيانة قاعدة البيانات ومعلومات الفواتير' }
    };

    if (headerInfo[panelId]) {
        titleEl.innerText = headerInfo[panelId].title;
        subtitleEl.innerText = headerInfo[panelId].subtitle;
    }

    renderActivePanel();
}

function renderActivePanel() {
    switch (state.activePanel) {
        case 'dashboard':
            renderDashboardRecentOrders();
            renderDashboardStockAlerts();
            initDashboardChart();
            break;
        case 'clients':
            renderClientsPanel();
            break;
        case 'suppliers':
            renderSuppliersPanel();
            break;
        case 'supplier-invoices':
            renderSupplierInvoicesPanel();
            break;
        case 'orders':
            renderOrdersPanel();
            break;
        case 'inventory':
            renderInventoryPanel();
            break;
        case 'expenses':
            renderExpensesPanel();
            break;
        case 'reports':
            const currentSelectedMonth = document.getElementById('report-month-select').value;
            renderReports(currentSelectedMonth);
            break;
    }
}

// --- Modal Utilities ---
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// --- Dashboard View Operations ---
function updateDashboardStats() {
    const totalOrders = state.orders.length;
    const totalSales = state.orders.reduce((sum, order) => sum + order.totalPrice, 0);
    const unpaidRemaining = state.orders.reduce((sum, order) => sum + order.amountRemaining, 0);
    const activeOrders = state.orders.filter(order => order.status === 'pending' || order.status === 'in-progress').length;

    document.getElementById('stat-total-orders').innerText = totalOrders;
    document.getElementById('stat-total-sales').innerText = `${totalSales.toFixed(2)} ج.م`;
    document.getElementById('stat-remaining-debts').innerText = `${unpaidRemaining.toFixed(2)} ج.م`;
    document.getElementById('stat-active-orders').innerText = activeOrders;
}

function renderDashboardRecentOrders() {
    const recent = state.orders.slice(0, 5);
    const tbody = document.getElementById('dashboard-recent-orders');
    
    if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted">لا توجد طلبات طباعة مسجلة حالياً.</td></tr>`;
        return;
    }

    let html = '';
    for (const order of recent) {
        let statusBadge = getStatusBadge(order.status);
        html += `
            <tr>
                <td><strong>${order.orderNumber}</strong></td>
                <td>${order.client}</td>
                <td>${order.printType === 'Outdoor' ? 'أوتدور' : 'إندور'}</td>
                <td>${order.materialName.split(' ')[0]}</td>
                <td>${order.totalArea.toFixed(2)} م²</td>
                <td><strong>${order.totalPrice.toFixed(2)} ج.م</strong></td>
                <td><span class="text-success">${order.amountPaid.toFixed(2)}</span></td>
                <td><span class="${order.amountRemaining > 0 ? 'text-warning' : 'text-muted'}">${order.amountRemaining.toFixed(2)}</span></td>
                <td>${statusBadge}</td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

function renderDashboardStockAlerts() {
    const alertsContainer = document.getElementById('dashboard-stock-alerts');
    const lowStockMaterials = state.materials.filter(m => m.stock < 50.0);

    if (lowStockMaterials.length === 0) {
        alertsContainer.innerHTML = `<div class="empty-state">المخزون ممتاز، لا توجد خامات منخفضة الكمية حالياً.</div>`;
        return;
    }

    let html = '';
    for (const mat of lowStockMaterials) {
        html += `
            <div class="warning-item">
                <div class="warning-info">
                    <span class="warning-title">${mat.name}</span>
                    <span class="warning-desc">نوع: ${mat.type === 'Outdoor' ? 'أوتدور' : 'إندور'}</span>
                </div>
                <span class="warning-value">${mat.stock.toFixed(1)} م²</span>
            </div>
        `;
    }
    alertsContainer.innerHTML = html;
}

function getStatusBadge(status) {
    switch (status) {
        case 'pending': return `<span class="badge badge-pending">قيد الانتظار</span>`;
        case 'in-progress': return `<span class="badge badge-in-progress">قيد التنفيذ</span>`;
        case 'ready': return `<span class="badge badge-ready">جاهز للتسليم</span>`;
        case 'delivered': return `<span class="badge badge-delivered">تم التسليم</span>`;
        default: return `<span class="badge">${status}</span>`;
    }
}

// --- Custom Interactive SVG Graph (No Libraries) ---
function initDashboardChart() {
    const wrapper = document.getElementById('svg-chart-wrapper');
    if (!wrapper) return;

    // Get monthly values for the last 6 months
    const monthsData = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const year = d.getFullYear();
        const month = d.getMonth();
        const monthLabel = d.toLocaleString('ar-EG', { month: 'short' });
        
        // Filter sales (totalPrice) in this month
        const monthlySales = state.orders
            .filter(o => {
                const date = new Date(o.createdAt);
                return date.getFullYear() === year && date.getMonth() === month;
            })
            .reduce((sum, o) => sum + o.totalPrice, 0);

        // Filter expenses in this month
        const monthlyExpenses = state.expenses
            .filter(e => {
                const date = new Date(e.date);
                return date.getFullYear() === year && date.getMonth() === month;
            })
            .reduce((sum, e) => sum + e.amount, 0);

        // Cost of materials used (estimate: totalArea * costPrice of the material)
        const monthlyMaterialCosts = state.orders
            .filter(o => {
                const date = new Date(o.createdAt);
                return date.getFullYear() === year && date.getMonth() === month;
            })
            .reduce((sum, o) => {
                const mat = state.materials.find(m => m.name === o.materialName);
                const cost = mat ? mat.costPrice : 0;
                return sum + (o.totalArea * cost);
            }, 0);

        const totalCost = monthlyExpenses + monthlyMaterialCosts;
        const netProfit = monthlySales - totalCost;

        monthsData.push({
            label: monthLabel,
            sales: monthlySales,
            expenses: totalCost,
            profit: netProfit
        });
    }

    // Set SVG Chart Layout
    const width = wrapper.clientWidth || 500;
    const height = 220;
    const paddingLeft = 60;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    // Find max value for Y-axis scale
    const maxVal = Math.max(
        ...monthsData.map(d => Math.max(d.sales, d.expenses, d.profit, 1000))
    ) * 1.1;

    // Build grid lines
    let gridLinesHtml = '';
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
        const val = (maxVal / gridCount) * i;
        const y = height - paddingBottom - (chartHeight / gridCount) * i;
        gridLinesHtml += `
            <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--border-color)" stroke-width="1" />
            <text x="${paddingLeft - 10}" y="${y + 4}" fill="var(--text-secondary)" font-size="10" text-anchor="end">${val.toFixed(0)}</text>
        `;
    }

    // Build points & paths
    let salesPoints = [];
    let expensesPoints = [];
    let profitPoints = [];
    let labelsHtml = '';

    monthsData.forEach((d, idx) => {
        const x = paddingLeft + (chartWidth / 5) * idx;
        const salesY = height - paddingBottom - (d.sales / maxVal) * chartHeight;
        const expensesY = height - paddingBottom - (d.expenses / maxVal) * chartHeight;
        const profitY = height - paddingBottom - (Math.max(0, d.profit) / maxVal) * chartHeight;

        salesPoints.push(`${x},${salesY}`);
        expensesPoints.push(`${x},${expensesY}`);
        profitPoints.push(`${x},${profitY}`);

        // Label on X-axis
        labelsHtml += `
            <text x="${x}" y="${height - 10}" fill="var(--text-secondary)" font-size="10" text-anchor="middle">${d.label}</text>
            <line x1="${x}" y1="${height - paddingBottom}" x2="${x}" y2="${height - paddingBottom + 4}" stroke="var(--border-color)" stroke-width="1"/>
        `;
    });

    const salesPathData = `M ${salesPoints.join(' L ')}`;
    const expensesPathData = `M ${expensesPoints.join(' L ')}`;
    const profitPathData = `M ${profitPoints.join(' L ')}`;

    // Build interactive hover points
    let pointsHtml = '';
    monthsData.forEach((d, idx) => {
        const x = paddingLeft + (chartWidth / 5) * idx;
        const salesY = height - paddingBottom - (d.sales / maxVal) * chartHeight;
        const expensesY = height - paddingBottom - (d.expenses / maxVal) * chartHeight;
        
        pointsHtml += `
            <circle class="graph-point sales" cx="${x}" cy="${salesY}" r="4" title="مبيعات: ${d.sales.toFixed(0)} ج.م"/>
            <circle class="graph-point expenses" cx="${x}" cy="${expensesY}" r="4" title="تكاليف: ${d.expenses.toFixed(0)} ج.م"/>
        `;
    });

    const svgHtml = `
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="direction: ltr;">
            <!-- Grid -->
            ${gridLinesHtml}
            
            <!-- Lines -->
            <path class="graph-path-sales" d="${salesPathData}" />
            <path class="graph-path-expenses" d="${expensesPathData}" />
            <path class="graph-path-profit" d="${profitPathData}" />
            
            <!-- Labels -->
            ${labelsHtml}
            
            <!-- Hover Points -->
            ${pointsHtml}
        </svg>
    `;

    wrapper.innerHTML = svgHtml;
}

// --- Clients Panel Operations ---
function renderClientsPanel() {
    const container = document.getElementById('clients-cards-container');
    const searchVal = document.getElementById('search-clients').value.toLowerCase();
    
    // Filter clients
    const filtered = state.clients.filter(c => 
        c.name.toLowerCase().includes(searchVal) || 
        c.phone.includes(searchVal)
    );

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state text-center" style="grid-column: 1/-1;">لا يوجد عملاء مطابقين للبحث.</div>`;
        return;
    }

    let html = '';
    for (const client of filtered) {
        // Calculate custom totals for this client
        const clientOrders = state.orders.filter(o => o.client === client.name);
        const totalPurchases = clientOrders.reduce((sum, o) => sum + o.totalPrice, 0);
        const totalRemaining = clientOrders.reduce((sum, o) => sum + o.amountRemaining, 0);
        const totalPaid = totalPurchases - totalRemaining;

        html += `
            <div class="card client-card">
                <div class="client-card-header">
                    <div class="client-avatar">${client.name.charAt(0)}</div>
                    <div class="client-details">
                        <span class="client-name">${client.name}</span>
                        <span class="client-phone">هاتف: ${client.phone}</span>
                    </div>
                </div>
                <div class="client-balances">
                    <div class="balance-item">
                        <span class="balance-label">المدفوعات</span>
                        <span class="balance-val paid">${totalPaid.toFixed(2)} ج.م</span>
                    </div>
                    <div class="balance-item">
                        <span class="balance-label">الديون المستحقة</span>
                        <span class="balance-val debt">${totalRemaining.toFixed(2)} ج.م</span>
                    </div>
                </div>
                <div class="client-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editClient('${client._id}')">تعديل البيانات</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteClient('${client._id}')">حذف</button>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function openClientModal(clientId = '') {
    const form = document.getElementById('form-add-client');
    form.reset();

    if (clientId === '') {
        document.getElementById('client-id').value = '';
        document.getElementById('client-modal-title').innerText = 'تسجيل عميل جديد';
        document.getElementById('btn-save-client').innerText = 'حفظ العميل';
    } else {
        const client = state.clients.find(c => c._id === clientId);
        if (!client) return;

        document.getElementById('client-id').value = client._id;
        document.getElementById('client-modal-title').innerText = `تعديل بيانات العميل: ${client.name}`;
        document.getElementById('btn-save-client').innerText = 'حفظ التعديلات';

        document.getElementById('client-name').value = client.name;
        document.getElementById('client-phone').value = client.phone;
        document.getElementById('client-address').value = client.address || '';
    }
    openModal('modal-add-client');
}

async function handleAddClient(e) {
    e.preventDefault();
    const id = document.getElementById('client-id').value;
    const name = document.getElementById('client-name').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    const address = document.getElementById('client-address').value.trim();

    if (!name) {
        alert("يرجى إدخال اسم العميل.");
        return;
    }
    if (!phone) {
        alert("يرجى إدخال رقم الهاتف.");
        return;
    }

    try {
        if (id === '') {
            await window.api.addClient({ name, phone, address });
        } else {
            await window.api.updateClient(id, { name, phone, address });
        }
        document.getElementById('form-add-client').reset();
        closeModal('modal-add-client');
        await refreshAllData();
        
        // If we opened this from the order modal, update the select
        populateOrderClients();
    } catch (error) {
        alert("فشل حفظ العميل: " + error.message);
    }
}

function editClient(id) {
    openClientModal(id);
}

async function deleteClient(id) {
    const client = state.clients.find(c => c._id === id);
    if (!client) return;

    if (!confirm(`هل أنت متأكد من حذف العميل "${client.name}"؟ سيتم حذف بيانات الاتصال فقط ولن تحذف الطلبات السابقة.`)) return;

    try {
        await window.api.deleteClient(id);
        await refreshAllData();
        populateOrderClients();
    } catch (error) {
        alert("فشل حذف العميل: " + error.message);
    }
}

// --- Suppliers Panel Operations ---
function renderSuppliersPanel() {
    const container = document.getElementById('suppliers-cards-container');
    const searchVal = document.getElementById('search-suppliers').value.toLowerCase();
    
    // Filter suppliers
    const filtered = state.suppliers.filter(s => 
        s.name.toLowerCase().includes(searchVal) || 
        (s.phone && s.phone.includes(searchVal)) ||
        (s.company && s.company.toLowerCase().includes(searchVal))
    );

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state text-center" style="grid-column: 1/-1;">لا يوجد موردون مطابقين للبحث.</div>`;
        return;
    }

    let html = '';
    for (const supplier of filtered) {
        const supplierMaterials = state.materials.filter(m => m.supplier === supplier.name);
        
        html += `
            <div class="card client-card">
                <div class="client-card-header">
                    <div class="client-avatar" style="background: linear-gradient(135deg, var(--warning-color), var(--danger-color));">${supplier.name.charAt(0)}</div>
                    <div class="client-details">
                        <span class="client-name">${supplier.name}</span>
                        <span class="client-phone">الشركة أو المندوب: ${supplier.company || 'غير محدد'}</span>
                        <span class="client-phone">هاتف: ${supplier.phone || 'غير محدد'}</span>
                    </div>
                </div>
                <div class="client-balances" style="margin-top: 1rem;">
                    <div class="balance-item">
                        <span class="balance-label">المواد الموردة</span>
                        <span class="balance-val" style="color: var(--text-primary);">${supplierMaterials.length} مادة</span>
                    </div>
                </div>
                <div class="client-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editSupplier('${supplier._id}')">تعديل البيانات</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSupplier('${supplier._id}')">حذف</button>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function openSupplierModal(supplierId = '') {
    const form = document.getElementById('form-add-supplier');
    form.reset();

    if (supplierId === '') {
        document.getElementById('supplier-id').value = '';
        document.getElementById('supplier-modal-title').innerText = 'إضافة مورد جديد';
        document.getElementById('btn-save-supplier').innerText = 'حفظ المورد';
    } else {
        const supplier = state.suppliers.find(s => s._id === supplierId);
        if (!supplier) return;

        document.getElementById('supplier-id').value = supplier._id;
        document.getElementById('supplier-modal-title').innerText = `تعديل بيانات المورد: ${supplier.name}`;
        document.getElementById('btn-save-supplier').innerText = 'حفظ التعديلات';

        document.getElementById('supplier-name').value = supplier.name;
        document.getElementById('supplier-company').value = supplier.company || '';
        document.getElementById('supplier-phone').value = supplier.phone || '';
        document.getElementById('supplier-address').value = supplier.address || '';
    }
    openModal('modal-add-supplier');
}

async function handleAddSupplier(e) {
    e.preventDefault();
    const id = document.getElementById('supplier-id').value;
    const name = document.getElementById('supplier-name').value.trim();
    const company = document.getElementById('supplier-company').value.trim();
    const phone = document.getElementById('supplier-phone').value.trim();
    const address = document.getElementById('supplier-address').value.trim();

    if (!name) {
        alert("يرجى إدخال اسم المورد.");
        return;
    }
    if (!phone) {
        alert("يرجى إدخال رقم الهاتف.");
        return;
    }

    try {
        if (id === '') {
            await window.api.addSupplier({ name, company, phone, address });
        } else {
            await window.api.updateSupplier(id, { name, company, phone, address });
        }
        document.getElementById('form-add-supplier').reset();
        closeModal('modal-add-supplier');
        await refreshAllData();
        populateMaterialSuppliers();
    } catch (error) {
        alert("فشل حفظ المورد: " + error.message);
    }
}

function editSupplier(id) {
    openSupplierModal(id);
}

async function deleteSupplier(id) {
    const supplier = state.suppliers.find(s => s._id === id);
    if (!supplier) return;

    if (!confirm(`هل أنت متأكد من حذف المورد "${supplier.name}"؟`)) return;

    try {
        await window.api.deleteSupplier(id);
        await refreshAllData();
        populateMaterialSuppliers();
    } catch (error) {
        alert("فشل حذف المورد: " + error.message);
    }
}

// --- Orders Panel Operations ---
function renderOrdersPanel() {
    const tbody = document.getElementById('orders-list-tbody');
    const searchVal = document.getElementById('search-orders').value.toLowerCase();
    
    // Status Filter active check
    const activeFilterBtn = document.querySelector('.filter-btn.active');
    const statusFilter = activeFilterBtn ? activeFilterBtn.dataset.status : 'all';

    let filtered = state.orders.filter(o => 
        o.orderNumber.toLowerCase().includes(searchVal) || 
        o.client.toLowerCase().includes(searchVal)
    );

    if (statusFilter !== 'all') {
        filtered = filtered.filter(o => o.status === statusFilter);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-center text-muted">لا توجد طلبات طباعة تطابق خيارات التصفية الحالية.</td></tr>`;
        return;
    }

    let html = '';
    for (const order of filtered) {
        const createdDate = new Date(order.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' });
        
        let paymentBadge = '';
        if (order.amountRemaining <= 0) {
            paymentBadge = `<span class="badge badge-paid">خالص</span>`;
        } else if (order.amountPaid > 0) {
            paymentBadge = `<span class="badge badge-partial">جزئي</span>`;
        } else {
            paymentBadge = `<span class="badge badge-unpaid">غير مدفوع</span>`;
        }
        
        html += `
            <tr>
                <td><strong>${order.orderNumber}</strong></td>
                <td>${order.client}</td>
                <td>${order.printType === 'Outdoor' ? 'خارجي (Out)' : 'داخلي (In)'}</td>
                <td>${order.materialName}</td>
                <td>${order.width} × ${order.height} م</td>
                <td>${order.totalArea.toFixed(2)} م²</td>
                <td><strong>${order.totalPrice.toFixed(2)} ج.م</strong></td>
                <td><span class="text-success">${order.amountPaid.toFixed(2)}</span></td>
                <td><span class="${order.amountRemaining > 0 ? 'text-warning' : 'text-muted'}">${order.amountRemaining.toFixed(2)}</span></td>
                <td>
                    <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                        ${getStatusBadge(order.status)}
                        ${paymentBadge}
                    </div>
                </td>
                <td>${createdDate}</td>
                <td>
                    <div class="table-actions">
                        <button class="action-btn pay" onclick="openPaymentsModal('${order._id}')" title="تسجيل سداد / دفعة">💳</button>
                        <button class="action-btn edit" onclick="editOrder('${order._id}')" title="تعديل الفاتورة">✏️</button>
                        <button class="action-btn print" onclick="printInvoice('${order._id}')" title="طباعة الفاتورة">🖨️</button>
                        <button class="action-btn delete" onclick="deleteOrder('${order._id}')" title="حذف الفاتورة">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

function openOrderModal(orderId = '') {
    // Populate client and material options
    populateOrderClients();
    populateOrderMaterials(document.getElementById('order-print-type').value);

    const form = document.getElementById('form-add-order');
    form.reset();
    
    if (orderId === '') {
        // Create Mode
        document.getElementById('order-id').value = '';
        document.getElementById('order-modal-title').innerText = 'إنشاء طلب طباعة جديد';
        document.getElementById('btn-save-order').innerText = 'إنشاء وحفظ الطلب';
        document.getElementById('order-status-select').value = 'pending';
        
        document.getElementById('order-amount-paid').readOnly = false;
        document.getElementById('order-amount-paid').placeholder = "0.00";
    } else {
        // Edit Mode
        const order = state.orders.find(o => o._id === orderId);
        if (!order) return;

        document.getElementById('order-id').value = order._id;
        document.getElementById('order-modal-title').innerText = `تعديل طلب الطباعة ${order.orderNumber}`;
        document.getElementById('btn-save-order').innerText = 'حفظ التعديلات';
        
        document.getElementById('order-client-select').value = order.client;
        document.getElementById('order-print-type').value = order.printType;
        
        // Re-populate materials and set selected
        populateOrderMaterials(order.printType);
        document.getElementById('order-material-select').value = order.materialName;
        
        document.getElementById('order-width').value = order.width;
        document.getElementById('order-height').value = order.height;
        document.getElementById('order-quantity').value = order.quantity;
        document.getElementById('order-unit-price').value = order.unitPrice;
        document.getElementById('order-amount-paid').value = order.amountPaid;
        document.getElementById('order-status-select').value = order.status;
        document.getElementById('order-notes').value = order.notes || '';
        // Allow user to edit amount directly if they prefer
        document.getElementById('order-amount-paid').readOnly = false;
        document.getElementById('order-amount-paid').placeholder = "0.00";
    }

    calculateOrderSummary();
    openModal('modal-add-order');
}

function populateOrderClients() {
    const select = document.getElementById('order-client-select');
    let html = '<option value="" disabled selected>اختر العميل المستلم...</option>';
    
    for (const client of state.clients) {
        html += `<option value="${client.name}">${client.name}</option>`;
    }
    select.innerHTML = html;
}

function populateMaterialSuppliers() {
    const select = document.getElementById('material-supplier-select');
    if (!select) return;
    select.innerHTML = '<option value="">-- اختر المورد --</option>';
    state.suppliers.forEach(s => {
        select.innerHTML += `<option value="${s.name}">${s.name}</option>`;
    });
}

function populateOrderMaterials(type) {
    const select = document.getElementById('order-material-select');
    let html = '<option value="" disabled selected>اختر الخامة المناسبة...</option>';
    
    const filtered = state.materials.filter(m => m.type === type);
    for (const mat of filtered) {
        html += `<option value="${mat.name}">${mat.name} (متوفر: ${mat.stock.toFixed(0)} م²)</option>`;
    }
    select.innerHTML = html;
}

function calculateOrderSummary() {
    const width = parseFloat(document.getElementById('order-width').value) || 0;
    const height = parseFloat(document.getElementById('order-height').value) || 0;
    const qty = parseInt(document.getElementById('order-quantity').value) || 1;
    const unitPrice = parseFloat(document.getElementById('order-unit-price').value) || 0;
    const paid = parseFloat(document.getElementById('order-amount-paid').value) || 0;

    const totalArea = width * height * qty;
    const totalPrice = totalArea * unitPrice;
    const remaining = totalPrice - paid;

    document.getElementById('summary-total-area').innerText = `${totalArea.toFixed(2)} م²`;
    document.getElementById('summary-total-price').innerText = `${totalPrice.toFixed(2)} ج.م`;
    document.getElementById('summary-remaining-debt').innerText = `${remaining.toFixed(2)} ج.م`;
}

async function handleAddOrder(e) {
    e.preventDefault();
    
    const orderId = document.getElementById('order-id').value;
    const orderData = {
        client: document.getElementById('order-client-select').value,
        printType: document.getElementById('order-print-type').value,
        materialName: document.getElementById('order-material-select').value,
        width: document.getElementById('order-width').value,
        height: document.getElementById('order-height').value,
        quantity: document.getElementById('order-quantity').value,
        unitPrice: document.getElementById('order-unit-price').value,
        amountPaid: parseFloat(document.getElementById('order-amount-paid').value) || 0,
        status: document.getElementById('order-status-select').value,
        notes: document.getElementById('order-notes').value
    };

    const width = parseFloat(orderData.width);
    const height = parseFloat(orderData.height);
    const quantity = parseInt(orderData.quantity);
    const unitPrice = parseFloat(orderData.unitPrice);
    const amountPaid = parseFloat(orderData.amountPaid);

    if (!orderData.client) {
        alert("يرجى اختيار العميل.");
        return;
    }
    if (!orderData.materialName) {
        alert("يرجى اختيار الخامة.");
        return;
    }
    if (orderData.printType !== 'Indoor' && orderData.printType !== 'Outdoor') {
        alert("نوع الطباعة غير صالح.");
        return;
    }
    if (isNaN(width) || width <= 0) {
        alert("العرض يجب أن يكون رقماً أكبر من الصفر.");
        return;
    }
    if (isNaN(height) || height <= 0) {
        alert("الارتفاع يجب أن يكون رقماً أكبر من الصفر.");
        return;
    }
    if (isNaN(quantity) || quantity < 1) {
        alert("الكمية يجب أن تكون عدداً أكبر من أو يساوي 1.");
        return;
    }
    if (isNaN(unitPrice) || unitPrice <= 0) {
        alert("سعر بيع المتر مربع يجب أن يكون رقماً أكبر من الصفر.");
        return;
    }
    if (isNaN(amountPaid) || amountPaid < 0) {
        alert("المبلغ المدفوع مقدماً يجب أن يكون رقماً أكبر من أو يساوي الصفر.");
        return;
    }

    try {
        if (orderId === '') {
            await window.api.addOrder(orderData);
        } else {
            await window.api.updateOrder(orderId, orderData);
        }
        closeModal('modal-add-order');
        await refreshAllData();
    } catch (error) {
        alert("فشل حفظ الطلب: " + error.message);
    }
}

function editOrder(id) {
    openOrderModal(id);
}

async function deleteOrder(id) {
    const order = state.orders.find(o => o._id === id);
    if (!order) return;

    if (!confirm(`هل أنت متأكد من حذف فاتورة الطلب "${order.orderNumber}"؟ سيتم إعادة خصم الخامة المخزنة تلقائياً بمقدار ${order.totalArea.toFixed(1)} م².`)) return;

    try {
        await window.api.deleteOrder(id);
        await refreshAllData();
    } catch (error) {
        alert("فشل حذف الفاتورة: " + error.message);
    }
}

// --- Inventory Panel Operations ---
function renderInventoryPanel() {
    const container = document.getElementById('inventory-container');
    const searchVal = document.getElementById('search-materials').value.toLowerCase();
    
    const filtered = state.materials.filter(m => m.name.toLowerCase().includes(searchVal));

    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state text-center" style="grid-column: 1/-1;">لا توجد خامات بالمخزن تطابق البحث.</div>`;
        return;
    }

    let html = '';
    // Let's assume a full roll capacity is 500m² for visualization
    const maxCapacity = 500.0;

    for (const mat of filtered) {
        const percent = Math.min(100, Math.max(0, (mat.stock / maxCapacity) * 100));
        
        // Progress ring circle metrics
        const r = 40;
        const c = 2 * Math.PI * r;
        const offset = c - (percent / 100) * c;
        
        const isLow = mat.stock < 50.0;
        const statusClass = isLow ? 'low-stock' : (mat.type === 'Outdoor' ? 'outdoor' : 'indoor');

        html += `
            <div class="card inventory-card">
                <div class="inventory-card-header">
                    <div class="inventory-title-wrap">
                        <h4>${mat.name}</h4>
                        <span class="inventory-type-tag ${mat.type === 'Outdoor' ? 'outdoor' : 'indoor'}">
                            ${mat.type === 'Outdoor' ? 'طباعة خارجية' : 'طباعة داخلية'}
                        </span>
                    </div>
                </div>
                
                <div class="inventory-gauge-container">
                    <svg class="gauge-svg">
                        <circle class="gauge-track" cx="50" cy="50" r="${r}" />
                        <circle class="gauge-fill ${statusClass}" cx="50" cy="50" r="${r}" 
                                stroke-dasharray="${c}" stroke-dashoffset="${offset}" />
                    </svg>
                    <div class="gauge-text">
                        <span class="gauge-val ${isLow ? 'text-danger' : ''}">${mat.stock.toFixed(0)}</span>
                        <span class="gauge-unit">متر مربع</span>
                    </div>
                </div>

                <div class="inventory-financials">
                    <div class="financials-col">
                        <span class="financials-label text-muted">التكلفة / م</span>
                        <span class="financials-val">${mat.costPrice.toFixed(2)} ج.م</span>
                    </div>
                    <div class="financials-col">
                        <span class="financials-label text-muted">سعر المبيع المقدر</span>
                        <span class="financials-val">${mat.sellPrice.toFixed(2)} ج.م</span>
                    </div>
                </div>

                <div class="client-actions" style="margin-top: 10px;">
                    <button class="btn btn-secondary btn-sm" onclick="editMaterial('${mat._id}')">تعديل</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteMaterial('${mat._id}')">حذف</button>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function openMaterialModal(materialId = '') {
    const form = document.getElementById('form-add-material');
    form.reset();
    populateMaterialSuppliers();

    if (materialId === '') {
        document.getElementById('material-id').value = '';
        document.getElementById('material-modal-title').innerText = 'إضافة خامة جديدة للمستودع';
        document.getElementById('btn-save-material').innerText = 'إضافة خامة جديدة';
    } else {
        const mat = state.materials.find(m => m._id === materialId);
        if (!mat) return;

        document.getElementById('material-id').value = mat._id;
        document.getElementById('material-modal-title').innerText = `تعديل الخامة ${mat.name}`;
        document.getElementById('btn-save-material').innerText = 'حفظ التعديلات';

        document.getElementById('material-name').value = mat.name;
        document.getElementById('material-type').value = mat.type;
        document.getElementById('material-stock').value = mat.stock;
        document.getElementById('material-cost').value = mat.costPrice;
        document.getElementById('material-sell').value = mat.sellPrice;
        
        const supplierSelect = document.getElementById('material-supplier-select');
        if (supplierSelect) {
            supplierSelect.value = mat.supplier || '';
        }
    }
    openModal('modal-add-material');
}

async function handleAddMaterial(e) {
    e.preventDefault();

    const id = document.getElementById('material-id').value;
    const materialData = {
        name: document.getElementById('material-name').value.trim(),
        type: document.getElementById('material-type').value,
        stock: document.getElementById('material-stock').value,
        costPrice: document.getElementById('material-cost').value,
        sellPrice: document.getElementById('material-sell').value,
        supplier: document.getElementById('material-supplier-select') ? document.getElementById('material-supplier-select').value : ''
    };

    const stock = parseFloat(materialData.stock);
    const cost = parseFloat(materialData.costPrice);
    const sell = parseFloat(materialData.sellPrice);

    if (!materialData.name) {
        alert("يرجى إدخال اسم الخامة.");
        return;
    }
    if (materialData.type !== 'Indoor' && materialData.type !== 'Outdoor') {
        alert("نوع الخامة غير صالح.");
        return;
    }
    if (isNaN(stock) || stock < 0) {
        alert("الكمية يجب أن تكون رقماً أكبر من أو يساوي الصفر.");
        return;
    }
    if (isNaN(cost) || cost <= 0) {
        alert("سعر التكلفة يجب أن يكون رقماً أكبر من الصفر.");
        return;
    }
    if (isNaN(sell) || sell <= 0) {
        alert("سعر البيع يجب أن يكون رقماً أكبر من الصفر.");
        return;
    }

    try {
        if (id === '') {
            await window.api.addMaterial(materialData);
        } else {
            await window.api.updateMaterial(id, materialData);
        }
        closeModal('modal-add-material');
        await refreshAllData();
    } catch (error) {
        alert("فشل حفظ الخامة: " + error.message);
    }
}

function editMaterial(id) {
    openMaterialModal(id);
}

async function deleteMaterial(id) {
    const mat = state.materials.find(m => m._id === id);
    if (!mat) return;

    if (!confirm(`هل أنت متأكد من حذف الخامة "${mat.name}" من المخازن؟`)) return;

    try {
        await window.api.deleteMaterial(id);
        await refreshAllData();
    } catch (error) {
        alert("فشل حذف المادة: " + error.message);
    }
}

// --- Expenses Panel Operations ---
function renderExpensesPanel() {
    const tbody = document.getElementById('expenses-list-tbody');
    tbody.innerHTML = '';

    // Set default date picker value to today
    if (!document.getElementById('expense-date').value) {
        document.getElementById('expense-date').value = new Date().toISOString().slice(0, 10);
    }

    if (state.expenses.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">لم يتم قيد أي مصروفات تشغيلية بعد.</td></tr>`;
        return;
    }

    let html = '';
    for (const exp of state.expenses) {
        html += `
            <tr>
                <td><strong>${exp.category}</strong></td>
                <td>${exp.description}</td>
                <td><strong class="text-danger">${exp.amount.toFixed(2)} ج.م</strong></td>
                <td>${exp.date}</td>
                <td>
                    <button class="action-btn delete" onclick="deleteExpense('${exp._id}')">🗑️</button>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

async function handleAddExpense(e) {
    e.preventDefault();
    const category = document.getElementById('expense-category').value;
    const amount = document.getElementById('expense-amount').value;
    const description = document.getElementById('expense-description').value.trim();
    const date = document.getElementById('expense-date').value;

    const parsedAmount = parseFloat(amount);
    if (!category) {
        alert("يرجى اختيار بند المصروف.");
        return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        alert("قيمة المصروف يجب أن تكون رقماً أكبر من الصفر.");
        return;
    }
    if (!description) {
        alert("يرجى كتابة وصف للمصروف.");
        return;
    }
    if (!date) {
        alert("يرجى تحديد تاريخ المصروف.");
        return;
    }

    try {
        await window.api.addExpense({ category, amount, description, date });
        document.getElementById('form-add-expense').reset();
        document.getElementById('expense-date').value = new Date().toISOString().slice(0, 10);
        await refreshAllData();
    } catch (error) {
        alert("فشل قيد المصروف: " + error.message);
    }
}

async function deleteExpense(id) {
    if (!confirm("هل أنت متأكد من حذف هذا القيد المالي للمصروف؟")) return;

    try {
        await window.api.deleteExpense(id);
        await refreshAllData();
    } catch (error) {
        alert("فشل حذف المصروف: " + error.message);
    }
}

// --- Reports & Analytics ---
function renderReports(monthYearString) {
    if (!monthYearString) return;
    const [year, month] = monthYearString.split('-').map(Number);
    const targetMonthIndex = month - 1; // Date.getMonth() is 0-indexed

    // Filter data matching selected period
    const filteredOrders = state.orders.filter(o => {
        const date = new Date(o.createdAt);
        return date.getFullYear() === year && date.getMonth() === targetMonthIndex;
    });

    const filteredExpenses = state.expenses.filter(e => {
        const date = new Date(e.date);
        return date.getFullYear() === year && date.getMonth() === targetMonthIndex;
    });

    // Calculations
    const salesTotal = filteredOrders.reduce((sum, o) => sum + o.totalPrice, 0);
    const expensesTotal = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    // Estimate cost of materials consumed in that period
    const materialCostTotal = filteredOrders.reduce((sum, o) => {
        const mat = state.materials.find(m => m.name === o.materialName);
        const cost = mat ? mat.costPrice : 0;
        return sum + (o.totalArea * cost);
    }, 0);

    const netProfit = salesTotal - (expensesTotal + materialCostTotal);

    // Update Report Header totals
    document.getElementById('report-sales').innerText = `${salesTotal.toFixed(2)} ج.م`;
    document.getElementById('report-expenses').innerText = `${expensesTotal.toFixed(2)} ج.م`;
    document.getElementById('report-material-cost').innerText = `${materialCostTotal.toFixed(2)} ج.م`;
    
    const netProfitEl = document.getElementById('report-net-profit');
    netProfitEl.innerText = `${netProfit.toFixed(2)} ج.م`;
    if (netProfit >= 0) {
        netProfitEl.className = 'stat-value text-success';
    } else {
        netProfitEl.className = 'stat-value text-danger';
    }

    // Render Orders list for reports
    const reportOrdersTbody = document.getElementById('report-orders-tbody');
    if (filteredOrders.length === 0) {
        reportOrdersTbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">لم تنفذ أي طلبات طباعة في هذا الشهر.</td></tr>`;
    } else {
        let html = '';
        for (const o of filteredOrders) {
            html += `
                <tr>
                    <td>${o.orderNumber}</td>
                    <td>${o.client}</td>
                    <td>${o.materialName.split(' ')[0]}</td>
                    <td>${o.totalArea.toFixed(1)} م²</td>
                    <td>${o.totalPrice.toFixed(2)} ج.م</td>
                    <td>${getStatusBadge(o.status)}</td>
                </tr>
            `;
        }
        reportOrdersTbody.innerHTML = html;
    }

    // Render Expense categories breakdown
    const breakdownContainer = document.getElementById('report-expense-breakdown');
    breakdownContainer.innerHTML = '';
    
    const categories = [
        'أحبار ومستلزمات', 'صيانة ماكينات', 'رواتب وأجور', 'إيجار المقر', 'كهرباء ومرافق', 'دعاية وإعلان', 'مصاريف أخرى'
    ];

    const categoryAmounts = categories.map(cat => {
        const amt = filteredExpenses
            .filter(e => e.category === cat)
            .reduce((sum, e) => sum + e.amount, 0);
        return { name: cat, amount: amt };
    }).filter(c => c.amount > 0);

    if (categoryAmounts.length === 0) {
        breakdownContainer.innerHTML = `<div class="empty-state text-center">لا توجد مصروفات مسجلة للمدة المحددة.</div>`;
        return;
    }

    const maxExpAmt = Math.max(...categoryAmounts.map(c => c.amount));
    
    let breakdownHtml = '';
    for (const cat of categoryAmounts) {
        const percent = (cat.amount / maxExpAmt) * 100;
        breakdownHtml += `
            <div class="expense-breakdown-item">
                <div class="eb-label-row">
                    <span class="eb-label-name">${cat.name}</span>
                    <span class="eb-label-amount">${cat.amount.toFixed(2)} ج.م</span>
                </div>
                <div class="eb-bar-track">
                    <div class="eb-bar-fill" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }
    breakdownContainer.innerHTML = breakdownHtml;
}

// --- Shop settings ---
function handleSaveSettings(e) {
    e.preventDefault();
    state.shopSettings = {
        address: document.getElementById('shop-address').value.trim(),
        phone: document.getElementById('shop-phone').value.trim(),
        taxNo: document.getElementById('shop-tax-no').value.trim()
    };
    
    localStorage.setItem('karma_print_settings', JSON.stringify(state.shopSettings));
    alert("تم حفظ إعدادات الفاتورة بنجاح!");
}

function printFinancialReport() {
    const printContainer = document.getElementById('invoice-print-section');
    const monthStr = document.getElementById('report-month-select').value;
    
    const sales = document.getElementById('report-sales').innerText;
    const expenses = document.getElementById('report-expenses').innerText;
    const materials = document.getElementById('report-material-cost').innerText;
    const netProfit = document.getElementById('report-net-profit').innerText;
    
    const reportOrdersHtml = document.getElementById('report-orders-tbody').innerHTML;

    printContainer.innerHTML = `
        <div class="print-invoice-header">
            <div class="print-logo-section">
                <img src="../logo.png" alt="Logo" class="print-logo" onerror="this.style.display='none'">
                <div>
                    <h1 style="font-size: 20px; font-weight: 800; color: #000;">مطبعة كارما برنت</h1>
                    <span style="font-size: 10px; color: #555;">التقرير المالي لفترة: ${monthStr}</span>
                </div>
            </div>
        </div>
        
        <div class="print-invoice-title">ملخص التقرير المالي</div>
        
        <table class="print-table" style="margin-bottom: 20px;">
            <thead>
                <tr>
                    <th>المبيعات</th>
                    <th>المصروفات</th>
                    <th>تكلفة الخامات</th>
                    <th>صافي الربح</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>${sales}</strong></td>
                    <td><strong>${expenses}</strong></td>
                    <td><strong>${materials}</strong></td>
                    <td><strong style="color: #000;">${netProfit}</strong></td>
                </tr>
            </tbody>
        </table>
        
        <h3 style="font-family: 'Cairo', sans-serif; font-size: 16px; margin-bottom: 10px;">الطلبات المنفذة</h3>
        <table class="print-table">
            <thead>
                <tr>
                    <th>رقم الطلب</th>
                    <th>العميل</th>
                    <th>الخامة</th>
                    <th>المساحة</th>
                    <th>الإجمالي</th>
                    <th>الحالة</th>
                </tr>
            </thead>
            <tbody>
                ${reportOrdersHtml}
            </tbody>
        </table>
    `;
    
    window.print();
}

// --- Invoice Printer Engine ---
function printInvoice(orderId) {
    const order = state.orders.find(o => o._id === orderId);
    if (!order) return;

    const printContainer = document.getElementById('invoice-print-section');
    const createdDate = new Date(order.createdAt).toLocaleDateString('ar-EG', { 
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    // Populate Print Template
    printContainer.innerHTML = `
        <div class="print-invoice-header">
            <div class="print-logo-section">
                <img src="../logo.png" alt="Logo" class="print-logo" onerror="this.style.display='none'">
                <div>
                    <h1 style="font-size: 20px; font-weight: 800; color: #000;">مطبعة كارما برنت</h1>
                    <span style="font-size: 10px; color: #555;">للأعمال الدعائية والإعلانية والطباعة الرقمية</span>
                </div>
            </div>
            <div class="print-shop-details">
                <strong>الرقم الضريبي: ${state.shopSettings.taxNo}</strong>
                <span>الهاتف: ${state.shopSettings.phone}</span>
                <span>العنوان: ${state.shopSettings.address}</span>
            </div>
        </div>

        <div class="print-invoice-title">فاتورة ضريبية مبسطة</div>

        <div class="print-billing-details">
            <div class="print-client-col">
                <strong>الفاتورة صادرة إلى السيد / السادة:</strong>
                <span style="font-size: 14px; font-weight: 700; margin-top: 5px;">${order.client}</span>
                <span>تاريخ الفاتورة: ${createdDate}</span>
            </div>
            <div class="print-meta-col">
                <span>رقم الفاتورة: <strong>${order.orderNumber}</strong></span>
                <span>طبيعة الطباعة: ${order.printType === 'Outdoor' ? 'خارجية (Outdoor)' : 'داخلية (Indoor)'}</span>
                <span>حالة التسليم: <strong>${order.status === 'delivered' ? 'تم التسليم' : 'معلّق قيد التجهيز'}</strong></span>
            </div>
        </div>

        <table class="print-table">
            <thead>
                <tr>
                    <th>وصف الخامة المستخدمة</th>
                    <th>الأبعاد (عرض × ارتفاع)</th>
                    <th>الكمية</th>
                    <th>المساحة الإجمالية</th>
                    <th>سعر المتر مربع</th>
                    <th>المجموع الفرعي</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td><strong>${order.materialName}</strong></td>
                    <td>${order.width.toFixed(2)} × ${order.height.toFixed(2)} متر</td>
                    <td>${order.quantity}</td>
                    <td>${order.totalArea.toFixed(2)} م²</td>
                    <td>${order.unitPrice.toFixed(2)} ج.م</td>
                    <td><strong>${order.totalPrice.toFixed(2)} ج.م</strong></td>
                </tr>
                ${order.notes ? `<tr><td colspan="6" style="font-size: 11px; color: #555; background-color: #fafafa;"><strong>ملاحظات الطباعة:</strong> ${order.notes}</td></tr>` : ''}
            </tbody>
        </table>

        <div class="print-summary-box">
            <table class="print-summary-table">
                <tr>
                    <td>الإجمالي الخاضع للضريبة (15%):</td>
                    <td>${(order.totalPrice / 1.15).toFixed(2)} ج.م</td>
                </tr>
                <tr>
                    <td>ضريبة القيمة المضافة (15%):</td>
                    <td>${(order.totalPrice - (order.totalPrice / 1.15)).toFixed(2)} ج.م</td>
                </tr>
                <tr class="total-row">
                    <td>المجموع الإجمالي المطلوب (شامل الضريبة):</td>
                    <td><strong>${order.totalPrice.toFixed(2)} ج.م</strong></td>
                </tr>
                <tr>
                    <td>المبلغ المدفوع مقدماً:</td>
                    <td style="color: #00e676; font-weight: 700;">${order.amountPaid.toFixed(2)} ج.م</td>
                </tr>
                <tr style="border-top: 2px solid #000;">
                    <td><strong>المبلغ المتبقي المعلق:</strong></td>
                    <td style="color: ${order.amountRemaining > 0 ? '#ffab00' : '#000'}; font-weight: 800;">
                        <strong>${order.amountRemaining.toFixed(2)} ج.م</strong>
                    </td>
                </tr>
            </table>
        </div>

        <div class="print-footer">
            <p>شكراً لتعاملكم مع مطبعة كارما برنت الرقمية - فواتيركم مدعومة محلياً ومرخصة</p>
            <p>جميع الأسعار تشمل ضريبة القيمة المضافة بمعدل 15%</p>
        </div>
    `;

    // Trigger System Print Dialogue
    window.print();
}

// --- Database Tools & Backups ---
async function handleExportDB() {
    const res = await window.api.exportDatabase();
    if (res.success) {
        alert(`تم تصدير نسخة احتياطية من قاعدة البيانات بنجاح في المسار:\n${res.path}`);
    } else if (!res.cancelled) {
        alert(`فشل تصدير قاعدة البيانات:\n${res.error}`);
    }
}

async function handleImportDB() {
    if (!confirm("تحذير مهم: استيراد قاعدة بيانات سابقة سيؤدي إلى مسح كافة البيانات الحالية بالكامل واستبدالها ببيانات الملف. هل تود الاستمرار في الاستيراد؟")) return;

    const res = await window.api.importDatabase();
    if (res.success) {
        alert("تم استيراد قاعدة البيانات واستعادة كافة الحسابات والخامات بنجاح!");
        await refreshAllData();
    } else if (!res.cancelled) {
        alert(`فشل استيراد قاعدة البيانات:\n${res.error}`);
    }
}

async function handleResetDB() {
    if (!confirm("تحذير نهائي: هل تريد حقاً مسح كافة بيانات المطبعة (العملاء، الطلبات، الفواتير، المصاريف) وإعادة تشغيل البرنامج من الصفر بالكامل؟")) return;

    const res = await window.api.resetDatabase();
    if (res.success) {
        alert("تم إعادة تهيئة قاعدة البيانات بنجاح، وتثبيت الخامات والمواد الافتراضية بنجاح.");
        await refreshAllData();
    } else {
        alert(`فشل إعادة تهيئة قاعدة البيانات:\n${res.error}`);
    }
}

// --- Payments Panel Operations ---

let currentPaymentOrderId = null;

function openPaymentsModal(orderId) {
    const order = state.orders.find(o => o._id === orderId);
    if (!order) return;

    currentPaymentOrderId = orderId;
    
    // Set Summary Data
    document.getElementById('pay-summary-order-no').innerText = order.orderNumber;
    document.getElementById('pay-summary-client').innerText = order.client;
    document.getElementById('pay-summary-total').innerText = order.totalPrice.toFixed(2) + ' ج.م';
    document.getElementById('pay-summary-paid').innerText = order.amountPaid.toFixed(2) + ' ج.م';
    document.getElementById('pay-summary-remaining').innerText = order.amountRemaining.toFixed(2) + ' ج.م';

    // Set Modal Title
    document.getElementById('payments-modal-title').innerText = `إدارة دفعات الطلب #${order.orderNumber}`;

    // Reset Form
    cancelPaymentEdit();

    // Render Payments Table
    renderOrderPayments(orderId);

    openModal('modal-manage-payments');
}

function renderOrderPayments(orderId) {
    const tbody = document.getElementById('order-payments-list-tbody');
    const orderPayments = state.payments.filter(p => p.orderId === orderId);

    if (orderPayments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">لا توجد دفعات مسجلة لهذا الطلب.</td></tr>`;
        return;
    }

    let html = '';
    for (const p of orderPayments) {
        const dateStr = new Date(p.date).toLocaleDateString('ar-EG');
        html += `
            <tr>
                <td><strong>${p.amount.toFixed(2)}</strong></td>
                <td>${dateStr}</td>
                <td>${p.notes || '-'}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="editPayment('${p._id}')">تعديل</button>
                    <button class="btn btn-danger btn-sm" onclick="deletePayment('${p._id}')">حذف</button>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
}

async function handleRecordPayment(e) {
    e.preventDefault();

    if (!currentPaymentOrderId) return;

    const paymentId = document.getElementById('payment-id').value;
    const amount = parseFloat(document.getElementById('payment-amount').value);
    const date = document.getElementById('payment-date').value;
    const notes = document.getElementById('payment-notes').value.trim();

    if (isNaN(amount) || amount <= 0) {
        alert("يرجى إدخال مبلغ صحيح أكبر من الصفر.");
        return;
    }
    if (!date) {
        alert("يرجى تحديد تاريخ الدفعة.");
        return;
    }

    try {
        if (paymentId === '') {
            await window.api.addPayment({
                orderId: currentPaymentOrderId,
                amount,
                date,
                notes
            });
        } else {
            await window.api.updatePayment(paymentId, { amount, date, notes });
        }
        
        // Refresh all data
        await refreshAllData();
        
        // Re-open/update modal state to show updated totals
        openPaymentsModal(currentPaymentOrderId);
    } catch (error) {
        alert("فشل حفظ الدفعة: " + error.message);
    }
}

function editPayment(id) {
    const payment = state.payments.find(p => p._id === id);
    if (!payment) return;

    document.getElementById('payment-id').value = payment._id;
    document.getElementById('payment-amount').value = payment.amount;
    
    // Format date for input[type="date"]
    const d = new Date(payment.date);
    const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    document.getElementById('payment-date').value = dateString;
    
    document.getElementById('payment-notes').value = payment.notes || '';
    
    document.getElementById('payment-form-title').innerText = 'تعديل بيانات الدفعة';
    document.getElementById('btn-save-payment').innerText = 'حفظ التعديلات';
    document.getElementById('btn-cancel-payment-edit').style.display = 'inline-block';
}

function cancelPaymentEdit() {
    document.getElementById('form-record-payment').reset();
    document.getElementById('payment-id').value = '';
    
    // Set default date to today
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    document.getElementById('payment-date').value = todayStr;
    
    document.getElementById('payment-form-title').innerText = 'تسجيل دفعة جديدة';
    document.getElementById('btn-save-payment').innerText = 'تسجيل وإضافة الدفعة';
    document.getElementById('btn-cancel-payment-edit').style.display = 'none';
}

async function deletePayment(id) {
    if (!confirm('هل أنت متأكد من حذف هذه الدفعة؟ سيتم إعادة حساب متبقي الطلب.')) return;

    try {
        await window.api.deletePayment(id);
        await refreshAllData();
        if (currentPaymentOrderId) {
            openPaymentsModal(currentPaymentOrderId);
        }
    } catch (error) {
        alert("فشل حذف الدفعة: " + error.message);
    }
}

// --- Supplier Invoices Panel Operations ---
function renderSupplierInvoicesPanel() {
    const query = document.getElementById('search-supplier-invoices').value.toLowerCase();
    const activeFilterBtn = document.querySelector('#filter-supplier-invoices .filter-btn.active');
    const statusFilter = activeFilterBtn ? activeFilterBtn.dataset.status : 'all';
    
    const tbody = document.getElementById('supplier-invoices-list-tbody');
    tbody.innerHTML = '';

    const filtered = state.supplierInvoices.filter(inv => {
        // Calculate payment status dynamically
        const invPayments = state.supplierPayments.filter(p => p.invoiceId === inv._id);
        const totalPaid = invPayments.reduce((sum, p) => sum + p.amount, 0) + (invPayments.length === 0 ? inv.amountPaid : 0);
        const totalRemaining = Math.max(0, inv.totalPrice - totalPaid);
        let pStatus = 'unpaid';
        if (totalPaid >= inv.totalPrice) pStatus = 'paid';
        else if (totalPaid > 0) pStatus = 'partial';
        
        // Ensure inv object has up-to-date values for table display
        inv.actualPaid = totalPaid;
        inv.actualRemaining = totalRemaining;

        // Apply Status Filter
        if (statusFilter !== 'all' && pStatus !== statusFilter) return false;

        // Apply Search Query
        const q = query.trim();
        if (!q) return true;
        return (inv.invoiceNumber && inv.invoiceNumber.toLowerCase().includes(q)) ||
               (inv.supplierName && inv.supplierName.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted">لا توجد فواتير موردين مسجلة أو مطابقة للبحث.</td></tr>`;
        return;
    }

    filtered.forEach(inv => {
        let badgeClass = 'status-pending';
        let badgeText = 'غير مدفوع';
        if (inv.actualPaid >= inv.totalPrice) {
            badgeClass = 'status-delivered';
            badgeText = 'خالص';
        } else if (inv.actualPaid > 0) {
            badgeClass = 'status-ready';
            badgeText = 'دفعة جزئية';
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${inv.invoiceNumber}</td>
            <td><strong>${inv.supplierName}</strong></td>
            <td>${inv.materialName}</td>
            <td>${inv.quantity}</td>
            <td>${inv.unitPrice.toFixed(2)}</td>
            <td>${inv.totalPrice.toFixed(2)}</td>
            <td><strong class="text-success">${inv.actualPaid.toFixed(2)}</strong></td>
            <td><strong style="color: ${inv.actualRemaining > 0 ? '#d32f2f' : '#388e3c'};">${inv.actualRemaining.toFixed(2)}</strong></td>
            <td><span class="status-badge ${badgeClass}">${badgeText}</span></td>
            <td>${inv.date}</td>
            <td>
                <div class="table-actions">
                    <button class="action-btn pay" onclick="openSupplierPaymentsModal('${inv._id}')" title="تسجيل سداد / دفعة">💳</button>
                    <button class="action-btn edit" onclick="editSupplierInvoice('${inv._id}')" title="تعديل الفاتورة">✏️</button>
                    <button class="action-btn print" onclick="printSupplierInvoice('${inv._id}')" title="طباعة الفاتورة">🖨️</button>
                    <button class="action-btn delete" onclick="deleteSupplierInvoice('${inv._id}')" title="حذف الفاتورة">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function openSupplierInvoiceModal(id = null) {
    const modal = document.getElementById('modal-add-supplier-invoice');
    const form = document.getElementById('form-add-supplier-invoice');
    
    // Populate Selects
    const supplierSel = document.getElementById('supplier-invoice-supplier');
    const materialSel = document.getElementById('supplier-invoice-material');
    
    supplierSel.innerHTML = '<option value="" disabled selected>اختر المورد...</option>';
    state.suppliers.forEach(sup => {
        supplierSel.innerHTML += `<option value="${sup.name}">${sup.name}${sup.company ? ' - ' + sup.company : ''}</option>`;
    });

    materialSel.innerHTML = '<option value="" disabled selected>اختر الخامة...</option>';
    state.materials.forEach(mat => {
        materialSel.innerHTML += `<option value="${mat.name}">${mat.name} (${mat.type})</option>`;
    });

    if (id) {
        const inv = state.supplierInvoices.find(i => i._id === id);
        if (inv) {
            document.getElementById('supplier-invoice-modal-title').innerText = 'تعديل فاتورة مورد';
            document.getElementById('supplier-invoice-id').value = inv._id;
            document.getElementById('supplier-invoice-number').value = inv.invoiceNumber;
            document.getElementById('supplier-invoice-date').value = inv.date;
            document.getElementById('supplier-invoice-supplier').value = inv.supplierName;
            document.getElementById('supplier-invoice-material').value = inv.materialName;
            document.getElementById('supplier-invoice-quantity').value = inv.quantity;
            document.getElementById('supplier-invoice-unit-price').value = inv.unitPrice;
            document.getElementById('supplier-invoice-amount-paid').value = inv.amountPaid;
            document.getElementById('supplier-invoice-payment-method').value = inv.paymentMethod || 'cash';
            document.getElementById('supplier-invoice-notes').value = inv.notes || '';
        }
    } else {
        document.getElementById('supplier-invoice-modal-title').innerText = 'تسجيل فاتورة مورد';
        form.reset();
        document.getElementById('supplier-invoice-id').value = '';
        document.getElementById('supplier-invoice-date').value = new Date().toISOString().slice(0, 10);
    }

    modal.classList.add('active');
}

async function handleAddSupplierInvoice(e) {
    e.preventDefault();
    const id = document.getElementById('supplier-invoice-id').value;
    const invoiceData = {
        invoiceNumber: document.getElementById('supplier-invoice-number').value,
        date: document.getElementById('supplier-invoice-date').value,
        supplierName: document.getElementById('supplier-invoice-supplier').value,
        materialName: document.getElementById('supplier-invoice-material').value,
        quantity: document.getElementById('supplier-invoice-quantity').value,
        unitPrice: document.getElementById('supplier-invoice-unit-price').value,
        amountPaid: parseFloat(document.getElementById('supplier-invoice-amount-paid').value) || 0,
        paymentMethod: document.getElementById('supplier-invoice-payment-method').value,
        notes: document.getElementById('supplier-invoice-notes').value
    };

    try {
        if (id) {
            await window.api.updateSupplierInvoice(id, invoiceData);
        } else {
            await window.api.addSupplierInvoice(invoiceData);
        }
        closeModal('modal-add-supplier-invoice');
        await refreshAllData();
    } catch (error) {
        alert("فشل حفظ فاتورة المورد: " + error.message);
    }
}

function editSupplierInvoice(id) {
    openSupplierInvoiceModal(id);
}

async function deleteSupplierInvoice(id) {
    const inv = state.supplierInvoices.find(i => i._id === id);
    if (!inv) return;

    if (!confirm(`هل أنت متأكد من حذف فاتورة المورد رقم "${inv.invoiceNumber}"؟ سيتم خصم الكمية من المستودع.`)) return;

    try {
        await window.api.deleteSupplierInvoice(id);
        await refreshAllData();
    } catch (error) {
        alert("فشل حذف الفاتورة: " + error.message);
    }
}

function printSupplierInvoice(invoiceId) {
    const inv = state.supplierInvoices.find(i => i._id === invoiceId);
    if (!inv) return;

    const printContainer = document.getElementById('invoice-print-section');
    const createdDate = new Date(inv.date).toLocaleDateString('ar-EG', { 
        year: 'numeric', month: 'long', day: 'numeric'
    });
    
    const methodMap = { cash: 'نقدي', transfer: 'تحويل بنكي', deferred: 'آجل' };
    const methodStr = methodMap[inv.paymentMethod] || inv.paymentMethod;

    const remaining = inv.totalPrice - inv.amountPaid;

    printContainer.innerHTML = `
        <div class="print-invoice-header">
            <div class="print-logo-section">
                <img src="../logo.png" alt="Logo" class="print-logo" onerror="this.style.display='none'">
                <div>
                    <h1 style="font-size: 20px; font-weight: 800; color: #000;">مطبعة كارما برنت</h1>
                    <span style="font-size: 10px; color: #555;">للأعمال الدعائية والإعلانية والطباعة الرقمية</span>
                </div>
            </div>
            <div class="print-shop-details">
                <strong>الرقم الضريبي: ${state.shopSettings.taxNo}</strong>
                <span>الهاتف: ${state.shopSettings.phone}</span>
                <span>العنوان: ${state.shopSettings.address}</span>
            </div>
        </div>

        <div class="print-invoice-title" style="background-color: #f0f0f0; padding: 10px; text-align: center; border: 1px solid #ddd; margin: 15px 0;">
            <strong style="font-size: 18px;">فاتورة مورد - أمر شراء</strong>
        </div>

        <div class="print-billing-details" style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <div class="print-client-col">
                <strong>صادرة من المورد:</strong>
                <span style="font-size: 16px; font-weight: 800; color: #1565C0; margin-top: 5px;">${inv.supplierName}</span>
                <span>تاريخ الفاتورة: <strong>${createdDate}</strong></span>
            </div>
            <div class="print-meta-col" style="text-align: left;">
                <span>رقم الفاتورة: <strong style="color: #D84315; font-size: 16px;">${inv.invoiceNumber}</strong></span>
                <span>طريقة السداد: <strong>${methodStr}</strong></span>
            </div>
        </div>

        <table class="print-table" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
                <tr style="background-color: #e0e0e0; text-align: right;">
                    <th style="padding: 8px; border: 1px solid #ccc;">الخامة المشتراة</th>
                    <th style="padding: 8px; border: 1px solid #ccc;">الكمية</th>
                    <th style="padding: 8px; border: 1px solid #ccc;">سعر الوحدة</th>
                    <th style="padding: 8px; border: 1px solid #ccc;">المجموع الفرعي</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 8px; border: 1px solid #ccc;"><strong>${inv.materialName}</strong></td>
                    <td style="padding: 8px; border: 1px solid #ccc; font-weight: bold; color: #0277BD; font-size: 15px;">${inv.quantity}</td>
                    <td style="padding: 8px; border: 1px solid #ccc; font-weight: bold; color: #0277BD; font-size: 15px;">${inv.unitPrice.toFixed(2)} ج.م</td>
                    <td style="padding: 8px; border: 1px solid #ccc; font-weight: bold; color: #2E7D32; font-size: 16px;">${inv.totalPrice.toFixed(2)} ج.م</td>
                </tr>
                ${inv.notes ? `<tr><td colspan="4" style="font-size: 12px; color: #555; background-color: #fafafa; padding: 8px; border: 1px solid #ccc;"><strong>ملاحظات:</strong> ${inv.notes}</td></tr>` : ''}
            </tbody>
        </table>

        <div class="print-summary-box" style="margin-top: 20px; border-top: 2px solid #000; padding-top: 10px;">
            <table class="print-summary-table" style="width: 100%; text-align: left;">
                <tr style="font-size: 16px;">
                    <td style="padding: 5px; text-align: right;"><strong>المجموع الإجمالي:</strong></td>
                    <td style="padding: 5px; color: #1565C0; font-weight: 900; font-size: 18px;">${inv.totalPrice.toFixed(2)} ج.م</td>
                </tr>
                <tr style="font-size: 16px;">
                    <td style="padding: 5px; text-align: right;">المبلغ المدفوع:</td>
                    <td style="padding: 5px; color: #2E7D32; font-weight: 900; font-size: 18px;">${inv.amountPaid.toFixed(2)} ج.م</td>
                </tr>
                <tr style="font-size: 16px; border-top: 1px dashed #aaa;">
                    <td style="padding: 5px; text-align: right;"><strong>المبلغ المتبقي:</strong></td>
                    <td style="padding: 5px; color: ${remaining > 0 ? '#D84315' : '#2E7D32'}; font-weight: 900; font-size: 18px;">
                        ${remaining.toFixed(2)} ج.م
                    </td>
                </tr>
            </table>
        </div>

        <div class="print-footer" style="margin-top: 40px; text-align: center; font-size: 12px; color: #777;">
            <p>تم تسجيل هذه الفاتورة في نظام مطبعة كارما برنت للإدارة الداخلية.</p>
        </div>
    `;

    // Trigger System Print Dialogue
    window.print();
}

// --- Supplier Payments Operations ---
function openSupplierPaymentsModal(invoiceId) {
    document.getElementById('supplier-payment-invoice-id').value = invoiceId;
    document.getElementById('supplier-payment-id').value = '';
    document.getElementById('form-record-supplier-payment').reset();
    document.getElementById('supplier-payment-date').value = new Date().toISOString().slice(0, 10);
    
    document.getElementById('supplier-payment-form-title').innerText = 'تسجيل دفعة جديدة';
    document.getElementById('btn-save-supplier-payment').innerText = 'حفظ الدفعة الجديدة';
    document.getElementById('btn-cancel-supplier-payment-edit').style.display = 'none';

    renderSupplierPayments(invoiceId);
    openModal('modal-manage-supplier-payments');
}

function renderSupplierPayments(invoiceId) {
    const inv = state.supplierInvoices.find(i => i._id === invoiceId);
    if (!inv) return;

    // Fill Summary
    document.getElementById('sup-pay-summary-invoice-no').innerText = inv.invoiceNumber;
    document.getElementById('sup-pay-summary-supplier').innerText = inv.supplierName;
    document.getElementById('sup-pay-summary-total').innerText = `${inv.totalPrice.toFixed(2)} ج.م`;

    const invPayments = state.supplierPayments.filter(p => p.invoiceId === invoiceId);
    const tbody = document.getElementById('supplier-payments-list-tbody');
    tbody.innerHTML = '';

    let totalPaid = 0;

    if (invPayments.length === 0) {
        if (inv.amountPaid > 0) {
            totalPaid = inv.amountPaid;
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">تم دفع ${inv.amountPaid} ج.م مقدماً ولم تسجل دفعات منفصلة.</td></tr>`;
        } else {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">لا توجد دفعات مسجلة لهذه الفاتورة.</td></tr>`;
        }
    } else {
        invPayments.forEach(p => {
            totalPaid += p.amount;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${p.amount.toFixed(2)}</strong></td>
                <td>${p.date}</td>
                <td>${p.notes || '-'}</td>
                <td>
                    <button type="button" class="action-btn edit" onclick="editSupplierPayment('${p._id}')" title="تعديل">✏️</button>
                    <button type="button" class="action-btn delete" onclick="deleteSupplierPayment('${p._id}')" title="حذف">🗑️</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    const remaining = Math.max(0, inv.totalPrice - totalPaid);

    document.getElementById('sup-pay-summary-paid').innerText = `${totalPaid.toFixed(2)} ج.م`;
    document.getElementById('sup-pay-summary-remaining').innerText = `${remaining.toFixed(2)} ج.م`;
}

async function handleRecordSupplierPayment(e) {
    e.preventDefault();
    const paymentId = document.getElementById('supplier-payment-id').value;
    const invoiceId = document.getElementById('supplier-payment-invoice-id').value;
    
    const paymentData = {
        invoiceId: invoiceId,
        amount: document.getElementById('supplier-payment-amount').value,
        date: document.getElementById('supplier-payment-date').value,
        notes: document.getElementById('supplier-payment-notes').value
    };

    try {
        if (paymentId) {
            await window.api.updateSupplierPayment(paymentId, paymentData);
        } else {
            await window.api.addSupplierPayment(paymentData);
        }
        
        await refreshAllData();
        renderSupplierPayments(invoiceId);
        cancelSupplierPaymentEdit();
    } catch (error) {
        alert('فشل حفظ الدفعة: ' + error.message);
    }
}

function editSupplierPayment(paymentId) {
    const p = state.supplierPayments.find(x => x._id === paymentId);
    if (!p) return;

    document.getElementById('supplier-payment-id').value = p._id;
    document.getElementById('supplier-payment-amount').value = p.amount;
    document.getElementById('supplier-payment-date').value = p.date;
    document.getElementById('supplier-payment-notes').value = p.notes;

    document.getElementById('supplier-payment-form-title').innerText = 'تعديل الدفعة';
    document.getElementById('btn-save-supplier-payment').innerText = 'حفظ التعديلات';
    document.getElementById('btn-cancel-supplier-payment-edit').style.display = 'block';
}

function cancelSupplierPaymentEdit() {
    document.getElementById('supplier-payment-id').value = '';
    document.getElementById('form-record-supplier-payment').reset();
    document.getElementById('supplier-payment-date').value = new Date().toISOString().slice(0, 10);
    
    document.getElementById('supplier-payment-form-title').innerText = 'تسجيل دفعة جديدة';
    document.getElementById('btn-save-supplier-payment').innerText = 'حفظ الدفعة الجديدة';
    document.getElementById('btn-cancel-supplier-payment-edit').style.display = 'none';
}

async function deleteSupplierPayment(paymentId) {
    if (!confirm('هل أنت متأكد من حذف هذه الدفعة؟')) return;
    
    const p = state.supplierPayments.find(x => x._id === paymentId);
    if (!p) return;

    try {
        await window.api.deleteSupplierPayment(paymentId);
        await refreshAllData();
        renderSupplierPayments(p.invoiceId);
    } catch (error) {
        alert('فشل الحذف: ' + error.message);
    }
}

// =========================================================
// ===  COMBINED INVOICE  –  العملاء  =====================
// =========================================================

const PAYMENT_METHOD_LABELS = {
    cash: 'نقدي 💵',
    transfer: 'تحويل بنكي 🏦',
    credit: 'بطاقة ائتمان 💳',
    deferred: 'آجل / مؤجل 📅',
    mixed: 'متعدد / مختلط 🔀'
};

let combinedItems = [];

function openCombinedInvoiceModal(preselectedClient = '') {
    combinedItems = [];
    const sel = document.getElementById('combined-client-select');
    sel.innerHTML = '<option value="" disabled selected>اختر العميل...</option>';
    state.clients.forEach(c => {
        sel.innerHTML += `<option value="${c.name}">${c.name}</option>`;
    });
    if (preselectedClient) {
        sel.value = preselectedClient;
        loadClientOrders(preselectedClient);
    } else {
        renderCombinedItems();
    }
    document.getElementById('combined-payment-method').value = 'cash';
    document.getElementById('combined-notes').value = '';
    document.getElementById('ci-amount-paid').value = '0.00';
    document.getElementById('combined-add-row').style.display = 'none';
    updateCombinedSummary();
    openModal('modal-combined-invoice');
}

function loadClientOrders(clientName) {
    const clientOrders = state.orders.filter(o => o.client === clientName);
    combinedItems = clientOrders.map(o => ({
        desc: `${o.orderNumber} - ${o.materialName}`,
        width: o.width,
        height: o.height,
        qty: o.quantity,
        unitPrice: o.unitPrice
    }));
    renderCombinedItems();
    updateCombinedSummary();
}

function renderCombinedItems() {
    const tbody = document.getElementById('combined-items-tbody');
    if (combinedItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">اختر عميلاً أولاً لتظهر فواتيره أو أضف بنداً يدوياً.</td></tr>`;
        return;
    }
    let html = '';
    combinedItems.forEach((item, idx) => {
        const area = (parseFloat(item.width) || 0) * (parseFloat(item.height) || 0) * (parseInt(item.qty) || 1);
        const total = area * (parseFloat(item.unitPrice) || 0);
        const dimStr = (item.width && item.height) ? `${parseFloat(item.width).toFixed(2)} × ${parseFloat(item.height).toFixed(2)} م` : '-';
        html += `
            <tr>
                <td><strong>${idx + 1}</strong></td>
                <td>${item.desc}</td>
                <td style="font-size:11px;color:var(--text-secondary);">${dimStr}</td>
                <td>${item.qty}</td>
                <td>${parseFloat(item.unitPrice).toFixed(2)} ج.م</td>
                <td>${area.toFixed(2)} م²</td>
                <td><strong>${total.toFixed(2)} ج.م</strong></td>
                <td><button class="ci-delete-btn" onclick="removeCombinedItem(${idx})" title="حذف البند">🗑️</button></td>
            </tr>`;
    });
    tbody.innerHTML = html;
}

function removeCombinedItem(idx) {
    combinedItems.splice(idx, 1);
    renderCombinedItems();
    updateCombinedSummary();
}

function updateCombinedSummary() {
    const clientName = document.getElementById('combined-client-select').value || '-';
    const methodVal = document.getElementById('combined-payment-method').value;
    const paid = parseFloat(document.getElementById('ci-amount-paid').value) || 0;
    const total = combinedItems.reduce((sum, item) => {
        const area = (parseFloat(item.width) || 0) * (parseFloat(item.height) || 0) * (parseInt(item.qty) || 1);
        return sum + area * (parseFloat(item.unitPrice) || 0);
    }, 0);
    const remaining = Math.max(0, total - paid);
    document.getElementById('ci-summary-client').innerText = clientName;
    document.getElementById('ci-summary-count').innerText = `${combinedItems.length} بند`;
    document.getElementById('ci-summary-total').innerText = `${total.toFixed(2)} ج.م`;
    document.getElementById('ci-summary-remaining').innerText = `${remaining.toFixed(2)} ج.م`;
    document.getElementById('ci-summary-method').innerText = PAYMENT_METHOD_LABELS[methodVal] || methodVal;
}

function addCombinedItem() {
    const desc = document.getElementById('new-item-desc').value.trim();
    const width = parseFloat(document.getElementById('new-item-width').value) || 0;
    const height = parseFloat(document.getElementById('new-item-height').value) || 0;
    const qty = parseInt(document.getElementById('new-item-qty').value) || 1;
    const unitPrice = parseFloat(document.getElementById('new-item-price').value) || 0;
    if (!desc) { alert('يرجى إدخال وصف البند.'); return; }
    if (unitPrice <= 0) { alert('يرجى إدخال سعر صحيح.'); return; }
    combinedItems.push({ desc, width, height, qty, unitPrice });
    renderCombinedItems();
    updateCombinedSummary();
    document.getElementById('new-item-desc').value = '';
    document.getElementById('new-item-width').value = '';
    document.getElementById('new-item-height').value = '';
    document.getElementById('new-item-qty').value = '1';
    document.getElementById('new-item-price').value = '';
    document.getElementById('combined-add-row').style.display = 'none';
}

function printCombinedInvoice() {
    const clientName = document.getElementById('combined-client-select').value;
    if (!clientName) { alert('يرجى اختيار العميل أولاً.'); return; }
    if (combinedItems.length === 0) { alert('يرجى إضافة بند واحد على الأقل.'); return; }
    const methodVal = document.getElementById('combined-payment-method').value;
    const notes = document.getElementById('combined-notes').value.trim();
    const paid = parseFloat(document.getElementById('ci-amount-paid').value) || 0;
    const total = combinedItems.reduce((sum, item) => {
        const area = (parseFloat(item.width) || 0) * (parseFloat(item.height) || 0) * (parseInt(item.qty) || 1);
        return sum + area * (parseFloat(item.unitPrice) || 0);
    }, 0);
    const remaining = Math.max(0, total - paid);
    const now = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });
    const invoiceNo = `CI-${Date.now().toString().slice(-6)}`;

    let rowsHtml = '';
    combinedItems.forEach((item, idx) => {
        const area = (parseFloat(item.width)||0) * (parseFloat(item.height)||0) * (parseInt(item.qty)||1);
        const itemTotal = area * (parseFloat(item.unitPrice)||0);
        const dimStr = (item.width && item.height) ? `${parseFloat(item.width).toFixed(2)} × ${parseFloat(item.height).toFixed(2)}` : '-';
        rowsHtml += `
            <tr>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${idx+1}</td>
                <td style="padding:8px;border:1px solid #ddd;"><strong>${item.desc}</strong></td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${dimStr}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${item.qty}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${parseFloat(item.unitPrice).toFixed(2)}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${area.toFixed(2)}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:800;color:#1565C0;">${itemTotal.toFixed(2)}</td>
            </tr>`;
    });

    document.getElementById('invoice-print-section').innerHTML = `
        <div class="print-invoice-header">
            <div class="print-logo-section">
                <img src="../logo.png" alt="Logo" class="print-logo" onerror="this.style.display='none'">
                <div>
                    <h1 style="font-size:20px;font-weight:800;color:#000;">مطبعة كارما برنت</h1>
                    <span style="font-size:10px;color:#555;">للأعمال الدعائية والإعلانية والطباعة الرقمية</span>
                </div>
            </div>
            <div class="print-shop-details">
                <strong>الرقم الضريبي: ${state.shopSettings.taxNo}</strong>
                <span>الهاتف: ${state.shopSettings.phone}</span>
                <span>العنوان: ${state.shopSettings.address}</span>
            </div>
        </div>
        <div class="print-invoice-title">فاتورة مجمعة</div>
        <div class="print-billing-details">
            <div class="print-client-col">
                <strong>الفاتورة صادرة إلى:</strong>
                <span style="font-size:16px;font-weight:800;color:#1565C0;margin-top:4px;">${clientName}</span>
                <span>تاريخ: ${now}</span>
            </div>
            <div class="print-meta-col">
                <span>رقم الفاتورة: <strong style="color:#D84315;font-size:15px;">${invoiceNo}</strong></span>
                <span>طريقة السداد: <strong>${PAYMENT_METHOD_LABELS[methodVal]||methodVal}</strong></span>
            </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-family:'Cairo',sans-serif;direction:rtl;">
            <thead>
                <tr style="background:#1a237e;color:#fff;">
                    <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:12px;">#</th>
                    <th style="padding:10px;border:1px solid #ddd;font-size:12px;">وصف العمل / الخامة</th>
                    <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:12px;">الأبعاد (م)</th>
                    <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:12px;">الكمية</th>
                    <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:12px;">سعر م²</th>
                    <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:12px;">المساحة م²</th>
                    <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:12px;">الإجمالي (ج.م)</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div class="print-summary-box">
            <table class="print-summary-table">
                <tr class="total-row"><td>المجموع الإجمالي:</td><td><strong>${total.toFixed(2)} ج.م</strong></td></tr>
                <tr><td>المبلغ المدفوع:</td><td style="color:#00c853;font-weight:800;">${paid.toFixed(2)} ج.م</td></tr>
                <tr style="border-top:2px solid #000;"><td><strong>المبلغ المتبقي:</strong></td><td style="color:${remaining>0?'#ff6f00':'#000'};font-weight:900;">${remaining.toFixed(2)} ج.م</td></tr>
            </table>
        </div>
        ${notes ? `<div style="margin-top:15px;padding:10px;background:#f9f9f9;border:1px dashed #ccc;border-radius:6px;font-family:'Cairo',sans-serif;"><strong>ملاحظات:</strong> ${notes}</div>` : ''}
        <div class="print-footer">
            <p>شكراً لتعاملكم مع مطبعة كارما برنت الرقمية</p>
        </div>`;
    window.print();
}

// =========================================================
// ===  COMBINED INVOICE  –  الموردون  ====================
// =========================================================

let supCombinedItems = [];

function openSupplierCombinedInvoiceModal(preselectedSupplier = '') {
    supCombinedItems = [];
    const sel = document.getElementById('sup-combined-supplier-select');
    sel.innerHTML = '<option value="" disabled selected>اختر المورد...</option>';
    state.suppliers.forEach(s => {
        sel.innerHTML += `<option value="${s.name}">${s.name}${s.company ? ' - ' + s.company : ''}</option>`;
    });
    if (preselectedSupplier) {
        sel.value = preselectedSupplier;
        loadSupplierInvoicesItems(preselectedSupplier);
    } else {
        renderSupCombinedItems();
    }
    document.getElementById('sup-combined-payment-method').value = 'cash';
    document.getElementById('sup-combined-notes').value = '';
    document.getElementById('sup-ci-amount-paid').value = '0.00';
    document.getElementById('sup-combined-add-row').style.display = 'none';
    updateSupCombinedSummary();
    openModal('modal-supplier-combined-invoice');
}

function loadSupplierInvoicesItems(supplierName) {
    const invs = state.supplierInvoices.filter(i => i.supplierName === supplierName);
    supCombinedItems = invs.map(inv => ({
        desc: `${inv.invoiceNumber} - ${inv.materialName}`,
        qty: parseFloat(inv.quantity),
        unit: 'متر مربع',
        unitPrice: parseFloat(inv.unitPrice)
    }));
    renderSupCombinedItems();
    updateSupCombinedSummary();
}

function renderSupCombinedItems() {
    const tbody = document.getElementById('sup-combined-items-tbody');
    if (supCombinedItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">اختر موردًا أولاً لتظهر فواتيره أو أضف بنداً يدوياً.</td></tr>`;
        return;
    }
    let html = '';
    supCombinedItems.forEach((item, idx) => {
        const total = (parseFloat(item.qty)||0) * (parseFloat(item.unitPrice)||0);
        html += `
            <tr>
                <td><strong>${idx+1}</strong></td>
                <td>${item.desc}</td>
                <td>${parseFloat(item.qty).toFixed(2)}</td>
                <td style="font-size:11px;color:var(--text-secondary);">${item.unit}</td>
                <td>${parseFloat(item.unitPrice).toFixed(2)} ج.م</td>
                <td><strong>${total.toFixed(2)} ج.م</strong></td>
                <td><button class="ci-delete-btn" onclick="removeSupCombinedItem(${idx})" title="حذف البند">🗑️</button></td>
            </tr>`;
    });
    tbody.innerHTML = html;
}

function removeSupCombinedItem(idx) {
    supCombinedItems.splice(idx, 1);
    renderSupCombinedItems();
    updateSupCombinedSummary();
}

function updateSupCombinedSummary() {
    const supplierName = document.getElementById('sup-combined-supplier-select').value || '-';
    const methodVal = document.getElementById('sup-combined-payment-method').value;
    const paid = parseFloat(document.getElementById('sup-ci-amount-paid').value) || 0;
    const total = supCombinedItems.reduce((sum, item) => {
        return sum + (parseFloat(item.qty)||0) * (parseFloat(item.unitPrice)||0);
    }, 0);
    const remaining = Math.max(0, total - paid);
    document.getElementById('sup-ci-summary-supplier').innerText = supplierName;
    document.getElementById('sup-ci-summary-count').innerText = `${supCombinedItems.length} بند`;
    document.getElementById('sup-ci-summary-total').innerText = `${total.toFixed(2)} ج.م`;
    document.getElementById('sup-ci-summary-remaining').innerText = `${remaining.toFixed(2)} ج.م`;
    document.getElementById('sup-ci-summary-method').innerText = PAYMENT_METHOD_LABELS[methodVal] || methodVal;
}

function addSupCombinedItem() {
    const desc = document.getElementById('sup-new-item-desc').value.trim();
    const qty = parseFloat(document.getElementById('sup-new-item-qty').value) || 0;
    const unit = document.getElementById('sup-new-item-unit').value;
    const unitPrice = parseFloat(document.getElementById('sup-new-item-price').value) || 0;
    if (!desc) { alert('يرجى إدخال اسم الخامة / البند.'); return; }
    if (qty <= 0) { alert('يرجى إدخال كمية صحيحة.'); return; }
    if (unitPrice <= 0) { alert('يرجى إدخال سعر صحيح.'); return; }
    supCombinedItems.push({ desc, qty, unit, unitPrice });
    renderSupCombinedItems();
    updateSupCombinedSummary();
    document.getElementById('sup-new-item-desc').value = '';
    document.getElementById('sup-new-item-qty').value = '1';
    document.getElementById('sup-new-item-price').value = '';
    document.getElementById('sup-combined-add-row').style.display = 'none';
}

function printSupplierCombinedInvoice() {
    const supplierName = document.getElementById('sup-combined-supplier-select').value;
    if (!supplierName) { alert('يرجى اختيار المورد أولاً.'); return; }
    if (supCombinedItems.length === 0) { alert('يرجى إضافة بند واحد على الأقل.'); return; }
    const methodVal = document.getElementById('sup-combined-payment-method').value;
    const notes = document.getElementById('sup-combined-notes').value.trim();
    const paid = parseFloat(document.getElementById('sup-ci-amount-paid').value) || 0;
    const total = supCombinedItems.reduce((sum, item) => {
        return sum + (parseFloat(item.qty)||0) * (parseFloat(item.unitPrice)||0);
    }, 0);
    const remaining = Math.max(0, total - paid);
    const now = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });
    const invoiceNo = `PO-${Date.now().toString().slice(-6)}`;

    let rowsHtml = '';
    supCombinedItems.forEach((item, idx) => {
        const itemTotal = (parseFloat(item.qty)||0) * (parseFloat(item.unitPrice)||0);
        rowsHtml += `
            <tr>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${idx+1}</td>
                <td style="padding:8px;border:1px solid #ddd;"><strong>${item.desc}</strong></td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${parseFloat(item.qty).toFixed(2)}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${item.unit}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${parseFloat(item.unitPrice).toFixed(2)}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:800;color:#E65100;">${itemTotal.toFixed(2)}</td>
            </tr>`;
    });

    document.getElementById('invoice-print-section').innerHTML = `
        <div class="print-invoice-header">
            <div class="print-logo-section">
                <img src="../logo.png" alt="Logo" class="print-logo" onerror="this.style.display='none'">
                <div>
                    <h1 style="font-size:20px;font-weight:800;color:#000;">مطبعة كارما برنت</h1>
                    <span style="font-size:10px;color:#555;">للأعمال الدعائية والإعلانية والطباعة الرقمية</span>
                </div>
            </div>
            <div class="print-shop-details">
                <strong>الرقم الضريبي: ${state.shopSettings.taxNo}</strong>
                <span>الهاتف: ${state.shopSettings.phone}</span>
                <span>العنوان: ${state.shopSettings.address}</span>
            </div>
        </div>
        <div class="print-invoice-title" style="background:#fff3e0;border:1px solid #ffe0b2;">
            <strong style="font-size:18px;color:#E65100;">أمر شراء مجمع - Purchase Order</strong>
        </div>
        <div class="print-billing-details">
            <div class="print-client-col">
                <strong>صادر إلى المورد:</strong>
                <span style="font-size:16px;font-weight:800;color:#E65100;margin-top:4px;">${supplierName}</span>
                <span>تاريخ الأمر: ${now}</span>
            </div>
            <div class="print-meta-col">
                <span>رقم الأمر: <strong style="color:#1565C0;font-size:15px;">${invoiceNo}</strong></span>
                <span>طريقة السداد: <strong>${PAYMENT_METHOD_LABELS[methodVal]||methodVal}</strong></span>
            </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-family:'Cairo',sans-serif;direction:rtl;">
            <thead>
                <tr style="background:#e65100;color:#fff;">
                    <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:12px;">#</th>
                    <th style="padding:10px;border:1px solid #ddd;font-size:12px;">الخامة / البند</th>
                    <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:12px;">الكمية</th>
                    <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:12px;">وحدة القياس</th>
                    <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:12px;">سعر الوحدة (ج.م)</th>
                    <th style="padding:10px;border:1px solid #ddd;text-align:center;font-size:12px;">الإجمالي (ج.م)</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
        <div class="print-summary-box">
            <table class="print-summary-table">
                <tr class="total-row"><td>المجموع الإجمالي:</td><td><strong>${total.toFixed(2)} ج.م</strong></td></tr>
                <tr><td>المبلغ المدفوع / السلفة:</td><td style="color:#2e7d32;font-weight:800;">${paid.toFixed(2)} ج.م</td></tr>
                <tr style="border-top:2px solid #000;"><td><strong>المبلغ المتبقي:</strong></td><td style="color:${remaining>0?'#E65100':'#000'};font-weight:900;">${remaining.toFixed(2)} ج.م</td></tr>
            </table>
        </div>
        ${notes ? `<div style="margin-top:15px;padding:10px;background:#fff8e1;border:1px dashed #ffe082;border-radius:6px;font-family:'Cairo',sans-serif;"><strong>ملاحظات:</strong> ${notes}</div>` : ''}
        <div class="print-footer"><p>تم إصدار هذا الأمر من نظام مطبعة كارما برنت</p></div>`;
    window.print();
}

// =========================================================
// ===  Event Wiring  –  Combined Invoices  ===============
// =========================================================
function initCombinedInvoiceListeners() {

    // ── Customer Combined Invoice ──
    document.getElementById('btn-combined-invoice').addEventListener('click', () => openCombinedInvoiceModal());
    document.getElementById('combined-client-select').addEventListener('change', e => { loadClientOrders(e.target.value); updateCombinedSummary(); });
    document.getElementById('combined-payment-method').addEventListener('change', updateCombinedSummary);
    document.getElementById('ci-amount-paid').addEventListener('input', updateCombinedSummary);
    document.getElementById('btn-add-combined-item').addEventListener('click', () => { document.getElementById('combined-add-row').style.display = 'block'; });
    document.getElementById('btn-confirm-add-item').addEventListener('click', addCombinedItem);
    document.getElementById('btn-cancel-add-item').addEventListener('click', () => { document.getElementById('combined-add-row').style.display = 'none'; });
    document.getElementById('btn-print-combined-invoice').addEventListener('click', printCombinedInvoice);

    // ── Supplier Combined Invoice ──
    document.getElementById('btn-supplier-combined-invoice').addEventListener('click', () => openSupplierCombinedInvoiceModal());
    document.getElementById('sup-combined-supplier-select').addEventListener('change', e => { loadSupplierInvoicesItems(e.target.value); updateSupCombinedSummary(); });
    document.getElementById('sup-combined-payment-method').addEventListener('change', updateSupCombinedSummary);
    document.getElementById('sup-ci-amount-paid').addEventListener('input', updateSupCombinedSummary);
    document.getElementById('btn-add-sup-combined-item').addEventListener('click', () => { document.getElementById('sup-combined-add-row').style.display = 'block'; });
    document.getElementById('btn-sup-confirm-add-item').addEventListener('click', addSupCombinedItem);
    document.getElementById('btn-sup-cancel-add-item').addEventListener('click', () => { document.getElementById('sup-combined-add-row').style.display = 'none'; });
    document.getElementById('btn-print-supplier-combined-invoice').addEventListener('click', printSupplierCombinedInvoice);
}
